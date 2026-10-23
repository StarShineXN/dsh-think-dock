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

/** @param {import('@deepseek-ai/cordis').Context} ctx - plugin context. */
export function apply(ctx) {
  ctx.inject(['webServer'], (child) => {
    const handler = createHandler(() => child.get('translator'))
    child.effect(() =>
      child.webServer.register({
        kind: 'exact',
        path: '/think-dock/translate',
        handler,
      }),
    )
  })
}

export default apply
