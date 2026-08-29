// Doc page — knowledge base reader (official MiniDocs template adapted)
// Renders server-rendered HTML, enhances code blocks + mermaid tabs, builds a
// nested accordion TOC with scroll-spy, wires the doc-tree collapse/search,
// resizable columns, like (REST) + view count, share/bookmark, bottom meta.
(function () {
  "use strict";

  const readEl = document.querySelector<HTMLElement>(".md-read");
  const kbSlug: string = (readEl && readEl.getAttribute("data-kb-slug")) || "";

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
  if (prose) {
    try {
      enhanceProse();
    } catch (e) {
      console.error("[doc] enhanceProse failed", e);
    }
    try {
      enableCherryMermaidTabs();
    } catch (e) {
      console.error("[doc] mermaid tabs failed", e);
    }
    fillBottomMeta();
  }
  formatTimes();

  /* 将 ISO 时间格式化为 yyyy-MM-dd HH:mm:ss（本地时区） */
  function formatDateTime(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const p = (n: number): string => (n < 10 ? "0" : "") + n;
    return (
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
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
    if (window.external && typeof (window.external as unknown as { AddFavorite?: never }).AddFavorite === "function") {
      try {
        (window.external as unknown as { AddFavorite: (u: string, t: string) => void }).AddFavorite(url, title);
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

  /* ===== 正文增强：代码块 + 目录 + 滚动监听 + 路由 ===== */
  function enhanceProse(): void {
    if (!prose) return;

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

    /* 大纲：为标题生成锚点 + 目录 */
    const tocList = document.getElementById("md-toc-list");
    if (!tocList) return;
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
    const heads = prose.querySelectorAll<HTMLHeadingElement>("h1,h2,h3,h4,h5,h6");
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
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
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

    const tocRoot = document.getElementById("md-toc");
    if (tocList.children.length === 0 && tocRoot) tocRoot.style.display = "none";

    /* scroll spy（监听正文滚动容器） */
    const tocItems = tocList.querySelectorAll(".md-toc-item");
    const onScroll = (): void => {
      if (!heads.length) return;
      let cur: HTMLHeadingElement | null = null;
      const topBias = mainEl ? mainEl.getBoundingClientRect().top + 12 : 80;
      for (let i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= topBias) cur = heads[i];
      }
      const activeId = "#" + (cur ? cur.id : "");
      tocItems.forEach((item) => {
        const a = item.querySelector("a");
        item.classList.toggle("active", !!a && a.getAttribute("href") === activeId);
      });
      // 展开 active 标题的祖先链（滚动联动）
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
    mainEl?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* 底部文档路由路径：知识库名 / 树中祖先链 / 文档名 */
    const renderRoute = (): void => {
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
    };
    renderRoute();
  }

  /* mermaid 预览/源码 tab（drives cherry-markdown 结构） */
  function enableCherryMermaidTabs(): void {
    if (!prose) return;
    prose.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      const tab = target && target.closest ? target.closest(".cherry-mermaid-source-toolbar-tab[data-mode]") : null;
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
  function initResizer(handle: HTMLElement, target: HTMLElement, dir: ResizeDir, min: number, max: number): void {
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
})();