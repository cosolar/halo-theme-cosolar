# 主题 API 文档

本文档介绍 MiniDocs 插件为主题端（Halo Java 模板，Thymeleaf / FreeMarker）提供的 Finder API 与类型定义。若使用前端框架做客户端渲染，可直接调用匿名公共 API，端点列表请参考 [REST API 文档](./minidocs-rest-api.md)。

## 路由

MiniDocs 内置了一组前台主题模板路由（由 `KnowledgeBaseRouter` 以 `@Component` + `@Bean RouterFunction` 注册，Halo 自动收集），主题可选择性用同名模板覆盖；未提供时使用插件内置默认模板 `docs.html` / `doc.html` / `doc_share.html`：

| 路由                       | 渲染模板         | 说明                                                                                |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `/docs`                    | `docs.html`      | 文档列表页（模板通过 `minidocsFinder` 自取当前用户可见的知识库与文档）              |
| `/docs/view/{kbSlug}`      | `doc.html`       | 知识库阅读页；`kbSlug` 支持知识库 `metadata.name` 或 `spec.slug`                    |
| `/docs/share/{shareToken}` | `doc_share.html` | 知识库外链分享页（左侧文档树、中间阅读区、右侧大纲）；可选 `?docSlug=` 直接定位文档 |

> **阅读页 / 列表页**走常规授权大门：服务端仅在路由入口做访问授权（按当前登录态校验公开 / 私有库与匿名开关），不向模板塞业务数据；知识库 / 文档树 / 文档数据由模板通过 `minidocsFinder` 自行查询（Finder 内部再做资源级可见性二次校验）。当前访问者不可访问的知识库返回 `404`。
>
> **分享页不走常规权限**：只要持有有效外链（`shareToken`），即便是不公开的私有知识库也无需登录即可查看，仅受分享自身的「开启状态、有效期、访问密码」约束。分享页由服务端直接渲染数据，模板可用的模型变量：`shareToken`（外链标识）、`knowledgeBase`（知识库）、`docTree`（已发布文档树）、`docSlug`（当前文档 slug）、`doc`（当前文档）、`gate`（是否密码门页）。设置了访问密码（`spec.sharePassword`）且访客未通过验证时，仅渲染密码门；密码经 GET 查询参数 `?password=` 提交，验证通过后服务端下发 HttpOnly 访问 cookie，后续访问免密。分享已关闭 / 过期 / token 无效时返回 `404`。

若主题希望自定义页面结构，也可不依赖内置路由，自行在 Halo 后台创建页面并选择主题自定义模板，用页面 slug 或主题设置传入知识库 `name` / `slug`，再在模板中通过 `minidocsFinder` 取数渲染。`minidocsFinder` 还可用于任意主题模板位置（如全局侧边栏 / 页脚），渲染「全站知识库入口」或「文档页脚导航」。

> 无论采用何种路由，Finder 变量 `${minidocsFinder}` 都由插件在 Halo 渲染上下文自动注入，**只要插件已启用即可直接使用**，无需主题额外声明。

## Finder API

### minidocsFinder

`minidocsFinder` 对应当前实现中的 `@Finder("minidocsFinder")`，用于查询**当前访问者可见**的知识库及其已发布文档（未登录仅公开库，登录含自己创建 / 是成员的私有库）。返回类型为 `reactor.core.publisher.Mono<T>`，Halo 模板引擎会自动订阅并解包，在模板中直接作为普通对象 / 集合使用即可，无需（也不能）手动 `block()`。

> Finder 走常规可见性边界，**不包含外链分享链路**：私有知识库即使开启了分享，也不会通过 Finder 对外链访客可见——分享内容只能经 `/docs/share/{shareToken}` 路由或 `api.minidocs.halo.run` 的 `/share/*` 端点访问。

方法返回内容随**当前访问者**的权限而定，与公共 REST API 的可见性边界保持一致：

- **未登录用户**：仅能访问 `publicVisible=true` 的公开知识库及其 `phase=published` 文档；且当插件设置关闭「允许未登录用户阅读」时，匿名请求返回 `403`（或空）。
- **已登录用户**：除公开知识库外，还能访问**自己创建、或写入 `spec.members`（成员）、或具备知识库管理权限**的私有知识库；文档一律仅暴露 `phase=published`。
- 任何情况下，私有知识库只对本库创建者 / 成员 / 管理者可见，其余用户一律不可见（详情 / 文档返回空，列表不出现）。

> 主题渲染上下文中，Finder 通过当前安全上下文识别登录用户：已登录成员在主题列表即可看到自己参与的私有库；未登录仅见公开库。

