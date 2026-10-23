# 用 VS Code 发布到 GitHub（中文图解版）

> 适合：不想记 git 命令、也不想装第三方汉化补丁。
> 前提：本机已装 VS Code（有），并且这个文件夹里已经有 git 仓库和提交（已完成）。

---

## 第 0 步：把中文界面装上（只需一次）

1. 打开 VS Code，按 `Ctrl+Shift+X` 打开扩展面板；
2. 搜索 `Chinese (Simplified) Language Pack`（发布者是 Microsoft）；
3. 点 **Install（安装）**，右下角弹窗点 **Change Language and Restart（更改语言并重启）**。

重启后菜单就是中文了。下面每条都给出「中文名（英文名）」，两边对得上。

---

## 第 1 步：打开项目文件夹

菜单 **文件 → 打开文件夹（File → Open Folder）**，选：

```
F:\DSH\DSH插件自开发\2026-10-21_右栏思考面板\dsh-think-dock
```

打开后左侧资源管理器会显示 18 个文件；如果提示“是否信任此文件夹作者”，点 **是，我信任**。

---

## 第 2 步：确认仓库状态

左侧点 **源代码管理（Source Control）** 图标（`Ctrl+Shift+G`）。

- 正常情况：显示「没有更改」/ 已经有两个提交（我替你做的）；
- 如果 Git 没配置过身份，右下角会提示，点 **打开终端** 执行一次：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

---

## 第 3 步：登录 GitHub（一次性）

左下角人像图标 **账户（Accounts）** → **使用 GitHub 登录（Sign in with GitHub）** → 浏览器弹出授权页 → 点 **Authorize**。

成功后左下角会显示你的 GitHub 用户名。**这一步代替了命令行里的 token**，之后推送不再要求密码。

---

## 第 4 步：一键发布仓库

按 `Ctrl+Shift+P` 打开命令面板，输入并选择：

> **GitHub: 发布到 GitHub（GitHub: Publish to GitHub）**

接着它会依次问你：

1. 选择要发布的仓库（只有一个，直接回车）；
2. 仓库名：保持 `dsh-think-dock`；
3. 选 **Publish to GitHub public repository（发布为公开仓库）** —— 开源项目选这个；
4. 等右下角进度结束。

完成后打开 <https://github.com/你的用户名/dsh-think-dock> 就能看到代码了。

> 如果命令面板里没有这一项：说明 GitHub 登录没成功，回到第 3 步；或者先用网页建空仓库（名字 `dsh-think-dock`，不要勾 README），再回来执行 **Git: 推送（Git: Push）** 时选它的地址。

---

## 第 5 步：以后每次更新（日常只用两个按钮）

1. 改完文件，左侧 **源代码管理** 会列出改动；
2. 在上方输入框写一句说明（如 `fix: 修正翻译重试`）；
3. 点 **✓ 提交（Commit）**；
4. 点出现的 **同步更改（Sync Changes）** —— 等价于一次“拉取 + 推送”。

仓库右上角 **获取（Fetch）** 用来检查远端有没有新提交。

---

## 第 6 步：发版本（可选，但开源项目建议做）

仓库第一次公开后，给个版本号能让别人引用：

1. `Ctrl+Shift+P` → **Git: 创建标记（Git: Create Tag）** → 输入 `v0.1.0` → 选“创建附注标记”并写一句说明；
2. 再执行 **Git: 推送标记（Git: Push Tags）**；
3. 浏览器打开仓库 → 右侧 **Releases → Draft a new release** → 选 `v0.1.0` → 标题写 `v0.1.0 — first public release` → **Publish release**。

---

## 第 7 步：把仓库“装修”一下

仓库首页右侧 **⚙ About**：

- Description：`A right-sidebar dock for the model's thinking in DeepSeek Harness.`
- Topics：`dsh`、`deepseek-harness`、`reasoning`、`plugin`、`sidebar`

README 会自动显示，中文入口在文件顶部的 `简体中文` 链接。

---

## 网络卡住怎么办（国内最常见）

VS Code 用的是系统里的 git，所以和在终端里一样。任选一种：

**① 给 git 配本地代理**（端口按你的代理软件填）

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

**② 改用 SSH 走 443**（不需要代理，最稳）

```powershell
ssh-keygen -t ed25519 -C "你的邮箱"        # 一路回车
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"   # 复制整行贴到 GitHub → Settings → SSH keys
```

然后 `C:\Users\你\.ssh\config` 里加：

```
Host github.com
  HostName ssh.github.com
  Port 443
  User git
```

在 VS Code 终端执行一次：

```powershell
git remote set-url origin git@github.com:你的用户名/dsh-think-dock.git
git push -u origin main
```

---

## 常见提示对照

| 界面提示 | 含义 / 处理 |
|---|---|
| `Publish Branch`（发布分支） | 远端还没有这个分支，点它就是首次推送 |
| `Sync Changes`（同步更改） | 拉取 + 推送一起做 |
| `No upstream branch` | 同上，点发布分支 |
| `Authentication failed` | 重新做第 3 步登录 |
| `Failed to connect to github.com` | 网络问题，看上一节 |
| 中文没生效 | 扩展装完要点 `Change Language and Restart`，或 `Ctrl+Shift+P` → `Configure Display Language` 选 `zh-cn` |
