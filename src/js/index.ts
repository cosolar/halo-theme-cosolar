// Index page — Featured carousel logic
(function () {
  "use strict";

  const carousel = document.querySelector(".featured-carousel") as HTMLElement | null;
  if (!carousel) return;

  const slides = carousel.querySelectorAll(".carousel-slide");
  const dots = carousel.querySelectorAll(".carousel-dot");
  const prevBtn = carousel.querySelector(".carousel-prev") as HTMLElement | null;
  const nextBtn = carousel.querySelector(".carousel-next") as HTMLElement | null;

  // 根据 featured_max_count 限制实际显示的 slide 数量
  const maxSlides = parseInt(carousel.dataset.maxSlides || "5", 10);
  if (slides.length > maxSlides) {
    slides.forEach((slide, i) => {
      if (i >= maxSlides) {
        (slide as HTMLElement).remove();
      }
    });
  }

  // 重新获取清理后的 slides 列表
  const actualSlides = carousel.querySelectorAll(".carousel-slide");

  // 置顶模式下列表长度可能大于实际 slide 数，移除多余的圆点
  if (dots.length > actualSlides.length) {
    dots.forEach((dot, i) => {
      if (i >= actualSlides.length) {
        (dot as HTMLElement).remove();
      }
    });
  }

  // 实际 slide 数量小于 2 时隐藏箭头
  if (actualSlides.length <= 1) {
    prevBtn?.remove();
    nextBtn?.remove();
    const dotsContainer = carousel.querySelector(".carousel-dots");
    dotsContainer?.remove();
    return;
  }

  // 重新获取清理后的圆点列表
  const actualDots = carousel.querySelectorAll(".carousel-dot");

  const autoplay = carousel.dataset.autoplay === "true";
  const interval = parseInt(carousel.dataset.interval || "5000", 10);
  let currentIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function showSlide(index: number): void {
    currentIndex = (index + actualSlides.length) % actualSlides.length;
    actualSlides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);
    });
    actualDots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });
  }

  function nextSlide(): void {
    showSlide(currentIndex + 1);
  }

  function prevSlide(): void {
    showSlide(currentIndex - 1);
  }

  function startAutoplay(): void {
    if (!autoplay) return;
    stopAutoplay();
    timer = setInterval(nextSlide, interval);
  }

  function stopAutoplay(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Event listeners
  prevBtn?.addEventListener("click", () => {
    prevSlide();
    startAutoplay();
  });

  nextBtn?.addEventListener("click", () => {
    nextSlide();
    startAutoplay();
  });

  actualDots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      showSlide(i);
      startAutoplay();
    });
  });

  // Pause on hover
  carousel.addEventListener("mouseenter", stopAutoplay);
  carousel.addEventListener("mouseleave", startAutoplay);

  // Touch swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener("touchstart", (e: TouchEvent) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoplay();
  });

  carousel.addEventListener("touchend", (e: TouchEvent) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    startAutoplay();
  });

  // Start autoplay
  startAutoplay();
})();

// View Toggle — 列表/卡片视图切换
(function () {
  "use strict";

  const STORAGE_KEY = "cosolar-article-view";
  const articleList = document.querySelector(".article-list") as HTMLElement | null;
  const toggleBtns = document.querySelectorAll(".view-toggle-btn");

  if (!articleList || toggleBtns.length === 0) return;

  const listEl = articleList;

  function setView(view: "list" | "grid"): void {
    toggleBtns.forEach((btn) => {
      const btnView = (btn as HTMLElement).dataset.view;
      btn.classList.toggle("active", btnView === view);
    });

    if (view === "grid") {
      listEl.classList.add("grid-view");
    } else {
      listEl.classList.remove("grid-view");
    }

    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {}
  }

  // 从 localStorage 恢复用户偏好
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "grid") {
    setView("grid");
  }

  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = (btn as HTMLElement).dataset.view as "list" | "grid";
      setView(view);
    });
  });
})();

