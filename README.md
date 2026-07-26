# 阅迹 · GitHub Pages 版

这是一个可以直接上传到 GitHub 的微信读书个人主页。GitHub Actions 会使用仓库 Secret 中的微信读书 API Key 拉取公开书架与笔记，生成静态数据并发布到 GitHub Pages。

## 一次上传

1. 在 GitHub 新建一个仓库，建议命名为 `yueji-reading-room`。
2. 不要初始化 README、License 或 `.gitignore`。
3. 在新仓库页面点击 **uploading an existing file**。
4. 把本文件夹中的所有内容拖进去。注意要上传 `.github` 隐藏目录；如果 Finder 看不到它，请按 `Command + Shift + .` 显示隐藏文件。
5. 提交信息填写 `Initial GitHub Pages site`，点击 **Commit changes**。

## 配置微信读书密钥

1. 打开仓库的 **Settings → Secrets and variables → Actions**。
2. 点击 **New repository secret**。
3. Name 填写：`WEREAD_API_KEY`
4. Secret 填写你的微信读书 API Key，然后保存。

密钥只保存在 GitHub Secret 中，不会进入网页或源码。

## 开启 Pages

1. 打开仓库的 **Settings → Pages**。
2. 在 **Build and deployment** 的 Source 中选择 **GitHub Actions**。
3. 打开仓库的 **Actions**，选择 **Build and deploy Yueji**。
4. 点击 **Run workflow**。

首次运行完成后，Pages 页面会显示网站地址，通常是：

`https://你的用户名.github.io/yueji-reading-room/`

## 自动更新

- 每次上传代码后自动更新。
- 每天北京时间 04:15 自动同步一次微信读书。
- 也可以在 Actions 页面随时手动运行。

## 隐私说明

- `secret=1` 的私密书籍不会生成到网站。
- 文章收藏入口不会公开。
- 网站数据文件是公开的；任何能访问 Pages 的人都能查看生成后的公开书架、划线和想法。
- 微信读书当前只提供书签数量，不提供书签内容导出。
