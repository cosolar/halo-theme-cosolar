// Post page — TOC generation with accordion & scroll spy
(function () {
  "use strict";

  const tocNav = document.getElementById("tocNav");
  if (!tocNav) return;

  const articleContent = document.querySelector(".prose");
  if (!articleContent) return;

  // Extract headings (h2, h3, h4)
  const headings = articleContent.querySelectorAll("h2, h3, h4");
  if (headings.length === 0) {
    tocNav.innerHTML = '<div class="toc-empty">本文无目录</div>';
    return;
  }

  // Build a flat list with level info
  interface HeadingInfo {
    el: Element;
    id: string;
    level: number; // 2, 3, or 4
    text: string;
    index: number;
  }

  const headingList: HeadingInfo[] = [];
  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id =
        "heading-" +
        index +
        "-" +
        heading
          .textContent!.replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, "")
          .slice(0, 30);
    }
    const level = parseInt(heading.tagName.substring(1), 10);
    headingList.push({
      el: heading,
      id: heading.id,
      level: level,
      text: heading.textContent || "",
      index: index,
    });
  });

  // Find parent index for each heading (nearest preceding heading with level-1)
  function findParentIndex(idx: number): number {
    const targetLevel = headingList[idx].level - 1;
    for (let i = idx - 1; i >= 0; i--) {
      if (headingList[i].level === targetLevel) {
        return i;
      }
    }
    return -1;
  }

  // Build nested HTML structure
  // Group: h2 items are top-level, h3 are children of h2, h4 are children of h3
  const tocLinks: { link: HTMLAnchorElement; item: HTMLElement; level: number }[] = [];
  const groupWrappers: { [key: number]: HTMLElement } = {}; // index -> children container

  headingList.forEach((info, idx) => {
    const item = document.createElement("div");
    item.className = "toc-item toc-level-" + info.level;
    item.dataset.index = String(idx);

    const link = document.createElement("a");
    link.href = "#" + info.id;
    link.textContent = info.text;
    link.className = "toc-link toc-h" + info.level;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.getElementById(info.id);
      if (target) {
        const headerHeight = 80;
        const targetPos = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: targetPos, behavior: "smooth" });
      }
    });

    item.appendChild(link);
    tocLinks.push({ link, item, level: info.level });

    if (info.level === 2) {
      // Top level — add directly to nav
      tocNav.appendChild(item);
    } else {
      // Find parent
      const parentIdx = findParentIndex(idx);
      if (parentIdx >= 0) {
        // Get or create children container for the parent
        let container = groupWrappers[parentIdx];
        if (!container) {
          container = document.createElement("div");
          container.className = "toc-children";
          groupWrappers[parentIdx] = container;
          tocLinks[parentIdx].item.appendChild(container);
        }
        container.appendChild(item);
      } else {
        tocNav.appendChild(item);
      }
    }
  });

  // Accordion: expand only the active section's children
  function setActive(idx: number): void {
    // Expand: the active item itself, and all its ancestors' children containers
    const expandSet = new Set<number>();
    let current = idx;
    while (current >= 0) {
      expandSet.add(current);
      // Find parent
      const parent = findParentIndex(current);
      if (parent < 0) break;
      current = parent;
    }

    // Toggle containers
    Object.keys(groupWrappers).forEach(function (key) {
      const parentIdx = parseInt(key, 10);
      const container = groupWrappers[parentIdx];
      if (expandSet.has(parentIdx)) {
        container.classList.add("expanded");
        tocLinks[parentIdx].item.classList.add("expanded");
      } else {
        container.classList.remove("expanded");
        tocLinks[parentIdx].item.classList.remove("expanded");
      }
    });

    // Highlight active link
    tocLinks.forEach(function (entry, i) {
      entry.link.classList.toggle("active", i === idx);
    });
  }

  // Initialize: expand first h2's children by default
  setActive(0);

  // Scroll spy
  const observer = new IntersectionObserver(
    function (entries) {
      // Find the topmost intersecting heading
      let topIdx = -1;
      let topY = Infinity;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute("data-toc-idx") || "-1", 10);
          if (idx >= 0) {
            const rect = entry.boundingClientRect;
            if (rect.top < topY) {
              topY = rect.top;
              topIdx = idx;
            }
          }
        }
      });
      if (topIdx >= 0) {
        setActive(topIdx);
      }
    },
    {
      rootMargin: "-80px 0px -70% 0px",
      threshold: 0,
    },
  );

  // Store index on heading elements for observer callback
  headingList.forEach(function (info, idx) {
    info.el.setAttribute("data-toc-idx", String(idx));
    observer.observe(info.el);
  });

  // ===== Upvote Button — calls Halo upvote API =====
  const upvoteBtn = document.getElementById("upvoteBtn") as HTMLElement | null;
  const upvoteCount = document.getElementById("upvoteCount") as HTMLElement | null;

  if (upvoteBtn && upvoteCount) {
    const postName = upvoteBtn.dataset.post || "";
    const storageKey = "cosolar-upvote-" + postName;

    // Restore liked state from localStorage
    if (localStorage.getItem(storageKey)) {
      upvoteBtn.classList.add("liked");
    }

    upvoteBtn.addEventListener("click", async function () {
      if (upvoteBtn.classList.contains("liked")) {
        return; // Already liked, no unvote
      }

      // Optimistic UI update
      upvoteBtn.classList.add("liked");
      const count = parseInt(upvoteCount.textContent || "0", 10);
      upvoteCount.textContent = String(count + 1);
      localStorage.setItem(storageKey, "1");

      // Call Halo upvote API
      // 官方接口：POST /apis/api.halo.run/v1alpha1/trackers/upvote
      // Body: { group, plural, name } —— 文章 group=content.halo.run，plural=posts
      try {
        const response = await fetch("/apis/api.halo.run/v1alpha1/trackers/upvote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            group: "content.halo.run",
            plural: "posts",
            name: postName,
          }),
        });

        if (!response.ok) {
          // Revert on failure
          upvoteBtn.classList.remove("liked");
          upvoteCount.textContent = String(count);
          localStorage.removeItem(storageKey);
          showToast("点赞失败，请稍后重试");
        }
      } catch (err) {
        // Revert on network error
        upvoteBtn.classList.remove("liked");
        upvoteCount.textContent = String(count);
        localStorage.removeItem(storageKey);
        showToast("网络错误，请稍后重试");
      }
    });
  }

  // ===== Comment Button — scroll to comments =====
  const commentBtn = document.getElementById("commentBtn");
  if (commentBtn) {
    commentBtn.addEventListener("click", function () {
      // 评论插件渲染后的容器：halo-comment-widget Web Component，或其外层包裹 div
      const commentSection = document.querySelector(
        "halo-comment-widget, .halo-comment-widget, halo\\:comment, [data-comment]",
      ) as HTMLElement | null;
      if (commentSection) {
        const targetPos = commentSection.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: targetPos, behavior: "smooth" });
      } else {
        // 兜底：评论尚未加载时，滚动到文章内容底部
        const article = document.querySelector(".article-detail, .content-area");
        if (article) {
          const pos = (article as HTMLElement).getBoundingClientRect().bottom + window.scrollY - 80;
          window.scrollTo({ top: pos, behavior: "smooth" });
        }
      }
    });
  }

  // ===== Share Button =====
  const shareBtn = document.getElementById("shareBtn");
  const shareMenu = document.getElementById("shareMenu");

  if (shareBtn && shareMenu) {
    shareBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      shareMenu.classList.toggle("show");
    });

    document.addEventListener("click", function () {
      shareMenu.classList.remove("show");
    });

    shareMenu.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    // Share items
    const shareItems = shareMenu.querySelectorAll(".share-item");
    const shareUrl = window.location.href;
    const shareTitle = document.title;

    shareItems.forEach(function (item) {
      item.addEventListener("click", function () {
        const type = (item as HTMLElement).dataset.share;
        if (type === "weibo") {
          window.open(
            "https://service.weibo.com/share/share.php?url=" +
              encodeURIComponent(shareUrl) +
              "&title=" +
              encodeURIComponent(shareTitle),
            "_blank",
          );
        } else if (type === "wechat") {
          // For WeChat, copy the link and prompt
          copyToClipboard(shareUrl);
          showToast("链接已复制，请在微信中粘贴分享");
        } else if (type === "copy") {
          copyToClipboard(shareUrl);
          showToast("链接已复制到剪贴板");
        }
        shareMenu.classList.remove("show");
      });
    });
  }

  function copyToClipboard(text: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function showToast(message: string): void {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText =
      "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);" +
      "padding:10px 20px;background:#1e293b;color:#fff;border-radius:8px;" +
      "font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);" +
      "opacity:0;transition:opacity 0.3s;";
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "1";
    }, 10);
    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  // ===== Back to Top Button =====
  // 顶部附近（≤400px）显示禁用态，超过 400px 才可点击回顶
  const backtopBtn = document.getElementById("backtopBtn");
  if (backtopBtn) {
    const btn = backtopBtn;
    function updateBacktopState(): void {
      if (window.scrollY > 400) {
        btn.classList.add("show");
        btn.classList.remove("disabled");
        btn.removeAttribute("aria-disabled");
      } else {
        btn.classList.add("show", "disabled");
        btn.setAttribute("aria-disabled", "true");
      }
    }
    updateBacktopState();
    window.addEventListener("scroll", updateBacktopState, { passive: true });

    btn.addEventListener("click", function () {
      if (btn.classList.contains("disabled")) return;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ===== 字数 & 阅读时长（Halo 无原生字段，前端从 .prose 文本计算）=====
  // 中文字符按字计（300 字/分），英文单词按词计（200 词/分），合计折算分钟数
  function fillReadingStats(): void {
    const wcEl = document.getElementById("postWordCount");
    const rtEl = document.getElementById("postReadTime");
    if (!wcEl || !rtEl || !articleContent) return;

    const text = (articleContent as HTMLElement).innerText || articleContent.textContent || "";
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9]+/g) || [])
      .length;
    const total = chineseChars + englishWords;
    if (total === 0) return;

    // 阅读速度：中文 300 字/分，英文 200 词/分，取加权平均
    const minutes = Math.max(1, Math.round(chineseChars / 300 + englishWords / 200));

    const wcText = wcEl.querySelector(".word-count-text");
    const rtText = rtEl.querySelector(".read-time-text");
    if (wcText) wcText.textContent = total + " 字";
    if (rtText) rtText.textContent = "约 " + minutes + " 分钟";
    wcEl.removeAttribute("hidden");
    rtEl.removeAttribute("hidden");
  }
  fillReadingStats();

  // ===== 阅读进度（目录按钮百分比 + 横条上方进度条）=====
  const tocPercent = document.getElementById("tocPercent");
  const readingProgress = document.getElementById("readingProgress");
  if (tocPercent && readingProgress) {
    function updateReadingProgress(): void {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const percent =
        docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrolled / docHeight) * 100))) : 0;
      tocPercent!.textContent = percent + "%";
      readingProgress!.style.width = percent + "%";
    }
    updateReadingProgress();
    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", updateReadingProgress, { passive: true });
  }

  // ===== 移动端 TOC 抽屉（≤768px：FAB 触发底部抽屉，选章节跳转后自动关闭）=====
  initMobileTocDrawer(headingList);

  // 代码高亮由 Halo plugin-shiki (shiki-code Web Component) 负责，主题不再调用 Prism
})();