// Filter Tabs — 文章排序切换（最新/最热/推荐）
// 说明：Halo 的 postFinder.list() sort 参数不支持 stats.visit / stats.upvote 排序字段，
// 因此采用客户端排序方案：从 data-* 属性读取浏览量和点赞数，对当前页 DOM 元素重新排列。
(function () {
  "use strict";

  const STORAGE_KEY = "cosolar-article-sort";
  const articleList = document.querySelector(".article-list") as HTMLElement | null;
  const filterTabs = document.querySelectorAll(".filter-tab");

  if (!articleList || filterTabs.length === 0) return;

  const listEl = articleList;

  type SortMode = "latest" | "hot" | "recommend";

  function sortArticles(mode: SortMode): void {
    const cards = Array.from(listEl.querySelectorAll(".article-card")) as HTMLElement[];

    const sorted = cards.sort((a, b) => {
      switch (mode) {
        case "latest": {
          const ta = a.dataset.time || "0";
          const tb = b.dataset.time || "0";
          return tb.localeCompare(ta);
        }
        case "hot": {
          const va = parseInt(a.dataset.visit || "0", 10);
          const vb = parseInt(b.dataset.visit || "0", 10);
          return vb - va;
        }
        case "recommend": {
          const ua = parseInt(a.dataset.upvote || "0", 10);
          const ub = parseInt(b.dataset.upvote || "0", 10);
          return ub - ua;
        }
        default:
          return 0;
      }
    });

    sorted.forEach((card) => listEl.appendChild(card));

    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }

  function setActiveTab(mode: SortMode): void {
    filterTabs.forEach((tab) => {
      const tabMode = (tab as HTMLElement).dataset.sort;
      tab.classList.toggle("active", tabMode === mode);
    });
  }

  // 从 localStorage 恢复用户偏好
  const saved = localStorage.getItem(STORAGE_KEY) as SortMode | null;
  if (saved && saved !== "latest") {
    setActiveTab(saved);
    sortArticles(saved);
  }

  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = (tab as HTMLElement).dataset.sort as SortMode;
      setActiveTab(mode);
      sortArticles(mode);
    });
  });
})();

