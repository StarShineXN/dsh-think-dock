/**
 * Host half of dsh-think-dock.
 *
 * The panel itself is a browser-only feature: it reads the Chat snapshot that
 * `@deepseek-ai/dsh-client-ui-chat` already projects. The one thing a page
 * cannot do on its own is reaching a translation provider — a cross-origin
 * request from the page is refused by the browser — so this half answers a
 * same-origin route, `/think-dock/translate`, and forwards each fragment.
 *
 * When the shipped `translator` service is mounted (the "思考翻译" plugin's host
 * half) the route reuses it, so the configured provider and its limits apply.
 * Otherwise it calls the same public Edge endpoint that service's `bing`
 * provider uses.
 */

export const name = 'dsh-think-dock'

const VERSION = 2
const ENDPOINT = 'https://edge.microsoft.com/translate/translatetext'
const TARGET = 'zh-Hans'
const MAX_CHARS = 4000
const MAX_HISTORY_CHARS = 400000
const TIMEOUT_MS = 15000

/**
 * Read the whole request body with a hard size ceiling.
 * @param {import('node:http').IncomingMessage} request - the proxied request.
 * @returns {Promise<string>} the UTF-8 body.
 */
function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/**
 * Ask the shipped translator service for one fragment.
 * @param {any} translator - the mounted `translator` service.
 * @param {string} text - the fragment to translate.
 * @param {AbortSignal} signal - request lifetime.
 * @returns {Promise<string>} the translated text.
 */
async function viaService(translator, text, signal) {
  const spec = translator.resolve({ text, targetLanguage: TARGET })
  const translated = await translator.translate(spec, signal)
  if (typeof translated !== 'string' || translated === '') throw new Error('translator returned an empty result')
  return translated
}

/**
 * Call the public Edge translator the way the shipped `bing` provider does.
 * @param {string} text - the fragment to translate.
 * @param {AbortSignal} signal - request lifetime.
 * @returns {Promise<string>} the translated text.
 */
async function viaEndpoint(text, signal) {
  const response = await fetch(`${ENDPOINT}?to=${encodeURIComponent(TARGET)}&isEnterpriseClient=false`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify([text]),
    signal,
  })
  if (!response.ok) throw new Error(`upstream HTTP ${response.status}`)
  const payload = await response.json()
  const first = Array.isArray(payload) ? payload[0] : undefined
  const translations = first !== null && typeof first === 'object' ? first.translations : undefined
  const entry = Array.isArray(translations) ? translations[0] : undefined
  const translated = entry !== null && typeof entry === 'object' ? entry.text : undefined
  if (typeof translated !== 'string' || translated === '') throw new Error('empty translation')
  return translated
}

/**
 * Build the route handler bound to one plugin context.
 * @param {() => any} getTranslator - lazy accessor for the optional service.
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} the handler.
 */
function createHandler(getTranslator) {
  return async function handleTranslate(request, response) {
    const send = (status, payload) => {
      if (response.headersSent) return
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ v: VERSION, ...payload }))
    }
    if (request.method !== 'POST') {
      send(405, { ok: false, error: 'method not allowed' })
      return
    }
    let text
    try {
      const body = await readBody(request)
      const parsed = JSON.parse(body)
      text = typeof parsed?.text === 'string' ? parsed.text : ''
    } catch (error) {
      send(400, { ok: false, error: String(error?.message ?? error) })
      return
    }
    if (text.trim() === '') {
      send(400, { ok: false, error: 'empty text' })
      return
    }
    if (text.length > MAX_CHARS) {
      send(413, { ok: false, error: 'text too long' })
      return
    }
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
    const failures = []
    try {
      const translator = getTranslator()
      if (translator !== undefined && translator !== null) {
        try {
          send(200, { ok: true, route: 'service', text: await viaService(translator, text, abort.signal), targetLanguage: TARGET })
          return
        } catch (error) {
          failures.push(`service: ${String(error?.message ?? error)}`)
        }
      }
      try {
        send(200, { ok: true, route: 'edge', text: await viaEndpoint(text, abort.signal), targetLanguage: TARGET })
        return
      } catch (error) {
        failures.push(`edge: ${String(error?.message ?? error)}`)
      }
      send(502, { ok: false, error: failures.join(' | ') })
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Text of one user message.
 * @param {any} message - a `UserMessage`.
 * @returns {string} the concatenated text blocks.
 */
function userText(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  let text = ''
  for (const block of content) {
    if (block !== null && block !== undefined && block.type === 'text' && typeof block.text === 'string') text += block.text
  }
  return text
}

/**
 * Reasoning blocks of one assistant message.
 * @param {any} message - an `AssistantMessage`.
 * @returns {string} the reasoning text, joined.
 */
function reasoningText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block !== null && block !== undefined && block.type === 'reasoning' && typeof block.text === 'string' && block.text.trim() !== '') {
      parts.push(block.text)
    }
  }
  return parts.join('\n\n')
}

