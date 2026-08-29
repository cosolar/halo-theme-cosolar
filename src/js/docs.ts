// Docs page — knowledge base list (official MiniDocs template adapted)
// Server-renders cards once, then drives dashboard stats, sidebar (recent
// updates / tag cloud / today's activity + contributors), search / sort /
// pagination / view toggle, and per-card like (REST + localStorage dedupe).
(() => {
  "use strict";

  const grid = document.getElementById("md-grid");
  if (!grid) return;

  interface KbCard {
    el: HTMLElement;
    search: string;
    tags: string[];
    owner: string;
    name: string;
    slug: string;
    docs: number;
    access: number;
    like: number;
    update: number;
    created: number;
    href: string;
    title: string;
  }

  const all = Array.from(grid.querySelectorAll<HTMLElement>(".md-kb-card"));
  const state = { q: "", tag: "", owner: "", sort: "update", page: 1, perPage: 9, view: "card" };

  const PALETTE = [
    "linear-gradient(135deg,#e11d48,#fb7185)",
    "linear-gradient(135deg,#0f766e,#14b8a6)",
    "linear-gradient(135deg,#4f46e5,#818cf8)",
    "linear-gradient(135deg,#0284c7,#38bdf8)",
    "linear-gradient(135deg,#059669,#34d399)",
    "linear-gradient(135deg,#b45309,#f59e0b)",
    "linear-gradient(135deg,#7c3aed,#c084fc)",
    "linear-gradient(135deg,#15803d,#4ade80)",
    "linear-gradient(135deg,#334155,#94a3b8)",
  ];

  function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  const pad = (n: number): string => (n < 10 ? "0" + n : String(n));
  const nowDate = (): Date => new Date();

  /* 准备卡片数据缓存 */
  const cards = all.map<KbCard>((c) => {
    const titleEl = c.querySelector<HTMLElement>(".md-title");
    return {
      el: c,
      search: (c.dataset.search || "").toLowerCase(),
      tags: (c.dataset.tags || "").trim().split(/\s+/).filter(Boolean),
      owner: c.dataset.owner || "",
      name: c.dataset.name || "",
      slug: c.dataset.slug || "",
      docs: parseInt(c.dataset.docs || "0", 10),
      access: parseInt(c.dataset.access || "0", 10),
      like: parseInt(c.dataset.like || "0", 10),
      update: Date.parse(c.dataset.update || "") || 0,
      created: Date.parse(c.dataset.created || "") || 0,
      href: c.getAttribute("href") || "",
      title: titleEl ? titleEl.textContent || "" : "",
    };
  });

  function relTime(iso: string, fallback: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return fallback;
    const now = nowDate();
    if (d.toDateString() === now.toDateString())
      return "今天 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    const yest = new Date(now.getTime() - 86400000);
    if (d.toDateString() === yest.toDateString())
      return "昨天 " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (d.getFullYear() === now.getFullYear())
      return pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }

  /* ---- 点赞（一次性；与阅读页共用 localStorage 键，匿名也可点赞） ---- */
  function likeKey(slug: string): string {
    return "minidocs:like:" + slug;
  }
  function locallyLiked(slug: string): boolean {
    try {
      return localStorage.getItem(likeKey(slug)) === "1";
    } catch {
      return false;
    }
  }
  cards.forEach((card) => {
    const btn = card.el.querySelector<HTMLElement>(".md-like-btn") as HTMLElement | null;
    if (!btn) return;
    const slug = card.el.getAttribute("data-slug") || "";
    if (!slug) return;
    const badge = card.el.querySelector<HTMLElement>(".md-like-badge span");
    function markLiked(): void {
      btn!.classList.add("active");
      btn!.classList.remove("popping");
      void btn!.offsetWidth;
      btn!.classList.add("popping");
    }
    if (locallyLiked(slug)) btn.classList.add("active");
    btn.setAttribute("aria-label", "点赞：" + card.title);
    btn.setAttribute("title", "点赞：" + card.title);
    function doLike(): void {
      if (locallyLiked(slug)) {
        markLiked();
        return;
      }
      fetch(
        "/apis/api.minidocs.halo.run/v1alpha1/knowledgebases/" +
          encodeURIComponent(slug) + "/like",
        { method: "POST", credentials: "include" }
      )
        .then((r) => {
          if (!r.ok) throw 0;
          return r.json();
        })
        .then((data: { likeCount?: number }) => {
          try {
            localStorage.setItem(likeKey(slug), "1");
          } catch {
            /* 忽略隐私模式 */
          }
          markLiked();
          if (data && typeof data.likeCount === "number") {
            if (badge) badge.textContent = String(data.likeCount);
            const stat = document.getElementById("md-stat-new");
            if (stat)
              stat.textContent = String((parseInt(stat.textContent, 10) || 0) + 1);
          }
        })
        .catch(() => {
          /* 点赞失败静默 */
        });
    }
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      doLike();
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        doLike();
      }
    });
  });

  /* 无封面渐变 + 时间 */
  cards.forEach((card) => {
    const staticBg = card.el.querySelector<HTMLElement>(
      ".md-cover-static .md-cover-static-bg"
    );
    if (staticBg)
      staticBg.style.background = PALETTE[hash(card.name || card.search) % PALETTE.length];
    const t = card.el.querySelector<HTMLElement>(".md-time");
    if (t) t.textContent = card.update ? relTime(new Date(card.update).toISOString(), "") : "";
  });

  /* ---- 顶部看板 ---- */
  const totalKb = cards.length;
  const totalDocs = cards.reduce((s, c) => s + c.docs, 0);
  const tagCounter: Record<string, number> = {};
  const ownerCounter: Record<string, number> = {};
  cards.forEach((c) => {
    c.tags.forEach((t) => {
      tagCounter[t] = (tagCounter[t] || 0) + 1;
    });
    if (c.owner) ownerCounter[c.owner] = (ownerCounter[c.owner] || 0) + 1;
  });
  const tagList = Object.keys(tagCounter).sort(
    (a, b) => tagCounter[b] - tagCounter[a] || a.localeCompare(b)
  );
  const ownerList = Object.keys(ownerCounter).sort(
    (a, b) => ownerCounter[b] - ownerCounter[a] || a.localeCompare(b)
  );
  const totalAccess = cards.reduce((s, c) => s + c.access, 0);
  const totalLike = cards.reduce((s, c) => s + c.like, 0);

  const setText = (id: string, txt: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setText("md-stat-kb", String(totalKb));
  setText("md-stat-docs", String(totalDocs));
  setText("md-stat-tags", String(tagList.length));
  setText("md-stat-avg", String(totalAccess));
  setText("md-stat-new", String(totalLike));

  /* 元素引用 */
  const inputEl = document.getElementById("md-search-input") as HTMLInputElement | null;
  const countEl = document.getElementById("md-count");
  const countTotalEl = document.getElementById("md-count-total");
  const emptyEl = document.getElementById("md-empty");
  const emptyBtnEl = document.getElementById("md-empty-reset");
  const listArea = document.getElementById("md-list-area");
  const pagerEl = document.getElementById("md-pager");
  const gridEl = document.getElementById("md-grid");

  /* 侧栏配置：条数限制（服务端注入，缺失时用默认值） */
  const sbEl = document.getElementById("md-sidebar");
  const recentCount = sbEl ? Math.max(1, Number(sbEl.dataset["recentCount"]) || 5) : 5;
  const tagCount = sbEl ? Math.max(1, Number(sbEl.dataset["tagCount"]) || 10) : 10;

  /* ---- 侧栏：标签云 ---- */
  const tagCloud = document.getElementById("sb-tags");
  if (tagCloud) {
    if (!tagList.length) {
      tagCloud.innerHTML = '<div class="sb-empty">暂无标签</div>';
    } else
      tagList.slice(0, tagCount).forEach((tag, i) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-chip";
        chip.style.animationDelay = (i % 12) * 28 + "ms";
        chip.setAttribute("data-tag", tag);
        chip.innerHTML = tag + '<span class="n">' + tagCounter[tag] + "</span>";
        chip.addEventListener("click", () => {
          state.tag = state.tag === tag ? "" : tag;
          state.page = 1;
          document.querySelectorAll(".tag-chip").forEach((b) => {
            b.classList.toggle("active", (b.getAttribute("data-tag") || "") === state.tag);
          });
          render();
        });
        tagCloud.appendChild(chip);
      });
  }

  /* ---- 侧栏：最近更新 ---- */
  const recentEl = document.getElementById("sb-recent");
  if (recentEl) {
    const recent = cards
      .slice()
      .sort((a, b) => b.update - a.update)
      .filter((c) => c.update > 0)
      .slice(0, recentCount);
    if (!recent.length) recentEl.innerHTML = '<div class="sb-empty">暂无数据</div>';
    else
      recent.forEach((c) => {
        const a = document.createElement("a");
        a.className = "sb-item";
        a.href = c.href;
        a.innerHTML =
          '<span class="sb-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>' +
          '<span class="sb-txt">' +
          '<span class="t"></span>' +
          '<span class="m"><i class="live"></i>' +
          c.docs +
          " 篇 · " +
          relTime(new Date(c.update).toISOString(), "") +
          "</span>" +
          "</span>";
        const tEl = a.querySelector<HTMLElement>(".t");
        if (tEl) tEl.textContent = c.title;
        recentEl.appendChild(a);
      });
  }

  /* ---- 侧栏：今日动态（数据 + 贡献者） ---- */
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayCount = cards.filter((c) => c.update >= dayStart.getTime()).length;
  const dynToday = document.getElementById("dyn-today");
  const dynDocs = document.getElementById("dyn-docs");
  if (dynToday) dynToday.textContent = String(todayCount);
  if (dynDocs) dynDocs.textContent = String(totalDocs);

  const tipEl = document.getElementById("welcome-tip");
  if (tipEl) {
    tipEl.innerHTML = todayCount
      ? '今日有 <b style="color:var(--md-c-orange)">' + todayCount + "</b> 个知识库更新，快去逛逛"
      : "今天还没有新动态，去创作一篇吧";
  }

  const ownersEl = document.getElementById("sb-owners");
  if (ownersEl) {
    if (!ownerList.length) ownersEl.innerHTML = '<div class="sb-empty">暂无数据</div>';
    else {
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = "贡献者";
      ownersEl.appendChild(lbl);
      ownerList.forEach((owner, i) => {
        const chip = document.createElement("span");
        chip.className = "owner-chip";
        chip.setAttribute("data-owner", owner);
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        chip.title = owner + " · " + ownerCounter[owner] + " 个知识库";
        const ava = document.createElement("span");
        ava.className = "owner-ava";
        ava.style.background = PALETTE[i % PALETTE.length];
        ava.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        const name = document.createElement("span");
        name.className = "owner-name";
        name.textContent = owner;
        chip.appendChild(ava);
        chip.appendChild(name);
        chip.addEventListener("click", () => {
          state.owner = state.owner === owner ? "" : owner;
          state.page = 1;
          document.querySelectorAll(".owner-chip").forEach((o) => {
            o.classList.toggle(
              "active",
              (o.getAttribute("data-owner") || "") === state.owner
            );
          });
          render();
        });
        ownersEl.appendChild(chip);
      });
    }
  }

  /* ---- 筛选 / 排序 / 分页 ---- */
  function matches(c: KbCard): boolean {
    if (state.q && c.search.indexOf(state.q) === -1) return false;
    if (state.tag && c.tags.indexOf(state.tag) === -1) return false;
    if (state.owner && c.owner !== state.owner) return false;
    return true;
  }
  function sorter(a: KbCard, b: KbCard): number {
    switch (state.sort) {
      case "name":
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      case "docs":
        return b.docs - a.docs;
      case "created":
        return b.created - a.created;
      default:
        return b.update - a.update;
    }
  }

  function render(): void {
    const pool = cards.filter(matches);
    pool.sort(sorter);
    const pages = Math.max(1, Math.ceil(pool.length / state.perPage));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.perPage;
    const shown = pool.slice(start, start + state.perPage);

    cards.forEach((c) => c.el.classList.add("is-hidden"));
    shown.forEach((c) => c.el.classList.remove("is-hidden"));

    const total = pool.length;
    if (countEl) countEl.textContent = String(total);
    if (countTotalEl)
      countTotalEl.textContent = total
        ? start + 1 + "-" + (start + shown.length) + " / " + total
        : "0";
    if (emptyEl) {
      emptyEl.style.display = total ? "none" : "flex";
      if (!total) {
        const t = emptyEl.querySelector<HTMLElement>(".md-empty-text");
        if (t) {
          t.textContent = state.q || state.tag || state.owner
            ? state.tag
              ? "没有找到标签为「" + state.tag + "」的知识库，试试其他标签或清除筛选。"
              : state.owner
                ? "「" + state.owner + "」暂无公开知识库。"
                : "没有找到与「" + (inputEl ? inputEl.value.trim() : "") + "」相关的知识库，换个关键词试试。"
            : "暂无公开知识库，去管理后台创建第一个吧。";
        }
      }
    }
    if (emptyBtnEl)
      emptyBtnEl.style.display =
        state.q || state.tag || state.owner ? "inline-flex" : "none";
    buildPager(pages);
    /* 按当前排序/筛选物理重排卡片节点，使顺序变化在视觉上可见 */
    const order: HTMLElement[] = shown.map((c) => c.el);
    cards.forEach((c) => {
      if (shown.indexOf(c) === -1) order.push(c.el);
    });
    if (emptyEl) order.push(emptyEl);
    if (gridEl)
      order.forEach((el) => {
        gridEl.appendChild(el);
      });
    if (listArea) listArea.scrollTop = 0;
  }

  function buildPager(pages: number): void {
    const buttons: HTMLButtonElement[] = [];
    const cur = state.page;
    const add = (b: HTMLButtonElement): HTMLButtonElement => {
      buttons.push(b);
      return b;
    };
    const nav = (label: string, dir: number, disabled: boolean): void => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = dir < 0 ? "‹" : "›";
      b.setAttribute("aria-label", label);
      if (disabled) b.disabled = true;
      else b.addEventListener("click", () => {
        state.page = cur + dir;
        render();
      });
      add(b);
    };
    const num = (n: number, active: boolean): void => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(n);
      if (active) b.className = "active";
      b.addEventListener("click", () => {
        state.page = n;
        render();
      });
      add(b);
    };
    const sep = (): void => {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "sep";
      s.textContent = "…";
      s.disabled = true;
      add(s);
    };

    nav("上一页", -1, cur <= 1);
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) num(i, i === cur);
    } else {
      num(1, cur === 1);
      if (cur > 3) sep();
      for (let j = Math.max(2, cur - 1); j <= Math.min(pages - 1, cur + 1); j++)
        num(j, j === cur);
      if (cur < pages - 2) sep();
      num(pages, cur === pages);
    }
    nav("下一页", 1, cur >= pages);

    if (pagerEl) {
      pagerEl.innerHTML = "";
      buttons.forEach((b) => pagerEl!.appendChild(b));
    }
  }

  /* 清除全部筛选 */
  function resetFilters(): void {
    state.q = "";
    state.tag = "";
    state.owner = "";
    state.page = 1;
    if (inputEl) inputEl.value = "";
    document.querySelectorAll(".tag-chip").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".owner-chip").forEach((o) => o.classList.remove("active"));
    render();
  }

  /* 搜索 */
  if (inputEl)
    inputEl.addEventListener("input", () => {
      state.q = inputEl!.value.trim().toLowerCase();
      state.page = 1;
      render();
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== inputEl) {
      e.preventDefault();
      if (inputEl) inputEl.focus();
    }
  });

  /* 排序 */
  const sortSel = document.getElementById("md-sort") as HTMLSelectElement | null;
  if (sortSel)
    sortSel.addEventListener("change", (e) => {
      state.sort = (e.target as HTMLSelectElement).value;
      state.page = 1;
      render();
    });

  /* 清除筛选 */
  if (emptyBtnEl) emptyBtnEl.addEventListener("click", resetFilters);

  /* 视图切换 */
  const viewBtns = document.querySelectorAll<HTMLElement>(".md-view button");
  function applyView(v: string): void {
    if (!gridEl) return;
    gridEl.classList.toggle("is-card", v === "card");
    gridEl.classList.toggle("is-list", v === "list");
    viewBtns.forEach((b) =>
      b.classList.toggle("active", b.getAttribute("data-view") === v)
    );
  }
  viewBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.getAttribute("data-view") || "card";
      state.view = v;
      applyView(v);
    });
  });

  render();
})();