#### minidocsFinder.listKnowledgeBases(page, size)

分页列出**当前访问者**可访问的知识库（按最近更新倒序）：

- **已登录用户**：公开知识库 + 自己创建 / 是成员（或具备管理权限）的私有知识库。
- **未登录用户**：仅公开知识库（受 `allowAnonymousRead` 设置约束）。

**参数**：

| 参数   | 说明              |
| ------ | ----------------- |
| `page` | 页码，从 `1` 开始 |
| `size` | 每页条数          |

**返回值**：`ListResult<KnowledgeBase>`

**示例**：

```html
<ul>
  <li th:each="kb : ${minidocsFinder.listKnowledgeBases(1, 10).items}">
    <a th:href="'/docs/view/' + ${kb.spec.slug}" th:text="${kb.spec.displayName}"></a>
    <small th:text="${kb.status.docCount} + ' 篇'"></small>
  </li>
</ul>
```

#### minidocsFinder.getKnowledgeBase(kbSlug)

获取单个知识库详情；当前访问者不可访问（非公开，且非该库创建者 / 成员 / 管理者）时返回空。

**参数**：

| 参数     | 说明                                            |
| -------- | ----------------------------------------------- |
| `kbSlug` | 知识库标识，支持 `metadata.name` 或 `spec.slug` |

**返回值**：`KnowledgeBase`（非公开 / 不存在时为空）

**示例**：

```html
<div th:with="kb = ${minidocsFinder.getKnowledgeBase(kbSlug)}" th:if="${kb != null}">
  <h1 th:text="${kb.spec.displayName}"></h1>
  <p th:text="${kb.spec.description}"></p>
</div>
```

#### minidocsFinder.listDocs(kbSlug, page, size)

分页列出知识库下已发布文档。

**参数**：

| 参数     | 说明                                            |
| -------- | ----------------------------------------------- |
| `kbSlug` | 知识库标识，支持 `metadata.name` 或 `spec.slug` |
| `page`   | 页码，从 `1` 开始                               |
| `size`   | 每页条数                                        |

**返回值**：`ListResult<KnowledgeBaseDoc>`

**示例**：

```html
<ul>
  <li th:each="doc : ${minidocsFinder.listDocs(kbSlug, 1, 20).items}">
    <a
      th:href="'/docs/view/' + ${kbSlug} + '?docSlug=' + ${doc.spec.slug}"
      th:text="${doc.spec.title}"
    ></a>
    <small th:text="${doc.spec.summary}"></small>
  </li>
</ul>
```

#### minidocsFinder.getDocBySlug(kbSlug, docSlug)

获取单篇已发布文档（按文档 `spec.slug` 取，并校验归属该知识库）。

**参数**：

| 参数      | 说明                                            |
| --------- | ----------------------------------------------- |
| `kbSlug`  | 知识库标识，支持 `metadata.name` 或 `spec.slug` |
| `docSlug` | 文档的 `spec.slug`（URL 友好标识）              |

**返回值**：`KnowledgeBaseDoc`（不存在时为空）

**示例**：

```html
<div th:with="doc = ${minidocsFinder.getDocBySlug(kbSlug, docSlug)}" th:if="${doc != null}">
  <h1 th:text="${doc.spec.title}"></h1>
</div>
```

> 公共 API 统一使用 slug 字段查询：知识库标识为 `kbSlug`，文档标识为 `docSlug`。

#### minidocsFinder.getDocTree(kbSlug)

获取该知识库已发布文档的文档树（递归嵌套）。

**参数**：

| 参数     | 说明                                            |
| -------- | ----------------------------------------------- |
| `kbSlug` | 知识库标识，支持 `metadata.name` 或 `spec.slug` |

**返回值**：`List<DocTreeNode>`

文档按 `spec.priority`、`metadata.name` 升序；`children` 为子节点列表，可递归渲染。适合侧边栏导航。

**示例**：

```html
<nav>
  <ul>
    <li th:each="node : ${minidocsFinder.getDocTree(kbSlug)}">
      <a
        th:href="'/docs/view/' + ${kbSlug} + '?docSlug=' + ${node.slug}"
        th:text="${node.title}"
      ></a>
      <ul th:if="${node.children != null and !node.children.isEmpty()}">
        <li th:each="child : ${node.children}">
          <a
            th:href="'/docs/view/' + ${kbSlug} + '?docSlug=' + ${child.slug}"
            th:text="${child.title}"
          ></a>
        </li>
      </ul>
    </li>
  </ul>
</nav>
```

