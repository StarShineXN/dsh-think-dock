# Think Dock

> A right-sidebar dock for the model's thinking in DeepSeek Harness. The conversation stays clean; the reasoning stays one click away.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

**English** · [简体中文](README.zh-CN.md)

![Think Dock](docs/screenshots/dock-paper.png)

## Why

In DeepSeek Harness the model's reasoning sits behind a collapsible *Think* row inside the conversation. Expanding it pushes the chat around, and after a dozen turns the thinking of turn 7 is a long scroll away.

**Think Dock** registers a *Thinking* tab in the right sidebar and renders the same reasoning stream as a per-turn, per-step timeline: collapsible, copyable, translatable — **without touching the chat**.

## Features

- Timeline grouped by **turn → step**, appended live while the model streams.
- Read-only: no changes to the conversation, messages or composer.
- **Translation in three modes** — `off` / `new only` (default: only reasoning that arrives after you open the dock) / `everything` — plus a bilingual switch (original above, translation below).
- Translation source is picked automatically: your installed *reasoning translation* plugin is reused when present; otherwise a bundled same-origin route proxies to Microsoft Edge's public translator.
- Inherits the DSH light/dark theme through existing CSS variables.
- Preferences (translation mode, bilingual, expansion) persist in `localStorage`.
- Per-step status dot, character count and streaming tail.

## Install

Requires **DeepSeek Harness 0.2.1-rc.2+** (web or desktop build).

### Option A · plugin manager

Clone or unzip this repository anywhere, then install the local package:

```text
plugin_manager({ action: "install_bundle", target: "file:<absolute path to this repository>" })
```

Restart DSH afterwards (the host half mounts `/think-dock/translate`).

### Option B · manual

```powershell
$profile = "$env:USERPROFILE\.dsh\profiles\desktop"
Copy-Item -Recurse .\dsh-think-dock "$profile\node_modules\dsh-think-dock"
# add "dsh-think-dock" to dsh.profile.bundles in $profile\package.json, then restart DSH
```

## Usage

1. Open a session, click **+** at the top of the right sidebar;
2. Pick **Thinking**;
3. Keep chatting — new reasoning appears live. Click a step header to collapse/expand, or *Copy step* to grab its text.

![Settings](docs/screenshots/dock-settings.png)

## Limitations

- Only turns already loaded in the page are shown; scroll up in the conversation to load older ones.
- Translation needs outbound access to `edge.microsoft.com`, unless your own translation plugin is installed.
- Translation is fragment-based, 1200 characters per request at most.
- The dock is a read-only view: you cannot edit or resend messages from it.

## Development

No build step: the browser half is plain ESM loaded by the DSH module loader.

```
dsh-think-dock/
├─ package.json          # dsh.bundle.patch / dsh.client declarations
├─ cordis.patch.yml      # the single host-side loader row
├─ lib/index.js          # host half: same-origin translation route (optional)
├─ lib/client.js         # browser half: sidebar tab + timeline + translation UI
└─ docs/                 # screenshots and the offline design preview
```

Restart DSH after editing `lib/*.js` — the browser half is assembled at page load and the host half is not hot-reloaded.

## License

MIT © 2026 StarShine-XiuNing
