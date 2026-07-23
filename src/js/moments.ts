// Moments page — Relative time, number formatting, active users, dynamic calendar, AJAX load more
(function () {
  "use strict";

  /* ===== Number Formatting ===== */
  function formatNumber(n: number): string {
    if (n >= 10000) return (n / 1000).toFixed(0) + "k";
    if (n >= 1000) {
      const k = n / 1000;
      return (k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")) + "k";
    }
    return String(n);
  }

  function initNumberFormatting(): void {
    document.querySelectorAll<HTMLElement>("[data-format-number]").forEach(function (el) {
      var text = (el.textContent || "").trim();
      var num = parseInt(text, 10);
      if (!isNaN(num)) el.textContent = formatNumber(num);
    });
  }

  /* ===== Level Derivation ===== */
  function deriveLevel(count: number): number {
    if (count >= 100) return 6;
    if (count >= 51) return 5;
    if (count >= 31) return 4;
    if (count >= 16) return 3;
    if (count >= 6) return 2;
    return 1;
  }

  /* ===== Relative Time ===== */
  function relativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return dateStr;
    const diff = now - then;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    if (diff < minute) return "刚刚";
    if (diff < hour) return Math.floor(diff / minute) + " 分钟前";
    if (diff < day) return Math.floor(diff / hour) + " 小时前";
    if (diff < week) return Math.floor(diff / day) + " 天前";
    if (diff < 30 * day) return Math.floor(diff / week) + " 周前";
    const d = new Date(then);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function updateRelativeTimes(): void {
    document.querySelectorAll<HTMLElement>("[data-relative-time]").forEach((el) => {
      const dt = el.getAttribute("datetime");
      if (dt) el.textContent = relativeTime(dt);
    });
  }
  updateRelativeTimes();
  setInterval(updateRelativeTimes, 60000);

  /* ===== Page Data ===== */
  interface MomentDataItem {
    owner: string | null;
    displayName: string | null;
    avatar: string | null;
    time: string | null;
  }

  interface MomentsPageData {
    total: number;
    todayCount: number;
    monthCount: number;
    totalInteract: number;
    totalUpvote: number;
    totalComment: number;
    moments: MomentDataItem[];
  }

  function getPageData(): MomentsPageData | null {
    const w = window as unknown as { __momentsPageData__?: MomentsPageData };
    if (!w.__momentsPageData__ || !w.__momentsPageData__.moments) return null;
    return w.__momentsPageData__;
  }

  /* ===== Active Users Enhancement ===== */
  function initActiveUsers(): void {
    const data = getPageData();
    if (!data || data.moments.length === 0) return;

    const container = document.getElementById("momentsActiveUsers");
    if (!container) return;

    // Build unique user map with counts
    const userMap = new Map<
      string,
      { owner: string; displayName: string; avatar: string; count: number }
    >();

    data.moments.forEach(function (m: MomentDataItem) {
      if (!m.owner) return;
      const existing = userMap.get(m.owner);
      if (existing) {
        existing.count++;
      } else {
        userMap.set(m.owner, {
          owner: m.owner,
          displayName: m.displayName || m.owner,
          avatar: m.avatar || "",
          count: 1,
        });
      }
    });

    // Sort by count descending, take top 5
    const users = Array.from(userMap.values())
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 5);

    if (users.length === 0) return;

    // Rebuild HTML
    container.innerHTML = "";
    users.forEach(function (user) {
      const level = deriveLevel(user.count);
      const li = document.createElement("li");
      li.className = "widget-moments-user";
      li.setAttribute("data-owner-name", user.owner);

      // Avatar
      if (user.avatar) {
        const avatarLink = document.createElement("a");
        avatarLink.className = "widget-moments-user-avatar";
        avatarLink.href = "/moments";
        const img = document.createElement("img");
        img.src = user.avatar;
        img.alt = user.displayName;
        img.loading = "lazy";
        avatarLink.appendChild(img);
        li.appendChild(avatarLink);
      } else {
        const avatarSpan = document.createElement("span");
        avatarSpan.className = "widget-moments-user-avatar";
        avatarSpan.textContent = (user.displayName || "U").charAt(0).toUpperCase();
        li.appendChild(avatarSpan);
      }

      // Info
      const info = document.createElement("div");
      info.className = "widget-moments-user-info";

      const nameRow = document.createElement("div");
      nameRow.className = "widget-moments-user-name-row";

      const name = document.createElement("span");
      name.className = "widget-moments-user-name";
      name.textContent = user.displayName;
      nameRow.appendChild(name);

      const levelBadge = document.createElement("span");
      levelBadge.className = "widget-moments-user-level moment-level--" + level;
      levelBadge.textContent = "Lv." + level;
      nameRow.appendChild(levelBadge);

      info.appendChild(nameRow);

      const count = document.createElement("span");
      count.className = "widget-moments-user-count";
      count.innerHTML = "<strong>" + formatNumber(user.count) + "</strong> 瞬间";
      info.appendChild(count);

      li.appendChild(info);
      container.appendChild(li);
    });
  }

  /* ===== Feed Card Level Enhancement ===== */
  function initFeedCardLevels(root?: Document | HTMLElement): void {
    const data = getPageData();
    if (!data) return;

    // Build displayName → count map
    const nameCounts = new Map<string, number>();
    data.moments.forEach(function (m: MomentDataItem) {
      if (!m.displayName) return;
      nameCounts.set(m.displayName, (nameCounts.get(m.displayName) || 0) + 1);
    });

    const scope = root || document;
    scope.querySelectorAll<HTMLElement>(".moment-card").forEach(function (card) {
      const headerMain = card.querySelector<HTMLElement>(".moment-header-main");
      if (!headerMain) return;

      const existingBadge = headerMain.querySelector<HTMLElement>(".moment-level");

      if (existingBadge) {
        // Add color class to existing badge if not already present
        const levelText = existingBadge.textContent || "";
        const match = levelText.match(/Lv\.(\d+)/);
        if (match && !existingBadge.className.includes("moment-level--")) {
          existingBadge.classList.add("moment-level--" + match[1]);
        }
        return;
      }

      // No badge — derive from count
      const nameLink = headerMain.querySelector<HTMLElement>(".moment-name");
      if (!nameLink) return;

      const displayName = (nameLink.textContent || "").trim();
      const count = nameCounts.get(displayName) || 0;
      if (count === 0) return;

      const level = deriveLevel(count);
      const badge = document.createElement("span");
      badge.className = "moment-level moment-level--" + level;
      badge.textContent = "Lv." + level;
      headerMain.appendChild(badge);
    });
  }

  /* ===== Dynamic Calendar ===== */
  function initCalendar(): void {
    const data = getPageData();
    if (!data || data.moments.length === 0) return;

    const container = document.getElementById("momentsCalendar");
    if (!container) return;
    const calEl: HTMLElement = container;

    // Collect moment days (yyyy-MM-dd)
    const momentDays = new Set<string>();
    data.moments.forEach(function (m: MomentDataItem) {
      if (!m.time) return;
      const day = m.time.substring(0, 10);
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) momentDays.add(day);
    });

    let viewDate = new Date();

    function renderCalendar(): void {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const today = new Date();
      const todayStr =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startWeekday = firstDay.getDay();

      let html = '<div class="widget-moments-calendar-header">';
      html +=
        '<button class="widget-moments-calendar-prev" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>';
      html +=
        '<span class="widget-moments-calendar-month">' +
        year +
        "年" +
        (month + 1) +
        "月</span>";
      html +=
        '<button class="widget-moments-calendar-next" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>';
      html += "</div>";

      html += '<div class="widget-moments-calendar-grid">';
      ["日", "一", "二", "三", "四", "五", "六"].forEach(function (d) {
        html += '<span class="widget-moments-weekday">' + d + "</span>";
      });

      // Empty cells for days before the 1st
      for (let i = 0; i < startWeekday; i++) {
        html += '<span class="widget-moments-day is-other-month"></span>';
      }

      // Days of the month
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr =
          year +
          "-" +
          String(month + 1).padStart(2, "0") +
          "-" +
          String(d).padStart(2, "0");
        const hasMoment = momentDays.has(dateStr);
        const isToday = dateStr === todayStr;
        let classes = "widget-moments-day";
        if (hasMoment) classes += " has-moment";
        if (isToday) classes += " is-today";
        html += '<span class="' + classes + '">' + d + "</span>";
      }

      html += "</div>";

      calEl.innerHTML = html;

      // Attach navigation handlers
      const prevBtn = calEl.querySelector<HTMLElement>(
        ".widget-moments-calendar-prev"
      );
      const nextBtn = calEl.querySelector<HTMLElement>(
        ".widget-moments-calendar-next"
      );

      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          viewDate = new Date(year, month - 1, 1);
          renderCalendar();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          viewDate = new Date(year, month + 1, 1);
          renderCalendar();
        });
      }
    }

    renderCalendar();
  }

  /* ===== Image Lightbox (zoom + drag + navigate) ===== */
  function initLightbox(): void {
    const lightbox = document.getElementById("momentLightbox");
    if (!lightbox) return;
    const lb = lightbox;

    const img = lb.querySelector<HTMLImageElement>(".moment-lightbox-img");
    const closeBtn = lb.querySelector<HTMLButtonElement>(".moment-lightbox-close");
    const prevBtn = lb.querySelector<HTMLButtonElement>(".moment-lightbox-prev");
    const nextBtn = lb.querySelector<HTMLButtonElement>(".moment-lightbox-next");
    const counter = lb.querySelector<HTMLElement>(".moment-lightbox-counter");
    if (!img || !closeBtn || !prevBtn || !nextBtn || !counter) return;

    let items: string[] = [];
    let current = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function collect(): void {
      items = Array.prototype.map.call(
        document.querySelectorAll<HTMLElement>("[data-moment-lightbox]"),
        function (el: HTMLElement) {
          return el.getAttribute("data-lightbox-src") || el.getAttribute("href") || "";
        }
      ) as string[];
    }

    function applyTransform(): void {
      img!.style.transform = "translate(" + offsetX + "px, " + offsetY + "px) scale(" + scale + ")";
    }

    function resetTransform(): void {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
      img!.style.transform = "";
      img!.classList.remove("is-dragging");
    }

    function render(): void {
      const src = items[current];
      if (!src) return;
      img!.setAttribute("src", src);
      resetTransform();
      const multi = items.length > 1;
      prevBtn!.style.display = multi ? "" : "none";
      nextBtn!.style.display = multi ? "" : "none";
      counter!.textContent = multi ? current + 1 + " / " + items.length : "";
      counter!.style.display = multi ? "" : "none";
    }

    function open(index: number): void {
      collect();
      if (!items.length) return;
      current = ((index % items.length) + items.length) % items.length;
      render();
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function close(): void {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      resetTransform();
    }

    function step(delta: number): void {
      current = (current + delta + items.length) % items.length;
      render();
    }

    // Click any [data-moment-lightbox] to open
    document.addEventListener("click", function (e: MouseEvent) {
      const trigger = (e.target as HTMLElement)?.closest<HTMLElement>("[data-moment-lightbox]");
      if (!trigger) return;
      e.preventDefault();
      collect();
      const src = trigger.getAttribute("data-lightbox-src") || trigger.getAttribute("href") || "";
      const idx = items.indexOf(src);
      open(idx >= 0 ? idx : 0);
    });

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      step(-1);
    });
    nextBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      step(1);
    });

    // Click backdrop closes
    lb.addEventListener("click", function (e: MouseEvent) {
      if (e.target === lb) close();
    });

    // Keyboard
    document.addEventListener("keydown", function (e: KeyboardEvent) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    });

    // Wheel zoom
    lb.addEventListener("wheel", function (e: WheelEvent) {
      if (!lb.classList.contains("is-open")) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      scale = Math.max(0.5, Math.min(5, scale + delta));
      applyTransform();
    }, { passive: false });

    // Drag to move (when zoomed in)
    img.addEventListener("mousedown", function (e: MouseEvent) {
      if (scale <= 1) return;
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX - offsetX;
      dragStartY = e.clientY - offsetY;
      img.classList.add("is-dragging");
    });

    document.addEventListener("mousemove", function (e: MouseEvent) {
      if (!isDragging) return;
      offsetX = e.clientX - dragStartX;
      offsetY = e.clientY - dragStartY;
      applyTransform();
    });

    document.addEventListener("mouseup", function () {
      if (!isDragging) return;
      isDragging = false;
      img.classList.remove("is-dragging");
    });

    // Touch support for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    img.addEventListener("touchstart", function (e: TouchEvent) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX - offsetX;
        touchStartY = e.touches[0].clientY - offsetY;
      }
    }, { passive: true });

    img.addEventListener("touchmove", function (e: TouchEvent) {
      if (e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        offsetX = e.touches[0].clientX - touchStartX;
        offsetY = e.touches[0].clientY - touchStartY;
        applyTransform();
      }
    }, { passive: false });

    // Swipe left/right on mobile (when not zoomed)
    let swipeStartX = 0;
    lb.addEventListener("touchstart", function (e: TouchEvent) {
      if (e.touches.length === 1) {
        swipeStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    lb.addEventListener("touchend", function (e: TouchEvent) {
      if (scale > 1) return;
      const diff = swipeStartX - (e.changedTouches[0]?.clientX || 0);
      if (Math.abs(diff) > 50) {
        step(diff > 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  /* ===== Initialize Enhancements ===== */
  initNumberFormatting();
  initActiveUsers();
  initFeedCardLevels();
  initCalendar();
  initLightbox();

  /* ===== Like (Upvote) — calls Halo tracker API ===== */
  function initLikeHandlers(root: Document | HTMLElement = document): void {
    root.querySelectorAll<HTMLElement>(".moment-like").forEach(function (btn) {
      const bound = btn as HTMLElement & { __likeBound?: boolean };
      if (bound.__likeBound) return;
      bound.__likeBound = true;

      const momentName = btn.getAttribute("data-moment-name") || "";
      if (!momentName) return;

      const storageKey = "cosolar-moment-upvote-" + momentName;
      const countEl = btn.querySelector<HTMLElement>(".moment-like-count");

      // 恢复「已赞」视觉状态。点赞数由服务器端 stats.upvote 权威提供，
      // 不再本地 +1，否则会与服务器已计入的本次点赞重复（显示 2 的问题）。
      if (localStorage.getItem(storageKey)) {
        btn.classList.add("liked");
      }

      btn.addEventListener("click", async function () {
        if (btn.classList.contains("liked")) return;

        // 乐观更新：点击后本地先 +1，给用户即时反馈。
        // 服务器已计入本次点赞，刷新后直接以服务器 stats.upvote 为准（刷新逻辑不再二次 +1）。
        btn.classList.add("liked");
        const count = countEl ? parseInt(countEl.textContent || "0", 10) : 0;
        if (countEl) countEl.textContent = String(count + 1);
        localStorage.setItem(storageKey, "1");

        try {
          const response = await fetch("/apis/api.halo.run/v1alpha1/trackers/upvote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              group: "moment.halo.run",
              plural: "moments",
              name: momentName,
            }),
          });

          if (!response.ok) {
            btn.classList.remove("liked");
            if (countEl) countEl.textContent = String(count); // 失败回滚
            localStorage.removeItem(storageKey);
          }
        } catch {
          btn.classList.remove("liked");
          if (countEl) countEl.textContent = String(count); // 失败回滚
          localStorage.removeItem(storageKey);
        }
      });
    });
  }

  /* ===== Share — copy link / native share ===== */
  function initShareHandlers(root: Document | HTMLElement = document): void {
    root.querySelectorAll<HTMLElement>(".moment-share").forEach(function (btn) {
      const bound = btn as HTMLElement & { __shareBound?: boolean };
      if (bound.__shareBound) return;
      bound.__shareBound = true;

      btn.addEventListener("click", function () {
        const rawUrl = btn.getAttribute("data-share-url") || "";
        if (!rawUrl) return;
        const fullUrl = rawUrl.startsWith("http") ? rawUrl : window.location.origin + rawUrl;
        const span = btn.querySelector("span");
        const originalText = span ? span.textContent : "";

        if ((navigator as any).share) {
          (navigator as any).share({ url: fullUrl, title: document.title }).catch(() => {});
        } else if ((navigator as any).clipboard) {
          (navigator as any).clipboard.writeText(fullUrl).then(function () {
            if (span) span.textContent = "已复制";
            setTimeout(function () {
              if (span) span.textContent = originalText;
            }, 1500);
          });
        } else {
          // Fallback: select and copy
          const input = document.createElement("input");
          input.value = fullUrl;
          document.body.appendChild(input);
          input.select();
          try { document.execCommand("copy"); } catch {}
          document.body.removeChild(input);
          if (span) span.textContent = "已复制";
          setTimeout(function () {
            if (span) span.textContent = originalText;
          }, 1500);
        }
      });
    });
  }

  initLikeHandlers();
  initShareHandlers();

  /* ===== AJAX Load More ===== */
  const loadMoreBtn = document.querySelector<HTMLElement>("[data-moment-load-more]");
  if (!loadMoreBtn) return;

  const grid = document.getElementById("momentGrid");
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

        // Append new moment cards
        const newCards = doc.querySelectorAll("#momentGrid .moment-card");
        newCards.forEach(function (card) {
          grid.appendChild(card);
        });

        updateRelativeTimes();
        initShareHandlers(grid);
        initLikeHandlers(grid);
        // Enhance newly loaded feed card levels
        initFeedCardLevels(grid);

        // Update or remove load-more button
        const newBtn = doc.querySelector<HTMLElement>("[data-moment-load-more]");
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
})();
