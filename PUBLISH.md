# 发布到 GitHub：一步一步来

> 目标：把这个文件夹变成一个公开的 GitHub 仓库，别人能看到、能装、能提 issue。
> 全程只需要：Git（你机器上已有 2.56）、一个 GitHub 账号、一个浏览器。命令都在仓库目录里执行。

仓库目录（就是含 `package.json` 的这一层）：

```powershell
cd 'F:\DSH\DSH插件自开发\2026-10-21_右栏思考面板\dsh-think-dock'
```

---

## 第 0 步：作者信息（已填好，一般不用动）

`package.json` 与三份 README/LICENSE 里现在已经是：

- 仓库地址：`https://github.com/StarShineXN/dsh-think-dock`
- 作者：`StarShine-XiuNing`

将来要换 GitHub 用户名或署名，跑一次下面这段（把 `$oldGh/$oldMe` 改成当前值）：

```powershell
$oldGh = 'StarShineXN';       $newGh = '新用户名'
$oldMe = 'StarShine-XiuNing'; $newMe = '新署名'
Get-ChildItem -Recurse -File -Include *.md,package.json,LICENSE |
  ForEach-Object {
    $t = Get-Content -LiteralPath $_.FullName -Raw
    $t = $t.Replace($oldGh, $newGh).Replace($oldMe, $newMe)
    Set-Content -LiteralPath $_.FullName -Value $t -Encoding utf8 -NoNewline
  }
```

> 仓库名建议就用 `dsh-think-dock`。想改名的话，`package.json` 的 `name`、`cordis.patch.yml` 的行名、`lib/client.js` 顶部的 `id` 要一起改，否则 DSH 装不上。
>
> 仓库已经 `git init` 并提交过了（3 个提交），所以第 1 步可以跳过，直接从第 2 步开始。

---

## 第 1 步：本地建仓库并提交

```powershell
git init -b main
git add .
git status                 # 看一眼要提交的文件，别把 node_modules 带进去
git commit -m "feat: initial release of Think Dock"
```

预期：`git status` 显示 `nothing to commit, working tree clean`。
如果 Git 报没配置身份：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

---

## 第 2 步：在 GitHub 网页上建一个**空**仓库

1. 打开 <https://github.com/new>
2. Repository name 填 `dsh-think-dock`
3. 可见性选 **Public**
4. **不要**勾选 “Add a README / .gitignore / license”（本地已经有了，勾了会冲突）
5. 点 **Create repository**

---

## 第 3 步：关联远程并推送

网页会给你一段命令，用 HTTPS 这版：

```powershell
git remote add origin https://github.com/<你的用户名>/dsh-think-dock.git
git push -u origin main
```

**密码不是账号密码**。GitHub 早就停用了密码推送，要用 **Personal Access Token**：

1. <https://github.com/settings/tokens> → *Generate new token (classic)*
2. Note 随便写，Expiration 选 90 天，Scopes 勾 `repo`
3. 生成后**立刻复制**（只显示一次），在 `git push` 要求输入密码时粘贴它

推送成功后刷新仓库页面，应该能看到 README 和代码。Windows 的「凭据管理器」会记住 token，下次不用再输。

### 国内网络推不上去？

GitHub 的 HTTPS 直连经常超时。按顺序试：

**① 走本地代理**（如果你有 Clash/v2ray 之类，端口按软件里显示的填）

```powershell
git config http.proxy http://127.0.0.1:7890
git push -u origin main
```

**② SSH 走 443 端口**（不需要代理，最稳）

```powershell
ssh-keygen -t ed25519 -C "你的邮箱"        # 一路回车
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"   # 复制这一整行
```

把公钥贴到 <https://github.com/settings/keys> → *New SSH key*，然后：

```powershell
# 让 SSH 走 443
@"
Host github.com
  HostName ssh.github.com
  Port 443
  User git
"@ | Set-Content "$env:USERPROFILE\.ssh\config" -Encoding utf8

ssh -T git@github.com          # 看到 "Hi <name>! You've successfully authenticated" 就通了
git remote set-url origin git@github.com:<你的用户名>/dsh-think-dock.git
git push -u origin main
```

**③ 实在不行**：先把仓库导入到 Gitee（Gitee 支持“从 GitHub 导入仓库”，国内可访问），Gitee 的仓库同样可以放这份代码；将来网络好了再把 GitHub 作为主仓库。

---

## 第 4 步：发一个版本（Release）

```powershell
git tag -a v0.1.0 -m "Think Dock 0.1.0"
git push origin v0.1.0
```

然后网页上：仓库 → **Releases** → *Draft a new release* → 选 `v0.1.0` → 标题写 `v0.1.0 — first public release` → 描述里贴 `CHANGELOG.md` 的第一段 → **Publish release**。

---

## 第 5 步：把仓库“装修”一下（5 分钟，但很值）

- 仓库首页右上 **⚙ About**：Description 填
  `A right-sidebar dock for the model's thinking in DeepSeek Harness.`
  Topics 填：`dsh` `deepseek` `deepseek-harness` `reasoning` `plugin` `sidebar`
- README 里的徽章、截图已经就位（`docs/screenshots/`）。
- 想加中文入口：README 顶部已有 `[简体中文](README.zh-CN.md)` 链接。

---

## 第 6 步：以后怎么更新

```powershell
git add .
git commit -m "fix: 一句话说明改了什么"
git push
```

想发新版：改 `package.json` 的 `version` → 提交 → `git tag -a v0.1.1 -m "..."` → `git push origin v0.1.1` → 网页上再发一个 Release。

---

## 附：常见报错对照

| 报错 | 原因 / 解法 |
|---|---|
| `fatal: not a git repository` | 不在仓库目录，先 `cd` 进去 |
| `remote: Support for password authentication was removed` | 用 Personal Access Token 当密码 |
| `Connection timed out` / `Failed to connect to github.com port 443` | 网络问题，走第 3 步的 ①/② |
| `src refspec main does not match any` | 还没 commit，或分支名不是 main：`git branch -M main` |
| `! [rejected] ... non-fast-forward` | 远程有你本地没有的提交：`git pull --rebase origin main` 再 push |
| `error: remote origin already exists` | `git remote set-url origin <新地址>` |
| 推送后网页看不到文件 | 确认 `git branch` 是 main，且 push 的是 `main` 而不是 `master` |

---

## 附：想同时发到 npm？（可选，别人装起来更简单）

```powershell
npm login                                   # 需要 npm 账号
# 先把 package.json 里的 repository/homepage 换成真实地址
npm publish --access public
```

发出去之后，别人可以 `plugin_manager install_bundle` 指向 npm 包名，而不是本地路径。第一次发布前建议在 `files` 里确认只包含 `lib/`、`cordis.patch.yml`、`icon.svg` 和文档。
