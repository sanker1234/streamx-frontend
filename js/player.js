/**
 * StreamX v2 — player.js
 * Cinematic Movie & Series Detail Page with Dynamic Autoplaying Trailers,
 * Sound Controls, Full Playback Integration, Episode Cards, Cast & Recommendations.
 */

const Player = (() => {
  let _item            = null;   // current normalised item
  let _details         = null;   // full TMDB detail response
  let _season          = 1;
  let _episode         = 1;
  let _tab             = "stream";
  let _seasons         = [];     // season list from TMDB
  let _currentEpisodes = [];     // episodes of currently selected season
  let _loadToken       = 0;      // prevents race conditions when switching titles quickly
  let _epSearchQuery   = "";     // TV show episode search filter
  let _epSortOrder     = "asc";  // TV show episode numeric sort order: "asc" | "desc"

  // ── SVGs ──────────────────────────────────────────────────────────────
  const _VOLUME_X_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
  const _VOLUME_2_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const _PLAY_SVG     = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const _PLUS_SVG     = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
  const _CHECK_SVG    = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

  // ── DOM refs ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Open Cinematic Detail Modal ───────────────────────────────────────
  async function open(item, skipHashPush = false) {
    if (!item || !item.id) return;

    const myToken = ++_loadToken;
    _item            = item;
    _season          = 1;
    _episode         = 1;
    _tab             = "stream";
    _currentEpisodes = [];
    _epSearchQuery   = "";
    _epSortOrder     = "asc";

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
    _epSearchQuery = "";
    _epSortOrder = "asc";

    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(false);
      window.HeroTrailerController.destroy("detail");
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

    _item            = null;
    _details         = null;
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
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true">
        <div class="pm-cinematic-body" style="padding:60px 20px;text-align:center;color:var(--text3)">
          <p style="font-size:36px;margin-bottom:12px">⚠️</p>
          <h2 style="font-size:22px;color:#fff;margin-bottom:8px">Unable to Load Title</h2>
          <p style="margin-bottom:20px">${_esc(msg)}</p>
          <button class="btn-primary" onclick="Player.close()">Return to Browse</button>
        </div>
      </div>`;
  }

  // ── Full Cinematic Detail Render ──────────────────────────────────────
  function _renderFull() {
    const d  = _details;
    const wl = Watchlist.has(d.id, d.media);

    // Genre labels
    const genreNames = d.genres.length
      ? d.genres.slice(0, 3).join(" · ")
      : d.genre_ids.map(gid => (GENRE_MAP[d.media]?.[gid] || "")).filter(Boolean).slice(0,3).join(" · ");

    const ratingStars = _starsHTML(d.rating);
    const is4k = d.rating >= 7.5;

    // Detect badge label
    const contentType = _getContentType(d);
    let badgeLabel = d.media === "movie" ? "MOVIE" : "TV SHOW";
    if (contentType === "kdrama") badgeLabel = "K-DRAMA";
    else if (contentType === "cdrama") badgeLabel = "C-DRAMA";
    else if (contentType === "jdrama") badgeLabel = "J-DRAMA";

    // Clean synopsis
    const shortOverview = d.overview ? (d.overview.length > 280 ? d.overview.slice(0, 280) + "…" : d.overview) : "";

    $("player-modal-bg").innerHTML = `
      <div class="player-modal cinematic-detail-modal" role="dialog" aria-modal="true" aria-label="${_esc(d.title)}">

        <!-- 1. Large Cinematic Trailer Hero -->
        <div class="pm-cinematic-hero" style="background-image:url('${d.backdrop || d.poster || ""}')">
          <!-- Autoplaying Video Trailer Layer -->
          <div class="pm-hero-video-layer" id="pm-hero-video-layer"></div>
          <!-- Dark Gradients Vignette -->
          <div class="pm-hero-vignette"></div>

          <!-- Top Controls Bar -->
          <div class="pm-hero-top-bar">
            <button class="pm-hero-back-btn" onclick="Player.close()" aria-label="Go back">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back</span>
            </button>

            <!-- Working Sound Toggle -->
            <button class="pm-hero-sound-btn" id="pm-hero-sound-btn" onclick="Player.toggleSound()" aria-label="Unmute trailer" title="Unmute trailer" style="display:none">
              <span class="hero-sound-icon">${_VOLUME_X_SVG}</span>
              <span class="hero-sound-text">Muted</span>
            </button>
          </div>

          <!-- Overlaid Content Details in Lower-Left Area -->
          <div class="pm-hero-content">
            <div class="pm-hero-badges">
              <span class="badge badge-${d.media}">${badgeLabel}</span>
              ${is4k ? '<span class="badge badge-4k">4K ULTRA HD</span>' : '<span class="badge badge-hd">HD</span>'}
              ${d.year ? `<span class="badge badge-year">${d.year}</span>` : ""}
              ${d.runtime ? `<span class="badge badge-meta">${d.runtime}m</span>` : ""}
              ${d.seasons ? `<span class="badge badge-meta">${d.seasons} Season${d.seasons>1?"s":""}</span>` : ""}
              ${genreNames ? `<span class="pm-hero-genres">${_esc(genreNames)}</span>` : ""}
            </div>

            <h1 class="pm-hero-title">${_esc(d.title)}</h1>
            ${d.tagline ? `<p class="pm-hero-tagline">"${_esc(d.tagline)}"</p>` : ""}
            ${shortOverview ? `<p class="pm-hero-overview">${_esc(shortOverview)}</p>` : ""}

            <div class="pm-hero-rating">
              ${ratingStars}
              <span class="pm-rating-num">${d.rating.toFixed(1)}</span>
              <span class="pm-votes">(${_fmtNum(d.votes)} votes)</span>
            </div>

            <div class="pm-hero-actions">
              <button class="pm-play-btn" onclick="Player.watchNow()">
                ${_PLAY_SVG}
                <span>${d.media === "tv" ? `Watch S${_season} E${_episode}` : "Watch Now"}</span>
              </button>
              <button class="pm-wl-action-btn${wl ? " added" : ""}" id="pm-hero-wl-btn" onclick="Player.toggleWL()">
                ${wl ? _CHECK_SVG : _PLUS_SVG}
                <span>${wl ? "In Watchlist" : "Add to List"}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Content Sections Underneath Hero -->
        <div class="pm-cinematic-body">

          <!-- Full Playback Stream & Download Container (Reveals when Watch is triggered) -->
          <div id="pm-player-section" style="display:none;">
            <div class="pm-player-header-row">
              <span class="pm-current-playing-badge" id="pm-playing-badge">
                ${d.media === "tv" ? `Season ${_season}, Episode ${_episode}` : "Now Streaming"}
              </span>

              ${d.media === "tv" ? `
              <div class="pm-player-nav-btns">
                <button class="pm-nav-btn" onclick="Player.playPrevEpisode()" title="Previous Episode">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                  <span>Prev</span>
                </button>
                <button class="pm-nav-btn" onclick="Player.playNextEpisode()" title="Next Episode">
                  <span>Next</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
              </div>` : ""}
            </div>

            <div class="pm-tabs">
              <button class="pm-tab${_tab==="stream"?" active":""}" onclick="Player.switchTab('stream')">Stream</button>
              <button class="pm-tab${_tab==="download"?" active":""}" onclick="Player.switchTab('download')">Download</button>
            </div>

            <div id="pm-tab-stream" class="pm-tab-content${_tab==="stream"?" active":""}">
              <div class="pm-player-wrap">
                <iframe
                  id="stream-frame"
                  width="100%"
                  height="100%"
                  style="width:100%; height:100%; aspect-ratio:16/9; border:0; display:block;"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowfullscreen>
                </iframe>
              </div>
              ${_renderStreamServers()}
            </div>

            <div id="pm-tab-download" class="pm-tab-content${_tab==="download"?" active":""}">
              ${_renderDownloadServers()}
            </div>
          </div>

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

          <!-- Movie Section (1. Movie Information) -->
          ${d.media === "movie" ? _renderMovieInfo() : ""}

          <!-- Cast Section -->
          ${d.cast?.length ? _renderCast(d.cast) : ""}

          <!-- Recommendations Section -->
          ${d.recommendations?.length ? _renderRecommendations(d.recommendations) : ""}
        </div>
      </div>`;

    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  // ── Watch Now Action (Triggers full content streaming) ────────────────
  function watchNow(seasonNum, episodeNum) {
    if (typeof seasonNum === "number") _season = seasonNum;
    if (typeof episodeNum === "number") _episode = episodeNum;

    // Stop and silence background trailer preview immediately so audio never collides
    if (window.HeroTrailerController) {
      window.HeroTrailerController.setFullPlayerActive(true);
      window.HeroTrailerController.silenceAll();
      window.HeroTrailerController.pause("detail");
    }

    const playerSec = document.getElementById("pm-player-section");
    if (playerSec) {
      playerSec.style.display = "block";
      playerSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Update playing badge
    const badge = document.getElementById("pm-playing-badge");
    if (badge && _details?.media === "tv") {
      badge.textContent = `Season ${_season}, Episode ${_episode}`;
    }

    // Update active highlight on episode cards
    if (_details?.media === "tv") {
      document.querySelectorAll(".pm-ep-card").forEach(c => c.classList.remove("active"));
      const targetCard = document.getElementById(`pm-ep-card-${_episode}`);
      if (targetCard) targetCard.classList.add("active");
    }

    _updateServerLinks();
    _updateDownloadTab();
    _onStreamClick(_selectedServer);
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

  // ── Stream servers ────────────────────────────────────────────────────
  function _renderStreamServers() {
    const contentType = _getContentType(_details);
    const activeServers = STREAM_SERVERS.filter(srv => {
      if (!srv.supportedCategories) return true;
      return srv.supportedCategories.includes(contentType);
    });

    if (activeServers.length > 0 && !activeServers.some(srv => srv.key === _selectedServer)) {
      _selectedServer = activeServers[0].key;
      localStorage.setItem("streamx_provider", _selectedServer);
      localStorage.setItem("streamx_server", _selectedServer);
    }

    const currentProviderObj = activeServers.find(srv => srv.key === _selectedServer) || activeServers[0];

    return `
      <div class="pm-provider-ctrl">
        <label for="pm-provider-select" class="pm-provider-label">Streaming Provider</label>
        <div class="pm-provider-select-wrap">
          <select id="pm-provider-select" class="pm-provider-select" onchange="Player.onProviderChange(this.value)">
            ${activeServers.map(srv => {
              const isSelected = srv.key === _selectedServer;
              const label = `${srv.label}${srv.recommended ? " (Recommended)" : ""}`;
              return `<option value="${srv.key}" ${isSelected ? "selected" : ""}>
                ${isSelected ? "✓ " : "• "}${_esc(label)}
              </option>`;
            }).join("")}
          </select>
          <div class="pm-select-arrow">▼</div>
        </div>
        ${currentProviderObj ? `<div class="pm-provider-desc">${currentProviderObj.icon} ${_esc(currentProviderObj.desc)}</div>` : ""}
      </div>
      <div id="pm-fallback-toast" class="pm-fallback-toast" style="display:none;"></div>
    `;
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
      <div class="pm-dl-grid">
        ${DOWNLOAD_SERVERS.map(dl => {
          const url = typeof dl.url === "function" ? dl.url(item, _season || 1, _episode || 1) : "#";
          if (isMobile) {
            return `<a class="dl-btn" href="${url}" onclick="event.preventDefault(); var w = window.open('${url}', '_blank'); if (!w || w.closed) { window.location.href = '${url}'; }" rel="noopener noreferrer">
              <div class="dl-icon">${dl.icon}</div>
              <div class="srv-info">
                <div class="dl-name">${_esc(dl.label)}</div>
                <div class="srv-desc">${_esc(isTv ? `Direct Download (Season ${_season || 1}, Episode ${_episode || 1}) · VidVault` : dl.desc)}</div>
              </div>
              <span class="dl-arrow">↗</span>
            </a>`;
          }
          return `<a class="dl-btn" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="dl-icon">${dl.icon}</div>
            <div class="srv-info">
              <div class="dl-name">${_esc(dl.label)}</div>
              <div class="srv-desc">${_esc(isTv ? `Direct Download (Season ${_season || 1}, Episode ${_episode || 1}) · VidVault` : dl.desc)}</div>
            </div>
            <span class="dl-arrow">↗</span>
          </a>`;
        }).join("")}
      </div>
      <p class="pm-note">${isTv ? `Direct episode download powered by VidVault (S${_season || 1} E${_episode || 1}).` : "Fast downloads powered by VidVault with direct TMDB ID support for movies and series."}</p>`;
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
              <div class="cast-photo" style="background-image:url('${p.photo||""}')">
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
              <div class="rec-poster" style="background-image:url('${r.poster||""}')">
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

  let _selectedServer = localStorage.getItem("streamx_provider") || localStorage.getItem("streamx_server") || "vidlink";
  if (_selectedServer === "videm" || !STREAM_SERVERS.some(s => s.key === _selectedServer)) {
    _selectedServer = STREAM_SERVERS[0]?.key || "vidlink";
  }

  function _getApiBase() {
    const base = typeof getStreamXBackendUrl === "function" ? getStreamXBackendUrl() : "http://127.0.0.1:3000";
    return `${base}/api`;
  }

  function _getProviderLabel(key) {
    const srv = STREAM_SERVERS.find(s => s.key === key);
    return srv ? srv.label : key;
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

  async function _resolveServerUrl(serverKey) {
    if (!_details) return { embedUrl: "", provider: serverKey, capabilities: {} };
    const isTV = _details.media === "tv";
    const mediaType = isTV ? "tv" : "movie";
    const seasonStr = isTV ? `&season=${_season}` : "";
    const episodeStr = isTV ? `&episode=${_episode}` : "";

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const response = await fetch(`${_getApiBase()}/movie/sources/${mediaType}/${_details.id}?provider=${serverKey}${seasonStr}${episodeStr}`, { signal: ctrl.signal });
      clearTimeout(t);
      const data = await response.json();
      if (data.success && (data.embedUrl || (data.sources && data.sources.length > 0))) {
        return {
          embedUrl: data.embedUrl,
          provider: data.provider || serverKey,
          capabilities: data.capabilities || {},
          isFallback: Boolean(data.provider && data.provider !== serverKey)
        };
      }
    } catch (e) {
      console.warn("Failed to fetch resolved URL from backend, using client-side fallback:", e);
    }

    const fallbackUrl = _getSelectedServerUrl(serverKey);
    return {
      embedUrl: fallbackUrl,
      provider: serverKey,
      capabilities: {},
      isFallback: false
    };
  }

  function _getSelectedServerUrl(key = _selectedServer) {
    if (!_details) return "";
    const server = STREAM_SERVERS.find(srv => srv.key === key) || STREAM_SERVERS[0];
    if (!server) return "";
    return _details.media === "tv"
      ? server.tv(_details.id, _season, _episode)
      : server.movie(_details.id);
  }

  async function onProviderChange(providerKey) {
    if (!providerKey) return;

    const res = await _resolveServerUrl(providerKey);
    const targetProviderKey = res.provider || providerKey;
    const finalEmbedUrl = res.embedUrl || _getSelectedServerUrl(providerKey);

    if (res.isFallback || targetProviderKey !== providerKey) {
      const origLabel = _getProviderLabel(providerKey);
      const newLabel = _getProviderLabel(targetProviderKey);
      _showFallbackToast(`${_esc(origLabel)} unavailable.<br>Switched to ${_esc(newLabel)}.`);
    }

    _selectedServer = targetProviderKey;
    localStorage.setItem("streamx_provider", targetProviderKey);
    localStorage.setItem("streamx_server", targetProviderKey);

    const selectEl = document.getElementById("pm-provider-select");
    if (selectEl && selectEl.options) {
      selectEl.value = targetProviderKey;
      Array.from(selectEl.options).forEach(opt => {
        const srv = STREAM_SERVERS.find(s => s.key === opt.value);
        const label = srv ? `${srv.label}${srv.recommended ? " (Recommended)" : ""}` : opt.value;
        const isSel = opt.value === targetProviderKey;
        opt.textContent = `${isSel ? "✓ " : "• "}${label}`;
      });
    }

    const frame = document.getElementById("stream-frame");
    if (frame && frame.parentNode && frame.attributes) {
      const parent = frame.parentNode;
      const newFrame = document.createElement("iframe");
      for (const attr of frame.attributes) {
        if (attr.name !== "src" && attr.name !== "sandbox") {
          newFrame.setAttribute(attr.name, attr.value);
        }
      }
      newFrame.removeAttribute("sandbox");
      newFrame.setAttribute("allowfullscreen", "true");
      newFrame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen");
      newFrame.src = finalEmbedUrl || "";
      parent.replaceChild(newFrame, frame);
    }

    _onStreamClick(targetProviderKey);
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
      if (evt === "ended" || evt === "autonext" || evt === "video_ended" || evt === "player_ended") {
        if (_details && _details.media === "tv") {
          playNextEpisode();
        }
      }
    } catch {}
  });

  // ── Utilities ─────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function _jsonAttr(obj) {
    return _esc(JSON.stringify(obj));
  }
  function _fmtNum(n) {
    return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
  }
  function _starsHTML(rating) {
    const full = Math.round(rating / 2);
    return Array.from({length:5},(_,i)=>
      `<svg class="star-icon${i<full?" filled":""}" viewBox="0 0 24 24" width="13" height="13" fill="${i<full?"var(--gold)":"rgba(255,255,255,0.18)"}" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`
    ).join("");
  }

  return {
    open,
    close,
    watchNow,
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
    _onStreamClick,
    loadServer,
    playNextEpisode,
    playPrevEpisode,
  };
})();

window.Player = Player;