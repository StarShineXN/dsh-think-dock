/**
 * Browser half of dsh-think-dock.
 *
 * Registers one right-sidebar tab type ("思考") that renders the reasoning
 * stream of the on-screen Session as a readable timeline. The text comes from
 * the Chat snapshot that `@deepseek-ai/dsh-client-ui-chat` already projects:
 * every `assistant-step` node carries `data.blocks`, and a
 * `{ kind: 'reasoning', text }` block is the same text the conversation's Think
 * row renders while streaming.
 *
 * Translation reuses the reader's own "思考翻译" plugin: when
 * `remote.cotTranslation` is mounted, fragments of the reasoning text are sent
 * through the provider and target language the reader already configured there,
 * so no separate settings exist and no request is sent while translation is
 * switched off.
 */

window.__ModuleLoader__.load({
  id: 'dsh-think-dock',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const ReactModule = require('react')
    const React = ReactModule && ReactModule.default ? ReactModule.default : ReactModule
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** This package's copy namespace. */
    const NS = 'dsh-think-dock'
    /** The tab type id: also the registration key of the tab body slot. */
    const TAB_ID = 'dsh-think-dock'
    /** The kind stored in the sidebar layout; it never changes between sessions. */
    const TAB_KIND = 'think-dock'

    // #region dictionaries
    /** Simplified Chinese dictionary, the key-set source of truth. */
    const zh = {
      'tab.title': '思考',
      'guide.title': '思考',
      'guide.description': '把思考过程放到右侧栏实时显示，对话区不再被撑开。',
      'panel.subtitle': '{steps} 步 · {chars} 字',
      'empty.title': '还没有思考内容',
      'empty.hint': '模型开始思考后，它的推理过程会实时出现在这里。',
      'turn.label': '第 {n} 轮',
      'step.label': '第 {n} 步',
      'chars': '{n} 字',
      'live': '思考中',
      'settled': '已完成',
      'interrupted': '已中断',
      'copy': '复制',
      'copy.all': '复制全部',
      'copied': '已复制',
      'copy.failed': '复制失败',
      'copy.step': '复制本步',
      'jump': '跳到最新',
      'failed': '面板无法显示：{message}',
      'translated': '译文',
      'original': '原文',
      'translating': '翻译中',
      'translate.failed': '翻译失败，已显示原文',
      'translate.unavailable': '未检测到「思考翻译」插件，译文不可用',
      'translate.route': '{provider} → {lang}',
      'follow': '跟随',
      'expand': '展开',
      'collapse': '收起',
      'expand.all': '展开全部',
      'collapse.all': '收起全部',
      'retry': '重试',
      'mode.label': '翻译',
      'mode.off': '不翻译',
      'mode.new': '只翻译新的',
      'mode.all': '全部翻译',
      'bilingual': '双语对照',
      'translate.this': '翻译本步',
      'view.original': '显示原文',
      'view.translated': '显示译文',
      'copy.original': '复制原文',
      'history.note': '只显示已加载的最近轮次；更早的思考需在对话区向上滚动加载',
      'history.older': '载入更早',
      'history.oldest': '已到最早',
      'history.search': '搜历史轮次…',
      'history.loading': '读取历史…',
      'history.failed': '历史读取失败',
      'history.state': '已显示 {shown} / {total} 轮',
      'map.title': '轮次地图',
      'appearance.title': '外观',
      'appearance.theme': '主题',
      'appearance.paper': '纸白',
      'appearance.ink': '夜墨',
      'appearance.auto': '跟随系统深浅',
      'appearance.depth': '气泡深浅',
      'appearance.aiDepth': '思考气泡深浅',
      'appearance.radius': '气泡圆角',
      'appearance.tail': '气泡尖角',
      'appearance.tailRight': '右侧',
      'appearance.tailLeft': '左侧',
      'appearance.tailNone': '无',
      'appearance.bg': '背景图地址',
    }
    /** English dictionary, checked against the Chinese key set. */
    const en = {
      'tab.title': 'Thinking',
      'guide.title': 'Thinking',
      'guide.description': 'Streams the model’s reasoning into the right column instead of expanding it in the conversation.',
      'panel.subtitle': '{steps} steps · {chars} chars',
      'empty.title': 'No thinking yet',
      'empty.hint': 'The reasoning stream appears here as soon as the model starts thinking.',
      'turn.label': 'Turn {n}',
      'step.label': 'Step {n}',
      'chars': '{n} chars',
      'live': 'Thinking',
      'settled': 'Done',
      'interrupted': 'Interrupted',
      'copy': 'Copy',
      'copy.all': 'Copy all',
      'copied': 'Copied',
      'copy.failed': 'Copy failed',
      'copy.step': 'Copy this step',
      'jump': 'Jump to latest',
      'failed': 'This panel cannot render: {message}',
      'translated': 'Translation',
      'original': 'Original',
      'translating': 'Translating',
      'translate.failed': 'Translation failed — showing the original',
      'translate.unavailable': 'The “Reasoning translation” plugin is not available',
      'translate.route': '{provider} → {lang}',
      'follow': 'Follow',
      'expand': 'Expand',
      'collapse': 'Collapse',
      'expand.all': 'Expand all',
      'collapse.all': 'Collapse all',
      'retry': 'Retry',
      'mode.label': 'Translation',
      'mode.off': 'Off',
      'mode.new': 'New only',
      'mode.all': 'Everything',
      'bilingual': 'Bilingual',
      'translate.this': 'Translate',
      'view.original': 'Show original',
      'view.translated': 'Show translation',
      'copy.original': 'Copy original',
      'history.note': 'Only the loaded recent turns are shown; scroll up in the conversation to load earlier thinking',
      'history.older': 'Load earlier',
      'history.oldest': 'Earliest loaded',
      'history.search': 'Search turns…',
      'history.loading': 'Reading history…',
      'history.failed': 'History unavailable',
      'history.state': '{shown} / {total} turns',
      'map.title': 'Turn map',
      'appearance.title': 'Appearance',
      'appearance.theme': 'Theme',
      'appearance.paper': 'Paper',
      'appearance.ink': 'Ink',
      'appearance.auto': 'Follow system theme',
      'appearance.depth': 'Bubble depth',
      'appearance.aiDepth': 'Thought bubble depth',
      'appearance.radius': 'Corner radius',
      'appearance.tail': 'Bubble tail',
      'appearance.tailRight': 'Right',
      'appearance.tailLeft': 'Left',
      'appearance.tailNone': 'None',
      'appearance.bg': 'Background image URL',
    }
    // #endregion

    // #region styles
    const CSS = `
.dshrp-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,#fff);overflow:hidden}
.dshrp-root[data-theme="paper"]{--dsw-alias-bg-base:#f7f9fb;--dsw-alias-bg-layer-1:#e7f0fa;--dsw-alias-bg-layer-2:#dfe9f5;--dsw-alias-border-l2:#dce5ee;--dsw-alias-border-l4:#c7d6e4;--dsw-alias-label-primary:#1f2429;--dsw-alias-label-secondary:#33404d;--dsw-alias-label-tertiary:#5b6672;--dsw-alias-interactive-bg-hover:#eaf1f8;--rp-mine-base:#a6c7e8;--rp-ai-base:#e7f0fa}
.dshrp-root[data-theme="ink"]{--dsw-alias-bg-base:#22262a;--dsw-alias-bg-layer-1:#2c3236;--dsw-alias-bg-layer-2:#343b40;--dsw-alias-border-l2:#3c4449;--dsw-alias-border-l4:#4c565c;--dsw-alias-label-primary:#e6ebee;--dsw-alias-label-secondary:#c3cbd1;--dsw-alias-label-tertiary:#97a1a8;--dsw-alias-interactive-bg-hover:#333a40;--rp-mine-base:#4a545c;--rp-ai-base:#2c3236}
.dshrp-bar{position:relative;z-index:3;flex:none;display:flex;flex-direction:column;gap:8px;padding:12px 16px 10px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base,#fff)}
.dshrp-bar::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent),transparent);opacity:.9}
.dshrp-barRow{position:relative;display:flex;align-items:center;gap:10px;min-width:0}
.dshrp-title{display:flex;align-items:baseline;gap:8px;min-width:0;font-size:14px;font-weight:600;letter-spacing:.01em}
.dshrp-title small{font-weight:400;font-size:11.5px;color:var(--dsw-alias-label-tertiary);letter-spacing:0;white-space:nowrap}
.dshrp-actions{display:flex;align-items:center;gap:6px;margin-left:auto}
.dshrp-tool{font:inherit;font-size:11.5px;line-height:1.6;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:999px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;border:.5px solid transparent;transition:background .16s ease,color .16s ease,border-color .16s ease,opacity .16s ease;white-space:nowrap}
.dshrp-tool:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary)}
.dshrp-tool[data-on="true"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.1)));border-color:var(--dsw-alias-border-l2)}
.dshrp-tool[disabled]{opacity:.45;cursor:default}
.dshrp-tool svg{width:13px;height:13px;flex:none}
.dshrp-route{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);min-height:15px}
.dshrp-route[data-state="pending"]{color:var(--dsw-alias-label-secondary)}
.dshrp-route[data-state="failed"]{color:var(--dsw-alias-label-secondary)}
.dshrp-dotPulse{width:5px;height:5px;border-radius:50%;background:currentColor;animation:dshrp-pulse 1.4s ease-in-out infinite}
.dshrp-scroll{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 16px 96px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
.dshrp-scroll::-webkit-scrollbar{width:8px}
.dshrp-scroll::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.dshrp-inner{width:100%;max-width:860px;margin:0 auto}
.dshrp-note{margin:0 0 14px;padding:8px 12px;border-radius:10px;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent);border:.5px solid var(--dsw-alias-border-l2)}
.dshrp-turn{scroll-margin-top:10px;margin:0 0 20px}
.dshrp-turn:last-child{margin-bottom:0}
.dshrp-turnHead{display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:0 2px}
.dshrp-turnBadge{flex:none;font-size:10.5px;line-height:1.6;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 9px}
.dshrp-rule{flex:1;height:1px;background:linear-gradient(90deg,var(--dsw-alias-border-l2),transparent)}
.dshrp-steps{display:flex;flex-direction:column;gap:10px}
.dshrp-card{position:relative;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05));overflow:hidden;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;animation:dshrp-rise .2s ease-out both}
.dshrp-card:hover{border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l2));box-shadow:0 1px 2px rgba(0,0,0,.03)}
.dshrp-card[data-live="true"]{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 22%,var(--dsw-alias-border-l2));box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dshrp-cardHead{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;text-align:left}
.dshrp-cardHead:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:-2px}
.dshrp-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary);opacity:.5}
.dshrp-card[data-live="true"] .dshrp-dot{opacity:1;background:var(--dsw-alias-label-primary);animation:dshrp-pulse 1.4s ease-in-out infinite}
.dshrp-card[data-status="interrupted"] .dshrp-dot{background:transparent;border:1px solid var(--dsw-alias-label-tertiary);opacity:.8}
.dshrp-cardTitle{font-size:12px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.dshrp-chip{flex:none;font-size:10.5px;line-height:1.5;padding:1px 7px;border-radius:999px;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.dshrp-card[data-live="true"] .dshrp-chip{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
.dshrp-meta{margin-left:auto;font-size:10.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dshrp-chev{width:12px;height:12px;flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .2s ease}
.dshrp-card[data-open="true"] .dshrp-chev{transform:rotate(90deg)}
.dshrp-collapse{display:grid;grid-template-rows:0fr;transition:grid-template-rows .26s cubic-bezier(.4,0,.2,1)}
.dshrp-collapse[data-open="true"]{grid-template-rows:1fr}
.dshrp-collapseInner{overflow:hidden;min-height:0}
.dshrp-body{padding:2px 14px 12px 26px;display:flex;flex-direction:column;gap:8px}
.dshrp-text{white-space:pre-wrap;word-break:break-word;font-size:13.5px;line-height:1.82;color:var(--dsw-alias-label-secondary)}
.dshrp-card[data-live="true"] .dshrp-text{color:var(--dsw-alias-label-primary)}
.dshrp-text[data-view="translated"]{color:var(--dsw-alias-label-primary)}
.dshrp-shimmer{height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--dsw-alias-label-secondary),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:dshrp-shimmer 1.5s ease-in-out infinite;opacity:.5;margin-top:2px}
.dshrp-tools{display:flex;align-items:center;gap:6px;padding:0 0 2px}
.dshrp-mini{font:inherit;font-size:10.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary);background:transparent;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.dshrp-mini:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dshrp-mini[data-on="true"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.1)))}
.dshrp-select{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 4px 0 9px;border-radius:999px;color:var(--dsw-alias-label-secondary);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05));transition:border-color .16s ease,color .16s ease}
.dshrp-select:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4,var(--dsw-alias-border-l2))}
.dshrp-select svg{width:13px;height:13px;flex:none}
.dshrp-select select{font:inherit;font-size:11.5px;line-height:1.6;color:inherit;background:transparent;border:0;outline:none;padding:0 2px 0 0;cursor:pointer;max-width:118px}
.dshrp-select select:disabled{cursor:default;opacity:.55}
.dshrp-select option{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,#fff)}
.dshrp-chip[data-kind="translated"]{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)}
.dshrp-preview{margin:2px 12px 11px 26px;font-size:12px;line-height:1.62;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word;opacity:.9}
.dshrp-bilingual{display:flex;flex-direction:column;gap:10px}
.dshrp-pane{display:flex;flex-direction:column;gap:3px}
.dshrp-paneLabel{font-size:10px;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center}
.dshrp-pane+.dshrp-pane{padding-top:10px;border-top:.5px dashed var(--dsw-alias-border-l2)}
.dshrp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:100%;padding:56px 24px;text-align:center;user-select:none}
.dshrp-emptyIcon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;margin:0 0 12px;border-radius:16px;color:var(--dsw-alias-label-tertiary);background:linear-gradient(160deg,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06)),transparent);border:.5px solid var(--dsw-alias-border-l2)}
.dshrp-emptyTitle{font-size:13.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0}
.dshrp-emptyHint{font-size:12px;line-height:1.75;color:var(--dsw-alias-label-tertiary);margin:0;max-width:300px}
.dshrp-error{margin:24px;padding:14px 16px;border-radius:12px;font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:.5px solid var(--dsw-alias-border-l2);white-space:pre-wrap;word-break:break-word}
.dshrp-jump{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:2;display:flex;align-items:center;gap:6px;font:inherit;font-size:11.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:5px 13px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.12);backdrop-filter:blur(6px);animation:dshrp-rise .18s ease-out both}
.dshrp-jump:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary)}
.dshrp-jump svg{width:12px;height:12px}
@keyframes dshrp-pulse{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes dshrp-rise{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
@keyframes dshrp-shimmer{0%{background-position:-40% 0}100%{background-position:140% 0}}
@media (prefers-reduced-motion: reduce){
  .dshrp-card,.dshrp-jump{animation:none}
  .dshrp-card[data-live="true"] .dshrp-dot,.dshrp-dotPulse{animation:none;opacity:1}
  .dshrp-shimmer{animation:none;background:none;height:1px;background:var(--dsw-alias-border-l2)}
  .dshrp-collapse{transition:none}
}
/* —— v7 设计稿外观：用户气泡、轮次锚点条、外观面板、可调变量 —— */
.dshrp-root{background-image:var(--rp-bg-image,none);background-size:cover;background-position:center}
.dshrp-mine{position:relative;max-width:86%;margin:0 0 12px auto;padding:9px 13px;background:color-mix(in srgb,var(--rp-mine-base) calc(var(--rp-depth,68) * 1%),var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.75;white-space:pre-wrap;word-break:break-word;border:1px solid color-mix(in srgb,var(--rp-mine-base) 42%,transparent);border-radius:var(--rp-radius,16px)}
.dshrp-root[data-tail="right"] .dshrp-mine{border-bottom-right-radius:5px}
.dshrp-root[data-tail="left"] .dshrp-mine{border-bottom-left-radius:5px}
.dshrp-card{background:color-mix(in srgb,var(--rp-ai-base) calc(var(--rp-ai-depth,100) * 1%),var(--dsw-alias-bg-base));border-radius:var(--rp-radius,16px)}
.dshrp-railWrap{position:relative;margin:0 -2px}
.dshrp-rail{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 1px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 10px),transparent);mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 10px),transparent)}
.dshrp-rail::-webkit-scrollbar{display:none}
.dshrp-railChip{flex:none;display:inline-flex;align-items:center;gap:6px;max-width:200px;height:24px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:border-color .16s ease,color .16s ease,background .16s ease}
.dshrp-railChip b{font-weight:650;color:var(--dsw-alias-label-primary)}
.dshrp-railChip span{overflow:hidden;text-overflow:ellipsis}
.dshrp-railChip:hover{border-color:var(--dsw-alias-border-l4);color:var(--dsw-alias-label-primary)}
.dshrp-railChip[data-on="true"]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2)}
.dshrp-pop{position:absolute;z-index:20;top:calc(100% - 2px);right:14px;width:254px;padding:12px;display:flex;flex-direction:column;gap:10px;border-radius:14px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:0 20px 44px -22px rgba(15,25,35,.5);font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dshrp-popTitle{font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary)}
.dshrp-popRow{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dshrp-seg{display:flex;gap:4px}
.dshrp-seg button{font:inherit;font-size:11px;line-height:1;height:24px;padding:0 10px;border-radius:999px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}
.dshrp-seg button[data-on="true"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l4)}
.dshrp-popRange{display:grid;grid-template-columns:1fr auto;gap:5px 8px;align-items:center}
.dshrp-popRange em{grid-column:2;grid-row:1;font-style:normal;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
.dshrp-popRange input[type="range"]{grid-column:1 / -1;width:100%;margin:0;accent-color:color-mix(in srgb,var(--rp-mine-base) 85%,var(--dsw-alias-label-secondary))}
.dshrp-popText{display:flex;flex-direction:column;gap:5px}
.dshrp-popText input[type="text"]{height:24px;padding:0 8px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px}
.dshrp-popCheck{display:flex;align-items:center;gap:7px;cursor:pointer}
.dshrp-popCheck input{accent-color:color-mix(in srgb,var(--rp-mine-base) 85%,var(--dsw-alias-label-secondary))}
.dshrp-hist{display:flex;align-items:center;gap:8px;padding:0 0 8px}
.dshrp-histButton{display:inline-flex;align-items:center;gap:5px;flex:none;height:24px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;cursor:pointer;transition:border-color .16s ease,color .16s ease}
.dshrp-histButton:hover:not(:disabled){border-color:var(--dsw-alias-border-l4);color:var(--dsw-alias-label-primary)}
.dshrp-histButton:disabled{cursor:default;opacity:.55}
.dshrp-histSearch{flex:1;min-width:0;height:24px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px}
.dshrp-histSearch::placeholder{color:var(--dsw-alias-label-tertiary)}
.dshrp-histState{flex:none;font-size:10.5px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.dshrp-turn[data-flash="true"] .dshrp-mine,.dshrp-turn[data-flash="true"] .dshrp-turnHead{animation:dshrp-flash 1.4s ease}
@keyframes dshrp-flash{0%,100%{outline-color:transparent}20%,70%{outline:2px solid color-mix(in srgb,var(--rp-mine-base) 70%,transparent);outline-offset:3px}}
.dshrp-map{position:absolute;z-index:12;right:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.dshrp-mapToggle{display:inline-flex;align-items:center;justify-content:center;width:15px;padding:6px 0;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:1;letter-spacing:1px;cursor:pointer}
.dshrp-mapToggle:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4)}
.dshrp-mapList{display:flex;flex-direction:column;align-items:center;gap:4px;max-height:46vh;overflow-y:auto;padding:6px 2px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);scrollbar-width:none}
.dshrp-mapList::-webkit-scrollbar{display:none}
.dshrp-mapTick{width:7px;height:7px;padding:0;border-radius:999px;border:none;background:color-mix(in srgb,var(--rp-mine-base) 55%,transparent);cursor:pointer;transition:height .16s ease,background .16s ease}
.dshrp-mapTick:hover{background:var(--rp-mine-base)}
.dshrp-mapTick[data-on="true"]{height:12px;background:color-mix(in srgb,var(--rp-mine-base) 92%,var(--dsw-alias-label-primary))}
`
    // #endregion

    /** Replace `{key}` placeholders in one locale string. */
    function format(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        values != null && name in values ? String(values[name]) : match,
      )
    }

    /** The settled, reference-stable empty state. */
    const EMPTY = Object.freeze({ turns: [], steps: [], chars: 0, running: false, firstTurn: 0 })

    /** A minimal external store: stable snapshot, synchronous notification. */
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot() {
          return value
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set(next) {
          if (next === value) return
          value = next
          for (const listener of Array.from(listeners)) {
            try {
              listener()
            } catch (error) {
              console.error('[think-dock] listener failed', error)
            }
          }
        },
      }
    }

    // #region preferences
    /** Preference keys survive restarts; only an explicit switch rewrites them. */
    const STORAGE_PREFIX = 'dsh-think-dock:'

    /** Read one stored preference, falling back when storage is unavailable. */
    function readPreference(key, fallback) {
      try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
        if (raw === null) return fallback
        return JSON.parse(raw)
      } catch (error) {
        return fallback
      }
    }

    /** Persist one preference so the next launch keeps the same choice. */
    function writePreference(key, value) {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
      } catch (error) {
        console.warn('[think-dock] preference not stored', key, error)
      }
    }

    /** A stored React value: read once, write on every change. */
    function usePreference(key, fallback) {
      const [value, setValue] = useState(() => {
        const stored = readPreference(key, fallback)
        return stored === 'off' || stored === 'new' || stored === 'all' || typeof stored === 'boolean' ? stored : fallback
      })
      const set = useCallback(
        (next) => {
          setValue(next)
          writePreference(key, next)
        },
        [key],
      )
      return [value, set]
    }

    /** A stored value of any JSON shape (numbers, objects), used by the appearance panel. */
    function useStored(key, fallback) {
      const [value, setValue] = useState(() => {
        const stored = readPreference(key, null)
        return stored !== null && typeof stored === 'object' ? { ...fallback, ...stored } : fallback
      })
      const set = useCallback(
        (patch) => {
          setValue((previous) => {
            const next = { ...previous, ...patch }
            writePreference(key, next)
            return next
          })
        },
        [key],
      )
      return [value, set]
    }

    /** Appearance defaults: paper theme, classic bubble, no background image. */
    const APPEARANCE_DEFAULTS = {
      theme: 'paper',
      auto: false,
      depth: 68,
      aiDepth: 100,
      radius: 16,
      tail: 'right',
      bgImage: '',
    }

    /** Resolve the effective theme, honouring "follow system" when it is on. */
    function resolveTheme(appearance) {
      if (appearance.auto) return prefersDark() ? 'ink' : 'paper'
      return appearance.theme === 'ink' ? 'ink' : 'paper'
    }

    /** Read the OS colour-scheme preference. */
    function prefersDark() {
      try {
        return matchMedia('(prefers-color-scheme: dark)').matches
      } catch (error) {
        return false
      }
    }
    // #endregion

    // #region translation bridge
    /**
     * Bridge to the reader's "思考翻译" plugin. It owns no UI and no settings:
     * the provider and target language are exactly the ones configured for the
     * conversation's own Think row, and every fragment is translated once.
     */
    const translation = {
      remote: null,
      status: 'idle',
      limits: null,
      cache: new Map(),
      inflight: new Map(),
      version: 0,
      listeners: new Set(),
      notify() {
        translation.version += 1
        for (const listener of Array.from(translation.listeners)) {
          try {
            listener()
          } catch (error) {
            console.error('[think-dock] translation listener failed', error)
          }
        }
      },
      getSnapshot() {
        return translation.version
      },
      subscribe(listener) {
        translation.listeners.add(listener)
        return () => {
          translation.listeners.delete(listener)
        }
      },
    }

    /** Wire the optional remote endpoint once the translation plugin mounts. */
    function attachTranslation(remote) {
      translation.remote = remote
      translation.status = 'idle'
      translation.limits = null
      translation.notify()
    }

    const DIRECT_URL = 'https://edge.microsoft.com/translate/translatetext'
    const PROXY_URL = '/think-dock/translate'
    const DIRECT_LIMITS = { maxTextChars: 1200, provider: 'edge', targetLanguage: 'zh-Hans' }

    /**
     * Translate without the optional plugin. The Host half answers a same-origin
     * proxy route (a page cannot call the Edge endpoint cross-origin); the direct
     * call stays as a last resort for a Host that predates that route.
     */
    async function translateDirect(fragment, signal) {
      try {
        const proxied = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: fragment }),
          signal,
        })
        if (proxied.ok) {
          const payload = await proxied.json()
          if (payload !== null && typeof payload === 'object' && payload.ok === true && typeof payload.text === 'string') {
            return payload.text
          }
        }
      } catch (error) {
        if (signal.aborted) throw error
      }
      const response = await fetch(`${DIRECT_URL}?from=&to=${encodeURIComponent(DIRECT_LIMITS.targetLanguage)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([{ Text: fragment }]),
        signal,
      })
      if (!response.ok) throw new Error(`translate HTTP ${response.status}`)
      const payload = await response.json()
      const first = Array.isArray(payload) ? payload[0] : undefined
      const translated = first !== null && typeof first === 'object' ? first.translations : undefined
      const text = Array.isArray(translated) && translated[0] !== undefined ? translated[0].to : undefined
      if (typeof text !== 'string' || text.length === 0) throw new Error('translate: empty response')
      return text
    }

    /**
     * The whole session log, read by the Host half. The Chat view only holds the
     * window the conversation has loaded, so older turns come from here instead.
     */
    const HISTORY_URL = '/think-dock/history'

    /** Load every turn of one Session from the Host. */
    async function fetchHistory(sessionId, signal) {
      const response = await fetch(HISTORY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        signal,
      })
      if (!response.ok) throw new Error(`history HTTP ${response.status}`)
      const payload = await response.json()
      if (payload === null || typeof payload !== 'object' || payload.ok !== true || !Array.isArray(payload.turns)) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'history unavailable')
      }
      return payload.turns
    }

    /** Resolve the reader's translation route exactly once. */    function ensureLimits() {
      if (translation.limits !== null) return Promise.resolve(translation.limits)
      if (translation.remote === null) {
        translation.limits = { ...DIRECT_LIMITS }
        translation.status = 'ready'
        return Promise.resolve(translation.limits)
      }
      if (translation.loading !== undefined) return translation.loading
      translation.loading = (async () => {
        try {
          const envelope = await translation.remote.limits(new AbortController().signal)
          if (envelope === null || typeof envelope !== 'object' || envelope.ok !== true) throw new Error('limits unavailable')
          const value = envelope.value
          translation.limits = {
            maxTextChars: typeof value.maxTextChars === 'number' && value.maxTextChars > 0 ? value.maxTextChars : 4000,
            provider: value.preferences.provider,
            targetLanguage: value.preferences.targetLanguage,
          }
          translation.status = 'ready'
          return translation.limits
        } catch (error) {
          console.warn('[think-dock] translation limits unavailable', error)
          translation.status = 'unavailable'
          return null
        } finally {
          translation.loading = undefined
          translation.notify()
        }
      })()
      return translation.loading
    }

    /** Translate one complete fragment, reusing the durable per-Session result. */
    function translateFragment(fragment, sessionId) {
      const cached = translation.cache.get(fragment)
      if (cached !== undefined) return Promise.resolve(cached)
      const running = translation.inflight.get(fragment)
      if (running !== undefined) return running
      const task = (async () => {
        const limits = await ensureLimits()
        if (limits === null) throw new Error('translation unavailable')
        const signal = new AbortController().signal
        if (translation.remote === null) {
          const text = await translateDirect(fragment, signal)
          translation.cache.set(fragment, text)
          return text
        }
        const targetLanguage =
          limits.targetLanguage === 'auto' || limits.targetLanguage === undefined
            ? typeof navigator !== 'undefined' && navigator.language
              ? navigator.language
              : 'zh-CN'
            : limits.targetLanguage
        const envelope = await translation.remote.translate(
          {
            text: fragment,
            targetLanguage,
            provider: limits.provider,
            sessionId,
          },
          signal,
        )
        if (envelope === null || typeof envelope !== 'object' || envelope.ok !== true) throw new Error('translation failed')
        translation.cache.set(fragment, envelope.value)
        return envelope.value
      })().finally(() => {
        translation.inflight.delete(fragment)
      })
      translation.inflight.set(fragment, task)
      return task
    }

    /**
     * Split reasoning into completed paragraphs and request-sized fragments.
     * @param text - original reasoning, including its exact whitespace.
     * @param running - whether the final paragraph may still grow.
     * @param maxTextChars - the translator's configured UTF-16 request limit.
     */
    function reasoningFragments(text, running, maxTextChars) {
      const result = []
      const separator = /\r?\n(?:[\t ]*\r?\n)+/g
      let start = 0
      while (true) {
        const match = separator.exec(text)
        let remaining = text.slice(start, match === null ? text.length : match.index)
        while (remaining.length > maxTextChars) {
          let cut = maxTextChars
          if (/[\uD800-\uDBFF]/.test(remaining.charAt(cut - 1))) cut -= 1
          const whitespace = remaining.slice(0, cut).search(/\s+\S*$/)
          if (whitespace > 0) cut = whitespace
          const source = remaining.slice(0, cut)
          remaining = remaining.slice(cut)
          const suffix = remaining.match(/^\s+/)?.[0] ?? ''
          remaining = remaining.slice(suffix.length)
          result.push({ text: source, suffix, complete: true })
        }
        result.push({ text: remaining, suffix: match?.[0] ?? '', complete: match !== null || !running })
        if (match === null) return result
        start = match.index + match[0].length
      }
    }

    /**
     * One translation run for one reasoning text; publishes display state.
     * `offset` is the number of leading UTF-16 units kept as original text: the
     * "translate new thoughts only" mode records how much existed when the
     * panel opened and leaves that history untouched.
     */
    const TranslationRun = class {
      constructor(text, running, sessionId, offset, publish) {
        this.text = text
        this.running = running
        this.sessionId = sessionId
        this.offset = offset
        this.publish = publish
        this.disposed = false
        this.failed = false
        this.controller = new AbortController()
      }
      source() {
        return this.offset > 0 ? this.text.slice(this.offset) : this.text
      }
      update(text, running, offset) {
        this.text = text
        this.running = running
        this.offset = offset
        this.emit()
        void this.run()
      }
      retry() {
        this.failed = false
        this.emit()
        void this.run()
      }
      dispose() {
        this.disposed = true
        this.controller.abort()
      }
      emit() {
        if (this.disposed) return
        const limits = translation.limits
        const maxTextChars = limits === null ? 4000 : limits.maxTextChars
        const source = this.source()
        const fragments = reasoningFragments(source, this.running, maxTextChars)
        const tail = fragments
          .map((fragment) => (fragment.complete ? translation.cache.get(fragment.text) ?? fragment.text : fragment.text) + fragment.suffix)
          .join('')
        const pending = fragments.some(
          (fragment) => fragment.complete && fragment.text.trim() !== '' && !translation.cache.has(fragment.text),
        )
        this.publish({
          text: (this.offset > 0 ? this.text.slice(0, this.offset) : '') + tail,
          tail,
          partial: this.offset > 0,
          pending,
          failed: this.failed,
        })
      }
      async run() {
        if (this.disposed || this.failed) return
        if (translation.limits === null) await ensureLimits()
        if (this.disposed || translation.limits === null) return
        const fragments = reasoningFragments(this.source(), this.running, translation.limits.maxTextChars)
        for (const fragment of fragments) {
          if (this.disposed || this.failed) return
          if (!fragment.complete || fragment.text.trim() === '') continue
          if (translation.cache.has(fragment.text)) continue
          try {
            await translateFragment(fragment.text, this.sessionId)
          } catch (error) {
            if (this.disposed) return
            console.warn('[think-dock] translation failed', error)
            this.failed = true
            this.emit()
            return
          }
          this.emit()
        }
      }
    }
    // #endregion

    /**
     * Project the Chat view into reasoning groups.
     * @param view - the `chat` view snapshot, or undefined before activation.
     * @returns turn groups, flat steps, character count and streaming state.
     */
    function derive(view) {
      const nodes = view && view.nodes
      if (nodes === undefined || nodes === null) return EMPTY
      const refs = typeof nodes.values === 'function' ? nodes.values() : []
      const steps = []
      const userByTurn = new Map()
      for (const ref of refs) {
        const key = ref === null || ref === undefined ? undefined : ref.key
        if (typeof key !== 'string') continue
        let node
        try {
          node = nodes.get(key)
        } catch (error) {
          continue
        }
        if (node === undefined || node === null) continue
        if ((node.kind === 'user' || node.kind === 'steering') && node.data !== undefined) {
          const content = node.data.content
          let text = ''
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block !== null && block !== undefined && block.type === 'text' && typeof block.text === 'string') text += block.text
            }
          } else if (typeof content === 'string') text = content
          if (text.trim() === '') continue
          const userLocation = node.location
          const userTurn =
            userLocation !== undefined && userLocation !== null &&
            (userLocation.kind === 'step' || userLocation.kind === 'turn')
              ? userLocation.turn.turn
              : 0
          if (!userByTurn.has(userTurn)) userByTurn.set(userTurn, text)
          continue
        }
        if (node.kind !== 'assistant-step' || node.data === undefined) continue
        const blocks = node.data.blocks
        if (!Array.isArray(blocks)) continue
        let text = ''
        for (const block of blocks) {
          if (block === null || block === undefined || block.kind !== 'reasoning') continue
          if (typeof block.text !== 'string' || block.text.trim() === '') continue
          text = text === '' ? block.text : text + '\n\n' + block.text
        }
        if (text === '') continue
        const location = node.location
        const isStep = location !== undefined && location !== null && location.kind === 'step'
        const turnNumber =
          isStep || (location !== undefined && location !== null && location.kind === 'turn')
            ? location.turn.turn
            : node.data.turn
        const stepNumber = isStep ? location.step.step : node.data.step
        steps.push({
          key,
          turn: typeof turnNumber === 'number' ? turnNumber : 0,
          step: typeof stepNumber === 'number' ? stepNumber : 0,
          status:
            node.data.status === 'running'
              ? 'running'
              : node.data.status === 'interrupted'
                ? 'interrupted'
                : 'settled',
          text,
        })
      }
      if (steps.length === 0 && userByTurn.size === 0) return EMPTY
      steps.sort((left, right) => left.turn - right.turn || left.step - right.step)
      const turns = []
      let current
      let chars = 0
      for (const step of steps) {
        chars += step.text.length
        if (current === undefined || current.turn !== step.turn) {
          current = { turn: step.turn, steps: [], userText: userByTurn.get(step.turn) || '' }
          turns.push(current)
        }
        current.steps.push(step)
      }
      for (const [turnNumber, text] of userByTurn) {
        if (turns.some((turn) => turn.turn === turnNumber)) continue
        turns.push({ turn: turnNumber, steps: [], userText: text })
      }
      turns.sort((left, right) => left.turn - right.turn)
      const last = steps.length > 0 ? steps[steps.length - 1] : undefined
      return {
        turns,
        steps,
        chars,
        firstTurn: steps.length > 0 ? steps[0].turn : turns.length > 0 ? turns[0].turn : undefined,
        running: last !== undefined && last.status === 'running',
      }
    }

    /**
     * One reasoning model per tab occurrence: subscribes to the Session's Chat
     * snapshot, activates the chat target when the panel first mounts, and
     * publishes the derived groups through its own store.
     * @param ctx - the client plugin context.
     * @param sessionId - the tab's Session.
     */
    function createModel(ctx, sessionId) {
      const store = createStore(EMPTY)
      let conversation
      let detach
      let attached = false
      let lastSnapshot
      let disposed = false

      const read = () => {
        let snapshot
        try {
          snapshot = conversation.snapshot.getSnapshot()
        } catch (error) {
          return
        }
        if (snapshot === lastSnapshot) return
        lastSnapshot = snapshot
        store.set(derive(snapshot.views.get('chat')))
      }

      const attach = () => {
        if (attached || disposed) return
        attached = true
        const binding = ctx.sessions.binding(sessionId)
        if (binding === undefined) {
          console.error('[think-dock] no Session binding for', sessionId)
          return
        }
        conversation = ctx.uiConversation.binding(binding)
        read()
        detach = conversation.snapshot.subscribe(read)
        try {
          conversation.activate('chat')
        } catch (error) {
          console.error('[think-dock] activate chat failed', error)
        }
        read()
      }

      return {
        getSnapshot() {
          return store.getSnapshot()
        },
        subscribe(listener) {
          disposed = false
          attached = false
          attach()
          const unsubscribe = store.subscribe(listener)
          return () => {
            unsubscribe()
            if (disposed) return
            disposed = true
            if (detach !== undefined) {
              try {
                detach()
              } catch (error) {
                console.error('[think-dock] detach failed', error)
              }
              detach = undefined
            }
          }
        },
        dispose() {
          if (disposed) return
          disposed = true
          if (detach !== undefined) {
            try {
              detach()
            } catch (error) {
              console.error('[think-dock] detach failed', error)
            }
            detach = undefined
          }
        },
      }
    }

    /** Keep a rendering failure visible instead of leaving the pane blank. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error, info) {
        console.error('[think-dock] render failed', error, info)
      }
      render() {
        if (this.state.error !== null) {
          const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error)
          return h('div', { className: 'dshrp-root' }, h('div', { className: 'dshrp-error' }, format(this.props.t('failed'), { message })))
        }
        return this.props.children
      }
    }

    /** Copy text through the clipboard API with an execCommand fallback. */
    function copyText(text) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).then(
          () => true,
          () => fallbackCopy(text),
        )
      }
      return Promise.resolve(fallbackCopy(text))
    }
    function fallbackCopy(text) {
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch (error) {
        return false
      }
    }

    /** Friendlier names for the provider ids the translation plugin reports. */
    const PROVIDER_LABELS = {
      google: 'Google',
      bing: 'Bing',
      'deepseek-account': 'DeepSeek',
      'deepseek-official': 'DeepSeek',
    }

    const ICONS = {
      chevron: h('path', { d: 'M9 6l6 6-6 6' }),
      down: h('path', { d: 'M12 5v14M5 12l7 7 7-7' }),
      copy: h('path', { d: 'M9 9h9v9H9zM6 15V6h9' }),
      follow: h('path', { d: 'M12 3v18M5 10l7-7 7 7' }),
      translate: h('path', { d: 'M4 6h9M8.5 6v2c0 4-2 6.5-4.5 7.5M6 10c.8 2.2 2.6 3.7 5 4.4M14 20l3.5-9 3.5 9M15.2 17h4.6' }),
      gear: h('path', { d: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 13.5a7.6 7.6 0 0 0 0-3l1.6-1.2-1.8-3.1-1.9.8a7.6 7.6 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.1a7.6 7.6 0 0 0-2.6 1.5l-1.9-.8-1.8 3.1 1.6 1.2a7.6 7.6 0 0 0 0 3l-1.6 1.2 1.8 3.1 1.9-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.1h3.6l.3-2.1a7.6 7.6 0 0 0 2.6-1.5l1.9.8 1.8-3.1-1.6-1.2Z' }),
    }
    function icon(name, className) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          className,
          'aria-hidden': 'true',
        },
        ICONS[name],
      )
    }

    /**
     * One reasoning card.
     *
     * Translation policy comes from the panel: `mode` is off, "new only" or
     * "everything", and `offset` is how much of this step already existed when
     * the reader opened the panel (new-only mode leaves that history alone).
     * `bilingual` keeps the original above the translation.
     */
    function StepCard(props) {
      const { step, t, open, onToggle, mode, offset, bilingual, sessionId, translateStatus } = props
      const [display, setDisplay] = useState({ text: step.text, tail: '', partial: false, pending: false, failed: false })
      const [showOriginal, setShowOriginal] = useState(false)
      const [forced, setForced] = useState(false)
      const runRef = useRef(null)

      const canTranslate = translateStatus === 'ready' && mode !== 'off'
      const fresh = step.text.length > offset
      const effectiveOffset = mode === 'all' || forced ? 0 : offset
      const wants = mode === 'all' || fresh || forced
      const active = canTranslate && open && wants && !showOriginal
      const running = step.status === 'running'

      useEffect(() => {
        if (!active) {
          if (runRef.current !== null) {
            runRef.current.dispose()
            runRef.current = null
          }
          return
        }
        if (runRef.current === null) {
          runRef.current = new TranslationRun(step.text, running, sessionId, effectiveOffset, setDisplay)
          runRef.current.update(step.text, running, effectiveOffset)
        }
        return () => {
          if (runRef.current !== null) {
            runRef.current.dispose()
            runRef.current = null
          }
        }
      }, [active, sessionId])

      useEffect(() => {
        if (runRef.current !== null) runRef.current.update(step.text, running, effectiveOffset)
      }, [step.text, running, effectiveOffset])

      const shown = active ? display.text : step.text
      const translatedBlock = active ? (display.partial ? display.tail : display.text) : ''
      const copyPayload = active && bilingual ? step.text + '\n\n' + translatedBlock : shown

      return h(
        'article',
        {
          className: 'dshrp-card',
          'data-live': running ? 'true' : 'false',
          'data-status': step.status,
          'data-open': open ? 'true' : 'false',
        },
        h(
          'button',
          { type: 'button', className: 'dshrp-cardHead', onClick: onToggle, 'aria-expanded': open ? 'true' : 'false' },
          h('span', { className: 'dshrp-dot', 'aria-hidden': 'true' }),
          h('span', { className: 'dshrp-cardTitle' }, format(t('step.label'), { n: step.step })),
          h(
            'span',
            { className: 'dshrp-chip' },
            running ? t('live') : step.status === 'interrupted' ? t('interrupted') : t('settled'),
          ),
          active ? h('span', { className: 'dshrp-chip', 'data-kind': 'translated' }, t('translated')) : null,
          h('span', { className: 'dshrp-meta' }, format(t('chars'), { n: step.text.length })),
          icon('chevron', 'dshrp-chev'),
        ),
        open ? null : h('div', { className: 'dshrp-preview' }, shown.trim()),
        h(
          'div',
          { className: 'dshrp-collapse', 'data-open': open ? 'true' : 'false' },
          h(
            'div',
            { className: 'dshrp-collapseInner' },
            h(
              'div',
              { className: 'dshrp-body' },
              canTranslate
                ? h(
                    'div',
                    { className: 'dshrp-tools' },
                    active
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'dshrp-mini',
                            'data-on': 'true',
                            onClick: () => setShowOriginal(true),
                          },
                          t('original'),
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'dshrp-mini',
                            'data-on': showOriginal && wants ? 'true' : 'false',
                            onClick: () => {
                              if (!wants) setForced(true)
                              setShowOriginal(false)
                            },
                          },
                          wants ? t('translated') : t('translate.this'),
                        ),
                    display.failed && active
                      ? h(
                          'button',
                          { type: 'button', className: 'dshrp-mini', onClick: () => runRef.current && runRef.current.retry() },
                          t('retry'),
                        )
                      : null,
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dshrp-mini',
                        style: { marginLeft: 'auto' },
                        onClick: () => {
                          void copyText(copyPayload).then((ok) => {
                            if (!ok) console.warn('[think-dock] copy failed')
                          })
                        },
                      },
                      t('copy.step'),
                    ),
                  )
                : null,
              active && bilingual
                ? h(
                    'div',
                    { className: 'dshrp-bilingual' },
                    h(
                      'div',
                      { className: 'dshrp-pane' },
                      h('div', { className: 'dshrp-paneLabel' }, t('original')),
                      h('div', { className: 'dshrp-text', 'data-view': 'original' }, step.text),
                    ),
                    h(
                      'div',
                      { className: 'dshrp-pane' },
                      h(
                        'div',
                        { className: 'dshrp-paneLabel' },
                        t('translated'),
                        display.pending
                          ? h('span', { className: 'dshrp-dotPulse', 'aria-hidden': 'true', style: { marginLeft: '5px' } })
                          : null,
                      ),
                      h('div', { className: 'dshrp-text', 'data-view': 'translated' }, translatedBlock),
                    ),
                  )
                : h('div', { className: 'dshrp-text', 'data-view': active ? 'translated' : 'original' }, shown),
              running && (!active || display.pending) ? h('div', { className: 'dshrp-shimmer', role: 'status' }) : null,
              display.failed && active
                ? h('div', { className: 'dshrp-route', 'data-state': 'failed' }, t('translate.failed'))
                : null,
            ),
          ),
        ),
      )
    }

    /** The tab body: grouped reasoning with a pinned-to-bottom reading flow. */
    function createBody(ctx, t) {
      function ReasoningBody(props) {
        const sessionId = props.sessionId
        const modelRef = useRef(null)
        if (modelRef.current === null) modelRef.current = createModel(ctx, sessionId)
        const model = modelRef.current
        useEffect(() => () => model.dispose(), [model])
        const data = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

        const translationVersion = useSyncExternalStore(translation.subscribe, translation.getSnapshot, translation.getSnapshot)
        const [mode, setMode] = usePreference('translation-mode', 'new')
        const [bilingual, setBilingual] = usePreference('bilingual', false)

        useEffect(() => {
          if (translation.status === 'idle') void ensureLimits()
        }, [translationVersion])

        const scrollRef = useRef(null)
        const pinnedRef = useRef(true)
        const [pinned, setPinned] = useState(true)
        const [copyState, setCopyState] = useState('idle')
        const [openMap, setOpenMap] = useState({})

        const translateStatus = translation.status

        // Snapshot how much of each step already existed when this panel opened:
        // "translate new thoughts only" leaves that history in the original.
        const baselineRef = useRef(null)
        if (baselineRef.current === null) baselineRef.current = new Map()
        const baseline = baselineRef.current

        const [appearance, patchAppearance] = useStored('appearance', APPEARANCE_DEFAULTS)
        const [settingsOpen, setSettingsOpen] = useState(false)
        const theme = resolveTheme(appearance)
        const themeVars = {
          '--rp-depth': String(appearance.depth),
          '--rp-ai-depth': String(appearance.aiDepth),
          '--rp-radius': appearance.radius + 'px',
          '--rp-tail': appearance.tail,
          '--rp-bg-image': appearance.bgImage ? 'url("' + appearance.bgImage.replace(/"/g, '%22') + '")' : 'none',
        }

        // Follow the system palette live while "auto" is on.
        useEffect(() => {
          if (!appearance.auto) return undefined
          let query
          try {
            query = matchMedia('(prefers-color-scheme: dark)')
          } catch (error) {
            return undefined
          }
          const onChange = () => patchAppearance({ theme: prefersDark() ? 'ink' : 'paper' })
          query.addEventListener('change', onChange)
          return () => query.removeEventListener('change', onChange)
        }, [appearance.auto, patchAppearance])

        const railRef = useRef(null)
        const jumpToTurn = useCallback(
          (turnNumber) => {
            const host = scrollRef.current
            if (host === null || host === undefined) return
            const target = host.querySelector('[data-turn-id="' + turnNumber + '"]')
            if (target !== null) target.scrollIntoView({ block: 'start', behavior: 'smooth' })
          },
          [scrollRef],
        )
        const onRailWheel = useCallback((event) => {
          const rail = railRef.current
          if (rail === null || rail === undefined) return
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
          event.preventDefault()
          rail.scrollLeft += event.deltaY
        }, [])

        // The whole log, so the panel never depends on how far the Chat window
        // has been scrolled. Live turns always win over the replayed copy.
        const [history, setHistory] = useState({ status: 'idle', turns: [], error: '' })
        useEffect(() => {
          const controller = new AbortController()
          let alive = true
          setHistory({ status: 'loading', turns: [], error: '' })
          void fetchHistory(sessionId, controller.signal).then(
            (turns) => {
              if (alive) setHistory({ status: 'ready', turns, error: '' })
            },
            (error) => {
              if (!alive) return
              console.warn('[think-dock] history unavailable', error)
              setHistory({ status: 'failed', turns: [], error: String(error?.message ?? error) })
            },
          )
          return () => {
            alive = false
            controller.abort()
          }
        }, [sessionId])

        const viewTurns = data.turns
        const viewStart = viewTurns.length > 0 ? viewTurns[0].turn : Number.POSITIVE_INFINITY
        const olderTurns = history.turns.filter(
          (turn) => turn.turn < viewStart && (turn.userText !== '' || turn.steps.length > 0),
        )
        const [olderCount, setOlderCount] = useState(6)
        const olderShown = olderTurns.slice(Math.max(0, olderTurns.length - olderCount))
        const olderHidden = olderTurns.length - olderShown.length
        const olderView = olderShown.map((turn) => ({
          turn: turn.turn,
          userText: turn.userText,
          steps: turn.steps.map((step) => ({
            key: 'history-' + turn.turn + '-' + step.step,
            turn: turn.turn,
            step: step.step,
            status: 'settled',
            text: step.text,
          })),
        }))
        const mergedTurns = [...olderView, ...viewTurns]
        const hasContent = mergedTurns.length > 0
        const allSteps = mergedTurns.flatMap((turn) => turn.steps)
        const mergedChars = allSteps.reduce((sum, step) => sum + step.text.length, 0)

        const anchorRef = useRef(null)
        const loadOlder = useCallback(() => {
          const element = scrollRef.current
          if (element !== null) anchorRef.current = { height: element.scrollHeight, top: element.scrollTop }
          setOlderCount((count) => count + 8)
        }, [])
        useEffect(() => {
          const element = scrollRef.current
          const anchor = anchorRef.current
          if (element === null || anchor === null || anchor === undefined) return
          anchorRef.current = null
          element.scrollTop = anchor.top + (element.scrollHeight - anchor.height)
        }, [olderCount])

        const [searchText, setSearchText] = useState('')
        const [flashTurn, setFlashTurn] = useState(0)
        const [mapOpen, setMapOpen] = useState(false)
        const searchTurn = useCallback(() => {
          const needle = searchText.trim()
          if (needle === '') return
          const haystack = (turn) => (turn.userText || '') + '\n' + turn.steps.map((step) => step.text).join('\n')
          const hit = mergedTurns.find((turn) => haystack(turn).includes(needle))
          if (hit === undefined) return
          if (!viewTurns.some((turn) => turn.turn === hit.turn)) {
            const index = olderTurns.findIndex((turn) => turn.turn === hit.turn)
            if (index >= 0) {
              const needed = olderTurns.length - index
              setOlderCount((count) => Math.max(count, needed))
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                  jumpToTurn(hit.turn)
                  setFlashTurn(hit.turn)
                  window.setTimeout(() => setFlashTurn(0), 1500)
                })
              })
              return
            }
          }
          jumpToTurn(hit.turn)
          setFlashTurn(hit.turn)
          window.setTimeout(() => setFlashTurn(0), 1500)
        }, [jumpToTurn, mergedTurns, olderTurns, searchText, viewTurns])

        useEffect(() => {
          for (const step of data.steps) {
            if (!baseline.has(step.key)) baseline.set(step.key, step.text.length)
          }
        }, [baseline, data])

        const resetBaseline = useCallback(() => {
          for (const step of data.steps) baseline.set(step.key, step.text.length)
        }, [baseline, data])

        const changeMode = useCallback(
          (next) => {
            if (next === 'new') resetBaseline()
            setMode(next)
          },
          [resetBaseline, setMode],
        )

        const offsetFor = useCallback(
          (step) => {
            if (mode === 'all') return 0
            if (mode === 'off') return step.text.length
            const recorded = baseline.get(step.key)
            if (recorded === undefined) {
              // A step first seen now already counts as the history it arrived with.
              baseline.set(step.key, step.text.length)
              return step.text.length
            }
            return recorded
          },
          [baseline, mode],
        )

        // Newest step opens by default; a running step is always readable.
        useEffect(() => {
          setOpenMap((previous) => {
            let changed = false
            const next = { ...previous }
            const last = data.steps[data.steps.length - 1]
            for (const step of data.steps) {
              if (step.key in next) continue
              const isLast = last !== undefined && step.key === last.key
              next[step.key] = step.status === 'running' || isLast
              changed = true
            }
            return changed ? next : previous
          })
        }, [allSteps])

        useEffect(() => {
          const element = scrollRef.current
          if (element !== null && pinnedRef.current) element.scrollTop = element.scrollHeight
        }, [allSteps])

        const handleScroll = useCallback(() => {
          const element = scrollRef.current
          if (element === null) return
          const near = element.scrollHeight - element.scrollTop - element.clientHeight <= 64
          if (near === pinnedRef.current) return
          pinnedRef.current = near
          setPinned(near)
        }, [])

        const jump = useCallback(() => {
          const element = scrollRef.current
          if (element === null) return
          pinnedRef.current = true
          setPinned(true)
          const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
          element.scrollTo({ top: element.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
        }, [])

        const toggleStep = useCallback((key) => {
          setOpenMap((previous) => ({ ...previous, [key]: !previous[key] }))
        }, [])

        const setAll = useCallback(
          (value) => {
            setOpenMap(() => {
              const next = {}
              for (const step of allSteps) next[step.key] = value
              return next
            })
          },
          [allSteps],
        )

        const copyAll = useCallback(() => {
          const text = allSteps.map((step) => step.text).join('\n\n')
          if (text === '') return
          const settle = (ok) => {
            setCopyState(ok ? 'done' : 'failed')
            setTimeout(() => setCopyState('idle'), 1600)
          }
          void copyText(text).then((ok) => settle(ok))
        }, [allSteps])

        const copyLabel = copyState === 'done' ? t('copied') : copyState === 'failed' ? t('copy.failed') : t('copy.original')
        const routeLabel =
          translateStatus === 'unavailable'
            ? t('translate.unavailable')
            : translateStatus === 'ready' && translation.limits !== null
              ? format(t('translate.route'), {
                  provider: PROVIDER_LABELS[translation.limits.provider] ?? translation.limits.provider,
                  lang: translation.limits.targetLanguage,
                })
              : null

        const header = h(
          'header',
          { className: 'dshrp-bar' },
          h(
            'div',
            { className: 'dshrp-barRow' },
            h(
              'div',
              { className: 'dshrp-title' },
              t('tab.title'),
              hasContent
                ? h('small', null, format(t('panel.subtitle'), { steps: allSteps.length, chars: mergedChars }))
                : null,
            ),
            h(
              'div',
              { className: 'dshrp-actions' },
              h(
                'label',
                {
                  className: 'dshrp-select',
                  title: translateStatus === 'unavailable' ? t('translate.unavailable') : undefined,
                },
                icon('translate', null),
                h(
                  'select',
                  {
                    value: mode,
                    disabled: translateStatus !== 'ready',
                    onChange: (event) => changeMode(event.target.value),
                    'aria-label': t('mode.label'),
                  },
                  h('option', { value: 'off' }, t('mode.off')),
                  h('option', { value: 'new' }, t('mode.new')),
                  h('option', { value: 'all' }, t('mode.all')),
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshrp-tool',
                  'data-on': bilingual ? 'true' : 'false',
                  disabled: translateStatus !== 'ready' || mode === 'off',
                  onClick: () => setBilingual(!bilingual),
                },
                t('bilingual'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshrp-tool',
                  disabled: !hasContent,
                  onClick: () =>
                    setAll(!allSteps.every((step) => openMap[step.key] === true)),
                },
                data.steps.every((step) => openMap[step.key] === true) ? t('collapse.all') : t('expand.all'),
              ),
              h(
                'button',
                { type: 'button', className: 'dshrp-tool', disabled: !hasContent, onClick: copyAll },
                icon('copy', null),
                copyLabel,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshrp-tool',
                  'data-on': settingsOpen ? 'true' : 'false',
                  'aria-expanded': settingsOpen ? 'true' : 'false',
                  title: t('appearance.title'),
                  onClick: () => setSettingsOpen((open) => !open),
                },
                icon('gear', null),
              ),
            ),
          ),
          routeLabel !== null
            ? h('div', { className: 'dshrp-route', 'data-state': translateStatus === 'ready' ? 'ready' : 'failed' },
                data.running && mode !== 'off' && translateStatus === 'ready'
                  ? h('span', { className: 'dshrp-dotPulse', 'aria-hidden': 'true' })
                  : null,
                routeLabel,
              )
            : null,
          data.turns.length > 0 ? h('div', { className: 'dshrp-hist' },
            h(
              'button',
              {
                type: 'button',
                className: 'dshrp-histButton',
                disabled: history.status !== 'ready' || olderHidden <= 0,
                onClick: loadOlder,
              },
              olderHidden > 0 ? '↑ ' + t('history.older') : t('history.oldest'),
            ),
            h('input', {
              type: 'search',
              className: 'dshrp-histSearch',
              value: searchText,
              placeholder: t('history.search'),
              onChange: (event) => setSearchText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') searchTurn()
              },
            }),
            h(
              'span',
              { className: 'dshrp-histState' },
              history.status === 'loading'
                ? t('history.loading')
                : history.status === 'failed'
                  ? t('history.failed')
                  : format(t('history.state'), { shown: mergedTurns.length, total: mergedTurns.length + olderHidden }),
            ),
          ) : null,
          mergedTurns.length > 0
            ? h(
                'div',
                { className: 'dshrp-railWrap' },
                h(
                  'div',
                  { className: 'dshrp-rail', ref: railRef, onWheel: onRailWheel, role: 'tablist', 'aria-label': t('tab.title') },
                  mergedTurns.map((turn) =>
                    h(
                      'button',
                      {
                        type: 'button',
                        key: 'chip-' + turn.turn,
                        className: 'dshrp-railChip',
                        title: (turn.userText || '').slice(0, 90),
                        onClick: () => jumpToTurn(turn.turn),
                      },
                      h('b', null, String(turn.turn)),
                      h('span', null, (turn.userText || '').replace(/\s+/g, ' ').slice(0, 14) || format(t('turn.label'), { n: turn.turn })),
                    ),
                  ),
                ),
              )
            : null,
          settingsOpen
            ? h(
                'div',
                { className: 'dshrp-pop', role: 'dialog', 'aria-label': t('appearance.title') },
                h('div', { className: 'dshrp-popTitle' }, t('appearance.title')),
                h(
                  'div',
                  { className: 'dshrp-popRow' },
                  h('span', null, t('appearance.theme')),
                  h(
                    'div',
                    { className: 'dshrp-seg' },
                    h('button', { type: 'button', 'data-on': theme === 'paper' ? 'true' : 'false', onClick: () => patchAppearance({ theme: 'paper', auto: false }) }, t('appearance.paper')),
                    h('button', { type: 'button', 'data-on': theme === 'ink' ? 'true' : 'false', onClick: () => patchAppearance({ theme: 'ink', auto: false }) }, t('appearance.ink')),
                  ),
                ),
                h(
                  'label',
                  { className: 'dshrp-popRange' },
                  h('span', null, t('appearance.depth')),
                  h('em', null, String(appearance.depth)),
                  h('input', { type: 'range', min: 0, max: 100, value: appearance.depth, onChange: (event) => patchAppearance({ depth: Number(event.target.value) }) }),
                ),
                h(
                  'label',
                  { className: 'dshrp-popRange' },
                  h('span', null, t('appearance.aiDepth')),
                  h('em', null, String(appearance.aiDepth)),
                  h('input', { type: 'range', min: 0, max: 100, value: appearance.aiDepth, onChange: (event) => patchAppearance({ aiDepth: Number(event.target.value) }) }),
                ),
                h(
                  'label',
                  { className: 'dshrp-popRange' },
                  h('span', null, t('appearance.radius')),
                  h('em', null, appearance.radius + 'px'),
                  h('input', { type: 'range', min: 0, max: 26, value: appearance.radius, onChange: (event) => patchAppearance({ radius: Number(event.target.value) }) }),
                ),
                h(
                  'div',
                  { className: 'dshrp-popRow' },
                  h('span', null, t('appearance.tail')),
                  h(
                    'div',
                    { className: 'dshrp-seg' },
                    h('button', { type: 'button', 'data-on': appearance.tail === 'right' ? 'true' : 'false', onClick: () => patchAppearance({ tail: 'right' }) }, t('appearance.tailRight')),
                    h('button', { type: 'button', 'data-on': appearance.tail === 'left' ? 'true' : 'false', onClick: () => patchAppearance({ tail: 'left' }) }, t('appearance.tailLeft')),
                    h('button', { type: 'button', 'data-on': appearance.tail === 'none' ? 'true' : 'false', onClick: () => patchAppearance({ tail: 'none' }) }, t('appearance.tailNone')),
                  ),
                ),
                h(
                  'label',
                  { className: 'dshrp-popText' },
                  h('span', null, t('appearance.bg')),
                  h('input', {
                    type: 'text',
                    placeholder: 'https://…',
                    value: appearance.bgImage,
                    onChange: (event) => patchAppearance({ bgImage: event.target.value.trim() }),
                  }),
                ),
                h(
                  'label',
                  { className: 'dshrp-popCheck' },
                  h('input', { type: 'checkbox', checked: appearance.auto, onChange: (event) => patchAppearance({ auto: event.target.checked }) }),
                  h('span', null, t('appearance.auto')),
                ),
              )
            : null,
        )

        const stream = h(
          'div',
          { className: 'dshrp-inner' },
          mergedTurns.map((turn) =>
            h(
              'section',
              {
                className: 'dshrp-turn',
                key: 'turn-' + turn.turn,
                'data-turn-id': turn.turn,
                'data-flash': flashTurn === turn.turn ? 'true' : 'false',
              },
              turn.userText !== undefined && turn.userText !== ''
                ? h('div', { className: 'dshrp-mine' }, turn.userText)
                : null,
              h(
                'div',
                { className: 'dshrp-turnHead' },
                h('span', { className: 'dshrp-turnBadge' }, format(t('turn.label'), { n: turn.turn })),
                h('span', { className: 'dshrp-rule' }),
              ),
              h(
                'div',
                { className: 'dshrp-steps' },
                turn.steps.map((step) =>
                  h(StepCard, {
                    key: step.key,
                    step,
                    t,
                    open: openMap[step.key] === true,
                    onToggle: () => toggleStep(step.key),
                    mode,
                    offset: offsetFor(step),
                    bilingual,
                    sessionId,
                    translateStatus,
                  }),
                ),
              ),
            ),
          ),
        )

        const empty = h(
          'div',
          { className: 'dshrp-empty' },
          h(
            'div',
            { className: 'dshrp-emptyIcon' },
            h(
              'svg',
              { viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
              h('path', { d: 'M12 3a7 7 0 0 0-4 12.7V18h8v-2.3A7 7 0 0 0 12 3Z' }),
              h('path', { d: 'M9.5 21h5' }),
            ),
          ),
          h('p', { className: 'dshrp-emptyTitle' }, t('empty.title')),
          h('p', { className: 'dshrp-emptyHint' }, t('empty.hint')),
        )

        return h(
          'div',
          { className: 'dshrp-root', 'data-dshrp': 'ready', 'data-theme': theme, 'data-tail': appearance.tail, style: themeVars },
          h('style', null, CSS),
          header,
          h(
            'div',
            { className: 'dshrp-scroll', ref: scrollRef, onScroll: handleScroll, role: 'log', 'aria-live': 'polite' },
            hasContent ? stream : empty,
          ),
          mergedTurns.length > 0
            ? h(
                'div',
                { className: 'dshrp-map' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dshrp-mapToggle',
                    title: t('map.title'),
                    'aria-expanded': mapOpen ? 'true' : 'false',
                    onClick: () => setMapOpen((open) => !open),
                  },
                  '⋯',
                ),
                mapOpen
                  ? h(
                      'div',
                      { className: 'dshrp-mapList', role: 'navigation', 'aria-label': t('map.title') },
                      mergedTurns.map((turn) =>
                        h('button', {
                          key: 'tick-' + turn.turn,
                          type: 'button',
                          className: 'dshrp-mapTick',
                          title: format(t('turn.label'), { n: turn.turn }),
                          onClick: () => jumpToTurn(turn.turn),
                        }),
                      ),
                    )
                  : null,
              )
            : null,
          hasContent && !pinned
            ? h(
                'button',
                { type: 'button', className: 'dshrp-jump', onClick: jump },
                icon('down', null),
                t('jump'),
              )
            : null,
        )
      }

      return function Body(props) {
        return h(Boundary, { t, key: 'boundary' }, h(ReasoningBody, props))
      }
    }

    /** @param {import('@deepseek-ai/cordis').Context} ctx - client plugin context. */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'think-dock: dictionaries')

      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => t('tab.title'),
            guide: [
              {
                id: TAB_ID,
                order: 40,
                title: () => t('guide.title'),
                description: () => t('guide.description'),
              },
            ],
          }),
        'think-dock: tab type',
      )

      // Optional: the reader's own translation plugin supplies the provider and
      // target language. Without it the panel stays a plain reader.
      ctx.inject(['remote.cotTranslation'], (child) => {
        attachTranslation(child.remote.cotTranslation)
      })

      const Body = createBody(ctx, t)
      ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: NS,
          },
          Body,
        ),
      )
    }

    exports.apply = apply
    exports.inject = ['slots', 'sessions', 'uiConversation', 'locale', 'sidebarRightTabs']
    return module.exports
  },
})




