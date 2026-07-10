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

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
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
        const searchBox = document.querySelector(".search-box") as HTMLElement | null;
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

    if (linkPath === currentPath || (linkPath !== "/" && currentPath.startsWith(linkPath))) {
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

  // ===== 动态渲染背景 =====
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 16, g: 185, b: 129 };
  }

  function setupCanvas(
    canvasSelector: string,
    dynamicType: string,
    color1Hex: string,
    color2Hex: string,
    opacityVal: number,
  ): void {
    const canvas = document.querySelector(canvasSelector) as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const c = canvas;
    const rgb1 = hexToRgb(color1Hex);
    const rgb2 = hexToRgb(color2Hex);

    function resize(): void {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    if (dynamicType === "particles") {
      const particleCount = Math.min(80, Math.floor((c.width * c.height) / 15000));
      const maxDist = 120;
      interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
      }
      const particles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
        });
      }

      function draw(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > c.width) p.vx *= -1;
          if (p.y < 0 || p.y > c.height) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacityVal * 2})`;
          ctx.fill();
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacityVal * (1 - dist / maxDist)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        requestAnimationFrame(draw);
      }
      draw();
    }

    if (dynamicType === "gradient") {
      let time = 0;
      function draw(): void {
        if (!ctx) return;
        time += 0.003;
        ctx.clearRect(0, 0, c.width, c.height);
        const blobs = [
          {
            x: c.width * (0.3 + 0.2 * Math.sin(time * 0.7)),
            y: c.height * (0.3 + 0.2 * Math.cos(time * 0.5)),
            r: Math.max(1, c.width * 0.25),
          },
          {
            x: c.width * (0.7 + 0.15 * Math.cos(time * 0.6)),
            y: c.height * (0.6 + 0.2 * Math.sin(time * 0.8)),
            r: Math.max(1, c.width * 0.2),
          },
          {
            x: c.width * (0.5 + 0.25 * Math.sin(time * 0.4)),
            y: c.height * (0.5 + 0.15 * Math.cos(time * 0.9)),
            r: Math.max(1, c.width * 0.22),
          },
        ];
        blobs.forEach(function (blob, i) {
          const rgb = i % 2 === 0 ? rgb1 : rgb2;
          const gradient = ctx!.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacityVal})`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx!.fillStyle = gradient;
          ctx!.fillRect(0, 0, c.width, c.height);
        });
        requestAnimationFrame(draw);
      }
      draw();
    }

    if (dynamicType === "bubbles") {
      const bubbleCount = Math.min(30, Math.floor((c.width * c.height) / 40000));
      interface Bubble {
        x: number;
        y: number;
        r: number;
        vy: number;
        vx: number;
        phase: number;
      }
      const bubbles: Bubble[] = [];
      for (let i = 0; i < bubbleCount; i++) {
        bubbles.push({
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          r: Math.max(4, Math.random() * 30 + 8),
          vy: -(Math.random() * 0.4 + 0.15),
          vx: (Math.random() - 0.5) * 0.3,
          phase: Math.random() * Math.PI * 2,
        });
      }
      function draw(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        bubbles.forEach(function (b) {
          b.y += b.vy;
          b.x += b.vx + Math.sin(b.phase) * 0.2;
          b.phase += 0.01;
          if (b.y + b.r < 0) {
            b.y = c.height + b.r;
            b.x = Math.random() * c.width;
          }
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacityVal * 0.5})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacityVal})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacityVal * 0.6})`;
          ctx.fill();
        });
        requestAnimationFrame(draw);
      }
      draw();
    }

    if (dynamicType === "stars") {
      const starCount = Math.min(150, Math.floor((c.width * c.height) / 8000));
      interface Star {
        x: number;
        y: number;
        r: number;
        phase: number;
        speed: number;
      }
      const stars: Star[] = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          r: Math.max(0.5, Math.random() * 2),
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.005,
        });
      }
      function draw(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        stars.forEach(function (s) {
          s.phase += s.speed;
          const alpha = opacityVal * (0.4 + 0.6 * Math.abs(Math.sin(s.phase)));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${alpha})`;
          ctx.fill();
          if (s.r > 1.2) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${alpha * 0.15})`;
            ctx.fill();
          }
        });
        requestAnimationFrame(draw);
      }
      draw();
    }

    if (dynamicType === "mesh") {
      const gridSize = 40;
      let time = 0;
      function draw(): void {
        if (!ctx) return;
        time += 0.015;
        ctx.clearRect(0, 0, c.width, c.height);
        const cols = Math.ceil(c.width / gridSize) + 1;
        const rows = Math.ceil(c.height / gridSize) + 1;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const x = i * gridSize;
            const y = j * gridSize;
            const dist = Math.sqrt(Math.pow(x - c.width / 2, 2) + Math.pow(y - c.height / 2, 2));
            const wave = Math.sin(dist * 0.01 - time) * 0.5 + 0.5;
            const alpha = opacityVal * wave * 0.6;
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${alpha})`;
            ctx.fill();
            if (i < cols - 1) {
              const nx = (i + 1) * gridSize;
              const nDist = Math.sqrt(
                Math.pow(nx - c.width / 2, 2) + Math.pow(y - c.height / 2, 2),
              );
              const nWave = Math.sin(nDist * 0.01 - time) * 0.5 + 0.5;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(nx, y);
              ctx.strokeStyle = `rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacityVal * Math.min(wave, nWave) * 0.3})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
            if (j < rows - 1) {
              const ny = (j + 1) * gridSize;
              const nDist = Math.sqrt(
                Math.pow(x - c.width / 2, 2) + Math.pow(ny - c.height / 2, 2),
              );
              const nWave = Math.sin(nDist * 0.01 - time) * 0.5 + 0.5;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, ny);
              ctx.strokeStyle = `rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, ${opacityVal * Math.min(wave, nWave) * 0.3})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
        requestAnimationFrame(draw);
      }
      draw();
    }
  }

  function initDynamicBackground(): void {
    const body = document.body;

    const lightBgType = body.getAttribute("data-light-bg-type");
    if (lightBgType === "dynamic") {
      setupCanvas(
        ".site-bg-canvas-light",
        body.getAttribute("data-light-bg-dynamic-type") || "particles",
        body.getAttribute("data-light-bg-dynamic-color1") || "#10B981",
        body.getAttribute("data-light-bg-dynamic-color2") || "#3B82F6",
        parseFloat(body.getAttribute("data-light-bg-dynamic-opacity") || "0.15"),
      );
    }

    const darkBgType = body.getAttribute("data-dark-bg-type");
    if (darkBgType === "dynamic") {
      setupCanvas(
        ".site-bg-canvas-dark",
        body.getAttribute("data-dark-bg-dynamic-type") || "stars",
        body.getAttribute("data-dark-bg-dynamic-color1") || "#10B981",
        body.getAttribute("data-dark-bg-dynamic-color2") || "#3B82F6",
        parseFloat(body.getAttribute("data-dark-bg-dynamic-opacity") || "0.15"),
      );
    }
  }

  initDynamicBackground();
})();
