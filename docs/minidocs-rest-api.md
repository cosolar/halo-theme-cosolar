# REST API 文档

本文档介绍 MiniDocs 插件提供的 REST API，包括公共 API、Console API 和 Halo 标准 Extension CRUD 端点。

插件 API 组：

- 公共 API：`api.minidocs.halo.run/v1alpha1`
- Console API：`console.api.minidocs.halo.run/v1alpha1`
- 标准 CRUD：`minidocs.halo.run/v1alpha1`

## 公共 API

此插件提供了一组位于 `api.minidocs.halo.run/v1alpha1` 的公共 JSON API，用于查询知识库及其文档、统计点赞、以及访问外链分享内容，可供主题前端、小程序或服务端集成。

本组 API 的可见性规则与 Console 管理端 / Finder 保持一致：**私有知识库仅「创建者、`spec.members` 成员、具备知识库管理权限的用户」在登录后可访问**；其余请求一律返回 `404`（不泄露私有库是否存在），未登录访问公开库还受「匿名阅读开关」约束。

### 端点列表

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases` | `GET` | 分页列出知识库：未登录仅公开库，已登录额外包含自己有权限访问的私有库（创建者/成员/管理）；支持 `keyword`、`page`、`size` |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}` | `GET` | 获取单个知识库详情：公开库，或已登录且有权限的私有库；无权返回 `404` |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}/tree` | `GET` | 获取知识库文档树：公开库仅已发布；已登录且有权限的私有库含草稿（递归嵌套） |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}/docs` | `GET` | 分页列出文档：公开库仅已发布；已登录且有权限的私有库含草稿；支持 `keyword`、`page`、`size` |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}/docs/{docSlug}` | `GET` | 获取单篇文档（详见下文「单篇文档读取的权限语义」） |
| `/apis/api.minidocs.halo.run/v1alpha1/docs/{docSlug}` | `GET` | 全局按 `docSlug`（或 `metadata.name`）获取文档（公开库已发布，或已登录且有权限的私有库任意阶段） |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}/stats` | `GET` | 获取知识库访问量 / 点赞统计（公开库，或当前用户可访问的私有库） |
| `/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/{kbSlug}/like` | `POST` | 知识库点赞（一次性幂等，匿名也可点赞） |
| `/apis/api.minidocs.halo.run/v1alpha1/share/{shareToken}/stats` | `GET` | 分享外链的访问量 / 点赞统计（仅需有效外链，不要求公开或登录） |
| `/apis/api.minidocs.halo.run/v1alpha1/share/{shareToken}/like` | `POST` | 分享外链点赞（一次性幂等，无需登录） |

> 路径约定：知识库标识 `{kbSlug}` 兼容 `metadata.name` 或 `spec.slug`（经 `getBySlugOrName` 解析）；文档标识 `{docSlug}` 通常按 `spec.slug` 定位——**当已登录用户对知识库有访问权限时，文档标识同样兼容 `metadata.name`**（单篇与全局文档读取端点均适用）。`{shareToken}` 为知识库的外链分享标识（`spec.shareToken`，开启分享时由系统生成的 12 位随机串）。

### 统计与点赞

- `GET /knowledgebases/{kbSlug}/stats`：返回 `accessCount`（访问量）、`likeCount`（点赞数）、`liked`（**当前登录用户**是否已点赞，匿名恒为 `false`）。允许访问「公开知识库」或「当前用户有权限访问的私有知识库」；匿名访问公开库需站点开启匿名阅读。
- `POST /knowledgebases/{kbSlug}/like`：点赞（幂等，重复调用不会叠加、点赞后不可取消）。已登录用户由服务端按用户名去重；匿名用户由前端 `localStorage` 缓存防止重复点赞。返回 `{"likeCount": n, "liked": true, "newLike": true|false}`。

```bash
# 查询统计
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/kb-abc/stats"
# → {"accessCount":128,"likeCount":7,"liked":false}

# 点赞（幂等）
curl -X POST -b "session-cookie" \
  "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/kb-abc/like"
# → {"likeCount":8,"liked":true,"newLike":true}
```