/**
 * Reasoning recorded as stream chunks (used before the message is folded).
 * @param {any} stream - `AssistantStreamRecord[]`.
 * @returns {string} the reasoning text, joined.
 */
function streamReasoning(stream) {
  if (!Array.isArray(stream)) return ''
  const parts = []
  for (const record of stream) {
    if (record === null || record === undefined) continue
    if (record.type !== 'reasoning-chunks' || !Array.isArray(record.texts)) continue
    const text = record.texts.join('')
    if (text.trim() !== '') parts.push(text)
  }
  return parts.join('\n\n')
}

/**
 * Fold a raw session log into turns, user prompts and step reasoning.
 * @param {readonly any[]} events - the session log in ascending seq order.
 * @returns {{turn: number, userText: string, steps: {step: number, text: string, chars: number}[]}[]} turns.
 */
function replayHistory(events) {
  const turns = []
  const byTurn = new Map()
  let pendingUser = ''
  let total = 0
  const open = (turnNumber) => {
    let found = byTurn.get(turnNumber)
    if (found === undefined) {
      found = { turn: turnNumber, userText: '', steps: [], seen: new Set() }
      byTurn.set(turnNumber, found)
      turns.push(found)
    }
    return found
  }
  for (const event of events) {
    if (event === null || event === undefined) continue
    const data = event.data
    if (event.type === 'user/message') {
      const text = userText(data)
      if (text.trim() !== '') {
        // Newer logs record the prompt after the turn opened, older ones before
        // it; either way the prompt belongs to the turn it was written for.
        const last = turns[turns.length - 1]
        if (pendingUser === '' && last !== undefined) {
          last.userText = last.userText === '' ? text : last.userText + '\n\n' + text
        } else {
          pendingUser = pendingUser === '' ? text : pendingUser + '\n\n' + text
        }
      }
      continue
    }
    if (event.type === 'turn/start') {
      const turn = open(data.turn)
      if (pendingUser !== '') {
        turn.userText = pendingUser
        pendingUser = ''
      }
      continue
    }
    if (event.type !== 'assistant/message') continue
    // Shadowed or replaced messages are the losing side of a surface rewrite.
    if (event.surfaceOp !== undefined && event.surfaceOp !== 'append') continue
    const text = reasoningText(data.message) || streamReasoning(data.stream)
    if (text === '') continue
    total += text.length
    if (total > MAX_HISTORY_CHARS) break
    const turn = open(data.turn)
    const stepNumber = data.step
    const entry = { step: stepNumber, text, chars: text.length }
    if (turn.seen.has(stepNumber)) {
      const index = turn.steps.findIndex((step) => step.step === stepNumber)
      if (index >= 0) turn.steps[index] = entry
    } else {
      turn.seen.add(stepNumber)
      turn.steps.push(entry)
    }
  }
  turns.sort((left, right) => left.turn - right.turn)
  return turns.map((turn) => ({
    turn: turn.turn,
    userText: turn.userText,
    steps: turn.steps.slice().sort((left, right) => left.step - right.step),
  }))
}

/**
 * Build the history route: the whole session log, independent of the Chat
 * window that happens to be loaded in the page.
 * @param {() => {query: any, sessions: any}} getServices - accessors for the session services.
 * @returns {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} the handler.
 */
function createHistoryHandler(getServices) {
  return async function handleHistory(request, response) {
    const send = (status, payload) => {
      if (response.headersSent) return
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ v: VERSION, ...payload }))
    }
    if (request.method !== 'POST') {
      send(405, { ok: false, error: 'method not allowed' })
      return
    }
    let sessionId
    try {
      const body = await readBody(request)
      const parsed = JSON.parse(body)
      sessionId = typeof parsed?.sessionId === 'string' ? parsed.sessionId : ''
    } catch (error) {
      send(400, { ok: false, error: String(error?.message ?? error) })
      return
    }
    if (sessionId === '') {
      send(400, { ok: false, error: 'missing sessionId' })
      return
    }
    const { query, sessions } = getServices()
    let events
    try {
      const live = sessions?.get?.(sessionId)
      if (live !== undefined && live !== null) {
        events = live.snapshotEvents()
      } else if (query !== undefined && query !== null) {
        const snapshot = await query.readSession(sessionId)
        events = snapshot.events
      } else {
        send(503, { ok: false, error: 'no session service' })
        return
      }
    } catch (error) {
      send(500, { ok: false, error: String(error?.message ?? error) })
      return
    }
    send(200, { ok: true, sessionId, turns: replayHistory(events) })
  }
}

/** @param {import('@deepseek-ai/cordis').Context} ctx - plugin context. */
export function apply(ctx) {
  ctx.inject(['webServer'], (child) => {
    const route = (path, handler) =>
      child.effect(() => child.webServer.register({ kind: 'exact', path, handler }))
    route('/think-dock/translate', createHandler(() => child.get('translator')))
    route(
      '/think-dock/history',
      createHistoryHandler(() => ({ query: child.get('sessionQuery'), sessions: child.get('sessions') })),
    )
  })
}

export default apply

