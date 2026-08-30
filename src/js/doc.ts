// Doc page — knowledge base reader (official MiniDocs template adapted)
// Renders server-rendered HTML, enhances code blocks + mermaid tabs, builds a
// nested accordion TOC with scroll-spy, wires the doc-tree collapse/search,
// resizable columns, like (REST) + view count, share/bookmark, bottom meta.
(function () {
  "use strict";

  const readEl = document.querySelector<HTMLElement>(".md-read");
  const kbSlug: string = (readEl && readEl.getAttribute("data-kb-slug")) || "";
  /* 从当前 URL 实时解析所属知识库 slug：阅读页路由为 /docs/view/{kbSlug}，
     pathname 永远反映「当前正在阅读的库」，避免软切换知识库后仍读旧常量 */
  const kbSlugFromUrl = (): string => {
    const m = location.pathname.match(/\/docs\/view\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : kbSlug;
  };

  /* ===== Toast ===== */
  const toastFn = document.getElementById("md-toast");
  let toastTimer = 0;
  function toast(msg: string): void {
    if (!toastFn) return;
    toastFn.textContent = msg;
    toastFn.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastFn.classList.remove("show"), 1600);
  }

  /* ===== Clipboard ===== */
  function fallbackCopy(text: string): void {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (_) {
      /* ignore */
    }
    document.body.removeChild(ta);
  }
  function copyText(text: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  }

  /* ===== 知识库访问量 / 点赞（匿名可赞，localStorage 去重，一次性） ===== */
  const likeBtn = document.getElementById("md-like");
  const likeCountEl = document.getElementById("md-like-count");
  const viewCountEl = document.getElementById("md-view-count");
  const likeApi = (path: string): string =>
    "/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/" + encodeURIComponent(kbSlug) + path;
  const likeKey = (): string => "minidocs:like:" + kbSlug;
  const locallyLiked = (): boolean => {
    try {
      return localStorage.getItem(likeKey()) === "1";
    } catch (_) {
      return false;
    }
  };
  const setLocallyLiked = (): void => {
    try {
      localStorage.setItem(likeKey(), "1");
    } catch (_) {
      /* ignore */
    }
  };

  const updateLikeUi = (count: number, liked: boolean): void => {
    if (likeCountEl && typeof count === "number") likeCountEl.textContent = String(count);
    if (liked && likeBtn) {
      likeBtn.classList.add("is-liked");
      likeBtn.classList.remove("popping");
      void likeBtn.offsetWidth; // force reflow to restart heartbeat
      likeBtn.classList.add("popping");
    }
  };
  const refreshLikeUi = (data: { likeCount?: number; liked?: boolean } | null): void => {
    if (data && typeof data.likeCount === "number" && likeCountEl) {
      likeCountEl.textContent = String(data.likeCount);
    }
    if (likeBtn) likeBtn.classList.toggle("is-liked", !!data?.liked || locallyLiked());
  };

  if (kbSlug) {
    fetch(likeApi("/stats"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { accessCount?: number; likeCount?: number; liked?: boolean } | null) => {
        if (!data) return;
        refreshLikeUi(data);
        if (viewCountEl && typeof data.accessCount === "number") {
          viewCountEl.textContent = String(data.accessCount);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }
  if (likeBtn && kbSlug) {
    likeBtn.addEventListener("click", () => {
      if (locallyLiked()) {
        toast("该知识库已点赞过了");
        return;
      }
      fetch(likeApi("/like"), { method: "POST", credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error("like failed");
          return r.json();
        })
        .then((data: { likeCount?: number }) => {
          setLocallyLiked();
          updateLikeUi(typeof data.likeCount === "number" ? data.likeCount : 0, true);
          toast("点赞成功");
        })
        .catch(() => toast("点赞失败，请稍后重试"));
    });
  }

  const mainEl = document.getElementById("md-main");

  /* 回到顶部（滚动中间正文容器） */
  const backTop = document.getElementById("md-back-top");
  backTop?.addEventListener("click", () => mainEl?.scrollTo({ top: 0, behavior: "smooth" }));

  /* 搜索文档（按标题过滤树节点） */
  const search = document.getElementById("md-doc-search") as HTMLInputElement | null;
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const links = document.querySelectorAll<HTMLElement>(".md-tree-link");
      let visible = 0;
      links.forEach((a) => {
        const hay = (a.dataset.title || "").toLowerCase();
        const show = hay.indexOf(q) !== -1;
        a.parentElement!.style.display = show ? "" : "none";
        if (show) visible += 1;
      });
      const empty = document.querySelector<HTMLElement>(".md-tree-empty");
      if (empty) empty.style.display = q && !visible ? "" : "none";
    });
  }

  /* 左侧文档树：点击折叠箭头展开/收起（捕获阶段拦截，避免触发链接） */
  const treeRoot = document.querySelector<HTMLElement>(".md-tree");
  treeRoot?.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      const caret = target && target.closest ? target.closest(".md-tree-caret") : null;
      if (!caret) return;
      e.preventDefault();
      e.stopPropagation();
      const li = caret.closest("li.md-has-child");
      if (li) li.classList.toggle("md-fold");
    },
    true,
  );

  const prose = document.getElementById("md-prose");

  /* ===== 无刷新切文章（SPA 局部加载）状态 ===== */
  let currentHeads: HTMLHeadingElement[] = [];
  let currentTocItems: Element[] = [];

  /* scroll-spy 委托：一次性绑定，读取 currentHeads/currentTocItems（每次渲染刷新） */
  const onScrollSpy = (): void => {
    const tocList = document.getElementById("md-toc-list");
    if (!tocList || !currentHeads.length) return;
    let cur: HTMLHeadingElement | null = null;
    /* 判定线与大纲点击滚动偏移(-16)统一并留容差，避免标题滚到顶部下方时高亮停在上一标题 */
    const topBias = mainEl ? mainEl.getBoundingClientRect().top + 20 : 88;
    for (let i = 0; i < currentHeads.length; i++) {
      if (currentHeads[i].getBoundingClientRect().top <= topBias) cur = currentHeads[i];
    }
    const activeId = "#" + (cur ? cur.id : "");
    currentTocItems.forEach((item) => {
      const a = item.querySelector("a");
      item.classList.toggle("active", !!a && a.getAttribute("href") === activeId);
    });
    const activeItem = tocList.querySelector(".md-toc-item.active");
    if (activeItem) {
      let liEl = activeItem.parentElement;
      while (liEl) {
        const pLi = liEl.parentElement ? liEl.parentElement.closest("li") : null;
        if (!pLi) break;
        pLi.classList.remove("toc-fold");
        liEl = pLi;
      }
    }
  };
  mainEl?.addEventListener("scroll", onScrollSpy, { passive: true });
  window.addEventListener("scroll", onScrollSpy, { passive: true });

  /* 文档树：点击「文档链接」整体区域 → 无刷新切换正文（折叠箭头在捕获阶段已被拦截） */
  treeRoot?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    const link =
      target && target.closest
        ? (target.closest<HTMLElement>(".md-tree-link") as HTMLElement | null)
        : null;
    if (!link) return;
    e.preventDefault();
    const slug = link.getAttribute("data-slug") || link.getAttribute("data-name") || "";
    if (!slug) return;
    switchDoc(slug, link);
  });

  if (prose) {
    try {
      enableCherryMermaidTabs();
    } catch (e) {
      console.error("[doc] mermaid tabs failed", e);
    }
    try {
      buildPostRender();
    } catch (e) {
      console.error("[doc] render enhance failed", e);
    }
  }
  formatTimes();

  /* 将 ISO 时间格式化为 yyyy-MM-dd HH:mm:ss（本地时区） */
  function formatDateTime(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const p = (n: number): string => (n < 10 ? "0" : "") + n;
    return (
      d.getFullYear() +
      "-" +
      p(d.getMonth() + 1) +
      "-" +
      p(d.getDate()) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes()) +
      ":" +
      p(d.getSeconds())
    );
  }
  function formatTimes(): void {
    document.querySelectorAll<HTMLElement>(".md-ts[data-ts]").forEach((el) => {
      el.textContent = formatDateTime(el.getAttribute("data-ts") || "");
    });
  }

  function fillBottomMeta(): void {
    const wEl = document.getElementById("md-words");
    const lEl = document.getElementById("md-lines");
    if (!wEl && !lEl) return;
    const text = prose ? prose.innerText || "" : "";
    const words = text.replace(/\s+/g, "").length;
    const lines = text ? text.split(/\n/).length : 0;
    if (wEl) wEl.textContent = String(words);
    if (lEl) lEl.textContent = String(lines);
  }

  /* ===== 分享 / 书签 ===== */
  const shareBtn = document.getElementById("md-share");
  shareBtn?.addEventListener("click", () => {
    copyText(location.href);
    toast("链接已复制");
  });
  const bookmarkBtn = document.getElementById("md-bookmark");
  bookmarkBtn?.addEventListener("click", () => {
    const url = location.href;
    const title = window.document.title || "知识库";
    if (
      window.external &&
      typeof (window.external as unknown as { AddFavorite?: never }).AddFavorite === "function"
    ) {
      try {
        (window.external as unknown as { AddFavorite: (u: string, t: string) => void }).AddFavorite(
          url,
          title,
        );
        toast("已添加到浏览器书签");
        return;
      } catch (_) {
        /* ignore */
      }
    }
    const legacyWin = window as unknown as {
      sidebar?: { addPanel: (title: string, url: string, where: string) => void };
    };
    if (legacyWin.sidebar && legacyWin.sidebar.addPanel) {
      legacyWin.sidebar.addPanel(title, url, "");
      return;
    }
    const mac = navigator.platform && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    toast("当前浏览器不支持自动添加，请按 " + (mac ? "⌘D" : "Ctrl+D") + " 将本页加入浏览器书签");
  });

  /* ============================ 正文渲染（SPA 局部切换） ============================ */

  /* 底部文档路由路径：知识库名 / 树中祖先链 / 文档名 */
  function renderRoute(): void {
    const el = document.getElementById("md-route");
    if (!el) return;
    const activeA = document.querySelector<HTMLElement>(".md-tree-link.active");
    const parts: string[] = [];
    if (activeA) {
      const walk = (a: HTMLElement): void => {
        parts.unshift(a.getAttribute("data-title") || "");
        const li = a.closest("li");
        const pLi = li && li.parentElement ? li.parentElement.closest("li") : null;
        if (pLi) {
          const pa = pLi.querySelector<HTMLElement>(":scope > a");
          if (pa) walk(pa);
        }
      };
      walk(activeA);
    }
    const root = el.getAttribute("data-root") || "";
    const chain = [root].concat(parts).filter((s) => s);
    el.textContent = "";
    chain.forEach((s, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "/";
        el.appendChild(sep);
      }
      const span = document.createElement("span");
      span.textContent = s;
      el.appendChild(span);
    });
    el.setAttribute("title", chain.join(" / "));
  }

  /* 表格：包裹为横向滚动容器，避免正文溢出造成页面横向滚动 */
  function wrapDocTables(): void {
    if (!prose) return;
    prose.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.closest(".md-table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "md-table-wrap";
      table.parentNode?.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  /* 重建正文相关的所有增强（代码块 + 目录 + 底部统计 + 时间 + 路由） */
  function buildPostRender(): void {
    if (!prose) return;

    /* 表格：包裹为横向滚动容器 */
    wrapDocTables();

    /* 代码块：语言标签 + 复制按钮 */
    prose.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
      if (pre.closest(".cherry-mermaid-source-toolbar-panel")) return; // mermaid 源码由 tab 显示
      pre.style.position = "relative";
      const code = pre.querySelector("code");
      if (code) {
        const langMatch = code.className.match(/language-([\w-]+)/);
        if (langMatch) {
          const s = document.createElement("span");
          s.className = "md-lang";
          s.textContent = langMatch[1];
          pre.appendChild(s);
        }
      }
      const btn = document.createElement("button");
      btn.className = "md-copy";
      btn.type = "button";
      btn.textContent = "复制";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        copyText(pre.innerText.replace(/\n{3,}/g, "\n\n"));
        toast("已复制");
      });
      pre.appendChild(btn);
    });

    /* 大纲：为标题生成锚点 + 目录（可反复重建） */
    const cache: Record<string, number> = {};
    const slideId = (text: string): string => {
      const s = String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\u4e00-\u9fa5-]/g, "");
      if (cache[s] != null) {
        cache[s] += 1;
        return s + "-" + cache[s];
      }
      cache[s] = 0;
      return s;
    };

    interface TocItem {
      lvl: number;
      id: string;
      text: string;
      children?: TocItem[];
    }
    const tocList = document.getElementById("md-toc-list");
    const tocRoot = document.getElementById("md-toc");
    const tocHandle = document.querySelector<HTMLElement>(".resize-handle.toc-resize");
    if (tocList) tocList.innerHTML = "";
    if (tocRoot) tocRoot.style.display = "";
    if (tocHandle) tocHandle.style.display = "";

    if (tocList) {
      const heads = Array.from(prose.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6"));
      currentHeads = heads;
      const tree: TocItem[] = [];
      const stack: TocItem[] = [];
      heads.forEach((h) => {
        h.id = h.id || slideId(h.textContent || "");
        const lvl = parseInt(h.tagName.charAt(1), 10);
        const item: TocItem = { lvl: lvl, id: h.id, text: h.textContent || "" };
        while (stack.length && stack[stack.length - 1].lvl >= lvl) stack.pop();
        if (stack.length) {
          const parent = stack[stack.length - 1];
          (parent.children = parent.children || []).push(item);
        } else {
          tree.push(item);
        }
        stack.push(item);
      });

      /* 手风琴：嵌套生成目录，点击分组切换展开/收起 */
      const build = (items: TocItem[], parentList: HTMLElement): void => {
        items.forEach((it) => {
          const li = document.createElement("li");
          const hasKids = !!(it.children && it.children.length);
          const item = document.createElement("div");
          item.className = "md-toc-item";

          if (hasKids) {
            const caret = document.createElement("span");
            caret.className = "md-toc-caret";
            caret.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            item.appendChild(caret);
          } else {
            const spacer = document.createElement("span");
            spacer.className = "md-toc-spacer";
            item.appendChild(spacer);
          }

          const link = document.createElement("a");
          link.href = "#" + it.id;
          link.textContent = it.text;
          link.addEventListener("click", (e) => {
            e.preventDefault();
            const t = document.getElementById(it.id);
            /* 只滚动中间正文容器，不让页面跟着滚（scrollIntoView 会联动滚动 window） */
            if (t && mainEl) {
              const mainRect = mainEl.getBoundingClientRect();
              const tRect = t.getBoundingClientRect();
              const targetTop = mainEl.scrollTop + (tRect.top - mainRect.top) - 16;
              mainEl.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
            }
            history.replaceState(null, "", location.pathname + location.search + "#" + it.id);
          });
          item.appendChild(link);

          // 手风琴：点击分组非链接区域 → 切换子项展开/收起
          item.addEventListener("click", (e) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest && target.closest("a")) return;
            const sub = li.querySelector(":scope > ul");
            if (sub) li.classList.toggle("toc-fold");
          });

          li.appendChild(item);
          parentList.appendChild(li);
          if (hasKids) {
            li.classList.add("toc-fold");
            const childUl = document.createElement("ul");
            li.appendChild(childUl);
            build(it.children!, childUl);
          }
        });
      };
      build(tree, tocList);
      currentTocItems = Array.from(tocList.querySelectorAll(".md-toc-item"));
      if (tocList.children.length === 0) {
        if (tocRoot) tocRoot.style.display = "none";
        if (tocHandle) tocHandle.style.display = "none";
        /* 无标题时隐藏移动端大纲抽屉按钮，避免打开空抽屉 */
        const tocToggle = document.getElementById("md-toggle-toc");
        if (tocToggle) tocToggle.style.display = "none";
      } else {
        const tocToggle = document.getElementById("md-toggle-toc");
        if (tocToggle) tocToggle.style.display = "";
      }
    } else {
      currentHeads = [];
      currentTocItems = [];
    }

    fillBottomMeta();
    formatTimes();
    renderRoute();
  }

  /* 切换文档时刷新底部信息栏（作者/创建/更新时间） */
  function updateDocFooter(
    spec: { author?: unknown; updateTime?: unknown },
    createdTs: string,
  ): void {
    const authorEl = document.querySelector<HTMLElement>("#md-bottom .md-author-text");
    const authorMi = authorEl ? authorEl.closest<HTMLElement>(".md-mi") : null;
    const author = typeof spec.author === "string" ? spec.author : "";
    if (authorEl) authorEl.textContent = author;
    if (authorMi) authorMi.style.display = author ? "" : "none";

    const createdEl = document.getElementById("md-created");
    const createdMi = createdEl ? createdEl.closest<HTMLElement>(".md-mi") : null;
    if (createdEl) {
      createdEl.setAttribute("data-ts", createdTs);
      createdEl.textContent = formatDateTime(createdTs);
    }
    if (createdMi) createdMi.style.display = createdTs ? "" : "none";

    const updatedEl = document.getElementById("md-updated");
    const updatedMi = updatedEl ? updatedEl.closest<HTMLElement>(".md-mi") : null;
    const updatedTs = typeof spec.updateTime === "string" ? spec.updateTime : "";
    if (updatedEl) {
      updatedEl.setAttribute("data-ts", updatedTs);
      updatedEl.textContent = formatDateTime(updatedTs);
    }
    if (updatedMi) updatedMi.style.display = updatedTs ? "" : "none";
  }

  /* 无刷新切换文章：拉取文档 API → 局部更新正文 / 目录 / 底部 / 树高亮 / 地址栏 */
  async function switchDoc(slug: string, link: HTMLElement): Promise<void> {
    const curKb = kbSlugFromUrl();
    if (!curKb || !slug) return;
    const docName = link.getAttribute("data-name") || ""; // metadata.name(UUID)，Console API 定位文档用
    type DocMeta = {
      spec?: Record<string, unknown>;
      metadata?: { creationTimestamp?: string };
    } | null;
    let meta: DocMeta = null;
    try {
      /* 优先公共 API（无需登录）；公共 API 仅服务公开库，私有库返回 404 时改走 Console API（需登录/成员/管理） */
      const r = await fetch(
        "/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/" +
          encodeURIComponent(curKb) +
          "/docs/" +
          encodeURIComponent(slug),
        { credentials: "include" },
      );
      if (r.ok) {
        meta = (await r.json()) as DocMeta;
      } else if (r.status === 404 && docName) {
        const c = await fetch(
          "/apis/console.api.minidocs.halo.run/v1alpha1/knowledgebases/" +
            encodeURIComponent(curKb) +
            "/docs/" +
            encodeURIComponent(docName),
          { credentials: "include" },
        );
        if (c.ok) {
          meta = (await c.json()) as DocMeta;
        } else if (c.status === 401 || c.status === 403) {
          toast("无权限查看该文档，请先登录或确认账号可访问此知识库");
          return;
        }
      }
      const spec = (meta && meta.spec) || null;
      if (!spec) {
        toast("未能获取该文档内容，请稍后重试");
        return;
      }

      /* 正文（#md-prose 常驻容器，仅替换 innerHTML） */
      if (prose) prose.innerHTML = (spec.content as string) || "";

      /* 树高亮 + 展开祖先链，确保新文档可见 */
      document
        .querySelectorAll<HTMLElement>(".md-tree-link.active")
        .forEach((a) => a.classList.remove("active"));
      link.classList.add("active");
      let li = link.closest("li");
      while (li) {
        const p = li.parentElement ? li.parentElement.closest("li") : null;
        if (!p) break;
        p.classList.remove("md-fold");
        li = p;
      }

      /* 重建目录 / 代码块 / 底部统计 / 路由 */
      try {
        buildPostRender();
      } catch (err) {
        console.error("[doc] render enhance failed", err);
      }

      /* 底部作者与时间 */
      updateDocFooter(spec, (meta && meta.metadata && meta.metadata.creationTimestamp) || "");

      /* 页面标题：文档名 - 知识库名 */
      const root = document.getElementById("md-route")?.getAttribute("data-root") || "";
      const title = typeof spec.title === "string" ? spec.title : "";
      document.title = title ? title + " - " + root : "知识库阅读";

      /* 地址栏更新（不刷新页面） */
      const u = new URL(location.href);
      u.searchParams.set("docSlug", slug);
      history.pushState(null, "", u.pathname + u.search);

      /* 通知 plugin-shiki 重新扫描并高亮新插入的代码块（SPA 官方钩子） */
      window.dispatchEvent(new Event("pjax:complete"));

      /* 回到正文顶部 */
      mainEl?.scrollTo({ top: 0 });

      /* 移动端切文后自动收起目录抽屉 */
      if (window.matchMedia("(max-width: 860px)").matches) setDrawer(null);
    } catch (err) {
      console.error("[doc] switch doc failed", err);
      toast("切换失败，请重试");
    }
  }

  /* mermaid 预览/源码 tab（drives cherry-markdown 结构） */
  function enableCherryMermaidTabs(): void {
    if (!prose) return;
    prose.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      const tab =
        target && target.closest
          ? target.closest(".cherry-mermaid-source-toolbar-tab[data-mode]")
          : null;
      if (!tab) return;
      const fig = tab.closest("figure");
      if (!fig) return;
      const mode = tab.getAttribute("data-mode");
      fig.querySelectorAll(".cherry-mermaid-source-toolbar-tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
      });
      fig.querySelectorAll<HTMLElement>(".cherry-mermaid-source-toolbar-panel").forEach((p) => {
        const on = p.getAttribute("data-mode") === mode;
        p.classList.toggle("active", on);
        p.style.display = on ? "block" : "none";
      });
    });
  }

  /* ================= 左右侧边栏拖拽拉宽 ================= */
  type ResizeDir = "left" | "right";
  function initResizer(
    handle: HTMLElement,
    target: HTMLElement,
    dir: ResizeDir,
    min: number,
    max: number,
  ): void {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      handle.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const startX = e.clientX;
      const startW = target.offsetWidth;
      const move = (ev: MouseEvent): void => {
        const delta = dir === "left" ? ev.clientX - startX : startX - ev.clientX;
        let w = startW + delta;
        if (w < min) w = min;
        if (w > max) w = max;
        target.style.width = w + "px";
      };
      const up = (): void => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        handle.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  const sbHandle = document.querySelector<HTMLElement>(".resize-handle.sb-resize");
  const sbEl = document.getElementById("md-sb");
  if (sbHandle && sbEl) initResizer(sbHandle, sbEl, "left", 200, 520);
  const tocHandle = document.querySelector<HTMLElement>(".resize-handle.toc-resize");
  const tocEl = document.getElementById("md-toc");
  if (tocHandle && tocEl) initResizer(tocHandle, tocEl, "right", 170, 480);

  /* ===== 移动端：文档树 / 大纲抽屉 ===== */
  const drawerSb = document.getElementById("md-sb");
  const drawerToc = document.getElementById("md-toc");
  const drawerBackdrop = document.getElementById("md-drawer-backdrop");
  const toggleSb = document.getElementById("md-toggle-sb");
  const toggleToc = document.getElementById("md-toggle-toc");

  function setDrawer(kind: "sb" | "toc" | null): void {
    drawerSb?.classList.toggle("open", kind === "sb");
    drawerToc?.classList.toggle("open", kind === "toc");
    drawerBackdrop?.classList.toggle("show", kind !== null);
    const isMobile = window.matchMedia("(max-width: 860px)").matches;
    if (isMobile) document.body.style.overflow = kind ? "hidden" : "";
    if (toggleSb)
      toggleSb.setAttribute(
        "aria-label",
        kind === "sb" ? "关闭文档目录" : "打开文档目录",
      );
    if (toggleToc)
      toggleToc.setAttribute(
        "aria-label",
        kind === "toc" ? "关闭文章大纲" : "打开文章大纲",
      );
  }

  // 记录当前打开的抽屉（供切文/大纲点击后自动收起）
  const drawerKind = (): "sb" | "toc" | null => {
    if (drawerSb?.classList.contains("open")) return "sb";
    if (drawerToc?.classList.contains("open")) return "toc";
    return null;
  };

  toggleSb?.addEventListener("click", () => {
    setDrawer(drawerKind() === "sb" ? null : "sb");
  });
  toggleToc?.addEventListener("click", () => {
    setDrawer(drawerKind() === "toc" ? null : "toc");
  });
  drawerBackdrop?.addEventListener("click", () => setDrawer(null));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawerKind()) setDrawer(null);
  });

  /* 大纲抽屉里点击条目跳转后自动收起 */
  const tocListEl = document.getElementById("md-toc-list");
  tocListEl?.addEventListener("click", (e) => {
    if (window.matchMedia("(max-width: 860px)").matches) {
      const a = (e.target as HTMLElement).closest("a");
      if (a && drawerKind() === "toc") setDrawer(null);
    }
  });

  /* ===== 文档图片灯箱（放大缩小 / 拖动平移 / 双击复位 / 触摸缩放） ===== */
  function initImageLightbox(): void {
    const content = document.getElementById("md-prose");
    if (!content) return;

    const viewer = document.createElement("div");
    viewer.className = "image-viewer md-image-viewer";
    viewer.innerHTML =
      '<div class="md-iv-toolbar" role="toolbar" aria-label="图片查看工具">' +
      '<button type="button" data-act="out" title="缩小" aria-label="缩小"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>' +
      '<button type="button" data-act="in" title="放大" aria-label="放大"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg></button>' +
      '<button type="button" data-act="reset" title="复位" aria-label="复位缩放"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg></button>' +
      '<span class="iv-sep"></span>' +
      '<button type="button" class="iv-close" data-act="close" title="关闭" aria-label="关闭图片查看"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' +
      "</div>" +
      '<div class="image-viewer-tip">滚轮 / 双指缩放 · 拖动平移 · 双击复位 · 点击关闭</div>';
    const img = document.createElement("img");
    img.alt = "";
    viewer.appendChild(img);
    document.body.appendChild(viewer);

    const MIN = 0.5;
    const MAX = 6;
    let scale = 1;
    let x = 0;
    let y = 0;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startTX = 0;
    let startTY = 0;
    /* 触摸缩放：记录活动指针与起始距离 */
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let pinchScale = 1;

    function applyTransform(): void {
      img.style.transform = "translate(" + x + "px, " + y + "px) scale(" + scale + ")";
    }
    function resetView(): void {
      scale = 1;
      x = 0;
      y = 0;
      applyTransform();
    }
    function zoomBy(factor: number, cx?: number, cy?: number): void {
      const prev = scale;
      scale = Math.min(MAX, Math.max(MIN, scale * factor));
      const k = scale / prev;
      if (cx != null && cy != null) {
        // 以指针/光标为缩放中心，避免焦点漂移
        x = cx - (cx - x) * k;
        y = cy - (cy - y) * k;
      }
      applyTransform();
    }

    function open(src: string): void {
      img.src = src;
      resetView();
      viewer.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close(): void {
      viewer.classList.remove("open");
      document.body.style.overflow = "";
      pointers.clear();
    }

    /* 点击正文任意图片打开灯箱（委托，SPA 切文后依然生效） */
    content.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      if (target.closest(".cherry-mermaid-source-toolbar-panel")) return;
      const src = (target as HTMLImageElement).currentSrc || (target as HTMLImageElement).src;
      e.preventDefault();
      open(src);
    });

    /* 点击背景/空白关闭；点击图片本身不关闭（拖动过也不关闭） */
    viewer.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".md-iv-toolbar button")) return;
      if (t === img) return;
      if (moved) {
        moved = false;
        return;
      }
      close();
    });

    /* 滚轮缩放：始终以视口居中为基准（transform-origin:center），不随光标偏移 */
    viewer.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    viewer.addEventListener("dblclick", (e) => {
      e.preventDefault();
      resetView();
    });

    /* 工具栏按钮 */
    viewer.querySelectorAll<HTMLElement>(".md-iv-toolbar button[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "in") zoomBy(1.3);
        else if (act === "out") zoomBy(1 / 1.3);
        else if (act === "reset") resetView();
        else if (act === "close") close();
      });
    });

    /* 指针事件：统一鼠标 / 触控（单手拖动、双指缩放） */
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
      Math.hypot(a.x - b.x, a.y - b.y);

    viewer.addEventListener("pointerdown", (e) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        startTX = x;
        startTY = y;
      } else if (pointers.size === 2) {
        dragging = false;
        const [a, b] = Array.from(pointers.values());
        pinchDist = dist(a, b);
        pinchScale = scale;
      }
    });
    viewer.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const [a, b] = pts;
        const d = dist(a, b);
        if (pinchDist) {
          const next = Math.min(MAX, Math.max(MIN, pinchScale * (d / pinchDist)));
          const k = next / scale;
          scale = next;
          // 两指中点缩放
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          const rect = viewer.getBoundingClientRect();
          x = cx - rect.left - (cx - rect.left - x) * k;
          y = cy - rect.top - (cy - rect.top - y) * k;
          applyTransform();
        }
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      x = startTX + dx;
      y = startTY + dy;
      applyTransform();
    });
    const releasePointer = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) dragging = false;
    };
    viewer.addEventListener("pointerup", releasePointer);
    viewer.addEventListener("pointercancel", releasePointer);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && viewer.classList.contains("open")) close();
    });
  }
  initImageLightbox();
})();