#### 点赞响应字段 `newLike`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `likeCount` | `number` | 服务端返回的最新点赞数（可直接覆盖前端数字，无需本地 +1 累加） |
| `liked` | `boolean` | 当前请求者是否已点赞。点赞成功后恒为 `true`（点赞不可取消）——**不要用它判断"本次是不是新点赞"** |
| `newLike` | `boolean` | 本次请求是否**实际新增**了一次点赞：`true` 表示 `likeCount` 确实 +1；`false` 表示命中幂等（该登录用户已在 `spec.likedUsers` 中），本次**没有** +1、没有取消，返回的只是当前值 |

`newLike` 的用意：点赞接口是「幂等写」——重复提交既不会叠加也不会报错，仅凭 `likeCount` 无法区分"这次真加了一分"还是"只是查了当前值"。它用于让调用方区分三种结果：

- 首次点赞 → `newLike: true`：播放点赞动效、提示"点赞成功"。
- 已点过赞再次提交 → `newLike: false`：仅把按钮置为已点赞态，提示"已经点过赞了"，避免重复计数与误导性动效。
- 旧版本服务端 / 兼容场景 → 字段缺失：调用方应按「新增」处理（前端兜底 `data.newLike !== false`），保持向后兼容。

调用方推荐用法（浏览器端）：

```js
fetch('/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/'
    + encodeURIComponent(kbSlug) + '/like', { method: 'POST', credentials: 'include' })
  .then(r => { if (!r.ok) throw r; return r.json(); })
  .then(data => {
    const isNew = data.newLike !== false;          // 字段缺失时按新增兼容
    badge.textContent = data.likeCount;             // 用服务端返回值覆盖，不要本地累加
    btn.classList.add('active');                    // liked 恒为 true，统一置为已点赞
    toast(isNew ? '点赞成功' : '该知识库已经点过赞了');
  });
```

注意事项：

- **匿名用户（未登录）**服务端不写入 `spec.likedUsers`（无法区分访客身份），因此匿名重复调用会始终返回 `newLike: true` 且真实 +1。前端必须自行用 `localStorage`（如键 `minidocs:like:{kbSlug}`）去重后再发起请求，否则刷新 / 多标签会重复计数。
- 建议先读 `GET .../stats` 的 `liked` 决定按钮初始态，再由 `POST .../like` 的 `newLike` 决定本次反馈文案；两者配合即可完整覆盖"已点赞用户的页面初始化"与"点击后的即时反馈"。
- `share/{shareToken}/like` 返回结构与上述完全一致（同为 `likeOnce` 实现），`newLike` 语义相同；`share/{shareToken}/stats` 只返回 `accessCount` / `likeCount` / `liked`，**不含** `newLike`。

### 分享外链 API（不走常规权限）

知识库开启「外链分享」后（Console 分享设置），会生成一条固定外链 `GET /docs/share/{shareToken}`。分享链路的 API 端点**不要求知识库公开、不要求登录**——即便是不公开的私有知识库，只要持有有效外链即可访问：

- `GET /share/{shareToken}/stats` / `POST /share/{shareToken}/like`：行为与上文 stats / like 一致，但按 `shareToken` 解析知识库。
- 服务端做**分享级校验**：
  - 分享已开启（`spec.shareEnabled=true`）且未过期（`spec.shareExpiresAt`），否则返回 `404`；
  - 若设置了访问密码（`spec.sharePassword`），请求需携带通过分享页密码验证后下发的 HttpOnly 访问 cookie，否则返回 `403`（需要访问密码）。
- 分享页本身（`GET /docs/share/{shareToken}?docSlug=xxx`）由插件直接渲染完整阅读页（`doc_share.html`），无需调用上述 API 即可浏览文档；stats / like 端点供分享页展示访问量与点赞交互使用。
- 分享无次数、无人数上限；关闭分享后外链立即失效，重新开启沿用原 `shareToken`（外链地址不变）。

### 匿名访问说明

公共 API 对**未登录访客**仅暴露 `publicVisible=true` 的知识库及其 `phase=published` 的文档（分享链路除外，见上文）；已登录用户按其资源权限还可访问自己有权限的私有库（见下文「可见性语义」）。是否允许匿名读取由插件基础设置项 `allowAnonymousRead`（`settings.yaml` 中 `basic.allowAnonymousRead`）控制，由 `BasicSetting.anonymousReadEnabled()` 方法判断（字段为 `null` 时兜底为开启）：

