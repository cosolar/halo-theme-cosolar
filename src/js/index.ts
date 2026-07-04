// Index page — Featured carousel logic
(function () {
  "use strict";

  const carousel = document.querySelector(".featured-carousel") as HTMLElement | null;
  if (!carousel) return;

  const slides = carousel.querySelectorAll(".carousel-slide");
  const dots = carousel.querySelectorAll(".carousel-dot");
  const prevBtn = carousel.querySelector(".carousel-prev") as HTMLElement | null;
  const nextBtn = carousel.querySelector(".carousel-next") as HTMLElement | null;

  if (slides.length <= 1) return;

  const autoplay = carousel.dataset.autoplay === "true";
  const interval = parseInt(carousel.dataset.interval || "5000", 10);
  let currentIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function showSlide(index: number): void {
    currentIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentIndex);
    });
    dots.forEach((dot, i) => {
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

  dots.forEach((dot, i) => {
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
    const cards = Array.from(
      listEl.querySelectorAll(".article-card")
    ) as HTMLElement[];

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