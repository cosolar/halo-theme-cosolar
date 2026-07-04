import "../css/main.css";

(function () {
  "use strict";

  // ===== Theme Toggle =====
  const themeToggle = document.getElementById("themeToggle");
  const html = document.documentElement;

  function getCurrentTheme(): string {
    return html.getAttribute("data-theme") || "light";
  }

  function setTheme(theme: string): void {
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-color-scheme", theme);
    localStorage.setItem("cosolar-theme", theme);
  }

  themeToggle?.addEventListener("click", function () {
    const current = getCurrentTheme();
    setTheme(current === "dark" ? "light" : "dark");
  });

  // Listen for system theme changes (only when user hasn't set a preference)
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function (e) {
      if (!localStorage.getItem("cosolar-theme")) {
        const config = html.getAttribute("data-color-scheme");
        if (config === "auto" || (!config && !localStorage.getItem("cosolar-theme"))) {
          setTheme(e.matches ? "dark" : "light");
        }
      }
    });

  // ===== Mobile Menu Toggle =====
  const menuToggle = document.getElementById("menuToggle");
  const headerNav = document.getElementById("headerNav");

  menuToggle?.addEventListener("click", function () {
    menuToggle.classList.toggle("active");
    headerNav?.classList.toggle("open");
  });

  // Close mobile menu when clicking a link
  headerNav?.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menuToggle?.classList.remove("active");
      headerNav.classList.remove("open");
    });
  });

  // ===== Search Shortcut (Ctrl+K) =====
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const searchWidget = (window as any).SearchWidget;
      if (searchWidget) {
        searchWidget.open();
      } else {
        const searchBox = document.querySelector(
          ".search-box"
        ) as HTMLElement | null;
        searchBox?.click();
      }
    }
  });

  // ===== Header Scroll Shadow =====
  const siteHeader = document.querySelector(".site-header");

  window.addEventListener("scroll", function () {
    if (window.scrollY > 10) {
      siteHeader?.classList.add("scrolled");
    } else {
      siteHeader?.classList.remove("scrolled");
    }
  });

  // ===== Active Nav State =====
  const navLinks = headerNav?.querySelectorAll("a");
  const currentPath = window.location.pathname;

  navLinks?.forEach(function (link) {
    const href = link.getAttribute("href") || "";
    const linkPath = href.replace(/^(https?:\/\/[^/]+)?/, "");

    if (
      linkPath === currentPath ||
      (linkPath !== "/" && currentPath.startsWith(linkPath))
    ) {
      link.classList.add("active");
    } else if (linkPath === "/" && currentPath === "/") {
      link.classList.add("active");
    }
  });

  // ===== Smooth Scroll for Anchor Links =====
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const targetId = (anchor as HTMLAnchorElement).getAttribute("href");
      if (targetId && targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });
  // 代码高亮与复制按钮由 Halo plugin-shiki (shiki-code Web Component) 负责，主题不再处理
})();
