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
    document.body.style.overflow = "hidden";
    _renderSkeleton(item);

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

      // Dynamically mount title's own autoplaying trailer in background
      if (window.HeroTrailerController) {
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

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
    }

    if (window.UniversalPlayer && typeof window.UniversalPlayer.destroy === "function") {
      window.UniversalPlayer.destroy();
    }

    const frame = document.getElementById("stream-frame");
    if (frame) frame.src = "";

    const bg = $("player-modal-bg");
    if (bg) {
      bg.classList.remove("open");
      bg.classList.remove("has-cinematic-detail");
      bg.innerHTML = "";
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
  }

  function _handleBackdropClick(e) {
    if (!e || !e.isTrusted) return;
    if (window._streamxLastLayoutChange && (Date.now() - window._streamxLastLayoutChange < 400)) return;
    if (e.target === $("player-modal-bg")) close();
  }

  // ── Skeleton Loader ───────────────────────────────────────────────────
  function _renderSkeleton(item) {
    const backdropUrl = item.backdrop || item.poster || "";
    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="${_esc(item.title || "Loading...")}">
        <div class="pm-cinematic-hero skeleton-hero" style="background-image:url('${backdropUrl}')">
          <div class="pm-hero-vignette"></div>
          <div class="pm-hero-top-bar">
            <button class="pm-hero-back-btn" onclick="Player.close()" aria-label="Go back">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back</span>
            </button>
          </div>
          <div class="pm-hero-content">
            <div class="skeleton-line" style="width:120px;height:24px;border-radius:6px;margin-bottom:12px;"></div>
            <h1 class="pm-hero-title">${_esc(item.title || "")}</h1>
            <div class="skeleton-line" style="width:65%;height:16px;border-radius:4px;margin-top:10px;"></div>
            <div class="skeleton-line" style="width:45%;height:16px;border-radius:4px;margin-top:8px;"></div>
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
        <div class="pm-hero-top-bar" style="position:relative;background:none;backdrop-filter:none;padding:16px 20px;">
          <button class="pm-hero-back-btn" onclick="Player.close()" aria-label="Close modal">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Close</span>
          </button>
        </div>
        <div class="empty-state" role="alert" style="padding:48px 24px 64px;">
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

  function _formatReleaseDate(dateStr) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    const langCode = (d.original_language || "en").toUpperCase();
    const studioName = (d.production_companies && d.production_companies[0]?.name)
      || (d.networks && d.networks[0])
      || "";
    const certRating = d.adult ? "18+" : (d.rating >= 7.5 ? "R" : "PG-13");

    // Clean synopsis
    const shortOverview = d.overview || "";

    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="${_esc(d.title)}">

        <!-- 1. Large Cinematic Trailer Hero (Screenshot 8 & 9) -->
        <div class="pm-cinematic-hero" style="background-image:url('${d.backdrop || d.poster || ""}')">
          <!-- Autoplaying Video Trailer Layer -->
          <div class="pm-hero-video-layer" id="pm-hero-video-layer"></div>
          <!-- Dark Gradients Vignette -->
          <div class="pm-hero-vignette"></div>

          <!-- Top Controls Bar with Back button and header brand -->
          <div class="pm-hero-top-bar">
            <button class="pm-hero-back-btn" onclick="Player.close()" aria-label="Go back">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back</span>
            </button>
          </div>

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
                ${d.year ? `<span class="pm-meta-item">${d.year}</span>` : ""}
                ${runtimeText ? `<span class="pm-meta-item">${runtimeText}</span>` : ""}
                <span class="pm-meta-item pm-cert-badge">${certRating}</span>
                <span class="pm-meta-item pm-star-rating">★ ${d.rating.toFixed(1)}</span>
                <span class="pm-meta-item pm-votes-count">👍 0 &nbsp; 👎 0</span>
              </div>

              <!-- Director Info Line -->
              ${d.director ? `<div class="pm-hero-director-line">Director: <strong>${_esc(d.director)}</strong></div>` : ""}

              <!-- Synopsis Overview -->
              ${shortOverview ? `<p class="pm-hero-overview">${_esc(shortOverview)}</p>` : ""}
            </div>

            <!-- Right-Side Glassmorphic Card (Screenshot 8 & 9) -->
            <div class="pm-hero-right">
              <div class="pm-hero-side-card">
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

          <!-- Series Sections (1. Season Selector, 2. Episode Cards) -->
          ${d.media === "tv" ? `
            <div class="pm-series-section">
              <div class="pm-episodes-header-row">
                <h3 class="pm-section-title" style="margin-bottom:0;">Episodes</h3>
                <div class="pm-episodes-controls">
                  <div class="pm-ep-search-box">
                    <svg class="pm-ep-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input type="text" id="pm-ep-search-input" class="pm-ep-search-input" placeholder="Search episodes..." value="${_esc(_epSearchQuery)}" oninput="Player.onEpisodeSearch(this.value)" autocomplete="off">
                    <button id="pm-ep-search-clear" class="pm-ep-search-clear" onclick="Player.clearEpisodeSearch()" style="${_epSearchQuery ? 'display:flex;' : 'display:none;'}" title="Clear search">✕</button>
                  </div>
                  <button id="pm-ep-sort-btn" class="pm-ep-sort-btn${_epSortOrder === 'desc' ? ' desc' : ''}" onclick="Player.toggleSortOrder()" title="Toggle sort order" aria-label="Toggle sort order">
                    <svg class="pm-sort-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
                    <span id="pm-ep-sort-label">${_epSortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                  </button>
                </div>
              </div>
              ${_renderSeasonSelector()}
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
    const menu = document.getElementById("server-dropdown-menu");
    if (!menu) return;
    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const activeKey = _selectedServer || localStorage.getItem("streamx_server") || "nxsha";

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

    // When toggling between sandboxed (NXsha) and unsandboxed (external embed engines),
    // clone and replace the node to force browser instantiation of the new security context.
    if (currentHasSandbox !== isNxsha && frameEl.parentNode) {
      const clone = frameEl.cloneNode(false);
      if (isNxsha) {
        clone.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
      } else {
        clone.removeAttribute("sandbox");
      }
      clone.src = targetUrl;
      frameEl.parentNode.replaceChild(clone, frameEl);
      return clone;
    }

    if (isNxsha) {
      frameEl.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    } else {
      frameEl.removeAttribute("sandbox");
    }

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

    const menu = document.getElementById("server-dropdown-menu");
    if (menu) {
      menu.style.display = "none";
      const pill = document.getElementById("server-active-pill");
      if (pill) pill.setAttribute("aria-expanded", "false");
    }

    const newUrl = _getSelectedServerUrl(target.key);
    const bigFrame = document.getElementById("big-stream-frame");
    if (bigFrame && newUrl) {
      _setFrameSourceWithSandbox(bigFrame, newUrl, target.key);
    }

    const frame = document.getElementById("stream-frame");
    if (frame && newUrl) {
      _setFrameSourceWithSandbox(frame, newUrl, target.key);
    }

    _showBigToast(`Switched server to ${target.label}`);
    _renderServerDropdownItems();
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
  });

  // ── Watch Now Action (Triggers Big Full-Viewport Cinema Streaming) ──────
  function watchNow(seasonNum, episodeNum, serverKey) {
    if (typeof seasonNum === "number") _season = seasonNum;
    if (typeof episodeNum === "number") _episode = episodeNum;

    const item = _details || _item;
    if (!item) return;

    const servers = (typeof window.STREAM_SERVERS !== "undefined" && window.STREAM_SERVERS.length) ? window.STREAM_SERVERS : (typeof STREAM_SERVERS !== "undefined" ? STREAM_SERVERS : []);
    const activeKey = serverKey || _selectedServer || localStorage.getItem("streamx_server") || (servers[0] && servers[0].key) || "nxsha";
    _selectedServer = activeKey;
    localStorage.setItem("streamx_server", activeKey);

    // Stop and silence background trailer preview immediately
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.silenceAll();
      window.HeroTrailerController.pause("detail");
    }

    const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : (item.media === "anime" ? "anime" : "movie");
    const targetUrl = _getSelectedServerUrl(activeKey);
    if (!targetUrl) return;

    // 1. Show Animated Pre-Playback Loader (Image 15)
    const loader = document.getElementById("cinejoy-watch-loader");
    const loaderBackdrop = document.getElementById("watch-loader-backdrop");
    const loaderStatus = document.getElementById("watch-loader-status");
    if (loader && loaderBackdrop && loaderStatus) {
      loaderBackdrop.style.backgroundImage = `url('${item.backdrop || item.poster || ""}')`;
      loaderStatus.textContent = "Pinging Solara...";
      loader.style.opacity = "1";
      loader.style.visibility = "visible";
      loader.style.display = "flex";

      if (_watchLoaderTimer) clearTimeout(_watchLoaderTimer);
      _watchLoaderTimer = setTimeout(() => {
        loaderStatus.textContent = "Optimizing stream...";
      }, 700);
    }

    // Preload big stream frame
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

    // Update active server label and dropdown
    const serverLabel = document.getElementById("current-server-label");
    const activeServerObj = servers.find(s => s.key === activeKey);
    if (serverLabel && activeServerObj) {
      serverLabel.textContent = activeServerObj.label;
    }
    _renderServerDropdownItems();

    // 2. Transition from loader to big player after ~1200ms
    setTimeout(() => {
      if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => {
          loader.style.display = "none";
        }, 350);
      }

      if (bigPlayer && bigFrame) {
        bigPlayer.style.display = "flex";
        const bigVideo = document.getElementById("big-video-player");
        if (bigVideo) {
          bigVideo.pause();
          bigVideo.style.display = "none";
        }
        bigFrame.style.display = "block";
        _setFrameSourceWithSandbox(bigFrame, targetUrl, activeKey);

        // Push watch hash so back button exits player
        const watchHash = cleanMedia === "tv"
          ? `#/watch/tv/${item.id}/${_season}/${_episode}`
          : (cleanMedia === "anime" ? `#/watch/anime/${item.id}/${_episode || 1}` : `#/watch/movie/${item.id}`);
        if (window.location.hash !== watchHash) {
          history.pushState({ cinejoy_watch: true }, "", watchHash);
        }

        // Bind auto-hiding top bar on inactivity
        _setupBigPlayerTopBarEvents();
      }
    }, 1200);

    // Update active highlight on episode cards if modal is behind
    if (cleanMedia === "tv") {
      document.querySelectorAll(".pm-ep-card").forEach(c => c.classList.remove("active"));
      const targetCard = document.getElementById(`pm-ep-card-${_episode}`);
      if (targetCard) targetCard.classList.add("active");
    }

    _onStreamClick(activeKey);
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
        if (bigFrame) {
          bigFrame.style.display = "none";
          bigFrame.src = "";
        }
        bigVideo.style.display = "block";

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
    resetTimer();
  }

  function exitBigWatch(skipHistory = false) {
    const bigPlayer = document.getElementById("cinejoy-big-player");
    const bigFrame = document.getElementById("big-stream-frame");
    const bigVideo = document.getElementById("big-video-player");

    if (bigPlayer) bigPlayer.style.display = "none";
    if (bigFrame) {
      bigFrame.src = "";
      bigFrame.style.display = "block";
    }
    if (bigVideo) {
      bigVideo.pause();
      bigVideo.removeAttribute("src");
      bigVideo.load();
      bigVideo.style.display = "none";
    }
    if (_bigHlsInstance) {
      _bigHlsInstance.destroy();
      _bigHlsInstance = null;
    }
    if (_bigPlayerMouseMoveTimer) clearTimeout(_bigPlayerMouseMoveTimer);

    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) loader.style.display = "none";

    // Restore previous hash cleanly without history push loops
    if (!skipHistory) {
      if (window.location.hash.startsWith("#/watch/")) {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          const item = _details || _item;
          if (item) {
            const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : "movie";
            history.replaceState({ streamx: true }, "", `#/${cleanMedia}/${item.id}`);
          } else {
            history.replaceState({ streamx: true }, "", "#/");
          }
        }
      } else {
        const item = _details || _item;
        if (item) {
          const cleanMedia = (item.media === "drama" || item.media === "tv") ? "tv" : "movie";
          const detailHash = `#/${cleanMedia}/${item.id}`;
          if (window.location.hash !== detailHash) {
            history.replaceState({ streamx: true }, "", detailHash);
          }
        }
      }
    }
  }

  function cancelWatchLoader() {
    const loader = document.getElementById("cinejoy-watch-loader");
    if (loader) loader.style.display = "none";
    if (_watchLoaderTimer) clearTimeout(_watchLoaderTimer);
    const bigFrame = document.getElementById("big-stream-frame");
    if (bigFrame) bigFrame.src = "";
  }

  function toggleBigPlayerFullscreen() {
    const bigPlayer = document.getElementById("cinejoy-big-player") || document.body;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (bigPlayer.requestFullscreen) {
        bigPlayer.requestFullscreen().catch(() => {});
      } else if (bigPlayer.webkitRequestFullscreen) {
        bigPlayer.webkitRequestFullscreen();
      }
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

  // ── Series Season Selector, Episode Search/Sort & Cards ────────────────
  function _renderSeasonSelector() {
    if (!_seasons || _seasons.length <= 1) return "";
    return `
      <div class="pm-season-selector-row">
        <span class="pm-season-label">Season:</span>
        <div class="pm-season-pills">
          ${_seasons.map(s => `
            <button class="pm-season-pill${s.season_number === _season ? " active" : ""}"
              data-season="${s.season_number}"
              onclick="Player.onSeasonChange(${s.season_number})">
              ${_esc(s.name || `Season ${s.season_number}`)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
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
    list.sort((a, b) => {
      const numA = parseFloat(a.episode_number) || 0;
      const numB = parseFloat(b.episode_number) || 0;
      return _epSortOrder === "desc" ? numB - numA : numA - numB;
    });
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

    return `
      <div class="pm-episodes-grid">
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

      return `
            <div class="pm-ep-card${isCurrent ? " active" : ""}" id="pm-ep-card-${ep.episode_number}" onclick="Player.playEpisode(${ep.episode_number})">
              <div class="pm-ep-thumb" style="background-image:url('${stillUrl}')">
                <div class="pm-ep-thumb-overlay">${_PLAY_SVG}</div>
                <span class="pm-ep-num-badge">EP ${ep.episode_number}</span>
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
    `;
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
    _epSortOrder = _epSortOrder === "asc" ? "desc" : "asc";
    const btn = $("pm-ep-sort-btn");
    const lbl = $("pm-ep-sort-label");
    if (btn) btn.classList.toggle("desc", _epSortOrder === "desc");
    if (lbl) lbl.textContent = _epSortOrder === "asc" ? "Ascending" : "Descending";
    const container = $("pm-episodes-container");
    if (container) container.innerHTML = _renderEpisodesList();
  }

  async function onSeasonChange(val) {
    _season = parseInt(val);
    _episode = 1;
    _epSearchQuery = "";

    const searchInput = $("pm-ep-search-input");
    if (searchInput) searchInput.value = "";
    const clearBtn = $("pm-ep-search-clear");
    if (clearBtn) clearBtn.style.display = "none";

    // Update pills active state
    document.querySelectorAll(".pm-season-pill").forEach(p => {
      p.classList.toggle("active", parseInt(p.getAttribute("data-season")) === _season);
    });

    const epsContainer = document.getElementById("pm-episodes-container");
    if (epsContainer) {
      epsContainer.innerHTML = `<div class="loader-spinner" style="margin:40px auto;"></div>`;
    }

    try {
      const seasonData = await TMDB.getSeason(_item.id, _season);
      _currentEpisodes = seasonData.episodes || [];
    } catch {
      _currentEpisodes = [];
    }

    if (epsContainer) {
      epsContainer.innerHTML = _renderEpisodesList();
    }

    // Update watch button text
    const playBtnText = document.querySelector(".pm-play-btn span");
    if (playBtnText && _details?.media === "tv") {
      playBtnText.textContent = `Watch S${_season} E${_episode}`;
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

  function playNextEpisode() {
    if (!_details || _details.media !== "tv" || !_currentEpisodes.length) return;
    const currentIdx = _currentEpisodes.findIndex(ep => ep.episode_number === _episode);
    if (currentIdx !== -1 && currentIdx + 1 < _currentEpisodes.length) {
      const nextEp = _currentEpisodes[currentIdx + 1].episode_number;
      playEpisode(nextEp);
    } else {
      // Go to next season
      const seasonIdx = _seasons.findIndex(s => s.season_number === _season);
      if (seasonIdx !== -1 && seasonIdx + 1 < _seasons.length) {
        const nextSeason = _seasons[seasonIdx + 1].season_number;
        onSeasonChange(nextSeason).then(() => {
          setTimeout(() => playEpisode(1), 300);
        });
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
        console.warn("[Player] Multi-server failure reported by embed. Failing over...");
        failoverToNextServer();
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
    switchServer,
    toggleServerDropdown,
    failoverToNextServer
  };
})();

window.Player = Player;