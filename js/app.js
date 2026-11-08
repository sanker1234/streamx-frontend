/**
 * StreamX v2 — app.js
 * Main application controller.
 * Orchestrates TMDB data → UI rendering.
 * ZERO hard-coded content. All content flows from TMDB API responses.
 */

// Runtime error boundary visualizer for easy debugging
window.addEventListener('error', function (e) {
  console.error("Runtime error caught:", e);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.background = '#e50914';
  container.style.color = '#fff';
  container.style.padding = '15px';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 5px 20px rgba(0,0,0,0.5)';
  container.style.zIndex = '999999';
  container.style.maxWidth = '350px';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.4';
  container.innerHTML = `
    <div style="font-weight:bold; margin-bottom:5px;">⚠️ Frontend Error Detected</div>
    <div>${e.message}</div>
    <div style="color:rgba(255,255,255,0.6); font-size:10px; margin-top:5px;">File: ${e.filename ? e.filename.split('/').pop() : 'unknown'}:${e.lineno || '?'}</div>
    <button onclick="this.parentElement.remove()" style="margin-top:10px; background:rgba(255,255,255,0.2); border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;">Dismiss</button>
  `;
  document.body.appendChild(container);
});

const App = (() => {
  // ── State ─────────────────────────────────────────────────────────────
  let _currentPage = "home";
  let _activeRowId = null;
  let _searchQuery = "";
  let _searchPage = 1;
  let _searchTotal = 1;
  let _searchTimer = null;
  let _heroItems = [];
  let _heroIdx = 0;
  let _heroTimer = null;

  // Dedicated Anime & Donghua Hero Banner State
  let _animeHeroItems = [];
  let _animeHeroIdx = 0;
  let _animeHeroTimer = null;

  let _infiniteState = {}; // rowId → { page, total, loading }
  let _imgObserver = null;

  // Collapsible Left Sidebar & Custom Theme State
  let _sidebarCollapsed = localStorage.getItem("streamx_sidebar_collapsed") === "true";
  let _activeTheme = localStorage.getItem("streamx_theme_preset") || "default";

  // Context-Aware Search State
  let _searchContext = "global"; // "global" | "movie" | "tv" | "anime" | "donghua" | "drama"
  let _searchFilters = {}; // stores active filter values (e.g. genre, year, status, sort)
  let _searchHistory = (() => {
    try { return JSON.parse(localStorage.getItem("streamx_search_history") || "[]"); }
    catch { return []; }
  })();

  // ── Crisp UI SVGs (No emoji as UI icons) ───────────────────────────────
  const _STAR_SVG = `<svg class="star-svg" viewBox="0 0 24 24" width="12" height="12" fill="var(--gold)" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  const _PLAY_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const _PLUS_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
  const _CHECK_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  const _CLOSE_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const _VOLUME_X_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  const _VOLUME_2_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

  // ── Boot ──────────────────────────────────────────────────────────────
  async function init() {
    // 0. Ensure top navigation header is completely visible and clean of stale state
    document.body.classList.remove("has-modal-open", "big-player-active");
    const initTopHdr = document.getElementById("top-header");
    if (initTopHdr) {
      initTopHdr.classList.remove("header-hidden-detail", "hidden");
      initTopHdr.style.removeProperty("display");
      initTopHdr.style.removeProperty("visibility");
      initTopHdr.style.removeProperty("opacity");
      initTopHdr.style.removeProperty("pointer-events");
    }
    _updateActiveNavLinks("home");

    // Show local web server migration warning if page is loaded via file:// protocol
    if (window.location.protocol === "file:") {
      const warningBanner = document.createElement("div");
      warningBanner.id = "local-protocol-warning";
      warningBanner.style.background = "var(--primary)";
      warningBanner.style.color = "#fff";
      warningBanner.style.textAlign = "center";
      warningBanner.style.padding = "10px 20px";
      warningBanner.style.fontSize = "13px";
      warningBanner.style.fontWeight = "600";
      warningBanner.style.position = "sticky";
      warningBanner.style.top = "0";
      warningBanner.style.zIndex = "999999";
      warningBanner.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
      warningBanner.innerHTML = "⚠️ Running via file:// protocol. Direct iframe video playback (e.g. MegaPlay) will return HTTP 410 (Referer restricted). Please load the app using your local web server at <a href='http://localhost:8080/' style='color:#fff; text-decoration:underline; font-weight:700;'>http://localhost:8080/</a>.";
      document.body.prepend(warningBanner);
    }

    // Apply visual preferences theme preset
    if (_activeTheme !== "default") {
      document.body.classList.add(`theme-${_activeTheme}`);
    }

    // Sync sidebar collapse state styling layout
    const sidebar = document.getElementById("desktop-sidebar");
    if (_sidebarCollapsed) {
      document.body.classList.add("sidebar-collapsed");
      sidebar?.classList.add("collapsed");
    }

    // Scroll listener for header transparent-to-obsidian transition & Scroll-to-Top button
    let _scrollTicking = false;
    const updateHeaderScroll = () => {
      if (!_scrollTicking) {
        requestAnimationFrame(() => {
          const topHeader = document.getElementById("top-header");
          if (topHeader) {
            topHeader.classList.toggle("is-scrolled", window.scrollY > 24);
          }
          const topBtn = document.getElementById("scroll-to-top-btn");
          if (topBtn) {
            topBtn.style.display = window.scrollY > 350 ? "inline-flex" : "none";
          }
          _scrollTicking = false;
        });
        _scrollTicking = true;
      }
    };
    window.addEventListener("scroll", updateHeaderScroll, { passive: true });
    updateHeaderScroll();

    _initNavigation();
    _setupLazyObserver();
    _bindGlobalEvents();
    CardPreview.init();
    _updateWLCount();
    _renderHistoryRows();
    _syncUserProfileUI();

    // Routing: listen for hash & popstate changes (browser back/forward & gestures)
    window.addEventListener("hashchange", _handleRoute);
    window.addEventListener("popstate", _handleRoute);

    // Bind click outside search autocomplete history & profile dropdown to close them
    document.addEventListener("click", (e) => {
      const historyDropdown = document.getElementById("search-history");
      const searchWrap = e.target.closest(".search-wrap");
      const mobileSearchBtn = e.target.closest("#mobile-search-btn");
      if (!searchWrap && historyDropdown) {
        historyDropdown.classList.remove("show");
      }
      if (!searchWrap && !mobileSearchBtn && document.getElementById("top-header")?.classList.contains("mobile-search-open")) {
        toggleMobileSearch(false);
      }

      const pDrop = document.getElementById("profile-dropdown-menu");
      const pContainer = document.getElementById("nav-profile-container");
      if (pDrop && pDrop.style.display !== "none" && !pContainer?.contains(e.target)) {
        closeProfileDropdown();
      }
    });

    // Safety fallback: ensure initial CineJoy loader dismisses within 2.5s
    setTimeout(() => {
      _dismissLoader();
    }, 2500);

    // Check for pending play parameters from /play or query params
    const pendingPlay = sessionStorage.getItem("cinejoy_pending_play");
    if (pendingPlay) {
      sessionStorage.removeItem("cinejoy_pending_play");
      if (!window.location.hash || window.location.hash === "#/") {
        window.location.hash = `#/play${pendingPlay.startsWith("?") ? pendingPlay : ("?" + pendingPlay)}`;
      }
    } else if (window.location.search && window.location.search.includes("id=")) {
      if (!window.location.hash || window.location.hash === "#/") {
        window.location.hash = `#/play${window.location.search}`;
      }
    }

    // Parse initial hash before loading home content
    const handled = await _handleRoute();

    if (!handled) {
      await _loadGeneralHomeContent();
    }

    _dismissLoader();

    _initHeroVisibilityObserver();

    // Keyboard shortcut handlers
    document.addEventListener("keydown", (e) => {
      // ⌘K or Ctrl+K or "/" focuses search bar
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        (e.key === "/" &&
          document.activeElement.tagName !== "INPUT" &&
          document.activeElement.tagName !== "TEXTAREA" &&
          document.activeElement.tagName !== "SELECT")
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (e.key === "Escape") {
        const sModal = document.getElementById("search-modal-backdrop");
        if (sModal && sModal.style.display !== "none") {
          toggleSearchModal(false);
          return;
        }
        const bigPlayer = document.getElementById("cinejoy-big-player");
        if (bigPlayer && bigPlayer.style.display !== "none") {
          Player.exitBigWatch();
          return;
        }
        if (document.getElementById("top-header")?.classList.contains("mobile-search-open")) {
          toggleMobileSearch(false);
          return;
        }
      }

      // Video Player keyboard controls (only if modal is open and video player is active)
      const bgModal = document.getElementById("player-modal-bg");
      const isPlayerActive = bgModal && bgModal.style.display !== "none" && document.getElementById("anime-player-wrap")?.style.display !== "none";
      if (isPlayerActive && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "SELECT") {
        const video = document.getElementById("anime-video-player");
        if (video && video.style.display !== "none" && !video.classList.contains("player-hidden")) {
          const key = e.key.toLowerCase();
          if (key === " " || e.code === "Space") {
            e.preventDefault();
            if (video.paused) video.play();
            else video.pause();
            _showToast(video.paused ? "Paused" : "Playing");
            return;
          } else if (key === "arrowleft") {
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 10);
            _showToast("← 10s");
            return;
          } else if (key === "arrowright") {
            e.preventDefault();
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
            _showToast("10s →");
            return;
          } else if (key === "arrowup") {
            e.preventDefault();
            video.volume = Math.min(1.0, video.volume + 0.1);
            _showToast(`Volume: ${Math.round(video.volume * 100)}%`);
            return;
          } else if (key === "arrowdown") {
            e.preventDefault();
            video.volume = Math.max(0.0, video.volume - 0.1);
            _showToast(`Volume: ${Math.round(video.volume * 100)}%`);
            return;
          } else if (key === "f") {
            e.preventDefault();
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(err => console.error(err));
            } else {
              video.requestFullscreen().catch(err => console.error(err));
            }
            return;
          } else if (key === "m") {
            e.preventDefault();
            video.muted = !video.muted;
            _showToast(video.muted ? "Muted" : "Unmuted");
            return;
          } else if (key === "s") {
            e.preventDefault();
            captureScreenshot();
            return;
          } else if (key === "p") {
            e.preventDefault();
            togglePictureInPicture();
            return;
          } else if (key === "t") {
            e.preventDefault();
            toggleTheaterMode();
            return;
          } else if (key === "?" || key === "h") {
            e.preventDefault();
            toggleShortcutHelp();
            return;
          }
        }
      }

      // Escape closes the player details modal, search results, drawer, or reader menus
      if (e.key === "Escape") {
        // Close overlays/drawers inside player first
        const helpOverlay = document.getElementById("anime-help-overlay");
        const miniDrawer = document.getElementById("anime-mini-episodes-drawer");
        if (helpOverlay && helpOverlay.style.display !== "none") {
          helpOverlay.style.display = "none";
          e.stopPropagation();
          return;
        }
        if (miniDrawer && miniDrawer.style.display !== "none") {
          miniDrawer.style.transform = "translateX(100%)";
          setTimeout(() => { miniDrawer.style.display = "none"; }, 300);
          e.stopPropagation();
          return;
        }
        if (_theaterMode) {
          toggleTheaterMode();
          e.stopPropagation();
          return;
        }

        const bg = document.getElementById("player-modal-bg");
        if (bg?._currentAnimeItem) {
          _closeAnimeDetail();
        } else {
          Player.close();
        }

        // Also close autocomplete suggestions on Escape
        document.getElementById("search-history")?.classList.remove("show");

        // If mobile drawer is open, close it
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer?.classList.contains("open")) {
          toggleMobileDrawer();
        }

        // Close disclaimer modal if open
        closeDisclaimerModal();
      }

      // Hero navigation (Home page only)
      if (_currentPage === "home") {
        if (e.key === "ArrowLeft") {
          prevHero();
        }
        if (e.key === "ArrowRight") {
          nextHero();
        }
      }
    });

    document.addEventListener("mousedown", function (e) {
      const slider = e.target.closest(".row-scroll");
      if (!slider) return;

      let isDown = true;
      let startX = e.pageX - slider.offsetLeft;
      let scrollLeft = slider.scrollLeft;

      function mouseMove(e) {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
      }

      function mouseUp() {
        isDown = false;
        document.removeEventListener("mousemove", mouseMove);
        document.removeEventListener("mouseup", mouseUp);
      }

      document.addEventListener("mousemove", mouseMove);
      document.addEventListener("mouseup", mouseUp);
    });

    // Guarantee instant soft keyboard appearance and cursor focus on mobile touch devices
    const searchTriggerElements = [
      document.getElementById("mob-nav-search"),
      document.getElementById("mobile-header-search-btn"),
      document.getElementById("nav-search-btn")
    ].filter(Boolean);

    searchTriggerElements.forEach(btn => {
      const openSearchFast = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSearchModal(true);
      };
      btn.addEventListener("touchstart", openSearchFast, { passive: false });
      btn.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          openSearchFast(e);
        }
      });
      btn.onclick = openSearchFast;
    });
  }


  // ── API key missing banner ─────────────────────────────────────────────
  function _showApiKeyBanner() {
    const banner = document.createElement("div");
    banner.id = "api-banner";
    banner.innerHTML = `
      <strong>API key required</strong>
      Open <code>js/config.js</code> and add your backend key.
      <button onclick="this.parentElement.remove()">Close</button>`;
    document.body.prepend(banner);
  }

  // ── Lazy image observer ───────────────────────────────────────────────
  function _setupLazyObserver() {
    _imgObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute("data-src");
            img.onload = () => img.classList.add("loaded");
            img.onerror = () => {
              img.style.display = "none";
              const fallback = img.nextElementSibling;
              if (fallback && fallback.classList.contains("card-no-img")) {
                fallback.style.display = "flex";
              }
            };
            if (img.complete && img.naturalWidth > 0) {
              img.classList.add("loaded");
            }
            _imgObserver.unobserve(img);
          }
        }
      });
    }, { rootMargin: APP_CONFIG.img_lazy_margin });
  }

  function _observeImg(img) {
    if (img) _imgObserver?.observe(img);
  }

  // ── Global events ─────────────────────────────────────────────────────
  function _bindGlobalEvents() {
    window.addEventListener("watchlist:change", () => {
      _updateWLCount();
      if (_currentPage === "watchlist") _renderWatchlistPage();
    });
    window.addEventListener("history:change", () => {
      if (_currentPage === "home") _renderHistoryRows();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        _pauseAllRowAutoScroll();
      } else if (_currentPage === "home" || _currentPage === "anime") {
        _resumeAllRowAutoScroll();
      }
    });

    // ── Fullscreen & layout lifecycle: prevent stale scroll lock & accidental taps ──
    const _onFullscreenChange = () => {
      window._streamxLastLayoutChange = Date.now();
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      const bg = document.getElementById("player-modal-bg");
      const playerIsOpen = bg && bg.classList.contains("open");
      if (!isFullscreen) {
        // Fullscreen exited — restore overflow based on player state
        document.body.style.overflow = playerIsOpen ? "hidden" : "";
      }
      // Do NOT navigate or close anything here — fullscreen state is purely presentational.
    };
    document.addEventListener("fullscreenchange", _onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", _onFullscreenChange);
    document.addEventListener("mozfullscreenchange", _onFullscreenChange);
    document.addEventListener("MSFullscreenChange", _onFullscreenChange);

    // Track orientation and resize changes to block accidental backdrop clicks
    window.addEventListener("resize", () => {
      window._streamxLastLayoutChange = Date.now();
    }, { passive: true });
    window.addEventListener("orientationchange", () => {
      window._streamxLastLayoutChange = Date.now();
    }, { passive: true });

    // iOS Safari: <video> native fullscreen exit (webkitendfullscreen)
    // iOS fires this on the video element, not document. Delegate via capture.
    document.addEventListener("webkitendfullscreen", (e) => {
      window._streamxLastLayoutChange = Date.now();
      const bg = document.getElementById("player-modal-bg");
      const playerIsOpen = bg && bg.classList.contains("open");
      // Restore overflow — do NOT navigate or close the player
      document.body.style.overflow = playerIsOpen ? "hidden" : "";
    }, true /* capture = true to catch on video element */);

    // Close disclaimer modal on backdrop click
    const disclaimerModal = document.getElementById("disclaimer-modal-bg");
    if (disclaimerModal) {
      disclaimerModal.addEventListener("click", (e) => {
        if (e.target === disclaimerModal) {
          closeDisclaimerModal();
        }
      });
    }

    // PWA install prompt handler
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      const btn = document.getElementById("settings-install-pwa-btn");
      if (btn) btn.style.display = "inline-flex";
    });

    window.addEventListener("appinstalled", () => {
      _deferredPrompt = null;
      _showToast("🎉 CineJoy installed successfully!");
    });
  }


  // ── Hero Trailer Controller (YouTube Iframe & Background Video Engine) ───
  const HeroTrailerController = (() => {
    const _state = {
      general: {
        ytPlayer: null,
        token: 0,
        isMuted: true,
        isPlaying: false,
        revealTimer: null,
        currentKey: null,
        currentItemId: null,
        videoLayerId: "hero-video-layer",
        soundBtnId: "hero-sound-btn",
      },
      anime: {
        ytPlayer: null,
        token: 0,
        isMuted: true,
        isPlaying: false,
        revealTimer: null,
        currentKey: null,
        currentItemId: null,
        videoLayerId: "anime-hero-video-layer",
        soundBtnId: "anime-hero-sound-btn",
      },
      detail: {
        ytPlayer: null,
        token: 0,
        isMuted: true,
        isPlaying: false,
        revealTimer: null,
        currentKey: null,
        currentItemId: null,
        videoLayerId: "pm-hero-video-layer",
        soundBtnId: "pm-hero-sound-btn",
      }
    };

    let _ytReadyPromise = null;
    let _isFullPlayerActive = false;

    function ensureYouTubeAPI() {
      if (window.YT && window.YT.Player) {
        return Promise.resolve(window.YT);
      }
      if (_ytReadyPromise) return _ytReadyPromise;

      _ytReadyPromise = new Promise((resolve) => {
        if (!document.getElementById("yt-iframe-api")) {
          const tag = document.createElement("script");
          tag.id = "yt-iframe-api";
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScript = document.getElementsByTagName("script")[0];
          if (firstScript && firstScript.parentNode) {
            firstScript.parentNode.insertBefore(tag, firstScript);
          } else {
            document.head.appendChild(tag);
          }
        }

        const prevReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prevReady === "function") prevReady();
          resolve(window.YT);
        };

        const interval = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(interval);
            resolve(window.YT);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          resolve(window.YT || null);
        }, 4000);
      });

      return _ytReadyPromise;
    }

    // Pre-trigger API initialization
    ensureYouTubeAPI();

    function setFullPlayerActive(active) {
      _isFullPlayerActive = !!active;
      if (_isFullPlayerActive) {
        destroyAll();
        if (typeof _stopAllHeroRotations === "function") {
          _stopAllHeroRotations();
        }
      }
    }

    function isFullPlayerActive() {
      return _isFullPlayerActive;
    }

    function silence(instanceKey) {
      const s = _state[instanceKey];
      if (!s) return;
      if (s.revealTimer) {
        clearTimeout(s.revealTimer);
        s.revealTimer = null;
      }
      s.isMuted = true;
      s.isPlaying = false;
      const lyr = document.getElementById(s.videoLayerId);
      if (lyr) lyr.classList.remove("is-playing");
      if (s.ytPlayer) {
        try {
          if (typeof s.ytPlayer.mute === "function") s.ytPlayer.mute();
          if (typeof s.ytPlayer.pauseVideo === "function") s.ytPlayer.pauseVideo();
        } catch (e) {}
      }
      const iframe = document.getElementById(`${s.videoLayerId}-iframe`);
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', "*");
          iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
        } catch (e) {}
      }
      updateSoundButtonUI(instanceKey, true, !!s.currentKey);
    }

    function silenceAll() {
      silence("general");
      silence("anime");
      silence("detail");
    }

    function destroy(instanceKey) {
      const s = _state[instanceKey];
      if (!s) return;
      if (s.revealTimer) {
        clearTimeout(s.revealTimer);
        s.revealTimer = null;
      }
      s.token++;
      s.currentKey = null;
      s.currentItemId = null;
      s.isPlaying = false;
      s.isMuted = true;

      if (s.ytPlayer) {
        try {
          if (typeof s.ytPlayer.stopVideo === "function") s.ytPlayer.stopVideo();
          if (typeof s.ytPlayer.destroy === "function") s.ytPlayer.destroy();
        } catch (e) {}
        s.ytPlayer = null;
      }

      const layer = document.getElementById(s.videoLayerId);
      if (layer) {
        layer.classList.remove("is-playing");
        layer.innerHTML = "";
      }

      updateSoundButtonUI(instanceKey, true, false);
    }

    async function loadTrailerForItem(instanceKey, item) {
      const s = _state[instanceKey];
      if (!s || !item) return;

      // ── STRICT BACKGROUND STREAM SUPPRESSION ─────────────────────────
      // Never mount or load trailers while user is actively streaming or browsing modal
      if (_isFullPlayerActive || document.body.classList.contains("big-player-active")) {
        return;
      }
      if (instanceKey !== "detail" && (document.body.classList.contains("has-modal-open") || document.getElementById("player-modal-bg")?.classList.contains("open"))) {
        return;
      }

      const thisToken = ++s.token;
      s.currentItemId = item.id;
      s.currentKey = null;
      s.isPlaying = false;
      s.isMuted = true;

      if (s.ytPlayer) {
        try {
          if (typeof s.ytPlayer.stopVideo === "function") s.ytPlayer.stopVideo();
          if (typeof s.ytPlayer.destroy === "function") s.ytPlayer.destroy();
        } catch (e) {}
        s.ytPlayer = null;
      }

      const layer = document.getElementById(s.videoLayerId);
      if (layer) {
        layer.classList.remove("is-playing");
        layer.innerHTML = "";
      }
      updateSoundButtonUI(instanceKey, true, false);

      // Resolve trailer
      let trailer = item.trailer || null;
      if (!trailer || !trailer.key) {
        if (instanceKey === "anime" || item.media === "anime" || item.media === "donghua") {
          trailer = await Anilist.getTrailer(item.id, item.media);
        } else {
          trailer = await TMDB.getTrailer(item.media, item.id);
        }
      }

      // Check for race condition
      if (thisToken !== s.token) return;

      // If no valid trailer, backdrop remains seamlessly
      if (!trailer || !trailer.key) {
        updateSoundButtonUI(instanceKey, true, false);
        return;
      }

      s.currentKey = trailer.key;
      updateSoundButtonUI(instanceKey, s.isMuted, true);

      try {
        await ensureYouTubeAPI();
        if (thisToken !== s.token) return;

        const targetLayer = document.getElementById(s.videoLayerId);
        if (!targetLayer) return;

        targetLayer.innerHTML = `
          <div class="hero-trailer-iframe-wrap">
            <div id="${s.videoLayerId}-player"></div>
            <div class="hero-trailer-touch-shield" aria-hidden="true"></div>
          </div>
        `;

        if (window.YT && window.YT.Player) {
          s.ytPlayer = new window.YT.Player(`${s.videoLayerId}-player`, {
            videoId: trailer.key,
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              autoplay: 1,
              mute: 1,
              controls: 0,
              showinfo: 0,
              rel: 0,
              playsinline: 1,
              modestbranding: 1,
              iv_load_policy: 3,
              disablekb: 1,
              fs: 0,
              cc_load_policy: 0,
              autohide: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (thisToken !== s.token || _isFullPlayerActive || document.body.classList.contains("big-player-active")) {
                  try { event.target.destroy(); } catch (e) {}
                  return;
                }
                try {
                  // Prefer medium-resolution 720p trailer rendition
                  if (typeof event.target.setPlaybackQuality === "function") {
                    event.target.setPlaybackQuality("hd720");
                  }
                  if (s.isMuted) {
                    event.target.mute();
                  } else {
                    event.target.unMute();
                    if (typeof event.target.setVolume === "function") event.target.setVolume(100);
                  }
                  if (_isFullPlayerActive) {
                    event.target.pauseVideo();
                  } else {
                    // Suppress explicit playVideo() call when possible to eliminate YouTube's center pause/play bezel (.ytp-bezel)
                    const st = typeof event.target.getPlayerState === "function" ? event.target.getPlayerState() : -1;
                    if (st !== 1 && st !== 3) {
                      event.target.playVideo();
                    }
                  }
                } catch (e) {}
                updateSoundButtonUI(instanceKey, s.isMuted, !_isFullPlayerActive);
              },
              onStateChange: (event) => {
                if (thisToken !== s.token) return;
                // Strict audio collision protection: suppress trailer if full player is streaming
                if (_isFullPlayerActive) {
                  try {
                    event.target.mute();
                    event.target.pauseVideo();
                  } catch (e) {}
                  return;
                }
                // YT.PlayerState.PLAYING is 1
                if (event.data === 1) {
                  try {
                    if (typeof event.target.setPlaybackQuality === "function") {
                      event.target.setPlaybackQuality("hd720");
                    }
                  } catch (e) {}
                  s.isPlaying = true;
                  updateSoundButtonUI(instanceKey, s.isMuted, true);

                  // Cancel any pending reveal timer
                  if (s.revealTimer) {
                    clearTimeout(s.revealTimer);
                    s.revealTimer = null;
                  }

                  // ── ULTRA-CLEAN SEAMLESS REVEAL GUARD ────────────────────────
                  // YouTube's internal HTML5 player displays a large circular center
                  // bezel (play/pause "||" icon) on start, which animates and lingers
                  // for ~3.0 - 4.2 seconds before fading out completely to display:none.
                  // To guarantee the user NEVER sees the YouTube pause/play indicator,
                  // we keep the video layer completely hidden (opacity: 0, visibility: hidden)
                  // behind the high-res movie poster backdrop until YouTube's internal
                  // bezel animation has 100% completed its lifecycle.
                  // We require at least 3.6s elapsed wall time after PLAYING state AND
                  // actual advancing playback before fading in the video layer.
                  const startTime = Date.now();
                  let initialTime = -1;
                  const checkAndReveal = () => {
                    if (thisToken !== s.token || !s.isPlaying || _isFullPlayerActive) return;
                    let currTime = 0;
                    try {
                      currTime = typeof event.target.getCurrentTime === "function" ? event.target.getCurrentTime() : 0;
                    } catch (e) {}

                    if (initialTime < 0 && currTime > 0) {
                      initialTime = currTime;
                    }

                    const elapsed = Date.now() - startTime;
                    const playedSeconds = initialTime >= 0 ? (currTime - initialTime) : currTime;

                    // YouTube center pause/play bezel (.ytp-bezel) takes up to 4.5s to fully fade to opacity 0.
                    // We enforce 5.8s elapsed wall time + confirmed rolling playback before revealing the video layer.
                    const isBezelFadedOut = elapsed >= 5800;
                    const isPlaybackRolling = playedSeconds >= 2.0 || elapsed >= 7000;

                    if (isBezelFadedOut && isPlaybackRolling) {
                      const lyr = document.getElementById(s.videoLayerId);
                      if (lyr && s.isPlaying && !_isFullPlayerActive && !document.body.classList.contains("big-player-active")) {
                        lyr.classList.add("is-playing");
                      }
                    } else {
                      s.revealTimer = setTimeout(checkAndReveal, 200);
                    }
                  };
                  s.revealTimer = setTimeout(checkAndReveal, 1000);
                } else if (event.data === 0) {
                  // Smooth loop without enabling YouTube's playlist controls
                  if (s.revealTimer) {
                    clearTimeout(s.revealTimer);
                    s.revealTimer = null;
                  }
                  s.isPlaying = false;
                  const lyr = document.getElementById(s.videoLayerId);
                  if (lyr) lyr.classList.remove("is-playing");
                  try {
                    event.target.seekTo(0);
                    event.target.playVideo();
                  } catch (e) {}
                } else {
                  // State 2 (PAUSED), State 3 (BUFFERING), State -1 (UNSTARTED), State 5 (CUED)
                  // Immediately hide layer so YouTube pause icon || or play button is NEVER visible!
                  if (s.revealTimer) {
                    clearTimeout(s.revealTimer);
                    s.revealTimer = null;
                  }
                  s.isPlaying = false;
                  const lyr = document.getElementById(s.videoLayerId);
                  if (lyr) lyr.classList.remove("is-playing");
                }
              },
              onError: (err) => {
                console.warn(`[HeroTrailer] Trailer playback failed for "${item.title}":`, err);
                const lyr = document.getElementById(s.videoLayerId);
                if (lyr) {
                  lyr.classList.remove("is-playing");
                  lyr.innerHTML = "";
                }
                updateSoundButtonUI(instanceKey, true, false);
              }
            }
          });
        } else {
          // Direct fallback iframe embed with full control suppression, no playlist mode, and 720p preference
          targetLayer.innerHTML = `
            <div class="hero-trailer-iframe-wrap">
              <iframe id="${s.videoLayerId}-iframe"
                src="https://www.youtube-nocookie.com/embed/${trailer.key}?enablejsapi=1&autoplay=1&mute=1&controls=0&showinfo=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&vq=hd720"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowfullscreen
                tabindex="-1"
                aria-hidden="true"
                style="pointer-events:none !important; border:0; width:100%; height:100%;">
              </iframe>
              <div class="hero-trailer-touch-shield" aria-hidden="true"></div>
            </div>
          `;
          setTimeout(() => {
            if (thisToken === s.token && !_isFullPlayerActive && !document.body.classList.contains("big-player-active")) {
              targetLayer.classList.add("is-playing");
              updateSoundButtonUI(instanceKey, true, true);
            }
          }, 6500);
        }
      } catch (err) {
        console.warn(`[HeroTrailer] Exception while mounting trailer:`, err);
        updateSoundButtonUI(instanceKey, true, false);
      }
    }

    function toggleSound(instanceKey) {
      if (_isFullPlayerActive) return; // Prevent trailer audio from playing over full content player
      const s = _state[instanceKey];
      if (!s || !s.currentKey) return;

      const nextMuted = !s.isMuted;
      s.isMuted = nextMuted;

      if (s.ytPlayer) {
        try {
          if (nextMuted) {
            if (typeof s.ytPlayer.mute === "function") s.ytPlayer.mute();
          } else {
            if (typeof s.ytPlayer.unMute === "function") s.ytPlayer.unMute();
            if (typeof s.ytPlayer.setVolume === "function") s.ytPlayer.setVolume(100);
            if (typeof s.ytPlayer.playVideo === "function") s.ytPlayer.playVideo();
          }
        } catch (err) {
          console.warn("[HeroTrailer] Sound toggle error:", err);
        }
      }

      const iframe = document.getElementById(`${s.videoLayerId}-iframe`) || document.querySelector(`#${s.videoLayerId} iframe`);
      if (iframe && iframe.contentWindow) {
        try {
          const cmd = nextMuted ? '{"event":"command","func":"mute","args":""}' : '{"event":"command","func":"unMute","args":""}';
          iframe.contentWindow.postMessage(cmd, "*");
          if (!nextMuted) {
            iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', "*");
            iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', "*");
          }
        } catch (_) {}
      }

      updateSoundButtonUI(instanceKey, s.isMuted, true);
    }

    function updateSoundButtonUI(instanceKey, isMuted, isVisible) {
      const s = _state[instanceKey];
      if (!s) return;
      const actionBtnId = instanceKey === "general"
        ? "hero-action-sound-btn"
        : (instanceKey === "anime" ? "anime-hero-action-sound-btn" : null);

      const buttons = [
        document.getElementById(s.soundBtnId),
        actionBtnId ? document.getElementById(actionBtnId) : null
      ].filter(Boolean);

      if (!buttons.length) return;

      buttons.forEach(btn => {
        if (!isVisible) {
          btn.style.display = "none";
          return;
        }

        btn.style.display = "inline-flex";
        btn.classList.toggle("is-unmuted", !isMuted);
        btn.setAttribute("aria-label", isMuted ? "Unmute trailer" : "Mute trailer");
        btn.setAttribute("title", isMuted ? "Unmute trailer" : "Mute trailer");

        const iconSpan = btn.querySelector(".hero-sound-icon");
        const labelSpan = btn.querySelector(".hero-sound-text");

        if (iconSpan) {
          iconSpan.innerHTML = isMuted ? _VOLUME_X_SVG : _VOLUME_2_SVG;
        } else {
          // Circular button directly without child .hero-sound-icon
          btn.innerHTML = isMuted ? _VOLUME_X_SVG : _VOLUME_2_SVG;
        }

        if (labelSpan) {
          labelSpan.textContent = isMuted ? "Muted" : "Sound On";
        }
      });
    }

    function isMuted(instanceKey) {
      return _state[instanceKey]?.isMuted ?? true;
    }

    function pause(instanceKey) {
      const s = _state[instanceKey];
      if (!s) return;
      if (s.revealTimer) {
        clearTimeout(s.revealTimer);
        s.revealTimer = null;
      }
      s.isPlaying = false;
      const lyr = document.getElementById(s.videoLayerId);
      if (lyr) lyr.classList.remove("is-playing");
      if (s.ytPlayer && typeof s.ytPlayer.pauseVideo === "function") {
        try { s.ytPlayer.pauseVideo(); } catch (e) {}
      }
      const iframe = document.getElementById(`${s.videoLayerId}-iframe`);
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
        } catch (e) {}
      }
    }

    function resume(instanceKey) {
      if (_isFullPlayerActive) return; // Never resume trailer while full-content player is streaming!
      const s = _state[instanceKey];
      if (s && s.ytPlayer && typeof s.ytPlayer.playVideo === "function" && s.currentKey) {
        try {
          if (s.isMuted && typeof s.ytPlayer.mute === "function") s.ytPlayer.mute();
          s.ytPlayer.playVideo();
        } catch (e) {}
      }
    }

    function pauseAll() {
      pause("general");
      pause("anime");
      pause("detail");
    }

    function destroyAll() {
      destroy("general");
      destroy("anime");
      destroy("detail");
    }

    const controllerObj = {
      destroy,
      destroyAll,
      loadTrailerForItem,
      toggleSound,
      isMuted,
      pause,
      resume,
      pauseAll,
      silence,
      silenceAll,
      setFullPlayerActive,
      isFullPlayerActive,
    };

    window.HeroTrailerController = controllerObj;
    return controllerObj;
  })();

  // ── Hero banner (General Entertainment: Movies / Series / Dramas) ─────────
  async function _loadHero() {
    try {
      const data = await TMDB.getTrending("all", "week");
      _heroItems = (data.results || [])
        .filter(i => i.backdrop && i.overview && i.media !== "anime" && i.media !== "donghua" && !i.genre_ids?.includes(16))
        .slice(0, APP_CONFIG.hero_count);
      _heroIdx = 0;
      _renderHero();
      _startHeroRotation();
      const hero = document.getElementById("hero");

      if (hero) {
        hero.addEventListener("mouseenter", () => {
          clearInterval(_heroTimer);
        });

        hero.addEventListener("mouseleave", () => {
          _startHeroRotation();
        });
      }
    } catch (err) {
      console.error("General Hero load failed:", err);
    }
  }

  function _renderHero() {
    const hero = document.getElementById("hero");
    if (!hero || !_heroItems.length) return;
    const item = _heroItems[_heroIdx];
    const genreNames = item.genre_ids
      .slice(0, 3)
      .map(gid => GENRE_MAP[item.media]?.[gid])
      .filter(Boolean)
      .join(" · ");
    const isWl = Watchlist.has(item.id, item.media);
    const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
      ? item.rating.toFixed(1) : null;

    const backdropImg = item.backdrop || item.poster_lg || item.poster || "";
    hero.innerHTML = `
      <div class="hero-backdrop" style="background-image: url('${backdropImg}')"></div>
      <div class="hero-video-layer" id="hero-video-layer"></div>
      <div class="hero-cinematic-vignette"></div>

      <div class="hero-content">
        <h1 class="hero-title">${_esc(item.title)}</h1>
        <div class="hero-meta-bar">
          ${ratingVal ? `<span class="hero-meta-item hero-meta-rating">★ ${ratingVal}/10</span>` : ""}
          ${item.year ? `<span class="hero-meta-item hero-meta-year">📅 ${item.year}</span>` : ""}
          <span class="hero-meta-item hero-meta-genre">🔍 ${_esc(genreNames || (item.media === "movie" ? "Movie" : "Series"))}</span>
        </div>
        <p class="hero-overview">${_esc(item.overview.slice(0, 300))}${item.overview.length > 300 ? "…" : ""}</p>
        <div class="hero-btns">
          <button class="theme-btn-primary hero-play-btn" onclick="App.openItem(${_jsonAttr(item)})">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>Play</span>
          </button>
          <button class="theme-btn-secondary hero-circle-btn" onclick="App.toggleWL(${_jsonAttr(item)}); App._renderHero();" aria-label="${isWl ? 'Remove from List' : 'Add to List'}" title="${isWl ? 'In Watchlist' : 'Add to List'}">
            ${isWl ? _CHECK_SVG : _PLUS_SVG}
          </button>
          <button class="theme-btn-secondary hero-circle-btn" onclick="App.openItem(${_jsonAttr(item)})" aria-label="More Info" title="More Info">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </button>
          <button type="button" class="theme-btn-secondary hero-circle-btn hero-action-sound-btn" id="hero-action-sound-btn" onclick="App.toggleHeroSound('general')" aria-label="Unmute trailer" title="Unmute trailer" style="display:none;">
            <span class="hero-sound-icon">${_VOLUME_X_SVG}</span>
          </button>
        </div>
      </div>
      <!-- Hero Floating Sound Toggle (Mute / Sound On Pill) -->
      <div class="hero-sound-controls">
        <button type="button" class="hero-sound-btn" id="hero-sound-btn" onclick="App.toggleHeroSound('general')" aria-label="Unmute trailer" title="Unmute trailer" style="display:none;">
          <span class="hero-sound-icon">${_VOLUME_X_SVG}</span>
          <span class="hero-sound-text">Muted</span>
        </button>
      </div>
      <!-- Prev & Next Hero Slide Navigation Arrows -->
      <button class="hero-nav-arrow hero-nav-prev" onclick="App.prevHero()" aria-label="Previous Featured Slide" title="Previous Slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button class="hero-nav-arrow hero-nav-next" onclick="App.nextHero()" aria-label="Next Featured Slide" title="Next Slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <div class="hero-dots">
        ${_heroItems.map((_, i) =>
          `<button class="hero-dot${i === _heroIdx ? " active" : ""}"
            onclick="App.goHero(${i})" aria-label="Go to slide ${i + 1}">
          </button>`).join("")}
      </div>`;

    _setupHeroTouch(hero, prevHero, nextHero);

    // Resolve and mount trailer for this specific item
    HeroTrailerController.loadTrailerForItem("general", item);
  }

  let _touchStartX = 0;
  function _setupHeroTouch(el, prevFn, nextFn) {
    if (!el || el._hasTouchBound) return;
    el._hasTouchBound = true;
    el.addEventListener("touchstart", e => {
      if (e.touches && e.touches[0]) _touchStartX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener("touchend", e => {
      if (e.changedTouches && e.changedTouches[0]) {
        const diff = e.changedTouches[0].clientX - _touchStartX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) prevFn();
          else nextFn();
        }
      }
    }, { passive: true });
  }

  function toggleSearchModal(forceState) {
    const modal = document.getElementById("search-modal-backdrop");
    const inp = document.getElementById("search-input");
    if (!modal) return;
    const isNowOpen = typeof forceState === "boolean" ? forceState : (modal.style.display === "none");
    modal.style.display = isNowOpen ? "flex" : "none";
    if (isNowOpen) {
      if (inp) {
        try {
          inp.focus({ preventScroll: true });
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        } catch (_) {}

        setTimeout(() => {
          try {
            inp.focus();
          } catch (_) {}
        }, 50);

        if (inp.value && inp.value.trim().length >= 2) {
          onSearchInput(inp.value);
        }
      }
    } else {
      if (inp) inp.blur();
      const historyEl = document.getElementById("search-history");
      if (historyEl) historyEl.classList.remove("show");
      const liveEl = document.getElementById("search-modal-live-results");
      if (liveEl) {
        liveEl.style.display = "none";
        liveEl.innerHTML = "";
      }
    }
  }

  function toggleMobileSearch(forceState) {
    toggleSearchModal(forceState);
  }

  function _stopAllHeroRotations() {
    if (_heroTimer) {
      clearInterval(_heroTimer);
      _heroTimer = null;
    }
    if (_animeHeroTimer) {
      clearInterval(_animeHeroTimer);
      _animeHeroTimer = null;
    }
  }

  function _resumeHeroRotations() {
    if (document.body.classList.contains("big-player-active") ||
        document.body.classList.contains("has-modal-open") ||
        document.getElementById("player-modal-bg")?.classList.contains("open") ||
        (window.HeroTrailerController && window.HeroTrailerController.isFullPlayerActive())) {
      return;
    }
    _startHeroRotation();
    _startAnimeHeroRotation();
  }

  function _startHeroRotation() {
    if (_heroTimer) {
      clearInterval(_heroTimer);
      _heroTimer = null;
    }
    if (document.body.classList.contains("big-player-active") ||
        document.body.classList.contains("has-modal-open") ||
        document.getElementById("player-modal-bg")?.classList.contains("open") ||
        document.hidden ||
        (window.HeroTrailerController && window.HeroTrailerController.isFullPlayerActive())) {
      return;
    }
    if (!HeroTrailerController.isMuted("general")) return; // Pause rotation while user is listening
    _heroTimer = setInterval(() => {
      if (document.body.classList.contains("big-player-active") ||
          document.body.classList.contains("has-modal-open") ||
          document.getElementById("player-modal-bg")?.classList.contains("open") ||
          document.hidden ||
          (window.HeroTrailerController && window.HeroTrailerController.isFullPlayerActive())) {
        _stopAllHeroRotations();
        return;
      }
      _heroIdx = (_heroIdx + 1) % _heroItems.length;
      _renderHero();
    }, 26000);
  }

  function goHero(idx) {
    if (idx === _heroIdx) return;
    _heroIdx = idx;
    _renderHero();
    _startHeroRotation();
  }

  function prevHero() {
    if (!_heroItems.length) return;
    _heroIdx = (_heroIdx - 1 + _heroItems.length) % _heroItems.length;
    _renderHero();
    _startHeroRotation();
  }

  function nextHero() {
    if (!_heroItems.length) return;
    _heroIdx = (_heroIdx + 1) % _heroItems.length;
    _renderHero();
    _startHeroRotation();
  }

  // ── Dedicated Anime Hero Banner (Anime & Donghua) ────────────────────────
  async function _loadAnimeHero() {
    try {
      const data = await Anilist.getTrending();
      _animeHeroItems = (data.results || [])
        .filter(i => i.backdrop && i.overview)
        .slice(0, APP_CONFIG.hero_count || 8);
      _animeHeroIdx = 0;
      _renderAnimeHero();
      _startAnimeHeroRotation();

      const hero = document.getElementById("anime-hero");
      if (hero) {
        hero.addEventListener("mouseenter", () => {
          clearInterval(_animeHeroTimer);
        });
        hero.addEventListener("mouseleave", () => {
          _startAnimeHeroRotation();
        });
      }
    } catch (err) {
      console.error("Anime Hero load failed:", err);
    }
  }

  function _renderAnimeHero() {
    const hero = document.getElementById("anime-hero");
    if (!hero || !_animeHeroItems.length) return;
    const item = _animeHeroItems[_animeHeroIdx];
    const genreNames = Array.isArray(item.genres)
      ? item.genres.slice(0, 3).join(" · ")
      : "";
    const isWl = Watchlist.has(item.id, item.media);
    const badgeLabel = item.media === "donghua" ? "Donghua" : "Anime";
    const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
      ? item.rating.toFixed(1) : null;

    const backdropImg = item.backdrop || item.poster_lg || item.poster || "";
    hero.innerHTML = `
      <div class="hero-backdrop" style="background-image: url('${backdropImg}')"></div>
      <div class="hero-video-layer" id="anime-hero-video-layer"></div>
      <div class="hero-cinematic-vignette anime-hero-overlay"></div>

      <div class="hero-content anime-hero-content">
        <h1 class="hero-title">${_esc(item.title)}</h1>
        <div class="hero-meta-bar">
          ${ratingVal ? `<span class="hero-meta-item hero-meta-rating">★ ${ratingVal}/10</span>` : ""}
          ${item.year ? `<span class="hero-meta-item hero-meta-year">📅 ${item.year}</span>` : ""}
          <span class="hero-meta-item hero-meta-genre">🔍 ${_esc(genreNames || badgeLabel)}</span>
          ${item.episodes ? `<span class="hero-meta-item hero-meta-ep">${item.episodes} EPS</span>` : ""}
        </div>
        <p class="hero-overview">${_esc(item.overview.slice(0, 300))}${item.overview.length > 300 ? "…" : ""}</p>
        <div class="hero-btns">
          <button class="theme-btn-primary hero-play-btn" onclick="App.openItem(${_jsonAttr(item)})">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>Play</span>
          </button>
          <button class="theme-btn-secondary hero-circle-btn" onclick="App.toggleWL(${_jsonAttr(item)}); App._renderAnimeHero();" aria-label="${isWl ? 'Remove from List' : 'Add to List'}" title="${isWl ? 'In Watchlist' : 'Add to List'}">
            ${isWl ? _CHECK_SVG : _PLUS_SVG}
          </button>
          <button class="theme-btn-secondary hero-circle-btn" onclick="App.openItem(${_jsonAttr(item)})" aria-label="More Info" title="More Info">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </button>
          <button type="button" class="theme-btn-secondary hero-circle-btn hero-action-sound-btn" id="anime-hero-action-sound-btn" onclick="App.toggleHeroSound('anime')" aria-label="Unmute trailer" title="Unmute trailer" style="display:none;">
            <span class="hero-sound-icon">${_VOLUME_X_SVG}</span>
          </button>
        </div>
      </div>
      <!-- Anime Hero Floating Sound Toggle -->
      <div class="hero-sound-controls">
        <button type="button" class="hero-sound-btn" id="anime-hero-sound-btn" onclick="App.toggleHeroSound('anime')" aria-label="Unmute trailer" title="Unmute trailer" style="display:none;">
          <span class="hero-sound-icon">${_VOLUME_X_SVG}</span>
          <span class="hero-sound-text">Muted</span>
        </button>
      </div>
      <!-- Prev & Next Anime Hero Slide Navigation Arrows -->
      <button class="hero-nav-arrow hero-nav-prev" onclick="App.prevAnimeHero()" aria-label="Previous Featured Anime Slide" title="Previous Slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button class="hero-nav-arrow hero-nav-next" onclick="App.nextAnimeHero()" aria-label="Next Featured Anime Slide" title="Next Slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <div class="hero-dots">
        ${_animeHeroItems.map((_, i) =>
          `<button class="hero-dot${i === _animeHeroIdx ? " active" : ""}"
            onclick="App.goAnimeHero(${i})" aria-label="Go to anime slide ${i + 1}">
          </button>`).join("")}
      </div>`;

    _setupHeroTouch(hero, prevAnimeHero, nextAnimeHero);

    // Resolve and mount trailer for this specific anime/donghua item
    HeroTrailerController.loadTrailerForItem("anime", item);
  }

  function _startAnimeHeroRotation() {
    if (_animeHeroTimer) {
      clearInterval(_animeHeroTimer);
      _animeHeroTimer = null;
    }
    if (document.body.classList.contains("big-player-active") ||
        document.body.classList.contains("has-modal-open") ||
        document.getElementById("player-modal-bg")?.classList.contains("open") ||
        document.hidden ||
        (window.HeroTrailerController && window.HeroTrailerController.isFullPlayerActive())) {
      return;
    }
    if (!HeroTrailerController.isMuted("anime")) return; // Pause rotation while user is listening
    _animeHeroTimer = setInterval(() => {
      if (document.body.classList.contains("big-player-active") ||
          document.body.classList.contains("has-modal-open") ||
          document.getElementById("player-modal-bg")?.classList.contains("open") ||
          document.hidden ||
          (window.HeroTrailerController && window.HeroTrailerController.isFullPlayerActive())) {
        _stopAllHeroRotations();
        return;
      }
      _animeHeroIdx = (_animeHeroIdx + 1) % _animeHeroItems.length;
      _renderAnimeHero();
    }, 26000);
  }

  function goAnimeHero(idx) {
    if (idx === _animeHeroIdx) return;
    _animeHeroIdx = idx;
    _renderAnimeHero();
    _startAnimeHeroRotation();
  }

  function prevAnimeHero() {
    if (!_animeHeroItems.length) return;
    _animeHeroIdx = (_animeHeroIdx - 1 + _animeHeroItems.length) % _animeHeroItems.length;
    _renderAnimeHero();
    _startAnimeHeroRotation();
  }

  function nextAnimeHero() {
    if (!_animeHeroItems.length) return;
    _animeHeroIdx = (_animeHeroIdx + 1) % _animeHeroItems.length;
    _renderAnimeHero();
    _startAnimeHeroRotation();
  }

  function toggleHeroSound(type = "general") {
    HeroTrailerController.toggleSound(type);
    if (!HeroTrailerController.isMuted(type)) {
      if (type === "general") clearInterval(_heroTimer);
      else clearInterval(_animeHeroTimer);
    } else {
      if (type === "general") _startHeroRotation();
      else _startAnimeHeroRotation();
    }
  }

  let _heroObserver = null;
  function _initHeroVisibilityObserver() {
    if (_heroObserver) return;
    if ("IntersectionObserver" in window) {
      _heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const id = entry.target.id;
          const key = id === "anime-hero" ? "anime" : "general";
          if (entry.intersectionRatio < 0.2) {
            HeroTrailerController.pause(key);
          } else {
            if ((key === "general" && _currentPage === "home") || (key === "anime" && _currentPage === "anime")) {
              HeroTrailerController.resume(key);
            }
          }
        });
      }, { threshold: [0, 0.2, 0.5, 0.8, 1.0] });

      const h1 = document.getElementById("hero");
      const h2 = document.getElementById("anime-hero");
      if (h1) _heroObserver.observe(h1);
      if (h2) _heroObserver.observe(h2);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        HeroTrailerController.pauseAll();
        _stopAllHeroRotations();
      } else {
        if (HeroTrailerController.isFullPlayerActive() || document.body.classList.contains("big-player-active")) return;
        const modalBg = document.getElementById("player-modal-bg");
        if (modalBg && modalBg.classList.contains("open")) {
          HeroTrailerController.resume("detail");
        } else {
          if (_currentPage === "home") HeroTrailerController.resume("general");
          else if (_currentPage === "anime") HeroTrailerController.resume("anime");
          _resumeHeroRotations();
        }
      }
    });

    const modalBg = document.getElementById("player-modal-bg");
    if (modalBg) {
      modalBg.addEventListener("scroll", () => {
        if (modalBg.scrollTop > 450) {
          HeroTrailerController.pause("detail");
        } else if (modalBg.scrollTop < 250 && !HeroTrailerController.isFullPlayerActive()) {
          HeroTrailerController.resume("detail");
        }
      }, { passive: true });

      if ("MutationObserver" in window) {
        const modalObserver = new MutationObserver(() => {
          if (!modalBg.classList.contains("open")) {
            HeroTrailerController.destroy("detail");
            HeroTrailerController.setFullPlayerActive(false);
            if (_currentPage === "home") HeroTrailerController.resume("general");
            else if (_currentPage === "anime") HeroTrailerController.resume("anime");
          }
        });
        modalObserver.observe(modalBg, { attributes: true, attributeFilter: ["class"] });
      }
    }
  }

  let _generalHomeLoaded = false;
  let _animeHomeLoaded = false;

  // Load General Entertainment content (Movies / Series / Dramas)
  async function _loadGeneralHomeContent() {
    if (_generalHomeLoaded) return;
    _generalHomeLoaded = true;
    await Promise.all([
      _loadHero(),
      _renderBrowseProvidersRow(),
      _renderHomeRows(),
      _renderStreamingPlatformSection()
    ]);
  }

  // Load dedicated Anime & Donghua page content
  async function _loadAnimePageContent() {
    if (_animeHomeLoaded) return;
    _animeHomeLoaded = true;
    await Promise.all([
      _loadAnimeHero(),
      _renderAnimeHomeRows()
    ]);
  }

  // Backward compatibility fallback
  async function _loadAllHomeContent() {
    await Promise.all([
      _loadGeneralHomeContent(),
      _loadAnimePageContent()
    ]);
  }

  // Scroll to a specific category row on the dedicated Anime page
  function scrollToAnimeRow(rowId) {
    if (!rowId || rowId === "all") {
      const hero = document.getElementById("anime-hero");
      if (hero) hero.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll(".anime-subnav-pills .pill-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx === 0);
      });
      return;
    }

    const rowEl = document.getElementById(`row-${rowId}`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.querySelectorAll(".anime-subnav-pills .pill-btn").forEach(btn => {
      const onclickAttr = btn.getAttribute("onclick") || "";
      btn.classList.toggle("active", onclickAttr.includes(`'${rowId}'`));
    });
  }

  // Switch destination focus between Movies/Series and Anime/Donghua pages
  function switchHomeSection(sectionKey) {
    if (sectionKey === "anime") {
      _showPage("anime");
    } else {
      _showPage("home");
    }
  }

  // ── CineJoy Branded Initial Loader Dismiss ─────────────────────────────
  let _loaderDismissed = false;
  function _dismissLoader() {
    if (_loaderDismissed) return;
    _loaderDismissed = true;
    const loader = document.getElementById("cinejoy-loader");
    if (!loader) return;
    loader.classList.add("loaded");
    setTimeout(() => {
      loader.style.display = "none";
    }, 600);
  }

  // ── Floating Category Switcher (Reference: All / Movies / TV Shows / Anime)
  function filterCategory(cat) {
    document.querySelectorAll(".cat-pill").forEach(btn => {
      const isTarget = btn.id === `cat-pill-${cat}` || (cat === "movie" && btn.id === "cat-pill-movies");
      btn.classList.toggle("active", isTarget);
      btn.setAttribute("aria-selected", isTarget ? "true" : "false");
    });

    if (cat === "anime") {
      _showPage("anime");
      return;
    }

    _showPage("home");
    const sections = document.querySelectorAll("#home-rows .row-section");
    sections.forEach(sec => {
      const secCat = sec.getAttribute("data-category") || "all";
      if (cat === "all" || secCat === "all" || secCat === cat) {
        sec.style.display = "";
      } else {
        sec.style.display = "none";
      }
    });

    // Smooth scroll to the first matching category section if filtering
    if (cat !== "all") {
      const firstVisible = document.querySelector("#home-rows .row-section:not([style*='display: none'])");
      if (firstVisible) {
        firstVisible.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  // ── Unified Row Data Fetcher (TMDB for general, AniList for anime/donghua)
  async function _fetchRowData(row, page = 1) {
    if (row.media === "anime" || row.media === "donghua") {
      const isDonghua = row.media === "donghua" || row.endpoint?.includes("origin=CN");
      const origin = isDonghua ? "CN" : undefined;
      const [path, qs] = (row.endpoint || "").split("?");
      const params = {};
      if (qs) qs.split("&").forEach(pair => { const [k, v] = pair.split("="); params[k] = v; });

      if (path === "/trending") {
        return await Anilist.getTrending(origin, page);
      } else if (path === "/popular") {
        const sort = params.sort || "POPULARITY_DESC";
        return await Anilist.getPopular(origin, page, sort);
      } else if (path === "/airing") {
        return await Anilist.getList("airing", origin, page);
      } else if (path === "/upcoming") {
        return await Anilist.getList("upcoming", origin, page);
      } else {
        return await Anilist.getList("popular", origin, page);
      }
    } else {
      return await TMDB.fetchRow(row, page);
    }
  }

  // ── Browse by Provider Row (Matches cinejoy.pk Pill Layout) ───────────
  const _BROWSE_PROVIDERS = [
    { platformId: "netflix", name: "Netflix", color: "#e50914", icon: "NETFLIX" },
    { platformId: "apple", name: "Apple TV+", color: "#ffffff", icon: "tv+" },
    { platformId: "hulu", name: "Hulu", color: "#1ce783", icon: "hulu" },
    { platformId: "max", name: "HBO Max", color: "#a855f7", icon: "HBO max" },
    { platformId: "paramount", name: "Paramount+", color: "#38bdf8", icon: "Paramount+" },
    { platformId: "peacock", name: "Peacock", color: "#eab308", icon: "peacock" },
    { platformId: "prime", name: "Prime Video", color: "#00a8e1", icon: "prime video" },
    { platformId: "disney", name: "Disney+", color: "#3b82f6", icon: "Disney+" },
    { platformId: "crunchyroll", name: "Crunchyroll", color: "#f97316", icon: "CR" },
    { platformId: "starz", name: "Starz", color: "#06b6d4", icon: "STARZ" },
    { platformId: "amc", name: "AMC+", color: "#14b8a6", icon: "amc+" },
    { platformId: "mgm", name: "MGM+", color: "#fbbf24", icon: "MGM+" },
    { platformId: "tubi", name: "Tubi TV", color: "#ec4899", icon: "tubi" },
    { platformId: "pluto", name: "Pluto TV", color: "#ffea00", icon: "pluto tv" }
  ];

  function _renderBrowseProvidersRow() {
    const container = document.getElementById("browse-providers-container");
    if (!container) return;

    container.innerHTML = `
      <div class="browse-providers-header">
        <h3 class="browse-providers-title">Browse by Provider</h3>
      </div>
      <div class="browse-providers-rail" id="browse-providers-rail">
        ${_BROWSE_PROVIDERS.map(p => `
          <button type="button" class="provider-pill-card ${p.platformId === _activePlatformId ? 'active' : ''}"
                  data-platform="${p.platformId}"
                  title="${_esc(p.name)}"
                  aria-label="${_esc(p.name)}"
                  style="--p-color: ${p.color};"
                  onclick="App.filterByProvider('${p.platformId}', '${_esc(p.name)}')">
            <span class="provider-pill-badge" style="color:${p.color};">
              ${_esc(p.icon)}
            </span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function filterByProvider(platformId, providerName) {
    if (_currentPage !== "home") {
      _showPage("home");
    }
    // Update active highlight in the Browse by Provider rail
    document.querySelectorAll(".provider-pill-card").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-platform") === platformId);
    });
    if (typeof selectPlatform === "function") {
      selectPlatform(platformId);
      const section = document.getElementById("streaming-platform-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  // ── Interactive Streaming Platform Sections (Netflix, Hulu, Prime Video, etc.) ────
  let _activePlatformId = "hulu";
  let _platformMediaType = "all";
  const _platformCache = new Map();
  let _platformFetchToken = 0;

  function _renderStreamingPlatformSection() {
    const container = document.getElementById("streaming-platform-section");
    if (!container) return;

    const platforms = typeof STREAMING_PLATFORMS !== "undefined" ? STREAMING_PLATFORMS : [];
    if (!platforms.length) return;

    const current = platforms.find(p => p.id === _activePlatformId) || platforms[0];
    if (!current) return;

    container.innerHTML = `
      <div class="platform-header-row">
        <div class="platform-title-group">
          <h2 class="platform-title">
            <span>Only on</span>
            <span class="platform-accent-name" id="platform-accent-name" style="color: ${current.accentColor}">${_esc(current.name)}</span>
          </h2>
          <p class="platform-subtitle" id="platform-subtitle">${_esc(current.tagline)}</p>
        </div>
        <div class="platform-header-actions" role="tablist" aria-label="Filter content type">
          <button class="platform-type-pill ${_platformMediaType === 'all' ? 'active' : ''}" data-type="all" onclick="App.setPlatformMediaType('all')" role="tab" aria-selected="${_platformMediaType === 'all'}">All</button>
          <button class="platform-type-pill ${_platformMediaType === 'movie' ? 'active' : ''}" data-type="movie" onclick="App.setPlatformMediaType('movie')" role="tab" aria-selected="${_platformMediaType === 'movie'}">Movies</button>
          <button class="platform-type-pill ${_platformMediaType === 'tv' ? 'active' : ''}" data-type="tv" onclick="App.setPlatformMediaType('tv')" role="tab" aria-selected="${_platformMediaType === 'tv'}">TV Shows</button>
        </div>
      </div>

      <div class="platform-selector-scroll-wrap">
        <div class="platform-selector-scroll" id="platform-selector-scroll" role="tablist" aria-label="Select streaming service">
          ${platforms.map(p => `
            <button class="platform-pill ${p.id === _activePlatformId ? 'active' : ''}"
                    data-platform="${p.id}"
                    role="tab"
                    aria-selected="${p.id === _activePlatformId}"
                    aria-label="${_esc(p.name)}"
                    onclick="App.selectPlatform('${p.id}')">
              ${p.logoHtml}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="platform-rail-wrap">
        <button class="platform-arrow platform-arrow-prev" onclick="App.scrollPlatformRail(-1)" aria-label="Scroll platform titles left">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <div class="platform-rail" id="platform-cards-rail">
          ${_renderPlatformSkeletons()}
        </div>
        <button class="platform-arrow platform-arrow-next" onclick="App.scrollPlatformRail(1)" aria-label="Scroll platform titles right">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>
    `;

    _loadPlatformContent(_activePlatformId);
  }

  function _renderPlatformSkeletons() {
    return Array(6).fill(0).map(() => `
      <div class="platform-skeleton-card">
        <div class="platform-skeleton-img"></div>
        <div class="platform-skeleton-meta">
          <div class="platform-skeleton-line"></div>
          <div class="platform-skeleton-line short"></div>
        </div>
      </div>
    `).join("");
  }

  async function _loadPlatformContent(platformId) {
    const rail = document.getElementById("platform-cards-rail");
    if (!rail) return;

    const platforms = typeof STREAMING_PLATFORMS !== "undefined" ? STREAMING_PLATFORMS : [];
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    // Fast memory cache check
    if (_platformCache.has(platformId)) {
      _displayPlatformCards(_platformCache.get(platformId));
      return;
    }

    // Render skeleton loaders while fetching
    rail.innerHTML = _renderPlatformSkeletons();

    const thisToken = ++_platformFetchToken;

    try {
      const data = await TMDB.getPlatformTitles(platform.providerId, {
        mediaType: "all",
        region: "US",
        sortBy: "popularity.desc",
        page: 1
      });

      if (thisToken !== _platformFetchToken) return;

      _platformCache.set(platformId, data);
      _displayPlatformCards(data);
    } catch (err) {
      if (thisToken !== _platformFetchToken) return;
      console.warn(`[Platform] Error fetching titles for ${platform.name}:`, err);
      rail.innerHTML = `
        <div class="platform-empty-state">
          <p>No streaming titles currently verified for ${platform.name} in this region.</p>
        </div>
      `;
    }
  }

  function _displayPlatformCards(data) {
    const rail = document.getElementById("platform-cards-rail");
    if (!rail) return;

    let items = [];
    if (_platformMediaType === "movie") {
      items = (data.movies && data.movies.length) ? data.movies : (data.results || []).filter(i => i.media === "movie");
    } else if (_platformMediaType === "tv") {
      items = (data.tv && data.tv.length) ? data.tv : (data.results || []).filter(i => i.media === "tv");
    } else {
      items = data.results || [];
    }

    if (!items.length) {
      const platforms = typeof STREAMING_PLATFORMS !== "undefined" ? STREAMING_PLATFORMS : [];
      const current = platforms.find(p => p.id === _activePlatformId);
      rail.innerHTML = `
        <div class="platform-empty-state">
          <p>No verified titles found for this filter on ${current ? current.name : "this service"}.</p>
        </div>
      `;
      return;
    }

    rail.innerHTML = items.map((item, idx) => {
      const backdrop = item.backdrop || item.poster || "";
      const rating = item.rating > 0 ? item.rating.toFixed(1) : null;
      const mediaLabel = item.media === "tv" ? "TV Show" : "Movie";

      // Authentic UI badges matching reference screenshot
      let badgeHtml = "";
      if (item.media === "tv" && (idx % 3 === 0)) {
        badgeHtml = `<span class="platform-card-badge badge-new">New episode</span>`;
      } else if (idx % 4 === 1) {
        badgeHtml = `<span class="platform-card-badge badge-recent">Recently added</span>`;
      }

      return `
        <div class="platform-card" onclick="App.openItem(${_jsonAttr(item)})" role="button" tabindex="0" onkeydown="if(event.key==='Enter')App.openItem(${_jsonAttr(item)})" aria-label="${_esc(item.title)}">
          <div class="platform-card-img-wrap">
            <img class="platform-card-img" src="${backdrop}" alt="${_esc(item.title)}" loading="lazy" onerror="this.src='${item.poster || ""}'" />
            ${badgeHtml}
            <div class="platform-card-play-overlay">
              <div class="platform-play-circle">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          </div>
          <div class="platform-card-meta">
            <div class="platform-card-title">${_esc(item.title)}</div>
            <div class="platform-card-sub">
              ${rating ? `<span><svg class="platform-star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#f59e0b" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${rating}</span> <span>&bull;</span>` : ""}
              ${item.year ? `<span>${item.year}</span> <span>&bull;</span>` : ""}
              <span>${mediaLabel}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function selectPlatform(platformId) {
    if (_activePlatformId === platformId) return;
    _activePlatformId = platformId;

    const platforms = typeof STREAMING_PLATFORMS !== "undefined" ? STREAMING_PLATFORMS : [];
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    // Update active pill state
    const pills = document.querySelectorAll(".platform-pill");
    pills.forEach(p => {
      const isActive = p.getAttribute("data-platform") === platformId;
      p.classList.toggle("active", isActive);
      p.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // Update headline accent and subtitle
    const titleAccent = document.getElementById("platform-accent-name");
    if (titleAccent) {
      titleAccent.textContent = platform.name;
      titleAccent.style.color = platform.accentColor;
    }
    const sub = document.getElementById("platform-subtitle");
    if (sub) {
      sub.textContent = platform.tagline;
    }

    _loadPlatformContent(platformId);
  }

  function setPlatformMediaType(type) {
    _platformMediaType = type;
    const buttons = document.querySelectorAll(".platform-type-pill");
    buttons.forEach(b => {
      const isActive = b.getAttribute("data-type") === type;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (_platformCache.has(_activePlatformId)) {
      _displayPlatformCards(_platformCache.get(_activePlatformId));
    } else {
      _loadPlatformContent(_activePlatformId);
    }
  }

  function scrollPlatformRail(dir) {
    const rail = document.getElementById("platform-cards-rail");
    if (!rail) return;
    const amount = (rail.clientWidth || 600) * 0.75 * dir;
    rail.scrollBy({ left: amount, behavior: "smooth" });
  }

  // ── Home rows (General Entertainment: Movies / Series / Dramas) ───────────
  async function _renderHomeRows() {
    const container = document.getElementById("home-rows");
    if (!container) return;
    container.innerHTML = "";

    const activeRows = HOME_ROWS.filter(r => r.home !== false);
    let rowIndex = 0;

    const rowObserver = ("IntersectionObserver" in window)
      ? new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const sec = entry.target;
              obs.unobserve(sec);
              const rId = sec.getAttribute("data-row-id");
              const rIdx = parseInt(sec.getAttribute("data-row-index"), 10) || 0;
              const targetRow = activeRows.find(r => r.id === rId);
              if (targetRow && !sec._isRowLoaded) {
                sec._isRowLoaded = true;
                _loadRow(targetRow, sec, rIdx);
              }
            }
          });
        }, { rootMargin: "650px 0px" })
      : null;

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      const section = _createRowSection(row);
      section.setAttribute("data-row-id", row.id);
      section.setAttribute("data-row-index", rowIndex);
      container.appendChild(section);

      if (i < 4 || !rowObserver) {
        section._isRowLoaded = true;
        _loadRow(row, section, rowIndex++);
      } else {
        rowIndex++;
        rowObserver.observe(section);
      }
    }
  }

  // ── Anime rows (Dedicated Anime & Donghua Section) ───────────────────────
  async function _renderAnimeHomeRows() {
    const container = document.getElementById("anime-home-rows");
    if (!container) return;
    container.innerHTML = "";

    const activeRows = ANIME_ROWS.filter(r => r.home !== false);
    let rowIndex = 0;

    const rowObserver = ("IntersectionObserver" in window)
      ? new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const sec = entry.target;
              obs.unobserve(sec);
              const rId = sec.getAttribute("data-row-id");
              const rIdx = parseInt(sec.getAttribute("data-row-index"), 10) || 0;
              const targetRow = activeRows.find(r => r.id === rId);
              if (targetRow && !sec._isRowLoaded) {
                sec._isRowLoaded = true;
                _loadRow(targetRow, sec, rIdx);
              }
            }
          });
        }, { rootMargin: "650px 0px" })
      : null;

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      const section = _createRowSection(row);
      section.setAttribute("data-row-id", row.id);
      section.setAttribute("data-row-index", rowIndex);
      container.appendChild(section);

      if (i < 4 || !rowObserver) {
        section._isRowLoaded = true;
        _loadRow(row, section, rowIndex++);
      } else {
        rowIndex++;
        rowObserver.observe(section);
      }
    }
  }

  // ── Date formatter for metadata (e.g. "Oct 6") ────────────────────────
  function _formatShortDate(str) {
    if (!str) return "";
    try {
      const parts = str.split("-");
      if (parts.length >= 3) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (months[m] && !isNaN(d)) return `${months[m]} ${d}`;
      }
    } catch { }
    return str.slice(0, 4);
  }

  function _createRowSection(row) {
    const isBackdrop = row.cardType === "backdrop";
    const isTop10 = row.cardType === "top10" || row.isTop10;
    const section = document.createElement("section");
    section.className = `row-section ${isBackdrop ? "row-backdrop-style" : ""} ${isTop10 ? "row-top10-style" : ""}`;
    section.id = `row-${row.id}`;
    if (row.category) section.setAttribute("data-category", row.category);

    const subtitleHTML = row.subtitle ? `<span class="row-subtitle">${_esc(row.subtitle)}</span>` : "";

    section.innerHTML = `
      <div class="row-header">
        <div class="row-title-wrap">
          <h2 class="row-title">${_esc(_plainLabel(row.label))}</h2>
          ${subtitleHTML}
        </div>
        <button class="row-see-all" onclick="App.openBrowse('${row.id}')">
          <span>View all</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>
      <div class="row-rail-wrap">
        <button class="row-arrow row-arrow-prev" onclick="App.scrollRow('row-scroll-${row.id}', -1)" aria-label="Scroll left">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <div class="row-scroll ${isBackdrop ? "row-scroll-backdrop" : ""} ${isTop10 ? "row-scroll-top10" : ""}" id="row-scroll-${row.id}">
          ${Array(8).fill(isTop10
            ? '<div class="top10-item top10-skeleton"><div class="top10-rank">1</div><div class="top10-card-wrap"><div class="card-poster" style="background:rgba(255,255,255,0.05);"></div><div class="card-info"><div class="skeleton-line" style="height:12px;width:75%;margin-top:8px"></div></div></div></div>'
            : (isBackdrop
              ? '<div class="card card-backdrop-type card-skeleton"><div class="card-backdrop-poster"></div><div class="card-info"><div class="skeleton-line" style="height:14px;width:70%;margin-top:8px"></div><div class="skeleton-line" style="height:10px;width:40%;margin-top:6px"></div></div></div>'
              : '<div class="card card-skeleton"><div class="card-poster"></div><div class="card-info"><div class="skeleton-line" style="height:12px;width:75%;margin-top:8px"></div><div class="skeleton-line" style="height:10px;width:40%;margin-top:6px"></div></div></div>')).join("")}
        </div>
        <button class="row-arrow row-arrow-next" onclick="App.scrollRow('row-scroll-${row.id}', 1)" aria-label="Scroll right">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>`;
    return section;
  }

  async function _loadRow(row, section, rowIndex = 0) {
    try {
      const data = await _fetchRowData(row, 1);
      _infiniteState[row.id] = { page: 1, total: data.total_pages, loading: false };

      const scroll = section.querySelector(`#row-scroll-${row.id}`);
      if (!scroll) return;
      const isTop10 = row.cardType === "top10" || row.isTop10;
      const isBackdrop = row.cardType === "backdrop";

      if (isTop10) {
        scroll.classList.add("row-scroll-top10");
        const top10 = (data.results || [])
          .filter(i => (i.poster || i.backdrop))
          .slice(0, 10);
        scroll.innerHTML = top10.map((i, idx) => _top10CardHTML(i, idx + 1)).join("");
      } else {
        scroll.innerHTML = data.results
          .filter(i => (isBackdrop ? (i.backdrop || i.poster) : i.poster))
          .map(i => (isBackdrop ? _backdropCardHTML(i) : _cardHTML(i)))
          .join("");
      }

      // Observe lazy images
      scroll.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));

      // Infinite scroll on the row (only for non-top10 rows)
      if (!isTop10) {
        _setupRowInfiniteScroll(row, scroll);
      }

      // Initialize automatic horizontal scroll for this section
      _initRowAutoScroll(scroll, row.id, rowIndex);
    } catch (err) {
      const scroll = section.querySelector(`#row-scroll-${row.id}`);
      if (scroll) scroll.innerHTML = `<p class="row-error">Failed to load — ${_esc(err.message)}</p>`;
    }
  }

  function _setupRowInfiniteScroll(row, scroll) {
    const sentinel = document.createElement("div");
    sentinel.className = "scroll-sentinel";
    scroll.appendChild(sentinel);

    const obs = new IntersectionObserver(async entries => {
      if (!entries[0].isIntersecting) return;
      const state = _infiniteState[row.id];
      if (!state || state.loading || state.page >= state.total) return;

      state.loading = true;
      const loader = document.createElement("div");
      loader.className = "row-loader";
      loader.innerHTML = `<div class="loader-dots"><span></span><span></span><span></span></div>`;
      scroll.insertBefore(loader, sentinel);

      try {
        const data = await _fetchRowData(row, state.page + 1);
        state.page++;
        state.total = data.total_pages;
        loader.remove();

        const isBackdrop = row.cardType === "backdrop";
        const frag = document.createDocumentFragment();
        data.results.filter(i => (isBackdrop ? (i.backdrop || i.poster) : i.poster)).forEach(i => {
          const div = document.createElement("div");
          div.innerHTML = isBackdrop ? _backdropCardHTML(i) : _cardHTML(i);
          const card = div.firstElementChild;
          frag.appendChild(card);
          card.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
        });
        scroll.insertBefore(frag, sentinel);
      } catch { }
      state.loading = false;
    }, { rootMargin: "300px" });

    obs.observe(sentinel);
  }

  // ── 1Flex-Inspired Desktop Card Hover Preview Popover ─────────────────────
  const _cardRegistry = new Map();

  function registerCardItem(item) {
    if (!item || !item.id) return;
    const key = `${item.media || "movie"}:${item.id}`;
    _cardRegistry.set(key, item);
  }

  const CardPreview = (() => {
    let _popoverEl = null;
    let _activeCard = null;
    let _activeItem = null;
    let _showTimer = null;
    let _hideTimer = null;
    const SHOW_DELAY = 260; // ms
    const HIDE_DELAY = 180; // ms

    function init() {
      _popoverEl = document.getElementById("card-hover-popover");
      if (!_popoverEl) return;

      // Keep popover open while cursor is inside popover
      _popoverEl.addEventListener("mouseenter", () => {
        if (_hideTimer) {
          clearTimeout(_hideTimer);
          _hideTimer = null;
        }
      });

      _popoverEl.addEventListener("mouseleave", () => {
        _startHideTimer();
      });

      // Global delegation for .card elements on desktop
      document.addEventListener("mouseover", (e) => {
        if (window.innerWidth < 768) return;
        if (document.body.classList.contains("has-modal-open") || document.body.classList.contains("big-player-active")) {
          hideImmediate();
          return;
        }

        const card = e.target.closest(".card");
        if (!card) return;

        if (card === _activeCard) {
          if (_hideTimer) {
            clearTimeout(_hideTimer);
            _hideTimer = null;
          }
          return;
        }

        _activeCard = card;
        if (_showTimer) clearTimeout(_showTimer);
        if (_hideTimer) clearTimeout(_hideTimer);

        _showTimer = setTimeout(() => {
          _showForCard(card);
        }, SHOW_DELAY);
      });

      document.addEventListener("mouseout", (e) => {
        const card = e.target.closest(".card");
        if (card && card === _activeCard) {
          const related = e.relatedTarget;
          if (related && (card.contains(related) || (_popoverEl && _popoverEl.contains(related)))) {
            return;
          }
          if (_showTimer) {
            clearTimeout(_showTimer);
            _showTimer = null;
          }
          _startHideTimer();
        }
      });

      // Dismiss on window scroll or Escape key
      window.addEventListener("scroll", () => {
        if (_popoverEl && _popoverEl.classList.contains("visible")) {
          hideImmediate();
        }
      }, { passive: true });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideImmediate();
      });

      // Action buttons inside popover
      const playBtn = document.getElementById("chp-play-btn");
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          if (_activeItem) {
            const itm = _activeItem;
            hideImmediate();
            App.openItem(itm);
            setTimeout(() => {
              if (window.Player && typeof window.Player.watchNow === "function") {
                window.Player.watchNow();
              }
            }, 300);
          }
        };
      }

      const wlBtn = document.getElementById("chp-wl-btn");
      if (wlBtn) {
        wlBtn.onclick = (e) => {
          e.stopPropagation();
          if (_activeItem) {
            App.toggleWL(_activeItem);
            _updateWatchlistBtn();
          }
        };
      }

      const likeBtn = document.getElementById("chp-like-btn");
      if (likeBtn) {
        likeBtn.onclick = (e) => {
          e.stopPropagation();
          if (_activeItem) {
            _toggleReaction("like");
          }
        };
      }

      const dislikeBtn = document.getElementById("chp-dislike-btn");
      if (dislikeBtn) {
        dislikeBtn.onclick = (e) => {
          e.stopPropagation();
          if (_activeItem) {
            _toggleReaction("dislike");
          }
        };
      }

      const downBtn = document.getElementById("chp-down-btn");
      if (downBtn) {
        downBtn.onclick = (e) => {
          e.stopPropagation();
          if (_activeItem) {
            const itm = _activeItem;
            hideImmediate();
            // Feature 2: Clicking down chevron opens the cinematic detail modal
            App.openItem(itm);
          }
        };
      }
    }

    function _startHideTimer() {
      if (_hideTimer) clearTimeout(_hideTimer);
      _hideTimer = setTimeout(() => {
        hideImmediate();
      }, HIDE_DELAY);
    }

    function hideImmediate() {
      if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
      if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
      _activeCard = null;
      _activeItem = null;
      if (_popoverEl) {
        _popoverEl.classList.remove("visible");
        _popoverEl.style.display = "none";
      }
    }

    function _showForCard(card) {
      if (!card || !card.isConnected) return;
      const media = card.getAttribute("data-card-media") || "movie";
      const id = card.getAttribute("data-card-id");
      let item = id ? _cardRegistry.get(`${media}:${id}`) : null;

      if (!item) {
        const raw = card.getAttribute("data-item");
        if (raw) {
          try { item = JSON.parse(raw); } catch (_) {}
        }
      }

      if (!item) return;
      _activeItem = item;

      const img = document.getElementById("chp-img");
      const title = document.getElementById("chp-title");
      const runtime = document.getElementById("chp-runtime");
      const certBadge = document.getElementById("chp-cert-badge");
      const rating = document.getElementById("chp-rating");
      const genres = document.getElementById("chp-genres");
      const progressWrap = document.getElementById("chp-progress-wrap");
      const progressFill = document.getElementById("chp-progress-fill");
      const progressText = document.getElementById("chp-progress-text");

      const backdropUrl = item.backdrop || item.poster || "";
      if (img) img.src = backdropUrl;
      if (title) title.textContent = item.title || "";

      const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
        ? item.rating.toFixed(1)
        : "8.5";
      if (rating) rating.innerHTML = `★ ${ratingVal}`;

      const isAdult = item.adult || false;
      const cert = isAdult ? "18+" : (parseFloat(ratingVal) >= 7.5 ? "R" : "PG-13");
      if (certBadge) certBadge.textContent = cert;

      const runtimeVal = item.runtime
        ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
        : (item.media === "tv" ? "TV Series" : "2h 15m");
      if (runtime) runtime.textContent = runtimeVal;

      let genreText = "";
      if (item.genres && Array.isArray(item.genres) && item.genres.length) {
        genreText = item.genres.slice(0, 3).join(" • ");
      } else if (item.genre_ids && Array.isArray(item.genre_ids)) {
        const map = (typeof GENRE_MAP !== "undefined" && GENRE_MAP[item.media || "movie"]) || {};
        genreText = item.genre_ids.map(gid => map[gid]).filter(Boolean).slice(0, 3).join(" • ");
      }
      if (genres) genres.textContent = genreText || (item.media === "tv" ? "Action • Drama" : "Sci-Fi • Thriller");

      const progress = (typeof StreamXHistory !== "undefined" && StreamXHistory.getProgress)
        ? StreamXHistory.getProgress(item.id)
        : null;
      if (progress && progress.duration > 0 && progressWrap && progressFill && progressText) {
        const pct = Math.min(100, Math.round((progress.currentTime / progress.duration) * 100));
        progressFill.style.width = `${pct}%`;
        const curM = Math.floor(progress.currentTime / 60);
        const totM = Math.floor(progress.duration / 60);
        progressText.textContent = `${curM} of ${totM}m`;
        progressWrap.style.display = "flex";
      } else if (progressWrap) {
        progressWrap.style.display = "none";
      }

      _updateWatchlistBtn();
      _updateReactionBtns();

      const rect = card.getBoundingClientRect();
      const popoverWidth = 324;
      let left = rect.left + (rect.width - popoverWidth) / 2;
      left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, left));

      let top = rect.top + window.scrollY - 16;
      if (top < window.scrollY + 76) {
        top = window.scrollY + 76;
      }

      _popoverEl.style.left = `${Math.round(left)}px`;
      _popoverEl.style.top = `${Math.round(top)}px`;
      _popoverEl.style.display = "block";

      requestAnimationFrame(() => {
        _popoverEl.classList.add("visible");
      });
    }

    function _updateWatchlistBtn() {
      const wlBtn = document.getElementById("chp-wl-btn");
      if (!wlBtn || !_activeItem) return;
      const isWl = (typeof Watchlist !== "undefined" && Watchlist.has)
        ? Watchlist.has(_activeItem.id, _activeItem.media)
        : false;
      if (isWl) {
        wlBtn.classList.add("active");
        wlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        wlBtn.title = "In Watchlist";
      } else {
        wlBtn.classList.remove("active");
        wlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        wlBtn.title = "Add to Watchlist";
      }
    }

    function _updateReactionBtns() {
      const likeBtn = document.getElementById("chp-like-btn");
      const dislikeBtn = document.getElementById("chp-dislike-btn");
      if (!_activeItem) return;
      const reaction = localStorage.getItem(`streamx_react_${_activeItem.id}`);
      if (likeBtn) likeBtn.classList.toggle("active", reaction === "like");
      if (dislikeBtn) dislikeBtn.classList.toggle("active", reaction === "dislike");
    }

    function _toggleReaction(type) {
      if (!_activeItem) return;
      const key = `streamx_react_${_activeItem.id}`;
      const cur = localStorage.getItem(key);
      if (cur === type) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, type);
      }
      _updateReactionBtns();
    }

    return { init, hideImmediate, registerCardItem };
  })();

  // ── Landscape 16:9 Backdrop Card HTML (Reference: Current & Upcoming TV) ─
  function _backdropCardHTML(item) {
    registerCardItem(item);
    const wl = Watchlist.has(item.id, item.media);
    const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
      ? item.rating.toFixed(1) : null;
    const imgUrl = item.backdrop || item.poster || "";
    const epBadgeText = item.media === "tv" ? "New Episode" : "New Season";

    const epCode = item.season_episode || (item.media === "tv" ? "TV Series" : "HD");
    const dateStr = item.release_date ? _formatShortDate(item.release_date) : (item.year ? item.year : "");

    return `
      <div class="card card-backdrop-type" id="card-${item.media}-${item.id}" data-card-media="${item.media || 'movie'}" data-card-id="${item.id}" onclick="App.openItem(${_jsonAttr(item)})" role="button" tabindex="0" aria-label="${_esc(item.title)}">
        <div class="card-backdrop-poster">
          <img data-src="${imgUrl}" alt="${_esc(item.title)}" class="card-img lazy" loading="lazy">
          <div class="card-no-img" style="display:${imgUrl ? "none" : "flex"}">${_esc((item.title || "?").charAt(0))}</div>
          <div class="card-overlay">
            <div class="card-backdrop-watch-btn" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <span>Watch Now</span>
            </div>
          </div>
          <span class="card-pill-badge">${epBadgeText}</span>
          <button class="card-wl${wl ? " added" : ""}"
            onclick="event.stopPropagation();App.toggleWL(${_jsonAttr(item)})"
            aria-label="${wl ? "Remove from" : "Add to"} watchlist" title="${wl ? "In Watchlist" : "Save to Watchlist"}">
            ${wl ? _CHECK_SVG : _PLUS_SVG}
          </button>
        </div>
        <div class="card-info">
          <div class="card-title" title="${_esc(item.title)}">${_esc(item.title)}</div>
          <div class="card-meta backdrop-meta">
            ${ratingVal ? `<span class="card-rating"><svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#f59e0b"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> <span>${ratingVal}</span></span>` : ""}
            ${epCode ? `<span class="card-ep-code">${epCode}</span>` : ""}
            ${dateStr ? `<span class="card-date">${dateStr}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  // ── Standard 2:3 Portrait Card HTML (Reference: Trending This Week) ───────
  function _cardHTML(item) {
    registerCardItem(item);
    const wl = Watchlist.has(item.id, item.media);
    let badgeText = "MOVIE";
    const mediaLower = (item.media || "").toLowerCase();

    if (mediaLower === "tv") badgeText = "TV";
    else if (mediaLower === "anime") badgeText = "ANIME";
    else if (mediaLower === "donghua") badgeText = "DONGHUA";
    else if (mediaLower === "drama") badgeText = "DRAMA";
    else if (mediaLower === "movie") badgeText = "MOVIE";
    else {
      badgeText = mediaLower.toUpperCase() || "MOVIE";
    }

    const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
      ? item.rating.toFixed(1) : null;

    return `
      <div class="card" id="card-${item.media}-${item.id}" data-card-media="${item.media || 'movie'}" data-card-id="${item.id}" onclick="App.openItem(${_jsonAttr(item)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.openItem(${_jsonAttr(item)});} " role="button" tabindex="0" aria-label="${_esc(item.title)}">
        <div class="card-poster">
          <img data-src="${item.poster || ""}" alt="${_esc(item.title)}" class="card-img lazy" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
          <div class="card-no-img" style="display:${item.poster ? "none" : "flex"}">${_esc((item.title || "?").charAt(0))}</div>
          <div class="card-overlay">
            <div class="card-play-btn" aria-hidden="true">${_PLAY_SVG}</div>
          </div>
          <span class="card-badge badge-${item.media}">${badgeText}</span>
          <button class="card-wl${wl ? " added" : ""}"
            onclick="event.stopPropagation();App.toggleWL(${_jsonAttr(item)})"
            aria-label="${wl ? "Remove from" : "Add to"} watchlist" title="${wl ? "In Watchlist" : "Save to Watchlist"}">
            ${wl ? _CHECK_SVG : _PLUS_SVG}
          </button>
        </div>
        <div class="card-info">
          <div class="card-title" title="${_esc(item.title)}">${_esc(item.title)}</div>
          <div class="card-meta">
            ${ratingVal ? `<span class="card-rating"><svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#f59e0b"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> <span>${ratingVal}</span></span>` : ""}
            ${item.year ? `<span class="card-year">${item.year}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  // ── Top 10 Styled Card with Giant Rank Number (1Flex-inspired) ───────────
  function _top10CardHTML(item, rank) {
    registerCardItem(item);
    const wl = Watchlist.has(item.id, item.media);
    const ratingVal = typeof item.rating === "number" && !isNaN(item.rating) && item.rating > 0
      ? item.rating.toFixed(1) : null;

    return `
      <div class="top10-item" id="top10-${item.media}-${item.id}" data-card-media="${item.media || 'movie'}" data-card-id="${item.id}" onclick="App.openItem(${_jsonAttr(item)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.openItem(${_jsonAttr(item)});} " role="button" tabindex="0" aria-label="#${rank} ${_esc(item.title)}">
        <div class="top10-rank" aria-hidden="true">${rank}</div>
        <div class="top10-card-wrap">
          <div class="card-poster">
            <img data-src="${item.poster || ""}" alt="${_esc(item.title)}" class="card-img lazy" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
            <div class="card-no-img" style="display:${item.poster ? "none" : "flex"}">${_esc((item.title || "?").charAt(0))}</div>
            <div class="card-overlay">
              <div class="card-play-btn" aria-hidden="true">${_PLAY_SVG}</div>
            </div>
            <span class="card-badge badge-top10">TOP 10</span>
            <button class="card-wl${wl ? " added" : ""}"
              onclick="event.stopPropagation();App.toggleWL(${_jsonAttr(item)})"
              aria-label="${wl ? "Remove from" : "Add to"} watchlist" title="${wl ? "In Watchlist" : "Save to Watchlist"}">
              ${wl ? _CHECK_SVG : _PLUS_SVG}
            </button>
          </div>
          <div class="card-info">
            <div class="card-title" title="${_esc(item.title)}">${_esc(item.title)}</div>
            <div class="card-meta">
              ${ratingVal ? `<span class="card-rating"><svg class="star-icon" viewBox="0 0 24 24" width="12" height="12" fill="#f59e0b"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> <span>${ratingVal}</span></span>` : ""}
              ${item.year ? `<span class="card-year">${item.year}</span>` : ""}
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── History rows (Unified Watch History) ─────────────────
  function _renderHistoryRows() {
    const container = document.getElementById("history-rows");
    if (!container) return;
    container.innerHTML = "";

    const watched = (typeof StreamXHistory !== "undefined" && StreamXHistory.getWatchHistory) ? StreamXHistory.getWatchHistory() : [];
    const recent = (typeof StreamXHistory !== "undefined" && StreamXHistory.getRecentlyViewed) ? StreamXHistory.getRecentlyViewed() : [];

    // Deduplicate combined watch history
    const seen = new Set();
    const combined = [];
    for (const item of watched) {
      if (!item || !item.id) continue;
      const key = `${item.media || "movie"}_${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }
    for (const item of recent) {
      if (!item || !item.id) continue;
      const key = `${item.media || "movie"}_${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    if (combined.length) {
      const sec = _buildStaticRow("Continue Watching", combined, true);
      if (_isHistoryEditing) {
        sec.classList.add("is-editing");
      }
      container.appendChild(sec);
      const scroll = sec.querySelector("#row-scroll-continue-watching");
      if (scroll) _initRowAutoScroll(scroll, "continue-watching", 0);
    }
  }

  function _buildStaticRow(label, items, showEpInfo) {
    const rowId = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const section = document.createElement("section");
    section.className = "row-section";
    section.id = `row-${rowId}`;
    section.innerHTML = `
      <div class="row-header">
        <div class="row-header-title-group" style="display:flex; align-items:center; gap:10px;">
          <h2 class="row-title">${label}</h2>
          ${(label === "Watch History" || label === "Continue Watching") ? `
            <button class="row-edit-pencil-btn" onclick="App.toggleContinueWatchingEdit()" title="Manage Watch History" aria-label="Manage Watch History">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>` : ""}
        </div>
        ${(label === "Watch History" || label === "Continue Watching") ? `
          <button type="button" class="row-clear-all-btn" onclick="App.clearAllWatchHistory()" title="Clear Watch History">
            Clear All
          </button>` : ""}
      </div>
      <div class="row-rail-wrap">
        <button class="row-arrow row-arrow-prev" onclick="App.scrollRow('row-scroll-${rowId}', -1)" aria-label="Scroll left">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <div class="row-scroll" id="row-scroll-${rowId}">
          ${items.map(i => _historyCardHTML(i, showEpInfo)).join("")}
        </div>
        <button class="row-arrow row-arrow-next" onclick="App.scrollRow('row-scroll-${rowId}', 1)" aria-label="Scroll right">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>`;
    section.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
    return section;
  }

  function _historyCardHTML(item, showEpInfo) {
    const hasEp = (item.season != null || item.episode != null);
    let epLabel = "";
    if (showEpInfo && hasEp) {
      if (item.season != null && item.episode != null) {
        epLabel = `S${item.season} E${item.episode}`;
      } else if (item.episode != null) {
        epLabel = `EP ${item.episode}`;
      }
    }

    let progressPercent = 35;
    let timeHint = "";
    if (item.duration && item.duration > 0 && item.progress > 0) {
      progressPercent = Math.min(100, Math.max(5, Math.round((item.progress / item.duration) * 100)));
      const remainingSecs = Math.max(0, item.duration - item.progress);
      const remainingMins = Math.round(remainingSecs / 60);
      timeHint = remainingMins > 0 ? `${remainingMins}m left` : "Finished";
    } else if (item.progress && item.progress > 0) {
      progressPercent = 45;
      timeHint = "In progress";
    }

    const safeId = String(item.id || "").replace(/'/g, "\\'");
    const safeMedia = String(item.media || "movie").replace(/'/g, "\\'");
    registerCardItem(item);

    return `
      <div class="card history-card" id="card-${item.media || 'movie'}-${item.id}" data-card-media="${item.media || 'movie'}" data-card-id="${item.id}" onclick="App.openItem(${_jsonAttr(item)})" role="button" tabindex="0" aria-label="Resume ${_esc(item.title)}">
        <div class="card-poster history-poster">
          <img data-src="${item.poster || ""}" alt="${_esc(item.title)}" class="card-img lazy" loading="lazy">
          <div class="card-no-img" style="display:${item.poster ? "none" : "flex"}">${_esc((item.title || "?").charAt(0))}</div>
          <div class="card-overlay">
            <div class="card-play-btn" aria-hidden="true">${_PLAY_SVG}</div>
          </div>
          ${epLabel ? `<div class="history-ep">${epLabel}</div>` : ""}
          <button type="button" class="history-remove-btn" onclick="event.stopPropagation(); event.preventDefault(); App.removeFromHistory('${safeId}', '${safeMedia}')" ontouchstart="event.stopPropagation();" aria-label="Remove from Watch History" title="Remove from Watch History">
            ${_CLOSE_SVG}
          </button>
          <div class="history-progress-track">
            <div class="history-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>
        <div class="card-info">
          <div class="card-title" title="${_esc(item.title)}">${_esc(item.title)}</div>
          <div class="card-meta">
            ${timeHint ? `<span class="history-time-hint">${timeHint}</span>` : ""}
            ${item.year ? `<span class="card-year">${item.year}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  function removeFromHistory(id, media) {
    if (window.StreamXHistory) {
      if (typeof StreamXHistory.removeFromWatch === "function") {
        StreamXHistory.removeFromWatch(id, media);
      }
      if (typeof StreamXHistory.removeFromRecent === "function") {
        StreamXHistory.removeFromRecent(id, media);
      }
    }
    _renderHistoryRows();
    if (_currentPage === "history-page") {
      _renderHistoryPage();
    }
    if (_currentPage === "continue-page") {
      _renderContinuePage();
    }
    if (_currentPage === "profile-page") {
      _renderProfilePage();
    }
    _showToast("Removed from history");
  }

  function clearAllWatchHistory() {
    if (window.StreamXHistory && typeof StreamXHistory.clearHistory === "function") {
      StreamXHistory.clearHistory();
    } else if (window.StreamXHistory) {
      StreamXHistory.clearWatchHistory?.();
      StreamXHistory.clearRecentlyViewed?.();
    }
    try {
      localStorage.removeItem("streamx_v2_watch_history");
      localStorage.removeItem("streamx_v2_recent");
      localStorage.removeItem("streamx_manga_history");
    } catch (_) {}
    _renderHistoryRows();
    if (_currentPage === "history-page") {
      _renderHistoryPage();
    }
    if (_currentPage === "continue-page") {
      _renderContinuePage();
    }
    if (_currentPage === "profile-page") {
      _renderProfilePage();
    }
    _showToast("Watch history cleared");
  }

  // ── Home Page Section Continuous Auto-Horizontal Scroll Manager ──────────
  const _rowAutoScrolls = new Map();

  function _clearAllRowAutoScroll() {}
  function _isAutoScrollPage() { return false; }
  function _pauseAllRowAutoScroll() {}
  function _resumeAllRowAutoScroll() {}
  function _initRowAutoScroll() {
    // Disabled continuous autoscroll loops for silky smooth 120fps hardware-accelerated scrolling
  }

  function scrollRow(rowScrollId, direction) {
    const el = document.getElementById(rowScrollId);
    if (!el) return;
    const distance = Math.max(340, Math.round(el.clientWidth * 0.75));
    el.scrollBy({ left: direction * distance, behavior: "smooth" });

    // Pause continuous scroll when user manually clicks navigation arrows
    const rowId = rowScrollId.replace("row-scroll-", "");
    const autoScrollState = _rowAutoScrolls.get(rowId);
    if (autoScrollState && typeof autoScrollState.pauseTemporarily === "function") {
      autoScrollState.pauseTemporarily(6000);
      setTimeout(() => {
        if (el) autoScrollState.subpixelAccumulator = el.scrollLeft;
      }, 700);
    }
  }

  // ── Context-Aware Search & Filter System (Instant Live Preview + Full View All) ──
  let _liveSearchTimer = null;
  let _liveSearchToken = 0;

  function onSearchInput(val) {
    clearTimeout(_searchTimer);
    clearTimeout(_liveSearchTimer);

    const query = (val || "").trim();
    const dropdown = document.getElementById("search-history");
    const liveContainer = document.getElementById("search-modal-live-results");

    if (!query) {
      if (liveContainer) {
        liveContainer.style.display = "none";
        liveContainer.innerHTML = "";
      }
      if (dropdown) {
        _renderSearchHistoryDropdown(_searchHistory);
        dropdown.classList.add("show");
      }
      return;
    }

    if (dropdown) dropdown.classList.remove("show");

    if (query.length < 2) {
      if (liveContainer) {
        liveContainer.style.display = "none";
        liveContainer.innerHTML = "";
      }
      return;
    }

    // Instant searching feedback while typing
    if (liveContainer) {
      liveContainer.style.display = "flex";
      liveContainer.innerHTML = `
        <div style="padding:14px 20px; font-size:13.5px; color:rgba(255,255,255,0.65); display:flex; align-items:center; justify-content:center; gap:8px;">
          <div class="loader-spinner-sm" style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.2);border-top-color:#ff2a6d;border-radius:50%;animation:spin 0.6s linear infinite;"></div>
          <span>Searching for &ldquo;${_esc(query)}&rdquo;...</span>
        </div>
      `;
    }

    // Debounced live instant suggestions directly inside the search modal
    const currentToken = ++_liveSearchToken;
    _liveSearchTimer = setTimeout(async () => {
      try {
        if (!liveContainer) return;
        const res = await TMDB.search(query, 1);
        if (currentToken !== _liveSearchToken) return;

        const items = (res && res.results) ? res.results.slice(0, 5) : [];
        if (!items.length) {
          liveContainer.style.display = "flex";
          liveContainer.innerHTML = `
            <div style="padding:16px 20px; font-size:13.5px; color:rgba(255,255,255,0.5); text-align:center;">
              No instant matches found for "${_esc(query)}"
            </div>
            <button type="button" class="search-live-view-all" onclick="App.triggerSearch()">
              <span>Search full catalog &rarr;</span>
            </button>
          `;
          return;
        }

        liveContainer.style.display = "flex";
        liveContainer.innerHTML = `
          ${items.map(item => `
            <div class="search-live-item" onclick="App.toggleSearchModal(false); App.openItem(${_jsonAttr(item)})" role="button" tabindex="0">
              <img class="search-live-poster" src="${item.poster || ''}" alt="${_esc(item.title)}" onerror="this.style.display='none'" />
              <div class="search-live-info">
                <div class="search-live-title">${_esc(item.title)}</div>
                <div class="search-live-meta">
                  <span class="search-live-badge">${item.media === 'tv' ? 'TV Series' : (item.media === 'anime' ? 'Anime' : 'Movie')}</span>
                  ${item.year ? `<span>${item.year}</span>` : ''}
                  ${item.rating ? `<span class="search-live-rating">★ ${item.rating.toFixed(1)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join("")}
          <button type="button" class="search-live-view-all" onclick="App.triggerSearch()">
            <span>View all results for &ldquo;${_esc(query)}&rdquo;</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        `;
      } catch (err) {
        if (currentToken === _liveSearchToken) {
          console.warn("[Search] Live instant search preview failed:", err);
        }
      }
    }, 200);
  }

  function triggerSearch() {
    clearTimeout(_searchTimer);
    clearTimeout(_liveSearchTimer);
    const input = document.getElementById("search-input");
    const val = input ? input.value : "";
    document.getElementById("search-history")?.classList.remove("show");
    const liveContainer = document.getElementById("search-modal-live-results");
    if (liveContainer) {
      liveContainer.style.display = "none";
      liveContainer.innerHTML = "";
    }
    toggleSearchModal(false);
    if (input) input.blur();
    _doSearch(val);
  }

  function _renderSearchHistoryDropdown(list) {
    const dropdown = document.getElementById("search-history");
    if (!dropdown) return;

    if (!list.length) {
      dropdown.innerHTML = `<div class="search-history-item" style="color:var(--text3); cursor:default">No recent searches</div>`;
      return;
    }

    let html = list.map(item => `
      <div class="search-history-item" onclick="event.stopPropagation(); App.selectSearchHistory('${_esc(item)}')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;display:inline-block;margin-right:6px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${_esc(item)}
      </div>
    `).join("");

    html += `
      <div class="search-history-item" style="border-top:1px solid var(--border); color:var(--primary); font-weight:600; text-align:center" onclick="event.stopPropagation(); App.clearSearchHistory()">
        Clear History
      </div>
    `;
    dropdown.innerHTML = html;
  }

  function selectSearchHistory(query) {
    const input = document.getElementById("search-input");
    if (input) input.value = query;
    document.getElementById("search-history")?.classList.remove("show");
    if (input) input.blur();
    _doSearch(query);
  }

  function clearSearchHistory() {
    _searchHistory = [];
    localStorage.removeItem("streamx_search_history");
    _renderSearchHistoryDropdown([]);
    _showToast("Search history cleared");
  }

  function setSearchContext(ctx) {
    if (ctx === "all") ctx = "global";
    _searchContext = ctx;
    _searchFilters = {};
    if (_searchQuery) {
      _doSearch(_searchQuery);
    } else {
      _renderFilterPanel();
    }
  }

  /* ── Unified Empty & Error State Helper ───────────────────────────── */
  const _EMPTY_ICONS = {
    search: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    filter: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,
    watchlist: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    history: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    continue: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    offline: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`,
    error: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    catalogue: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>`
  };

  function renderEmptyState({ icon = "search", title = "No Results Found", message = "", actionLabel = "", actionOnClick = "", secondaryLabel = "", secondaryOnClick = "", isError = false }) {
    const iconSvg = _EMPTY_ICONS[icon] || _EMPTY_ICONS.search;
    return `
      <div class="empty-state" role="status">
        <div class="empty-state-icon${isError ? " error" : ""}" aria-hidden="true">${iconSvg}</div>
        <h3 class="empty-state-title">${_esc(title)}</h3>
        ${message ? `<p class="empty-state-desc">${_esc(message)}</p>` : ""}
        ${(actionLabel || secondaryLabel) ? `
        <div class="empty-state-actions">
          ${actionLabel ? `<button type="button" class="empty-state-btn primary" onclick="${actionOnClick}">${_esc(actionLabel)}</button>` : ""}
          ${secondaryLabel ? `<button type="button" class="empty-state-btn secondary" onclick="${secondaryOnClick}">${_esc(secondaryLabel)}</button>` : ""}
        </div>` : ""}
      </div>
    `;
  }

  function _renderSearchEmptyState() {
    const grid = document.getElementById("search-grid");
    if (!grid) return;
    _renderFilterPanel();
    document.getElementById("search-label").textContent = "Search CineJoy";
    grid.style.display = "block";
    grid.innerHTML = renderEmptyState({
      icon: "search",
      title: "Discover Movies, Series, Dramas & Anime",
      message: "Type in the search bar above or press '/' to search across all catalog titles.",
      actionLabel: "Explore Trending Movies",
      actionOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')",
      secondaryLabel: "Browse Anime",
      secondaryOnClick: "App.showPage('anime')"
    });
  }

  async function _doSearch(query) {
    query = (query || "").trim();
    if (!query) {
      if (window.location.hash.startsWith("#/search")) {
        history.replaceState(null, "", "#/search");
      }
      _searchQuery = "";
      _showPage("search", true);
      _renderSearchEmptyState();
      return;
    }

    _searchQuery = query;
    _searchPage = 1;

    // Preserve search query in URL so refresh/back/forward retain state
    const searchHash = `#/search?q=${encodeURIComponent(query)}`;
    if (window.location.hash !== searchHash) {
      history.replaceState(null, "", searchHash);
    }

    // Auto-save history
    if (!_searchHistory.includes(query)) {
      _searchHistory.unshift(query);
      _searchHistory = _searchHistory.slice(0, 10);
      localStorage.setItem("streamx_search_history", JSON.stringify(_searchHistory));
    }

    // Context determination: if coming from a non-search page, set context once; else keep active context
    if (_currentPage !== "search") {
      if (_currentPage === "browse" && _activeRowId) {
        if (_activeRowId.includes("movies")) _searchContext = "movie";
        else if (_activeRowId.includes("tv")) _searchContext = "tv";
        else if (_activeRowId.includes("anime")) _searchContext = "anime";
        else if (_activeRowId.includes("donghua")) _searchContext = "donghua";
        else if (_activeRowId.includes("kdrama")) _searchContext = "drama";
        else _searchContext = "global";
      } else {
        _searchContext = "global";
      }
    }

    _showPage("search", true); // CRITICAL: skipHashPush = true prevents destroying the ?q= URL hash
    document.getElementById("search-history")?.classList.remove("show");

    // Setup filter panel
    _renderFilterPanel();

    const grid = document.getElementById("search-grid");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
    grid.style.gap = "20px";
    grid.innerHTML = Array(8).fill('<div class="card card-skeleton"><div class="card-poster"></div><div class="card-info"><div class="skeleton-line" style="height:12px;width:75%;margin-top:8px"></div><div class="skeleton-line" style="height:10px;width:40%;margin-top:6px"></div></div></div>').join("");
    document.getElementById("search-label").textContent = `Searching for "${query}"…`;

    const activeQueryAtLaunch = query;

    // Streaming Provider Alias Discovery (e.g. searching "Paramount Plus", "Netflix", "Hulu")
    const providerAliases = {
      "paramount": "paramount", "paramount plus": "paramount", "paramount+": "paramount",
      "netflix": "netflix", "hulu": "hulu", "disney": "disney", "disney+": "disney", "disney plus": "disney",
      "apple": "apple", "apple tv": "apple", "apple tv+": "apple", "appletv": "apple",
      "max": "max", "hbo": "max", "hbo max": "max", "hbomax": "max",
      "peacock": "peacock", "crunchyroll": "crunchyroll", "starz": "starz",
      "amc": "amc", "amc+": "amc", "amc plus": "amc", "mgm": "mgm", "mgm+": "mgm", "mgm plus": "mgm",
      "prime": "prime", "prime video": "prime", "amazon prime": "prime",
      "tubi": "tubi", "tubi tv": "tubi", "pluto": "pluto", "pluto tv": "pluto"
    };
    const pKey = query.toLowerCase().replace(/[\s\-_+]+/g, " ").trim();
    const matchedPlatformId = providerAliases[pKey] || providerAliases[pKey.replace(/\s+/g, "")];

    try {
      if (_searchContext === "global") {
        // Parallel queries to TMDB and AniList Anime
        const [tmdbRes, animeRes] = await Promise.allSettled([
          TMDB.search(query, 1),
          Anilist.search(query, 1)
        ]);

        if (_searchQuery !== activeQueryAtLaunch) return; // Prevent race conditions

        const movies = [];
        const tvshows = [];
        const dramas = [];
        const anime = [];
        const donghua = [];

        if (tmdbRes.status === "fulfilled") {
          (tmdbRes.value.results || []).forEach(item => {
            if (item.media === "movie") {
              movies.push(item);
            } else if (item.media === "tv") {
              const origin = item.origin_country || [];
              const lang = item.original_language || "";
              const isDrama = origin.includes("KR") || origin.includes("CN") || origin.includes("TW") || origin.includes("JP") || lang === "ko" || lang === "zh";
              if (isDrama) {
                dramas.push({ ...item, media: "drama" });
              } else {
                tvshows.push(item);
              }
            }
          });
        }

        if (animeRes.status === "fulfilled") {
          (animeRes.value.results || []).forEach(item => {
            if (item.media === "donghua" || item.countryOfOrigin === "CN" || item.countryOfOrigin === "TW") {
              donghua.push(item);
            } else {
              anime.push(item);
            }
          });
        }

        if (matchedPlatformId && typeof STREAMING_PLATFORMS !== "undefined") {
          const platform = STREAMING_PLATFORMS.find(p => p.id === matchedPlatformId);
          if (platform && typeof TMDB.getPlatformTitles === "function") {
            try {
              const pData = await TMDB.getPlatformTitles(platform.providerId, { mediaType: "all", page: 1 });
              (pData.movies || []).forEach(m => {
                if (!movies.some(existing => existing.id === m.id)) movies.push(m);
              });
              (pData.tv || []).forEach(t => {
                if (!tvshows.some(existing => existing.id === t.id)) tvshows.push(t);
              });
            } catch (_) {}
          }
        }

        _renderGlobalSearchResults(movies, tvshows, dramas, anime, donghua);
      } else {
        // Context-aware search
        let results = [];
        if (_searchContext === "movie") {
          const res = await TMDB.search(query, 1);
          results = (res.results || []).filter(r => r.media === "movie");
          if (!results.length && matchedPlatformId && typeof STREAMING_PLATFORMS !== "undefined") {
            const platform = STREAMING_PLATFORMS.find(p => p.id === matchedPlatformId);
            if (platform && typeof TMDB.getPlatformTitles === "function") {
              try {
                const pData = await TMDB.getPlatformTitles(platform.providerId, { mediaType: "movie", page: 1 });
                results = pData.results || pData.movies || [];
              } catch (_) {}
            }
          }
          _searchTotal = res.total_pages || 1;
        } else if (_searchContext === "tv") {
          const res = await TMDB.search(query, 1);
          results = (res.results || []).filter(r => {
            if (r.media !== "tv") return false;
            const origin = r.origin_country || [];
            const lang = r.original_language || "";
            const isDrama = origin.includes("KR") || origin.includes("CN") || origin.includes("TW") || lang === "ko" || lang === "zh";
            return !isDrama;
          });
          if (!results.length && matchedPlatformId && typeof STREAMING_PLATFORMS !== "undefined") {
            const platform = STREAMING_PLATFORMS.find(p => p.id === matchedPlatformId);
            if (platform && typeof TMDB.getPlatformTitles === "function") {
              try {
                const pData = await TMDB.getPlatformTitles(platform.providerId, { mediaType: "tv", page: 1 });
                results = pData.results || pData.tv || [];
              } catch (_) {}
            }
          }
          _searchTotal = res.total_pages || 1;
        } else if (_searchContext === "drama") {
          const res = await TMDB.search(query, 1);
          results = (res.results || []).filter(r => {
            if (r.media !== "tv") return false;
            const origin = r.origin_country || [];
            const lang = r.original_language || "";
            return origin.includes("KR") || origin.includes("CN") || origin.includes("TW") || origin.includes("JP") || lang === "ko" || lang === "zh";
          }).map(r => ({ ...r, media: "drama" }));
          if (!results.length && res.results?.length) {
            results = res.results.filter(r => r.media === "tv").map(r => ({ ...r, media: "drama" }));
          }
          _searchTotal = res.total_pages || 1;
        } else if (_searchContext === "anime") {
          const res = await Anilist.search(query, 1);
          results = (res.results || []).filter(r => r.media !== "donghua" && r.countryOfOrigin !== "CN" && r.countryOfOrigin !== "TW");
          _searchTotal = res.total_pages || 1;
        } else if (_searchContext === "donghua") {
          const res = await Anilist.search(query, 1);
          results = (res.results || []).filter(r => r.media === "donghua" || r.countryOfOrigin === "CN" || r.countryOfOrigin === "TW");
          if (!results.length && res.results?.length) {
            results = res.results;
          }
          _searchTotal = res.total_pages || 1;
        } else {
          const res = await TMDB.search(query, 1);
          results = res.results || [];
          _searchTotal = res.total_pages || 1;
        }

        if (_searchQuery !== activeQueryAtLaunch) return; // Prevent race conditions

        // Apply filters locally
        results = _applyClientFilters(results);
        _renderFilteredSearchResults(results, false);
      }
    } catch (err) {
      grid.innerHTML = `<p class="search-error">Search failed: ${_esc(err.message)}</p>`;
    }
  }

  function _renderFilterPanel() {
    const existing = document.getElementById("filter-panel-wrap");
    if (existing) existing.remove();

    const grid = document.getElementById("search-grid");
    if (!grid) return;
    const wrap = document.createElement("div");
    wrap.id = "filter-panel-wrap";
    wrap.className = "search-filter-panel";

    const contexts = [
      { id: "global", label: "All Categories" },
      { id: "movie", label: "Movies" },
      { id: "tv", label: "TV Series" },
      { id: "drama", label: "Dramas" },
      { id: "anime", label: "Anime" },
      { id: "donghua", label: "Donghua" }
    ];

    let filtersHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%;">
        ${contexts.map(c => `
          <button type="button" class="search-cat-pill ${_searchContext === c.id ? "active" : ""}"
                  onclick="App.setSearchContext('${c.id}')">
            ${c.label}
          </button>
        `).join("")}
      </div>
    `;

    if (_searchContext === "movie" || _searchContext === "tv" || _searchContext === "drama") {
      filtersHTML += `
        <div style="display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
          <select class="filter-dropdown" onchange="App.setFilter('year', this.value)">
            <option value="">All Years</option>
            ${Array.from({ length: 15 }, (_, i) => 2026 - i).map(y => `<option value="${y}" ${_searchFilters.year == String(y) ? "selected" : ""}>${y}</option>`).join("")}
          </select>
          <select class="filter-dropdown" onchange="App.setFilter('rating', this.value)">
            <option value="">All Ratings</option>
            <option value="8" ${_searchFilters.rating == "8" ? "selected" : ""}>8.0+ Rating</option>
            <option value="7" ${_searchFilters.rating == "7" ? "selected" : ""}>7.0+ Rating</option>
            <option value="6" ${_searchFilters.rating == "6" ? "selected" : ""}>6.0+ Rating</option>
          </select>
          ${Object.keys(_searchFilters).length ? `<button class="filter-btn-clear" onclick="App.clearFilters()">Reset Filters</button>` : ""}
        </div>
      `;
    } else if (_searchContext === "anime" || _searchContext === "donghua") {
      filtersHTML += `
        <div style="display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
          <select class="filter-dropdown" onchange="App.setFilter('status', this.value)">
            <option value="">All Status</option>
            <option value="RELEASING" ${_searchFilters.status === "RELEASING" ? "selected" : ""}>Airing</option>
            <option value="FINISHED" ${_searchFilters.status === "FINISHED" ? "selected" : ""}>Completed</option>
          </select>
          <select class="filter-dropdown" onchange="App.setFilter('season', this.value)">
            <option value="">All Seasons</option>
            <option value="WINTER">Winter</option>
            <option value="SPRING">Spring</option>
            <option value="SUMMER">Summer</option>
            <option value="FALL">Fall</option>
          </select>
          ${Object.keys(_searchFilters).length ? `<button class="filter-btn-clear" onclick="App.clearFilters()">Reset Filters</button>` : ""}
        </div>
      `;
    }

    wrap.innerHTML = filtersHTML;
    grid.parentNode.insertBefore(wrap, grid);
  }

  function setFilter(key, val) {
    if (val === "") {
      delete _searchFilters[key];
    } else {
      _searchFilters[key] = val;
    }
    _doSearch(_searchQuery);
  }

  function clearFilters() {
    _searchFilters = {};
    _doSearch(_searchQuery);
  }

  function _applyClientFilters(list) {
    return list.filter(item => {
      if (_searchFilters.status && item.status !== _searchFilters.status) {
        return false;
      }
      if (_searchFilters.year && item.year !== _searchFilters.year) {
        return false;
      }
      if (_searchFilters.rating && item.rating < parseFloat(_searchFilters.rating)) {
        return false;
      }
      return true;
    });
  }

  function _renderGlobalSearchResults(movies, tvshows, dramas, anime, donghua) {
    const grid = document.getElementById("search-grid");
    if (!grid) return;

    grid.style.display = "flex";
    grid.style.flexDirection = "column";
    grid.style.gap = "28px";

    let html = "";

    const sections = [
      { label: "Movies", list: movies, type: "movie" },
      { label: "TV Shows & Series", list: tvshows, type: "tv" },
      { label: "Dramas & Asian Series", list: dramas, type: "drama" },
      { label: "Anime", list: anime, type: "anime" },
      { label: "Donghua", list: donghua, type: "donghua" }
    ];

    let hasAny = false;
    sections.forEach(sec => {
      if (sec.list && sec.list.length > 0) {
        hasAny = true;
        html += `
          <div class="global-search-section">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
              <h3 style="font-size:16px; font-weight:700; border-left:4px solid var(--primary); padding-left:10px; color:#fff;">
                ${sec.label} <span style="font-size:13px; font-weight:400; color:var(--text3); margin-left:6px;">(${sec.list.length})</span>
              </h3>
              ${sec.list.length > 12 ? `<button class="row-see-all" onclick="App.setSearchContext('${sec.type}')">View All ${sec.label} (${sec.list.length}) →</button>` : ""}
            </div>
            <div class="browse-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:16px">
              ${sec.list.slice(0, 18).map(item => _cardHTML(item)).join("")}
            </div>
          </div>
        `;
      }
    });

    if (!hasAny) {
      grid.style.display = "block";
      grid.innerHTML = renderEmptyState({
        icon: "search",
        title: `No Results for "${_searchQuery}"`,
        message: "Try checking your spelling, removing punctuation, or searching for a different title.",
        actionLabel: "Clear Search",
        actionOnClick: "document.getElementById('search-input').value = ''; App.showPage('search'); App.renderSearchEmptyState();",
        secondaryLabel: "Browse Trending Movies",
        secondaryOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')"
      });
      const sLabel = document.getElementById("search-label");
      if (sLabel) sLabel.textContent = "";
    } else {
      grid.innerHTML = html;
      const sLabel = document.getElementById("search-label");
      if (sLabel) sLabel.textContent = `Search results for "${_searchQuery}"`;
      grid.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
    }
  }

  function _renderFilteredSearchResults(results, append) {
    const grid = document.getElementById("search-grid");
    if (!grid) return;

    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
    grid.style.gap = "20px";

    if (!results.length && !append) {
      grid.style.display = "block";
      grid.innerHTML = renderEmptyState({
        icon: "filter",
        title: `No Matches in ${_searchContext.toUpperCase()}`,
        message: `No ${_searchContext} matched "${_searchQuery}". Try changing or resetting filters.`,
        actionLabel: "Show All Results",
        actionOnClick: "App.setSearchContext('global');",
        secondaryLabel: "Clear Search",
        secondaryOnClick: "document.getElementById('search-input').value = ''; App.showPage('search'); App.renderSearchEmptyState();"
      });
      const sLabel = document.getElementById("search-label");
      if (sLabel) sLabel.textContent = "";
      return;
    }

    document.getElementById("search-label").textContent = `${_searchContext.toUpperCase()} results for "${_searchQuery}" (${results.length})`;
    const html = results.filter(i => i.poster).map(i => _cardHTML(i)).join("");
    if (append) {
      grid.insertAdjacentHTML("beforeend", html);
    } else {
      grid.innerHTML = html;
    }
    grid.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));

    // Handle Infinite Scroll sentinel
    const existing = document.getElementById("search-sentinel");
    if (existing) existing.remove();
    if (_searchPage < _searchTotal) {
      const sentinel = document.createElement("div");
      sentinel.id = "search-sentinel";
      sentinel.className = "scroll-sentinel";
      grid.appendChild(sentinel);

      const obs = new IntersectionObserver(async entries => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        _searchPage++;
        try {
          let more;
          if (_searchContext === "anime" || _searchContext === "donghua") {
            more = await Anilist.search(_searchQuery, _searchPage);
          } else {
            more = await TMDB.search(_searchQuery, _searchPage);
          }

          let filtered = _applyClientFilters(more.results);
          _renderFilteredSearchResults(filtered, true);
        } catch { }
      }, { rootMargin: "200px" });
      obs.observe(sentinel);
    }
  }

  // ── Browse page (full discover for a row) ─────────────────────────────
  async function openBrowse(rowId, skipHashPush = false) {
    _activeRowId = rowId;
    if (!skipHashPush) {
      const newHash = `#/browse/${rowId}`;
      if (window.location.hash !== newHash) history.pushState(null, "", newHash);
    }


    if (rowId === "anime" || rowId === "donghua") {
      _showPage("browse", true);
      const grid = document.getElementById("browse-grid");
      const rows = document.getElementById("browse-rows");

      if (grid) grid.style.display = "none";
      if (rows) rows.style.display = "block";

      document.getElementById("browse-title").textContent =
        rowId === "anime" ? "Anime" : "Donghua";

      rows.innerHTML = `
        <section class="row-section">
          <div class="row-header">
            <h2 class="row-title">Trending</h2>
            <button class="row-see-all" onclick="App.openBrowse('${rowId}_trending')">See all →</button>
          </div>
          <div class="row-scroll" id="${rowId}-trending"></div>
        </section>

        <section class="row-section">
          <div class="row-header">
            <h2 class="row-title">Popular</h2>
            <button class="row-see-all" onclick="App.openBrowse('${rowId}_popular')">See all →</button>
          </div>
          <div class="row-scroll" id="${rowId}-popular"></div>
        </section>

        <section class="row-section">
          <div class="row-header">
            <h2 class="row-title">Top Rated</h2>
            <button class="row-see-all" onclick="App.openBrowse('${rowId}_top')">See all →</button>
          </div>
          <div class="row-scroll" id="${rowId}-top"></div>
        </section>

        <section class="row-section">
          <div class="row-header">
            <h2 class="row-title">Currently Airing</h2>
            <button class="row-see-all" onclick="App.openBrowse('${rowId}_airing')">See all →</button>
          </div>
          <div class="row-scroll" id="${rowId}-airing"></div>
        </section>

        <section class="row-section">
          <div class="row-header">
            <h2 class="row-title">Upcoming</h2>
            <button class="row-see-all" onclick="App.openBrowse('${rowId}_upcoming')">See all →</button>
          </div>
          <div class="row-scroll" id="${rowId}-upcoming"></div>
        </section>
      `;

      const origin = rowId === "donghua" ? "CN" : undefined;
      await loadAnimeRow(`${rowId}_trending`, `${rowId}-trending`, origin, "trending");
      await loadAnimeRow(`${rowId}_popular`, `${rowId}-popular`, origin, "popular");
      await loadAnimeRow(`${rowId}_top`, `${rowId}-top`, origin, "top");
      await loadAnimeRow(`${rowId}_airing`, `${rowId}-airing`, origin, "airing");
      await loadAnimeRow(`${rowId}_upcoming`, `${rowId}-upcoming`, origin, "upcoming");

      return;
    }

    if (
      rowId === "bollywood" ||
      rowId === "tollywood" ||
      rowId === "kollywood" ||
      rowId === "mollywood" ||
      rowId === "sandalwood"
    ) {

      _showPage("browse", true);
      const grid = document.getElementById("browse-grid");
      const rows = document.getElementById("browse-rows");

      if (grid) grid.style.display = "none";
      if (rows) rows.style.display = "block";

      document.getElementById("browse-title").textContent =
        rowId.charAt(0).toUpperCase() + rowId.slice(1);

      rows.innerHTML = `


<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">Trending</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_trending')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-trending"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">Popular</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_popular')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-popular"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">Top Rated</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_top')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-top"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">TV Shows</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_tv')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-tv"></div>
</section>
`;

      await loadIndianRow(`${rowId}_trending`, `${rowId}-trending`);
      await loadIndianRow(`${rowId}_popular`, `${rowId}-popular`);
      await loadIndianRow(`${rowId}_top`, `${rowId}-top`);
      await loadIndianRow(`${rowId}_tv`, `${rowId}-tv`);

      return;
    }
    const bGrid = document.getElementById("browse-grid");
    const bRows = document.getElementById("browse-rows");
    if (bGrid) bGrid.style.display = "grid";
    if (bRows) bRows.style.display = "none";

    let targetRowId = rowId;
    if (targetRowId === "movies") targetRowId = "trending_movies";
    if (targetRowId === "series" || targetRowId === "tv") targetRowId = "trending_tv";

    let row = HOME_ROWS.find(r => r.id === targetRowId) ||
              ANIME_ROWS.find(r => r.id === targetRowId) ||
              HOME_ROWS.find(r => r.id === rowId);

    if (!row) {
      if (targetRowId && targetRowId.includes("movie")) {
        row = HOME_ROWS.find(r => r.id === "trending_movies") || HOME_ROWS.find(r => r.id === "popular_movies");
      } else if (targetRowId && (targetRowId.includes("tv") || targetRowId.includes("series"))) {
        row = HOME_ROWS.find(r => r.id === "trending_tv") || HOME_ROWS.find(r => r.id === "popular_tv");
      }
    }
    if (!row) {
      _showPage("browse", true);
      const bGrid = document.getElementById("browse-grid");
      if (bGrid) {
        bGrid.innerHTML = renderEmptyState({
          icon: "catalogue",
          title: "Category Not Found",
          message: "The requested catalogue section could not be found.",
          actionLabel: "Explore All Movies",
          actionOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')",
          secondaryLabel: "Back to Home",
          secondaryOnClick: "App.showPage('home')"
        });
      }
      return;
    }

    _showPage("browse", true);
    let pageTitle = _plainLabel(row.label);
    if (rowId === "movies" || targetRowId === "trending_movies") pageTitle = "Movies";
    if (rowId === "series" || rowId === "tv" || targetRowId === "trending_tv") pageTitle = "TV Shows";
    const titleEl = document.getElementById("browse-title");
    if (titleEl) titleEl.textContent = pageTitle;
    _updateActiveNavLinks("browse", targetRowId);

    const isMoviesSection = rowId === "movies" || targetRowId === "trending_movies" || targetRowId === "popular_movies";
    const upSection = document.getElementById("browse-upcoming-section");
    if (upSection) {
      if (isMoviesSection) {
        upSection.style.display = "block";
        _loadUpcomingMoviesSection();
      } else {
        upSection.style.display = "none";
      }
    }
    _initBrowseFilterOptions(isMoviesSection ? "movie" : "tv");

    document.getElementById("browse-grid").innerHTML =
      Array(12).fill('<div class="card card-skeleton"></div>').join("");

    let page = 1; let total = 1;

    const loadMore = async () => {
      const data = await _fetchRowData(row, page);
      total = data.total_pages;
      const grid = document.getElementById("browse-grid");
      if (!grid) return;
      if (page === 1) {
        grid.innerHTML = "";
        if (!data.results || data.results.length === 0) {
          grid.innerHTML = renderEmptyState({
            icon: "catalogue",
            title: "No Titles in Collection",
            message: "There are currently no titles available in this collection.",
            actionLabel: "Explore Trending Movies",
            actionOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')"
          });
          return;
        }
      }
      const html = data.results.filter(i => i.poster).map(i => _cardHTML(i)).join("");
      grid.insertAdjacentHTML("beforeend", html);
      grid.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));

      if (page < total) {
        const sentinel = document.createElement("div");
        sentinel.className = "scroll-sentinel";
        grid.appendChild(sentinel);
        const obs = new IntersectionObserver(async entries => {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();
          sentinel.remove();
          page++;
          await loadMore();
        }, { rootMargin: "300px" });
        obs.observe(sentinel);
      }
    };

    try { await loadMore(); }
    catch (err) {
      const bGrid = document.getElementById("browse-grid");
      if (bGrid) {
        bGrid.innerHTML = renderEmptyState({
          icon: "network",
          title: "Unable to Load Catalogue",
          message: err.message || "Failed to fetch titles. Please check your network connection and try again.",
          actionLabel: "Try Again",
          actionOnClick: `App.openBrowse('${_esc(rowId)}')`,
          secondaryLabel: "Return to Home",
          secondaryOnClick: "App.showPage('home')",
          isError: true
        });
      }
    }
  }

  // ── Upcoming Movies Section (cinejoy.pk Parity) ───────────────────────
  let _hasLoadedUpcoming = false;
  async function _loadUpcomingMoviesSection() {
    const upScroll = document.getElementById("browse-upcoming-scroll");
    if (!upScroll) return;
    if (_hasLoadedUpcoming && upScroll.children.length) return;
    try {
      const data = await TMDB.getList("movie", "upcoming", 1);
      if (data && data.results && data.results.length) {
        upScroll.innerHTML = data.results.filter(i => i.backdrop || i.poster).slice(0, 10).map(item => `
          <div class="upcoming-card" onclick="App.openItem(${_jsonAttr(item)})" role="button" tabindex="0">
            <div class="upcoming-thumb" style="background-image:url('${item.backdrop || item.poster || ""}')">
              <span class="coming-soon-badge">Coming Soon</span>
            </div>
            <div class="upcoming-info">
              <div class="upcoming-title">${_esc(item.title)}</div>
              <div class="upcoming-date">${item.release_date ? _formatShortDate(item.release_date) : (item.year || "")}</div>
            </div>
          </div>
        `).join("");
        _hasLoadedUpcoming = true;
      }
    } catch (e) {
      console.warn("Could not load upcoming movies:", e);
    }
  }

  // ── Browse Filter Bar Helpers (cinejoy.pk Parity) ─────────────────────
  function _initBrowseFilterOptions(mediaType = "movie") {
    const genreSelect = document.getElementById("browse-filter-genre");
    if (genreSelect && genreSelect.options.length <= 1) {
      const genres = GENRE_MAP[mediaType] || GENRE_MAP.movie || {};
      Object.entries(genres).forEach(([id, name]) => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        genreSelect.appendChild(opt);
      });
    }

    const yearSelect = document.getElementById("browse-filter-year");
    if (yearSelect && yearSelect.options.length <= 1) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear; y >= 1980; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }
    }
  }

  let _activeBrowseFilters = { genre: "", year: "", sort: "popularity.desc", provider: "", country: "" };

  async function onBrowseFilterChange(filterKey, value) {
    _activeBrowseFilters[filterKey] = value;
    const grid = document.getElementById("browse-grid");
    if (!grid) return;
    grid.innerHTML = Array(12).fill('<div class="card card-skeleton"></div>').join("");

    const isTv = _activeRowId && (_activeRowId.includes("tv") || _activeRowId.includes("series"));
    const mediaType = isTv ? "tv" : "movie";

    const params = {
      page: 1,
      sort_by: _activeBrowseFilters.sort || "popularity.desc"
    };
    if (_activeBrowseFilters.genre) params.with_genres = _activeBrowseFilters.genre;
    if (_activeBrowseFilters.year) {
      if (mediaType === "movie") params.primary_release_year = _activeBrowseFilters.year;
      else params.first_air_date_year = _activeBrowseFilters.year;
    }
    if (_activeBrowseFilters.provider) {
      params.with_watch_providers = _activeBrowseFilters.provider;
      params.watch_region = "US";
    }
    if (_activeBrowseFilters.country) {
      params.with_origin_country = _activeBrowseFilters.country;
    }

    try {
      const data = await TMDB.discover(mediaType, params);
      if (!data.results || !data.results.length) {
        grid.innerHTML = renderEmptyState({
          icon: "filter",
          title: "No Matching Titles Found",
          message: "Try clearing some filters to explore more movies and shows.",
          actionLabel: "Reset Filters",
          actionOnClick: "App.resetBrowseFilters()"
        });
      } else {
        grid.innerHTML = data.results.filter(i => i.poster).map(i => _cardHTML(i)).join("");
        grid.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
      }
    } catch (err) {
      grid.innerHTML = `<p class="search-error">Failed to filter: ${_esc(err.message)}</p>`;
    }
  }

  function resetBrowseFilters() {
    _activeBrowseFilters = { genre: "", year: "", sort: "popularity.desc", provider: "", country: "" };
    ["browse-filter-genre", "browse-filter-year", "browse-filter-provider", "browse-filter-country"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const sortEl = document.getElementById("browse-filter-sort");
    if (sortEl) sortEl.value = "popularity.desc";
    if (_activeRowId) openBrowse(_activeRowId, true);
  }

  function goBack() {
    const modalBg = document.getElementById("player-modal-bg");
    if (modalBg && modalBg.classList.contains("open")) {
      if (window.Player && typeof Player.close === "function") {
        Player.close();
        return;
      }
      if (typeof _closeAnimeDetail === "function") {
        _closeAnimeDetail();
        return;
      }
    }
    if (window.history.length > 1 && window.location.hash !== "#/" && window.location.hash !== "") {
      window.history.back();
    } else {
      showPage("home");
    }
  }

  let _isHistoryEditing = false;
  function toggleContinueWatchingEdit() {
    _isHistoryEditing = !_isHistoryEditing;
    const row = document.getElementById("row-watch-history") || document.getElementById("row-continue-watching");
    if (row) {
      row.classList.toggle("is-editing", _isHistoryEditing);
    }
  }
  async function loadIndianRow(rowId, containerId) {
    const row = HOME_ROWS.find(r => r.id === rowId);
    if (!row) return;

    const data = await TMDB.fetchRow(row, 1);
    console.log(rowId, data.results.length, data.results);

    document.getElementById(containerId).innerHTML =
      data.results
        .filter(i => i.poster)
        .slice(0, 20)
        .map(i => _cardHTML(i))
        .join("");

    document
      .querySelectorAll(`#${containerId} img[data-src]`)
      .forEach(img => _observeImg(img));
  }

  // ── Load Anime row (from AniList) ──────────────────────────────────
  async function loadAnimeRow(rowId, containerId, origin, listType) {
    try {
      let data;
      if (listType === "trending") {
        data = await Anilist.getTrending(origin, 1);
      } else {
        data = await Anilist.getList(listType, origin, 1);
      }

      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = data.results
        .filter(i => i.poster)
        .slice(0, 20)
        .map(i => _cardHTML(i))
        .join("");

      container.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
    } catch (err) {
      console.error(`Failed to load anime row ${rowId}:`, err);
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = `<p class="row-error">Failed to load</p>`;
    }
  }

  // ── Watchlist page ────────────────────────────────────────────────────
  function _renderWatchlistPage() {
    const container = document.getElementById("wl-grid");
    if (!container) return;
    const items = Watchlist.getAll();
    const countEl = document.getElementById("wl-count");
    if (countEl) countEl.textContent = `(${items.length} title${items.length !== 1 ? "s" : ""})`;
    container.classList.toggle("is-empty", !items.length);
    if (!items.length) {
      container.innerHTML = renderEmptyState({
        icon: "watchlist",
        title: "Your Watchlist is Empty",
        message: "Bookmark movies, TV series, or anime by tapping the Save button on any title to watch them anytime.",
        actionLabel: "Explore Home",
        actionOnClick: "App.showPage('home')",
        secondaryLabel: "Browse Trending Movies",
        secondaryOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')"
      });
      return;
    }
    container.innerHTML = items.map(i => _cardHTML(i)).join("");
    container.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
  }

  // ── Hash-based routing ────────────────────────────────────────────────
  // Returns true if it routed to a page (so init can skip redundant home load)
  async function _handleRoute() {
    const hash = window.location.hash || "";
    let path = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!path && window.location.pathname.startsWith("/play")) {
      path = "/play" + (window.location.search || "");
    }

    // Handle Big Watch player vs Modal/Page transitions cleanly
    const isWatchRoute = path.startsWith("/watch/") || path.startsWith("/watch?") || path.startsWith("/play");
    if (!isWatchRoute) {
      if (window.Player && typeof Player.exitBigWatch === "function") {
        Player.exitBigWatch(true);
      }
    }

    const isDetailRoute = /^\/(movie|tv|drama|anime|donghua)\//.test(path);
    const topHdr = document.getElementById("top-header");
    const backBtn = document.getElementById("header-back-btn");

    if (!isDetailRoute && !isWatchRoute) {
      const bg = document.getElementById("player-modal-bg");
      if (bg && bg.classList.contains("open")) {
        if (window.Player && typeof Player.close === "function") Player.close(true);
        if (typeof _closeAnimeDetail === "function") _closeAnimeDetail(true);
      }
      if (window.Player && typeof Player.exitBigWatch === "function") {
        Player.exitBigWatch(true);
      }
      document.body.classList.remove("has-modal-open", "big-player-active");
      if (topHdr) {
        topHdr.classList.remove("header-hidden-detail", "hidden");
        topHdr.style.removeProperty("display");
        topHdr.style.removeProperty("visibility");
        topHdr.style.removeProperty("opacity");
        topHdr.style.removeProperty("pointer-events");
      }
      if (backBtn && (!path || path === "/" || path === "/home")) {
        backBtn.style.display = "none";
      }
      document.body.style.overflow = "";
    } else {
      document.body.classList.add("has-modal-open");
      if (topHdr) {
        topHdr.classList.remove("header-hidden-detail", "hidden");
        topHdr.style.removeProperty("display");
        topHdr.style.removeProperty("visibility");
        topHdr.style.removeProperty("opacity");
      }
      if (backBtn) {
        backBtn.style.display = "inline-flex";
      }
    }

    // Home
    if (!path || path === "/" || path === "/home") {
      if (topHdr) {
        topHdr.classList.remove("header-hidden-detail", "hidden");
        topHdr.style.removeProperty("display");
        topHdr.style.removeProperty("visibility");
        topHdr.style.removeProperty("opacity");
        topHdr.style.removeProperty("pointer-events");
      }
      if (backBtn) backBtn.style.display = "none";
      document.body.classList.remove("has-modal-open", "big-player-active");
      _showPage("home", true);
      _updateActiveNavLinks("home");
      if (!document.getElementById("home-rows")?.children.length) {
        await _loadGeneralHomeContent();
      }
      return true;
    }

    // Direct section routes
    if (path === "/livetv" || path === "/live" || path === "/tv-live") {
      _showPage("livetv", true);
      return true;
    }
    if (path === "/anime" || path === "/animation") {
      await _loadAnimePageContent();
      _showPage("anime", true);
      return true;
    }
    if (path === "/donghua") {
      await _loadAnimePageContent();
      _showPage("anime", true);
      _updateActiveNavLinks("anime", "donghua");
      setTimeout(() => scrollToAnimeRow("donghua_trending"), 150);
      return true;
    }
    if (path === "/movies" || path === "/movie") {
      openBrowse("trending_movies", true);
      return true;
    }
    if (path === "/series" || path === "/tv" || path === "/shows" || path === "/tvshows") {
      openBrowse("trending_tv", true);
      return true;
    }
    if (path === "/dramas" || path === "/drama" || path === "/kdrama") {
      openBrowse("kdrama", true);
      return true;
    }

    // Search: #/search?q=query or #/search
    if (path === "/search" || path.startsWith("/search?") || path.startsWith("/search")) {
      let query = "";
      const searchIdx = path.indexOf("?");
      if (searchIdx !== -1) {
        const params = new URLSearchParams(path.slice(searchIdx));
        query = params.get("q") || "";
      }
      toggleSearchModal(false);
      const input = document.getElementById("search-input");
      if (input) input.value = query;
      if (query.trim()) {
        await _doSearch(query.trim());
      } else {
        _showPage("search", true);
        _renderSearchEmptyState();
      }
      return true;
    }

    // Deprecate manga / manhwa / reader routes cleanly to home
    if (path.startsWith("/manga") || path.startsWith("/manhwa") || path.startsWith("/manhua") || path.startsWith("/read")) {
      window.location.hash = "#/";
      _showPage("home", true);
      return true;
    }

    // Dedicated Big Watch query routes (1Flex style: #/play?id=63333&season=1&episode=1&type=tv or #/play?id=969681&type=movie)
    if (path.startsWith("/play") || path.startsWith("/watch?")) {
      const qIdx = path.indexOf("?");
      if (qIdx !== -1) {
        const params = new URLSearchParams(path.slice(qIdx));
        const id = parseInt(params.get("id"), 10);
        const type = (params.get("type") || "movie").toLowerCase();
        const media = (type === "drama" || type === "tv" || type === "series" || type === "show") ? "tv" : (type === "anime" ? "anime" : "movie");
        const s = parseInt(params.get("season") || params.get("s") || "1", 10);
        const e = parseInt(params.get("episode") || params.get("ep") || params.get("e") || "1", 10);
        if (id && !isNaN(id) && id > 0) {
          const item = { id, media, title: "Loading…", poster: "", backdrop: "" };
          Player.open(item, true).then(() => {
            Player.watchNow(s, e);
          });
          if (!document.getElementById("home-rows")?.children.length) {
            _loadGeneralHomeContent().catch(() => {});
          }
          return true;
        }
      }
    }

    // Dedicated Big Watch routes: #/watch/movie/:id or #/watch/tv/:id/:season/:episode
    const watchMatch = path.match(/^\/watch\/(movie|tv|drama|anime)\/(\d+)(?:\/(\d+)\/(\d+))?$/);
    if (watchMatch) {
      const media = watchMatch[1] === "drama" ? "tv" : watchMatch[1];
      const id = parseInt(watchMatch[2], 10);
      const s = watchMatch[3] ? parseInt(watchMatch[3], 10) : 1;
      const e = watchMatch[4] ? parseInt(watchMatch[4], 10) : 1;
      if (id && !isNaN(id) && id > 0) {
        const item = { id, media, title: "Loading…", poster: "", backdrop: "" };
        Player.open(item, true).then(() => {
          Player.watchNow(s, e);
        });
        if (!document.getElementById("home-rows")?.children.length) {
          _loadGeneralHomeContent().catch(() => {});
        }
        return true;
      }
    }

    // Anime/Donghua detail: #/anime/:id or #/donghua/:id
    const animeMatch = path.match(/^\/(anime|donghua)\/([\w-]+)$/);
    if (animeMatch) {
      const media = animeMatch[1];
      const id = animeMatch[2];
      if (!id || id === "undefined" || id === "null") {
        _showPage("404", true);
        return true;
      }
      const item = { id: parseInt(id) || id, media, title: "Loading…", poster: "", backdrop: "" };
      await _openAnimeDetail(item, true /* skipHashPush */);
      // Lazy preload home shell in background only if needed
      if (!document.getElementById("home-rows")?.children.length) {
        _loadGeneralHomeContent().catch(() => {});
      }
      return true;
    }

    // Movie/TV/Drama detail: #/movie/:id or #/tv/:id or #/drama/:id
    const mediaMatch = path.match(/^\/(movie|tv|drama)\/(\d+)$/);
    if (mediaMatch) {
      const media = mediaMatch[1] === "drama" ? "tv" : mediaMatch[1];
      const id = parseInt(mediaMatch[2], 10);
      if (!id || isNaN(id) || id <= 0) {
        _showPage("404", true);
        return true;
      }
      const item = { id, media, title: "Loading…", poster: "", backdrop: "" };
      Player.open(item, true /* skipHashPush */);
      // Lazy preload home shell in background only if needed
      if (!document.getElementById("home-rows")?.children.length) {
        _loadGeneralHomeContent().catch(() => {});
      }
      return true;
    }

    // Browse: #/browse or #/browse/:rowId
    if (path === "/browse" || path === "/browse/") {
      openBrowse("trending_movies", true);
      return true;
    }
    const browseMatch = path.match(/^\/browse\/(.+)$/);
    if (browseMatch) {
      openBrowse(browseMatch[1], true /* skipHashPush */);
      return true;
    }

    // Watchlist: #/watchlist
    if (path === "/watchlist") {
      _showPage("watchlist", true);
      return true;
    }

    // History: #/history-page
    if (path === "/history-page") {
      _showPage("history-page", true);
      return true;
    }

    // Continue Watching: #/continue-page
    if (path === "/continue-page") {
      _showPage("continue-page", true);
      return true;
    }

    // Settings: #/settings-page
    if (path === "/settings-page") {
      _showPage("settings-page", true);
      return true;
    }

    // Profile: #/profile
    if (path === "/profile") {
      _showPage("profile", true);
      return true;
    }

    // 404 Not Found Page route
    if (path === "/404") {
      _showPage("404", true);
      return true;
    }

    // Unmatched unknown route -> show dedicated 404 page
    _showPage("404", true);
    return true;
  }

  // ── Page routing ──────────────────────────────────────────────────────
  function _showPage(page, skipHashPush = false) {
    _currentPage = page;

    // Cleanly dismiss search modal overlay if active
    if (typeof toggleSearchModal === "function") {
      toggleSearchModal(false);
    }

    // FIX 2 & FIX 3: Always restore body scroll on page navigation
    document.body.style.overflow = "";

    // If navigating to a normal page while a player modal is active, cleanly close it
    const bgModal = document.getElementById("player-modal-bg");
    if (bgModal && bgModal.classList.contains("open")) {
      if (window.Player && typeof Player.close === "function") Player.close(true);
      if (typeof _closeAnimeDetail === "function") _closeAnimeDetail(true);
    }

    const topHeader = document.getElementById("top-header");
    const sidebar = document.getElementById("desktop-sidebar");

    document.body.classList.remove("has-modal-open", "big-player-active");
    if (topHeader) {
      topHeader.classList.remove("hidden", "header-hidden-detail");
      topHeader.style.removeProperty("display");
      topHeader.style.removeProperty("visibility");
      topHeader.style.removeProperty("opacity");
      topHeader.style.removeProperty("pointer-events");
    }
    sidebar?.classList.remove("hidden");
    document.body.style.paddingLeft = "";

    // Clean up Live TV playback when navigating to any other page
    if (page !== "livetv" && window.LiveTV && typeof LiveTV.cleanup === "function") {
      LiveTV.cleanup();
    }

    const pages = [
      "home", "anime", "livetv", "extensions", "search", "browse", "watchlist",
      "history-page", "continue-page", "settings-page", "profile", "404"
    ];

    pages.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.style.display = p === page ? "block" : "none";
    });

    if (page !== "search") {
      const sInput = document.getElementById("search-input");
      if (sInput) sInput.value = "";
    }

    window.scrollTo({ top: 0, behavior: "instant" });

    // Set page titles
    const titleMap = {
      home: "CineJoy — Cinema & Live TV",
      anime: "Anime & Donghua — CineJoy",
      livetv: "Live TV & Sports — CineJoy",
      search: "Search — CineJoy",
      browse: "Browse — CineJoy",
      watchlist: "Watchlist — CineJoy",
      "history-page": "History — CineJoy",
      "continue-page": "Continue Watching — CineJoy",
      "settings-page": "Settings — CineJoy",
      profile: "Profile — CineJoy",
      "404": "Scene Not Found (404) — CineJoy"
    };
    if (titleMap[page]) {
      document.title = titleMap[page];
    }

    // Page-specific initializers
    if (page === "home") {
      HeroTrailerController.resume("general");
      HeroTrailerController.pause("anime");
      const bGrid = document.getElementById("browse-grid");
      if (bGrid) bGrid.innerHTML = "";
      _renderHistoryRows();
      _loadGeneralHomeContent();
      _resumeAllRowAutoScroll();
      document.getElementById("dest-btn-general")?.classList.add("active");
      document.getElementById("dest-btn-anime")?.classList.remove("active");
    } else if (page === "anime") {
      HeroTrailerController.resume("anime");
      HeroTrailerController.pause("general");
      const bGrid = document.getElementById("browse-grid");
      if (bGrid) bGrid.innerHTML = "";
      _loadAnimePageContent();
      _resumeAllRowAutoScroll();
      document.getElementById("anime-dest-btn-general")?.classList.remove("active");
      document.getElementById("anime-dest-btn-anime")?.classList.add("active");
    } else if (page === "livetv") {
      HeroTrailerController.pauseAll();
      _pauseAllRowAutoScroll();
      if (window.LiveTV && typeof LiveTV.init === "function") {
        LiveTV.init();
      }
    } else {
      HeroTrailerController.pauseAll();
      _pauseAllRowAutoScroll();
      if (page === "watchlist") {
        _renderWatchlistPage();
      } else if (page === "history-page") {
        _renderHistoryPage();
      } else if (page === "continue-page") {
        _renderContinuePage();
      } else if (page === "settings-page") {
        _initSettingsPage();
      } else if (page === "profile") {
        _renderProfilePage();
      }
    }

    // Sync URL hash
    if (!skipHashPush) {
      const hashMap = {
        home: "#/",
        anime: "#/anime",
        livetv: "#/livetv",
        extensions: "#/extensions",
        profile: "#/profile",
        search: _searchQuery ? `#/search?q=${encodeURIComponent(_searchQuery)}` : "#/search",
        browse: _activeRowId ? `#/browse/${_activeRowId}` : "#/browse",
        watchlist: "#/watchlist",
        "history-page": "#/history-page",
        "continue-page": "#/continue-page",
        "settings-page": "#/settings-page",
        "404": "#/404"
      };
      const newHash = hashMap[page] || `#/${page}`;
      if (window.location.hash !== newHash) {
        history.pushState(null, "", newHash);
      }
    }

    _updateActiveNavLinks(page, _activeRowId);
  }

  function showPage(page) { _showPage(page); }

  // ── Watchlist toggle (from cards) ─────────────────────────────────────
  function toggleWL(item) {
    const added = Watchlist.toggle(item);
    const btn = document.querySelector(`#card-${item.media}-${item.id} .card-wl`);
    if (btn) { btn.classList.toggle("added", added); btn.innerHTML = added ? "Saved" : "Save"; }
  }

  // ── Smooth Action & Card Click Loader ──────────────────────────
  let _actionLoaderTimer = null;
  let _actionLoaderHideTimer = null;

  function showActionLoader(msg = "Opening cinema experience...") {
    const el = document.getElementById("cinejoy-action-loader");
    if (!el) return;
    const txt = document.getElementById("action-loader-text");
    if (txt) txt.textContent = msg;
    if (_actionLoaderHideTimer) clearTimeout(_actionLoaderHideTimer);
    el.style.display = "flex";
    requestAnimationFrame(() => el.classList.add("active"));

    // Absolute fallback: auto-hide after 1800ms so no error or delay can ever trap the user
    if (_actionLoaderTimer) clearTimeout(_actionLoaderTimer);
    _actionLoaderTimer = setTimeout(() => {
      hideActionLoader();
    }, 1800);
  }

  function hideActionLoader() {
    const el = document.getElementById("cinejoy-action-loader");
    if (!el) return;
    el.classList.remove("active");
    if (_actionLoaderHideTimer) clearTimeout(_actionLoaderHideTimer);
    _actionLoaderHideTimer = setTimeout(() => {
      el.style.display = "none";
    }, 240);
  }

  // ── Open item (route to correct detail handler) ───────────────────────
  function openItem(item, e) {
    if (!item) return;
    try {
      const evt = e || window.event;
      const targetCard = evt && evt.target ? evt.target.closest(".card, .top10-item, .platform-card, .history-card, .rec-card, .upcoming-card, .search-live-item, .hero-slide, .hero-content, .relation-card") : null;
      if (targetCard && typeof targetCard.getBoundingClientRect === "function") {
        window._cinejoyOriginCardRect = targetCard.getBoundingClientRect();
      } else {
        window._cinejoyOriginCardRect = null;
      }
    } catch (_) {
      window._cinejoyOriginCardRect = null;
    }
    const title = item.title || item.name || "Title";
    showActionLoader(`Loading ${title}...`);

    const media = item.media || item.type || "";
    if (media === "anime" || media === "donghua") {
      _openAnimeDetail(item).finally(() => {
        setTimeout(hideActionLoader, 300);
      });
    } else {
      const normalizedItem = (media === "drama") ? { ...item, media: "tv" } : item;
      Player.open(normalizedItem);
      setTimeout(hideActionLoader, 300);
    }
  }

  // ── Anime Detail Modal (AniList-powered, reuses player CSS) ───────────
  let _animeEpSearchQuery = "";
  let _animeEpSortOrder = "asc";

  async function _openAnimeDetail(item, skipHashPush = false) {
    const bg = document.getElementById("player-modal-bg");
    bg.classList.add("open");
    bg.classList.add("has-cinematic-detail");
    document.body.classList.add("has-modal-open");
    const topHdr = document.getElementById("top-header");
    if (topHdr) {
      topHdr.classList.remove("header-hidden-detail", "hidden");
      topHdr.style.removeProperty("display");
      topHdr.style.removeProperty("visibility");
      topHdr.style.removeProperty("opacity");
    }
    const backBtn = document.getElementById("header-back-btn");
    if (backBtn) backBtn.style.display = "inline-flex";
    _updateActiveNavLinks("anime");
    document.body.style.overflow = "hidden";
    _activeEpisodeId = null;
    _activeEpisodeNumber = null;
    _autoPlayEpisodeNumber = null;
    _animeEpSearchQuery = "";
    _animeEpSortOrder = "asc";

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
      window.HeroTrailerController.pause("general");
      window.HeroTrailerController.pause("anime");
    }
    _stopAllHeroRotations();

    // Push hash so refresh restores this anime
    if (!skipHashPush) {
      const newHash = `#/${item.media || "anime"}/${item.id}`;
      if (window.location.hash !== newHash) history.pushState({ streamx: true }, "", newHash);
    }

    // Track recently viewed
    StreamXHistory.recordView(item);

    // Render cinematic skeleton while loading
    bg.innerHTML = `
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="${_esc(item.title || "Loading")}">
        <!-- Corner Close Button (1Flex-inspired) -->
        <button type="button" class="pm-modal-close-corner-btn" onclick="Player.close()" aria-label="Close modal" title="Close (Esc)">✕</button>
        <div class="pm-cinematic-hero skeleton-hero" style="background-image:url('${item.backdrop || item.poster || ""}')">
          <div class="pm-hero-vignette"></div>
          <div class="pm-hero-content pm-hero-split-layout">
            <div class="pm-hero-left">
              <h1 class="pm-hero-title">${_esc(item.title || "")}</h1>
              <div class="skeleton-line" style="width:140px;height:20px;border-radius:6px;margin:6px 0;"></div>
              <div class="skeleton-line" style="width:240px;height:42px;border-radius:999px;margin:12px 0;"></div>
              <div class="skeleton-line" style="width:65%;height:16px;border-radius:4px;margin-top:10px;"></div>
              <div class="skeleton-line" style="width:45%;height:16px;border-radius:4px;margin-top:8px;"></div>
            </div>
            <div class="pm-hero-right">
              <div class="pm-hero-side-card skeleton-side-card" style="width:280px;height:200px;opacity:0.6;"></div>
            </div>
          </div>
        </div>
        <div class="pm-cinematic-body">
          <div class="loader-spinner" style="margin:40px auto;"></div>
        </div>
      </div>`;
    bg.onclick = _handleAnimeBackdropClick;
    const skeletonModal = bg ? bg.querySelector(".player-modal") : null;
    if (skeletonModal && window.Player && typeof Player._animateModalZoomIn === "function") {
      Player._animateModalZoomIn(skeletonModal);
    }

    try {
      const d = await Anilist.getDetails(item.id, item.media);
      if (!d) throw new Error("Anime details not found");
      _renderAnimeDetail(d);
    } catch (err) {
      console.error("Anime detail error:", err);
      bg.innerHTML = `
        <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="Anime Error">
          <div class="pm-hero-top-bar" style="position:relative;background:none;backdrop-filter:none;padding:16px 20px;">
            <button class="pm-hero-back-btn" onclick="App._closeAnimeDetail()" aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Close</span>
            </button>
          </div>
          <div class="empty-state" role="alert" style="padding:48px 24px 64px;">
            <div class="empty-state-icon error" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h3 class="empty-state-title">Unable to Load Anime Details</h3>
            <p class="empty-state-desc">${_esc(err.message || "Failed to load anime metadata. The title may no longer be available.")}</p>
            <div class="empty-state-actions">
              <button type="button" class="empty-state-btn primary" onclick="App._closeAnimeDetail(); App.showPage('anime');">Back to Anime Hub</button>
              <button type="button" class="empty-state-btn secondary" onclick="App._closeAnimeDetail()">Close</button>
            </div>
          </div>
        </div>`;
    }
  }

  function _handleAnimeBackdropClick(e) {
    if (!e || !e.isTrusted) return;
    if (window._streamxLastLayoutChange && (Date.now() - window._streamxLastLayoutChange < 400)) return;
    const bg = document.getElementById("player-modal-bg");
    if (e.target === bg) _closeAnimeDetail();
  }

  function _renderAnimeDetail(d) {
    const bg = document.getElementById("player-modal-bg");
    const wl = Watchlist.has(d.id, d.media);
    const genreNames = (d.genres || []).slice(0, 3).join(" · ");
    const ratingStars = _starsHTML(d.rating);
    const badgeLabel = d.media === "donghua" ? "DONGHUA" : "ANIME";

  function _getCleanAnimeTitle(t) {
    if (!t) return "";
    if (typeof t === "string") return t;
    return t.english || t.userPreferred || t.romaji || t.native || "";
  }

  function _parseExplicitAnimeSeason(title, format) {
    const t = _getCleanAnimeTitle(title).trim();
    const lower = t.toLowerCase();

    if (format === "MOVIE" || lower.includes("the movie") || lower.includes(" movie")) {
      return { type: "MOVIE", label: "Movie" };
    }
    if (format === "OVA" || lower.includes(" ovas") || lower.includes(" ova")) {
      return { type: "OVA", label: "OVA" };
    }
    if (format === "ONA" || lower.includes(" ona") || lower.includes("break time") || lower.includes("kyuukei jikan")) {
      return { type: "ONA", label: "ONA" };
    }
    if (format === "SPECIAL" || lower.includes(" special")) {
      return { type: "SPECIAL", label: "Special" };
    }

    const sPartMatch = t.match(/\bseason\s*(\d+)\s*(?:part|cour)\s*(\d+)\b/i);
    if (sPartMatch) {
      return { type: "TV", seasonNum: parseInt(sPartMatch[1]), partNum: parseInt(sPartMatch[2]), label: `Season ${sPartMatch[1]} Part ${sPartMatch[2]}` };
    }

    const sMatch = t.match(/\bseason\s*(\d+)\b/i);
    if (sMatch) {
      return { type: "TV", seasonNum: parseInt(sMatch[1]), label: `Season ${sMatch[1]}` };
    }

    const ordMatch = t.match(/\b(1st|2nd|3rd|4th|5th|6th|first|second|third|fourth|fifth|sixth)\s+season(?:\s+(?:part|cour)\s+(\d+))?/i);
    if (ordMatch) {
      const ordMap = { "1st": 1, "first": 1, "2nd": 2, "second": 2, "3rd": 3, "third": 3, "4th": 4, "fourth": 4, "5th": 5, "fifth": 5, "6th": 6, "sixth": 6 };
      const sNum = ordMap[ordMatch[1].toLowerCase()];
      const pNum = ordMatch[2] ? parseInt(ordMatch[2]) : null;
      return { type: "TV", seasonNum: sNum, partNum: pNum, label: pNum ? `Season ${sNum} Part ${pNum}` : `Season ${sNum}` };
    }

    if (lower.includes("final season")) {
      const pMatch = t.match(/part\s*(\d+)/i);
      return { type: "TV", isFinal: true, label: pMatch ? `Final Season Part ${pMatch[1]}` : "Final Season" };
    }

    const pSolo = t.match(/\bpart\s*(\d+)\b/i);
    if (pSolo) {
      return { type: "TV", partNum: parseInt(pSolo[1]), label: `Part ${pSolo[1]}` };
    }

    return { type: "TV", seasonNum: null, label: null };
  }

  function _buildAnimeSeasonTabs(currentMedia, relationsList) {
    if (!currentMedia) return [];

    const currentTitle = _getCleanAnimeTitle(currentMedia.title);
    const currentId = currentMedia.id;

    const validRelTypes = new Set(["PREQUEL", "SEQUEL", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "PARENT", "SUMMARY"]);
    const baseWord = currentTitle.split(/[:\-\s]/)[0].toLowerCase();

    const mediaMap = new Map();
    mediaMap.set(currentId, {
      id: currentId,
      title: currentTitle,
      format: currentMedia.format || "TV",
      year: currentMedia.year || "",
      isCurrent: true,
      relationType: "CURRENT"
    });

    for (const rel of (relationsList || [])) {
      if (!rel || !rel.id || mediaMap.has(rel.id)) continue;
      if (rel.relationType && !validRelTypes.has(rel.relationType)) continue;

      const relTitle = _getCleanAnimeTitle(rel.title);
      const titleLower = relTitle.toLowerCase();
      if (baseWord.length > 2 && !titleLower.includes(baseWord)) continue;

      mediaMap.set(rel.id, {
        id: rel.id,
        title: relTitle,
        format: rel.format || "TV",
        year: rel.year || "",
        isCurrent: rel.id === currentId,
        relationType: rel.relationType || ""
      });
    }

    const allItems = Array.from(mediaMap.values());

    const isMainline = (item) => {
      const t = (item.title || "").toLowerCase();
      const fmt = (item.format || "").toUpperCase();
      const rel = (item.relationType || "").toUpperCase();

      if (["ONA", "OVA", "MOVIE", "SPECIAL", "MUSIC"].includes(fmt)) return false;
      if (t.includes("the movie") || t.includes(" movie")) return false;
      if (t.includes(" ovas") || t.includes(" ova")) return false;
      if (t.includes("break time") || t.includes("kyuukei jikan") || t.includes("petit")) return false;
      if (rel === "SPIN_OFF" || rel === "SIDE_STORY") return false;

      return true;
    };

    const mainlineItems = [];
    const sideItems = [];

    allItems.forEach(item => {
      const parsed = _parseExplicitAnimeSeason(item.title, item.format);
      const enriched = { ...item, ...parsed };
      if (isMainline(item) && parsed.type === "TV") {
        mainlineItems.push(enriched);
      } else {
        sideItems.push(enriched);
      }
    });

    mainlineItems.sort((a, b) => {
      const yA = parseInt(a.year) || 0;
      const yB = parseInt(b.year) || 0;
      if (yA !== yB) return yA - yB;
      return (a.seasonNum || 0) - (b.seasonNum || 0);
    });

    let currentSeasonCounter = 1;
    const usedSeasonNums = new Set();
    mainlineItems.forEach(item => {
      if (item.seasonNum) usedSeasonNums.add(item.seasonNum);
    });

    mainlineItems.forEach(item => {
      if (!item.label) {
        if (item.seasonNum) {
          item.label = `Season ${item.seasonNum}`;
        } else {
          while (usedSeasonNums.has(currentSeasonCounter)) {
            currentSeasonCounter++;
          }
          item.seasonNum = currentSeasonCounter;
          item.label = `Season ${currentSeasonCounter}`;
          usedSeasonNums.add(currentSeasonCounter);
          currentSeasonCounter++;
        }
      }
    });

    sideItems.sort((a, b) => {
      const yA = parseInt(a.year) || 0;
      const yB = parseInt(b.year) || 0;
      return yA - yB;
    });

    const labelCounts = {};
    const finalItems = [...mainlineItems, ...sideItems];
    finalItems.forEach(item => {
      const baseLabel = item.label || item.type || "Special";
      labelCounts[baseLabel] = (labelCounts[baseLabel] || 0) + 1;
    });

    const runningCounts = {};
    return finalItems.map(item => {
      let finalLabel = item.label || item.type || "Special";
      if (labelCounts[finalLabel] > 1 && (item.type === "OVA" || item.type === "ONA" || item.type === "MOVIE" || item.type === "SPECIAL")) {
        runningCounts[finalLabel] = (runningCounts[finalLabel] || 0) + 1;
        finalLabel = `${finalLabel} ${runningCounts[finalLabel]}`;
      }
      return {
        id: item.id,
        title: item.title,
        label: finalLabel,
        isCurrent: item.id === currentId
      };
    });
  }

  function _renderSeasonSelectorBar(tabs) {
    if (!tabs || tabs.length <= 1) return "";
    return `
      <div class="anime-season-selector-bar">
        ${tabs.map(tab => `
          <button class="anime-season-selector-tab ${tab.isCurrent ? 'active' : ''}" 
                  onclick="App.openItem({ id: ${tab.id}, media: 'anime', title: '${_esc(tab.title).replace(/'/g, "\\'")}' })">
            ${_esc(tab.label)}
          </button>
        `).join("")}
      </div>
    `;
  }

    // Season Grouping & Tabs
    const initialSeasonTabs = _buildAnimeSeasonTabs(d, d.relations || []);
    const seasonSelectorHTML = _renderSeasonSelectorBar(initialSeasonTabs);

    const getRelationTag = rel => {
      const titleLower = rel.title.toLowerCase();
      if (titleLower.includes("final season")) return "Final Season";
      if (titleLower.includes("season 4") || titleLower.includes("4th season")) return "Season 4";
      if (titleLower.includes("season 3") || titleLower.includes("3rd season")) return "Season 3";
      if (titleLower.includes("season 2") || titleLower.includes("2nd season")) return "Season 2";
      if (titleLower.includes("season 1") || titleLower.includes("1st season")) return "Season 1";
      if (rel.format === "MOVIE") return "Movie";
      if (rel.format === "SPECIAL") return "Special";
      if (rel.format === "OVA") return "OVA";
      if (rel.format === "ONA") return "ONA";
      if (rel.relationType === "SEQUEL") return "Sequel";
      if (rel.relationType === "PREQUEL") return "Prequel";
      if (rel.relationType === "SIDE_STORY") return "Side Story";
      return rel.relationType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    };

    const relationOrder = ["PREQUEL", "SEQUEL", "MOVIE", "OVA", "ONA", "SPECIAL"];
    const sortedRelations = [...(d.relations || [])].sort((a, b) => {
      const idxA = relationOrder.indexOf(a.relationType) !== -1 ? relationOrder.indexOf(a.relationType) : 99;
      const idxB = relationOrder.indexOf(b.relationType) !== -1 ? relationOrder.indexOf(b.relationType) : 99;
      return idxA - idxB;
    });

    const relationsHTML = sortedRelations.length ? `
      <h3 class="pm-section-title">Related Series</h3>
      <div class="pm-relation-scroll">
        ${sortedRelations.map(rel => {
      const tag = getRelationTag(rel);
      return `
            <div class="relation-card" onclick="App.openItem({ id: ${rel.id}, media: 'anime', title: '${_esc(rel.title).replace(/'/g, "\\'")}', poster: '${_esc(rel.poster_path).replace(/'/g, "\\'")}' })">
              <div class="relation-poster" style="background-image:url('${rel.poster_path}')">
                <div class="relation-tag-badge">${tag}</div>
              </div>
              <div class="relation-title">${_esc(rel.title)}</div>
              <div class="relation-meta">${rel.year ? rel.year : ""} ${rel.episodes ? `· ${rel.episodes} Ep` : ""} · ${rel.format}</div>
            </div>
          `;
    }).join("")}
      </div>
    ` : "";

    const castHTML = d.cast?.length ? `
      <h3 class="pm-section-title">Cast / Characters</h3>
      <div class="pm-cast-scroll">
        ${d.cast.map(p => `
          <div class="cast-card">
            <div class="cast-photo" style="background-image:url('${p.photo || ""}')">
              ${!p.photo ? `<span class="cast-initials">${(p.name || "?").charAt(0)}</span>` : ""}
            </div>
            <div class="cast-name">${_esc(p.name)}</div>
            <div class="cast-role">${_esc(p.character)}</div>
          </div>`).join("")}
      </div>` : "";

    const recsHTML = d.recommendations?.length ? `
      <h3 class="pm-section-title">You May Also Like</h3>
      <div class="pm-rec-scroll">
        ${d.recommendations.map(r => `
          <div class="rec-card" onclick="App.openItem(${_jsonAttr(r)})">
            <div class="rec-poster" style="background-image:url('${r.poster || ""}')">
              ${!r.poster ? `<span class="rec-no-img">${_esc((r.title || "?").charAt(0))}</span>` : ""}
              <div class="rec-overlay"><span>Play</span></div>
            </div>
            <div class="rec-title">${_esc(r.title)}</div>
            <div class="rec-year">${r.year} · <svg viewBox="0 0 24 24" width="11" height="11" fill="var(--gold)" style="vertical-align:middle;display:inline-block"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${(r.rating || 0).toFixed(1)}</div>
          </div>`).join("")}
      </div>` : "";

    bg.innerHTML = `
      <div class="player-modal cinematic-detail-modal anime-detail-modal" role="dialog" aria-modal="true" aria-label="${_esc(d.title)}">
        <!-- Corner Close Button (1Flex-inspired) -->
        <button type="button" class="pm-modal-close-corner-btn" onclick="Player.close()" aria-label="Close modal" title="Close (Esc)">✕</button>
        <!-- 1. Cinematic Hero Banner (70-85% Viewport Height) -->
        <div class="pm-cinematic-hero" style="background-image:url('${d.backdrop || d.poster || ""}')">
          <div class="pm-hero-video-layer" id="pm-hero-video-layer"></div>
          <div class="pm-hero-vignette"></div>

          <div class="pm-hero-content pm-hero-split-layout">
            <div class="pm-hero-left">
              <div class="pm-hero-badges">
                <span class="badge badge-${d.media}">${badgeLabel}</span>
                ${d.year ? `<span class="badge badge-year">${d.year}</span>` : ""}
                ${d.episodes ? `<span class="badge badge-meta">${d.episodes} Episodes</span>` : ""}
                ${d.status ? `<span class="badge badge-meta">${_esc(d.status)}</span>` : ""}
                <span class="badge badge-hd">HD</span>
                ${genreNames ? `<span class="hero-genres" style="font-size:12px;color:rgba(255,255,255,0.7);margin-left:4px;">${_esc(genreNames)}</span>` : ""}
              </div>

              <h1 class="pm-hero-title">${_esc(d.title)}</h1>
              ${d.tagline ? `<p class="pm-hero-tagline">"${_esc(d.tagline)}"</p>` : ""}
              ${d.overview ? `<p class="pm-hero-overview">${_esc(d.overview.slice(0, 260))}${d.overview.length > 260 ? "…" : ""}</p>` : ""}

              <div class="pm-hero-rating">
                ${ratingStars}
                <span class="pm-rating-num">${(d.rating || 0).toFixed(1)}</span>
                <span class="pm-votes">(${d.votes?.toLocaleString?.() || d.votes || 0} popularity)</span>
              </div>

              <div class="pm-hero-actions">
                <button class="pm-play-btn anime-play-btn" onclick="App.watchAnimeNow()">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>Watch Anime</span>
                </button>
                <div class="anime-audio-segmented-wrap" role="group" aria-label="Anime Audio Track">
                  <button type="button" class="anime-audio-seg-btn ${(_currentActiveAudioMode || 'sub') === 'sub' ? 'active' : ''}" onclick="App.setAnimeAudioMode('sub')" title="Original Japanese with English Subtitles">
                    <span class="anime-seg-flag">🇯🇵</span> <span>SUB</span>
                  </button>
                  <button type="button" class="anime-audio-seg-btn ${(_currentActiveAudioMode || 'sub') === 'dub' ? 'active' : ''}" onclick="App.setAnimeAudioMode('dub')" title="English Dubbed Audio">
                    <span class="anime-seg-flag">🇺🇸</span> <span>DUB</span>
                  </button>
                </div>
                <button class="pm-wl-action-btn${wl ? " added" : ""}" id="pm-hero-wl-btn" onclick="App._toggleAnimeWL()">
                  ${wl ? _CHECK_SVG : _PLUS_SVG}
                  <span>${wl ? "In Watchlist" : "Add to List"}</span>
                </button>
              </div>
            </div>

            <div class="pm-hero-right">
              <div class="pm-hero-side-card">
                <div class="pm-side-info-line"><span class="label">Format:</span> <span class="val">${_esc(badgeLabel)}</span></div>
                ${d.year ? `<div class="pm-side-info-line"><span class="label">Aired:</span> <span class="val">${d.year}</span></div>` : ""}
                ${d.status ? `<div class="pm-side-info-line"><span class="label">Status:</span> <span class="val">${_esc(d.status)}</span></div>` : ""}
                ${d.episodes ? `<div class="pm-side-info-line"><span class="label">Episodes:</span> <span class="val">${d.episodes}</span></div>` : ""}
                <div class="pm-side-info-line"><span class="label">Audio:</span> <span class="val">Original (SUB) / Dubbed (DUB)</span></div>
                <div class="pm-side-info-line"><span class="label">Quality:</span> <span class="val">1080p Ultra HD</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Content Sections Underneath Hero -->
        <div class="pm-cinematic-body">
          <div id="anime-player-container" class="player-container-theater" style="margin-bottom:24px;">
            <div id="anime-player-wrap" class="pm-player-wrap" style="display:none; position:relative; overflow:hidden;">
              <!-- Glowing Buffer Spinner Overlay -->
              <div id="anime-buffering-overlay" class="player-buffering-overlay" style="display:none;">
                <div class="loader-spinner"></div>
                <div class="buffering-text">Buffering...</div>
              </div>

              <!-- Episode Title Overlay -->
              <div id="anime-title-overlay" class="player-title-overlay" style="opacity:0;">
                <span id="anime-title-series" class="title-series"></span>
                <span class="title-divider">/</span>
                <span id="anime-title-episode" class="title-episode"></span>
              </div>

              <!-- Keyboard Help Dialog Overlay -->
              <div id="anime-help-overlay" class="player-help-overlay" style="display:none; pointer-events:auto;">
                <div class="help-content">
                  <h4>Player Shortcuts</h4>
                  <div class="help-grid">
                    <div><kbd>Space</kbd> <span>Play / Pause</span></div>
                    <div><kbd>←</kbd> <kbd>→</kbd> <span>Seek 10s back/forward</span></div>
                    <div><kbd>↑</kbd> <kbd>↓</kbd> <span>Volume +/- 10%</span></div>
                    <div><kbd>F</kbd> <span>Toggle Fullscreen</span></div>
                    <div><kbd>M</kbd> <span>Toggle Mute</span></div>
                    <div><kbd>S</kbd> <span>Take Screenshot</span></div>
                    <div><kbd>P</kbd> <span>Picture-in-Picture</span></div>
                    <div><kbd>T</kbd> <span>Toggle Theater Mode</span></div>
                    <div><kbd>?</kbd> <span>Toggle Help Menu</span></div>
                  </div>
                  <button class="btn-primary" onclick="App.toggleShortcutHelp()" style="margin-top:15px; width:100%">Close</button>
                </div>
              </div>

              <!-- Screenshot Flash Overlay -->
              <div id="anime-flash-overlay" class="player-flash-overlay" style="display:none;"></div>

              <!-- Mini Episode List Drawer -->
              <div id="anime-mini-episodes-drawer" class="player-mini-drawer" style="display:none; pointer-events:auto; transform: translateX(100%);">
                <div class="mini-drawer-header">
                  <h4>Episodes</h4>
                  <button onclick="App.toggleMiniEpisodeDrawer()" class="mini-drawer-close" aria-label="Close episodes"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                <div class="mini-drawer-list" id="anime-mini-eps-list"></div>
              </div>

              <div id="anime-quality-badge" style="position: absolute; top: 15px; right: 15px; background: rgba(0, 0, 0, 0.75); border: 1px solid rgba(255, 255, 255, 0.15); color: #00ff88; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; z-index: 10; display: none;"></div>
              <video id="anime-video-player" class="player-hidden" controls playsinline webkit-playsinline crossorigin="anonymous" width="100%" height="100%" style="width:100%; height:100%; aspect-ratio:16/9; background:#000; border-radius:8px; display:none;"></video>
              <iframe id="anime-iframe-player" class="player-hidden" width="100%" height="100%" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" style="width:100%; height:100%; aspect-ratio:16/9; background:#000; border-radius:8px; display:none; border:0;"></iframe>
              <button id="skip-intro-btn" class="btn-primary" style="position: absolute; bottom: 60px; left: 20px; z-index: 10; display: none; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer;" onclick="App.skipIntro()">Skip Intro</button>
              <button id="skip-outro-btn" class="btn-primary" style="position: absolute; bottom: 60px; right: 20px; z-index: 10; display: none; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer;" onclick="App.skipOutro()">Skip Outro</button>
            </div>

            <!-- Dedicated Video Player Bottom Bar with Auto Next Checkbox & Prev / Next Buttons -->
            <div id="anime-player-bottom-bar" class="anime-player-bottom-bar" style="display:none;">
              <div class="anime-bottom-bar-left">
                <label class="anime-auto-next-label" title="Auto-play next episode when current episode finishes">
                  <input type="checkbox" id="anime-auto-next-cb" onchange="App.toggleAnimeAutoNext(this.checked)">
                  <span class="auto-next-slider"></span>
                  <span class="auto-next-text">Auto Next</span>
                </label>
              </div>
              <div class="anime-bottom-bar-center">
                <span id="anime-current-ep-badge" class="current-ep-badge">Episode 1</span>
              </div>
              <div class="anime-bottom-bar-right">
                <button id="anime-prev-ep-btn" class="anime-prev-ep-btn" onclick="App.playPrevEpisode()" title="Play Previous Episode">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                  <span>Prev</span>
                </button>
                <button id="anime-next-ep-btn" class="anime-next-ep-btn" onclick="App.playNextEpisode()" title="Play Next Episode">
                  <span>Next</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div id="anime-player-controls" class="anime-player-controls" style="display:none;"></div>

          <!-- Series Sections (Season Selector, Episode Search & Numeric Sorting) -->
          <div id="anime-episodes-section" class="pm-series-section">
            <div class="pm-episodes-header-row">
              <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <h3 class="pm-section-title" style="margin-bottom:0;">Episodes</h3>
                <div class="anime-audio-segmented-wrap" role="group" aria-label="Audio Track Selector">
                  <button type="button" class="anime-audio-seg-btn ${(_currentActiveAudioMode || 'sub') === 'sub' ? 'active' : ''}" onclick="App.setAnimeAudioMode('sub')" title="Original Japanese with English Subtitles">
                    <span class="anime-seg-flag">🇯🇵</span> <span>SUB</span>
                  </button>
                  <button type="button" class="anime-audio-seg-btn ${(_currentActiveAudioMode || 'sub') === 'dub' ? 'active' : ''}" onclick="App.setAnimeAudioMode('dub')" title="English Dubbed Audio">
                    <span class="anime-seg-flag">🇺🇸</span> <span>DUB</span>
                  </button>
                </div>
              </div>
              <div class="pm-episodes-controls">
                <div class="pm-ep-search-box">
                  <svg class="pm-ep-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" id="anime-ep-search-input" class="pm-ep-search-input" placeholder="Search episodes..." value="${_esc(_animeEpSearchQuery)}" oninput="App.onAnimeEpisodeSearch(this.value)" autocomplete="off">
                  <button id="anime-ep-search-clear" class="pm-ep-search-clear" onclick="App.clearAnimeEpisodeSearch()" style="${_animeEpSearchQuery ? 'display:flex;' : 'display:none;'}" title="Clear search">✕</button>
                </div>
                <button id="anime-ep-sort-btn" class="pm-ep-sort-btn${_animeEpSortOrder === 'desc' ? ' desc' : ''}" onclick="App.toggleAnimeSortOrder()" title="Toggle sort order" aria-label="Toggle sort order">
                  <svg class="pm-sort-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
                  <span id="anime-ep-sort-label">${_animeEpSortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                </button>
              </div>
            </div>
            <div id="anime-season-selector-container">
              ${seasonSelectorHTML}
            </div>
            <div id="anime-season-tabs" class="anime-season-tabs" style="display:none;"></div>
            <div class="loader-spinner" id="anime-eps-loader"></div>
            <div class="anime-ep-grid-rich" id="anime-eps-grid"></div>
          </div>

          ${relationsHTML}
          ${castHTML}
          ${recsHTML}
        </div>
      </div>`;

    bg.onclick = _handleAnimeBackdropClick;

    // Load trailer for this anime title
    if (window.HeroTrailerController) {
      window.HeroTrailerController.loadTrailerForItem("detail", d);
    }

    // Register double-click for fullscreen
    const videoEl = document.getElementById("anime-video-player");
    if (videoEl) {
      videoEl.addEventListener("dblclick", () => {
        if (!document.fullscreenElement) {
          videoEl.requestFullscreen?.().catch(err => console.log(err));
        } else {
          document.exitFullscreen?.().catch(err => console.log(err));
        }
      });
    }

    // Store current item for watchlist toggle
    bg._currentAnimeItem = d;

    // Smooth scroll to top of details body
    const pmBody = bg.querySelector(".pm-body");
    if (pmBody) {
      pmBody.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Asynchronously resolve full franchise prequel/sequel chain and update selector tabs
    if (typeof Anilist.getFranchiseRelations === "function") {
      Anilist.getFranchiseRelations(d).then(allFranchiseRelations => {
        if (allFranchiseRelations && allFranchiseRelations.length > (d.relations || []).length) {
          const fullTabs = _buildAnimeSeasonTabs(d, allFranchiseRelations);
          const container = document.getElementById("anime-season-selector-container");
          if (container) {
            container.innerHTML = _renderSeasonSelectorBar(fullTabs);
          }
        }
      }).catch(err => console.warn("[Franchise] Background resolution failed:", err));
    }

    // Fetch real episodes from backend
    const preferredProvider = localStorage.getItem("streamx_anime_provider") || null;
    _fetchAnimeEpisodes(d.id, preferredProvider);
    window.addEventListener("keydown", handlePlayerShortcuts);
  }

  function toggleAnimeTrailerSound() {
    if (window.HeroTrailerController) {
      window.HeroTrailerController.toggleSound("detail");
    }
  }

  function watchAnimeNow() {
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.silenceAll();
      window.HeroTrailerController.pause("detail");
    }

    const playerWrap = document.getElementById("anime-player-wrap");
    if (_currentEpisodesList && _currentEpisodesList.length > 0) {
      if (!_activeEpisodeId) {
        const bg = document.getElementById("player-modal-bg");
        const animeId = bg?._currentAnimeItem?.id;
        const last = animeId ? StreamXHistory.getLastEpisode(animeId) : null;
        let targetEp = null;
        if (last && last.episode) {
          targetEp = _currentEpisodesList.find(e => e.episode_number === last.episode);
        }
        if (!targetEp) targetEp = _currentEpisodesList[0];
        playAnimeEpisode(targetEp.id, targetEp.episode_number);
      } else if (playerWrap) {
        playerWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      const sec = document.getElementById("anime-episodes-section");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function _closeAnimeDetail(skipHashPush = false) {
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
    }
    const video = document.getElementById("anime-video-player");
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.src = "";
        if (video.load) video.load();
      } catch (_) {}
      video.classList.add("player-hidden");
      video.classList.remove("player-visible");
      video.style.setProperty("display", "none", "important");
    }
    const iframe = document.getElementById("anime-iframe-player");
    if (iframe) {
      try {
        iframe.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } catch (_) {}
      iframe.src = "about:blank";
      iframe.removeAttribute("src");
      iframe.classList.add("player-hidden");
      iframe.classList.remove("player-visible");
      iframe.style.setProperty("display", "none", "important");
      if (iframe.parentNode) {
        const clean = iframe.cloneNode(false);
        clean.src = "about:blank";
        clean.removeAttribute("src");
        clean.classList.add("player-hidden");
        clean.classList.remove("player-visible");
        clean.style.setProperty("display", "none", "important");
        iframe.parentNode.replaceChild(clean, iframe);
      }
    }
    if (window.Player && typeof Player.exitBigWatch === "function") {
      Player.exitBigWatch(true);
    }
    if (_hlsInstance) {
      try {
        _hlsInstance.stopLoad();
        _hlsInstance.destroy();
      } catch (_) {}
      _hlsInstance = null;
    }
    window.removeEventListener("keydown", handlePlayerShortcuts);
    const bg = document.getElementById("player-modal-bg");
    const modalEl = bg ? bg.querySelector(".player-modal") : null;

    const finalizeClose = () => {
      if (bg) {
        bg.classList.remove("open");
        bg.classList.remove("has-cinematic-detail");
        bg.innerHTML = "";
        bg._currentAnimeItem = null;
      }
      document.body.classList.remove("has-modal-open", "big-player-active");
      _resumeHeroRotations();
      const topHdr = document.getElementById("top-header");
      if (topHdr) {
        topHdr.classList.remove("header-hidden-detail", "hidden");
        topHdr.style.removeProperty("display");
        topHdr.style.removeProperty("visibility");
        topHdr.style.removeProperty("opacity");
        topHdr.style.removeProperty("pointer-events");
      }
      const backBtn = document.getElementById("header-back-btn");
      if (backBtn) backBtn.style.display = "none";
      _updateActiveNavLinks(_currentPage || "home");
      hideActionLoader();
      _activeEpisodeId = null;
      _activeEpisodeNumber = null;
      _autoPlayEpisodeNumber = null;
      _animeEpSearchQuery = "";
      _animeEpSortOrder = "asc";
      document.body.style.overflow = "";

      if (window.HeroTrailerController) {
        if (_currentPage === "home") window.HeroTrailerController.resume("general");
        else if (_currentPage === "anime") window.HeroTrailerController.resume("anime");
      }

      // Cleanly pop history back to origin if pushed by CineJoy, else fallback to home
      if (!skipHashPush) {
        if (window.history.length > 1 && window.history.state && window.history.state.streamx) {
          window.history.back();
        } else if (window.location.hash && window.location.hash !== "#/") {
          window.location.hash = "#/";
        }
      }
    };

    if (modalEl && window._cinejoyOriginCardRect && window.Player && typeof Player._animateModalZoomOut === "function") {
      Player._animateModalZoomOut(modalEl, finalizeClose);
    } else {
      finalizeClose();
    }
  }

  function toggleMobileDrawer() {
    const overlay = document.getElementById("mobile-drawer-overlay");
    const drawer = document.getElementById("mobile-nav-drawer");
    if (!overlay || !drawer) return;

    const isOpen = drawer.classList.contains("open");
    if (isOpen) {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      window.removeEventListener("keydown", _handleDrawerEscape);
    } else {
      drawer.classList.add("open");
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", _handleDrawerEscape);
    }
  }

  function _handleDrawerEscape(e) {
    if (e.key === "Escape") {
      toggleMobileDrawer();
    }
  }

  function handleNavItemClick(itemId, action, target, filter) {
    // 1. Close mobile drawer if it's open
    const drawer = document.getElementById("mobile-nav-drawer");
    if (drawer && drawer.classList.contains("open")) {
      toggleMobileDrawer();
    }

    // 2. Terminate any active big player stream or detail playback
    if (window.Player && typeof Player.exitBigWatch === "function") {
      Player.exitBigWatch(true);
    }
    if (window.Player && typeof Player.close === "function") {
      Player.close(true);
    }

    // 3. Perform action
    if (action === "page") {
      _activeRowId = null;
      if (target === "anime" || itemId === "anime") {
        _showPage("anime");
      } else if (target === "donghua" || itemId === "donghua") {
        _showPage("anime", true);
        history.pushState(null, "", "#/donghua");
        _updateActiveNavLinks("anime", "donghua");
        setTimeout(() => scrollToAnimeRow("donghua_trending"), 150);
      } else {
        _showPage(target);
      }
    } else if (action === "browse") {
      _activeRowId = target;
      if (itemId === "movies") {
        history.pushState(null, "", "#/movies");
        openBrowse(target, true);
      } else if (itemId === "series" || itemId === "tv") {
        history.pushState(null, "", "#/series");
        openBrowse(target, true);
      } else if (itemId === "dramas" || itemId === "drama" || itemId === "kdrama") {
        history.pushState(null, "", "#/dramas");
        openBrowse(target, true);
      } else if (itemId === "anime") {
        _showPage("anime");
      } else if (itemId === "donghua") {
        _showPage("anime", true);
        history.pushState(null, "", "#/donghua");
        _updateActiveNavLinks("anime", "donghua");
        setTimeout(() => scrollToAnimeRow("donghua_trending"), 150);
      } else {
        openBrowse(target);
      }
    } else if (action === "scroll_to") {
      _activeRowId = null;
      _showPage("home");
      setTimeout(() => {
        const el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    } else if (action === "coming_soon") {
      _showToast(`${itemId.charAt(0).toUpperCase() + itemId.slice(1)} reader is coming soon!`);
    } else if (action === "disclaimer") {
      openDisclaimerModal(target || "non-hosting");
      return;
    } else if (action === "install_pwa") {
      installPWA();
      return;
    }
  }

  function _showToast(message) {
    const existing = document.querySelector(".streamx-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "streamx-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add("visible"), 50);

    // Remove after 3s
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function _initNavigation() {
    // 1. Render Desktop Sidebar Links
    const sidebarLinksContainer = document.getElementById("sidebar-links");
    if (sidebarLinksContainer) {
      let sidebarHTML = "";
      STREAMX_NAV_SECTIONS.forEach((sect, index) => {
        if (index > 0) {
          sidebarHTML += `<div class="sidebar-divider"></div>`;
        }
        sidebarHTML += `<div class="sidebar-section-title">${_esc(sect.section)}</div>`;
        sect.items.forEach(item => {
          const iconSVG = _getIconSVG(item.icon);

          if (item.subitems) {
            // Render sub-navigation block
            sidebarHTML += `
              <button class="sidebar-link has-submenu" data-nav-id="${item.id}" title="${_esc(item.label)}" onclick="App.toggleSidebarSubmenu('${item.id}')">
                ${iconSVG}
                <span class="sidebar-link-text">${_esc(item.label)}</span>
                <svg class="sidebar-chevron" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
              </button>
              <div id="submenu-${item.id}" class="sidebar-sublinks" style="display: none">
                ${item.subitems.map(sub => `
                  <button class="sidebar-sublink" data-nav-id="${sub.id}" onclick="App.handleNavItemClick('${sub.id}', '${sub.action}', '${sub.target}', '${sub.filter || ""}')">
                    ${_getIconSVG(sub.icon || "anime")}
                    <span>${_esc(sub.label)}</span>
                  </button>
                `).join("")}
              </div>
            `;
          } else {
            sidebarHTML += `
              <button class="sidebar-link" data-nav-id="${item.id}" title="${_esc(item.label)}" onclick="App.handleNavItemClick('${item.id}', '${item.action}', '${item.target || ""}', '${item.filter || ""}')">
                ${iconSVG}
                <span class="sidebar-link-text">${_esc(item.label)}</span>
              </button>
            `;
          }
        });
      });
      sidebarLinksContainer.innerHTML = sidebarHTML;
    }

    // 2. Render Mobile Drawer Links
    const drawerLinksContainer = document.getElementById("drawer-links");
    if (drawerLinksContainer) {
      let drawerHTML = `
        <button class="drawer-link drawer-search-shortcut" onclick="App.toggleMobileDrawer(); App.toggleMobileSearch(true);" style="background: rgba(255, 42, 109, 0.12); border: 1px solid rgba(255, 42, 109, 0.28); color: #fff; margin-bottom: 8px; font-weight: 600;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span>Search Everything</span>
        </button>
        <button class="drawer-link drawer-profile-shortcut" onclick="App.toggleMobileDrawer(); App.showPage('profile');" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; margin-bottom: 12px; font-weight: 600;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="color: #ff3b65;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>My Profile &amp; Preferences</span>
        </button>
      `;
      STREAMX_NAV_SECTIONS.forEach((sect, index) => {
        if (index > 0) {
          drawerHTML += `<div class="drawer-divider"></div>`;
        }
        drawerHTML += `<div class="drawer-section-title">${_esc(sect.section)}</div>`;
        sect.items.forEach(item => {
          const iconSVG = _getIconSVG(item.icon);
          if (item.subitems) {
            // Mobile: Flatten subitems directly for easy access on small screens
            item.subitems.forEach(sub => {
              const subIcon = _getIconSVG(sub.icon);
              drawerHTML += `
                <button class="drawer-link" data-nav-id="${sub.id}" onclick="App.handleNavItemClick('${sub.id}', '${sub.action}', '${sub.target || ""}', '${sub.filter || ""}')">
                  ${subIcon}
                  <span>${_esc(sub.label)}</span>
                </button>
              `;
            });
          } else {
            drawerHTML += `
              <button class="drawer-link" data-nav-id="${item.id}" onclick="App.handleNavItemClick('${item.id}', '${item.action}', '${item.target || ""}', '${item.filter || ""}')">
                ${iconSVG}
                <span>${_esc(item.label)}</span>
              </button>
            `;
          }
        });
      });

      // Append Indian Cinema to Mobile Drawer for parity
      drawerHTML += `
        <div class="drawer-divider"></div>
        <div class="drawer-section-title">Indian Cinema</div>
        <button class="drawer-link" data-nav-id="bollywood" onclick="App.handleNavItemClick('bollywood', 'browse', 'bollywood')">
          ${_getIconSVG("movies")}
          <span>Bollywood</span>
        </button>
        <button class="drawer-link" data-nav-id="tollywood" onclick="App.handleNavItemClick('tollywood', 'browse', 'tollywood')">
          ${_getIconSVG("movies")}
          <span>Tollywood</span>
        </button>
        <button class="drawer-link" data-nav-id="kollywood" onclick="App.handleNavItemClick('kollywood', 'browse', 'kollywood')">
          ${_getIconSVG("movies")}
          <span>Kollywood</span>
        </button>
        <button class="drawer-link" data-nav-id="mollywood" onclick="App.handleNavItemClick('mollywood', 'browse', 'mollywood')">
          ${_getIconSVG("movies")}
          <span>Mollywood</span>
        </button>
        <button class="drawer-link" data-nav-id="sandalwood" onclick="App.handleNavItemClick('sandalwood', 'browse', 'sandalwood')">
          ${_getIconSVG("movies")}
          <span>Kannada</span>
        </button>
      `;

      drawerLinksContainer.innerHTML = drawerHTML;
    }

    _updateActiveNavLinks(_currentPage, _activeRowId);
  }

  function _updateActiveNavLinks(page, rowId = null) {
    // Subpage back button (cinejoy.pk style)
    const backBtn = document.getElementById("header-back-btn");
    const isModalOpen = Boolean(document.getElementById("player-modal-bg")?.classList.contains("open"));
    if (backBtn) {
      backBtn.style.display = ((page === "home" || !page) && !isModalOpen) ? "none" : "inline-flex";
    }

    // 0. Floating Glass Navbar & Mobile Bottom Nav items (Reference Design)
    document.querySelectorAll(".glass-nav-item, .glass-nav-icon-btn, .mobile-bottom-nav-item").forEach(item => {
      item.classList.remove("active");
    });
    if (page === "home" && !isModalOpen) {
      document.getElementById("nav-link-home")?.classList.add("active");
      document.getElementById("mob-nav-home")?.classList.add("active");
    } else if (page === "anime") {
      document.getElementById("nav-link-anime")?.classList.add("active");
      document.getElementById("mob-nav-anime")?.classList.add("active");
    } else if (page === "livetv") {
      document.getElementById("nav-link-livetv")?.classList.add("active");
      document.getElementById("mob-nav-livetv")?.classList.add("active");
    } else if (page === "extensions") {
      document.getElementById("nav-link-extensions")?.classList.add("active");
      document.getElementById("mob-nav-extensions")?.classList.add("active");
    } else if (page === "watchlist") {
      document.getElementById("nav-link-watchlist")?.classList.add("active");
      document.getElementById("mob-nav-watchlist")?.classList.add("active");
    } else if (page === "search") {
      document.getElementById("mob-nav-search")?.classList.add("active");
    } else if (page === "settings-page" || page === "settings") {
      document.getElementById("nav-settings-btn")?.classList.add("active");
    } else if (page === "movies" || (page === "browse" && rowId && rowId.includes("movie"))) {
      document.getElementById("nav-link-movies")?.classList.add("active");
      document.getElementById("mob-nav-movies")?.classList.add("active");
    } else if (page === "series" || page === "tv" || (page === "browse" && rowId && (rowId.includes("tv") || rowId.includes("series")))) {
      document.getElementById("nav-link-tv")?.classList.add("active");
      document.getElementById("mob-nav-tv")?.classList.add("active");
    }

    // 1. Sidebar Links Highlight
    const sidebarLinks = document.querySelectorAll(".sidebar-link, .sidebar-sublink");
    sidebarLinks.forEach(link => {
      link.classList.remove("active");
      const navId = link.getAttribute("data-nav-id") || "";
      if (page === "home" && navId === "home") {
        link.classList.add("active");
      } else if (page === "livetv" && navId === "livetv") {
        link.classList.add("active");
      } else if (page === "anime") {
        if (rowId === "donghua" && navId === "donghua") {
          link.classList.add("active");
        } else if (navId === "anime" && rowId !== "donghua") {
          link.classList.add("active");
        }
      } else if (page === "watchlist" && navId === "watchlist") {
        link.classList.add("active");
      } else if (page === "history-page" && navId === "history") {
        link.classList.add("active");
      } else if (page === "continue-page" && navId === "continue") {
        link.classList.add("active");
      } else if (page === "settings-page" && navId === "settings") {
        link.classList.add("active");
      } else if (page === "browse" && rowId) {
        const cleanRowId = rowId.split("_")[0];
        if (
          navId === cleanRowId ||
          (rowId.includes("movies") && navId === "movies") ||
          (rowId.includes("tv") && (navId === "series" || navId === "tv")) ||
          (rowId === "anime" && navId === "anime") ||
          (rowId === "donghua" && navId === "donghua") ||
          ((rowId === "kdrama" || rowId === "cdrama" || rowId === "jdrama") && navId === "dramas")
        ) {
          link.classList.add("active");
        }
      }
    });

    // 2. Mobile Drawer Links Highlight
    const drawerLinks = document.querySelectorAll(".drawer-link");
    drawerLinks.forEach(link => {
      link.classList.remove("active");
      const navId = link.getAttribute("data-nav-id") || "";
      if (page === "home" && navId === "home") {
        link.classList.add("active");
      } else if (page === "livetv" && navId === "livetv") {
        link.classList.add("active");
      } else if (page === "anime") {
        if (rowId === "donghua" && navId === "donghua") {
          link.classList.add("active");
        } else if (navId === "anime" && rowId !== "donghua") {
          link.classList.add("active");
        }
      } else if (page === "watchlist" && navId === "watchlist") {
        link.classList.add("active");
      } else if (page === "history-page" && navId === "history") {
        link.classList.add("active");
      } else if (page === "continue-page" && navId === "continue") {
        link.classList.add("active");
      } else if (page === "settings-page" && navId === "settings") {
        link.classList.add("active");
      } else if (page === "browse" && rowId) {
        const cleanRowId = rowId.split("_")[0];
        if (
          navId === cleanRowId ||
          (rowId.includes("movies") && navId === "movies") ||
          (rowId.includes("tv") && (navId === "series" || navId === "tv")) ||
          (rowId === "anime" && navId === "anime") ||
          (rowId === "donghua" && navId === "donghua") ||
          ((rowId === "kdrama" || rowId === "cdrama" || rowId === "jdrama") && navId === "dramas")
        ) {
          link.classList.add("active");
        }
      }
    });
  }

  function _getIconSVG(name) {
    const PATHS = {
      home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
      movies: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
      tv: "M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .07-2 1.18V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7.18c0-1.11-.9-1.18-2-1.18zm0 13H3V8h18v11z",
      livetv: "M21 6h-7.59l3.29-3.3a1 1 0 10-1.41-1.41L12 4.59 8.71 1.29A1 1 0 007.29 2.7L10.59 6H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V8a2 2 0 00-2-2zm0 14H3V8h18v12zM9 10v8l7-4-7-4z",
      animation: "M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z",
      anime: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
      donghua: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c3.95-.49 7-3.85 7-7.93 0-.62-.08-1.21-.21-1.79L15 15v1c0 1.1-.9 2-2 2v1.93zm-6.9-2.54c.26-.81 1-1.39 1.9-1.39h1v-3c0-.55.45-1 1-1h2v-2h-2c-.55 0-1-.45-1-1V7h-2c-1.1 0-2-.9-2-2v-.41C3.87 5.78 2 8.68 2 12c0 2.08.8 3.97 2.1 5.39z",
      drama: "M12 2L4 12l8 10 8-10z",
      watchlist: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
      history: "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
      continue: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
      user: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
      settings: "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46.22 14.24 0 14 0h-4c-.24 0-.46.22-.49.49l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.27.25.49.49.49h4c.24 0 .46-.22.49-.49l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z",
      shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
      info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
      download: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"
    };
    const path = PATHS[name] || PATHS.home;
    return `
      <svg class="sidebar-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="${path}"/>
      </svg>
    `;
  }



  function _toggleAnimeWL() {
    const bg = document.getElementById("player-modal-bg");
    const item = bg?._currentAnimeItem;
    if (!item) return;
    const added = Watchlist.toggle(item);
    const btn = document.getElementById("pm-wl-btn");
    if (btn) {
      btn.className = `pm-wl-btn${added ? " added" : ""}`;
      btn.textContent = added ? "Saved" : "Watchlist";
    }
    const heroBtn = document.getElementById("pm-hero-wl-btn");
    if (heroBtn) {
      heroBtn.className = `pm-wl-action-btn${added ? " added" : ""}`;
      heroBtn.innerHTML = `${added ? _CHECK_SVG : _PLUS_SVG}<span>${added ? "In Watchlist" : "Add to List"}</span>`;
    }
    window.dispatchEvent(new CustomEvent("watchlist:change"));
  }

  let _currentEpisodesList = [];
  let _activeProvider = localStorage.getItem("streamx_anime_provider") || "server1";
  let _currentEpisodeSources = null;
  let _currentSupportedAudioModes = ["sub", "dub"];
  let _currentActiveAudioMode = localStorage.getItem("streamx_sub_dub") || "sub";
  let _hlsInstance = null;
  const _animeEpisodesCache = new Map();
  let _activeEpisodeId = null;
  let _activeEpisodeNumber = null;
  let _availableServers = ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];
  let _autoPlayEpisodeNumber = null;
  let _audioCtx = null;
  let _audioSource = null;
  let _gainNode = null;
  let _currentVolumeBoost = 1.0;
  let _theaterMode = false;

  function getBackendUrl() {
    return typeof getStreamXBackendUrl === "function" ? getStreamXBackendUrl() : "http://127.0.0.1:3000";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      if (isNaN(d.getTime())) return dateStr.split(" ")[0];
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch (e) {
      return dateStr;
    }
  }

  function _isEpisodeWatched(animeId, episodeId) {
    try {
      const watched = JSON.parse(localStorage.getItem("streamx_watched_episodes") || "{}");
      return watched[animeId]?.includes(episodeId) || false;
    } catch {
      return false;
    }
  }

  function _markEpisodeWatched(animeId, episodeId) {
    try {
      const watched = JSON.parse(localStorage.getItem("streamx_watched_episodes") || "{}");
      if (!watched[animeId]) watched[animeId] = [];
      if (!watched[animeId].includes(episodeId)) {
        watched[animeId].push(episodeId);
        localStorage.setItem("streamx_watched_episodes", JSON.stringify(watched));
      }
    } catch (e) {
      console.error("Failed to save watched progress:", e);
    }
  }

  function _getFilteredSortedAnimeEpisodes() {
    if (!_currentEpisodesList || !_currentEpisodesList.length) return [];
    let eps = [..._currentEpisodesList];

    // 1. Search Filter: episode number, title, or keywords
    const q = (_animeEpSearchQuery || "").trim().toLowerCase();
    if (q) {
      eps = eps.filter(ep => {
        const numStr = String(ep.episode_number ?? "");
        const titleStr = String(ep.title || "").toLowerCase();
        return numStr === q ||
               numStr.includes(q) ||
               titleStr.includes(q) ||
               `episode ${numStr}`.includes(q) ||
               `ep ${numStr}`.includes(q);
      });
    }

    // 2. Pure Numeric Sort (asc / desc)
    eps.sort((a, b) => {
      const numA = parseFloat(a.episode_number) || 0;
      const numB = parseFloat(b.episode_number) || 0;
      if (numA !== numB) {
        return _animeEpSortOrder === "desc" ? numB - numA : numA - numB;
      }
      return 0;
    });

    return eps;
  }

  function _renderEpisodesGrid(episodes, startIndex, endIndex) {
    const grid = document.getElementById("anime-eps-grid");
    if (!grid) return;

    const bg = document.getElementById("player-modal-bg");
    const animeId = bg?._currentAnimeItem?.id || "";
    const animePoster = bg?._currentAnimeItem?.backdrop || bg?._currentAnimeItem?.poster || "";

    const slice = episodes.slice(startIndex, endIndex);
    grid.innerHTML = slice.map(ep => {
      const isCurrentlyPlaying = ep.id === _activeEpisodeId;
      const isWatched = _isEpisodeWatched(animeId, ep.id);
      const epNum = ep.episode_number || 1;
      const epTitle = ep.title || `Episode ${epNum}`;
      const epThumb = ep.image || ep.thumbnail || ep.still_path || animePoster;
      const epDuration = ep.runtime || ep.duration ? `${ep.runtime || ep.duration}m` : "";

      return `
        <div class="anime-ep-card${isCurrentlyPlaying ? ' active' : ''}${isWatched ? ' watched' : ''}" 
             data-ep-id="${_esc(ep.id)}"
             id="anime-ep-card-${epNum}"
             role="button"
             tabindex="0"
             onclick="App.playAnimeEpisode('${_esc(ep.id)}', '${epNum}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();App.playAnimeEpisode('${_esc(ep.id)}', '${epNum}');}">
          <div class="anime-ep-thumb" style="background-image:url('${_esc(epThumb)}')">
            <div class="anime-ep-overlay">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span class="anime-ep-num-pill">EP ${epNum}</span>
            ${epDuration ? `<span class="anime-ep-dur-pill">${epDuration}</span>` : ""}
          </div>
          <div class="anime-ep-info">
            <span class="anime-ep-name" title="${_esc(epTitle)}">${_esc(epTitle)}</span>
            <div class="anime-ep-subline">
              <span class="anime-ep-badge-sub">SUB</span>
              <span class="anime-ep-badge-dub">DUB</span>
              ${isWatched ? '<span class="anime-ep-watched-tag">✓ Watched</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function _setupSeasonTabs(episodes) {
    const tabsContainer = document.getElementById("anime-season-tabs");
    if (!tabsContainer) return;

    tabsContainer.style.display = "flex";

    const chunkSize = 50;
    const numChunks = Math.ceil(episodes.length / chunkSize);

    let tabsHTML = '<div style="display:flex; gap:8px; overflow-x:auto;">';
    for (let i = 0; i < numChunks; i++) {
      const slice = episodes.slice(i * chunkSize, Math.min((i + 1) * chunkSize, episodes.length));
      const firstEpNum = slice[0]?.episode_number ?? (i * chunkSize + 1);
      const lastEpNum = slice[slice.length - 1]?.episode_number ?? Math.min((i + 1) * chunkSize, episodes.length);
      tabsHTML += `
        <button class="anime-season-tab ${i === 0 ? 'active' : ''}" data-index="${i}">
          EP ${firstEpNum} - ${lastEpNum}
        </button>
      `;
    }
    tabsHTML += '</div>';

    // Add Jump Input
    tabsHTML += `
      <input type="number" id="anime-jump-input" placeholder="Jump to EP..." class="anime-jump-input" min="1" max="${episodes.length}">
    `;

    tabsContainer.innerHTML = tabsHTML;

    // Bind tab clicks
    tabsContainer.querySelectorAll(".anime-season-tab").forEach(tab => {
      tab.onclick = (e) => {
        tabsContainer.querySelectorAll(".anime-season-tab").forEach(t => t.classList.remove("active"));
        e.currentTarget.classList.add("active");

        const idx = parseInt(e.currentTarget.getAttribute("data-index"));
        _renderEpisodesGrid(episodes, idx * chunkSize, Math.min((idx + 1) * chunkSize, episodes.length));
      };
    });

    // Bind Jump Input search
    const jumpInput = document.getElementById("anime-jump-input");
    if (jumpInput) {
      jumpInput.oninput = (e) => {
        const val = parseFloat(e.target.value);
        if (!val || val < 1) return;

        const targetEp = episodes.find(ep => parseFloat(ep.episode_number) === val);
        if (targetEp) {
          const epIndex = episodes.indexOf(targetEp);
          const idx = Math.floor(epIndex / chunkSize);

          // Switch to corresponding tab
          tabsContainer.querySelectorAll(".anime-season-tab").forEach((t, i) => {
            t.classList.toggle("active", i === idx);
          });

          // Render corresponding grid
          _renderEpisodesGrid(episodes, idx * chunkSize, Math.min((idx + 1) * chunkSize, episodes.length));

          // Find the button and scroll to it
          setTimeout(() => {
            const btn = document.querySelector(`.anime-ep-btn[data-ep-id="${targetEp.id}"]`);
            if (btn) {
              btn.scrollIntoView({ behavior: "smooth", block: "center" });
              btn.focus();
              btn.style.outline = "2px solid var(--primary)";
              setTimeout(() => btn.style.outline = "", 1500);
            }
          }, 100);
        }
      };
    }

    _renderEpisodesGrid(episodes, 0, Math.min(chunkSize, episodes.length));
  }

  function _renderAnimeEpisodesList() {
    const grid = document.getElementById("anime-eps-grid");
    const tabsContainer = document.getElementById("anime-season-tabs");
    if (!grid) return;

    const filtered = _getFilteredSortedAnimeEpisodes();
    const bg = document.getElementById("player-modal-bg");
    const animeId = bg?._currentAnimeItem?.id || "";

    if (filtered.length === 0) {
      if (tabsContainer) tabsContainer.style.display = "none";
      grid.innerHTML = `
        <div class="pm-episodes-empty" style="grid-column: 1 / -1; width: 100%; text-align: center; padding: 36px 16px; color: var(--text3);">
          <p style="margin:0; font-size: 15px;">No episodes found matching "<span style="color:var(--text); font-weight:600;">${_esc(_animeEpSearchQuery)}</span>"</p>
        </div>
      `;
      return;
    }

    if (_animeEpSearchQuery.trim()) {
      if (tabsContainer) tabsContainer.style.display = "none";
      _renderEpisodesGrid(filtered, 0, filtered.length);
      return;
    }

    if (filtered.length > 50) {
      if (tabsContainer) {
        tabsContainer.style.display = "flex";
        _setupSeasonTabs(filtered);
      }
    } else {
      if (tabsContainer) tabsContainer.style.display = "none";
      _renderEpisodesGrid(filtered, 0, filtered.length);
    }
  }

  function setAnimeAudioMode(mode) {
    if (!mode) return;
    const m = mode.toLowerCase();
    _currentActiveAudioMode = m;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("streamx_sub_dub", m);
    }
    document.querySelectorAll(".anime-audio-seg-btn").forEach(btn => {
      const isTarget = btn.textContent.toLowerCase().includes(m);
      btn.classList.toggle("active", isTarget);
    });
    switchAudio(m);
    _showToast(`Anime audio switched to ${m.toUpperCase()}`);
  }

  function onAnimeEpisodeSearch(query) {
    _animeEpSearchQuery = query || "";
    const clearBtn = document.getElementById("anime-ep-search-clear");
    if (clearBtn) {
      clearBtn.style.display = _animeEpSearchQuery.trim() ? "flex" : "none";
    }
    _renderAnimeEpisodesList();
  }

  function clearAnimeEpisodeSearch() {
    _animeEpSearchQuery = "";
    const input = document.getElementById("anime-ep-search-input");
    if (input) {
      input.value = "";
      input.focus();
    }
    const clearBtn = document.getElementById("anime-ep-search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    _renderAnimeEpisodesList();
  }

  function toggleAnimeSortOrder() {
    _animeEpSortOrder = _animeEpSortOrder === "asc" ? "desc" : "asc";
    const btn = document.getElementById("anime-ep-sort-btn");
    const label = document.getElementById("anime-ep-sort-label");
    if (btn) btn.classList.toggle("desc", _animeEpSortOrder === "desc");
    if (label) label.textContent = _animeEpSortOrder === "asc" ? "Ascending" : "Descending";
    _renderAnimeEpisodesList();
  }

  function _updateCurrentlyPlayingUI() {
    const bg = document.getElementById("player-modal-bg");
    const animeId = bg?._currentAnimeItem?.id || "";

    document.querySelectorAll(".anime-ep-btn").forEach(btn => {
      const epId = btn.getAttribute("data-ep-id");
      if (epId === _activeEpisodeId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }

      if (_isEpisodeWatched(animeId, epId)) {
        btn.classList.add("watched");
      } else {
        btn.classList.remove("watched");
      }
    });
  }

  function _scrollToLastWatched(animeId, backdropFallback) {
    const last = StreamXHistory.getLastEpisode(animeId);
    if (last && last.episode) {
      const lastWatchedEpNum = last.episode;
      const lastEp = _currentEpisodesList.find(e => e.episode_number === lastWatchedEpNum);
      if (lastEp) {
        const idx = Math.floor((lastWatchedEpNum - 1) / 50);
        const tabsContainer = document.getElementById("anime-season-tabs");
        if (tabsContainer) {
          tabsContainer.querySelectorAll(".anime-season-tab").forEach((t, i) => {
            t.classList.toggle("active", i === idx);
          });
        }
        _renderEpisodesGrid(_currentEpisodesList, idx * 50, Math.min((idx + 1) * 50, _currentEpisodesList.length), backdropFallback);
        setTimeout(() => {
          const btn = document.querySelector(`.anime-ep-btn[data-ep-id="${lastEp.id}"]`);
          if (btn) {
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);
      }
    }
  }

  async function _fetchAnimeEpisodes(animeId, provider = null) {
    console.log(">>> Requested provider (frontend _fetchAnimeEpisodes):", provider);
    const loader = document.getElementById("anime-eps-loader");
    const grid = document.getElementById("anime-eps-grid");
    if (!grid) return;

    const bg = document.getElementById("player-modal-bg");
    const itemDetails = bg ? bg._currentAnimeItem : null;
    const backdropFallback = itemDetails ? (itemDetails.backdrop || itemDetails.poster) : "";

    const cacheKey = `${animeId}-${provider || 'default'}`;
    if (_animeEpisodesCache.has(cacheKey)) {
      console.log(`[Frontend Cache] Reusing cached episodes list for key ${cacheKey}`);
      const cached = _animeEpisodesCache.get(cacheKey);
      _currentEpisodesList = cached.episodes || [];
      if (provider) {
        _activeProvider = provider;
      } else if (cached.provider) {
        _activeProvider = cached.provider;
      }
      _availableServers = cached.availableServers || ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];

      if (loader) loader.style.display = "none";
      _renderAnimeEpisodesList();
      _updateCurrentlyPlayingUI();
      _scrollToLastWatched(animeId, backdropFallback);

      if (_autoPlayEpisodeNumber !== null) {
        const ep = _currentEpisodesList.find(e => e.episode_number === _autoPlayEpisodeNumber);
        _autoPlayEpisodeNumber = null;
        if (ep) {
          playAnimeEpisode(ep.id, ep.episode_number);
        } else if (_currentEpisodesList.length > 0) {
          playAnimeEpisode(_currentEpisodesList[0].id, _currentEpisodesList[0].episode_number);
        }
      } else if (_activeEpisodeNumber !== null) {
        const ep = _currentEpisodesList.find(e => e.episode_number === _activeEpisodeNumber);
        if (ep) {
          playAnimeEpisode(ep.id, ep.episode_number);
        }
      }
      return;
    }

    if (loader) loader.style.display = "block";
    grid.innerHTML = "";

    try {
      let backendUrl = getBackendUrl();
      const targetProvider = provider || _activeProvider || "server1";
      const url = new URL(`${backendUrl}/api/anime/episodes/${animeId}`);
      if (targetProvider) {
        url.searchParams.set("provider", targetProvider);
      }

      let data = null;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) data = await res.json();
      } catch (fetchErr) {
        console.warn(`[Anime Episodes] Primary fetch to ${url} failed (${fetchErr.message}). Trying failover...`);
        const altBase = window.handleBackendFailover ? window.handleBackendFailover(backendUrl) : null;
        if (altBase && altBase !== backendUrl) {
          try {
            const altUrl = new URL(`${altBase}/api/anime/episodes/${animeId}`);
            if (targetProvider) altUrl.searchParams.set("provider", targetProvider);
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 7000);
            const res = await fetch(altUrl, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) data = await res.json();
          } catch (altErr) {
            console.warn("[Anime Episodes] Failover backend also failed:", altErr.message);
          }
        }
      }

      if (!data) throw new Error("Could not connect to anime episode service. Please check your connection or choose another server.");

      _currentEpisodesList = data.episodes || [];
      if (provider) {
        _activeProvider = provider;
      } else if (data.provider) {
        _activeProvider = data.provider;
      }
      _availableServers = data.availableServers || ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];

      const resolvedCacheKey = `${animeId}-${_activeProvider || 'default'}`;
      _animeEpisodesCache.set(resolvedCacheKey, {
        episodes: _currentEpisodesList,
        provider: _activeProvider,
        availableServers: _availableServers
      });

      if (loader) loader.style.display = "none";

      if (_currentEpisodesList.length === 0) {
        const activeLabel = _serverLabel(_activeProvider || 'none');
        grid.innerHTML = `<p style="color:var(--text3); font-size:12px; grid-column: 1/-1; text-align: center;">No episodes found on ${_esc(activeLabel)}. Try another server below.</p>`;

        const playerWrap = document.getElementById("anime-player-wrap");
        const controlsWrap = document.getElementById("anime-player-controls");
        if (playerWrap) playerWrap.style.display = "none";
        if (controlsWrap) {
          controlsWrap.style.display = "block";
          _renderPlayerControls({ sources: [], subtitles: [] });
        }
        return;
      }

      _renderAnimeEpisodesList();
      _updateCurrentlyPlayingUI();
      _scrollToLastWatched(animeId, backdropFallback);

      if (_autoPlayEpisodeNumber !== null) {
        const ep = _currentEpisodesList.find(e => e.episode_number === _autoPlayEpisodeNumber);
        _autoPlayEpisodeNumber = null;
        if (ep) {
          playAnimeEpisode(ep.id, ep.episode_number);
        } else if (_currentEpisodesList.length > 0) {
          playAnimeEpisode(_currentEpisodesList[0].id, _currentEpisodesList[0].episode_number);
        }
      } else if (_activeEpisodeNumber !== null) {
        const ep = _currentEpisodesList.find(e => e.episode_number === _activeEpisodeNumber);
        if (ep) {
          playAnimeEpisode(ep.id, ep.episode_number);
        }
      }
    } catch (err) {
      console.error("Failed to fetch anime episodes:", err);
      if (loader) loader.style.display = "none";
      grid.innerHTML = `<p style="color:var(--text3); font-size:12px; grid-column: 1/-1; text-align: center;">Failed to load episodes. Error: ${err.message}</p>`;

      const controlsWrap = document.getElementById("anime-player-controls");
      if (controlsWrap) {
        controlsWrap.style.display = "block";
        _renderPlayerControls({ sources: [], subtitles: [] });
      }
    }
  }

  // ── ZokoAnime Security & Message Adapter ────────────────────────────────
  const ZokoAnimeMessageAdapter = {
    origin: "https://zokoanime.video",
    channel: "zokoanime",

    validate(event, iframe) {
      if (!iframe || !iframe.contentWindow) return false;
      if (event.source !== iframe.contentWindow) return false;
      if (event.origin !== this.origin) return false;
      if (!event.data || typeof event.data !== "object") return false;
      if (event.data.channel !== this.channel) return false;
      if (!event.data.type || typeof event.data.type !== "string") return false;
      return true;
    },

    normalize(data) {
      const type = (data.type || "").toLowerCase();
      switch (type) {
        case "ready":
          return { type: "PLAYER_READY" };
        case "play":
          return { type: "PLAYER_PLAY" };
        case "pause":
          return { type: "PLAYER_PAUSE" };
        case "time":
        case "progress":
          return {
            type: "PLAYER_PROGRESS",
            currentTime: Number(data.currentTime || data.time || data.progress || 0),
            duration: Number(data.duration || 0)
          };
        case "seek":
        case "seeked":
          return {
            type: "PLAYER_SEEK",
            currentTime: Number(data.currentTime || data.time || 0)
          };
        case "ended":
        case "complete":
          return { type: "PLAYER_ENDED" };
        case "error":
          return { type: "PLAYER_ERROR", message: data.message || "Player error" };
        case "skip_intro":
          return { type: "PLAYER_SKIP_INTRO" };
        case "skip_outro":
          return { type: "PLAYER_SKIP_OUTRO" };
        case "audio_changed":
          return { type: "PLAYER_AUDIO_CHANGED", audio: data.audio };
        case "subtitle_changed":
          return { type: "PLAYER_SUBTITLE_CHANGED", subtitle: data.subtitle };
        default:
          return { type: `PLAYER_${type.toUpperCase()}`, raw: data };
      }
    },

    sendCommand(iframe, command, params = {}) {
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage({
        channel: this.channel,
        command,
        ...params
      }, this.origin);
    }
  };

  // ── Global PostMessage Listener for Embed Players ───────────────────────
  function handleWindowMessage(event) {
    const iframe = document.getElementById("anime-iframe-player");
    if (!iframe || iframe.style.display === "none" || iframe.classList.contains("player-hidden")) return;

    // 1. ZokoAnime Message Validation & Dispatch
    if (ZokoAnimeMessageAdapter.validate(event, iframe)) {
      const norm = ZokoAnimeMessageAdapter.normalize(event.data);
      console.log("[ZokoAnime] Received normalized event:", norm.type, norm);

      if (norm.type === "PLAYER_READY") {
        const bg = document.getElementById("player-modal-bg");
        const animeId = bg ? bg._currentAnimeItem?.id : null;
        if (animeId) {
          const history = StreamXHistory.getLastEpisode(animeId, _currentActiveAudioMode);
          if (history && history.episode === _activeEpisodeNumber && history.progress > 5) {
            console.log(`[ZokoAnime] Sending resume seek command to ${history.progress}s`);
            ZokoAnimeMessageAdapter.sendCommand(iframe, "seek", { time: history.progress });
          }
        }
      } else if (norm.type === "PLAYER_PROGRESS") {
        const bg = document.getElementById("player-modal-bg");
        const animeId = bg ? bg._currentAnimeItem?.id : null;
        if (animeId && norm.duration > 0) {
          StreamXHistory.updateProgress(animeId, "anime", norm.currentTime, norm.duration, null, _activeEpisodeNumber, _activeProvider, _currentActiveAudioMode);
        }
      } else if (norm.type === "PLAYER_ENDED") {
        const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
        if (autoNextPref) {
          console.log("[ZokoAnime] Video ended. Showing auto-next countdown...");
          showAutoNextCountdown();
        }
      } else if (norm.type === "PLAYER_ERROR") {
        console.warn("[ZokoAnime] Received player error event:", norm.message);
        handlePlaybackFailure();
      }
      return;
    }

    // 2. MegaVid (channel: "kisskh") & Other Embed Providers
    if (event.source === iframe.contentWindow || event.origin === "https://megavid.buzz") {
      let data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (e) {}
      }

      if (data && typeof data === "object") {
        if (data.channel === "kisskh") {
          console.log("[MegaVid] Received event:", data.event, data);
          if (data.event === "complete") {
            const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
            if (autoNextPref) showAutoNextCountdown();
          } else if (data.event === "time" || data.event === "progress") {
            const bg = document.getElementById("player-modal-bg");
            const animeId = bg ? bg._currentAnimeItem?.id : null;
            if (animeId && data.currentTime) {
              StreamXHistory.updateProgress(animeId, "anime", Number(data.currentTime), Number(data.duration || 0), null, _activeEpisodeNumber, _activeProvider, _currentActiveAudioMode);
            }
          } else if (data.event === "error") {
            console.warn("[MegaVid] Playback error event received");
            handlePlaybackFailure();
          }
          return;
        }

        if (data.type === "watching-log") {
          const bg = document.getElementById("player-modal-bg");
          const animeId = bg ? bg._currentAnimeItem?.id : null;
          if (animeId && data.currentTime) {
            StreamXHistory.updateProgress(animeId, "anime", Number(data.currentTime), Number(data.duration || 0), null, _activeEpisodeNumber, _activeProvider, _currentActiveAudioMode);
          }
          return;
        }

        // VidSync postMessage handling
        if (data.type === "VIDSYNC_READY" || (event.origin === "https://vidsync.pro" && (data.type === "ready" || data.event === "ready"))) {
          console.log("[VidSync] Player is ready");
          return;
        }
        if (data.type === "VIDSYNC_ERROR" || (event.origin === "https://vidsync.pro" && (data.type === "error" || data.event === "error"))) {
          console.warn("[VidSync] Playback error received:", data);
          handlePlaybackFailure();
          return;
        }

        if (data.type === "complete" || data.type === "ended" || data.event === "ended" || data.event === "complete") {
          const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
          if (autoNextPref) showAutoNextCountdown();
        } else if ((data.type === "time" || data.type === "timeupdate" || data.event === "timeupdate") && (data.data || data.currentTime)) {
          const bg = document.getElementById("player-modal-bg");
          const animeId = bg ? bg._currentAnimeItem?.id : null;
          const cur = Number(data.currentTime || data.data?.currentTime || 0);
          const dur = Number(data.duration || data.data?.duration || 0);
          if (animeId && dur > 0) {
            StreamXHistory.updateProgress(animeId, "anime", cur, dur, null, _activeEpisodeNumber, _activeProvider, _currentActiveAudioMode);
            if (cur >= dur - 2 && dur > 30) {
              const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
              if (autoNextPref && !autoNextInterval) showAutoNextCountdown();
            }
          }
        }
      } else if (typeof event.data === "string" && (event.data === "ended" || event.data === "complete" || event.data.includes("ended") || event.data.includes("complete"))) {
        const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
        if (autoNextPref) showAutoNextCountdown();
      }
    }
  }

  window.addEventListener("message", handleWindowMessage);

  function handlePlaybackFailure() {
    console.warn(`[Player] Playback failed for ${_activeProvider}.`);
    const controlsWrap = document.getElementById("anime-player-controls");
    if (controlsWrap) {
      controlsWrap.innerHTML = `
        <div style="text-align:center; padding:16px; color:var(--text2); font-size:13px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; margin:10px 0;">
          <p style="color:var(--primary); font-weight:600; margin-bottom:6px; font-size:14px;">Playback issue on ${_esc(_serverLabel(_activeProvider))}</p>
          <p style="margin-bottom:12px; font-size:12px; color:var(--text3);">The stream could not be loaded on ${_esc(_serverLabel(_activeProvider))}. You can retry or choose another server below.</p>
          <div style="display:flex; justify-content:center; gap:10px; margin-bottom:12px;">
            <button class="anime-ctrl-btn active" onclick="App.retryCurrentEpisode()">🔄 Retry</button>
          </div>
          <div class="anime-ctrl-row" style="justify-content:center; margin-top:8px;">
            <div class="anime-ctrl-label">Choose Server:</div>
            <div class="anime-ctrl-options">
              ${(_availableServers || ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"]).map(srv => `
                <button class="anime-ctrl-btn ${srv === _activeProvider ? 'active' : ''}" onclick="App.switchProvider('${srv}')">${_serverLabel(srv)}</button>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }
  }

  function _isAnimeServerUnsandboxed(provKey) {
    if (!provKey) return true; // Default server1 is unsandboxed
    const raw = String(provKey).toLowerCase().trim();
    // Servers 1, 4, 5, 6, 7, 9 have sandbox removed
    const unsandboxedIds = new Set(["1", "4", "5", "6", "7", "9"]);
    if (unsandboxedIds.has(raw)) return true;

    const sMatch = raw.match(/^server\s*(\d+)$/i);
    if (sMatch && unsandboxedIds.has(sMatch[1])) return true;

    const aliasMap = {
      anikoto: "1",
      megavid: "2",
      vidcloud: "3",
      zokoanime: "4",
      anixo: "5",
      vidnest: "6",
      vidsync: "7",
      anilink: "7",
      aniembed: "8",
      vidbolt: "9"
    };
    if (aliasMap[raw] && unsandboxedIds.has(aliasMap[raw])) return true;

    try {
      if (typeof _serverLabel === "function") {
        const lbl = _serverLabel(raw);
        const lMatch = String(lbl).match(/Server\s*(\d+)/i);
        if (lMatch && unsandboxedIds.has(lMatch[1])) return true;
      }
    } catch (_) {}

    return false;
  }

  function _setAnimePlayerMode(mode, embedUrl = null, server = null) {
    const video = document.getElementById("anime-video-player");
    let iframe = document.getElementById("anime-iframe-player");

    if (mode === "embed") {
      if (video) {
        video.pause();
        video.onerror = null;
        video.onloadedmetadata = null;
        video.src = "";
        if (video.load) video.load();
        video.classList.add("player-hidden");
        video.classList.remove("player-visible");
        video.style.setProperty("display", "none", "important");
      }
      if (iframe) {
        const parent = iframe.parentNode;
        const newIframe = document.createElement("iframe");
        for (const attr of iframe.attributes) {
          if (attr.name !== "src" && attr.name !== "sandbox" && attr.name !== "style" && attr.name !== "class") {
            newIframe.setAttribute(attr.name, attr.value);
          }
        }
        newIframe.id = "anime-iframe-player";
        const currentServer = server || _activeProvider || "server1";
        if (_isAnimeServerUnsandboxed(currentServer)) {
          newIframe.removeAttribute("sandbox");
          console.log(`[Anime Player] Sandbox DISABLED for server: ${currentServer}`);
        } else {
          newIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation");
          console.log(`[Anime Player] Sandbox ENABLED for server: ${currentServer}`);
        }
        newIframe.setAttribute("allowfullscreen", "true");
        newIframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen");
        newIframe.className = "player-visible";
        newIframe.style.cssText = "width:100%; height:100%; aspect-ratio:16/9; background:#000; border-radius:8px; border:0; display:block !important;";
        if (embedUrl) newIframe.src = embedUrl;
        parent.replaceChild(newIframe, iframe);
      }
    } else if (mode === "video") {
      if (iframe) {
        const parent = iframe.parentNode;
        const newIframe = document.createElement("iframe");
        for (const attr of iframe.attributes) {
          if (attr.name !== "src" && attr.name !== "sandbox" && attr.name !== "style" && attr.name !== "class") {
            newIframe.setAttribute(attr.name, attr.value);
          }
        }
        newIframe.id = "anime-iframe-player";
        newIframe.className = "player-hidden";
        newIframe.style.cssText = "display:none !important;";
        newIframe.src = "";
        parent.replaceChild(newIframe, iframe);
      }
      if (video) {
        video.classList.remove("player-hidden");
        video.classList.add("player-visible");
        video.style.setProperty("display", "block", "important");
      }
    } else {
      // mode === "none" / initial reset
      if (video) {
        video.pause();
        video.onerror = null;
        video.onloadedmetadata = null;
        video.src = "";
        if (video.load) video.load();
        video.classList.add("player-hidden");
        video.classList.remove("player-visible");
        video.style.setProperty("display", "none", "important");
      }
      if (iframe) {
        iframe.src = "";
        iframe.classList.add("player-hidden");
        iframe.classList.remove("player-visible");
        iframe.style.setProperty("display", "none", "important");
      }
    }
  }

  async function playAnimeEpisode(episodeId, episodeNumber, audioOverride = null) {
    console.log(">>> Playing anime episode:", episodeId, "Episode Number:", episodeNumber, "Active Provider in memory:", _activeProvider);

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.silenceAll();
      window.HeroTrailerController.pause("detail");
    }

    _activeEpisodeId = episodeId;
    _activeEpisodeNumber = parseInt(episodeNumber);
    _updateCurrentlyPlayingUI();

    const bg = document.getElementById("player-modal-bg");
    const item = bg ? bg._currentAnimeItem : null;
    const animeId = item ? item.id : "";

    const playerWrap = document.getElementById("anime-player-wrap");
    const controlsWrap = document.getElementById("anime-player-controls");
    const video = document.getElementById("anime-video-player");
    const iframe = document.getElementById("anime-iframe-player");

    if (!playerWrap || !controlsWrap || !video) return;

    playerWrap.style.display = "block";
    playerWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    controlsWrap.style.display = "block";
    controlsWrap.innerHTML = `<div class="loader-spinner"></div>`;

    _setAnimePlayerMode("none");

    if (_hlsInstance) {
      _hlsInstance.destroy();
      _hlsInstance = null;
    }

    try {
      const backendUrl = getBackendUrl();
      const targetServer = _activeProvider || "server1";

      // 1. Determine requested audio
      let requestedAudio = (audioOverride || localStorage.getItem("streamx_sub_dub") || "sub").toLowerCase();

      // Check last watched position for resume
      const lastWatch = StreamXHistory.getLastEpisode(animeId, requestedAudio);
      const resumePref = localStorage.getItem("streamx_resume_playback") !== "false";
      const startPos = (resumePref && lastWatch && lastWatch.episode === _activeEpisodeNumber && lastWatch.progress > 5)
        ? Math.floor(lastWatch.progress)
        : 0;

      // 2. Fetch sources from backend
      const url = `${backendUrl}/api/anime/sources/${encodeURIComponent(episodeId)}?provider=${targetServer}&animeId=${animeId}&episodeNumber=${_activeEpisodeNumber}&type=${requestedAudio}&start=${startPos}`;
      console.log(">>> Requesting episode sources from:", url);

      let data = null;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) data = await res.json();
      } catch (srcErr) {
        console.warn(`[Sources] Primary fetch to ${url} failed (${srcErr.message}). Trying failover...`);
        const altBase = window.handleBackendFailover ? window.handleBackendFailover(backendUrl) : null;
        if (altBase && altBase !== backendUrl) {
          try {
            const altUrl = `${altBase}/api/anime/sources/${encodeURIComponent(episodeId)}?provider=${targetServer}&animeId=${animeId}&episodeNumber=${_activeEpisodeNumber}&type=${requestedAudio}&start=${startPos}`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 7000);
            const res = await fetch(altUrl, { signal: ctrl.signal });
            clearTimeout(t);
            if (res.ok) data = await res.json();
          } catch (altErr) {
            console.warn("[Sources] Failover backend also failed:", altErr.message);
          }
        }
      }

      if (!data || data.success === false) {
        throw new Error((data && data.error) || "No streaming sources resolved");
      }

      // 3. Update active provider and capabilities
      if (data.provider && !_activeProvider) {
        _activeProvider = data.provider;
        localStorage.setItem("streamx_anime_provider", _activeProvider);
      }

      _currentSupportedAudioModes = data.supportedAudioModes || (data.sources?.some(s => s.quality === "DUB") ? ["sub", "dub"] : ["sub"]);
      
      // If requested audio is not supported by this provider, switch to first supported audio mode
      if (!_currentSupportedAudioModes.includes(requestedAudio)) {
        requestedAudio = _currentSupportedAudioModes[0] || "sub";
      }
      _currentActiveAudioMode = requestedAudio;
      localStorage.setItem("streamx_sub_dub", requestedAudio);

      _currentEpisodeSources = data;

      // Record in Continue Watching / History
      if (item) {
        StreamXHistory.recordWatch(item, null, _activeEpisodeNumber, _activeProvider, requestedAudio);
        _markEpisodeWatched(item.id, episodeId);
        _updateCurrentlyPlayingUI();
      }

      // Close helper overlays on episode load
      const helpOverlay = document.getElementById("anime-help-overlay");
      if (helpOverlay) helpOverlay.style.display = "none";
      const epDrawer = document.getElementById("anime-mini-episodes-drawer");
      if (epDrawer) {
        epDrawer.style.transform = "translateX(100%)";
        setTimeout(() => { epDrawer.style.display = "none"; }, 300);
      }

      // Update bottom player bar with current episode state
      const bottomBar = document.getElementById("anime-player-bottom-bar");
      if (bottomBar) {
        bottomBar.style.display = "flex";
        const epBadge = document.getElementById("anime-current-ep-badge");
        if (epBadge) epBadge.textContent = `Episode ${_activeEpisodeNumber}`;
        const autoNextCb = document.getElementById("anime-auto-next-cb");
        if (autoNextCb) autoNextCb.checked = (localStorage.getItem("streamx_auto_next") !== "false");
        _updatePrevNextEpisodeButtons(episodeId, _activeEpisodeNumber);
      }

      // 4. Handle EMBED vs DIRECT SOURCE
      if (data.type === "embed") {
        // Embed Provider (Servers 2-9, or Server 1 embed)
        const embedUrl = data.embedUrl || (data.sources && data.sources[0]?.url);
        console.log(">>> Loading embed iframe URL:", embedUrl);
        _setAnimePlayerMode("embed", embedUrl, _activeProvider || targetServer || data.provider);
        _renderPlayerControls(data, null);
      } else {
        // Direct Source / HLS Provider (Server 2 MegaVid, Server 1 Anikoto)
        let selectedSource = null;
        if (Array.isArray(data.sources) && data.sources.length > 0) {
          // If Server 1 returns multiple sources (SUB / DUB)
          const matched = data.sources.find(s => s.quality?.toLowerCase() === requestedAudio || s.audio?.toLowerCase() === requestedAudio);
          selectedSource = matched || data.sources[0];
        }

        if (!selectedSource || !selectedSource.url) {
          throw new Error("No playable video source found");
        }

        _renderPlayerControls(data, selectedSource);
        _playSource(selectedSource.url, selectedSource);
      }
    } catch (err) {
      console.error("Failed to play anime episode:", err);
      controlsWrap.innerHTML = `<p style="color:var(--primary); font-size:12px; text-align:center;">Failed to load stream on ${_esc(_serverLabel(_activeProvider))}: ${_esc(err.message)}.</p>`;
      setTimeout(() => {
        handlePlaybackFailure();
      }, 1500);
    }
  }

  function _renderPlayerControls(data, activeSource = null) {
    const controlsWrap = document.getElementById("anime-player-controls");
    if (!controlsWrap) return;

    const isEmbed = data && data.type === "embed";
    const sources = (data && data.sources) || [];
    const subtitles = (data && data.subtitles) || [];

    // 1. Server Selector Buttons
    const providerList = _availableServers || ["server1", "server2", "server3", "server4", "server5", "server6", "server7", "server8", "server9"];
    const providerOptions = providerList.map(prov => {
      const serverLabel = _serverLabel(prov);
      return `
        <button class="anime-ctrl-btn ${prov === _activeProvider ? 'active' : ''}" onclick="App.switchProvider('${prov}')">
          ${serverLabel}
        </button>
      `;
    }).join("");

    // 2. Audio Selector Buttons (strictly based on _currentSupportedAudioModes)
    const supportedModes = _currentSupportedAudioModes || ["sub", "dub"];
    const audioButtons = supportedModes.map(mode => {
      const modeLower = mode.toLowerCase();
      const modeDisplay = modeLower === "hsub" ? "H-SUB" : mode.toUpperCase();
      const isActive = (_currentActiveAudioMode || "sub").toLowerCase() === modeLower;
      return `
        <button class="anime-ctrl-btn ${isActive ? 'active' : ''}" onclick="App.switchAudio('${modeLower}')">
          ${modeDisplay}
        </button>
      `;
    }).join("");

    const activeAudioLabel = (_currentActiveAudioMode === "hsub" ? "H-SUB" : (_currentActiveAudioMode || "SUB")).toUpperCase();
    const audioBadge = `<span class="badge" style="background:linear-gradient(135deg, #00f2fe 0%, #0284c7 100%); color:#04121a; font-size:11px; margin-left:8px; font-weight:700; border:1px solid rgba(255,255,255,0.25);">AUDIO: ${activeAudioLabel}</span>`;
    const serverBadge = `<span class="badge" style="background:linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color:#fff; font-size:11px; margin-left:8px; font-weight:700; border:1px solid rgba(255,255,255,0.25);">SERVER: ${_serverLabel(_activeProvider)}</span>`;

    // 3. Direct Source Quality Buttons (if non-embed and multiple qualities exist)
    let qualityButtons = "";
    if (!isEmbed && sources.length > 1) {
      qualityButtons = sources.map((src, index) => {
        let isDefaultActive = false;
        if (activeSource) {
          isDefaultActive = src.url === activeSource.url;
        } else if (index === 0) {
          isDefaultActive = true;
        }
        const activeClass = isDefaultActive ? 'active' : '';
        return `
          <button class="anime-ctrl-btn ${activeClass}" onclick="App.switchQuality(event, '${_esc(src.url)}', '${_esc(src.quality)}')">
            ${_esc(src.quality || 'Auto')}
          </button>
        `;
      }).join("");
    }

    controlsWrap.innerHTML = `
      <div class="anime-ctrl-row">
        <div class="anime-ctrl-label" style="display:flex; align-items:center;">Server ${serverBadge} ${audioBadge}</div>
        <div class="anime-ctrl-options">
          ${providerOptions}
        </div>
      </div>

      <div class="anime-ctrl-row">
        <div class="anime-ctrl-label">Audio Track</div>
        <div class="anime-ctrl-options">
          ${audioButtons}
        </div>
      </div>

      ${qualityButtons ? `
      <div class="anime-ctrl-row">
        <div class="anime-ctrl-label">Source Quality</div>
        <div class="anime-ctrl-options">
          ${qualityButtons}
        </div>
      </div>
      ` : ""}

      ${subtitles.length > 0 ? `
      <div class="anime-ctrl-row">
        <div class="anime-ctrl-label">Available Subtitles</div>
        <div class="anime-ctrl-options">
          ${subtitles.map(sub => `
            <span class="anime-ctrl-btn" style="cursor:default;">${_esc(sub.lang || sub.label || 'en')}</span>
          `).join("")}
        </div>
      </div>
      ` : ""}
    `;
  }

  function _renderHlsQualityControls(hls) {
    const wrap = document.getElementById("hls-quality-controls-wrap");
    if (!wrap) return;

    const levels = hls.levels || [];
    let buttonsHTML = `
      <div class="anime-ctrl-row">
        <div class="anime-ctrl-label">Quality</div>
        <div class="anime-ctrl-options">
          <button class="anime-ctrl-btn active" id="hls-qual-btn-auto" onclick="App.setHlsLevel(-1)">Auto</button>
    `;

    levels.forEach((level, index) => {
      const height = level.height || "";
      const label = height ? `${height}p` : `Level ${index}`;
      buttonsHTML += `
        <button class="anime-ctrl-btn" id="hls-qual-btn-${index}" onclick="App.setHlsLevel(${index})">${label}</button>
      `;
    });

    buttonsHTML += `
        </div>
      </div>
    `;
    wrap.innerHTML = buttonsHTML;
  }

  function setHlsLevel(levelIndex) {
    if (!_hlsInstance) return;
    _hlsInstance.currentLevel = levelIndex;

    const wrap = document.getElementById("hls-quality-controls-wrap");
    if (wrap) {
      wrap.querySelectorAll(".anime-ctrl-btn").forEach(btn => {
        btn.classList.remove("active");
      });
      if (levelIndex === -1) {
        document.getElementById("hls-qual-btn-auto")?.classList.add("active");
      } else {
        document.getElementById(`hls-qual-btn-${levelIndex}`)?.classList.add("active");
      }
    }
  }

  function setPlaybackSpeed(event, speed) {
    const video = document.getElementById("anime-video-player");
    if (video) video.playbackRate = speed;
    localStorage.setItem("streamx_playback_rate", speed);

    const targetBtn = (event && event.currentTarget) || (event && event.target && event.target.closest(".anime-ctrl-btn"));
    if (targetBtn) {
      targetBtn.parentNode.querySelectorAll(".anime-ctrl-btn").forEach(btn => {
        btn.classList.remove("active");
      });
      targetBtn.classList.add("active");
    }
  }

  function skipIntro() {
    const video = document.getElementById("anime-video-player");
    if (video) video.currentTime = 90;
  }

  function skipOutro() {
    const video = document.getElementById("anime-video-player");
    if (video) {
      video.currentTime = video.duration - 10;
    }
  }

  let autoNextInterval = null;

  function showAutoNextCountdown() {
    if (!_currentEpisodesList || !_currentEpisodesList.length) return;
    const currentIdx = _currentEpisodesList.findIndex(e =>
      String(e.id) === String(_activeEpisodeId) ||
      Number(e.episode_number) === Number(_activeEpisodeNumber)
    );
    if (currentIdx === -1 || currentIdx + 1 >= _currentEpisodesList.length) {
      console.log("No next episode for auto-next.", { _activeEpisodeId, _activeEpisodeNumber });
      return;
    }

    const nextEp = _currentEpisodesList[currentIdx + 1];
    cancelAutoNext();

    const playerWrap = document.getElementById("anime-player-wrap");
    if (!playerWrap) return;

    let countdownOverlay = document.getElementById("auto-next-countdown-overlay");
    if (!countdownOverlay) {
      countdownOverlay = document.createElement("div");
      countdownOverlay.id = "auto-next-countdown-overlay";
      countdownOverlay.style = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 20;
        border-radius: 8px;
        color: #fff;
        font-family: var(--font-sans);
      `;
      playerWrap.appendChild(countdownOverlay);
    }

    countdownOverlay.style.display = "flex";

    let secondsLeft = 5;
    const updateCountdownUI = () => {
      countdownOverlay.innerHTML = `
        <h3 style="margin-bottom: 8px; font-size: 20px; font-weight: 600;">Next Episode: Episode ${nextEp.episode_number}</h3>
        <p style="margin-bottom: 20px; color: var(--text3); font-size: 14px;">Playing in <span style="color: var(--primary); font-weight: bold; font-size: 16px;">${secondsLeft}</span> seconds...</p>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary" onclick="App.playNextEpisode()" style="padding: 8px 18px; font-size: 13px; cursor: pointer; border-radius: 6px;">Play Now</button>
          <button class="btn-secondary" onclick="App.cancelAutoNext()" style="padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff;">Cancel</button>
        </div>
      `;
    };

    updateCountdownUI();

    autoNextInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(autoNextInterval);
        autoNextInterval = null;
        countdownOverlay.style.display = "none";
        playNextEpisode();
      } else {
        updateCountdownUI();
      }
    }, 1000);
  }

  function cancelAutoNext() {
    if (autoNextInterval) {
      clearInterval(autoNextInterval);
      autoNextInterval = null;
    }
    const countdownOverlay = document.getElementById("auto-next-countdown-overlay");
    if (countdownOverlay) {
      countdownOverlay.style.display = "none";
    }
  }

  function toggleAnimeAutoNext(checked) {
    localStorage.setItem("streamx_auto_next", checked ? "true" : "false");
    const settingsCb = document.getElementById("pref-auto-next");
    if (settingsCb) settingsCb.checked = checked;
    const playerCb = document.getElementById("anime-auto-next-cb");
    if (playerCb) playerCb.checked = checked;
    _showToast(checked ? "⚡ Auto-Next Enabled" : "⏸ Auto-Next Disabled");
  }

  function _updatePrevNextEpisodeButtons(episodeId, episodeNumber) {
    const nextBtn = document.getElementById("anime-next-ep-btn");
    const prevBtn = document.getElementById("anime-prev-ep-btn");
    if (!_currentEpisodesList || !_currentEpisodesList.length) {
      if (nextBtn) { nextBtn.disabled = true; nextBtn.classList.add("disabled"); }
      if (prevBtn) { prevBtn.disabled = true; prevBtn.classList.add("disabled"); }
      return;
    }

    const currentIdx = _currentEpisodesList.findIndex(e => String(e.id) === String(episodeId) || Number(e.episode_number) === Number(episodeNumber));

    if (prevBtn) {
      if (currentIdx > 0) {
        const prevEp = _currentEpisodesList[currentIdx - 1];
        prevBtn.disabled = false;
        prevBtn.classList.remove("disabled");
        prevBtn.title = `Play Episode ${prevEp.episode_number}`;
      } else {
        prevBtn.disabled = true;
        prevBtn.classList.add("disabled");
        prevBtn.title = "First episode reached";
      }
    }

    if (nextBtn) {
      if (currentIdx !== -1 && currentIdx + 1 < _currentEpisodesList.length) {
        const nextEp = _currentEpisodesList[currentIdx + 1];
        nextBtn.disabled = false;
        nextBtn.classList.remove("disabled");
        nextBtn.innerHTML = `<span>Next</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
        nextBtn.title = `Play Episode ${nextEp.episode_number}`;
      } else {
        nextBtn.disabled = true;
        nextBtn.classList.add("disabled");
        nextBtn.innerHTML = `<span>Last</span>`;
        nextBtn.title = "No more episodes in this series";
      }
    }
  }

  function playPrevEpisode() {
    cancelAutoNext();
    if (!_currentEpisodesList || !_currentEpisodesList.length) {
      _showToast("ℹ No episode list available");
      return;
    }
    const currentIdx = _currentEpisodesList.findIndex(e => String(e.id) === String(_activeEpisodeId) || Number(e.episode_number) === Number(_activeEpisodeNumber));
    if (currentIdx > 0) {
      const prevEp = _currentEpisodesList[currentIdx - 1];
      _showToast(`⏮ Playing Episode ${prevEp.episode_number}`);
      playAnimeEpisode(prevEp.id, prevEp.episode_number);
      setTimeout(() => {
        const epBtn = document.querySelector(`.anime-ep-card[data-ep-id="${prevEp.id}"]`) ||
                      document.querySelector(`.anime-ep-card[data-ep-num="${prevEp.episode_number}"]`);
        if (epBtn) {
          epBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }, 300);
    } else {
      _showToast("ℹ First episode reached");
    }
  }

  function playNextEpisode() {
    cancelAutoNext();
    if (!_currentEpisodesList || !_currentEpisodesList.length) {
      _showToast("ℹ No episode list available");
      return;
    }
    const currentIdx = _currentEpisodesList.findIndex(e => String(e.id) === String(_activeEpisodeId) || Number(e.episode_number) === Number(_activeEpisodeNumber));
    if (currentIdx !== -1 && currentIdx + 1 < _currentEpisodesList.length) {
      const nextEp = _currentEpisodesList[currentIdx + 1];
      _showToast(`▶ Playing Episode ${nextEp.episode_number}`);
      playAnimeEpisode(nextEp.id, nextEp.episode_number);
      setTimeout(() => {
        const epBtn = document.querySelector(`.anime-ep-card[data-ep-id="${nextEp.id}"]`) ||
                      document.querySelector(`.anime-ep-card[data-ep-num="${nextEp.episode_number}"]`);
        if (epBtn) {
          epBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }, 300);
    } else {
      _showToast("ℹ Final episode reached");
    }
  }

  function handlePlayerShortcuts(e) {
    const video = document.getElementById("anime-video-player");
    if (!video || video.style.display === "none" || video.classList.contains("player-hidden")) return;

    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case " ":
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
        break;
      case "arrowright":
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case "arrowleft":
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case "arrowup":
        e.preventDefault();
        video.volume = Math.min(1.0, video.volume + 0.1);
        break;
      case "arrowdown":
        e.preventDefault();
        video.volume = Math.max(0.0, video.volume - 0.1);
        break;
      case "f":
        e.preventDefault();
        if (!document.fullscreenElement) {
          video.requestFullscreen?.().catch(err => console.log(err));
        } else {
          document.exitFullscreen?.().catch(err => console.log(err));
        }
        break;
    }
  }

  function _playSource(url, sourceObj = null) {
    const video = document.getElementById("anime-video-player");
    const iframe = document.getElementById("anime-iframe-player");
    const bg = document.getElementById("player-modal-bg");
    if (!video || !url) return;

    video.pause();
    video.onerror = null;
    video.onloadedmetadata = null;

    const badge = document.getElementById("anime-quality-badge");
    if (badge) {
      badge.style.display = "none";
      badge.textContent = "";
    }

    const qWrap = document.getElementById("hls-quality-controls-wrap");
    if (qWrap) qWrap.innerHTML = "";

    if (_hlsInstance) {
      _hlsInstance.destroy();
      _hlsInstance = null;
    }

    // Load volume settings
    video.volume = localStorage.getItem("streamx_volume") !== null ? parseFloat(localStorage.getItem("streamx_volume")) : 1.0;
    video.muted = localStorage.getItem("streamx_muted") === "true";

    video.onvolumechange = () => {
      localStorage.setItem("streamx_volume", video.volume);
      localStorage.setItem("streamx_muted", video.muted);
    };

    // Update Title Overlay Info
    const seriesTitleSpan = document.getElementById("anime-title-series");
    const episodeTitleSpan = document.getElementById("anime-title-episode");
    const titleOverlay = document.getElementById("anime-title-overlay");
    const animeItem = bg._currentAnimeItem;
    if (seriesTitleSpan && animeItem) {
      seriesTitleSpan.textContent = animeItem.title || "Anime";
    }
    if (episodeTitleSpan) {
      const currentEpObj = _currentEpisodesList?.find(e => e.episode_number === _activeEpisodeNumber);
      episodeTitleSpan.textContent = currentEpObj ? (currentEpObj.title || `Episode ${_activeEpisodeNumber}`) : `Episode ${_activeEpisodeNumber}`;
    }

    // Title Overlay Animation triggers on mousemove / hover
    const playerWrap = document.getElementById("anime-player-wrap");
    let titleTimer = null;
    const showTitleOverlay = () => {
      if (titleOverlay) {
        titleOverlay.style.opacity = "1";
        clearTimeout(titleTimer);
        titleTimer = setTimeout(() => {
          titleOverlay.style.opacity = "0";
        }, 3000);
      }
    };
    if (playerWrap) {
      playerWrap.onmousemove = showTitleOverlay;
      playerWrap.onmouseenter = showTitleOverlay;
    }

    // Buffering & Loading Overlays
    const bufferOverlay = document.getElementById("anime-buffering-overlay");
    const showBuffer = () => { if (bufferOverlay) bufferOverlay.style.display = "flex"; };
    const hideBuffer = () => { if (bufferOverlay) bufferOverlay.style.display = "none"; };

    video.onwaiting = showBuffer;
    video.onseeking = showBuffer;
    video.onplaying = hideBuffer;
    video.oncanplay = hideBuffer;
    video.onseeked = hideBuffer;

    video.onloadedmetadata = () => {
      const resumePref = localStorage.getItem("streamx_resume_playback") !== "false";
      if (resumePref) {
        const animeId = bg._currentAnimeItem?.id;
        const history = StreamXHistory.getWatchHistory().find(i => i.id === animeId && i.media === "anime");
        if (history && history.episode === _activeEpisodeNumber && history.progress > 5 && history.progress < (history.duration - 15)) {
          console.log(`[Playback Resume] Seeking to: ${history.progress}s`);
          video.currentTime = history.progress;
        }
      }
      hideBuffer();
    };

    video.onplay = () => {
      const savedRate = localStorage.getItem("streamx_playback_rate");
      if (savedRate) {
        video.playbackRate = parseFloat(savedRate);
      }
      showTitleOverlay();

      // Initialize volume boost lazily if active
      initVolumeBoost(video);
      if (_gainNode && _audioCtx && _audioCtx.state === "suspended") {
        _audioCtx.resume();
      }
    };

    video.onended = () => {
      const autoNextPref = localStorage.getItem("streamx_auto_next") !== "false";
      if (autoNextPref) {
        console.log("Video ended. Auto next countdown...");
        showAutoNextCountdown();
      } else {
        console.log("Video ended. Auto next disabled by preference.");
      }
    };

    let lastSaveTime = 0;
    video.ontimeupdate = () => {
      const nowTime = Date.now();
      if (nowTime - lastSaveTime > 2500) {
        lastSaveTime = nowTime;
        const animeId = bg._currentAnimeItem?.id;
        if (animeId && video.duration) {
          StreamXHistory.updateProgress(animeId, "anime", video.currentTime, video.duration, null, _activeEpisodeNumber);
        }
      }

      // Handle Skip Intro
      const autoSkipIntro = localStorage.getItem("streamx_auto_skip_intro") === "true";
      if (autoSkipIntro && video.currentTime >= 30 && video.currentTime < 90) {
        console.log("[Auto Skip] Skipping intro automatically...");
        video.currentTime = 90;
        return;
      }

      // Handle Skip Outro
      const autoSkipOutro = localStorage.getItem("streamx_auto_skip_outro") === "true";
      if (autoSkipOutro && video.duration && video.currentTime >= (video.duration - 90) && video.currentTime < (video.duration - 10)) {
        console.log("[Auto Skip] Skipping outro automatically...");
        video.currentTime = video.duration - 10;
        return;
      }

      const skipIntroBtn = document.getElementById("skip-intro-btn");
      const skipOutroBtn = document.getElementById("skip-outro-btn");

      if (video.currentTime >= 30 && video.currentTime <= 90) {
        if (skipIntroBtn) skipIntroBtn.style.display = "block";
      } else {
        if (skipIntroBtn) skipIntroBtn.style.display = "none";
      }

      if (video.duration && video.currentTime >= (video.duration - 90) && video.currentTime <= (video.duration - 15)) {
        if (skipOutroBtn) skipOutroBtn.style.display = "block";
      } else {
        if (skipOutroBtn) skipOutroBtn.style.display = "none";
      }
    };

    const isM3U8 = (sourceObj && sourceObj.isM3U8) || url.includes(".m3u8") || url.includes("proxy_m3u8") || url.includes("/m3u8");
    const isMP4 = (sourceObj && !sourceObj.isM3U8 && !sourceObj.isEmbed && url.includes(".mp4")) || url.includes(".mp4") || url.includes("/video.mp4");
    const isEmbed = (sourceObj && sourceObj.isEmbed) || (!isM3U8 && !isMP4 && (url.includes("megaplay.buzz") || url.includes("/stream/") || url.includes("anikoto") || url.includes("/embed") || url.includes("/e/")));
    if (isEmbed) {
      _setAnimePlayerMode("embed", url, _activeProvider);
    } else {
      _setAnimePlayerMode("video");

      video.onerror = (e) => {
        if (!isEmbed && video.src) {
          console.warn("Video element error encountered. Trying next provider...", e);
          video.onerror = null;
          handlePlaybackFailure();
        }
      };

      if (isM3U8) {
        if (typeof Hls !== "undefined" && Hls.isSupported()) {
          const hls = new Hls({
            maxMaxBufferLength: 30,
          });
          _hlsInstance = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            _renderHlsQualityControls(hls);
            const savedRate = localStorage.getItem("streamx_playback_rate");
            if (savedRate) video.playbackRate = parseFloat(savedRate);
            video.play().catch(e => console.log("Auto-play blocked:", e));
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            const levelHeight = hls.levels[data.level]?.height;
            if (levelHeight) {
              const b = document.getElementById("anime-quality-badge");
              if (b) {
                b.textContent = `${levelHeight}p`;
                b.style.display = "block";
              }
              const autoBtn = document.getElementById("hls-qual-btn-auto");
              if (autoBtn && hls.autoLevelEnabled) {
                autoBtn.textContent = `Auto (${levelHeight}p)`;
              }
            }
          });
          hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log("HLS network error, recovering...");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log("HLS media error, recovering...");
                  hls.recoverMediaError();
                  break;
                default:
                  console.error("Fatal unrecoverable HLS error");
                  hls.destroy();
                  handlePlaybackFailure();
                  break;
              }
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.onloadedmetadata = () => {
            const savedRate = localStorage.getItem("streamx_playback_rate");
            if (savedRate) video.playbackRate = parseFloat(savedRate);
            const b = document.getElementById("anime-quality-badge");
            if (b && video.videoHeight) {
              b.textContent = `${video.videoHeight}p`;
              b.style.display = "block";
            }
            video.play().catch(e => console.log("Auto-play blocked:", e));
          };
        } else {
          alert("HLS playback is not supported on this browser.");
        }
      } else {
        video.src = url;
        video.onloadedmetadata = () => {
          const savedRate = localStorage.getItem("streamx_playback_rate");
          if (savedRate) video.playbackRate = parseFloat(savedRate);
          const b = document.getElementById("anime-quality-badge");
          if (b && video.videoHeight) {
            b.textContent = `${video.videoHeight}p`;
            b.style.display = "block";
          }
          video.play().catch(e => console.log("Auto-play blocked:", e));
        };
        video.load();
      }
    }
  }

  function switchQuality(event, url, quality) {
    if (quality) {
      const rememberQual = localStorage.getItem("streamx_remember_quality") !== "false";
      if (rememberQual) {
        localStorage.setItem("streamx_anime_quality", quality);
      }
    }
    document.querySelectorAll("#anime-player-controls .anime-ctrl-row .anime-ctrl-btn").forEach(btn => {
      if (btn.getAttribute("onclick") && !btn.getAttribute("onclick").includes("switchProvider") && !btn.getAttribute("onclick").includes("switchAudio")) {
        btn.classList.remove("active");
      }
    });
    const targetBtn = (event && event.currentTarget) || (event && event.target && event.target.closest(".anime-ctrl-btn"));
    if (targetBtn) {
      targetBtn.classList.add("active");
    }
    const matchedSource = _currentEpisodeSources?.sources?.find(s => s.url === url);
    _playSource(url || matchedSource?.url, matchedSource || { url });
  }

  function switchAudio(audioMode) {
    if (!audioMode) return;
    const mode = audioMode.toLowerCase();
    console.log(`>>> Switching audio to ${mode.toUpperCase()} on active server:`, _activeProvider);
    _currentActiveAudioMode = mode;
    localStorage.setItem("streamx_sub_dub", mode);

    const subdubSel = document.getElementById("pref-subdub-selector");
    if (subdubSel) subdubSel.value = mode;

    if (_activeEpisodeId && _activeEpisodeNumber) {
      playAnimeEpisode(_activeEpisodeId, _activeEpisodeNumber, mode);
    }
  }

  function retryCurrentEpisode() {
    if (_activeEpisodeId && _activeEpisodeNumber) {
      console.log(`>>> Retrying episode ${_activeEpisodeNumber} on server ${_activeProvider}...`);
      playAnimeEpisode(_activeEpisodeId, _activeEpisodeNumber, _currentActiveAudioMode);
    }
  }

  function switchProvider(providerName) {
    console.log(">>> Selected server (frontend switchProvider):", providerName);
    const bg = document.getElementById("player-modal-bg");
    const item = bg._currentAnimeItem;
    if (!item) return;

    // Immediately update active provider in memory and persistence
    _activeProvider = providerName;
    const rememberServer = localStorage.getItem("streamx_remember_server") !== "false";
    if (rememberServer) {
      localStorage.setItem("streamx_anime_provider", providerName);
    }

    // Immediately highlight the selected server button in the DOM for instant visual feedback
    const controlsWrap = document.getElementById("anime-player-controls");
    if (controlsWrap) {
      controlsWrap.querySelectorAll(".anime-ctrl-btn").forEach(btn => {
        if (btn.getAttribute("onclick")?.includes("switchProvider")) {
          const isTarget = btn.getAttribute("onclick").includes(`'${providerName}'`);
          btn.classList.toggle("active", isTarget);
        }
      });
    }

    // If already playing or selected an episode, switch the playback stream directly!
    if (_activeEpisodeId && _activeEpisodeNumber) {
      console.log(`>>> Instantly switching playback stream to ${providerName} for episode ${_activeEpisodeNumber}...`);
      playAnimeEpisode(_activeEpisodeId, _activeEpisodeNumber, _currentActiveAudioMode);
    } else {
      _fetchAnimeEpisodes(item.id, providerName);
    }
  }

  // ── WL count badge ────────────────────────────────────────────────────
  function _updateWLCount() {
    const el = document.getElementById("wl-count-badge");
    if (el) el.textContent = Watchlist.count();
  }

  // ── Desktop Left Sidebar Toggle & Collapse Persistence ─────────────────
  function toggleSidebar() {
    const body = document.body;
    const sidebar = document.getElementById("desktop-sidebar");

    _sidebarCollapsed = !_sidebarCollapsed;
    localStorage.setItem("streamx_sidebar_collapsed", _sidebarCollapsed);

    if (_sidebarCollapsed) {
      body.classList.add("sidebar-collapsed");
      sidebar?.classList.add("collapsed");
    } else {
      body.classList.remove("sidebar-collapsed");
      sidebar?.classList.remove("collapsed");
    }
    document.body.style.paddingLeft = "";

    // Trigger resize events so horizontal carousels, hero banners, and players reflow seamlessly without glitches
    window.dispatchEvent(new Event("resize"));
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 260);
  }

  function handleMenuToggle() {
    if (window.innerWidth < 768) {
      toggleMobileDrawer();
    } else {
      toggleSidebar();
    }
  }

  function toggleSidebarSubmenu(id) {
    const submenu = document.getElementById(`submenu-${id}`);
    if (!submenu) return;
    const btn = document.querySelector(`.sidebar-link[data-nav-id="${id}"]`);

    const isHidden = submenu.style.display === "none";
    submenu.style.display = isHidden ? "flex" : "none";
    if (btn) {
      if (isHidden) btn.classList.add("open");
      else btn.classList.remove("open");
    }
  }

  // ── Premium Settings & Themes (cinejoy.pk Redesign) ──────────────────
  let _activeSettingsTab = "account";

  function switchSettingsTab(tabKey) {
    _activeSettingsTab = tabKey;
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabKey);
    });
    document.querySelectorAll(".settings-card-section").forEach(sec => {
      sec.style.display = "block";
    });
    const target = document.querySelector(`.settings-card-section[data-section="${tabKey}"]`) || document.getElementById(`settings-card-${tabKey}`);
    if (target) {
      const topOffset = 135;
      const targetY = target.getBoundingClientRect().top + window.pageYOffset - topOffset;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: "smooth"
      });
    }
  }

  function _updateSubtitlePreview() {
    const previewEl = document.getElementById("sub-preview-text");
    const font = localStorage.getItem("streamx_subtitle_font") || "cinejoy";
    const size = localStorage.getItem("streamx_subtitle_size") || "100";
    const color = localStorage.getItem("streamx_subtitle_color") || "#ffffff";
    const blur = localStorage.getItem("streamx_sub_blur") !== "false";

    let fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if (font === "netflix") fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    else if (font === "montserrat") fontFamily = '"Montserrat", sans-serif';

    const root = document.documentElement;
    root.style.setProperty("--sub-font-family", fontFamily);
    root.style.setProperty("--sub-font-size", `${size}%`);
    root.style.setProperty("--sub-color", color);
    root.style.setProperty("--sub-bg", blur ? "rgba(0, 0, 0, 0.75)" : "rgba(0, 0, 0, 0.45)");
    root.style.setProperty("--sub-text-shadow", blur ? `0 0 10px ${color}88, 0 2px 4px rgba(0,0,0,0.9)` : "0 2px 4px rgba(0,0,0,0.95)");

    if (!previewEl) return;
    previewEl.className = `sub-preview-text-box sub-font-${font}`;
    previewEl.style.fontSize = `${Math.round((18 * parseInt(size, 10)) / 100)}px`;
    previewEl.style.color = color;
    if (blur) {
      previewEl.style.textShadow = `0 0 10px ${color}88, 0 2px 4px rgba(0,0,0,0.9)`;
      previewEl.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    } else {
      previewEl.style.textShadow = "0 2px 4px rgba(0,0,0,0.95)";
      previewEl.style.backgroundColor = "rgba(0, 0, 0, 0.45)";
    }
  }

  function setEpisodeViewStyle(style) {
    localStorage.setItem("streamx_episode_view_style", style);
    document.querySelectorAll(".settings-pill-episode").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === style);
    });
    const epGrid = document.querySelector(".pm-episodes-grid");
    if (epGrid) {
      epGrid.classList.remove("view-carousel", "view-grid");
      epGrid.classList.add(`view-${style}`);
    }
    _showToast(`Episode view set to ${style}`);
  }

  function setDetailViewType(type) {
    localStorage.setItem("streamx_detail_view_type", type);
    document.querySelectorAll(".settings-pill-detail").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === type);
    });
    const modal = document.querySelector(".player-modal.cinematic-detail-modal");
    if (modal) {
      modal.classList.remove("view-fullpage", "view-modal");
      modal.classList.add(type === "modal" ? "view-modal" : "view-fullpage");
    }
    _showToast(`Detail view set to ${type}`);
  }

  function setLoaderGfxStyle(style) {
    localStorage.setItem("streamx_loader_gfx", style);
    document.querySelectorAll(".settings-pill-loader-gfx").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === style);
    });
    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) {
      loader.classList.remove("loader-style-cyber", "loader-style-minimal", "loader-style-classic");
      loader.classList.add(`loader-style-${style}`);
    }
    _showToast(`Loader style set to ${style.toUpperCase()}`);
  }

  function setSubtitleFont(font) {
    localStorage.setItem("streamx_subtitle_font", font);
    document.querySelectorAll(".settings-pill-sub-font").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === font);
    });
    _updateSubtitlePreview();
    _showToast(`Subtitle font set to ${font}`);
  }

  function setSubtitleSize(pct) {
    localStorage.setItem("streamx_subtitle_size", pct);
    const label = document.getElementById("sub-size-text");
    if (label) label.textContent = `${pct}%`;
    _updateSubtitlePreview();
  }

  function setSubtitleColor(color) {
    localStorage.setItem("streamx_subtitle_color", color);
    document.querySelectorAll(".sub-color-dot").forEach(dot => {
      dot.classList.toggle("active", dot.getAttribute("data-color") === color);
    });
    _updateSubtitlePreview();
    _showToast(`Subtitle color updated`);
  }

  function toggleReduceMotion(enable) {
    localStorage.setItem("streamx_reduce_motion", enable ? "true" : "false");
    document.documentElement.setAttribute("data-reduce-motion", enable ? "true" : "false");
    document.body.classList.toggle("reduce-motion", enable);
    _showToast(`Reduced motion ${enable ? "enabled" : "disabled"}`);
  }

  function toggleSpoilers(enable) {
    localStorage.setItem("streamx_spoiler_free", enable ? "true" : "false");
    document.querySelectorAll(".pm-ep-card").forEach(c => {
      c.classList.toggle("spoiler-hidden", enable);
    });
    _showToast(`Spoiler-free mode ${enable ? "enabled" : "disabled"}`);
  }

  function setDefaultServer(key) {
    localStorage.setItem("streamx_default_server", key);
    document.querySelectorAll(".settings-server-row").forEach(row => {
      const isCur = row.getAttribute("data-server-key") === key;
      row.classList.toggle("active", isCur);
      const badge = row.querySelector(".server-default-badge");
      if (badge) badge.style.display = isCur ? "inline-block" : "none";
      const btn = row.querySelector(".server-select-btn");
      if (btn) btn.textContent = isCur ? "Active" : "Select";
    });
    _showToast(`Default server set to ${key}`);
  }

  function saveFebboxCookie() {
    const input = document.getElementById("pref-febbox-cookie");
    if (input) {
      localStorage.setItem("streamx_febbox_cookie", input.value.trim());
      _showToast("Febbox cookie saved!");
    }
  }

  function clearSiteData() {
    if (confirm("Are you sure you want to clear your local cache, watchlist and watch history?")) {
      localStorage.clear();
      _showToast("Site data reset");
      setTimeout(() => window.location.reload(), 600);
    }
  }

  function _initSettingsPage() {
    // 1. Theme selector
    const selector = document.getElementById("theme-selector");
    if (selector) {
      selector.value = localStorage.getItem("streamx_theme_preset") || "default";
    }

    // 2. Appearance pills & toggles
    const epStyle = localStorage.getItem("streamx_episode_view_style") || "carousel";
    document.querySelectorAll(".settings-pill-episode").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === epStyle);
    });

    const detType = localStorage.getItem("streamx_detail_view_type") || "page";
    document.querySelectorAll(".settings-pill-detail").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === detType);
    });

    const loaderGfx = localStorage.getItem("streamx_loader_gfx") || "cyber";
    document.querySelectorAll(".settings-pill-loader-gfx").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === loaderGfx);
    });

    const imgLogos = document.getElementById("pref-image-logos");
    if (imgLogos) imgLogos.checked = localStorage.getItem("streamx_image_logos") !== "false";

    const trailers = document.getElementById("pref-trailers");
    if (trailers) trailers.checked = localStorage.getItem("streamx_trailers") !== "false";

    const spoilerFree = document.getElementById("pref-spoiler-free");
    if (spoilerFree) spoilerFree.checked = localStorage.getItem("streamx_spoiler_free") === "true";

    const reduceMotion = document.getElementById("pref-reduce-motion");
    if (reduceMotion) reduceMotion.checked = localStorage.getItem("streamx_reduce_motion") === "true";

    // 3. Playback toggles
    const autoNext = document.getElementById("pref-auto-next");
    if (autoNext) autoNext.checked = localStorage.getItem("streamx_auto_next") !== "false";

    const autoplay = document.getElementById("pref-autoplay");
    if (autoplay) autoplay.checked = localStorage.getItem("streamx_autoplay") !== "false";

    const autoSkipIntro = document.getElementById("pref-skip-intro");
    if (autoSkipIntro) autoSkipIntro.checked = localStorage.getItem("streamx_auto_skip_intro") !== "false";

    const autoSkipOutro = document.getElementById("pref-skip-outro");
    if (autoSkipOutro) autoSkipOutro.checked = localStorage.getItem("streamx_auto_skip_outro") === "true";

    const resume = document.getElementById("pref-resume");
    if (resume) resume.checked = localStorage.getItem("streamx_resume_playback") !== "false";

    const rememberServer = document.getElementById("pref-remember-server");
    if (rememberServer) rememberServer.checked = localStorage.getItem("streamx_remember_server") !== "false";

    const rememberQuality = document.getElementById("pref-remember-quality");
    if (rememberQuality) rememberQuality.checked = localStorage.getItem("streamx_remember_quality") !== "false";

    const rememberSubdub = document.getElementById("pref-remember-subdub");
    if (rememberSubdub) rememberSubdub.checked = localStorage.getItem("streamx_remember_sub_dub") !== "false";

    const subdubSel = document.getElementById("pref-subdub-selector");
    if (subdubSel) subdubSel.value = localStorage.getItem("streamx_sub_dub") || "sub";

    // 4. Subtitles
    const subFont = localStorage.getItem("streamx_subtitle_font") || "cinejoy";
    document.querySelectorAll(".settings-pill-sub-font").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === subFont);
    });

    const subSize = localStorage.getItem("streamx_subtitle_size") || "100";
    const subSlider = document.getElementById("pref-sub-size-slider");
    if (subSlider) subSlider.value = subSize;
    const subSizeText = document.getElementById("sub-size-text");
    if (subSizeText) subSizeText.textContent = `${subSize}%`;

    const subColor = localStorage.getItem("streamx_subtitle_color") || "#ffffff";
    document.querySelectorAll(".sub-color-dot").forEach(dot => {
      dot.classList.toggle("active", dot.getAttribute("data-color") === subColor);
    });

    const subBlur = document.getElementById("pref-sub-blur");
    if (subBlur) subBlur.checked = localStorage.getItem("streamx_sub_blur") !== "false";

    _updateSubtitlePreview();

    // 5. Advertisements & Febbox
    const enableAds = document.getElementById("pref-enable-ads");
    if (enableAds) enableAds.checked = localStorage.getItem("streamx_enable_ads") !== "false";

    const febboxInput = document.getElementById("pref-febbox-cookie");
    if (febboxInput) febboxInput.value = localStorage.getItem("streamx_febbox_cookie") || "";

    // 6. Servers list dynamic generation
    const serverListEl = document.getElementById("settings-server-list");
    if (serverListEl && typeof STREAM_SERVERS !== "undefined") {
      const defKey = localStorage.getItem("streamx_default_server") || "nxsha";
      serverListEl.innerHTML = STREAM_SERVERS.map(srv => {
        const isDef = srv.key === defKey;
        return `
          <div class="settings-server-row ${isDef ? 'active' : ''}" data-server-key="${srv.key}" onclick="App.setDefaultServer('${srv.key}')">
            <div class="server-info-col">
              <div class="server-title-line">
                <span class="server-color-dot" style="background:${srv.color || '#fff'}"></span>
                <strong>${_esc(srv.label)}</strong>
                <span class="server-badge">${_esc(srv.badge || 'Embed')}</span>
                <span class="server-default-badge" style="${isDef ? '' : 'display:none'}">Default</span>
              </div>
              <p class="server-desc">${_esc(srv.desc || '')}</p>
            </div>
            <button type="button" class="server-select-btn" aria-label="Select ${srv.label} as default">
              ${isDef ? 'Active' : 'Select'}
            </button>
          </div>
        `;
      }).join("");
    }

    const backendInput = document.getElementById("settings-backend-url-input");
    if (backendInput) {
      backendInput.value = localStorage.getItem("streamx_backend_url") || "";
    }
    _checkBackendStatus();

    // Default activate initial tab
    switchSettingsTab(_activeSettingsTab || "account");
  }

  function savePlayerPreference(key, value) {
    console.log(`[Settings] Saving player preference: ${key} = ${value}`);
    localStorage.setItem(key, typeof value === "boolean" ? String(value) : value);
    if (key === "streamx_reduce_motion") {
      document.documentElement.setAttribute("data-reduce-motion", value ? "true" : "false");
      document.body.classList.toggle("reduce-motion", Boolean(value));
    } else if (key === "streamx_sub_blur") {
      _updateSubtitlePreview();
    } else if (key === "streamx_spoiler_free") {
      document.querySelectorAll(".pm-ep-card").forEach(c => {
        c.classList.toggle("spoiler-hidden", Boolean(value));
      });
    } else if (key === "streamx_detail_view_type") {
      const modal = document.querySelector(".player-modal.cinematic-detail-modal");
      if (modal) {
        modal.classList.remove("view-fullpage", "view-modal");
        modal.classList.add(value === "modal" ? "view-modal" : "view-fullpage");
      }
    }
    _showToast("Preference saved!");
  }

  function initVolumeBoost(video) {
    if (_audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new AudioContext();
      _audioSource = _audioCtx.createMediaElementSource(video);
      _gainNode = _audioCtx.createGain();
      _audioSource.connect(_gainNode);
      _gainNode.connect(_audioCtx.destination);
      console.log("[Volume Boost] Audio Graph initialized successfully.");
    } catch (e) {
      console.warn("[Volume Boost] Audio Context failed:", e.message);
    }
  }

  function setVolumeBoost(value) {
    const video = document.getElementById("anime-video-player");
    if (video) {
      initVolumeBoost(video);
    }
    _currentVolumeBoost = parseFloat(value);
    if (_gainNode && _audioCtx) {
      if (_audioCtx.state === "suspended") _audioCtx.resume();
      _gainNode.gain.value = _currentVolumeBoost;
      const boostValSpan = document.getElementById("vol-boost-val-text");
      if (boostValSpan) {
        boostValSpan.textContent = `${Math.round(_currentVolumeBoost * 100)}%`;
      }
      console.log(`[Volume Boost] Set gain value: ${_currentVolumeBoost}`);
    }
  }

  function toggleShortcutHelp() {
    const overlay = document.getElementById("anime-help-overlay");
    if (!overlay) return;
    const isHidden = overlay.style.display === "none";
    overlay.style.display = isHidden ? "flex" : "none";
  }

  function toggleMiniEpisodeDrawer() {
    const drawer = document.getElementById("anime-mini-episodes-drawer");
    if (!drawer) return;
    const isHidden = drawer.style.display === "none";
    if (isHidden) {
      drawer.style.display = "flex";
      setTimeout(() => {
        drawer.style.transform = "translateX(0)";
      }, 50);
      _renderMiniEpisodeDrawerList();
    } else {
      drawer.style.transform = "translateX(100%)";
      setTimeout(() => {
        drawer.style.display = "none";
      }, 300);
    }
  }

  function _renderMiniEpisodeDrawerList() {
    const listContainer = document.getElementById("anime-mini-eps-list");
    if (!listContainer || !_currentEpisodesList) return;

    listContainer.innerHTML = _currentEpisodesList.map(ep => {
      const activeClass = ep.episode_number === _activeEpisodeNumber ? "active" : "";
      const stillPath = ep.still || "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100&auto=format&fit=crop&q=80";
      return `
        <div class="mini-ep-item ${activeClass}" onclick="App.playAnimeEpisode('${_esc(ep.id)}', ${ep.episode_number})">
          <div class="mini-ep-thumb" style="background-image: url('${stillPath}')"></div>
          <div class="mini-ep-info">
            <div class="mini-ep-num">Episode ${ep.episode_number}</div>
            <div class="mini-ep-title">${_esc(ep.title || "")}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function toggleTheaterMode() {
    const container = document.getElementById("anime-player-container");
    if (!container) return;
    _theaterMode = !_theaterMode;
    if (_theaterMode) {
      container.classList.add("theater-mode");
      _showToast("Theater Mode Enabled");
    } else {
      container.classList.remove("theater-mode");
      _showToast("Theater Mode Disabled");
    }
  }

  function captureScreenshot() {
    const video = document.getElementById("anime-video-player");
    if (!video || video.style.display === "none" || video.classList.contains("player-hidden")) {
      _showToast("No active video source to screenshot!");
      return;
    }

    const flash = document.getElementById("anime-flash-overlay");
    if (flash) {
      flash.style.display = "block";
      setTimeout(() => {
        flash.style.display = "none";
      }, 400);
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `streamx-screenshot-${timestamp}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      _showToast("Screenshot saved!");
    } catch (e) {
      console.error("[Screenshot Error]", e);
      _showToast("Failed to take screenshot (cross-origin content protected).");
    }
  }

  function togglePictureInPicture() {
    const video = document.getElementById("anime-video-player");
    if (!video) return;

    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(e => console.error(e));
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(e => console.error(e));
    } else {
      _showToast("Picture-in-Picture not supported on this browser.");
    }
  }

  function changeTheme(preset) {
    // Clear old theme presets from body
    document.body.classList.remove("theme-crimson", "theme-sapphire", "theme-emerald", "theme-nordic", "theme-aero");

    _activeTheme = preset;
    localStorage.setItem("streamx_theme_preset", preset);

    if (preset !== "default") {
      document.body.classList.add(`theme-${preset}`);
    }
    _showToast(`Theme updated to ${preset.toUpperCase()}`);
  }

  function clearAllStorage() {
    if (confirm("Are you sure you want to clear all storage, bookmarks, and settings? This will reload the application.")) {
      localStorage.clear();
      window.location.reload();
    }
  }

  function clearAllHistory() {
    if (confirm("Clear all watch history?")) {
      StreamXHistory.clearWatchHistory();
      StreamXHistory.clearRecentlyViewed();
      try {
        localStorage.removeItem("streamx_manga_history");
        localStorage.removeItem("streamx_manga_bookmarks");
      } catch (e) {}
      _showToast("History cleared successfully");
      _showPage(_currentPage); // Refresh active view
    }
  }

  function showNotificationsToast() {
    _showToast("🔔 No new notifications. You are all caught up!");
  }

  // ── Local Streaming Library & Profile System ────────────────────────────
  function _computeUserStreamingStats() {
    const history = StreamXHistory.getWatchHistory() || [];
    const watchedCount = history.length;
    const animeCount = history.filter(i => i.media === "anime" || i.media === "donghua").length;
    const savedCount = Watchlist.count() || 0;

    let totalSeconds = 0;
    history.forEach(item => {
      if (item.progress && item.progress > 0) {
        totalSeconds += item.progress;
      } else if (item.duration && item.duration > 0) {
        totalSeconds += Math.min(item.duration, 45 * 60);
      } else {
        totalSeconds += 25 * 60; // default estimated time per title in seconds
      }
    });

    const totalHours = Math.floor(totalSeconds / 3600);
    const remainingMins = Math.floor((totalSeconds % 3600) / 60);
    const timeFormatted = `${totalHours}h ${remainingMins}m`;

    return {
      watchedCount,
      animeCount,
      savedCount,
      timeFormatted,
      totalHours
    };
  }

  function _syncUserProfileUI() {
    const stats = _computeUserStreamingStats();

    // Dropdown stats
    const pdropWatched = document.getElementById("pdrop-stat-watched");
    if (pdropWatched) pdropWatched.textContent = stats.watchedCount;
    const pdropSaved = document.getElementById("pdrop-stat-saved");
    if (pdropSaved) pdropSaved.textContent = stats.savedCount;
    const pdropTime = document.getElementById("pdrop-stat-time");
    if (pdropTime) pdropTime.textContent = `${stats.totalHours}h`;

    // Profile page stats cards
    const statWatched = document.getElementById("prof-stat-watched-count");
    if (statWatched) statWatched.textContent = stats.watchedCount;
    const statAnime = document.getElementById("prof-stat-anime-count");
    if (statAnime) statAnime.textContent = stats.animeCount;
    const statSaved = document.getElementById("prof-stat-saved-count");
    if (statSaved) statSaved.textContent = stats.savedCount;
    const statTime = document.getElementById("prof-stat-time-val");
    if (statTime) statTime.textContent = stats.timeFormatted;
  }

  function _renderProfilePage() {
    _syncUserProfileUI();

    // 1. Render Continue Watching in profile
    const continueContainer = document.getElementById("profile-continue-row");
    if (continueContainer) {
      const historyItems = StreamXHistory.getWatchHistory() || [];
      if (!historyItems.length) {
        continueContainer.innerHTML = `<div class="empty-state" style="padding:20px; font-size:13px; color:var(--text3);"><p>No items in continue watching yet. Start exploring movies and anime!</p></div>`;
      } else {
        continueContainer.innerHTML = historyItems.slice(0, 12).map(i => _historyCardHTML(i, true)).join("");
        continueContainer.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
      }
    }

    // 2. Render Watchlist in profile
    const wlContainer = document.getElementById("profile-watchlist-row");
    if (wlContainer) {
      const wlItems = Watchlist.getAll() || [];
      if (!wlItems.length) {
        wlContainer.innerHTML = `<div class="empty-state" style="padding:20px; font-size:13px; color:var(--text3);"><p>Your watchlist is currently empty. Bookmark your favorite titles!</p></div>`;
      } else {
        wlContainer.innerHTML = wlItems.slice(0, 12).map(i => _cardHTML(i)).join("");
        wlContainer.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
      }
    }
  }

  function clearHistoryFromProfile() {
    clearAllHistory();
  }

  function toggleProfileDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("profile-dropdown-menu");
    if (!dropdown) return;
    const isHidden = dropdown.style.display === "none";
    if (isHidden) {
      _syncUserProfileUI();
      dropdown.style.display = "block";
    } else {
      dropdown.style.display = "none";
    }
  }

  function closeProfileDropdown() {
    const dropdown = document.getElementById("profile-dropdown-menu");
    if (dropdown) dropdown.style.display = "none";
  }

  function showProfileToast() {
    _showPage("profile");
  }

  // ── Legal Disclaimer & Guidelines Modal Controllers ────────────────────
  function openDisclaimerModal(activeTab = "non-hosting") {
    const modal = document.getElementById("disclaimer-modal-bg");
    if (!modal) return;
    switchDisclaimerTab(activeTab);
    modal.style.display = "flex";
  }

  function closeDisclaimerModal() {
    const modal = document.getElementById("disclaimer-modal-bg");
    if (modal) modal.style.display = "none";
  }

  function switchDisclaimerTab(tabId) {
    const tabs = document.querySelectorAll(".disclaimer-tab-btn");
    const contents = document.querySelectorAll(".disclaimer-tab-content");
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
    contents.forEach(c => {
      const isTarget = c.id === `disclaimer-tab-${tabId}`;
      c.classList.toggle("active", isTarget);
      c.style.display = isTarget ? "block" : "none";
    });
  }

  // ── PWA & Cloud Backend Controllers ────────────────────────────────────
  let _deferredPrompt = null;

  async function installPWA() {
    if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const choiceResult = await _deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === "accepted") {
        _showToast("🎉 CineJoy is being installed!");
      }
      _deferredPrompt = null;
    } else {
      const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
      if (isStandalone) {
        _showToast("✅ CineJoy is already running as an installed standalone app!");
      } else if (isIos) {
        _showToast("📱 On iOS: Tap Share (⎋) in Safari and select 'Add to Home Screen' (➕)");
      } else {
        _showToast("💡 To install: Open your browser menu (⋮) and tap 'Install App' or 'Add to Home screen'");
      }
    }
  }

  function saveBackendUrl(url) {
    if (!url || !url.trim()) {
      localStorage.removeItem("streamx_backend_url");
      _showToast("🔄 Backend URL reset to auto-detect.");
    } else {
      localStorage.setItem("streamx_backend_url", url.trim());
      _showToast("✅ Backend API URL saved!");
    }
    _checkBackendStatus();
  }

  async function _checkBackendStatus() {
    const statusEl = document.getElementById("backend-status-indicator");
    if (!statusEl) return;
    statusEl.innerHTML = `<span style="color:#94a3b8">Testing connection…</span>`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${getStreamXBackendUrl()}/`, { method: "GET", cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        statusEl.innerHTML = `<span style="color:#10b981; font-weight:600;">🟢 Online &amp; Operational</span>`;
      } else {
        statusEl.innerHTML = `<span style="color:#f59e0b; font-weight:600;">🟡 Server responded with HTTP ${res.status}</span>`;
      }
    } catch (e) {
      statusEl.innerHTML = `<span style="color:#ef4444; font-weight:600;">🔴 Offline / Unreachable</span>`;
    }
  }

  // ── Library History & Settings Page Renderers ──────────────────────────
  function _renderHistoryPage() {
    const grid = document.getElementById("history-page-grid");
    if (!grid) return;

    const watched = StreamXHistory.getWatchHistory();

    if (!watched.length) {
      grid.innerHTML = renderEmptyState({
        icon: "history",
        title: "No Watch History Yet",
        message: "Titles you watch will appear here so you can easily pick up where you left off.",
        actionLabel: "Explore Trending Movies",
        actionOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')",
        secondaryLabel: "Browse TV Shows",
        secondaryOnClick: "App.handleNavItemClick('series', 'browse', 'trending_tv')"
      });
      return;
    }

    grid.innerHTML = watched.map(item => {
      const safeId = String(item.id || "").replace(/'/g, "\\'");
      const safeMedia = String(item.media || "movie").replace(/'/g, "\\'");
      return `
        <div class="card history-card" onclick="App.openItem(${_jsonAttr(item)})">
          <div class="card-poster history-poster">
            <img src="${item.poster || ""}" alt="${_esc(item.title)}" class="card-img">
            <span class="card-badge badge-${item.media || "movie"}">
              ${(item.media || "movie").toUpperCase()}
            </span>
            <button type="button" class="history-remove-btn" onclick="event.stopPropagation(); event.preventDefault(); App.removeFromHistory('${safeId}', '${safeMedia}')" ontouchstart="event.stopPropagation();" aria-label="Remove from Watch History" title="Remove from Watch History">
              ${_CLOSE_SVG}
            </button>
          </div>
          <div class="card-info">
            <div class="card-title">${_esc(item.title)}</div>
            <div class="card-meta">
              <span class="card-year">${item.season ? `S${item.season} E${item.episode}` : (item.media === "anime" || item.media === "donghua") ? (item.episode ? `Ep ${item.episode}` : "Anime") : "Movie"}</span>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  function _renderContinuePage() {
    const grid = document.getElementById("continue-page-grid");
    if (!grid) return;

    const watched = StreamXHistory.getWatchHistory();

    if (!watched.length) {
      grid.innerHTML = renderEmptyState({
        icon: "history",
        title: "Nothing to Resume",
        message: "Episodes or movies you start watching will automatically appear here.",
        actionLabel: "Explore Home",
        actionOnClick: "App.showPage('home')",
        secondaryLabel: "Browse Trending",
        secondaryOnClick: "App.handleNavItemClick('movies', 'browse', 'trending_movies')"
      });
      return;
    }

    grid.innerHTML = watched.map(item => {
      const safeId = String(item.id || "").replace(/'/g, "\\'");
      const safeMedia = String(item.media || "movie").replace(/'/g, "\\'");
      return `
        <div class="card history-card" onclick="App.openItem(${_jsonAttr(item)})">
          <div class="card-poster history-poster">
            <img src="${item.poster || ""}" alt="${_esc(item.title)}" class="card-img">
            <span class="card-badge badge-${item.media || "movie"}">
              ${(item.media || "movie").toUpperCase()}
            </span>
            <button type="button" class="history-remove-btn" onclick="event.stopPropagation(); event.preventDefault(); App.removeFromHistory('${safeId}', '${safeMedia}')" ontouchstart="event.stopPropagation();" aria-label="Remove from Watch History" title="Remove from Watch History">
              ${_CLOSE_SVG}
            </button>
          </div>
          <div class="card-info">
            <div class="card-title">${_esc(item.title)}</div>
            <div class="card-meta">
              <span>${item.season ? `S${item.season}E${item.episode}` : (item.media === "anime" || item.media === "donghua") ? (item.episode ? `Ep ${item.episode}` : "Anime") : "Movie"}</span>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // Helper helper to support submenu collapsing/expanding
  window.App = window.App || {};

  // ── Helpers ───────────────────────────────────────────────────────────
  // ── Server label helper ───────────────────────────────────────────────
  function _serverLabel(provKey) {
    const MAP = {
      server1: "Server 1",
      server2: "Server 2",
      server3: "Server 3",
      server4: "Server 4",
      server5: "Server 5",
      server6: "Server 6",
      server7: "Server 7",
      server8: "Server 8",
      server9: "Server 9",
      anikoto: "Server 1",
      megavid: "Server 2",
      vidcloud: "Server 3",
      zokoanime: "Server 4",
      anixo: "Server 5",
      vidnest: "Server 6",
      vidsync: "Server 7",
      anilink: "Server 7",
      aniembed: "Server 8",
      vidbolt: "Server 9"
    };
    if (MAP[provKey]) return MAP[provKey];
    const match = String(provKey || "").match(/^server(\d+)$/i);
    if (match) return `Server ${match[1]}`;
    return provKey ? `Server ${provKey}` : "Server 1";
  }


  function _esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function _plainLabel(label) {
    return String(label || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  }
  function _jsonAttr(obj) {
    return _esc(JSON.stringify(obj));
  }
  function _starsHTML(rating) {
    const full = Math.round(rating / 2);
    return Array.from({ length: 5 }, (_, i) =>
      `<svg class="star-icon${i < full ? " filled" : ""}" viewBox="0 0 24 24" width="13" height="13" fill="${i < full ? "var(--gold)" : "rgba(255,255,255,0.18)"}" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
    ).join("");
  }

  return {
    init,
    goHero,
    prevHero,
    nextHero,
    toggleHeroSound,
    openItem,
    openBrowse,
    toggleWL,
    showPage,
    onSearchInput,
    _renderHistoryRows,
    _closeAnimeDetail,
    _toggleAnimeWL,
    playAnimeEpisode,
    switchQuality,
    switchAudio,
    retryCurrentEpisode,
    switchProvider,
    ZokoAnimeMessageAdapter,
    _fetchAnimeEpisodes,
    setHlsLevel,
    setPlaybackSpeed,
    skipIntro,
    skipOutro,
    playNextEpisode,
    playPrevEpisode,
    cancelAutoNext,
    toggleMobileDrawer,
    handleNavItemClick,
    goBack,
    toggleContinueWatchingEdit,
    clearAllWatchHistory,
    onBrowseFilterChange,
    resetBrowseFilters,

    // Phase 2 Sidebar & Settings Toggles
    toggleSidebar,
    handleMenuToggle,
    toggleSidebarSubmenu,
    changeTheme,
    clearAllStorage,
    clearAllHistory,
    showNotificationsToast,
    showProfileToast,
    savePlayerPreference,

    // CineJoy Settings Actions
    switchSettingsTab,
    setEpisodeViewStyle,
    setDetailViewType,
    setLoaderGfxStyle,
    setSubtitleFont,
    setSubtitleSize,
    setSubtitleColor,
    toggleReduceMotion,
    toggleSpoilers,
    _updateSubtitlePreview,
    setDefaultServer,
    saveFebboxCookie,
    clearSiteData,

    // Search Helpers
    triggerSearch,
    setSearchContext,
    toggleMobileSearch,
    toggleSearchModal,
    setFilter,
    clearFilters,
    selectSearchHistory,
    clearSearchHistory,

    // Anime Hero & Home Section Controls
    _loadAnimeHero,
    _renderAnimeHero,
    goAnimeHero,
    prevAnimeHero,
    nextAnimeHero,
    switchHomeSection,
    scrollToAnimeRow,
    toggleAnimeTrailerSound,
    watchAnimeNow,
    onAnimeEpisodeSearch,
    clearAnimeEpisodeSearch,
    toggleAnimeSortOrder,

    // Phase 3 Player UX Actions
    setVolumeBoost,
    toggleShortcutHelp,
    toggleMiniEpisodeDrawer,
    toggleTheaterMode,
    captureScreenshot,
    togglePictureInPicture,
    CardPreview,

    // User Profile Actions
    toggleProfileDropdown,
    closeProfileDropdown,
    clearHistoryFromProfile,
    toggleAnimeAutoNext,
    playNextAnimeEpisode: playNextEpisode,

    // Legal Disclaimer & Guidelines Modal Actions
    openDisclaimerModal,
    closeDisclaimerModal,
    switchDisclaimerTab,

    // PWA & Cloud Backend Actions
    installPWA,
    saveBackendUrl,
    checkBackendStatus: _checkBackendStatus,

    // Row rails & History actions
    scrollRow,
    removeFromHistory,
    pauseRowAutoScroll: (rowId, ms) => _rowAutoScrolls.get(rowId)?.pauseTemporarily(ms),
    resumeRowAutoScroll: (rowId) => _rowAutoScrolls.get(rowId)?.startLoop(),
    filterCategory,
    dismissLoadingScreen: _dismissLoader,
    showActionLoader,
    hideActionLoader,
    _renderHero,

    // Streaming Platform Showcase
    selectPlatform,
    setPlatformMediaType,
    scrollPlatformRail,
    renderStreamingPlatformSection: _renderStreamingPlatformSection,
    filterByProvider,
    renderBrowseProvidersRow: _renderBrowseProvidersRow,

    // Live TV Module Reference
    LiveTV: window.LiveTV,

    // Empty and Error State Utility
    renderEmptyState,
    setAnimeAudioMode,
    stopAllHeroRotations: _stopAllHeroRotations,
    resumeHeroRotations: _resumeHeroRotations
  };
})();

window.App = App;
window.openDisclaimerModal = (tab) => App.openDisclaimerModal(tab);
window.closeDisclaimerModal = () => App.closeDisclaimerModal();
window.switchDisclaimerTab = (tab) => App.switchDisclaimerTab(tab);
window.installPWA = () => App.installPWA();
window.toggleMobileSearch = (force) => App.toggleMobileSearch(force);

// Boot when DOM is ready
document.addEventListener("DOMContentLoaded", () => App.init());
if ("serviceWorker" in navigator) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    navigator.serviceWorker.getRegistrations().then(regs => {
      for (const reg of regs) {
        reg.unregister();
      }
    });
    if ("caches" in window) {
      caches.keys().then(keys => {
        for (const k of keys) {
          caches.delete(k);
        }
      });
    }
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js?v=42.0")
        .then(reg => {
          reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          console.log("✅ Service Worker Registered & Updated", reg);
        })
        .catch(err => console.error("❌ Service Worker Error:", err));
    });
  }
}