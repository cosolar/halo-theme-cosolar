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
     Photo Grid — client-rendered via REST API
     ============================================ */
  interface PhotoItem {
    metadata: { name: string };
    spec: { displayName?: string; url?: string; cover?: string; groupName?: string };
  }

  interface PhotoListResult {
    page?: number;
    size?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    items?: PhotoItem[];
  }

  function detailUrl(name: string): string {
    const path = window.location.pathname.split("?")[0];
    return path.replace(/\/$/, "") + "/" + encodeURIComponent(name);
  }

  function renderPhotoCard(
    photo: PhotoItem,
    isLoggedIn: boolean,
    showActions: boolean
  ): HTMLElement {
    const spec = photo.spec || ({} as PhotoItem["spec"]);
    const meta = photo.metadata || ({} as { name: string });
    const imgUrl = spec.url && spec.url !== "" ? spec.url : (spec.cover || "");
    const name = meta.name || "";
    const displayName = spec.displayName || "";
    const groupName = spec.groupName || "";

    const a = document.createElement("a");
    a.className = "photo-card";
    a.href = detailUrl(name);

    const img = document.createElement("img");
    img.className = "photo-card-img";
    img.src = imgUrl;
    img.alt = displayName;
    img.loading = "lazy";
    a.appendChild(img);

    const zoom = document.createElement("span");
    zoom.className = "photo-zoom";
    zoom.setAttribute("role", "button");
    zoom.setAttribute("tabindex", "0");
    zoom.setAttribute("data-lightbox", "");
    zoom.setAttribute("data-lightbox-src", imgUrl);
    zoom.setAttribute("data-lightbox-title", displayName);
    zoom.setAttribute("aria-label", "查看大图");
    zoom.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
    a.appendChild(zoom);

    if (isLoggedIn && showActions) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "photo-delete-btn";
      del.setAttribute("data-photo-name", name);
      del.setAttribute("data-photo-title", displayName);
      del.setAttribute("aria-label", "删除照片");
      del.setAttribute("title", "删除");
      del.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      a.appendChild(del);
    }

    const overlay = document.createElement("div");
    overlay.className = "photo-card-overlay";
    const titleEl = document.createElement("span");
    titleEl.className = "photo-card-title";
    titleEl.textContent = displayName;
    overlay.appendChild(titleEl);
    if (groupName) {
      const metaEl = document.createElement("span");
      metaEl.className = "photo-card-meta";
      metaEl.textContent = groupName;
      overlay.appendChild(metaEl);
    }
    a.appendChild(overlay);

    return a;
  }

  function initPhotos(): void {
    const grid = document.getElementById("photoGrid");
    if (!grid) return;
    const pager = document.getElementById("photoPager");
    const prevBtn = document.getElementById("photoPrev") as HTMLButtonElement | null;
    const nextBtn = document.getElementById("photoNext") as HTMLButtonElement | null;
    const pageCur = document.getElementById("photoPageCur");
    const pageTotal = document.getElementById("photoPageTotal");
    const emptyState = document.getElementById("photoEmptyState");
    const isLoggedIn = grid.getAttribute("data-logged-in") === "true";
    const showActions = grid.getAttribute("data-show-actions") === "true";

    const pageSize = 12;
    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get("page") || "1", 10);
    if (!Number.isFinite(currentPage) || currentPage < 1) currentPage = 1;
    let totalPages = 1;
    let hasPrevious = false;
    let hasNext = false;
    let loading = false;

    function buildQuery(page: number): string {
      const p = new URLSearchParams(window.location.search);
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("size", String(pageSize));
      if (p.get("ungrouped") === "true") q.set("ungrouped", "true");
      const group = p.get("group");
      if (group) q.set("group", group);
      const tag = p.get("tag");
      if (tag) q.set("tag", tag);
      return q.toString();
    }

    function setEmpty(show: boolean): void {
      if (emptyState) emptyState.style.display = show ? "" : "none";
    }

    function updatePager(): void {
      if (!pager) return;
      if (totalPages <= 1) {
        pager.style.display = "none";
        return;
      }
      pager.style.display = "";
      if (pageCur) pageCur.textContent = String(currentPage);
      if (pageTotal) pageTotal.textContent = String(totalPages);
      if (prevBtn) prevBtn.disabled = !hasPrevious;
      if (nextBtn) nextBtn.disabled = !hasNext;
    }

    function fetchAndRender(): void {
      if (loading) return;
      loading = true;
      if (pager) pager.classList.add("loading");

      const url =
        "/apis/api.photo.halo.run/v1alpha1/photos?" +
        buildQuery(currentPage) +
        "&_t=" +
        Date.now();

      fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
        .then(function (res: Response) {
          if (!res.ok) throw new Error("Network error");
          return res.json();
        })
        .then(function (data: PhotoListResult) {
          grid!.innerHTML = "";
          const items = data.items || [];
          items.forEach(function (p) {
            grid!.appendChild(renderPhotoCard(p, isLoggedIn, showActions));
          });

          const total = data.total || 0;
          totalPages =
            typeof data.totalPages === "number" && data.totalPages > 0
              ? data.totalPages
              : Math.max(1, Math.ceil(total / pageSize));
          hasNext =
            typeof data.hasNext === "boolean"
              ? data.hasNext
              : currentPage < totalPages;
          hasPrevious =
            typeof data.hasPrevious === "boolean"
              ? data.hasPrevious
              : currentPage > 1;

          setEmpty(items.length === 0);
          updatePager();
        })
        .catch(function () {
          setEmpty(true);
          updatePager();
        })
        .finally(function () {
          loading = false;
          if (pager) pager.classList.remove("loading");
        });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (currentPage > 1) {
          currentPage -= 1;
          fetchAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (currentPage < totalPages) {
          currentPage += 1;
          fetchAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    window.addEventListener("cosolar:photos-changed", function () {
      fetchAndRender();
    });

    fetchAndRender();
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
     Tag Count (via REST API)
     ============================================ */
  function initTagCount(): void {
    refreshTagCount();
  }

  /* ============================================
     Refresh Stats (after upload / delete)
     Re-fetches groups + tags from public API and
     updates all [data-stat] / [data-group-name] elements.
     ============================================ */
  interface PhotoGroup {
    metadata: { name: string };
    spec: { displayName: string };
    status: { photoCount?: number } | null;
  }

  function syncUngroupedVisibility(): void {
    const first = document.querySelector<HTMLElement>('[data-stat="ungrouped-photos"]');
    const count = first ? parseInt(first.textContent || "0", 10) || 0 : 0;
    const visible = count > 0;
    // Top filter bar link
    document.querySelectorAll<HTMLElement>(".photo-group").forEach(function (a) {
      if ((a.getAttribute("href") || "").indexOf("ungrouped") !== -1) {
        a.style.display = visible ? "" : "none";
      }
    });
    // Sidebar widget list item
    document
      .querySelectorAll<HTMLElement>(".widget-photo-group")
      .forEach(function (a) {
        if ((a.getAttribute("href") || "").indexOf("ungrouped") !== -1) {
          const li = a.closest<HTMLElement>("li");
          if (li) li.style.display = visible ? "" : "none";
        }
      });
  }

  function refreshStats(): void {
    // Fetch global photo total (ungrouped-aware) and groups in parallel
    var photosApi = fetch("/apis/api.photo.halo.run/v1alpha1/photos?page=1&size=1&_t=" + Date.now(), { cache: "no-store" })
      .then(function (res: Response) {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(function (data: { total?: number }) {
        return (data && data.total) || 0;
      })
      .catch(function () { return 0; });

    var groupsApi = fetch("/apis/api.photo.halo.run/v1alpha1/photogroups")
      .then(function (res: Response) {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .catch(function () { return null; });

    Promise.all([photosApi, groupsApi]).then(function (results) {
      var globalTotal = results[0] as number;
      var groups = results[1] as PhotoGroup[] | null;
      if (!Array.isArray(groups)) return;

      // Sum grouped photo counts
      var groupedTotal = 0;
      groups.forEach(function (g) {
        groupedTotal += (g.status && g.status.photoCount) || 0;
      });

      // Update all total-photos elements with real global total
      document
        .querySelectorAll<HTMLElement>('[data-stat="total-photos"]')
        .forEach(function (el) {
          el.textContent = String(globalTotal);
        });

      // Ungrouped count = global total - sum of all group counts
      var ungrouped = globalTotal - groupedTotal;
      document
        .querySelectorAll<HTMLElement>('[data-stat="ungrouped-photos"]')
        .forEach(function (el) {
          el.textContent = String(ungrouped >= 0 ? ungrouped : 0);
        });
      syncUngroupedVisibility();

      // Update all group-count elements
      document
        .querySelectorAll<HTMLElement>('[data-stat="group-count"]')
        .forEach(function (el) {
          el.textContent = String(groups!.length);
        });

      // Update per-group counts
      groups!.forEach(function (g) {
        var count = (g.status && g.status.photoCount) || 0;
        var name = g.metadata.name;
        document
          .querySelectorAll<HTMLElement>('small[data-group-name="' + name + '"]')
          .forEach(function (el) {
            el.textContent = String(count);
          });
      });
    });

    // Refresh tag count
    refreshTagCount();
  }

  function refreshTagCount(): void {
    const el = document.getElementById("photoTagCount");
    if (!el) return;

    fetch("/apis/api.photo.halo.run/v1alpha1/tags")
      .then(function (res: Response) {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(function (tags: Array<{ name: string; photoCount: number }>) {
        if (Array.isArray(tags)) {
          el.textContent = String(tags.length);
        }
      })
      .catch(function () {
        /* keep default 0 on failure */
      });
  }

  /* ============================================
     Toast Notification
     ============================================ */
  let toastTimer: number | undefined;
  function showToast(message: string, type?: "success" | "error" | "info"): void {
    const toast = document.getElementById("photoToast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = "photo-toast" + (type ? " photo-toast--" + type : "");
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 3000);
  }

  /* ============================================
     Upload (via Console API) — Modal with group selection
     ============================================ */
  function initUpload(): void {
    const uploadBtn = document.getElementById("photoUploadBtn");
    const modal = document.getElementById("photoUploadModal");
    const groupSelect = document.getElementById("photoUploadGroup") as HTMLSelectElement | null;
    const dropzone = document.getElementById("photoDropzone");
    const fileInput = document.getElementById("photoModalFileInput") as HTMLInputElement | null;
    const fileListEl = document.getElementById("photoUploadFilelist");
    const okBtn = document.getElementById("photoUploadOk") as HTMLButtonElement | null;

    if (!uploadBtn || !modal || !groupSelect || !dropzone || !fileInput || !fileListEl || !okBtn) {
      return;
    }

    const progressWrap = document.getElementById("photoUploadProgress");
    const progressFill = document.getElementById("photoUploadProgressFill");
    const progressText = document.getElementById("photoUploadProgressText");

    let pendingFiles: File[] = [];

    // Open modal
    uploadBtn.addEventListener("click", function () {
      openUploadModal();
    });

    function openUploadModal(): void {
      // Reset state
      pendingFiles = [];
      renderFileList();
      fileInput!.value = "";
      groupSelect!.value = "";

      // Pre-select current group if present
      const params = new URLSearchParams(window.location.search);
      const cur = params.get("group");
      if (cur) groupSelect!.value = cur;

      updateOkBtn();
      modal!.hidden = false;
      modal!.classList.add("is-open");
    }

    function closeModal(): void {
      modal!.classList.remove("is-open");
      modal!.hidden = true;
    }

    // Close on backdrop / cancel
    modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    function updateOkBtn(): void {
      okBtn!.disabled = pendingFiles.length === 0;
    }

    function renderFileList(): void {
      fileListEl!.innerHTML = "";
      pendingFiles.forEach(function (file, idx) {
        const li = document.createElement("li");
        li.className = "photo-upload-fileitem";

        const info = document.createElement("span");
        info.className = "photo-upload-fileinfo";
        info.textContent = file.name + " (" + formatSize(file.size) + ")";

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "photo-upload-fileremove";
        removeBtn.setAttribute("aria-label", "移除");
        removeBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        removeBtn.addEventListener("click", function () {
          pendingFiles.splice(idx, 1);
          renderFileList();
          updateOkBtn();
        });

        li.appendChild(info);
        li.appendChild(removeBtn);
        fileListEl!.appendChild(li);
      });
    }

    function formatSize(bytes: number): string {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    // Click dropzone to open file picker
    dropzone.addEventListener("click", function (e) {
      if (e.target === fileInput) return;
      fileInput!.click();
    });

    // File selected via picker
    fileInput.addEventListener("change", function () {
      if (!fileInput.files) return;
      Array.prototype.forEach.call(fileInput.files, function (f: File) {
        pendingFiles.push(f);
      });
      renderFileList();
      updateOkBtn();
      fileInput.value = "";
    });

    // Drag & drop
    const dragOverEvents: Array<"dragenter" | "dragover"> = ["dragenter", "dragover"];
    dragOverEvents.forEach(function (evt) {
      dropzone!.addEventListener(evt, function (e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dropzone!.classList.add("is-dragover");
      });
    });

    const dragLeaveEvents: Array<"dragleave" | "drop"> = ["dragleave", "drop"];
    dragLeaveEvents.forEach(function (evt) {
      dropzone!.addEventListener(evt, function (e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dropzone!.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", function (e: DragEvent) {
      const dt = e.dataTransfer;
      if (!dt || !dt.files) return;
      Array.prototype.forEach.call(dt.files, function (f: File) {
        pendingFiles.push(f);
      });
      renderFileList();
      updateOkBtn();
    });

    // Start upload
    okBtn.addEventListener("click", function () {
      if (!pendingFiles.length) return;

      const group = groupSelect!.value;
      closeModal();

      const fileList = pendingFiles.slice();
      let completed = 0;
      let failed = 0;

      if (progressWrap) progressWrap.hidden = false;
      if (progressFill) progressFill.style.width = "0%";
      if (progressText) progressText.textContent = "上传中... (0/" + fileList.length + ")";

      function updateProgress(): void {
        const pct = Math.round((completed / fileList.length) * 100);
        if (progressFill) progressFill.style.width = pct + "%";
        if (progressText) {
          progressText.textContent = "上传中... (" + completed + "/" + fileList.length + ")";
        }
      }

      function uploadOne(file: File): Promise<void> {
        const formData = new FormData();
        formData.append("file", file);
        if (group) formData.append("group", group);

        return fetch("/apis/console.api.photo.halo.run/v1alpha1/photos/upload", {
          method: "POST",
          body: formData,
        }).then(function (res: Response) {
          if (!res.ok) throw new Error("Upload failed: " + res.status);
        });
      }

      function next(idx: number): void {
        if (idx >= fileList.length) {
          if (progressWrap) progressWrap.hidden = true;
          if (failed > 0) {
            showToast(
              "上传完成：" + completed + " 张成功，" + failed + " 张失败",
              "error"
            );
          } else {
            showToast("上传成功：" + completed + " 张照片", "success");
          }
          window.setTimeout(function () {
            window.location.reload();
          }, 1200);
          return;
        }

        uploadOne(fileList[idx])
          .then(function () {
            completed++;
          })
          .catch(function () {
            failed++;
            completed++;
          })
          .then(function () {
            updateProgress();
            next(idx + 1);
          });
      }

      next(0);
    });
  }

  /* ============================================
     Confirm Dialog (replaces native window.confirm)
     ============================================ */
  function confirmDialog(title: string, desc: string): Promise<boolean> {
    return new Promise(function (resolve) {
      const modal = document.getElementById("photoConfirmModal");
      const titleEl = document.getElementById("photoConfirmTitle");
      const descEl = document.getElementById("photoConfirmDesc");
      const okBtn = document.getElementById("photoConfirmOk");
      if (!modal || !titleEl || !descEl || !okBtn) {
        resolve(window.confirm(title + "\n" + desc));
        return;
      }

      titleEl.textContent = title;
      descEl.textContent = desc;
      modal.hidden = false;
      modal.classList.add("is-open");

      function cleanup(): void {
        modal!.classList.remove("is-open");
        modal!.hidden = true;
        okBtn!.removeEventListener("click", onOk);
        modal!.querySelectorAll("[data-modal-close]").forEach(function (el) {
          el.removeEventListener("click", onCancel);
        });
      }

      function onOk(): void {
        cleanup();
        resolve(true);
      }

      function onCancel(): void {
        cleanup();
        resolve(false);
      }

      okBtn.addEventListener("click", onOk);
      modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
        el.addEventListener("click", onCancel);
      });
    });
  }

  /* ============================================
     Delete Mode Toggle + Delete
     ============================================ */
  function initManageMode(): void {
    const toggleBtn = document.getElementById("photoDeleteToggle");
    const grid = document.getElementById("photoGrid");
    if (!toggleBtn || !grid) return;

    let deleteMode = false;

    toggleBtn.addEventListener("click", function () {
      deleteMode = !deleteMode;
      toggleBtn.classList.toggle("active", deleteMode);
      grid!.classList.toggle("manage-mode", deleteMode);
      const spanEl = toggleBtn.querySelector("span");
      if (spanEl) spanEl.textContent = deleteMode ? "退出删除" : "删除";
    });

    // Delegate delete button clicks
    document.addEventListener("click", function (e: MouseEvent) {
      const deleteBtn = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".photo-delete-btn"
      );
      if (!deleteBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const photoName = deleteBtn.getAttribute("data-photo-name") || "";
      const photoTitle = deleteBtn.getAttribute("data-photo-title") || "";

      if (!photoName) return;

      confirmDialog("删除照片", "确定要删除「" + photoTitle + "」吗？删除后不可恢复。").then(
        function (confirmed: boolean) {
          if (!confirmed) return;

          deleteBtn.classList.add("deleting");

          fetch(
            "/apis/console.api.photo.halo.run/v1alpha1/photos/" +
              encodeURIComponent(photoName) +
              "?withAttachment=true",
            { method: "DELETE" }
          )
            .then(function (res: Response) {
              if (!res.ok) throw new Error("Delete failed: " + res.status);
              showToast("照片已删除", "success");
              // Remove card from DOM immediately for instant feedback.
              // Do NOT re-fetch the whole grid here: the backend read may still
              // return the deleted photo (write propagation delay / read cache),
              // which would re-add the card and look like "nothing happened".
              const card = deleteBtn.closest<HTMLElement>(".photo-card");
              // Read the card's group name (if any) BEFORE removing the card
              const groupMeta =
                card && card.querySelector<HTMLElement>(".photo-card-meta");
              const cardGroupName = groupMeta ? groupMeta.textContent || "" : "";
              if (card) card.remove();
              // If this page is now empty, show empty state and hide pager
              const gridEl = document.getElementById("photoGrid");
              if (gridEl && !gridEl.querySelector(".photo-card")) {
                const emptyState = document.getElementById("photoEmptyState");
                if (emptyState) emptyState.style.display = "";
                const pagerEl = document.getElementById("photoPager");
                if (pagerEl) pagerEl.style.display = "none";
              }
              // Decrement total photos count in DOM (one photo deleted)
              var tpEl = document.querySelector<HTMLElement>('[data-stat="total-photos"]');
              if (tpEl) {
                var tp = parseInt(tpEl.textContent || "0", 10) || 0;
                tpEl.textContent = String(tp > 0 ? tp - 1 : 0);
              }
              // Decrement the relevant group/ungrouped count in DOM for instant
              // feedback. We intentionally do NOT call refreshStats() here: its
              // async result returns stale backend data (write propagation delay)
              // and would overwrite these decrements, making it look unchanged.
              if (cardGroupName) {
                document
                  .querySelectorAll<HTMLElement>(
                    '[data-group-name="' + cardGroupName + '"]'
                  )
                  .forEach(function (el) {
                    var n = parseInt(el.textContent || "0", 10) || 0;
                    el.textContent = String(n > 0 ? n - 1 : 0);
                  });
              } else {
                var ugEl = document.querySelector<HTMLElement>(
                  '[data-stat="ungrouped-photos"]'
                );
                if (ugEl) {
                  var ug = parseInt(ugEl.textContent || "0", 10) || 0;
                  ugEl.textContent = String(ug > 0 ? ug - 1 : 0);
                }
                // Hide the "不分组" option if it reached zero
                syncUngroupedVisibility();
              }
            })
            .catch(function () {
              deleteBtn.classList.remove("deleting");
              showToast("删除失败，请重试", "error");
            });
        }
      );
    });
  }

  /* ============================================
     Photo Detail: Fetch Group Display Name
     ============================================ */
  function initPhotoGroupName(): void {
    var el = document.getElementById("photoGroupName");
    if (!el) return;
    var groupName = el.getAttribute("data-group");
    if (!groupName) return;
    var el2 = el!;
    var gn = groupName!;

    fetch("/apis/api.photo.halo.run/v1alpha1/photogroups")
      .then(function (res: Response) {
        if (!res.ok) throw new Error("Network error");
        return res.json();
      })
      .then(function (groups: Array<{ metadata: { name: string }; spec: { displayName: string } }>) {
        if (!Array.isArray(groups)) return;
        var found = groups.find(function (g) { return g.metadata.name === gn; });
        if (found && found.spec.displayName) {
          el2.textContent = found.spec.displayName;
        } else {
          el2.textContent = gn.replace(/^photo-group-/, "");
        }
      })
      .catch(function () {
        el2.textContent = gn.replace(/^photo-group-/, "");
      });
  }

  /* ============================================
     Init
     ============================================ */
  initLightbox();
  initViewToggle();
  initPhotos();
  initCopyButtons();
  initTagCount();
  initUpload();
  initManageMode();
  initPhotoGroupName();
  refreshStats();
})();
