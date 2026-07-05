<div align="center">

# halo-theme-cosolar

**极简不简单 — 面向开发者的现代 Halo 博客主题**

青绿美学 · 暗色模式 · 精选轮播 · 分类导航 · 全局搜索 · 完美移动端适配

</div>

---

## 简介

theme-cosolar 是一款为 [Halo](https://halo.run) 2.20+ 打造的现代博客主题，专为技术写作者设计。它把"内容"放回舞台中央 —— 干净的排版、克制的动效、合理的留白，让代码与文字都能舒适呼吸。同时在小屏与移动端做了完整自适应：贴底毛玻璃操作栏、抽屉式目录、自动隐藏的侧边栏，让手机阅读体验与桌面端同样顺滑。

### 设计亮点

- 🎨 **青绿美学** — 默认主色 `#10B981`，可在后台一键换色，全站按钮 / 链接 / 标签 / 进度条联动
- 🌗 **暗色模式** — 跟随系统 / 强制浅色 / 强制暗色三档可切，导航与操作栏毛玻璃风格
- 🖼️ **精选轮播** — 首页顶部卡片轮播，支持手动指定、自动播放、置顶回退
- 🗂️ **分类导航 + 热门标签 + 近期更新** — 侧边栏模块化组件，可单独开关
- 📚 **文章目录（TOC）** — 桌面端右侧悬浮跟随，移动端抽屉式弹出，1px 极细滚动条
- 📊 **阅读进度条** — 顶部 2px 彩色渐变，实时反映阅读位置
- 🖱️ **图片查看器** — 文章图片点击放大，支持滚轮缩放 / 拖动 / 双击复位 / ESC 关闭，零依赖
- 👍 **点赞 / 评论 / 分享 / 回顶** — 文章页底部贴底毛玻璃横条，5 按钮平分宽度
- 📱 **移动端自适应** — ≤768px 侧边栏自动隐藏，导航汉堡菜单展开，操作栏贴底
- ⚡ **Vite 构建** — TypeScript + `vite-plugin-halo-theme`，产物精简，按模板分块

## 预览

**演示站点：** https://note.minims.cn

![Snipaste_2026-07-05_08-53-53.png](https://oss.towao.com/proxy/plain/img/2026/e298d593380afee655b78d9c754e88c4.png)

![Snipaste_2026-07-05_08-56-07.png](https://oss.towao.com/proxy/plain/img/2026/6c0b7a3d95b9450d5c3fed86d0b51bc6.png)

![Snipaste_2026-07-05_08-58-54.png](https://oss.towao.com/proxy/plain/img/2026/0a5adf875585795d1a77ad82fe3a1d20.png)

![Snipaste_2026-07-05_08-57-52.png](https://oss.towao.com/proxy/plain/img/2026/541bae6ec7f275f7fc816b8bc2339d3e.png)

## 环境要求

| 项目 | 版本 |
|---|---|
| Halo | `>=2.20.0` |
| Node.js | `>=18` |
| 包管理器 | `pnpm@10`（项目已锁定） |

## 安装

### 方式一：直接下载 Release

1. 前往 [Releases](https://github.com/cosolar/halo-theme-cosolar/releases) 下载最新 `cosolar-<version>.zip`
2. 进入 Halo Console → 主题管理 → 安装主题 → 上传 ZIP
3. 安装完成后点击"启用"

### 方式二：从源码构建

```bash
git clone https://github.com/cosolar/halo-theme-cosolar.git
cd halo-theme-cosolar
pnpm install
pnpm build            # 产物在 templates/ 与 cosolar-<version>.zip
```

然后将生成的 ZIP 上传到 Halo，或把整个目录放入 Halo 工作目录的 `themes/cosolar/` 下（目录名须与 `theme.yaml` 中 `metadata.name` 一致）。

## 开发

```bash
pnpm install
pnpm dev              # 监听文件变化，实时构建到 templates/
pnpm check            # 检查模板与配置
pnpm build-only       # 仅构建（不打 ZIP），用于本地联调
```

开发时建议关闭 Halo 的模板缓存：

- Docker：环境变量 `SPRING_THYMELEAF_CACHE=false`
- 源码：`application.yaml` 设 `spring.thymeleaf.cache: false`

## 目录结构

```
halo-theme-cosolar/
├── theme.yaml                 # 主题元数据
├── settings.yaml              # 后台配置表单（FormKit）
├── annotation-setting.yaml    # 菜单/分类/文章自定义注解字段
├── package.json               # 构建脚本与依赖
├── src/                       # 源码（开发目录）
│   ├── index.html             # 首页：精选轮播 + 文章列表 + 侧边栏
│   ├── post.html              # 文章页：正文 + TOC + 底部操作栏
│   ├── page.html              # 自定义页面
│   ├── archives.html          # 归档页
│   ├── categories.html        # 分类汇总
│   ├── category.html          # 分类列表（带侧边栏）
│   ├── tags.html              # 标签云
│   ├── tag.html               # 标签列表（带侧边栏）
│   ├── partials/              # 复用片段
│   │   ├── layout.html        # 全局布局：head / nav / footer / CSS 变量注入
│   │   ├── sidebar.html       # 侧边栏组件
│   │   ├── post-card.html     # 文章卡片
│   │   └── pagination.html    # 分页
│   ├── css/main.css           # 全局样式 + 响应式断点
│   └── js/                    # TypeScript 入口
│       ├── main.ts            # 全局交互（汉堡菜单 / 主题切换 / 滚动阴影 / 导航激活）
│       ├── index.ts           # 首页轮播逻辑
│       └── post.ts            # TOC / 点赞 / 评论 / 分享 / 回顶 / 阅读进度 / 图片查看器
└── templates/                 # 构建产物（提交时被 .gitignore 忽略，发布包内含）
```

## 配置项

主题安装后，在 Halo Console → 主题管理 → Cosolar → 设置 中配置，共 5 个分组：

### 基础设置 (`basic`)
| 字段 | 说明 |
|---|---|
| `logo_image` | Logo 图片，留空显示默认代码图标 |
| `logo_image_size` | Logo 显示尺寸（20–80px） |
| `logo_text` | 头部站点名称 |
| `tagline` | Logo 下方副标题 |
| `footer_text` | 页脚版权文字（支持 HTML） |
| `icp` | ICP 备案号 |

### 样式设置 (`style`)
| 字段 | 说明 |
|---|---|
| `primary_color` | 主题色，默认 `#10B981` |
| `color_scheme` | 默认配色：跟随系统 / 浅色 / 暗色 |
| `posts_per_page` | 每页文章数 |
| `content_width` | 内容最大宽度（960–1920px） |
| `sidebar_width` | 侧边栏宽度（260–400px） |
| `content_gap` | 内容区与侧边栏间距（12–48px） |
| `toc_width` | 文章目录宽度（180–320px） |
| `excerpt_length` | 文章卡片摘要字数 |

> 代码高亮主题由 Halo `plugin-shiki` 插件后台统一配置（亮色/暗色），主题不再单独提供该选项。

### 侧边栏设置 (`sidebar`)
| 字段 | 说明 |
|---|---|
| `show_sidebar` | 显示侧边栏（≤768px 自动隐藏） |
| `show_search` / `show_hot_tags` / `show_categories` / `show_recent` | 各模块开关 |
| `hot_tags_count` / `categories_count` / `recent_count` | 各模块数量 |

### 精选文章 (`featured`)
| 字段 | 说明 |
|---|---|
| `show_featured` | 启用首页轮播 |
| `featured_posts` | 指定精选文章（可拖拽排序） |
| `autoplay` / `interval` | 自动轮播开关与间隔（ms） |
| `fallback` | 未配置时的回退：最新文章 / 置顶文章 / 不显示 |

### 社交链接 (`social`)
| 字段 | 说明 |
|---|---|
| `author_name` / `author_avatar` / `author_bio` | 页脚博主卡片 |
| `github` / `email` / `twitter` / `rss` | 社交链接 |

## 响应式断点

| 断点 | 行为 |
|---|---|
| `> 1024px` | 桌面：三栏布局（内容 + 侧边栏 + TOC） |
| `769–1024px` | 平板：隐藏 TOC 列，内容 + 侧边栏 |
| `≤ 768px` | 手机：侧边栏隐藏，导航收起为汉堡菜单，底部操作栏贴底 |
| `≤ 480px` | 小屏：操作栏按钮进一步紧凑 |

## 技术栈

- **模板**：Thymeleaf 3.1（Halo 原生）
- **构建**：Vite + `@halo-dev/vite-plugin-halo-theme`
- **语言**：TypeScript
- **样式**：原生 CSS + CSS 变量（无 Tailwind 依赖）
- **打包**：`@halo-dev/theme-package-cli`

## 兼容的 Halo API

主题使用以下 Finder / 全局变量，均已对齐 Halo 2.20+ 接口：

- `postFinder` / `categoryFinder` / `tagFinder` / `singlePageFinder` / `menuFinder`
- 点赞：`POST /apis/api.halo.run/v1alpha1/trackers/upvote`，body `{group, plural, name}`
- 评论插件：渲染后挂载 `<halo-comment-widget>` 自定义元素
- 全局变量：`site`、`theme`、`theme.config.*`

## 路线图

- [ ] 主题管理页首屏截图
- [ ] i18n 多语言（中 / 英）
- [ ] 搜索结果页模板
- [ ] 404 / 500 错误页美化

## 贡献

欢迎提 Issue 与 PR。

1. Fork 本仓库
2. 新建分支：`git checkout -b feat/your-feature`
3. 提交：`git commit -m "feat: ..."`（遵循 [Conventional Commits](https://www.conventionalcommits.org/)）
4. 推送并提交 Pull Request

开发前请先 `pnpm install && pnpm dev` 跑通本地构建。

## 许可证

[GPL-3.0](LICENSE)

## 致谢

- [Halo](https://halo.run) — 强大易用的开源建站平台
- 所有为本主题提过 Issue 与建议的用户