> 多级文档树建议在主题后端（自定义 TemplateModel / Spring Bean）递归展平为一维列表再传入模板，或在前端配合公共 REST 的 `/tree` 接口渲染。Finder 的 `getDocTree` 更适用于 1~2 级深度的静态展示。

#### minidocsFinder.getDocBySlug(docSlug)

按文档 `slug` 查询已发布文档（所属知识库须对当前访问者可见）。适合「`/docs/view/{kbSlug}?docSlug={docSlug}`」这类可读 URL 的详情页。

**参数**：

| 参数      | 说明               |
| --------- | ------------------ |
| `docSlug` | 文档的 `spec.slug` |

**返回值**：`KnowledgeBaseDoc`（不存在时为空）

**示例**：

```html
<article th:with="doc = ${minidocsFinder.getDocBySlug(docSlug)}" th:if="${doc != null}">
  <h1 th:text="${doc.spec.title}"></h1>
  <div id="doc-body" th:attr="data-md=${doc.spec.raw}"></div>
</article>
```

> `docSlug` 变量由你的主题通过「页面 slug 约定」或「主题设置」传入模板（与内置路由 `/docs/view/{kbSlug}?docSlug=` 中的 `docSlug` 一致）。文档 `spec.raw` 为**原始 Markdown 文本**，需主题自行渲染（参考下方「Markdown 渲染」）。若希望直接输出已渲染 HTML，可直接使用文档的 `spec.content` 字段（编辑时由前端 Markdown 编辑器生成的 HTML）。

> 取单篇文档有两个**同名重载**：
>
> - `getDocBySlug(kbSlug, docSlug)`：限定知识库取文档（并校验归属该知识库）。
> - `getDocBySlug(docSlug)`：按文档 slug 全局取（适合详情页只带一个 slug 的场景）。
>
> 两者均要求所属知识库对**当前访问者可见**（公开库，或当前用户为成员 / 创建者 / 管理者的私有库）且文档 `phase=published`；不可见时返回空，统一使用 slug 字段查询。

## Markdown 渲染

`minidocsFinder` 返回的文档 `spec.raw` 是原始 Markdown。主题中常用两种渲染方式：

### 前端脚本渲染（轻量）

把原始 Markdown 以 JSON 安全方式注入 `<script>`，再用 `marked` + `highlight.js` 渲染：

```html
<div id="doc-html" class="markdown-body"></div>
<script th:inline="javascript">
  /*<![CDATA[*/
  const DOC_MD = /*[[${doc.spec.raw}]]*/ "";
  /*]]>*/
</script>
<script type="module">
  import { marked } from "https://esm.sh/marked";
  document.getElementById("doc-html").innerHTML = marked.parse(DOC_MD);
</script>
```

### 主题侧渲染 Bean（服务端）

实现并注册一个 Spring Bean，供 Thymeleaf 通过 `${@beanName.method(...)}` 调用：

```java
@Component("markdownRender")
public class MarkdownRender {
    public String render(String markdown) {
        return CommonmarkRenderer.render(markdown); // 使用 commonmark / flexmark 等
    }
}
```

```html
<div class="markdown-body" th:utext="${@markdownRender.render(doc.spec.raw)}"></div>
```

> 注意用 `th:utext`（不转义）输出 HTML。

## 公共 REST API

如果主题使用前端框架进行客户端渲染，可以直接调用匿名公共 API（如文档树、按 slug 获取文档、统计与点赞、外链分享内容）。端点列表与匿名访问规则请参考 [REST API 文档](./minidocs-rest-api.md)。

## 类型定义

### KnowledgeBase

```json
{
  "metadata": {
    "name": "kb-abc",
    "creationTimestamp": "2026-08-01T10:00:00Z"
  },
  "spec": {
    "displayName": "产品手册",
    "description": "公司内部产品文档",
    "publicVisible": true,
    "members": ["alice", "bob"],
    "tags": ["产品", "对外"],
    "priority": 0,
    "creatorName": "admin",
    "logo": "https://example.com/logo.png",
    "cover": "https://example.com/cover.png",
    "creationTime": "2026-08-01T10:00:00Z",
    "updateTime": "2026-08-20T09:00:00Z",
    "accessCount": 8,
    "likeCount": 1,
    "likedUsers": ["admin"],
    "shareEnabled": true,
    "shareToken": "a1B2c3D4e5F6",
    "sharePassword": "",
    "shareExpiresAt": null
  },
  "status": {
    "docCount": 32,
    "lastPublishTime": "2026-08-25T12:00:00Z",
    "kbGrowth": 3,
    "docGrowth": 12
  }
}
```