- 设置为 `true`（或字段缺失为空）时，匿名用户可直接访问上述查询接口。
- 设置为 `false` 时，未登录访问查询接口会被服务层二次校验拦截并返回 `403`，已登录用户仍可正常访问。

> 注意：`settings.yaml` 中 `basic.allowAnonymousRead` 的默认值当前为 `false`（即默认关闭匿名阅读）；`anonymousReadEnabled()` 仅在字段为 `null` 时兜底为开启。站点管理员需在「插件设置 → 基础设置」中显式开启后方可对游客开放。

> 匿名角色已聚合授予 `stats` / `like` / `share` 子资源权限（见下文角色说明），因此匿名访客在阅读页与分享页可正常完成统计查询与点赞交互；数据可见范围仍受各端点的业务校验（公开 / 成员 / 分享校验）约束。

因此主题在调用公共 API 时应处理 `403`：引导用户登录，或提示站点管理员开启匿名阅读。查询接口只授予读取权限；点赞端点为受控写操作（幂等、每用户一次），不提供创建、修改或删除知识库 / 文档的匿名能力。

### 可见性语义

本组公共 API 的详情 / 文档树 / 文档列表 / 单篇文档 / 全局文档读取端点统一遵循以下规则，与 Console 管理端、Finder 保持一致：

| 访问者 | 知识库 | 文档阶段 | 详情 / 树 / 列表 / 文档 |
| --- | --- | --- | --- |
| 未登录 | 公开库 | 仅 `published` | 均可访问；受「匿名阅读开关」约束（关闭时返回 `403`） |
| 未登录 | 私有库 | 任意 | 一律返回 `404`（不泄露私有库是否存在） |
| 已登录且有权限（创建者 / `spec.members` 成员 / 知识库管理者） | 私有库 | `draft` + `published` | 均可访问，**含草稿**；文档标识兼容 `metadata.name` 与 `spec.slug` |
| 已登录但对该库无权限 | 私有库 | 任意 | 一律返回 `404` |
| 已登录 | 公开库 | 仅 `published` | 同未登录，草稿不对外 |

要点：

- **知识库列表** `GET /knowledgebases`：未登录仅列出公开库；已登录额外列出当前用户**可访问**的私有库（创建者 / 成员 / 管理）。
- **单篇文档** `GET /knowledgebases/{kbSlug}/docs/{docSlug}`：已登录且有权限时，文档标识（`{docSlug}`）兼容 `metadata.name` 或 `spec.slug`。
- **全局文档** `GET /docs/{docSlug}`：先按 `metadata.name`（或 `spec.slug`）解析文档，再校验其所属知识库的可见性（公开库，或当前登录用户有权限的私有库）。
- 分享链路端点（`share/{shareToken}/stats`、`like`）**不**受上述规则约束，详见上文「分享外链 API」。

```bash
# 未登录 / 无权限：读取私有库文档 → 404
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/kb-private/docs/anonymous"

# 已登录且有权限：按 name 读取私有库草稿文档
curl -b "session-cookie" "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/KB20260828161535738577/docs/DOC20260827104410b83e0f"
```

### 分页与排序说明

列表端点支持通过 `page`、`size` 查询参数分页，`page` 从 `1` 开始，默认 `size=20`。

排序字段为 `spec.priority`，值越小越靠前；知识库与文档均按 `spec.priority`、`metadata.name` 升序排列。公开 API 暂未开放 `sort` 参数自定义，统一按上述规则返回。

Console API 的 `GET /knowledgebases` 额外支持 `sortBy` 查询参数，可选值：`updateTime`（默认，按 `updateTime` 倒序）、`name`（按 `displayName` 升序）、`priority`（按 `priority` 升序）、`createTime`（按 `creationTime` 倒序）、`docCount`（按文档数倒序）。`sortBy` 仅作用于管理后台的知识库列表，不影响文档列表与公开 API。

### 请求示例

```bash
# 列出公开知识库
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases?size=20"

# 获取单个知识库
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/kb-abc"

# 获取文档树
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/kb-abc/tree"

# 按 slug 获取文档
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/docs/quick-start"

# 分享外链统计（无需登录）
curl "https://your-halo-site/apis/api.minidocs.halo.run/v1alpha1/share/{shareToken}/stats"
```

