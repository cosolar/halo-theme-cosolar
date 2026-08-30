<div align="center">

<img src="./public/assets/images/logo.png" width="150" height="100" alt="halo-theme-cosolar Logo" />

# halo-theme-cosolar

**极简笔记** — 面向开发者的现代 Halo 博客主题

**青绿美学** · **明暗双模** · **精选轮播** · **分类导航** · **全局搜索** · **移动端适配**

[![Halo](https://img.shields.io/badge/Halo-%3E%3D2.20-10B981?style=flat-square)](https://halo.run)
[![License](https://img.shields.io/badge/License-GPL--3.0-10B981?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.6-10B981?style=flat-square)](https://github.com/cosolar/halo-theme-cosolar/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Next-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)

🚀 [在线预览](https://note.minims.cn) · 📘 [配置手册](docs/使用教程.md)

</div>

---

## 📑 目录

- [✨ 简介](#-简介)
- [🎯 特性](#-特性)
- [💻 环境要求](#-环境要求)
- [📦 安装](#-安装)
- [⚙️ 配置](#️-配置)
- [🛠️ 开发](#️-开发)
- [🧩 技术栈](#-技术栈)
- [🔌 依赖插件](#-依赖插件)
- [❓ 常见问题](#-常见问题)
- [🗺️ 路线图](#-路线图)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)
- [💝 致谢](#-致谢)

---

## ✨ 简介

`halo-theme-cosolar`（极简笔记）是一款为**技术写作者**设计的 Halo 博客主题，基于 Thymeleaf 服务端渲染 + Vite 前端构建。主题以「内容优先」为设计原则，在排版、动效与留白上做减法，同时针对开发者的真实阅读场景补充了阅读进度、悬浮目录、零依赖图片查看器等增强能力。

## 🎯 特性

- 🎠 **精选轮播回退策略** — 首页顶部卡片轮播既支持手动指定文章、自动播放，也提供「最新 / 置顶」智能回退，无精选时自动降级不空白。
- 🧭 **悬浮目录（TOC）+ 阅读进度** — 桌面端右侧悬浮跟随、移动端抽屉式弹出；顶部 2px 彩色渐变进度条实时反映阅读位置，长文不迷路。
- 🖼️ **零依赖图片查看器** — 点击文章图片即放大，支持滚轮缩放 / 拖动 / 双击复位 / ESC 关闭，无需引入任何第三方库。
- 📋 **可拖拽模块化侧边栏** — 博主信息 / 公告 / 标签云 / 公众号 / 分类 / 友链 / RSS 七大模块可单独开关，并以列表拖拽自由排序，无需改代码。
- 🌌 **5 种 Canvas 动态背景** — 内置粒子 / 星空等动态渲染背景，粒子数随屏幕尺寸自适应（≤80 粒子 / ≤150 星），或随时切回静态背景图。
- 🔤 **双图标库 + 离线友好** — Iconify（默认，按需加载）与 iconfont 双模式；导航 / 分类 / 标签等内置 SVG 图标已本地化，配合本地字体即可完全离线部署。
- 👤 **深度可定制登录页** — 左右分栏布局，品牌区占比、遮罩层开关、渐变主色与透明度（明暗双模各自可配）全部后台可调；主题色防闪烁。
- 🔗 **友链 / RSS / 图库三大扩展页** — 友链页含分组筛选、实时搜索、在线 / 回链状态徽章与邮件申请 CTA；RSS 资讯页三栏聚合订阅动态；图库页照片墙支持分组浏览与登录态可控的上传 / 删除权限。
- 📚 **知识库阅读体验** — 配合 MiniDocs 插件：列表页含统计看板、标签 / 创建者筛选、四种排序与卡片 / 列表双视图；阅读页为「文档树 + 正文 + 大纲」三栏布局，两侧栏宽度可拖拽，支持匿名点赞与链接分享。

## 💻 环境要求

| 依赖     | 版本        |
| -------- | ----------- |
| Halo     | `>= 2.20.0` |
| Node.js  | 推荐 LTS    |
| 包管理器 | pnpm        |

## 📦 安装

### 方式一：从 Release 安装（推荐）

1. 从 [Releases](https://github.com/cosolar/halo-theme-cosolar/releases) 下载最新 `halo-theme-cosolar-<version>.zip`。
2. 登录 Halo 后台，进入 **主题管理 → 安装主题**，上传 ZIP。
3. 安装完成后点击 **启用** 🎉。

### 方式二：从源码构建

适用于二次开发或自定义修改。

```bash
git clone https://github.com/cosolar/halo-theme-cosolar.git
cd halo-theme-cosolar
pnpm install
pnpm build            # 产物：templates/ 目录 + halo-theme-cosolar-<version>.zip
```

将生成的 ZIP 上传至 Halo，或将整个目录放入 Halo 工作目录的 `themes/halo-theme-cosolar/` 下。

## ⚙️ 配置

主题配置集中在 **Halo 后台 → 主题管理 → halo-theme-cosolar → 设置**，按分组管理：基础 / 页脚 / 主题样式 / 文章页 / 博主信息 / 首页轮播 / 侧边栏 / 分类 / 标签 / 归档 / 友链 / RSS / 瞬间 / 图库 / 知识库 / 页面背景 / 登录页。

每个字段的类型、默认值、取值范围与配置建议见 [配置手册（使用教程.md）](docs/使用教程.md)。

关键配置速览：

- 🎨 **主题样式** — 换主题色、明暗方案、布局宽度、字体与图标库。
- 🖼️ **首页轮播** — 指定精选文章，或回退到最新 / 置顶文章。
- 📋 **侧边栏** — 开关并拖拽排序各模块。
- 🌈 **页面背景** — 浅色 / 深色分别配置纯色、背景图或动态背景。
- 📷 **图库页** — 封面、侧边栏与「显示操作按钮」权限开关。

## 🛠️ 开发

```bash
pnpm install
pnpm dev          # 监听文件变化，实时构建到 templates/
pnpm check        # 类型检查 + 模板 / 配置校验（含 --fix）
pnpm build-only   # 仅构建，不打 ZIP，用于本地联调
pnpm build        # 完整构建 + 打包 ZIP
```

构建流程：`TypeScript 类型检查 → Vite 构建（vite-plus + @halo-dev/vite-plugin-halo-theme）→ theme-package 打包`。

## 🧩 技术栈

- **运行时**：Halo（Spring Boot + WebFlux）服务端 Thymeleaf 渲染。
- **构建**：Vite（vite-plus）+ `@halo-dev/vite-plugin-halo-theme`。
- **语言**：TypeScript（严格模式），前端按页面拆分 TS 入口。
- **样式**：原生 CSS，主题色 / 明暗态通过 CSS 变量驱动。

> 💡 模板中存在两层语法：`<include>` / `<slot>` / `<template>` 为 Vite **构建期**处理；`th:*` / `${...}` 为 Thymeleaf **运行期**处理。修改模板时需区分二者作用时机。

## 🔌 依赖插件

| 插件              | 用途                                                           | 必需度                                                |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `plugin-links`    | 管理友情链接、检测链接可访问性与回链状态、聚合 RSS / Atom 动态 | 友情链接页、侧边栏友链 / 订阅模块、RSS 资讯页**必需** |
| `plugin-photos`   | 官方图库插件，提供照片管理与分组                               | 图库页**必需**                                        |
| `plugin-minidocs` | MiniDocs 知识库插件，提供知识库 / 文档模型与 `minidocsFinder`  | 知识库列表页 `/docs` 与阅读页**必需**                 |
| `plugin-shiki`    | 代码高亮（亮 / 暗主题在插件设置中配置）                        | 代码高亮**必需**                                      |

> 💾 `plugin-minidocs` 下载地址：[halo-plugin-minidocs Releases](https://github.com/cosolar/halo-plugin-minidocs/releases)

> ⚠️ 未安装 `plugin-links` 时：友情链接页列表为空、RSS 资讯页提示「功能未启用」、侧边栏相关模块自动隐藏。安装后需在插件「RSS 订阅」中开启「公开 RSS 订阅动态」。
>
> ⚠️ 未安装 `plugin-minidocs` 时：`/docs` 与 `/docs/view/{kbSlug}` 不可用；安装后还需在插件设置中开启「允许未登录用户阅读」，并创建至少一个公开知识库与已发布文档。
>
> ⚠️ 知识库与友链的插件 API 说明见 [`docs/minidocs-theme-api.md`](docs/minidocs-theme-api.md) 与 [`docs/links-theme-api.md`](docs/links-theme-api.md)。

搜索功能依赖官方搜索插件。

## ❓ 常见问题

**🔧 如何关闭模板缓存以便调试？**

- Docker 部署：添加环境变量 `SPRING_THYMELEAF_CACHE=false`。
- 源码部署：在 `application.yaml` 中设置 `spring.thymeleaf.cache: false`。

**🌈 代码高亮如何配置？**

由 `plugin-shiki` 负责，在 **插件管理 → Shiki → 设置** 中配置亮 / 暗主题，主题本身不提供代码高亮选项。

**📴 如何完全离线部署？**

1. 下载 [lxgw-wenkai-screen-webfont](https://github.com/lxgw-wenkai-webfont) 并上传至 Halo 附件管理；
2. 在 **主题样式** 中将「字体 CSS 地址」替换为本地路径；
3. 图标库切换为 **iconfont** 模式并填入本地 CSS 地址（导航 / 分类 / 标签等内置 SVG 图标已本地化，无需额外处理）。

**⚡ 动态背景会影响性能吗？**

Canvas 2D 渲染，粒子数随屏幕尺寸自适应（≤80 粒子 / ≤150 星），对现代设备几乎无影响。如有顾虑可降低透明度或改用静态背景。

**📷 图库操作按钮（上传 / 删除）不显示？**

受「图库页设置 → 显示操作按钮」开关控制，且仅对**已登录用户**可见。请确认已登录且开关处于开启状态。

**🔗 友情链接 / RSS 资讯页无内容？**

确认已在 **插件管理** 安装并启用 `plugin-links`；RSS 资讯还需在插件「RSS 订阅」中开启「公开 RSS 订阅动态」。

**📚 知识库页（`/docs`）打不开或没有内容？**

确认已安装并启用 `plugin-minidocs`（下载地址：[halo-plugin-minidocs Releases](https://github.com/cosolar/halo-plugin-minidocs/releases)），在插件设置中开启「允许未登录用户阅读」，并创建至少一个**公开知识库**与一篇**已发布**文档。未登录访客只能看到公开知识库。

**📋 侧边栏模块顺序如何调整？**

在 **侧边栏设置 → 侧边栏模块顺序** 中拖拽每行调整顺序，删除某行可隐藏该模块，各模块单独开关用于临时显隐。

## 🗺️ 路线图

- [ ] 🌐 i18n 多语言（中 / 英）
- [ ] 🔍 搜索结果页模板
- [ ] 🚧 404 / 500 错误页美化
- [ ] 📚 文章系列 / 专栏支持
- [ ] 🔀 首页布局模式切换（列表 / 瀑布流）
- [ ] 📤 图库上传进度与批量管理增强

## 🤝 贡献

欢迎 Issue 与 PR！

1. Fork 本仓库；
2. 新建分支：`git checkout -b feat/your-feature`；
3. 提交：`git commit -m "feat: ..."`（遵循 [Conventional Commits](https://www.conventionalcommits.org/)）；
4. 推送并提交 Pull Request。

## 📄 许可证

[GPL-3.0](LICENSE)

## 💝 致谢

- [Halo](https://halo.run) — 开源建站平台
- [Iconify](https://iconify.design) — 图标方案
- 所有提过 Issue 与建议的用户

---

<div align="center">

如果 halo-theme-cosolar 对你有帮助，欢迎给个 ⭐ Star。

</div>
