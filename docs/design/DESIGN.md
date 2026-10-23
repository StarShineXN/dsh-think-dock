# 设计定稿（交付前的视觉规格）

> 这是面板的**视觉研究稿**规格：preview.html 可离线打开。
> 注意：发布版 lib/client.js 直接使用 DSH 主题变量，并未内置「纸白/夜墨」两套主题——下面的配色与滑杆是 P2 待移植项（见仓库根目录 已知问题.md）。
# 右栏「思考」面板 · 视觉定稿（v7）

> 这是**设计定稿**，不是插件代码。落代码时按本文件的规格实现。
> 预览：`mockups\reasoning-panel-v7.html`（可直接双击；`?theme=ink` 看夜墨）

## 1. 主题

只保留两套，全部走 CSS 变量：

| 主题 | 页面 | 面板 | 用户气泡 | 思考气泡（AI 步骤卡） |
|---|---|---|---|---|
| **纸白**（默认） | #f3f5f7 → #e2e7ec | #fff 92% | `--mine-base #a6c7e8` × 深浅 | `--surface #e7f0fa` × 深浅 |
| **夜墨** | #15181b → #0e1113 | rgba(30,34,37,.94) | `--mine-base #3f474d` | `--surface #2c3236` |

- 深色系气泡比面板**略浅**，浅色系气泡比面板**略深**，两边都不用高饱和；
- 「跟随系统深浅色」开关**默认关闭**；开启时 `prefers-color-scheme: dark` → 夜墨，否则纸白。

## 2. 可调项（外观面板，共 2 项颜色 + 形状）

| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 气泡深浅（你的话） | 0–100 | **68** | `--mine = color-mix(in srgb, var(--mine-base) depth%, transparent)` |
| 思考气泡深浅（AI） | 0–100 | **100** | `--step-bg = color-mix(in srgb, var(--surface) depth%, transparent)` |
| 气泡圆角 / 尖角 / 形状 | 4–22 / 0–14 / 三档 | 15 / 5 / 圆润 | 已有，保留 |

已删除（试过但没有实际视觉收益）：气泡文字亮度、文字对比、玻璃强度/磨砂。
**不要**再加 `backdrop-filter` —— 纯色底上无效。

## 3. 结构

```
标题行：思考 · 49 步 · 67,072 字   [翻译档位][双语][展开全部][复制原文][外观]
历史行：[↑ 载入更早] [搜历史轮次…] 仅显示已加载的 12–15 轮
定位条：横向滚动 chips（每轮一枚，滚轮可滚、两端渐隐、到边收箭头）
正文：按轮分段的 turn → 用户气泡右对齐 → 思考步骤卡左对齐（细竖线 + #01/#02）
右侧：迷你地图把手（默认收起 ⋯⋯，点开显示每轮刻度）
右下：↓ 回到最新（离开底部 180px 才出现）
```

## 4. 历史加载（独立于对话区）

- 默认只渲染当前已加载窗口（省流量，和 chat 一致）；
- 「↑ 载入更早」按 turn 游标向宿主请求更早的轮次，插入到顶部并**保持当前阅读位置**（记录 scrollHeight 差）；
- 「搜历史轮次」在已加载内容里定位并短暂高亮，无结果时提示先去载入；
- 真插件里从 session 记录分页读，不复用 chat 窗口的滚动缓存。

## 5. 落代码映射

- `lib/client.js`：主题变量 + 外观面板 + 定位条/迷你地图 + 历史按钮；
- 偏好持久化：`theme`(paper|ink)、`autoTheme`(false)、`depth`(68)、`aiDepth`(100)、`radius`、`tail`、`translationMode`、`bilingual`；
- 历史：宿主侧按 `turn` 游标读 session 记录，remote 返回 `{ turn, user, steps: [{ text, chars }] }`。

## 6. 文件

- `mockups/reasoning-panel-v7.html` — 最终预览
- `mockups/shots-v7/paper.png`、`shots-v7/appearance.png`
- `mockups/shots-v5/history.png` — 载入历史示意
- 构建脚本：`_tmp/build-v7.ps1`（从 v6 派生，v6←v5←v4←v3；pwsh 7 执行）