## Console API（需要认证）

Console API 位于 `console.api.minidocs.halo.run/v1alpha1`，供 Console 前端与登录用户使用，需要登录认证，且受 Halo RBAC 角色（见下文）约束。

### 端点列表

#### 知识库（`KnowledgeBaseConsoleEndpoint`）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/stats` | `GET` | 聚合当前用户**可访问**的知识库/文档统计（总数、公开/私有数、文档数、月度环比 `kbGrowth`/`docGrowth`、公开占比 `publicRatio`）；仅统计当前用户有权限访问的资源，避免向普通用户泄露私有库数量 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/settings` | `GET` | 返回 `{ "codeBlockTheme": "…" }`，供 Markdown 编辑器读取代码块高亮主题（不依赖 Halo 超管专属的 `/json-config` 接口） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases` | `GET` | 分页列出知识库；支持 `keyword`、`publicVisible`、`page`、`size`、`sortBy` |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}` | `GET` | 获取单个知识库（含私有） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases` | `POST` | 创建知识库 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}` | `PUT` | 整体更新知识库 `spec` |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}` | `DELETE` | 删除知识库（级联删除其下文档） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/import` | `POST` | 批量导入整个知识库（multipart ZIP 上传，创建新知识库及其文档） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/import/preview` | `POST` | 导入预览（multipart ZIP 上传，仅解析并返回待导入内容清单，不写入） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/export` | `POST` | 批量导出知识库为 ZIP（JSON body `{ "names": [...] }`，受基础设置项 `allowDocExport` 约束） |

> 路径中的 `{name}` 支持知识库的 `metadata.name` 或 `spec.slug`（经 `getBySlugOrName` 解析）。

#### 文档（`KnowledgeBaseDocConsoleEndpoint`）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs` | `GET` | 分页列出文档；支持 `keyword`、`phase`、`page`、`size` |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/tree` | `GET` | 获取文档树（含草稿等全部状态） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}` | `GET` | 获取单篇文档 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs` | `POST` | 创建文档 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}` | `PUT` | 整体更新文档 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}` | `DELETE` | 删除文档（级联删除子树） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/import` | `POST` | 批量导入（multipart 文件上传） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}/publish` | `POST` | 发布文档（`phase` → `published`） |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}/move` | `POST` | 移动 / 排序文档 |
| `/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/{name}/docs/{docName}/export` | `GET` | 导出 Markdown（受 `allowDocExport` 约束） |

### 角色与权限说明

插件在 `roleTemplate.yaml` 中内置角色模板，Console API 的访问受 Halo RBAC 控制：

| 角色模板 | 显示名 | 权限范围 |
| --- | --- | --- |
| `role-template-minidocs-view` | 知识库查看 | 对 `knowledgebases` / `knowledgebasedocs` 及其子资源的 `get` / `list` |
| `role-template-minidocs-manage` | 知识库管理 | 在 view 基础上增加 `create` / `update` / `patch` / `delete` 等写权限；依赖 view；并授权 `api.console.halo.run` 与内核组的 `users` 只读（`get` / `list`）供成员选择器，以及 `console.api.storage.halo.run` 的 `attachments/upload`（`create`）供本地图片/封面上传 |
| `role-template-minidocs-anonymous` | （隐藏） | 聚合到 Halo 匿名用户，授权 `api.minidocs.halo.run` 公共 API：知识库 / 文档 / 文档树的只读（`get` / `list`），以及统计查询（`knowledgebases/stats`、`share/stats`）与点赞（`knowledgebases/like`、`share/like` 的 `create`）；不出现在角色分配界面 |

匿名用户不会获得 view / manage 角色，但会被聚合授予 `role-template-minidocs-anonymous` 以访问公共 API；未登录访问 Console API 会被 Halo 网关拦截返回 `401` / `403`。主题若在已登录会话下调用写操作，需确保用户已被授予「知识库管理」角色，否则返回 `403`。

#### 私有知识库的资源级访问控制

除 RBAC 角色外，插件对所有涉及具体知识库的 Console 端点（列表、详情、更新、删除、文档 CRUD、导入、导出、统计）执行**资源级可见性校验**：