function initMobileTocDrawer(
  headingList: { el: Element; id: string; text: string; level: number }[],
): void {
  const tocBtn = document.getElementById("tocBtn") as HTMLButtonElement | null;
  const drawer = document.getElementById("tocDrawer") as HTMLElement | null;
  const mask = document.getElementById("tocDrawerMask") as HTMLElement | null;
  const closeBtn = document.getElementById("tocDrawerClose") as HTMLButtonElement | null;
  const drawerNav = document.getElementById("tocDrawerNav") as HTMLElement | null;
  if (!drawer || !mask || !closeBtn || !drawerNav) return;

  // 无目录时隐藏底部横条里的目录按钮
  if (headingList.length === 0) {
    if (tocBtn) tocBtn.style.display = "none";
    return;
  }

  // 复用桌面端已生成的 #tocNav 结构，克隆进抽屉（避免重复构建/scroll-spy 冲突）
  const sourceNav = document.getElementById("tocNav");
  function syncDrawerNav(): void {
    if (!sourceNav) return;
    drawerNav!.innerHTML = "";
    drawerNav!.appendChild(sourceNav.cloneNode(true));
  }

  function openDrawer(): void {
    syncDrawerNav();
    drawer!.classList.add("open");
    mask!.classList.add("show");
    drawer!.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer(): void {
    drawer!.classList.remove("open");
    mask!.classList.remove("show");
    drawer!.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  tocBtn?.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  mask.addEventListener("click", closeDrawer);

  // 抽屉内章节点击：执行跳转后关闭抽屉
  drawerNav.addEventListener("click", function (e) {
    const target = e.target as HTMLElement;
    const link = target.closest("a.toc-link") as HTMLAnchorElement | null;
    if (!link) return;
    e.preventDefault();
    const hash = link.getAttribute("href") || "";
    const id = hash.replace(/^#/, "");
    const heading = document.getElementById(id);
    if (heading) {
      const headerHeight = 80;
      const targetPos = heading.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: targetPos, behavior: "smooth" });
    }
    closeDrawer();
  });
}

// ===== 文章图片查看器（点击放大、滚轮缩放、拖动平移、双击复位、点击关闭）=====
function initImageViewer(): void {
  const prose = document.querySelector(".prose");
  if (!prose) return;

  // 创建查看器 DOM
  const viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.innerHTML =
    '<div class="image-viewer-tip">滚轮缩放 · 拖动平移 · 双击复位 · 点击关闭</div>';
  const img = document.createElement("img");
  viewer.appendChild(img);
  document.body.appendChild(viewer);

  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTX = 0;
  let startTY = 0;
  let moved = false;

  function applyTransform(): void {
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function open(src: string): void {
    img.src = src;
    scale = 1;
    x = 0;
    y = 0;
    applyTransform();
    viewer.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close(): void {
    viewer.classList.remove("open");
    document.body.style.overflow = "";
  }

  // 点击正文图片
  prose.addEventListener("click", function (e) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      e.preventDefault();
      open((target as HTMLImageElement).src);
    }
  });

  // 点击查看器关闭（拖动后不关）
  viewer.addEventListener("click", function () {
    if (moved) {
      moved = false;
      return;
    }
    close();
  });

  // 滚轮缩放
  viewer.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      scale = Math.min(5, Math.max(0.5, scale + delta));
      applyTransform();
    },
    { passive: false },
  );

  // 双击复位
  viewer.addEventListener("dblclick", function (e) {
    e.preventDefault();
    scale = 1;
    x = 0;
    y = 0;
    applyTransform();
  });

  // 拖动平移
  viewer.addEventListener("mousedown", function (e) {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startTX = x;
    startTY = y;
    e.preventDefault();
  });
  window.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    x = startTX + dx;
    y = startTY + dy;
    applyTransform();
  });
  window.addEventListener("mouseup", function () {
    dragging = false;
  });

  // ESC 关闭
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && viewer.classList.contains("open")) close();
  });
}
initImageViewer();
