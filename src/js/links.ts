import "../css/main.css";
import "../css/links.css";

interface LinkCard {
  el: HTMLElement;
  group: string;
  name: string;
  desc: string;
  url: string;
  initialOrder: number;
}

function collectCards(): LinkCard[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".link-card")).map(
    (el, index) => {
      const groupEl = el.closest<HTMLElement>(".link-group");
      return {
        el,
        group: groupEl?.dataset.group || "all",
        name: (el.dataset.name || "").toLowerCase(),
        desc: (el.dataset.desc || "").toLowerCase(),
        url: el.getAttribute("href") || "",
        initialOrder: index,
      };
    },
  );
}

function initLinksPage() {
  const cards = collectCards();
  initCategoryFilter(cards);
  initSearch(cards);
  initSort(cards);
  initViewToggle();
  initLazyImages();
  updateGroupCount();
  initLinkApplication();
}

function initLinkApplication() {
  const captchaImg = document.getElementById(
    "link-application-captcha-img",
  ) as HTMLImageElement | null;
  captchaImg?.addEventListener("click", () => {
    captchaImg.src = `${captchaImg.src.split("?")[0]}?t=${Date.now()}`;
  });

  // 插件未开放申请时页面没有弹窗
  const modal = document.getElementById("link-application-modal");
  if (!modal) return;

  const openModal = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    const url = new URL(window.location.href);
    if (url.searchParams.has("applied")) {
      url.searchParams.delete("applied");
      url.searchParams.delete("field");
      url.searchParams.delete("message");
      url.searchParams.delete("value");
      history.replaceState(null, "", url.toString());
    }

    modal
      .querySelectorAll<HTMLElement>(".link-application-alert")
      .forEach((el) => {
        el.style.display = "none";
      });
  };

  document
    .querySelectorAll<HTMLElement>(".js-link-application-open")
    .forEach((el) => {
      el.addEventListener("click", openModal);
    });

  modal
    .querySelectorAll<HTMLElement>("[data-link-application-close]")
    .forEach((el) => {
      el.addEventListener("click", closeModal);
    });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open"))
      closeModal();
  });

  // 表单提交后插件 303 重定向回 /links?applied=...，自动打开弹窗展示结果
  if (new URLSearchParams(window.location.search).has("applied")) openModal();
}

function initCategoryFilter(cards: LinkCard[]) {
  const categoryList = document.getElementById("categoryList");
  const categorySelect = document.getElementById(
    "categorySelect",
  ) as HTMLSelectElement | null;
  if (!categoryList && !categorySelect) return;

  const setActiveFilter = (filter: string) => {
    const activeBtn = categoryList?.querySelector(
      ".links-category-item.active",
    );
    activeBtn?.classList.remove("active");
    const btn = categoryList?.querySelector<HTMLButtonElement>(
      `.links-category-item[data-filter="${CSS.escape(filter)}"]`,
    );
    btn?.classList.add("active");

    if (categorySelect && categorySelect.value !== filter) {
      categorySelect.value = filter;
    }

    applyFilter(filter, cards);
    updateToolbarTitle(filter);
    syncSortUI("default");
  };

  categoryList
    ?.querySelectorAll<HTMLButtonElement>(".links-category-item")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveFilter(btn.dataset.filter || "all");
      });
    });

  categorySelect?.addEventListener("change", () => {
    setActiveFilter(categorySelect.value || "all");
  });
}

function applyFilter(filter: string, cards: LinkCard[]) {
  const searchInput = document.getElementById(
    "linkSearchInput",
  ) as HTMLInputElement | null;
  const keyword = (searchInput?.value || "").trim().toLowerCase();
  const search = keyword
    ? new Set(
        cards.filter(
          (c) =>
            c.name.includes(keyword) ||
            c.desc.includes(keyword) ||
            c.url.toLowerCase().includes(keyword),
        ),
      )
    : null;

  cards.forEach((c) => {
    const visible =
      (filter === "all" || c.group === filter) && (!search || search.has(c));
    c.el.style.display = visible ? "" : "none";
  });

  document.querySelectorAll<HTMLElement>(".link-group").forEach((group) => {
    const hasVisible = Array.from(
      group.querySelectorAll<HTMLElement>(".link-card"),
    ).some((card) => card.style.display !== "none");
    group.style.display = hasVisible ? "" : "none";
  });

  const groupsContainer = document.getElementById("linksGroups");
  groupsContainer?.classList.toggle("is-filtered", filter !== "all");

  const visibleCount = cards.filter(
    (c) => c.el.style.display !== "none",
  ).length;
  updateEmptyState(visibleCount, !!keyword);
  updateGroupCount();
}