- 私有知识库（`publicVisible=false`）仅 **该库的创建者、`spec.members` 名单中的成员**，或具备**知识库管理权限**的用户可访问；不满足时详情 / 更新 / 删除 / 文档操作返回 `403`，列表接口会直接过滤掉无权项。
- 管理豁免采用**严格白名单**：仅 **Halo 超级管理员（`role_super-` 前缀权限）** 或持有 **本插件前缀权限点 `plugin:halo-plugin-minidocs:knowledgebase:*`**（对应「知识库管理」角色）的用户视为管理者。用户即便持有其它模块（附件、文章、评论等）以 `-manage` 结尾的权限，也不视为知识库管理者，无法读取不属于自己的私有库。

> 因此：要让某登录用户读取某个私有库，管理员应将该用户名加入该库 `spec.members`（私有库「成员（可访问者）」配置）；或直接为其授予「知识库管理」角色使它可管理全部知识库。**另一种对外方式是开启「外链分享」**：不受成员 / 登录约束，任何持有外链的访客均可查看（可另加访问密码与有效期）。

### 写操作请求体

创建 / 更新知识库（`POST` / `PUT /knowledgebases/{name}`）请求体为 `KnowledgeBase` JSON，`metadata.name` 创建时可省略，由服务端生成；更新时路径 `{name}` 支持 `metadata.name` 或 `spec.slug`。`spec` 主要字段：

- `displayName`（必填）：知识库名称，最长 100 字符。
- `slug`（可选）：链接别名（URL 友好标识，下文称 `kbSlug`），留空时系统自动生成；用于前台 `/docs/view/{kbSlug}` 等路由。
- `description` / `logo` / `cover`：描述、图标地址、封面图地址。
- `publicVisible`：是否公开可见，默认 `false`。
- `members`：私有知识库可访问的成员用户名列表。
- `tags`：标签列表。
- `priority`：排序权重，越小越靠前。
- `creatorName` / `creationTime` / `updateTime`：创建人、创建时间、最后更新时间（时间字段系统自动写入）。
- `accessCount` / `likeCount` / `likedUsers`：访问量、点赞数与已点赞用户列表（由系统维护，更新时无需提交、服务端保留旧值）。
- `shareEnabled` / `shareToken` / `sharePassword` / `shareExpiresAt`：外链分享设置（详见下文）。

```json
{
  "spec": {
    "displayName": "我的知识库",
    "slug": "my-kb",
    "description": "由主题端创建的投稿知识库",
    "cover": "https://example.com/cover.png",
    "publicVisible": false,
    "tags": ["投稿"]
  }
}
```

#### 外链分享设置

分享字段通过 `PUT /knowledgebases/{name}` 与普通字段一并提交，更新语义如下：

| 提交情况 | 行为 |
| --- | --- |
| `shareEnabled=true` | 开启分享；`shareToken` 缺省时系统自动生成（12 位随机串），已有 token 沿用；`sharePassword` / `shareExpiresAt` 以提交值为准 |
| `shareEnabled=false` | 关闭分享，外链立即失效；**保留** token / 密码 / 有效期，重新开启后沿用原外链 |
| 字段缺省（`null`） | 完全不动分享设置（普通编辑知识库不会误关已开启的分享） |

- `sharePassword` 为空表示无密码访问；设置后访客需在分享页输入密码，验证通过后服务端下发 HttpOnly 访问 cookie，后续访问免密。
- `shareExpiresAt` 为空表示永久有效；过期后外链返回 `404`。
- 外链形式：`/docs/share/{shareToken}`，私有 / 公开知识库均可分享，不受成员与登录约束。

```json
{
  "spec": {
    "displayName": "我的知识库",
    "shareEnabled": true,
    "sharePassword": "1234",
    "shareExpiresAt": "2026-09-28T00:00:00Z"
  }
}
```

创建文档（`POST /knowledgebases/{name}/docs`）请求体为 `KnowledgeBaseDoc` JSON，`spec.phase` 默认草稿（`draft`）。`spec` 主要字段：`knowledgeBaseName`（必填，所属知识库名）、`title`（必填）、`slug`、`author`、`cover`、`summary`、`raw`（原始 Markdown 文本）、`content`（渲染后的 HTML，由编辑器生成并保存）、`parentName`（父文档名，空为顶级）、`priority`、`tags`、`phase`：