`status` 为观测状态，由插件异步维护，仅供参考。公开接口仅返回 `publicVisible=true` 的知识库；Finder 返回**当前访问者可访问**的知识库（未登录仅公开，登录含其创建 / 作为成员的私有库）；不可访问时 `getKnowledgeBase` 返回空。

`spec` 补充说明：

- `logo` / `cover`：知识库图标与封面图片地址。
- `accessCount` / `likeCount` / `likedUsers`：访问量、点赞数与已点赞用户名列表（系统维护）。
- `shareEnabled` / `shareToken` / `sharePassword` / `shareExpiresAt`：外链分享设置。开启分享后外链为 `/docs/share/{shareToken}`；`sharePassword` 为空表示无密码访问，`shareExpiresAt` 为空表示永久有效。**注意：主题模板中请勿直接输出 `sharePassword`**；对外渲染分享入口时使用 `/docs/share/{shareToken}` 链接即可。

### KnowledgeBaseDoc

```json
{
  "metadata": {
    "name": "doc-xyz",
    "creationTimestamp": "2026-08-10T08:00:00Z"
  },
  "spec": {
    "knowledgeBaseName": "kb-abc",
    "title": "快速开始",
    "slug": "quick-start",
    "author": "alice",
    "cover": "https://example.com/doc.png",
    "summary": "本文介绍如何快速上手。",
    "creationTime": "2026-08-10T08:00:00Z",
    "updateTime": "2026-08-22T10:00:00Z",
    "raw": "# 快速开始\n...Markdown 原文...",
    "content": "<h1>快速开始</h1>...前端编辑器生成的 HTML...",
    "parentName": null,
    "priority": 0,
    "tags": ["入门"],
    "phase": "published",
    "publishTime": "2026-08-22T10:00:00Z"
  }
}
```

> `raw` 为原始 Markdown（供主题自行渲染或编辑器使用），`content` 为渲染后的 HTML（编辑时由前端 Markdown 编辑器生成并保存，主题可直接 `th:utext` 输出）。`phase` 取值：`draft`、`published`。

### DocTreeNode

```json
{
  "name": "doc-1",
  "title": "入门",
  "slug": "guide",
  "phase": "published",
  "priority": 0,
  "parentName": null,
  "publishTime": "2026-08-20T10:00:00Z",
  "children": [
    {
      "name": "doc-2",
      "title": "安装",
      "slug": "install",
      "phase": "published",
      "priority": 0,
      "parentName": "doc-1",
      "publishTime": "2026-08-21T10:00:00Z",
      "children": []
    }
  ]
}
```

### ListResult\<KnowledgeBase\> / ListResult\<KnowledgeBaseDoc\>

```json
{
  "page": 1,
  "size": 20,
  "total": 42,
  "items": [],
  "first": true,
  "last": false,
  "hasNext": true,
  "hasPrevious": false,
  "totalPages": 3
}
```

分页接口统一返回该结构，主题可使用 `total`、`page`、`size`、`totalPages` 构建分页器。

---

## 注意事项

1. **变量名固定**：模板中必须使用 `${minidocsFinder}`，对应插件 `@Finder("minidocsFinder")`，不要猜测其他名字。插件已内置 `/docs`、`/docs/view/{kbSlug}`、`/docs/share/{shareToken}` 路由与默认模板，主题可用同名模板覆盖，或通过 Finder 自行在任意位置取数渲染。
2. **可见性边界**：Finder 只返回当前访问者**可访问**的内容——未登录仅公开库、登录用户含自己创建 / 是成员（或具备管理权限）的私有库；所有文档仅 `phase=published`。私有库始终只对创建者 / 成员 / 管理者可见，非授权访问在详情 / 文档接口返回空、在列表不出现。外链分享是独立通道，不经 Finder（见路由说明）。
3. **匿名开关**：`allowAnonymousRead=false` 时匿名访问返回 `403`；若公开页面向游客开放，提醒站点管理员开启该设置（插件设置 → 基础设置）。
4. **空值保护**：`getKnowledgeBase` / `getDocBySlug` 在**当前访问者不可访问**或资源不存在时返回空，模板中务必用 `th:if="${xxx != null}"` 判断后再渲染，避免异常。
5. **排序**：知识库与文档按 `spec.priority` 升序返回，文档树亦同；`listKnowledgeBases`（当前用户可访问列表）按最近更新 `spec.updateTime` 倒序。
6. **不要在 Finder 调用里做写操作**：Finder 仅用于读取展示；创建 / 编辑 / 发布等写操作请使用 Console API 或标准 CRUD 端点（需认证与相应角色）。公开页的点赞 / 访问量统计请走公共 API 的 `stats` / `like` / `share/*` 端点（详见 REST API 文档）。