function updateToolbarTitle(filter: string) {
  const title = document.getElementById("currentCategoryTitle");
  const desc = document.getElementById("currentCategoryDesc");
  if (!title) return;
  if (filter === "all") {
    title.textContent = "全部资源";
    if (desc) desc.textContent = "精心筛选的优质资源集合，持续更新中...";
    return;
  }
  const btn = document.querySelector<HTMLElement>(
    `.links-category-item[data-filter="${CSS.escape(filter)}"] .links-category-name`,
  );
  const name = btn?.textContent || filter;
  title.textContent = name;
  if (desc) desc.textContent = `「${name}」分类下的优质资源`;
}

function initSearch(cards: LinkCard[]) {
  const searchInput = document.getElementById(
    "linkSearchInput",
  ) as HTMLInputElement | null;
  if (!searchInput) return;

  let timer: number | undefined;
  searchInput.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const activeFilter = getActiveFilter();
      applyFilter(activeFilter, cards);
    }, 200);
  });

  const clearBtn = document.getElementById("clearSearchBtn");
  clearBtn?.addEventListener("click", () => {
    searchInput.value = "";
    const activeFilter = getActiveFilter();
    applyFilter(activeFilter, cards);
    searchInput.focus();
  });
}

function initSort(cards: LinkCard[]) {
  const sortWrap = document.getElementById("linksSort");
  if (!sortWrap) return;

  sortWrap
    .querySelectorAll<HTMLButtonElement>(".links-sort-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const active = sortWrap.querySelector(".links-sort-btn.active");
        if (active) active.classList.remove("active");
        btn.classList.add("active");
        applySort(btn.dataset.sort || "default", cards);
      });
    });
}

function applySort(sort: string, cards: LinkCard[]) {
  const groups = document.querySelectorAll<HTMLElement>(".link-group");
  groups.forEach((group) => {
    const cardEls = Array.from(
      group.querySelectorAll<HTMLElement>(".link-card"),
    );
    let sorted: HTMLElement[];
    if (sort === "newest") {
      sorted = cardEls.slice().reverse();
    } else {
      sorted = cardEls.slice().sort((a, b) => {
        const ca = cards.find((c) => c.el === a);
        const cb = cards.find((c) => c.el === b);
        return (ca?.initialOrder ?? 0) - (cb?.initialOrder ?? 0);
      });
    }
    sorted.forEach((el) => group.querySelector(".link-cards")?.appendChild(el));
  });
  const activeFilter = getActiveFilter();
  applyFilter(activeFilter, cards);
}

function syncSortUI(sort: string) {
  const sortWrap = document.getElementById("linksSort");
  if (!sortWrap) return;
  sortWrap
    .querySelectorAll<HTMLButtonElement>(".links-sort-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.sort === sort);
    });
}

function getActiveFilter(): string {
  const active = document.querySelector<HTMLElement>(
    ".links-category-item.active",
  );
  return active?.dataset.filter || "all";
}

function updateEmptyState(visibleCount: number, searching: boolean) {
  const empty = document.getElementById("linksSearchEmpty");
  if (!empty) return;
  empty.style.display = visibleCount === 0 && searching ? "" : "none";
}

function updateGroupCount() {
  const el = document.getElementById("linkGroupCount");
  if (!el) return;
  const visible = Array.from(
    document.querySelectorAll<HTMLElement>(".link-group"),
  ).filter((g) => g.style.display !== "none");
  el.textContent = String(visible.length);
}

const VIEW_STORAGE_KEY = "cosolar-links-view";

function initViewToggle() {
  const toggleWrap = document.getElementById("linksViewToggle");
  if (!toggleWrap) return;

  const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
  if (savedView === "compact" || savedView === "detailed") {
    applyView(savedView, toggleWrap);
  }

  toggleWrap
    .querySelectorAll<HTMLButtonElement>(".links-view-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view || "detailed";
        applyView(view, toggleWrap);
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      });
    });
}

function applyView(view: string, toggleWrap: HTMLElement) {
  const groups = document.querySelectorAll<HTMLElement>(".link-group");
  groups.forEach((group) => group.setAttribute("data-view", view));

  toggleWrap
    .querySelectorAll<HTMLButtonElement>(".links-view-btn")
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
      btn.setAttribute("aria-pressed", String(btn.dataset.view === view));
    });
}

function initLazyImages() {
  const imgs = document.querySelectorAll<HTMLImageElement>(
    '.link-card-logo img[loading="lazy"]',
  );
  if (!("IntersectionObserver" in window) || imgs.length === 0) return;
  const io = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.getAttribute("data-src");
        if (src) {
          img.src = src;
          img.removeAttribute("data-src");
        }
        observer.unobserve(img);
      }
    });
  });
  imgs.forEach((img) => io.observe(img));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLinksPage);
} else {
  initLinksPage();
}