```json
{
  "spec": {
    "title": "第一篇投稿",
    "slug": "my-first-post",
    "raw": "# 标题\n正文内容…",
    "phase": "draft"
  }
}
```

移动 / 排序文档（`POST /docs/{docName}/move`）请求体字段均可选：

```json
{
  "parentName": "doc-parent",
  "priority": 2,
  "beforeName": null,
  "afterName": "doc-sibling"
}
```

- `parentName`：新父文档名（`null` / 缺省表示移到顶级）。
- `priority`：同级排序权重；同时传 `beforeName` / `afterName` 时按插入到目标之前 / 之后重排兄弟节点。
- 服务端校验不能移动到自身或其子文档下，否则返回 `400`。

### 导出说明

知识库级导出（`POST /knowledgebases/export`）请求体为 JSON，接收知识库名称数组，将选中知识库（含其文档）打包为 ZIP 返回：

```json
{
  "names": ["kb-abc", "kb-def"]
}
```

> 路径 `/knowledgebases/export` 接受 `names` 数组（支持 `metadata.name` 或 `spec.slug`），可一次导出多个知识库。

若插件设置「允许导出文档」（`allowDocExport`，由 `BasicSetting.docExportEnabled()` 判断，默认 `true`）关闭，批量 `export` 接口与 Console 导出入口、以及单篇文档 `GET /docs/{docName}/export` 均返回 `403`。

### 导入说明

知识库级导入（`POST /knowledgebases/import`，multipart 表单）除上传的 ZIP 文件（`file` 字段）外，还支持 `strategy` 表单字段控制同名冲突策略：

- `overwrite`（默认）：**安全覆盖**——先将导入内容完整写入一个临时知识库并校验文档数量与 ZIP 一致，全部成功后才替换原来的同名知识库；若中途（建库 / 导入文档 / 恢复父子关系 / 更新统计）任一步失败，自动删除临时数据并回滚，**原始数据保持不变**，不会出现"原库已删、新库未成"的不可恢复丢失。
- `skip`：已存在则跳过，仅创建不存在的部分。

导入结果会返回每个知识库的成功 / 失败与提示信息；发生部分失败（如某个知识库导入中途出错）时，该知识库回滚、其余成功完成，前端会给出明确的失败与已回滚提示。

导入预览（`POST /knowledgebases/import/preview`）仅解析 ZIP 并返回待导入清单（知识库与文档元信息），不写入数据，便于前端确认冲突与数量。文档级导入（`POST /knowledgebases/{name}/docs/import`，multipart 文件上传）复用相同策略逻辑。

## 标准 CRUD 端点（需要认证）

知识库与文档资源还可通过 Halo 标准 Extension CRUD 端点操作：

| 端点 | 说明 |
| --- | --- |
| `/apis/minidocs.halo.run/v1alpha1/knowledgebases` | `KnowledgeBase` 资源标准 CRUD |
| `/apis/minidocs.halo.run/v1alpha1/knowledgebasedocs` | `KnowledgeBaseDoc` 资源标准 CRUD |

标准 CRUD 端点同样受 Halo RBAC 控制，需要具有相应权限的已登录用户访问。

## 错误与状态码

| 状态码 | 含义 |
| --- | --- |
| `200` | 成功 |
| `201` | 创建成功（写操作） |
| `400` | 请求参数错误（如移动到非法父节点、导入文件解析失败） |
| `401` / `403` | 未登录 / 无权限（匿名阅读关闭或未授予角色、导出被设置禁用、分享链接设置了访问密码但未通过验证） |
| `404` | 知识库或文档不存在（含非公开知识库、slug 无法解析、分享链接不存在 / 已关闭 / 已过期） |
| `409` | 资源冲突（如导入 `strategy=skip` 时同名知识库已存在） |

Halo 使用 `application/problem+json` 返回结构化错误，客户端可读取 `status` 与 `type` 做程序判断，`detail` 作为可展示文案。

> 更多主题侧用法（模板变量与 Finder）请参考 [主题 API 文档](./minidocs-theme-api.md)。
