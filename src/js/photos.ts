// Photos page — Lightbox + view toggle (masonry/grid) + AJAX load more
(function () {
  "use strict";

  /* ============================================
     Lightbox
     ============================================ */
  function initLightbox(): void {
    const lightbox = document.getElementById("photoLightbox");
    if (!lightbox) return;

    const img = lightbox.querySelector<HTMLImageElement>(".photo-lightbox-img");
    const caption = lightbox.querySelector<HTMLElement>(".photo-lightbox-caption");
    const closeBtn = lightbox.querySelector<HTMLButtonElement>(".photo-lightbox-close");
    const prevBtn = lightbox.querySelector<HTMLButtonElement>(".photo-lightbox-prev");
    const nextBtn = lightbox.querySelector<HTMLButtonElement>(".photo-lightbox-next");

    if (!img || !caption || !closeBtn || !prevBtn || !nextBtn) return;

    let items: Array<{ src: string; title: string }> = [];
    let current = 0;

    // 滚轮缩放状态
    let zoom = 1;
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 5;

    function applyZoom(): void {
      img!.style.transform = "scale(" + zoom + ")";
      img!.classList.toggle("is-zoomed", zoom !== 1);
    }

    function resetZoom(): void {
      zoom = 1;
      img!.style.transform = ""; // 交回 CSS 控制（开场动画）
      img!.classList.remove("is-zoomed");
    }

    function collect(): void {
      items = Array.prototype.map.call(
        document.querySelectorAll<HTMLElement>("[data-lightbox]"),
        function (el: HTMLElement) {
          return {
            src: el.getAttribute("data-lightbox-src") || "",
            title: el.getAttribute("data-lightbox-title") || "",
          };
        }
      ) as Array<{ src: string; title: string }>;
    }

    function render(): void {
      const item = items[current];
      if (!item) return;
      resetZoom();
      img!.setAttribute("src", item.src);
      img!.setAttribute("alt", item.title);
      caption!.textContent = item.title;
      const multi = items.length > 1;
      prevBtn!.style.display = multi ? "" : "none";
      nextBtn!.style.display = multi ? "" : "none";
    }

    function open(index: number): void {
      collect();
      if (!items.length) return;
      current = (index + items.length) % items.length;
      render();
      lightbox!.classList.add("is-open");
      lightbox!.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function close(): void {
      resetZoom();
      lightbox!.classList.remove("is-open");
      lightbox!.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function step(delta: number): void {
      current = (current + delta + items.length) % items.length;
      render();
    }

    // Delegate clicks on any [data-lightbox] element
    document.addEventListener("click", function (e: MouseEvent) {
      const trigger = (e.target as HTMLElement)?.closest<HTMLElement>("[data-lightbox]");
      if (!trigger) return;
      e.preventDefault();
      collect();
      const idx = items.findIndex(function (it) {
        return it.src === (trigger.getAttribute("data-lightbox-src") || "");
      });
      open(idx >= 0 ? idx : 0);
    });

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () {
      step(-1);
    });
    nextBtn.addEventListener("click", function () {
      step(1);
    });

    // Click backdrop (outside image/buttons) closes
    lightbox.addEventListener("click", function (e: MouseEvent) {
      if (e.target === lightbox) close();
    });

    // 滚轮缩放（放大 / 缩小）
    lightbox.addEventListener(
      "wheel",
      function (e: WheelEvent) {
        if (!lightbox!.classList.contains("is-open")) return;
        // 触控板双指捏合会带 ctrlKey，普通滚轮不带；两者都用于缩放
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
        applyZoom();
      },
      { passive: false }
    );

    document.addEventListener("keydown", function (e: KeyboardEvent) {
      if (!lightbox!.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });
  }

  /* ============================================
     View Toggle (masonry / grid)
     ============================================ */
  function initViewToggle(): void {
    const grid = document.getElementById("photoGrid");
    if (!grid) return;
    const buttons = document.querySelectorAll<HTMLButtonElement>(".photo-view-btn");
    if (!buttons.length) return;

    const STORAGE_KEY = "cosolar-photos-view";
    const saved = localStorage.getItem(STORAGE_KEY);

    function apply(view: string): void {
      if (view === "grid") {
        grid!.classList.add("is-grid");
      } else {
        grid!.classList.remove("is-grid");
      }
      buttons.forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-view") === view);
      });
    }

    if (saved === "grid" || saved === "masonry") {
      apply(saved);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const view = btn.getAttribute("data-view") || "masonry";
        apply(view);
        localStorage.setItem(STORAGE_KEY, view);
      });
    });
  }

  /* ============================================
     AJAX Load More
     ============================================ */
  function initLoadMore(): void {
    const loadMoreBtn = document.querySelector<HTMLElement>("[data-photo-load-more]");
    if (!loadMoreBtn) return;

    const grid = document.getElementById("photoGrid");
    if (!grid) return;

    let isLoading = false;

    loadMoreBtn.addEventListener("click", function (e: MouseEvent) {
      e.preventDefault();
      if (isLoading) return;
      isLoading = true;

      const btn = loadMoreBtn;
      btn.classList.add("loading");
      const spanEl = btn.querySelector("span");
      const originalText = spanEl ? spanEl.textContent : "";
      if (spanEl) spanEl.textContent = "加载中...";

      const nextUrl = btn.getAttribute("href") || "";

      fetch(nextUrl, { headers: { "X-Requested-With": "XMLHttpRequest" } })
        .then(function (res: Response) {
          if (!res.ok) throw new Error("Network error");
          return res.text();
        })
        .then(function (html: string) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");

          const newCards = doc.querySelectorAll("#photoGrid .photo-card");
          newCards.forEach(function (card) {
            grid!.appendChild(card);
          });

          const newBtn = doc.querySelector<HTMLElement>("[data-photo-load-more]");
          if (newBtn) {
            btn.setAttribute("href", newBtn.getAttribute("href") || "");
            if (spanEl) spanEl.textContent = originalText;
            btn.classList.remove("loading");
          } else {
            btn.style.display = "none";
          }
        })
        .catch(function () {
          window.location.href = nextUrl;
        })
        .finally(function () {
          isLoading = false;
        });
    });
  }

  /* ============================================
     Copy Buttons (e.g. image address)
     ============================================ */
  function initCopyButtons(): void {
    function fallback(text: string): void {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        /* ignore */
      }
      document.body.removeChild(ta);
    }

    document.addEventListener("click", function (e: MouseEvent) {
      const btn = (e.target as HTMLElement)?.closest<HTMLElement>(".photo-copy-btn");
      if (!btn) return;

      const text = btn.getAttribute("data-copy") || "";
      if (!text) return;

      const markCopied = function (): void {
        btn.classList.add("copied");
        btn.setAttribute("title", "已复制");
        window.setTimeout(function () {
          btn.classList.remove("copied");
          btn.setAttribute("title", "复制地址");
        }, 1500);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markCopied, function () {
          fallback(text);
          markCopied();
        });
      } else {
        fallback(text);
        markCopied();
      }
    });
  }

  /* ============================================
     Init
     ============================================ */
  initLightbox();
  initViewToggle();
  initLoadMore();
  initCopyButtons();
})();