// Client-side navigation — 查看更多文章 / 翻页 / 滚动加载（不刷新整页，保留轮播图）
(function () {
  "use strict";

  const contentArea = document.querySelector(".content-area") as HTMLElement | null;
  const articleList = document.querySelector(".article-list") as HTMLElement | null;
  if (!contentArea || !articleList) return;

  // 加载方式：pagination（翻页）或 scroll（滚动加载），由模板 data-load-mode 传入
  const loadMode = contentArea.dataset.loadMode || "pagination";

  // 重新应用当前激活的排序（加载新文章后保持顺序一致）
  function reapplySort(): void {
    const active = contentArea!.querySelector(".filter-tab.active") as HTMLElement | null;
    const mode = (active?.dataset.sort as "latest" | "hot" | "recommend") || "latest";
    if (mode === "latest") return;

    const cards = Array.from(articleList!.querySelectorAll(".article-card")) as HTMLElement[];
    const sorted = cards.sort((a, b) => {
      if (mode === "hot") {
        return parseInt(b.dataset.visit || "0", 10) - parseInt(a.dataset.visit || "0", 10);
      }
      if (mode === "recommend") {
        return parseInt(b.dataset.upvote || "0", 10) - parseInt(a.dataset.upvote || "0", 10);
      }
      return 0;
    });
    sorted.forEach((card) => articleList!.appendChild(card));
  }

  async function fetchPageDoc(url: string): Promise<Document | null> {
    try {
      const res = await fetch(url, { headers: { Accept: "text/html" } });
      if (!res.ok) return null;
      const text = await res.text();
      return new DOMParser().parseFromString(text, "text/html");
    } catch {
      return null;
    }
  }

  // 根据当前分页信息构造任意页码的 URL（兼容 ?page=N 与 /page/N 两种形式）
  function buildPageUrl(
    targetPage: number,
    currentPage: number,
    nextUrl: string | undefined,
    prevUrl: string | undefined,
  ): string | null {
    const refUrl = targetPage > currentPage ? nextUrl : prevUrl;
    if (!refUrl) return null;
    const base = new URL(refUrl, window.location.origin);
    if (base.searchParams.has("page")) {
      base.searchParams.set("page", String(targetPage));
      return base.pathname + base.search + base.hash;
    }
    const m = base.pathname.match(/^(.*\/)page\/\d+(\/?)$/);
    if (m) {
      return m[1] + "page/" + targetPage + (m[2] || "");
    }
    // 兜底：替换引用页数字（独立数字，避免误伤）
    const refPage = targetPage > currentPage ? currentPage + 1 : currentPage - 1;
    return refUrl.replace(new RegExp("(?<![\\d])" + refPage + "(?![\\d])"), String(targetPage));
  }

  // 从已加载页面中提取「下一页」地址（优先取「查看更多」按钮）
  function getNextUrl(doc: Document): string | null {
    const vm = doc.querySelector(".mt-4.text-center a.btn-outline") as HTMLAnchorElement | null;
    return vm ? vm.getAttribute("href") : null;
  }

  // 滚动加载模式下，更新哨兵与「查看更多」按钮的下一页地址；无更多页则移除
  function updateNext(doc: Document): void {
    const nu = getNextUrl(doc);
    const sentinel = contentArea!.querySelector(".load-sentinel") as HTMLElement | null;
    const viewMore = contentArea!.querySelector(
      ".mt-4.text-center a.btn-outline",
    ) as HTMLAnchorElement | null;
    if (nu) {
      if (sentinel) sentinel.dataset.nextUrl = nu;
      if (viewMore) viewMore.setAttribute("href", nu);
    } else {
      sentinel?.remove();
      viewMore?.closest(".mt-4")?.remove();
    }
  }

  let loading = false;

  async function loadNext(url: string, append: boolean): Promise<void> {
    if (loading || !url) return;
    loading = true;
    const sentinel = contentArea!.querySelector(".load-sentinel") as HTMLElement | null;
    sentinel?.classList.add("is-loading");

    const doc = await fetchPageDoc(url);
    sentinel?.classList.remove("is-loading");

    // 请求失败则回退到整页跳转
    if (!doc) {
      window.location.href = url;
      loading = false;
      return;
    }

    const fetchedList = doc.querySelector(".article-list");
    if (!fetchedList) {
      window.location.href = url;
      loading = false;
      return;
    }

    if (append) {
      articleList!.insertAdjacentHTML("beforeend", fetchedList.innerHTML);
      updateNext(doc);
    } else {
      articleList!.innerHTML = fetchedList.innerHTML;
      // 分页模式：同步翻页导航并滚动到顶部
      const newPagination = doc.querySelector(".pagination");
      const oldPagination = contentArea!.querySelector(".pagination");
      if (newPagination && oldPagination) {
        oldPagination.outerHTML = newPagination.outerHTML;
      } else if (!newPagination && oldPagination) {
        oldPagination.remove();
      }
      try {
        history.pushState(null, "", url);
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    reapplySort();
    loading = false;
  }

  // 点击：查看更多文章（追加）或翻页（替换）。两种模式按需只渲染其中一种控件
  contentArea.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const viewMore = target.closest("a.btn-outline") as HTMLAnchorElement | null;
    const pageLink = target.closest(".pagination a") as HTMLAnchorElement | null;
    const link = viewMore || pageLink;
    if (!link) return;
    // 当前页无需重新加载
    if (link.classList.contains("active")) return;

    e.preventDefault();
    const url = link.getAttribute("href");
    if (!url) return;

    await loadNext(url, !!viewMore);
  });

  // 提交：跳转输入框（跳至指定页码）
  contentArea.addEventListener("submit", async (e) => {
    const form = (e.target as HTMLElement).closest(".pagination-jump") as HTMLFormElement | null;
    if (!form) return;
    e.preventDefault();

    const pag = contentArea.querySelector(".pagination") as HTMLElement | null;
    if (!pag) return;
    const total = parseInt(pag.dataset.total || "1", 10);
    const current = parseInt(pag.dataset.current || "1", 10);
    const nextUrl = pag.dataset.nextUrl;
    const prevUrl = pag.dataset.prevUrl;

    const input = form.querySelector("input") as HTMLInputElement | null;
    let page = parseInt(input?.value || "", 10);
    if (!page || page < 1) page = 1;
    if (page > total) page = total;

    const url = buildPageUrl(page, current, nextUrl, prevUrl);
    if (url) await loadNext(url, false);
    if (input) input.value = "";
  });

  // 滚动加载模式：IntersectionObserver 监听底部哨兵，进入视口附近自动加载
  if (loadMode === "scroll") {
    const sentinel = contentArea.querySelector(".load-sentinel") as HTMLElement | null;
    if (sentinel && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        async (entries) => {
          if (entries[0].isIntersecting) {
            const url = sentinel.dataset.nextUrl;
            if (url) await loadNext(url, true);
          }
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(sentinel);
    }
  }
})();
