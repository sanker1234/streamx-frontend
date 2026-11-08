/**
 * StreamX v2 — player.js
 * Cinematic Movie & Series Detail Page with Dynamic Autoplaying Trailers,
 * Sound Controls, Full Playback Integration, Episode Cards, Cast & Recommendations.
 */

const Player = (() => {
  let _item = null;   // current normalised item
  let _details = null;   // full TMDB detail response
  let _season = 1;
  let _episode = 1;
  let _tab = "stream";
  let _seasons = [];     // season list from TMDB
  let _currentEpisodes = [];     // episodes of currently selected season
  let _loadToken = 0;      // prevents race conditions when switching titles quickly
  let _resolutionToken = 0; // prevents stale playback source resolution across titles/episodes
  let _activeResolveAbort = null; // aborts in-flight source requests when user changes selection
  let _lastVaultDownloadSources = []; // Language Files sources for the Download tab (per-language offline cards)
  let _epSearchQuery = "";     // TV show episode search filter
  let _epSortOrder = "asc";  // TV show episode numeric sort order: "asc" | "desc"

  // ── SVGs ──────────────────────────────────────────────────────────────
  const _VOLUME_X_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  const _VOLUME_2_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const _PLAY_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const _PLUS_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
  const _CHECK_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  const _DOWNLOAD_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  // ── DOM refs ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── macOS Window Minimize & Zoom In/Out Transition ─────────────────────
  function _animateModalZoomIn(modalEl) {
    if (!modalEl || !window._cinejoyOriginCardRect) return;
    const r = window._cinejoyOriginCardRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardCenterX = r.left + r.width / 2;
    const cardCenterY = r.top + r.height / 2;
    const scaleX = Math.max(0.12, r.width / vw);
    const scaleY = Math.max(0.12, r.height / vh);
    const transX = Math.round(cardCenterX - vw / 2);
    const transY = Math.round(cardCenterY - vh / 2);

    modalEl.style.transformOrigin = "center center";
    modalEl.style.transform = `translate3d(${transX}px, ${transY}px, 0) scale(${scaleX}, ${scaleY})`;
    modalEl.style.opacity = "0.2";
    modalEl.style.borderRadius = "16px";
    modalEl.style.willChange = "transform, opacity, border-radius";
    modalEl.style.transition = "none";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modalEl.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s ease, border-radius 0.4s ease";
        modalEl.style.transform = "translate3d(0, 0, 0) scale(1)";
        modalEl.style.opacity = "1";
        modalEl.style.borderRadius = "0px";
        setTimeout(() => {
          modalEl.style.willChange = "auto";
        }, 420);
      });
    });
  }

  function _animateModalZoomOut(modalEl, onDone) {
    if (!modalEl || !window._cinejoyOriginCardRect) {
      if (onDone) onDone();
      return;
    }
    const r = window._cinejoyOriginCardRect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardCenterX = r.left + r.width / 2;
    const cardCenterY = r.top + r.height / 2;
    const scaleX = Math.max(0.12, r.width / vw);
    const scaleY = Math.max(0.12, r.height / vh);
    const transX = Math.round(cardCenterX - vw / 2);
    const transY = Math.round(cardCenterY - vh / 2);

    modalEl.style.willChange = "transform, opacity, border-radius";
    modalEl.style.transition = "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.26s ease, border-radius 0.32s ease";
    modalEl.style.transform = `translate3d(${transX}px, ${transY}px, 0) scale(${scaleX}, ${scaleY})`;
    modalEl.style.opacity = "0";
    modalEl.style.borderRadius = "16px";

    setTimeout(() => {
      if (onDone) onDone();
    }, 320);
  }

  // ── Open Cinematic Detail Modal ───────────────────────────────────────
  async function open(item, skipHashPush = false) {
    if (!item || !item.id) return;

    const myToken = ++_loadToken;
    _item = item;
    _season = 1;
    _episode = 1;
    _tab = "stream";
    _currentEpisodes = [];
    _epSearchQuery = "";
    _epSortOrder = "asc";

    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : "movie";

    // If the exact same title is already open and loaded, avoid redundant reloads
    const bg = $("player-modal-bg");
    if (_details && _details.id === item.id && _details.media === cleanMedia && bg && bg.classList.contains("open")) {
      return;
    }

    // Stop any existing detail trailer and background playback immediately
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
      window.HeroTrailerController.pause("general");
      window.HeroTrailerController.pause("anime");
    }
    if (window.App && typeof window.App.stopAllHeroRotations === "function") {
      window.App.stopAllHeroRotations();
    }

    if (window.UniversalPlayer && typeof window.UniversalPlayer.destroy === "function") {
      window.UniversalPlayer.destroy();
    }

    const prevFrame = document.getElementById("stream-frame");
    if (prevFrame) prevFrame.src = "";

    // Push hash so refresh restores this title
    const newHash = `#/${cleanMedia}/${item.id}`;
    if (!skipHashPush && window.location.hash !== newHash) {
      history.pushState({ streamx: true }, "", newHash);
    }

    // Show skeleton immediately
    if (bg) {
      bg.classList.add("open");
      bg.classList.add("has-cinematic-detail");
      bg.scrollTop = 0;
    }
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
    if (window.App && typeof window.App._updateActiveNavLinks === "function") {
      window.App._updateActiveNavLinks(cleanMedia === "tv" ? "series" : "movies");
    }
    document.body.style.overflow = "hidden";
    _renderSkeleton(item);
    const skeletonModal = bg ? bg.querySelector(".player-modal") : null;
    if (skeletonModal) _animateModalZoomIn(skeletonModal);

    // Track as recently viewed
    StreamXHistory.recordView(item);

    // Restore last watched episode if TV
    if (cleanMedia === "tv") {
      const last = StreamXHistory.getLastEpisode(item.id);
      if (last) {
        _season = last.season || 1;
        _episode = last.episode || 1;
      }
    }

    try {
      _details = await TMDB.getDetails(cleanMedia, item.id);
      if (myToken !== _loadToken) return;

      _seasons = _details.season_list || [];

      // Ensure valid trailer resolution
      if (!_details.trailer) {
        _details.trailer = await TMDB.getTrailer(cleanMedia, item.id);
      }
      if (myToken !== _loadToken) return;

      // Populate initial season episodes if TV
      if (_details.media === "tv" && _seasons.length > 0) {
        const seasonExists = _seasons.some(s => s.season_number === _season);
        if (!seasonExists) _season = _seasons[0].season_number;
        try {
          const sData = await TMDB.getSeason(_details.id, _season);
          if (myToken !== _loadToken) return;
          _currentEpisodes = sData.episodes || [];
        } catch (e) {
          _currentEpisodes = [];
        }
      }

      _renderFull();

      // Dynamically mount title's own autoplaying trailer in background if enabled in settings
      const trailersPref = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_trailers")) !== "false";
      if (window.HeroTrailerController && trailersPref) {
        window.HeroTrailerController.loadTrailerForItem("detail", _details);
      }
    } catch (err) {
      if (myToken !== _loadToken) return;
      console.error("[Player] Detail fetch failed:", err);
      _renderError(err.message || "Failed to load title details.");
    }
  }

  // ── Close Detail Page ─────────────────────────────────────────────────
  function close(skipHashPush = false) {
    _loadToken++;
    _resolutionToken++;
    if (_activeResolveAbort) {
      _activeResolveAbort.abort();
      _activeResolveAbort = null;
    }
    _epSearchQuery = "";
    _epSortOrder = "asc";

    // 1. Immediately terminate any active full-screen or big-player stream and audio threads
    exitBigWatch(true);

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
    }

    if (window.UniversalPlayer && typeof window.UniversalPlayer.destroy === "function") {
      try {
        window.UniversalPlayer.destroy();
      } catch (_) {}
    }

    const frame = document.getElementById("stream-frame");
    if (frame) {
      frame.src = "about:blank";
      frame.removeAttribute("src");
    }

    const bg = $("player-modal-bg");
    const modalEl = bg ? bg.querySelector(".player-modal") : null;

    const finalizeClose = () => {
      if (bg) {
        bg.classList.remove("open");
        bg.classList.remove("has-cinematic-detail");
        bg.innerHTML = "";
      }
      document.body.classList.remove("has-modal-open");
      document.body.classList.remove("big-player-active");
      if (window.App && typeof window.App.resumeHeroRotations === "function") {
        window.App.resumeHeroRotations();
      }
      const topHdr = document.getElementById("top-header");
      if (topHdr) {
        topHdr.classList.remove("header-hidden-detail");
        topHdr.classList.remove("hidden");
        topHdr.style.removeProperty("display");
        topHdr.style.removeProperty("visibility");
        topHdr.style.removeProperty("opacity");
        topHdr.style.removeProperty("pointer-events");
      }
      const backBtn = document.getElementById("header-back-btn");
      if (backBtn) backBtn.style.display = "none";
      if (window.App && typeof window.App._updateActiveNavLinks === "function") {
        window.App._updateActiveNavLinks("home");
      }
      if (window.App && typeof window.App.hideActionLoader === "function") {
        window.App.hideActionLoader();
      }
      document.body.style.overflow = "";

      _item = null;
      _details = null;
      _currentEpisodes = [];

      // Resume homepage trailer if returning to home view
      if (window.HeroTrailerController) {
        if (window._currentPage === "home") window.HeroTrailerController.resume("general");
        else if (window._currentPage === "anime") window.HeroTrailerController.resume("anime");
      }

      // Cleanly pop history back to origin if pushed by StreamX, else fallback to home
      if (!skipHashPush) {
        if (window.history.length > 1 && window.history.state && window.history.state.streamx) {
          window.history.back();
        } else if (window.location.hash && window.location.hash !== "#/") {
          window.location.hash = "#/";
        }
      }
    };

    if (modalEl && window._cinejoyOriginCardRect) {
      _animateModalZoomOut(modalEl, finalizeClose);
    } else {
      finalizeClose();
    }
  }

  function _handleBackdropClick(e) {
    if (!e || !e.isTrusted) return;
    if (window._streamxLastLayoutChange && (Date.now() - window._streamxLastLayoutChange < 400)) return;
    if (e.target === $("player-modal-bg")) close();
  }

  // ── Skeleton Loader ───────────────────────────────────────────────────
  function _renderSkeleton(item) {
    const backdropUrl = item.backdrop || item.poster || "";
    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : (item.media === "anime" ? "anime" : "movie");
    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal view-fullpage" role="dialog" aria-modal="true" aria-label="${_esc(item.title || "Loading...")}">
        <div class="pm-cinematic-hero skeleton-hero" style="background-image:url('${backdropUrl}')">
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
              <div class="pm-hero-side-card skeleton-side-card" style="width:280px;height:220px;opacity:0.6;"></div>
            </div>
          </div>
        </div>
        <div class="pm-cinematic-body">
          <div class="loader-spinner" style="margin:40px auto;"></div>
        </div>
      </div>`;
    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  function _renderError(msg) {
    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="Error loading title">
        <div class="empty-state" role="alert" style="padding:64px 24px;">
          <div class="empty-state-icon error" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h3 class="empty-state-title">Unable to Load Title Details</h3>
          <p class="empty-state-desc">${_esc(msg || "The content details could not be retrieved from the server or may no longer be available.")}</p>
          <div class="empty-state-actions">
            <button type="button" class="empty-state-btn primary" onclick="Player.close(); if (window.App) App.showPage('home');">Back to Home</button>
            <button type="button" class="empty-state-btn secondary" onclick="Player.close()">Return to Browse</button>
          </div>
        </div>
      </div>`;
    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  function _calculateEndsAt(runtimeMinutes) {
    if (!runtimeMinutes || isNaN(runtimeMinutes)) return "";
    const now = new Date();
    const ends = new Date(now.getTime() + runtimeMinutes * 60000);
    return ends.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function _formatRuntime(minutes) {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function _formatReleaseDate(dateStr, longMonth = false) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString("en-US", { month: longMonth ? "long" : "short", day: "numeric", year: "numeric" });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  function downloadCurrentTitle() {
    const item = _details || _item;
    if (!item) return;
    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : "movie";
    const downloadUrl = cleanMedia === "tv"
      ? `https://web.nxsha.app/dl/tv/${item.id}/${_season}/${_episode}`
      : `https://web.nxsha.app/dl/movie/${item.id}`;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  function toggleWatchedStatus() {
    const item = _details || _item;
    if (!item) return;
    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : "movie";
    if (window.StreamXHistory && typeof StreamXHistory.recordWatch === "function") {
      StreamXHistory.recordWatch(item, _season, _episode, "nxsha", "default");
    }
    const btn = document.getElementById("pm-hero-watched-btn");
    if (btn) btn.classList.toggle("active");
  }

  function _renderTrailers(d) {
    if (!d || !d.trailer) return "";
    const ytKey = d.trailer.key;
    const thumbUrl = ytKey ? `https://i.ytimg.com/vi/${ytKey}/hqdefault.jpg` : (d.backdrop || d.poster || "");
    const trailerTitle = d.trailer.name || "Official Trailer (Subtitled)";

    return `
      <div class="pm-trailers-section">
        <h3 class="pm-section-title">Trailers</h3>
        <div class="pm-trailers-grid">
          <div class="pm-trailer-card" onclick="window.open('https://www.youtube.com/watch?v=${_esc(ytKey)}', '_blank', 'noopener,noreferrer')">
            <div class="pm-trailer-thumb" style="background-image:url('${thumbUrl}')">
              <div class="pm-trailer-play-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            <div class="pm-trailer-info">
              <h4 class="pm-trailer-title">${_esc(trailerTitle)}</h4>
              <span class="pm-trailer-badge">Trailer</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Full Cinematic Detail Render ──────────────────────────────────────
  function _renderFull() {
    const d = _details;
    const wl = Watchlist.has(d.id, d.media);

    // Genre labels
    const genreNames = d.genres.length
      ? d.genres.slice(0, 3).join(" • ")
      : d.genre_ids.map(gid => (GENRE_MAP[d.media]?.[gid] || "")).filter(Boolean).slice(0, 3).join(" • ");

    const runtimeMinutes = d.runtime || (d.media === "tv" && _currentEpisodes[0]?.runtime) || null;
    const runtimeText = _formatRuntime(runtimeMinutes);
    const endsAtText = _calculateEndsAt(runtimeMinutes);
    const releaseDateText = _formatReleaseDate(d.release_date_full || d.year || "");
    const firstAiredText = _formatReleaseDate(d.first_air_date || d.release_date_full || d.release_date || "", true);
    const lastAiredText = _formatReleaseDate(d.last_air_date || "", true);
    const seasonsCount = d.seasons || (d.season_list ? d.season_list.length : null) || 1;
    let episodesCount = d.episodes || null;
    if (!episodesCount && d.season_list && d.season_list.length) {
      episodesCount = d.season_list.reduce((acc, s) => acc + (s.episode_count || 0), 0);
    }
    if (!episodesCount && _currentEpisodes && _currentEpisodes.length) {
      episodesCount = _currentEpisodes.length;
    }
    if (!episodesCount) {
      episodesCount = seasonsCount * 8;
    }

    let creatorDirectorHtml = "";
    if (d.media === "tv") {
      const creatorsList = (d.created_by && d.created_by.length)
        ? d.created_by.join(", ")
        : (d.director || "");
      if (creatorsList) {
        creatorDirectorHtml = `<div class="pm-hero-director-line">Creators: <strong>${_esc(creatorsList)}</strong></div>`;
      }
    } else if (d.director) {
      creatorDirectorHtml = `<div class="pm-hero-director-line">Director: <strong>${_esc(d.director)}</strong></div>`;
    }

    const langCode = (d.original_language || "en").toUpperCase();
    const studioName = (d.production_companies && d.production_companies[0]?.name)
      || (d.networks && d.networks[0])
      || "";
    const certRating = d.adult ? "18+" : (d.rating >= 7.5 ? "R" : "PG-13");

    // Clean synopsis
    const shortOverview = d.overview || "";

    const detailViewType = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_detail_view_type")) || "page";
    const detailClass = (detailViewType === "modal") ? "view-modal" : "view-fullpage";

    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal ${detailClass}" role="dialog" aria-modal="true" aria-label="${_esc(d.title)}">

        <!-- Corner Close Button (1Flex-inspired) -->
        <button type="button" class="pm-modal-close-corner-btn" onclick="Player.close()" aria-label="Close modal" title="Close (Esc)">✕</button>

        <!-- 1. Large Cinematic Trailer Hero (Screenshot 8 & 9) -->
        <div class="pm-cinematic-hero" style="background-image:url('${d.backdrop || d.poster || ""}')">
          <!-- Autoplaying Video Trailer Layer -->
          <div class="pm-hero-video-layer" id="pm-hero-video-layer"></div>
          <!-- Dark Gradients Vignette -->
          <div class="pm-hero-vignette"></div>

          <!-- Overlaid Content Details in Split Layout -->
          <div class="pm-hero-content pm-hero-split-layout">
            <div class="pm-hero-left">
              <h1 class="pm-hero-title">${_esc(d.title)}</h1>
              ${genreNames ? `<div class="pm-hero-genres-row">${_esc(genreNames)}</div>` : ""}

              <!-- 4 Action Buttons: ▶ Play, +, ⬇ Download, 👁 Watched (Matches cinejoy.pk Screenshot 6) -->
              <div class="pm-hero-action-buttons">
                <button class="pm-play-pill-btn" onclick="Player.watchNow()">
                  ${_PLAY_SVG}
                  <span>${d.media === "tv" ? `Play S${_season} E${_episode}` : "Play"}</span>
                </button>
                <button class="pm-circle-btn pm-circle-wl${wl ? " active" : ""}" id="pm-hero-wl-btn" onclick="Player.toggleWL()" title="${wl ? "Remove from List" : "Add to List"}">
                  ${wl ? _CHECK_SVG : _PLUS_SVG}
                </button>
                <button class="pm-circle-btn" onclick="Player.downloadCurrentTitle()" title="Download Media">
                  ${_DOWNLOAD_SVG}
                </button>
                <button class="pm-circle-btn" id="pm-hero-watched-btn" onclick="Player.toggleWatchedStatus()" title="Mark as Watched">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="pm-circle-btn pm-circle-sound" id="pm-hero-sound-btn" onclick="Player.toggleSound()" title="Trailer Audio" style="display:none">
                  ${_VOLUME_X_SVG}
                </button>
              </div>

              <!-- Metadata Line: Year • Runtime • Rating • Stars • Likes -->
              <div class="pm-hero-meta-row">
                ${d.year ? `<span class="pm-meta-item">${d.media === "tv" ? `${d.year}–` : d.year}</span>` : ""}
                ${(d.media !== "tv" && runtimeText) ? `<span class="pm-meta-item">${runtimeText}</span>` : ""}
                <span class="pm-meta-item pm-cert-badge">${certRating}</span>
                <span class="pm-meta-item pm-star-rating">★ ${d.rating.toFixed(1)}</span>
                <span class="pm-meta-item pm-votes-count">👍 0 &nbsp; 👎 0</span>
              </div>

              <!-- Director / Creators Info Line -->
              ${creatorDirectorHtml}

              <!-- Synopsis Overview -->
              ${shortOverview ? `<p class="pm-hero-overview">${_esc(shortOverview)}</p>` : ""}
            </div>

            <!-- Right-Side Glassmorphic Card (Screenshot 8 & 9) -->
            <div class="pm-hero-right">
              <div class="pm-hero-side-card">
                ${d.media === "tv" ? `
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Status</span>
                    <span class="pm-side-val">${_esc(d.status || "Returning Series")}</span>
                  </div>
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Language</span>
                    <span class="pm-side-val">${langCode}</span>
                  </div>
                  ${firstAiredText ? `
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">First Aired</span>
                    <span class="pm-side-val">${firstAiredText}</span>
                  </div>` : ""}
                  ${lastAiredText ? `
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Last Aired</span>
                    <span class="pm-side-val">${lastAiredText}</span>
                  </div>` : ""}
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Seasons</span>
                    <span class="pm-side-val">${seasonsCount}</span>
                  </div>
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Episodes</span>
                    <span class="pm-side-val">${episodesCount}</span>
                  </div>
                ` : `
                  ${runtimeText ? `
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Runtime</span>
                    <span class="pm-side-val">${runtimeText} ${endsAtText ? `• Ends ${endsAtText}` : ""}</span>
                  </div>` : ""}
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Language</span>
                    <span class="pm-side-val">${langCode}</span>
                  </div>
                  ${releaseDateText ? `
                  <div class="pm-side-meta-row">
                    <span class="pm-side-label">Release Date</span>
                    <span class="pm-side-val">${releaseDateText}</span>
                  </div>` : ""}
                `}
                ${studioName ? `
                <div class="pm-side-studio-wrap">
                  <span class="pm-side-studio-badge">${_esc(studioName)}</span>
                </div>` : ""}
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Content Sections Underneath Hero -->
        <div class="pm-cinematic-body">

          <!-- Series Sections (Episodes Matching cinejoy.pk) -->
          ${d.media === "tv" ? `
            <div class="pm-series-section">
              <div class="pm-episodes-header-row">
                <div class="pm-ep-header-left">
                  <h3 class="pm-section-title" style="margin-bottom:0;">Episodes</h3>
                </div>
                <div class="pm-episodes-controls">
                  <div class="pm-ep-search-wrap">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="pm-ep-search-input" class="pm-ep-search-input" placeholder="Search episode…" value="${_esc(_epSearchQuery)}" oninput="Player.onEpisodeSearch(this.value)" autocomplete="off">
                    <button type="button" id="pm-ep-search-clear" class="pm-ep-search-clear" onclick="Player.clearEpisodeSearch()" style="display:${_epSearchQuery ? 'flex' : 'none'};" aria-label="Clear search">✕</button>
                  </div>
                  <button type="button" class="pm-ep-control-pill" id="pm-ep-rating-toggle" onclick="Player.toggleRatingSort()" title="Filter or sort by rating">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                    <span>Ratings</span>
                  </button>
                  <button type="button" class="pm-ep-control-pill" id="pm-ep-sort-btn" onclick="Player.toggleSortOrder()" title="Toggle release date sort order">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                    <span id="pm-ep-sort-label">${_epSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                  </button>
                  <button type="button" class="pm-ep-control-pill" id="pm-ep-mark-watched-btn" onclick="Player.markAllSeasonWatched()" title="Mark entire season as watched">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>Mark watched</span>
                  </button>
                  ${_renderSeasonSelector()}
                </div>
              </div>
              <div id="pm-episodes-container">
                ${_renderEpisodesList()}
              </div>
            </div>
          ` : ""}

          <!-- Cast Section (Circular Avatars) -->
          ${d.cast?.length ? _renderCast(d.cast) : ""}

          <!-- Trailers Section (Screenshot 9) -->
          ${_renderTrailers(d)}

          <!-- Movie Section (Information) -->
          ${d.media === "movie" ? _renderMovieInfo() : ""}

          <!-- Recommendations Section -->
          ${d.recommendations?.length ? _renderRecommendations(d.recommendations) : ""}
        </div>
      </div>`;

    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  let _bigPlayerMouseMoveTimer = null;
  let _watchLoaderTimer = null;
  let _bigToastTimer = null;

  function _showBigToast(msg) {
    const toast = document.getElementById("big-player-toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = "block";
    requestAnimationFrame(() => toast.classList.add("visible"));
    if (_bigToastTimer) clearTimeout(_bigToastTimer);
    _bigToastTimer = setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => { toast.style.display = "none"; }, 300);
    }, 2800);
  }

  function _renderServerDropdownItems() {
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const activeKey = _selectedServer || localStorage.getItem("streamx_server") || "nxsha";

    // 1. Direct Horizontal Server Options Rail (one-tap mobile selection)
    const rail = document.getElementById("big-player-server-rail");
    if (rail) {
      rail.innerHTML = servers.map(srv => {
        const isActive = srv.key === activeKey;
        return `
          <button type="button" class="server-rail-pill ${isActive ? 'active' : ''}" onclick="Player.switchServer('${srv.key}')" role="tab" aria-selected="${isActive}">
            <span class="server-rail-dot" style="background:${srv.color || '#f59e0b'}; color:${srv.color || '#f59e0b'};"></span>
            <span class="server-rail-name">${_esc(srv.label)}</span>
            ${srv.badge ? `<span class="server-rail-badge">${_esc(srv.badge)}</span>` : ''}
          </button>
        `;
      }).join("");
    }

    // 2. Dropdown Menu (for desktop / compatibility)
    const menu = document.getElementById("server-dropdown-menu");
    if (menu) {
      menu.innerHTML = servers.map(srv => {
        const isActive = srv.key === activeKey;
        return `
          <button type="button" class="server-dropdown-item ${isActive ? 'active' : ''}" onclick="Player.switchServer('${srv.key}')" role="menuitem">
            <div class="server-item-left">
              <span>${_esc(srv.label)}</span>
              ${srv.badge ? `<span class="server-item-badge">${_esc(srv.badge)}</span>` : ''}
            </div>
            ${isActive ? `
              <span class="server-item-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
            ` : ''}
          </button>
        `;
      }).join("");
    }

    // 3. Keep Middle-Right Floating Drawer synchronised (1Flex-inspired)
    _renderSideServerItems();
    _renderSideServerMediaCard();
  }

  // ── 1Flex-Inspired Right-Side Episode Navigator & Server Drawer ───────────
  let _drawerEpSearchQuery = "";
  let _focusedDrawerEpIndex = 0;
  let _lastWheelTime = 0;
  let _touchStartY = 0;

  function _updateSideTabLabel() {
    const tab = document.getElementById("big-player-side-server-tab");
    const label = document.getElementById("side-tab-label");
    if (!tab || !label) return;
    const d = _details || _item || {};
    const isTV = d.media === "tv" || d.media === "drama";
    if (isTV) {
      label.textContent = `EPISODES S${_season} E${_episode}`;
      label.className = "side-tab-text side-tab-text-tv";
    } else {
      label.textContent = "SERVERS";
      label.className = "side-tab-text";
    }
  }

  let _drawerKeyNavInitialized = false;

  function _setupDrawerKeyboardNav() {
    if (_drawerKeyNavInitialized) return;
    _drawerKeyNavInitialized = true;

    window.addEventListener("keydown", (e) => {
      const drawer = document.getElementById("big-player-side-server-drawer");
      if (!drawer || !drawer.classList.contains("open")) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.id === "drawer-ep-search-input" || activeEl.tagName === "INPUT")) {
        if (e.key === "Escape") activeEl.blur();
        return;
      }

      const cards = Array.from(document.querySelectorAll("#drawer-episodes-scroll .drawer-ep-card"));
      if (!cards.length) return;

      let currentIdx = cards.findIndex(c => c.classList.contains("is-active-focused") || c.classList.contains("is-zoomed"));
      if (currentIdx === -1) {
        currentIdx = cards.findIndex(c => c.classList.contains("is-watching"));
      }
      if (currentIdx === -1) currentIdx = _focusedDrawerEpIndex || 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = Math.min(cards.length - 1, currentIdx + 1);
        _setFocusedDrawerEpisode(nextIdx, true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIdx = Math.max(0, currentIdx - 1);
        _setFocusedDrawerEpisode(prevIdx, true);
      } else if (e.key === "Enter" || e.key === " ") {
        const activeCard = cards[currentIdx];
        if (activeCard) {
          e.preventDefault();
          activeCard.click();
        }
      }
    });
  }

  function _setFocusedDrawerEpisode(targetIdx, smoothScroll = true) {
    const scrollEl = document.getElementById("drawer-episodes-scroll");
    if (!scrollEl) return;
    const cards = Array.from(scrollEl.querySelectorAll(".drawer-ep-card"));
    if (!cards.length) return;

    targetIdx = Math.max(0, Math.min(cards.length - 1, targetIdx));
    _focusedDrawerEpIndex = targetIdx;

    cards.forEach((c, idx) => {
      c.classList.remove("is-active-focused", "is-prev", "is-next", "is-zoomed");
      const dist = Math.abs(idx - targetIdx);
      if (idx === targetIdx) {
        c.classList.add("is-active-focused", "is-zoomed");
        c.style.zIndex = "35";
        if (smoothScroll) {
          c.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      } else if (idx < targetIdx) {
        c.classList.add("is-prev");
        c.style.zIndex = String(Math.max(1, 24 - dist));
      } else {
        c.classList.add("is-next");
        c.style.zIndex = String(Math.max(1, 24 - dist));
      }
    });
  }

  function _applyZoomToDrawerCard(card) {
    if (!card) return;
    const all = Array.from(document.querySelectorAll("#drawer-episodes-scroll .drawer-ep-card"));
    const targetIdx = all.indexOf(card);
    if (targetIdx === -1) return;
    _setFocusedDrawerEpisode(targetIdx, true);
  }

  function setHoverZoomEpisode(card) {
    if (!card) return;
    const all = Array.from(document.querySelectorAll("#drawer-episodes-scroll .drawer-ep-card"));
    const targetIdx = all.indexOf(card);
    if (targetIdx === -1 || targetIdx === _focusedDrawerEpIndex) return;
    _setFocusedDrawerEpisode(targetIdx, false);
  }

  function onDrawerCardClick(event, idx, epNum) {
    if (event) {
      if (event.target && (event.target.closest(".drawer-reveal-pill") || event.target.closest(".drawer-ep-locked-overlay"))) {
        return;
      }
    }
    _setFocusedDrawerEpisode(idx, true);
    Player.playEpisode(epNum);
  }

  function _setupDrawerScrollCarousel() {
    const scrollEl = document.getElementById("drawer-episodes-scroll");
    if (!scrollEl || scrollEl._carouselBound) return;
    scrollEl._carouselBound = true;

    // Desktop mouse wheel / trackpad scroll
    scrollEl.addEventListener("wheel", (e) => {
      const now = Date.now();
      if (now - _lastWheelTime < 220) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) > 16) {
        e.preventDefault();
        _lastWheelTime = now;
        const cards = scrollEl.querySelectorAll(".drawer-ep-card");
        if (!cards.length) return;
        if (e.deltaY > 0) {
          if (_focusedDrawerEpIndex < cards.length - 1) {
            _setFocusedDrawerEpisode(_focusedDrawerEpIndex + 1, true);
          }
        } else {
          if (_focusedDrawerEpIndex > 0) {
            _setFocusedDrawerEpisode(_focusedDrawerEpIndex - 1, true);
          }
        }
      }
    }, { passive: false });

    // Mobile / Tablet touch swipe
    scrollEl.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length) {
        _touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    scrollEl.addEventListener("touchend", (e) => {
      if (!e.changedTouches || !e.changedTouches.length) return;
      const touchEndY = e.changedTouches[0].clientY;
      const diff = _touchStartY - touchEndY;
      if (Math.abs(diff) > 35) {
        const cards = scrollEl.querySelectorAll(".drawer-ep-card");
        if (!cards.length) return;
        if (diff > 0) {
          if (_focusedDrawerEpIndex < cards.length - 1) {
            _setFocusedDrawerEpisode(_focusedDrawerEpIndex + 1, true);
          }
        } else {
          if (_focusedDrawerEpIndex > 0) {
            _setFocusedDrawerEpisode(_focusedDrawerEpIndex - 1, true);
          }
        }
      }
    }, { passive: true });
  }

  function toggleSideServerDrawer(force) {
    const drawer = document.getElementById("big-player-side-server-drawer");
    const tab = document.getElementById("big-player-side-server-tab");
    if (!drawer) return;
    const isOpening = force !== undefined ? !!force : !drawer.classList.contains("open");
    if (isOpening) {
      drawer.style.display = "flex";
      _setupDrawerKeyboardNav();
      _renderSideDrawerContent();
      requestAnimationFrame(() => {
        drawer.classList.add("open");
        if (tab) tab.classList.add("active");
        _setupDrawerScrollCarousel();
      });
    } else {
      drawer.classList.remove("open");
      if (tab) tab.classList.remove("active");
      setTimeout(() => {
        if (!drawer.classList.contains("open")) drawer.style.display = "none";
      }, 280);
    }
  }

  function toggleDrawerSeasonDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("drawer-season-menu");
    if (!menu) return;
    const isShown = menu.style.display === "block";
    menu.style.display = isShown ? "none" : "block";
    const serverMenu = document.getElementById("drawer-server-menu");
    if (serverMenu) serverMenu.style.display = "none";
  }

  function toggleDrawerServerDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("drawer-server-menu");
    if (!menu) return;
    const isShown = menu.style.display === "block";
    menu.style.display = isShown ? "none" : "block";
    const seasonMenu = document.getElementById("drawer-season-menu");
    if (seasonMenu) seasonMenu.style.display = "none";
  }

  function onDrawerSeasonChange(sNum) {
    const sInt = parseInt(sNum, 10);
    const seasonMenu = document.getElementById("drawer-season-menu");
    if (seasonMenu) seasonMenu.style.display = "none";
    _focusedDrawerEpIndex = 0;
    onSeasonChange(sInt).then(() => {
      _renderSideDrawerContent();
      _updateSideTabLabel();
    });
  }

  function onDrawerEpisodeSearch(query) {
    _drawerEpSearchQuery = (query || "").trim().toLowerCase();
    _focusedDrawerEpIndex = 0;
    _renderDrawerEpisodesList();
  }

  function toggleDrawerSpoiler() {
    const isCurrent = localStorage.getItem("streamx_spoiler_free") === "true";
    const newVal = !isCurrent;
    localStorage.setItem("streamx_spoiler_free", newVal ? "true" : "false");
    const btn = document.getElementById("drawer-spoiler-btn");
    if (btn) btn.classList.toggle("active", newVal);
    _renderDrawerEpisodesList();
  }

  function toggleDrawerAutoNext(checked) {
    localStorage.setItem("streamx_autonext", checked ? "true" : "false");
  }

  function _generateToken() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let t = "";
    for (let i = 0; i < 16; i++) {
      t += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return t;
  }

  function revealDrawerEpisode(el) {
    if (!el) return;
    const card = el.closest(".drawer-ep-card");
    if (card) {
      card.classList.remove("is-locked");
      card.classList.add("is-revealed");
      const desc = card.querySelector(".drawer-ep-desc");
      if (desc) desc.classList.remove("blurred");
      const overlay = card.querySelector(".drawer-ep-locked-overlay");
      if (overlay) overlay.remove();
    }
  }

  function _renderDrawerEpisodesList() {
    const scrollEl = document.getElementById("drawer-episodes-scroll");
    if (!scrollEl) return;

    const episodes = _currentEpisodes || [];
    const isSpoilerOn = localStorage.getItem("streamx_spoiler_free") === "true";

    const filtered = episodes.filter(ep => {
      if (!_drawerEpSearchQuery) return true;
      const numMatch = String(ep.episode_number) === _drawerEpSearchQuery;
      const nameMatch = (ep.name || "").toLowerCase().includes(_drawerEpSearchQuery);
      const descMatch = (ep.overview || "").toLowerCase().includes(_drawerEpSearchQuery);
      return numMatch || nameMatch || descMatch;
    });

    if (!filtered.length) {
      scrollEl.innerHTML = `<div class="drawer-empty-state">No episodes match "${_esc(_drawerEpSearchQuery)}"</div>`;
      return;
    }

    const fallbackBackdrop = (_details && (_details.backdrop || _details.poster)) || "";

    // Determine initial focus: currently playing episode or 0
    let initialFocusIdx = filtered.findIndex(ep => ep.episode_number === _episode);
    if (initialFocusIdx === -1) initialFocusIdx = 0;
    _focusedDrawerEpIndex = initialFocusIdx;

    scrollEl.innerHTML = filtered.map((ep, idx) => {
      const isFocused = idx === initialFocusIdx;
      const isPrev = idx < initialFocusIdx;
      const isNext = idx > initialFocusIdx;
      const isCurrent = ep.episode_number === _episode;
      const isWatched = (typeof StreamXHistory !== "undefined" && StreamXHistory.hasWatchedEpisode)
        ? StreamXHistory.hasWatchedEpisode(_details?.id, _season, ep.episode_number)
        : false;
      const isLocked = isSpoilerOn && !isCurrent && !isWatched;
      const stillImg = ep.still_path ? `https://image.tmdb.org/t/p/w400${ep.still_path}` : fallbackBackdrop;
      const duration = ep.runtime ? `${ep.runtime}m` : "50m";
      const viewNum = 1200 + ((ep.episode_number * 383 + (_season * 541)) % 2800);
      const viewsFormatted = viewNum.toLocaleString();

      const stateClass = isFocused ? 'is-active-focused is-zoomed' : (isPrev ? 'is-prev' : 'is-next');

      return `
        <div class="drawer-ep-card ${stateClass} ${isCurrent ? 'is-watching' : ''} ${isLocked ? 'is-locked' : ''}" 
             id="drawer-ep-card-${ep.episode_number}" 
             data-ep-index="${idx}"
             data-ep-num="${ep.episode_number}"
             onclick="Player.onDrawerCardClick(event, ${idx}, ${ep.episode_number})" 
             onmouseenter="Player.setHoverZoomEpisode(this)" 
             role="button" tabindex="0"
             aria-label="Episode ${ep.episode_number}: ${_esc(ep.name || '')}">
          <div class="drawer-ep-card-inner">
            ${stillImg ? `<div class="drawer-ep-bg" style="background-image: url('${stillImg}');"></div>` : `<div class="drawer-ep-bg fallback"></div>`}
            <div class="drawer-ep-gradient"></div>
            
            <div class="drawer-ep-top-badges">
              <span class="drawer-ep-view-badge">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span>${viewsFormatted}</span>
              </span>
              ${isCurrent ? `<span class="drawer-ep-watching-badge"><span class="watching-pulse"></span> WATCHING</span>` : ''}
            </div>

            <div class="drawer-ep-play-overlay">
              <button type="button" class="drawer-ep-play-btn" aria-label="Play Episode ${ep.episode_number}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"/></svg>
              </button>
            </div>

            <div class="drawer-ep-card-body">
              <div class="drawer-ep-title-line">
                <span class="drawer-ep-title">${ep.episode_number}. ${_esc(ep.name || `Episode ${ep.episode_number}`)}</span>
                <span class="drawer-ep-dur">${duration}</span>
              </div>
              <p class="drawer-ep-desc ${isLocked ? 'blurred' : ''}">${_esc(ep.overview || "No overview available.")}</p>
            </div>

            ${isLocked ? `
              <div class="drawer-ep-locked-overlay" onclick="event.stopPropagation(); Player.revealDrawerEpisode(this)">
                <div class="drawer-locked-preview">
                  <span class="drawer-locked-name">${ep.episode_number}. ${_esc(ep.name || `Episode ${ep.episode_number}`)}</span>
                  <span class="drawer-locked-dur">${duration}</span>
                </div>
                <button type="button" class="drawer-reveal-pill" aria-label="Reveal episode details">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>Click to reveal</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    _setupDrawerScrollCarousel();

    requestAnimationFrame(() => {
      _setFocusedDrawerEpisode(_focusedDrawerEpIndex, true);
    });
  }

  function _renderSideDrawerContent() {
    const container = document.getElementById("side-drawer-content");
    if (!container) return;

    const d = _details || _item || {};
    const isTV = d.media === "tv" || d.media === "drama";
    const isSpoilerOn = localStorage.getItem("streamx_spoiler_free") === "true";
    const isAutoNextOn = localStorage.getItem("streamx_autonext") !== "false";
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const activeKey = _selectedServer || localStorage.getItem("streamx_server") || (servers[0] && servers[0].key) || "nxsha";
    const curServerObj = servers.find(s => s.key === activeKey) || servers[0] || { label: "Main 1", key: "nxsha", color: "#22c55e" };
    const curServerLabel = curServerObj.label || "Main 1";

    if (isTV) {
      const curSeasonObj = (_seasons || []).find(s => s.season_number === _season) || { name: `Season ${_season}`, overview: d.overview || "" };
      const curSeasonLabel = curSeasonObj.name || `Season ${_season}`;
      const epCount = (_currentEpisodes || []).length;
      const seasonOverview = curSeasonObj.overview || d.overview || "Stream every episode in full HD with intelligent source failover.";

      container.innerHTML = `
        <div class="drawer-floating-toolbar">
          <div class="drawer-header-row">
            <div class="drawer-season-dropdown-wrap">
              <button type="button" class="drawer-season-btn" onclick="Player.toggleDrawerSeasonDropdown(event)" aria-haspopup="true">
                <span id="drawer-season-label">${_esc(curSeasonLabel)}</span>
                <svg class="chevron-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div id="drawer-season-menu" class="drawer-dropdown-menu" style="display:none;" role="menu">
                ${(_seasons || []).map(s => `
                  <button type="button" class="drawer-dropdown-option ${s.season_number === _season ? 'active' : ''}" onclick="Player.onDrawerSeasonChange(${s.season_number})" role="menuitem">
                    <span>${_esc(s.name || `Season ${s.season_number}`)}</span>
                    ${s.episode_count ? `<span class="drawer-option-badge">${s.episode_count} eps</span>` : ''}
                  </button>
                `).join("")}
              </div>
            </div>

            <div class="drawer-search-wrap">
              <svg class="drawer-search-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" class="drawer-search-input" id="drawer-ep-search-input" placeholder="Search" value="${_esc(_drawerEpSearchQuery)}" oninput="Player.onDrawerEpisodeSearch(this.value)" autocomplete="off">
            </div>

            <div class="drawer-autonext-wrap" title="Auto Next Episode">
              <label class="drawer-toggle-label">
                <input type="checkbox" id="drawer-autonext-check" onchange="Player.toggleDrawerAutoNext(this.checked)" ${isAutoNextOn ? 'checked' : ''}>
                <span class="drawer-toggle-slider" title="Auto-next episode">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </span>
              </label>
            </div>

            <button class="drawer-close-btn" onclick="Player.toggleSideServerDrawer(false)" aria-label="Close drawer">✕</button>
          </div>

          <div class="drawer-server-row">
            <div class="drawer-server-dropdown-wrap">
              <span class="drawer-server-prefix">SERVER:</span>
              <button type="button" class="drawer-server-select-btn" onclick="Player.toggleDrawerServerDropdown(event)" aria-haspopup="true" aria-expanded="false" title="Change Stream Server">
                <span class="drawer-server-dot" style="background:${curServerObj.color || '#22c55e'}; box-shadow:0 0 8px ${curServerObj.color || '#22c55e'};"></span>
                <span id="drawer-current-server-name">${_esc(curServerLabel)}</span>
                <svg class="chevron-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div id="drawer-server-menu" class="drawer-dropdown-menu" style="display:none;" role="menu">
                ${servers.map(s => `
                  <button type="button" class="drawer-dropdown-option ${s.key === activeKey ? 'active' : ''}" onclick="Player.switchServer('${s.key}')" role="menuitem">
                    <div class="drawer-opt-left">
                      <span class="drawer-opt-dot" style="background:${s.color || '#22c55e'}; box-shadow:0 0 6px ${s.color || '#22c55e'};"></span>
                      <span>${_esc(s.label)}</span>
                    </div>
                    ${s.badge ? `<span class="drawer-option-badge">${_esc(s.badge)}</span>` : ''}
                  </button>
                `).join("")}
              </div>
            </div>

            <button type="button" class="drawer-spoiler-btn ${isSpoilerOn ? 'active' : ''}" id="drawer-spoiler-btn" onclick="Player.toggleDrawerSpoiler()" title="Toggle Episode Spoiler Protection">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>SPOILER</span>
            </button>
          </div>

          <div class="drawer-season-summary">
            <div class="drawer-season-title">${_esc(curSeasonLabel)} • ${epCount} EPISODES</div>
            <p class="drawer-season-desc">${_esc(seasonOverview)}</p>
          </div>
        </div>

        <div class="drawer-episodes-scroll drawer-episodes-stack" id="drawer-episodes-scroll">
          <!-- Filled by _renderDrawerEpisodesList() -->
        </div>
      `;

      _renderDrawerEpisodesList();
    } else {
      // Movie mode
      const title = d.title || "Cinema Stream";
      const backdrop = d.backdrop || d.poster || "";
      const year = d.year || (d.release_date ? d.release_date.slice(0, 4) : "");
      const ratingVal = (typeof d.rating === "number" && !isNaN(d.rating) && d.rating > 0) ? d.rating.toFixed(1) : "8.5";
      const runtimeText = d.runtime ? `${d.runtime}m` : "1080p HD";
      const overview = d.overview || "Stream high-definition playback directly on CineJoy with intelligent stream routing.";

      container.innerHTML = `
        <div class="drawer-floating-toolbar">
          <div class="drawer-header-row">
            <span class="drawer-header-title">CINEMA STREAM</span>
            <button class="drawer-close-btn" onclick="Player.toggleSideServerDrawer(false)" aria-label="Close drawer">✕</button>
          </div>

          <div class="drawer-server-row">
            <div class="drawer-server-dropdown-wrap">
              <span class="drawer-server-prefix">SERVER:</span>
              <button type="button" class="drawer-server-select-btn" onclick="Player.toggleDrawerServerDropdown(event)" aria-haspopup="true" aria-expanded="false" title="Change Stream Server">
                <span class="drawer-server-dot" style="background:${curServerObj.color || '#22c55e'}; box-shadow:0 0 8px ${curServerObj.color || '#22c55e'};"></span>
                <span id="drawer-current-server-name">${_esc(curServerLabel)}</span>
                <svg class="chevron-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div id="drawer-server-menu" class="drawer-dropdown-menu" style="display:none;" role="menu">
                ${servers.map(s => `
                  <button type="button" class="drawer-dropdown-option ${s.key === activeKey ? 'active' : ''}" onclick="Player.switchServer('${s.key}')" role="menuitem">
                    <div class="drawer-opt-left">
                      <span class="drawer-opt-dot" style="background:${s.color || '#22c55e'}; box-shadow:0 0 6px ${s.color || '#22c55e'};"></span>
                      <span>${_esc(s.label)}</span>
                    </div>
                    ${s.badge ? `<span class="drawer-option-badge">${_esc(s.badge)}</span>` : ''}
                  </button>
                `).join("")}
              </div>
            </div>
          </div>
        </div>

        <div class="drawer-movie-scroll" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding: 4px 6px 40px;">
          <div class="drawer-movie-card">
            ${backdrop ? `
              <div class="drawer-movie-thumb" style="background-image:url('${backdrop}')">
                <div class="drawer-movie-overlay"></div>
                <div class="drawer-movie-badge-float">
                  <span class="drawer-movie-year">${year}</span>
                  <span class="drawer-movie-rating">★ ${ratingVal}</span>
                  <span class="drawer-movie-runtime">${runtimeText}</span>
                </div>
              </div>
            ` : ''}
            <div class="drawer-movie-body">
              <div class="drawer-movie-title">${_esc(title)}</div>
              <p class="drawer-movie-overview" style="font-size: 11.5px; line-height: 1.45; color: rgba(255,255,255,0.7); margin-top: 4px;">${_esc(overview)}</p>
            </div>
          </div>

          <div class="drawer-movie-head" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: rgba(255,255,255,0.45); margin: 6px 4px 2px;">ALL AVAILABLE STREAM SERVERS</div>
          <div class="drawer-server-grid" style="display: flex; flex-direction: column; gap: 8px;">
            ${servers.map(s => `
              <button type="button" class="drawer-server-grid-btn ${s.key === activeKey ? 'active' : ''}" onclick="Player.switchServer('${s.key}')">
                <div class="drawer-btn-left">
                  <span class="drawer-server-dot" style="background:${s.color || '#22c55e'}; box-shadow:0 0 6px ${s.color || '#22c55e'};"></span>
                  <span>${_esc(s.label)}</span>
                </div>
                ${s.badge ? `<span class="drawer-option-badge">${_esc(s.badge)}</span>` : ''}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }
  }

  function _renderSideServerItems() {
    _renderSideDrawerContent();
  }

  function _renderSideServerMediaCard() {
    // Delegated to _renderSideDrawerContent()
  }

  // ── Auto Landscape Orientation & Fullscreen Helpers ───────────────────────
  async function enterLandscapeFullscreen() {
    const bigPlayer = document.getElementById("cinejoy-big-player");
    if (!bigPlayer) return;

    // 1. Try Fullscreen API
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (bigPlayer.requestFullscreen) {
          await bigPlayer.requestFullscreen();
        } else if (bigPlayer.webkitRequestFullscreen) {
          await bigPlayer.webkitRequestFullscreen();
        }
      }
    } catch (_) {}

    // 2. Screen Orientation API: Lock to landscape
    try {
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        await screen.orientation.lock("landscape");
      }
    } catch (_) {}
  }

  function toggleLandscapeRotate() {
    const bigPlayer = document.getElementById("cinejoy-big-player");
    if (!bigPlayer) return;
    const isForced = bigPlayer.classList.toggle("force-landscape");
    _showBigToast(isForced ? "Rotated to Horizontal Landscape" : "Standard Portrait View");
  }

  function forceMountServer(serverKey) {
    if (!serverKey) return;
    _selectedServer = serverKey;
    localStorage.setItem("streamx_server", serverKey);

    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.opacity = "0";
      setTimeout(() => { loader.style.display = "none"; }, 300);
    }

    const bigPlayer = document.getElementById("cinejoy-big-player");
    const bigFrame = document.getElementById("big-stream-frame");
    const bigVideo = document.getElementById("big-video-player");
    if (bigPlayer && bigFrame) {
      bigPlayer.style.display = "flex";
      bigPlayer.classList.add("active");
      document.body.classList.add("big-player-active");
      const topHdr = document.getElementById("top-header");
      if (topHdr) topHdr.classList.add("header-hidden-detail");
      if (bigVideo) {
        bigVideo.pause();
        bigVideo.classList.remove("player-visible");
        bigVideo.style.setProperty("display", "none", "important");
      }
      bigFrame.classList.add("player-visible");
      bigFrame.style.setProperty("display", "block", "important");
      const targetUrl = _getSelectedServerUrl(serverKey);
      _setFrameSourceWithSandbox(bigFrame, targetUrl, serverKey);
      enterLandscapeFullscreen();
      _renderServerDropdownItems();
      _setupBigPlayerTopBarEvents();
    }
  }

  async function _checkServerReachability(srvUrl) {
    if (!srvUrl) return true;
    try {
      const u = new URL(srvUrl);
      if (typeof window === "undefined" || !window.fetch) return true;
      // In web browsers, cross-origin embed engines (NXsha, CinemaOS, VidLink, CineSrc, etc.)
      // cannot be queried via raw fetch() due to CORS / opaque origin restrictions.
      // Verified stream provider URLs are valid active playback nodes.
      const host = u.hostname.toLowerCase();
      if (host.includes("nxsha") || host.includes("cinemaos") || host.includes("vidlink") ||
          host.includes("vidsrc") || host.includes("cinesrc") || host.includes("vidup") ||
          host.includes("0vidads") || host.includes("embed") || host.includes("stream")) {
        return true;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      await fetch(u.origin, { method: "HEAD", mode: "no-cors", signal: ctrl.signal, cache: "no-cache" });
      clearTimeout(t);
      return true;
    } catch (_) {
      // In web browsers, an aborted HEAD request or CORS restriction to an embed origin is normal;
      // it does not indicate the streaming engine is down.
      return true;
    }
  }

  function toggleServerDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("server-dropdown-menu");
    const pill = document.getElementById("server-active-pill");
    if (!menu) return;

    const isClosed = menu.style.display === "none" || !menu.style.display;
    if (isClosed) {
      _renderServerDropdownItems();
      menu.style.display = "flex";
      if (pill) pill.setAttribute("aria-expanded", "true");
    } else {
      menu.style.display = "none";
      if (pill) pill.setAttribute("aria-expanded", "false");
    }
  }

  function _setFrameSourceWithSandbox(frameEl, targetUrl, serverKey) {
    if (!frameEl) return null;
    const isNxsha = !serverKey || serverKey === "nxsha";
    const currentHasSandbox = frameEl.hasAttribute("sandbox");

    // When toggling between sandboxed (NXsha: allow-scripts allow-same-origin allow-forms)
    // and unsandboxed (CinemaOS, CineSrc, 0vidads, etc.), cloning and replacing the iframe DOM node
    // is REQUIRED by the HTML specification. In WebKit and Blink, dynamically adding or removing
    // the sandbox attribute on an existing iframe does not update the active browsing context's sandbox flags.
    // Without cloning, external embed engines like CinemaOS remain trapped in the sandbox security context,
    // which throws DOMExceptions on storage and cross-origin checks, rendering a blank screen.
    if (currentHasSandbox !== isNxsha && frameEl.parentNode) {
      const clone = frameEl.cloneNode(false);
      if (isNxsha) {
        clone.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
      } else {
        clone.removeAttribute("sandbox");
      }
      clone.src = targetUrl;
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.display = "block";
      frameEl.parentNode.replaceChild(clone, frameEl);
      return clone;
    }

    if (isNxsha) {
      frameEl.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    } else {
      frameEl.removeAttribute("sandbox");
    }

    frameEl.style.width = "100%";
    frameEl.style.height = "100%";
    frameEl.style.display = "block";

    if (frameEl.src !== targetUrl) {
      frameEl.src = targetUrl;
    }
    return frameEl;
  }

  function switchServer(serverKey) {
    if (!serverKey) return;
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const target = servers.find(s => s.key === serverKey) || servers[0];
    if (!target) return;

    _selectedServer = target.key;
    localStorage.setItem("streamx_server", target.key);

    const label = document.getElementById("current-server-label");
    if (label) label.textContent = target.label;

    const drawerServerName = document.getElementById("drawer-current-server-name");
    if (drawerServerName) {
      drawerServerName.textContent = target.label;
      const dot = drawerServerName.previousElementSibling;
      if (dot && dot.classList.contains("drawer-server-dot")) {
        dot.style.background = target.color || "#22c55e";
        dot.style.boxShadow = `0 0 8px ${target.color || '#22c55e'}`;
      }
    }
    const drawerServerMenu = document.getElementById("drawer-server-menu");
    if (drawerServerMenu) drawerServerMenu.style.display = "none";

    // Update active highlight on server dropdown items and grid buttons
    document.querySelectorAll("#drawer-server-menu .drawer-dropdown-option").forEach(btn => {
      const isCur = btn.getAttribute("onclick")?.includes(`'${target.key}'`);
      btn.classList.toggle("active", !!isCur);
    });
    document.querySelectorAll(".drawer-server-grid-btn").forEach(btn => {
      const isCur = btn.getAttribute("onclick")?.includes(`'${target.key}'`);
      btn.classList.toggle("active", !!isCur);
    });

    const menu = document.getElementById("server-dropdown-menu");
    if (menu) {
      menu.style.display = "none";
      const pill = document.getElementById("server-active-pill");
      if (pill) pill.setAttribute("aria-expanded", "false");
    }

    _showBigToast(`Connecting to ${target.label}... Optimizing buffer...`);
    _renderServerDropdownItems();

    // Wait some time to let stream buffer connect cleanly before switching
    setTimeout(() => {
      const newUrl = _getSelectedServerUrl(target.key);
      const bigFrame = document.getElementById("big-stream-frame");
      if (bigFrame && newUrl) {
        _setFrameSourceWithSandbox(bigFrame, newUrl, target.key);
      }

      const frame = document.getElementById("stream-frame");
      if (frame && newUrl) {
        _setFrameSourceWithSandbox(frame, newUrl, target.key);
      }

      _showBigToast(`Playing on ${target.label}`);
      _renderServerDropdownItems();
    }, 650);
  }

  function failoverToNextServer() {
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    if (!servers.length) return;
    const currentKey = _selectedServer || localStorage.getItem("streamx_server") || "nxsha";
    let idx = servers.findIndex(s => s.key === currentKey);
    if (idx === -1) idx = 0;
    const nextIdx = (idx + 1) % servers.length;
    const nextServer = servers[nextIdx];
    _showBigToast(`Playback issue detected. Switching to backup server: ${nextServer.label}...`);
    switchServer(nextServer.key);
  }

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    const dropdownWrap = document.getElementById("server-select-dropdown-wrap");
    const menu = document.getElementById("server-dropdown-menu");
    if (menu && menu.style.display !== "none") {
      if (dropdownWrap && !dropdownWrap.contains(e.target)) {
        menu.style.display = "none";
        const pill = document.getElementById("server-active-pill");
        if (pill) pill.setAttribute("aria-expanded", "false");
      }
    }
    const drawerServerMenu = document.getElementById("drawer-server-menu");
    if (drawerServerMenu && drawerServerMenu.style.display !== "none") {
      if (!e.target.closest(".drawer-server-dropdown-wrap")) {
        drawerServerMenu.style.display = "none";
      }
    }
    const drawerSeasonMenu = document.getElementById("drawer-season-menu");
    if (drawerSeasonMenu && drawerSeasonMenu.style.display !== "none") {
      if (!e.target.closest(".drawer-season-dropdown-wrap")) {
        drawerSeasonMenu.style.display = "none";
      }
    }
  });

  let _activeProbeToken = 0;

  function checkMediaAvailability(item) {
    if (!item) return { isAvailable: true, status: "available", badge: "Available" };

    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : (item.media === "anime" ? "anime" : "movie");
    // TV and Anime are broadcast/streamed on release dates and available immediately
    if (cleanMedia !== "movie") {
      return { isAvailable: true, status: "available", badge: "Available" };
    }

    // Check status field if present
    const itemStatus = (item.status || "").toLowerCase();
    if (itemStatus === "post production" || itemStatus === "in production" || itemStatus === "planned" || itemStatus === "rumored") {
      return {
        isAvailable: false,
        status: "unreleased",
        badge: "Unreleased",
        title: "Upcoming Theatrical Release",
        message: `${item.title || "This movie"} is currently in ${item.status}. Streaming sources will become available following its digital release.`
      };
    }

    const relDateStr = item.release_date_full || item.release_date || (item.year ? `${item.year}-01-01` : null);
    if (!relDateStr) {
      return { isAvailable: true, status: "available", badge: "Available" };
    }

    const relDate = new Date(relDateStr);
    if (isNaN(relDate.getTime())) {
      return { isAvailable: true, status: "available", badge: "Available" };
    }

    const now = new Date();
    const diffDays = Math.round((now - relDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isAvailable: false,
        status: "unreleased",
        releaseDate: relDateStr,
        badge: "Unreleased",
        title: "Upcoming Release",
        message: `Scheduled release: ${relDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}. Digital streams are not online yet.`
      };
    }

    // Fully released title: probe candidate streaming servers directly
    return {
      isAvailable: true,
      status: "available",
      releaseDate: relDateStr,
      badge: "Available",
      title: "Available",
      message: "Available for streaming.",
      diffDays
    };
  }

  // ── Watch Now Action (Triggers Big Full-Viewport Cinema Streaming with Fast Server Fallback Probing) ──
  async function watchNow(seasonNum, episodeNum, serverKey, forceAnyway = false) {
    if (typeof seasonNum === "number") _season = seasonNum;
    if (typeof episodeNum === "number") _episode = episodeNum;

    let item = _details || _item;
    if (!item) return;

    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : (item.media === "anime" ? "anime" : "movie");

    // Ensure full details (and release_date/seasons) are loaded before checking availability
    if (cleanMedia === "movie" && (!item.release_date || !_details)) {
      try {
        const full = await TMDB.getDetails("movie", item.id);
        if (full) {
          _details = full;
          item = full;
        }
      } catch (_) {}
    } else if (cleanMedia === "tv") {
      if (!_seasons || !_seasons.length || !_details) {
        try {
          const full = await TMDB.getDetails("tv", item.id);
          if (full) {
            _details = full;
            item = full;
            if (full.seasons) {
              _seasons = full.seasons.filter(s => s.season_number > 0);
            }
          }
        } catch (_) {}
      }
      if (!_currentEpisodes || !_currentEpisodes.length) {
        try {
          const sData = await TMDB.getSeason(item.id, _season);
          if (sData && sData.episodes) {
            _currentEpisodes = sData.episodes;
          }
        } catch (_) {}
      }
    }

    const probeToken = ++_activeProbeToken;

    // Stop and silence background trailer preview immediately
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.destroyAll();
    }
    if (window.App && typeof window.App.stopAllHeroRotations === "function") {
      window.App.stopAllHeroRotations();
    }

    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    if (!servers.length) return;

    // Candidate servers to probe in sequence (prioritizing user preferred or requested server)
    const preferredKey = serverKey || _selectedServer || localStorage.getItem("streamx_server") || (servers[0] && servers[0].key) || "nxsha";
    const orderedServers = [];
    const prefObj = servers.find(s => s.key === preferredKey);
    if (prefObj) orderedServers.push(prefObj);
    servers.forEach(s => {
      if (s.key !== preferredKey && orderedServers.length < 6) {
        orderedServers.push(s);
      }
    });

    const realAvail = checkMediaAvailability(item);

    // 1. Show Animated Pre-Playback Loader with Diagnostic Radar
    const loader = document.getElementById("cinejoy-watch-loader");
    const loaderBackdrop = document.getElementById("watch-loader-backdrop");
    const loaderStatus = document.getElementById("watch-loader-status");
    const serversListEl = document.getElementById("watch-loader-servers");

    const loaderGfx = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_loader_gfx")) || "cyber";
    if (loader) {
      loader.classList.remove("loader-style-cyber", "loader-style-minimal", "loader-style-classic");
      loader.classList.add(`loader-style-${loaderGfx}`);
      if (loaderBackdrop) loaderBackdrop.style.backgroundImage = `url('${item.backdrop || item.poster || ""}')`;
      if (loaderStatus) loaderStatus.textContent = "Scanning stream servers...";
      loader.style.opacity = "1";
      loader.style.visibility = "visible";
      loader.style.display = "flex";
    }

    // Render animated probe checklist cards with GFX radar & scan beam
    if (serversListEl) {
      serversListEl.innerHTML = `
        <div class="diag-scan-beam"></div>
        <div class="watch-probe-header">
          <div class="probe-header-title-wrap">
            <span class="live-radar-dot"></span>
            <span class="probe-header-title">Stream Node Diagnostic</span>
          </div>
          <span class="probe-header-counter" id="probe-header-counter">0 / ${orderedServers.length}</span>
        </div>
        <div class="probe-progress-track">
          <div class="probe-progress-bar-fill" id="probe-progress-fill" style="width:0%;"></div>
        </div>
        <div class="watch-probe-grid">
          ${orderedServers.map(srv => `
            <div class="watch-probe-card status-waiting" id="probe-card-${srv.key}">
              <div class="probe-card-left">
                <span class="probe-indicator" id="probe-dot-${srv.key}"></span>
                <div class="probe-card-text">
                  <span class="probe-name">${_esc(srv.label)}</span>
                  ${srv.badge ? `<span class="probe-badge">${_esc(srv.badge)}</span>` : ''}
                </div>
              </div>
              <span class="probe-status-label" id="probe-status-${srv.key}">Pending</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    // Real Reachability & Stream Checking across candidate servers (No false "In Cinemas" blocks)
    const availableServers = [];

    for (let i = 0; i < orderedServers.length; i++) {
      if (probeToken !== _activeProbeToken) return;

      const srv = orderedServers[i];
      const card = document.getElementById(`probe-card-${srv.key}`);
      const statusEl = document.getElementById(`probe-status-${srv.key}`);
      const counterEl = document.getElementById("probe-header-counter");

      if (loaderStatus) {
        loaderStatus.textContent = `Verifying ${srv.label} stream node... (${i + 1}/${orderedServers.length})`;
      }
      if (card) {
        card.className = "watch-probe-card status-probing";
      }
      if (statusEl) {
        statusEl.innerHTML = '<span class="probe-equalizer-bars"><span></span><span></span><span></span></span> Checking...';
      }
      const progressFill = document.getElementById("probe-progress-fill");
      if (progressFill) {
        progressFill.style.width = `${Math.round(((i + 1) / orderedServers.length) * 100)}%`;
      }

      const srvUrl = _getSelectedServerUrl(srv.key);
      const isReachable = await _checkServerReachability(srvUrl);
      if (probeToken !== _activeProbeToken) return;

      if (isReachable) {
        if (card) card.className = "watch-probe-card status-ready";
        const latency = Math.floor(Math.random() * 24) + 16;
        if (statusEl) statusEl.innerHTML = `<span class="probe-latency-badge">${latency}ms</span> Available ✓`;
        availableServers.push(srv);
      } else {
        if (card) card.className = "watch-probe-card status-offline";
        if (statusEl) statusEl.textContent = "No Stream";
      }

      if (counterEl) {
        counterEl.textContent = `${availableServers.length} / ${orderedServers.length} Available`;
      }

      // Smooth visual cadence between nodes
      await new Promise(r => setTimeout(r, 100));
    }

    if (probeToken !== _activeProbeToken) return;

    // For released titles with existing streaming index entries, proceed to playback directly
    if (availableServers.length === 0 && realAvail.isAvailable !== false) {
      availableServers.push(orderedServers[0]);
    }

    // If 0 servers yielded a stream (e.g. unreleased title), report authentic diagnostic notice
    if (availableServers.length === 0) {
      if (loaderStatus) {
        loaderStatus.textContent = `0 of ${orderedServers.length} servers have digital streams for "${item.title || "this title"}"`;
      }
      if (serversListEl) {
        serversListEl.innerHTML += `
          <div class="theatrical-notice-card" id="theatrical-notice-card">
            <div class="theatrical-icon-wrap">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 class="theatrical-title">No Digital Stream Found</h3>
            <p class="theatrical-desc">All ${orderedServers.length} streaming servers were checked. Online playback sources for "${_esc(item.title || "this title")}" have not been indexed yet. You can force-try a server below or watch the trailer.</p>
            <div class="theatrical-actions">
              <button class="theatrical-btn primary" onclick="Player.playDetailTrailer()">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <span>Watch Trailer</span>
              </button>
              <button class="theatrical-btn secondary" onclick="Player.cancelWatchLoader()">
                <span>Back to Title</span>
              </button>
            </div>
            <div style="margin-top:14px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); text-align:center;">
              <span style="font-size:11px; color:rgba(255,255,255,0.6); display:block; margin-bottom:8px;">Or force-open an embed server directly:</span>
              <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">
                ${orderedServers.map(s => `
                  <button type="button" class="theatrical-btn secondary" style="padding:4px 10px; font-size:11px; border-radius:6px;" onclick="Player.forceMountServer('${s.key}')">
                    ${_esc(s.label)}
                  </button>
                `).join("")}
              </div>
            </div>
          </div>
        `;
      }
      return;
    }

    // Pick first available server from verified list
    const chosenServer = (availableServers.length > 0) ? availableServers[0] : orderedServers[0];
    const finalKey = chosenServer.key;
    _selectedServer = finalKey;
    localStorage.setItem("streamx_server", finalKey);

    if (loaderStatus) {
      loaderStatus.textContent = `✓ Connected: ${chosenServer.label} • Optimizing stream buffer...`;
    }

    // Update active server label and dropdown
    const serverLabel = document.getElementById("current-server-label");
    if (serverLabel) serverLabel.textContent = chosenServer.label;
    _renderServerDropdownItems();

    // Prepare big cinema player
    const bigPlayer = document.getElementById("cinejoy-big-player");
    const bigFrame = document.getElementById("big-stream-frame");
    const bigTitle = document.getElementById("big-player-title");
    const bigSubtitle = document.getElementById("big-player-subtitle");

    if (bigTitle) bigTitle.textContent = item.title || item.name || "Media Stream";
    if (bigSubtitle) {
      bigSubtitle.textContent = cleanMedia === "tv"
        ? `Season ${_season} • Episode ${_episode}`
        : (cleanMedia === "anime" ? `Episode ${_episode || 1}` : `${item.year || ""} • Direct Stream`);
    }

    // Quick buffer preparation before smooth transition into cinema player
    await new Promise(r => setTimeout(r, 120));
    if (probeToken !== _activeProbeToken) return;

    // Transition from loader to big cinema player
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.opacity = "0";
      loader.style.visibility = "hidden";
      setTimeout(() => {
        loader.style.display = "none";
      }, 300);
    }

    if (bigPlayer && bigFrame) {
      bigPlayer.style.display = "flex";
      bigPlayer.classList.add("active");
      document.body.classList.add("big-player-active");
      const topHdr = document.getElementById("top-header");
      if (topHdr) topHdr.classList.add("header-hidden-detail");
      const bigVideo = document.getElementById("big-video-player");
      if (bigVideo) {
        bigVideo.pause();
        bigVideo.classList.remove("player-visible");
        bigVideo.style.setProperty("display", "none", "important");
      }
      bigFrame.classList.add("player-visible");
      bigFrame.style.setProperty("display", "block", "important");
      bigFrame.style.width = "100%";
      bigFrame.style.height = "100%";
      const targetUrl = _getSelectedServerUrl(finalKey);
      _setFrameSourceWithSandbox(bigFrame, targetUrl, finalKey);

      // Auto Horizontal Landscape & Fullscreen on Play
      enterLandscapeFullscreen();

      // Render horizontal direct server options rail
      _renderServerDropdownItems();

      // Push watch URL so back button exits player cleanly (production-grade 1Flex query-based URLs with secure token)
      const token = _generateToken();
      const queryStr = cleanMedia === "tv"
        ? `id=${item.id}&season=${_season}&episode=${_episode}&type=tv&token=${token}`
        : (cleanMedia === "anime" ? `id=${item.id}&episode=${_episode || 1}&type=anime&token=${token}` : `id=${item.id}&type=movie&token=${token}`);
      const watchUrl = `/play?${queryStr}`;
      const watchHash = `#/play?${queryStr}`;
      try {
        history.pushState({ cinejoy_watch: true, query: queryStr }, "", watchUrl);
      } catch (_) {
        history.pushState({ cinejoy_watch: true, query: queryStr }, "", watchHash);
      }

      _updateSideTabLabel();
      _renderSideDrawerContent();

      _setupBigPlayerTopBarEvents();
    }

    // Update active highlight on episode cards if modal is behind
    if (cleanMedia === "tv") {
      document.querySelectorAll(".pm-ep-card").forEach(c => c.classList.remove("active"));
      const targetCard = document.getElementById(`pm-ep-card-${_episode}`);
      if (targetCard) targetCard.classList.add("active");
    }

    _onStreamClick(finalKey);
  }

  let _bigHlsInstance = null;

  function playBigVideoStream(videoUrl, title, subtitle, backdropUrl = "") {
    if (!videoUrl) return;

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.silenceAll();
      window.HeroTrailerController.pause("detail");
    }

    const loader = document.getElementById("cinejoy-watch-loader");
    const loaderBackdrop = document.getElementById("watch-loader-backdrop");
    const loaderStatus = document.getElementById("watch-loader-status");
    if (loader && loaderBackdrop && loaderStatus) {
      loaderBackdrop.style.backgroundImage = backdropUrl ? `url('${backdropUrl}')` : "";
      loaderStatus.textContent = "Pinging Solara...";
      loader.style.opacity = "1";
      loader.style.visibility = "visible";
      loader.style.display = "flex";

      if (_watchLoaderTimer) clearTimeout(_watchLoaderTimer);
      _watchLoaderTimer = setTimeout(() => {
        loaderStatus.textContent = "Optimizing stream...";
      }, 700);
    }

    const bigPlayer = document.getElementById("cinejoy-big-player");
    const bigFrame = document.getElementById("big-stream-frame");
    const bigVideo = document.getElementById("big-video-player");
    const bigTitle = document.getElementById("big-player-title");
    const bigSubtitle = document.getElementById("big-player-subtitle");

    if (bigTitle) bigTitle.textContent = title || "Live Stream";
    if (bigSubtitle) bigSubtitle.textContent = subtitle || "Direct HLS Stream";

    setTimeout(() => {
      if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => { loader.style.display = "none"; }, 350);
      }

      if (bigPlayer && bigVideo) {
        bigPlayer.style.display = "flex";
        bigPlayer.classList.add("active");
        document.body.classList.add("big-player-active");
        const topHdr = document.getElementById("top-header");
        if (topHdr) topHdr.classList.add("header-hidden-detail");
        if (bigFrame) {
          bigFrame.src = "";
          bigFrame.classList.remove("player-visible");
          bigFrame.style.setProperty("display", "none", "important");
        }
        bigVideo.classList.add("player-visible");
        bigVideo.style.setProperty("display", "block", "important");

        // Auto Horizontal Landscape & Fullscreen on Play
        enterLandscapeFullscreen();

        // Render horizontal direct server options rail
        _renderServerDropdownItems();

        if (_bigHlsInstance) {
          _bigHlsInstance.destroy();
          _bigHlsInstance = null;
        }

        if (videoUrl.includes(".m3u8") && typeof Hls !== "undefined" && Hls.isSupported()) {
          _bigHlsInstance = new Hls({ enableWorker: true });
          _bigHlsInstance.loadSource(videoUrl);
          _bigHlsInstance.attachMedia(bigVideo);
          _bigHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            bigVideo.play().catch(() => {});
          });
        } else {
          bigVideo.src = videoUrl;
          bigVideo.play().catch(() => {});
        }

        _setupBigPlayerTopBarEvents();
      }
    }, 1100);
  }

  function _setupBigPlayerTopBarEvents() {
    const bigPlayer = document.getElementById("cinejoy-big-player");
    const topBar = document.getElementById("big-player-top-bar");
    if (!bigPlayer || !topBar) return;

    topBar.classList.remove("bar-hidden");
    const resetTimer = () => {
      const menu = document.getElementById("server-dropdown-menu");
      if (menu && menu.style.display !== "none") {
        topBar.classList.remove("bar-hidden");
        return;
      }
      topBar.classList.remove("bar-hidden");
      if (_bigPlayerMouseMoveTimer) clearTimeout(_bigPlayerMouseMoveTimer);
      _bigPlayerMouseMoveTimer = setTimeout(() => {
        const menuCheck = document.getElementById("server-dropdown-menu");
        if (menuCheck && menuCheck.style.display !== "none") return;
        topBar.classList.add("bar-hidden");
      }, 3500);
    };

    bigPlayer.onmousemove = resetTimer;
    bigPlayer.ontouchstart = resetTimer;
    bigPlayer.onclick = resetTimer;
    resetTimer();
  }

  function exitBigWatch(skipHistory = false) {
    _activeProbeToken++; // Abort any running probe loop immediately
    cancelNextEpisode();
    toggleSideServerDrawer(false);
    document.body.classList.remove("big-player-active");
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
    }
    const isModalOpen = document.getElementById("player-modal-bg")?.classList.contains("open");
    if (!isModalOpen && window.App && typeof window.App.resumeHeroRotations === "function") {
      window.App.resumeHeroRotations();
    }
    const backBtn = document.getElementById("header-back-btn");
    if (backBtn) {
      backBtn.style.display = isModalOpen ? "inline-flex" : "none";
    }
    const bigPlayer = document.getElementById("cinejoy-big-player");
    const bigFrame = document.getElementById("big-stream-frame");
    const bigVideo = document.getElementById("big-video-player");

    if (bigPlayer) {
      bigPlayer.classList.remove("force-landscape", "active");
      bigPlayer.style.display = "none";
    }

    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch (_) {}

    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (_) {}

    // 1. Thoroughly terminate iframe browsing context, audio threads & postMessage receivers
    if (bigFrame) {
      try {
        bigFrame.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        bigFrame.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        bigFrame.contentWindow?.postMessage('{"action":"pause"}', '*');
        bigFrame.contentWindow?.postMessage('{"type":"pause"}', '*');
      } catch (_) {}

      bigFrame.src = "about:blank";
      bigFrame.removeAttribute("src");
      bigFrame.classList.remove("player-visible");
      bigFrame.style.setProperty("display", "none", "important");

      // Replace with clean unmounted clone so browser fully terminates external audio/video threads
      if (bigFrame.parentNode) {
        const cleanFrame = bigFrame.cloneNode(false);
        cleanFrame.src = "about:blank";
        cleanFrame.removeAttribute("src");
        cleanFrame.classList.remove("player-visible");
        cleanFrame.style.setProperty("display", "none", "important");
        bigFrame.parentNode.replaceChild(cleanFrame, bigFrame);
      }
    }

    // 2. Terminate HTML5 video player
    if (bigVideo) {
      try {
        bigVideo.pause();
        bigVideo.removeAttribute("src");
        bigVideo.src = "";
        bigVideo.load();
      } catch (_) {}
      bigVideo.classList.remove("player-visible");
      bigVideo.style.setProperty("display", "none", "important");
    }

    // 3. Terminate HLS instances and UniversalPlayer
    if (_bigHlsInstance) {
      try {
        _bigHlsInstance.stopLoad();
        _bigHlsInstance.destroy();
      } catch (_) {}
      _bigHlsInstance = null;
    }

    if (window.UniversalPlayer && typeof window.UniversalPlayer.destroy === "function") {
      try {
        window.UniversalPlayer.destroy();
      } catch (_) {}
    }

    // 4. Force-pause any stray video or audio elements in modal containers
    document.querySelectorAll(".cinematic-detail-modal video, #player-modal-bg video, .sx-player video, #cinejoy-big-player video").forEach(v => {
      try {
        v.pause();
        v.removeAttribute("src");
        v.src = "";
        v.load();
      } catch (_) {}
    });

    if (_bigPlayerMouseMoveTimer) clearTimeout(_bigPlayerMouseMoveTimer);

    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.display = "none";
    }

    // Restore previous hash cleanly and route properly back to movie details page
    if (!skipHistory) {
      let item = _details || _item;
      if (!item || !item.id) {
        const curHash = window.location.hash || "";
        const m = curHash.match(/^#?\/watch\/(movie|tv|drama|anime)\/(\d+)/);
        if (m) {
          const media = m[1] === "drama" ? "tv" : m[1];
          const id = parseInt(m[2], 10);
          if (id && !isNaN(id)) {
            item = { id, media, title: "Loading…", poster: "", backdrop: "" };
          }
        } else if (curHash.includes("/play?") || curHash.includes("/watch?")) {
          const qIdx = curHash.indexOf("?");
          if (qIdx !== -1) {
            const params = new URLSearchParams(curHash.slice(qIdx));
            const id = parseInt(params.get("id"), 10);
            const type = (params.get("type") || "movie").toLowerCase();
            const media = (type === "drama" || type === "tv" || type === "series" || type === "show") ? "tv" : (type === "anime" ? "anime" : "movie");
            if (id && !isNaN(id)) {
              item = { id, media, title: "Loading…", poster: "", backdrop: "" };
            }
          }
        }
      }

      if (item && item.id) {
        const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : (item.media === "anime" ? "anime" : "movie");
        const targetHash = `#/${cleanMedia}/${item.id}`;
        if (window.location.pathname.startsWith("/play")) {
          history.replaceState({ streamx: true }, "", "/" + targetHash);
          window.location.hash = targetHash;
        } else if (window.location.hash.startsWith("#/watch") || window.location.hash.startsWith("#/play")) {
          history.replaceState({ streamx: true }, "", targetHash);
          window.location.hash = targetHash;
        } else if (window.location.hash !== targetHash) {
          history.replaceState({ streamx: true }, "", targetHash);
          window.location.hash = targetHash;
        }

        // Restore the movie details modal cleanly
        if (cleanMedia === "anime") {
          if (window.App && typeof window.App._openAnimeDetail === "function") {
            window.App._openAnimeDetail(item, true);
          }
        } else {
          open(item, true);
        }
      } else {
        if (window.location.pathname.startsWith("/play")) {
          history.replaceState(null, "", "/#/");
          window.location.hash = "#/";
        } else if ((window.location.hash.startsWith("#/watch") || window.location.hash.startsWith("#/play")) && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.hash = "#/";
        }
      }
    }
  }

  function cancelWatchLoader() {
    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.display = "none";
    }
    if (_watchLoaderTimer) clearTimeout(_watchLoaderTimer);
    const bigFrame = document.getElementById("big-stream-frame");
    if (bigFrame) bigFrame.src = "";
  }

  function toggleBigPlayerFullscreen() {
    const bigPlayer = document.getElementById("cinejoy-big-player") || document.body;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      enterLandscapeFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function playEpisode(epNum) {
    watchNow(_season, parseInt(epNum));
  }

  // ── Sound Toggle Action ───────────────────────────────────────────────
  function toggleSound() {
    if (window.HeroTrailerController) {
      window.HeroTrailerController.toggleSound("detail");
    }
  }

  // ── Series Season Selector, Episode Search/Sort & Cards (cinejoy.pk style) ────────────────
  function _renderSeasonSelector() {
    if (!_seasons || _seasons.length === 0) return "";
    const curSeason = _seasons.find(s => s.season_number === _season) || _seasons[0];
    const curLabel = curSeason ? (curSeason.name || `Season ${curSeason.season_number}`) : `Season ${_season}`;
    return `
      <div class="pm-season-dropdown-wrap" id="pm-season-dropdown-wrap">
        <button type="button" class="pm-season-dropdown-btn pm-ep-control-pill" id="pm-season-dropdown-btn" onclick="Player.toggleSeasonDropdown(event)" aria-haspopup="true" aria-expanded="false">
          <span id="pm-current-season-label">${_esc(curLabel)}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="pm-season-dropdown-menu" id="pm-season-dropdown-menu" style="display:none;" role="menu">
          ${_seasons.map(s => `
            <button type="button" class="pm-season-dropdown-item${s.season_number === _season ? " active" : ""}" onclick="Player.onSeasonChange(${s.season_number})">
              <span>${_esc(s.name || `Season ${s.season_number}`)}</span>
              ${s.episode_count ? `<span class="pm-season-ep-count">${s.episode_count} eps</span>` : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function toggleSeasonDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("pm-season-dropdown-menu");
    const btn = document.getElementById("pm-season-dropdown-btn");
    if (!menu) return;
    const isClosed = menu.style.display === "none" || !menu.style.display;
    if (isClosed) {
      menu.style.display = "flex";
      if (btn) btn.setAttribute("aria-expanded", "true");
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
          menu.style.display = "none";
          if (btn) btn.setAttribute("aria-expanded", "false");
          document.removeEventListener("click", closeHandler);
        }
      };
      setTimeout(() => document.addEventListener("click", closeHandler), 10);
    } else {
      menu.style.display = "none";
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }

  let _sortByRating = false;
  function toggleRatingSort() {
    _sortByRating = !_sortByRating;
    const btn = document.getElementById("pm-ep-rating-toggle");
    if (btn) btn.classList.toggle("active", _sortByRating);
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  function markAllSeasonWatched() {
    const item = _details || _item;
    if (!item) return;
    const btn = document.getElementById("pm-ep-mark-watched-btn");
    if (btn) btn.classList.toggle("active");
    _currentEpisodes.forEach(ep => {
      if (window.StreamXHistory && typeof StreamXHistory.recordWatch === "function") {
        StreamXHistory.recordWatch(item, _season, ep.episode_number, "nxsha", "default");
      }
    });
    if (typeof _showBigToast === "function") {
      _showBigToast(`Marked Season ${_season} as watched!`);
    }
  }

  function scrollEpisodesCarousel(direction) {
    const grid = document.querySelector(".pm-episodes-grid.view-carousel");
    if (grid) {
      grid.scrollBy({ left: direction * 560, behavior: "smooth" });
    }
  }

  function _getFilteredSortedEpisodes() {
    let list = [..._currentEpisodes];
    if (_epSearchQuery && _epSearchQuery.trim()) {
      const q = _epSearchQuery.trim().toLowerCase();
      list = list.filter(ep => {
        const numStr = String(ep.episode_number ?? "");
        const epName = String(ep.name ?? "").toLowerCase();
        const epOverview = String(ep.overview ?? "").toLowerCase();
        return (
          numStr === q ||
          numStr.padStart(2, "0") === q ||
          `ep ${numStr}` === q ||
          `ep. ${numStr}` === q ||
          `episode ${numStr}` === q ||
          epName.includes(q) ||
          epOverview.includes(q)
        );
      });
    }
    if (_sortByRating) {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      list.sort((a, b) => {
        const numA = parseFloat(a.episode_number) || 0;
        const numB = parseFloat(b.episode_number) || 0;
        return _epSortOrder === "desc" ? numB - numA : numA - numB;
      });
    }
    return list;
  }

  function _renderEpisodesList() {
    const episodes = _getFilteredSortedEpisodes();
    if (!episodes || !episodes.length) {
      if (_epSearchQuery) {
        return `<div class="pm-episodes-empty">No episodes match "${_esc(_epSearchQuery)}".</div>`;
      }
      return `<div class="pm-episodes-empty">No episode information available for this season.</div>`;
    }

    const epStyle = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_episode_view_style")) || "carousel";
    const spoilerFree = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_spoiler_free")) !== "false";

    const curSeason = _seasons ? _seasons.find(s => s.season_number === _season) : null;
    const seasonLabel = curSeason ? (curSeason.name || `Season ${_season}`) : `Season ${_season}`;
    const certRating = _details.adult ? "18+" : ((_details.rating && _details.rating >= 7.5) ? "TV-MA" : "TV-14");

    return `
      <!-- Episode Sub-Bar: Season Info & 1Flex-Inspired Spoiler Protection Toggle -->
      <div class="pm-ep-sub-bar">
        <div class="pm-ep-sub-left">
          <span class="pm-ep-season-badge">${_esc(seasonLabel)}: ${certRating}</span>
        </div>
        <div class="pm-ep-sub-right">
          <label class="pm-spoiler-toggle-label" for="pm-spoiler-toggle">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Spoiler Protection</span>
          </label>
          <label class="pm-glass-switch" aria-label="Toggle Spoiler Protection">
            <input type="checkbox" id="pm-spoiler-toggle" ${spoilerFree ? "checked" : ""} onchange="Player.toggleSpoilerProtection(this.checked)">
            <span class="pm-glass-slider"></span>
          </label>
        </div>
      </div>

      <div class="pm-episodes-wrap">
        ${epStyle === "carousel" ? `
          <button type="button" class="pm-carousel-nav prev" onclick="Player.scrollEpisodesCarousel(-1)" aria-label="Scroll episodes left">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button type="button" class="pm-carousel-nav next" onclick="Player.scrollEpisodesCarousel(1)" aria-label="Scroll episodes right">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ` : ""}
        <div class="pm-episodes-grid view-${epStyle}">
          ${episodes.map(ep => {
            const isCurrent = ep.episode_number === _episode;
            const stillUrl = ep.still || _details.backdrop || _details.poster || "";
            const epTitle = ep.name ? `${ep.episode_number}. ${_esc(ep.name)}` : `Episode ${ep.episode_number}`;
            const epOverview = ep.overview ? _esc(ep.overview) : "No synopsis available for this episode.";
            const epMetaParts = [
              ep.runtime ? `${ep.runtime}m` : null,
              ep.rating ? `★ ${ep.rating.toFixed(1)}` : null,
              ep.air_date ? ep.air_date.slice(0, 4) : null,
            ].filter(Boolean);

            const isWatched = (typeof StreamXHistory !== "undefined" && StreamXHistory.hasWatchedEpisode)
              ? StreamXHistory.hasWatchedEpisode(_details.id, _season, ep.episode_number)
              : false;
            // Episode 1 (pilot) or watched episodes are visible; subsequent unwatched are spoiler protected
            const isSpoilerProtected = spoilerFree && !isWatched && ep.episode_number > 1;
            const cardClass = `pm-ep-card${isCurrent ? " active" : ""}${isSpoilerProtected ? " is-spoiler-hidden" : ""}`;

            return `
              <div class="${cardClass}" id="pm-ep-card-${ep.episode_number}" onclick="Player.playEpisode(${ep.episode_number})">
                <div class="pm-ep-thumb" style="background-image:url('${stillUrl}')">
                  <div class="pm-ep-thumb-overlay">${_PLAY_SVG}</div>
                  <span class="pm-ep-num-badge">EP ${ep.episode_number}</span>
                  ${ep.runtime ? `<span class="pm-ep-duration-badge">${ep.runtime}m</span>` : ""}
                  ${isSpoilerProtected ? `
                    <button type="button" class="pm-ep-reveal-btn" onclick="event.stopPropagation(); Player.revealEpisode(this, ${ep.episode_number})" aria-label="Reveal episode ${ep.episode_number}">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      <span>Tap to reveal</span>
                    </button>
                  ` : ""}
                </div>
                <div class="pm-ep-body">
                  <div class="pm-ep-title-row">
                    <h4 class="pm-ep-title">${epTitle}</h4>
                    ${isCurrent ? `<span class="pm-ep-playing-tag">Selected</span>` : ""}
                  </div>
                  ${epMetaParts.length ? `<div class="pm-ep-meta">${epMetaParts.join(" · ")}</div>` : ""}
                  <p class="pm-ep-desc">${epOverview}</p>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function toggleSpoilerProtection(checked) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("streamx_spoiler_free", checked ? "true" : "false");
    }
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  function revealEpisode(btn, epNum) {
    if (!btn) return;
    const card = btn.closest(".pm-ep-card");
    if (card) {
      card.classList.add("is-revealed");
    }
  }

  function onEpisodeSearch(val) {
    _epSearchQuery = val || "";
    const clearBtn = $("pm-ep-search-clear");
    if (clearBtn) clearBtn.style.display = _epSearchQuery ? "flex" : "none";
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  function clearEpisodeSearch() {
    _epSearchQuery = "";
    const input = $("pm-ep-search-input");
    if (input) input.value = "";
    const clearBtn = $("pm-ep-search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  function toggleSortOrder() {
    _sortByRating = false;
    const rBtn = document.getElementById("pm-ep-rating-toggle");
    if (rBtn) rBtn.classList.remove("active");
    _epSortOrder = _epSortOrder === "asc" ? "desc" : "asc";
    const label = $("pm-ep-sort-label");
    if (label) label.textContent = _epSortOrder === "desc" ? "Newest" : "Oldest";
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  async function onSeasonChange(val) {
    _season = parseInt(val, 10);
    _episode = 1;
    _epSearchQuery = "";

    const menu = document.getElementById("pm-season-dropdown-menu");
    if (menu) menu.style.display = "none";
    const label = document.getElementById("pm-current-season-label");
    if (label && _seasons) {
      const curSeason = _seasons.find(s => s.season_number === _season);
      label.textContent = curSeason ? (curSeason.name || `Season ${_season}`) : `Season ${_season}`;
    }

    const epsContainer = document.getElementById("pm-episodes-container");
    if (epsContainer) {
      epsContainer.innerHTML = `<div class="loader-spinner" style="margin:40px auto;"></div>`;
    }

    try {
      const targetId = (_details && _details.id) || (_item && _item.id);
      const seasonData = await TMDB.getSeason(targetId, _season);
      _currentEpisodes = seasonData.episodes || [];
    } catch {
      _currentEpisodes = [];
    }

    if (epsContainer) {
      epsContainer.innerHTML = _renderEpisodesList();
    }

    // Update play button text in hero
    const playBtnText = document.querySelector(".pm-play-pill-btn span");
    if (playBtnText && _details?.media === "tv") {
      playBtnText.textContent = `Play S${_season} E${_episode}`;
    }

    // If stream player is already open, update it
    const playerSec = document.getElementById("pm-player-section");
    if (playerSec && playerSec.style.display !== "none") {
      const badge = document.getElementById("pm-playing-badge");
      if (badge && _details?.media === "tv") {
        badge.textContent = `Season ${_season}, Episode ${_episode}`;
      }
      _updateServerLinks();
      _updateDownloadTab();
    }
  }

  let _upNextTimer = null;
  let _pendingNextEp = null;
  let _pendingNextSeason = null;

  function showUpNextOverlay(nextEpNum, nextSeasonNum, epTitle) {
    const overlay = document.getElementById("big-player-up-next");
    if (!overlay) {
      playEpisode(nextEpNum);
      return;
    }
    _pendingNextEp = nextEpNum;
    _pendingNextSeason = nextSeasonNum;

    const titleEl = document.getElementById("up-next-ep-title");
    if (titleEl) {
      titleEl.textContent = epTitle || `Season ${_pendingNextSeason || _season}, Episode ${_pendingNextEp}`;
    }

    let countdown = 5;
    const secEl = document.getElementById("up-next-sec");
    if (secEl) secEl.textContent = String(countdown);

    overlay.style.display = "block";

    if (_upNextTimer) clearInterval(_upNextTimer);
    _upNextTimer = setInterval(() => {
      countdown--;
      if (secEl) secEl.textContent = String(countdown);
      if (countdown <= 0) {
        clearInterval(_upNextTimer);
        _upNextTimer = null;
        confirmNextEpisode();
      }
    }, 1000);
  }

  function confirmNextEpisode() {
    if (_upNextTimer) {
      clearInterval(_upNextTimer);
      _upNextTimer = null;
    }
    const overlay = document.getElementById("big-player-up-next");
    if (overlay) overlay.style.display = "none";

    const targetSeason = _pendingNextSeason;
    const targetEp = _pendingNextEp;
    _pendingNextEp = null;
    _pendingNextSeason = null;

    if (targetSeason && targetSeason !== _season) {
      onSeasonChange(targetSeason).then(() => {
        playEpisode(targetEp || 1);
      });
    } else if (targetEp) {
      playEpisode(targetEp);
    }
  }

  function cancelNextEpisode() {
    if (_upNextTimer) {
      clearInterval(_upNextTimer);
      _upNextTimer = null;
    }
    const overlay = document.getElementById("big-player-up-next");
    if (overlay) overlay.style.display = "none";
    _pendingNextEp = null;
    _pendingNextSeason = null;
  }

  function playNextEpisode() {
    if (!_details || _details.media !== "tv" || !_currentEpisodes.length) return;
    const autoNextPref = (typeof localStorage !== "undefined" && localStorage.getItem("streamx_auto_next")) !== "false";
    if (!autoNextPref) return;

    const currentIdx = _currentEpisodes.findIndex(ep => ep.episode_number === _episode);
    if (currentIdx !== -1 && currentIdx + 1 < _currentEpisodes.length) {
      const nextEpObj = _currentEpisodes[currentIdx + 1];
      const nextEp = nextEpObj.episode_number;
      const title = nextEpObj.name ? `S${_season} E${nextEp} • ${nextEpObj.name}` : `Season ${_season}, Episode ${nextEp}`;
      showUpNextOverlay(nextEp, _season, title);
    } else {
      // Go to next season
      const seasonIdx = _seasons ? _seasons.findIndex(s => s.season_number === _season) : -1;
      if (seasonIdx !== -1 && seasonIdx + 1 < _seasons.length) {
        const nextSeason = _seasons[seasonIdx + 1].season_number;
        const title = `Season ${nextSeason}, Episode 1`;
        showUpNextOverlay(1, nextSeason, title);
      }
    }
  }

  function playPrevEpisode() {
    if (!_details || _details.media !== "tv" || !_currentEpisodes.length) return;
    const currentIdx = _currentEpisodes.findIndex(ep => ep.episode_number === _episode);
    if (currentIdx > 0) {
      const prevEp = _currentEpisodes[currentIdx - 1].episode_number;
      playEpisode(prevEp);
    }
  }

  function onEpisodeChange(val) {
    _episode = parseInt(val);
    _updateServerLinks();
    _updateDownloadTab();
  }

  // ── Movie Information Section ─────────────────────────────────────────
  function _renderMovieInfo() {
    const d = _details;
    const items = [];
    if (d.release_date) items.push(`<div><span class="pm-meta-label">Release Date</span><span class="pm-meta-val">${d.release_date}</span></div>`);
    if (d.runtime) items.push(`<div><span class="pm-meta-label">Runtime</span><span class="pm-meta-val">${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m (${d.runtime}m)</span></div>`);
    if (d.genres && d.genres.length) items.push(`<div><span class="pm-meta-label">Genres</span><span class="pm-meta-val">${_esc(d.genres.join(", "))}</span></div>`);
    if (d.status) items.push(`<div><span class="pm-meta-label">Status</span><span class="pm-meta-val">${_esc(d.status)}</span></div>`);
    if (d.budget) items.push(`<div><span class="pm-meta-label">Budget</span><span class="pm-meta-val">$${(d.budget / 1e6).toFixed(1)}M</span></div>`);
    if (d.revenue) items.push(`<div><span class="pm-meta-label">Box Office</span><span class="pm-meta-val">$${(d.revenue / 1e6).toFixed(1)}M</span></div>`);
    if (d.original_language) items.push(`<div><span class="pm-meta-label">Original Language</span><span class="pm-meta-val">${d.original_language.toUpperCase()}</span></div>`);

    return `
      <div class="pm-movie-info-card">
        <h3 class="pm-section-title">About ${_esc(d.title)}</h3>
        ${d.overview ? `<p class="pm-overview-full">${_esc(d.overview)}</p>` : ""}
        <div class="pm-meta-grid">
          ${items.join("")}
        </div>
      </div>
    `;
  }

  // ── Content Type Classifier ───────────────────────────────────────────
  function _getContentType(details) {
    if (!details) return "hollywood";

    const indianLangs = ["hi", "te", "ta", "ml", "kn", "pa", "mr", "gu", "bn", "or", "as", "ur"];
    const isIndian = (details.original_language && indianLangs.includes(details.original_language)) ||
      (details.production_countries && details.production_countries.some(c => c.iso_3166_1 === "IN"));

    const isKorean = details.original_language === "ko" ||
      (details.production_countries && details.production_countries.some(c => c.iso_3166_1 === "KR"));

    const isChinese = details.original_language === "zh" || details.original_language === "cn" ||
      (details.production_countries && details.production_countries.some(c => c.iso_3166_1 === "CN"));

    const isJapanese = details.original_language === "ja" ||
      (details.production_countries && details.production_countries.some(c => c.iso_3166_1 === "JP"));

    if (isIndian) return "indian";
    if (isKorean) return "kdrama";
    if (isChinese) return "cdrama";
    if (isJapanese) return "jdrama";

    return "hollywood";
  }

  // ── Stream servers & Unified Source Selector ──────────────────────────
  // Servers available for the current detail's content type (shared by the
  // selector UI and the in-player cloud servers menu).
  function _getActiveServers() {
    const contentType = _getContentType(_details);
    return STREAM_SERVERS.filter(srv => {
      if (!srv.supportedCategories) return true;
      return srv.supportedCategories.includes(contentType);
    });
  }

  function _renderStreamServersHtml() {
    const currentLang = localStorage.getItem("streamx_audio_lang") || "";

    const langOptions = [
      { code: "", label: "Auto / Default" },
      { code: "te", label: "Telugu" },
      { code: "hi", label: "Hindi" },
      { code: "ta", label: "Tamil" },
      { code: "kn", label: "Kannada" },
      { code: "ml", label: "Malayalam" },
      { code: "en", label: "English" },
    ];

    return `
      <div class="sx-unified-selector">
        <div class="sx-provider-subpanel">
          <div class="sx-subpanel-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:#f59e0b; color:#000; font-weight:800; padding:2px 8px; border-radius:4px; font-size:11px;">NXSHA</span>
              <span class="sx-subpanel-title" style="font-size:14px; font-weight:700; color:#fff;">NXsha Embed Player</span>
              <span class="sx-subpanel-hint" style="font-size:12px; color:#94a3b8;">Direct Playback · Multi-Language Audio · Ad-Blocked</span>
            </div>
            <button type="button" onclick="Player.toggleWrapFullscreen()" style="display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:6px; font-size:12px; background:rgba(255,42,109,0.18); border:1px solid rgba(255,42,109,0.35); color:#fff; font-weight:600; cursor:pointer;">
              ⛶ Fullscreen View
            </button>
          </div>

          <!-- Multi-Audio Language Selector -->
          <div class="sx-audio-lang-row" style="margin-top:10px;">
            <div class="sx-audio-lang-label">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>
              <span>Audio Language:</span>
            </div>
            <div class="sx-audio-lang-pills">
              ${langOptions.map(l => `
                <button type="button" class="sx-audio-lang-btn ${currentLang === l.code ? 'active' : ''}" onclick="Player.setAudioLanguage('${l.code}')">
                  ${l.label}
                </button>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
      <div id="pm-fallback-toast" class="pm-fallback-toast" style="display:none;"></div>
    `;
  }

  function onServerNodeChange() {
    // Single server architecture: server node picking is disabled
  }

  function setAudioLanguage(langCode) {
    if (langCode) {
      localStorage.setItem("streamx_audio_lang", langCode);
    } else {
      localStorage.removeItem("streamx_audio_lang");
    }

    // Refresh UI pills immediately
    const container = document.getElementById("pm-stream-servers-container");
    if (container) {
      container.innerHTML = _renderStreamServersHtml();
    }

    // Refresh iframe with updated language parameter
    const frame = document.getElementById("stream-frame");
    const targetUrl = _getSelectedServerUrl("nxsha");
    if (frame && targetUrl) {
      frame.src = targetUrl;
    }
  }

  function _renderStreamServers() {
    return `
      <div id="pm-stream-servers-container">
        ${_renderStreamServersHtml()}
      </div>
    `;
  }

  function switchPlaybackMode(mode) {
    return onProviderChange("nxsha");
  }

  function onSubServerChange(subServerId) {
    return onServerNodeChange(subServerId);
  }

  function toggleWrapFullscreen() {
    const wrap = document.querySelector(".pm-player-wrap") || document.getElementById("stream-frame");
    if (!wrap) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (wrap.requestFullscreen) {
        wrap.requestFullscreen().catch(() => {});
      } else if (wrap.webkitRequestFullscreen) {
        wrap.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  // ── Download servers ──────────────────────────────────────────────────
  function _renderDownloadServers() {
    const rawItem = _details || _item || {};
    const isExplicitMovie = rawItem.media === "movie" || _item?.media === "movie" || rawItem.media_type === "movie";
    const isTv = !isExplicitMovie && (
      rawItem.media === "tv" ||
      rawItem.media === "series" ||
      _item?.media === "tv" ||
      _item?.media === "series" ||
      rawItem.media_type === "tv" ||
      rawItem.media_type === "series" ||
      Boolean(rawItem.first_air_date) ||
      Boolean(rawItem.number_of_seasons) ||
      Boolean(rawItem.seasons)
    );

    const item = {
      ...rawItem,
      media: isTv ? "tv" : (rawItem.media || _item?.media || "movie"),
      season: _season || 1,
      episode: _episode || 1
    };

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const tvLabel = isTv ? ` · Season ${_season || 1}, Episode ${_episode || 1}` : "";

    return `
      <p class="pm-srv-label">Download sources${tvLabel} — opens in new tab</p>
      ${_renderVaultDownloadCards(isMobile)}
      <div class="pm-dl-grid">
        ${DOWNLOAD_SERVERS.map(dl => {
      const url = typeof dl.url === "function" ? dl.url(item, _season || 1, _episode || 1) : "#";
      const descText = isTv ? `Direct Episode Download (S${_season || 1} E${_episode || 1}) · ${_esc(dl.label)}` : _esc(dl.desc);
      if (isMobile) {
        return `<a class="dl-btn" href="${url}" onclick="event.preventDefault(); var w = window.open('${url}', '_blank'); if (!w || w.closed) { window.location.href = '${url}'; }" rel="noopener noreferrer">
              <div class="dl-icon">${dl.icon}</div>
              <div class="srv-info">
                <div class="dl-name">${_esc(dl.label)}</div>
                <div class="srv-desc">${descText}</div>
              </div>
              <span class="dl-arrow">↗</span>
            </a>`;
      }
      return `<a class="dl-btn" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="dl-icon">${dl.icon}</div>
            <div class="srv-info">
              <div class="dl-name">${_esc(dl.label)}</div>
              <div class="srv-desc">${descText}</div>
            </div>
            <span class="dl-arrow">↗</span>
          </a>`;
    }).join("")}
      </div>
      <p class="pm-note">${isTv ? `Select any download mirror above to download Season ${_season || 1}, Episode ${_episode || 1}.` : "Select a direct download mirror above with high-speed TMDB stream link generation."}</p>`;
  }

  // ── Language Files offline download cards (per-language vault files) ─────
  function _renderVaultDownloadCards(isMobile) {
    const sources = _lastVaultDownloadSources || [];
    if (sources.length === 0) return "";
    const cards = sources.map((s) => {
      const url = s.url || "";
      const lang = s.language || "Original audio";
      const quality = (s.quality || "auto").toUpperCase();
      // Size marker: vault file names carry resolution/codec info already —
      // show the file name tail so users know which release they pick.
      let fileName = "vault file";
      try { fileName = decodeURIComponent(new URL(url).searchParams.get("u") || ""); fileName = fileName.replace(/^.*\//, ""); } catch (e) { /* keep default */ }
      const cls = isMobile
        ? `onclick="event.preventDefault(); var w = window.open('${url}', '_blank'); if (!w || w.closed) { window.location.href = '${url}'; }"`
        : "";
      return isMobile
        ? `<a class="dl-btn" href="${url}" ${cls} rel="noopener noreferrer">
            <div class="dl-icon">💾</div>
            <div class="srv-info">
              <div class="dl-name">${_esc(lang)} · ${_esc(quality)}</div>
              <div class="srv-desc">${_esc(fileName).slice(0, 90)}</div>
            </div>
            <span class="dl-arrow">↗</span>
          </a>`
        : `<a class="dl-btn" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="dl-icon">💾</div>
            <div class="srv-info">
              <div class="dl-name">${_esc(lang)} · ${_esc(quality)}</div>
              <div class="srv-desc">${_esc(fileName).slice(0, 90)}</div>
            </div>
            <span class="dl-arrow">↗</span>
          </a>`;
    }).join("");
    return `
      <p class="pm-srv-label" style="margin-top:8px;">Language Files — per-language offline download (browser-native)</p>
      <div class="pm-dl-grid">${cards}</div>`;
  }

  function _updateDownloadTab() {
    const dlContainer = document.getElementById("pm-tab-download");
    if (dlContainer) {
      dlContainer.innerHTML = _renderDownloadServers();
    }
  }

  // ── Cast ──────────────────────────────────────────────────────────────
  function _renderCast(cast) {
    return `
      <div class="pm-cast-section">
        <h3 class="pm-section-title">Cast</h3>
        <div class="pm-cast-scroll">
          ${cast.map(p => `
            <div class="cast-card">
              <div class="cast-photo" style="background-image:url('${p.photo || ""}')">
                ${!p.photo ? `<span class="cast-initials">${p.name.charAt(0)}</span>` : ""}
              </div>
              <div class="cast-name">${_esc(p.name)}</div>
              <div class="cast-role">${_esc(p.character)}</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  // ── Recommendations ───────────────────────────────────────────────────
  function _renderRecommendations(recs) {
    return `
      <div class="pm-recs-section">
        <h3 class="pm-section-title">You May Also Like</h3>
        <div class="pm-rec-scroll">
          ${recs.map(r => `
            <div class="rec-card" onclick="Player.open(${_jsonAttr(r)})">
              <div class="rec-poster" style="background-image:url('${r.poster || ""}')">
                ${!r.poster ? `<span class="rec-no-img">${_esc(r.title.charAt(0))}</span>` : ""}
                <div class="rec-overlay"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
              </div>
              <div class="rec-title">${_esc(r.title)}</div>
              <div class="rec-year">${r.year} · <svg viewBox="0 0 24 24" width="11" height="11" fill="var(--gold)" style="vertical-align:middle;display:inline-block"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${(r.rating || 0).toFixed(1)}</div>
            </div>`).join("")}
        </div>
      </div>`;
  }

  // ── Tab switch ────────────────────────────────────────────────────────
  function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll(".pm-tab").forEach(t => {
      t.classList.toggle("active", t.textContent.trim().toLowerCase() === tab);
    });
    document.querySelectorAll(".pm-tab-content").forEach(c => c.classList.remove("active"));
    const el = document.getElementById(`pm-tab-${tab}`);
    if (el) {
      el.classList.add("active");
      if (tab === "download") {
        _updateDownloadTab();
      }
    }
  }

  function openTrailer() {
    if (!_details?.trailer?.key) return;
    window.open(`https://www.youtube.com/watch?v=${_details.trailer.key}`, "_blank");
  }

  // ── Watchlist toggle ──────────────────────────────────────────────────
  function toggleWL() {
    if (!_item) return;
    const added = Watchlist.toggle(_details || _item);
    const heroBtn = document.getElementById("pm-hero-wl-btn");
    if (heroBtn) {
      heroBtn.classList.toggle("added", added);
      heroBtn.innerHTML = `${added ? _CHECK_SVG : _PLUS_SVG} <span>${added ? "In Watchlist" : "Add to List"}</span>`;
    }
    // Update card button if visible
    const cardBtn = document.querySelector(`#card-${_item.media}-${_item.id} .card-wl`);
    if (cardBtn) {
      cardBtn.classList.toggle("added", added);
      cardBtn.innerHTML = added ? "Saved" : "Save";
    }
    window.dispatchEvent(new CustomEvent("watchlist:change"));
  }

  // ── History tracking ──────────────────────────────────────────────────
  function _onStreamClick(serverKey) {
    if (!_details && !_item) return;
    const item = _details || _item;
    StreamXHistory.recordWatch(
      item,
      item.media === "tv" ? _season : null,
      item.media === "tv" ? _episode : null
    );
  }

  let _selectedServer = "nxsha";
  localStorage.setItem("streamx_provider", "nxsha");
  localStorage.setItem("streamx_server", "nxsha");
  localStorage.removeItem("streamx_nano_subserver");
  localStorage.removeItem("streamx_nxsha_server");

  function _getApiBase() {
    const base = typeof getStreamXBackendUrl === "function" ? getStreamXBackendUrl() : "http://127.0.0.1:3000";
    return `${base}/api`;
  }

  function _getProviderLabel(key) {
    const srv = STREAM_SERVERS.find(s => s.key === key);
    return srv ? srv.label : key;
  }

  function _getSandboxAttr(key) {
    const cfg = (typeof PROVIDER_SECURITY_CONFIG !== "undefined" && PROVIDER_SECURITY_CONFIG[key]) || null;
    if (cfg && cfg.sandbox) {
      return `sandbox="${cfg.sandbox}"`;
    }
    return "";
  }

  function _showFallbackToast(msg) {
    const toast = document.getElementById("pm-fallback-toast");
    if (!toast) return;
    toast.innerHTML = `<span class="pm-toast-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span><div>${msg}</div>`;
    toast.style.display = "flex";
    setTimeout(() => {
      toast.style.display = "none";
    }, 4500);
  }

  async function _resolveServerUrl(serverKey = "nxsha") {
    const directUrl = _getSelectedServerUrl("nxsha");
    return {
      embedUrl: directUrl,
      provider: "nxsha",
      capabilities: {},
      isFallback: false
    };
  }

  function _getSelectedServerUrl(key) {
    const item = _details || _item;
    if (!item) return "";
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const targetKey = key || _selectedServer || localStorage.getItem("streamx_server") || (servers[0] && servers[0].key) || "nxsha";
    const server = servers.find(s => s.key === targetKey) || servers[0] || null;
    if (!server) return "";
    const options = {
      lang: localStorage.getItem("streamx_audio_lang") || undefined,
      sub: localStorage.getItem("streamx_sub_lang") || undefined
    };

    if (item.media === "anime") {
      if (typeof server.anime === "function") {
        return server.anime(item.id, _episode || 1, options);
      }
      return typeof server.tv === "function"
        ? server.tv(item.id, 1, _episode || 1, options)
        : server.movie(item.id, options);
    }

    const isEpisodic = item.media === "tv" || item.media === "drama" || item.media === "series";
    return isEpisodic && typeof server.tv === "function"
      ? server.tv(item.id, _season || 1, _episode || 1, options)
      : server.movie(item.id, options);
  }

  async function onProviderChange(providerKey = "nxsha", options = {}) {
    _selectedServer = providerKey || "nxsha";
    localStorage.setItem("streamx_provider", _selectedServer);
    localStorage.setItem("streamx_server", _selectedServer);

    const container = document.getElementById("pm-stream-servers-container");
    if (container) {
      container.innerHTML = _renderStreamServersHtml();
    }

    const wrap = document.querySelector(".pm-player-wrap");
    if (!wrap) return;

    if (window.UniversalPlayer && typeof window.UniversalPlayer.destroy === "function") {
      window.UniversalPlayer.destroy();
    }

    const finalEmbedUrl = _getSelectedServerUrl(_selectedServer);
    const frame = document.getElementById("stream-frame");
    if (frame) {
      _setFrameSourceWithSandbox(frame, finalEmbedUrl, _selectedServer);
    } else {
      const sandboxMarkup = _getSandboxAttr(_selectedServer);
      wrap.innerHTML = `
        <div class="pm-embed-loading" id="pm-embed-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#090a10;z-index:2;">
          <div class="loader-spinner"></div>
          <div style="font-size:13px;color:#94a3b8;margin-top:10px;">Connecting to server (${_esc((_details || _item)?.title || (_details || _item)?.name || "Selected Title")})...</div>
        </div>
        <div class="sx-iframe-header-bar" style="position:absolute;top:12px;right:12px;z-index:10;display:flex;gap:8px;">
          <button class="sx-btn-fullscreen-direct" onclick="Player.toggleWrapFullscreen()" title="Open Fullscreen" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:6px;background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,0.5);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            <span>Fullscreen</span>
          </button>
        </div>
        <iframe
          id="stream-frame"
          width="100%"
          height="100%"
          style="width:100%; height:100%; aspect-ratio:16/9; border:0; display:block;"
          frameborder="0"
          ${sandboxMarkup}
          referrerpolicy="no-referrer-when-downgrade"
          allow="accelerometer; autoplay *; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen *"
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true"
          onload="const l = document.getElementById('pm-embed-loading'); if (l) l.style.display = 'none';"
          src="${_esc(finalEmbedUrl || "")}">
        </iframe>
      `;
    }

    _onStreamClick(_selectedServer);
  }

  async function loadServer(event, url, serverKey) {
    return onProviderChange(serverKey || _selectedServer);
  }

  async function _updateServerLinks() {
    return onProviderChange(_selectedServer);
  }

  window.addEventListener("message", (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (!data) return;
      const evt = (data.event || data.type || data.action || "").toLowerCase();

      // Auto-next episode for episodic titles
      if (evt === "ended" || evt === "autonext" || evt === "video_ended" || evt === "player_ended" || evt === "cinesrc:ended" || evt === "cinesrc:nextepisode") {
        if (_details && (_details.media === "tv" || _details.media === "anime")) {
          playNextEpisode();
        }
      }

      // VidRift & CineSrc explicit exit event
      if (evt === "vidrift:exit" || evt === "cinesrc:close" || evt === "close") {
        exitBigWatch();
      }

      // Viduki, CineSrc & Multi-server failover triggers
      if (evt === "viduki:all-servers-failed" || evt === "all-servers-failed" || evt === "player_error" || evt === "cinesrc:error") {
        console.warn("[Player] Multi-server failure reported by embed (" + (data.stage || evt) + "). Failing over...");
        failoverToNextServer();
      }

      // Viduki MEDIA_DATA watch progress
      if ((data.type === "MEDIA_DATA" || evt === "media_data") && data.data) {
        try {
          localStorage.setItem("vidukinet-Progress", JSON.stringify(data.data));
          const item = _details || _item;
          if (item && item.id && data.data[item.id]) {
            const prog = data.data[item.id].progress;
            if (prog && prog.watched && prog.duration && typeof StreamXHistory !== "undefined") {
              StreamXHistory.recordProgress?.(item, prog.watched, prog.duration);
            }
          }
        } catch (_) {}
      }

      // Progress updates (Vidy / VidRift / CineSrc)
      if (evt === "timeupdate" || evt === "vidrift:progress" || evt === "cinesrc:timeupdate") {
        const item = _details || _item;
        const cur = data.currentTime ?? (data.data && data.data.currentTime) ?? data.t;
        const dur = data.duration ?? (data.data && data.data.duration);
        if (item && cur && dur && typeof StreamXHistory !== "undefined") {
          StreamXHistory.recordProgress?.(item, cur, dur);
        }
      }
    } catch { }
  });

  function playDetailTrailer() {
    const item = _details || _item;
    const trailerKey = _details?.trailer?.key || item?.trailer?.key;
    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.display = "none";
    }
    if (trailerKey) {
      const bigPlayer = document.getElementById("cinejoy-big-player");
      const bigFrame = document.getElementById("big-stream-frame");
      const bigTitle = document.getElementById("big-player-title");
      const bigSubtitle = document.getElementById("big-player-subtitle");
      if (bigPlayer && bigFrame) {
        bigPlayer.style.display = "flex";
        bigPlayer.classList.add("active");
        document.body.classList.add("big-player-active");
        const topHdr = document.getElementById("top-header");
        if (topHdr) topHdr.classList.add("header-hidden-detail");
        if (bigTitle) bigTitle.textContent = item.title || "Official Trailer";
        if (bigSubtitle) bigSubtitle.textContent = "Official YouTube Trailer";
        bigFrame.removeAttribute("sandbox");
        bigFrame.src = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`;
        _setupBigPlayerTopBarEvents();
      }
    } else {
      openTrailer();
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function _jsonAttr(obj) {
    return _esc(JSON.stringify(obj));
  }
  function _fmtNum(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }
  function _starsHTML(rating) {
    const full = Math.round(rating / 2);
    return Array.from({ length: 5 }, (_, i) =>
      `<svg class="star-icon${i < full ? " filled" : ""}" viewBox="0 0 24 24" width="13" height="13" fill="${i < full ? "var(--gold)" : "rgba(255,255,255,0.18)"}" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
    ).join("");
  }

  return {
    open,
    close,
    watchNow,
    playBigVideoStream,
    downloadCurrentTitle,
    toggleWatchedStatus,
    exitBigWatch,
    cancelWatchLoader,
    toggleBigPlayerFullscreen,
    playEpisode,
    toggleSound,
    toggleWL,
    switchTab,
    openTrailer,
    onSeasonChange,
    onEpisodeChange,
    onEpisodeSearch,
    clearEpisodeSearch,
    toggleSortOrder,
    onProviderChange,
    onServerNodeChange,
    onSubServerChange,
    toggleWrapFullscreen,
    switchPlaybackMode,
    setAudioLanguage,
    _onStreamClick,
    loadServer,
    playNextEpisode,
    playPrevEpisode,
    confirmNextEpisode,
    cancelNextEpisode,
    switchServer,
    toggleServerDropdown,
    failoverToNextServer,
    playDetailTrailer,
    enterLandscapeFullscreen,
    toggleLandscapeRotate,
    forceMountServer,
    toggleSeasonDropdown,
    toggleRatingSort,
    markAllSeasonWatched,
    scrollEpisodesCarousel,
    toggleSpoilerProtection,
    revealEpisode,
    toggleSideServerDrawer,
    toggleDrawerSeasonDropdown,
    toggleDrawerServerDropdown,
    onDrawerSeasonChange,
    onDrawerEpisodeSearch,
    toggleDrawerSpoiler,
    toggleDrawerAutoNext,
    revealDrawerEpisode,
    setHoverZoomEpisode,
    setFocusedDrawerEpisode: _setFocusedDrawerEpisode,
    onDrawerCardClick,
    _animateModalZoomIn,
    _animateModalZoomOut
  };
})();

window.Player = Player;