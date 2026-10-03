/**
 * StreamX v2 — player.js
 * Handles the detail modal, server picker, season/episode selectors,
 * download tab, watchlist toggle, and cast section.
 * All content data arrives via TMDB.getDetails() — nothing is hard-coded.
 */

const Player = (() => {
  let _item      = null;   // current normalised item
  let _details   = null;   // full TMDB detail response
  let _season    = 1;
  let _episode   = 1;
  let _tab       = "stream";
  let _seasons   = [];     // season list from TMDB

  // ── DOM refs ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Open modal ────────────────────────────────────────────────────────
  async function open(item) {
    _item    = item;
    _season  = 1;
    _episode = 1;
    _tab     = "stream";

    // Show skeleton immediately
    $("player-modal-bg").classList.add("open");
    document.body.style.overflow = "hidden";
    _renderSkeleton(item);

    // Track as recently viewed
    StreamXHistory.recordView(item);

    // Restore last watched episode if TV
    if (item.media === "tv") {
      const last = StreamXHistory.getLastEpisode(item.id);
      if (last) { _season = last.season || 1; _episode = last.episode || 1; }
    }

    try {
         _details = await TMDB.getDetails(item.media, item.id);
        _seasons = _details.season_list || [];

        _renderFull();

        if (_details.media === "tv" && _seasons.length) {
          onSeasonChange(_season);
        } else if (_selectedServer) {
          _updateServerLinks();
        }
    } catch (err) {
      console.error("Player: detail fetch failed", err);
      _renderError(err.message);
    }
  }

  function close(skipHashPush = false) {
    const frame = document.getElementById("stream-frame");
    if (frame) frame.src = "";
    const bg = $("player-modal-bg");
    if (bg) {
      bg.classList.remove("open");
      bg.innerHTML = "";
    }
    document.body.style.overflow = "";
    _item    = null;
    _details = null;
    // Restore URL hash to home only if not already navigating or instructed to skip
    if (!skipHashPush && window.location.hash && window.location.hash !== "#/") {
      history.pushState(null, "", "#/");
    }
  }

  function _handleBackdropClick(e) {
    if (!e || !e.isTrusted) return;
    if (window._streamxLastLayoutChange && (Date.now() - window._streamxLastLayoutChange < 400)) return;
    if (e.target === $("player-modal-bg")) close();
  }

  // ── Skeleton ──────────────────────────────────────────────────────────
  function _renderSkeleton(item) {
    $("player-modal-bg").innerHTML = `
      <div class="player-modal" role="dialog" aria-modal="true">
        <div class="pm-header">
          <button class="pm-close" onclick="Player.close()" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          <span class="pm-header-title">${_esc(item.title)}</span>
        </div>
        <div class="pm-body">
          <div class="pm-hero skeleton-hero" style="background-image:url('${item.backdrop||""}')">
            <div class="pm-hero-overlay"></div>
            <div class="pm-hero-info">
              <div class="skeleton-line w60"></div>
              <div class="skeleton-line w40" style="margin-top:8px"></div>
            </div>
          </div>
          <div class="pm-content"><div class="loader-spinner"></div></div>
        </div>
      </div>`;
    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  function _renderError(msg) {
    $("player-modal-bg").innerHTML = `
      <div class="player-modal">
        <div class="pm-header">
          <button class="pm-close" onclick="Player.close()" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          <span class="pm-header-title">Error</span>
        </div>
        <div class="pm-body" style="padding:40px;text-align:center;color:var(--text3)">
          <p style="font-size:32px;margin-bottom:12px">Error</p>
          <p>${_esc(msg)}</p>
          ${msg.includes("API key") ? `<p style="margin-top:12px;font-size:12px">Open <code>js/config.js</code> and add your backend key.</p>` : ""}
        </div>
      </div>`;
  }

  // ── Full render ───────────────────────────────────────────────────────
  function _renderFull() {
    const d  = _details;
    const wl = Watchlist.has(d.id, d.media);

    // Genre labels from TMDB data
    const genreNames = d.genres.length
      ? d.genres.slice(0, 3).join(" · ")
      : d.genre_ids.map(gid => (GENRE_MAP[d.media]?.[gid] || "")).filter(Boolean).slice(0,3).join(" · ");

    const ratingStars = _starsHTML(d.rating);
    const is4k = d.rating >= 7.5;

    $("player-modal-bg").innerHTML = `
      <div class="player-modal" role="dialog" aria-modal="true" aria-label="${_esc(d.title)}">
        <div class="pm-header">
          <button class="pm-close" onclick="Player.close()" aria-label="Close"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          <span class="pm-header-title">${_esc(d.title)}</span>
          <div class="pm-header-actions">
            <button class="pm-wl-btn${wl?" added":""}" onclick="Player.toggleWL()" id="pm-wl-btn">
              ${wl ? "Saved" : "Watchlist"}
            </button>
          </div>
        </div>

        <div class="pm-body">
          <!-- Hero backdrop -->
          <div class="pm-hero" style="${window.innerWidth <= 768 ? 'display:none!important;' : ''} background-image:url('${d.backdrop||""}')">
            <div class="pm-hero-overlay"></div>
            <div class="pm-hero-info">
              <h2 class="pm-title">${_esc(d.title)}</h2>
              ${d.tagline ? `<p class="pm-tagline">"${_esc(d.tagline)}"</p>` : ""}
              <div class="pm-badges">
                <span class="badge badge-${d.media}">${d.media === "movie" ? "MOVIE" : "TV"}</span>
                ${is4k ? '<span class="badge badge-4k">4K</span>' : ""}
                ${d.year ? `<span class="badge badge-year">${d.year}</span>` : ""}
                ${d.runtime ? `<span class="badge badge-meta">${d.runtime}m</span>` : ""}
                ${d.seasons ? `<span class="badge badge-meta">${d.seasons} Season${d.seasons>1?"s":""}</span>` : ""}
                ${d.status ? `<span class="badge badge-meta">${_esc(d.status)}</span>` : ""}
              </div>
              <div class="pm-rating-row">
                ${ratingStars}
                <span class="pm-rating-num">${d.rating.toFixed(1)}</span>
                <span class="pm-votes">(${_fmtNum(d.votes)} votes)</span>
              </div>
              <div class="pm-hero-cta-row">
                <button class="btn-primary pm-cta-btn" onclick="Player.switchTab('stream'); document.getElementById('pm-tab-stream')?.scrollIntoView({behavior:'smooth', block:'nearest'});">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  <span>Watch Now</span>
                </button>
                <button class="btn-secondary pm-cta-btn" onclick="Player.switchTab('download'); document.getElementById('pm-tab-download')?.scrollIntoView({behavior:'smooth', block:'nearest'});">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>

          <div class="pm-content">
            <!-- Mobile Info Bar (Visible on mobile when hero banner is hidden) -->
            <div class="pm-mobile-bar" style="${window.innerWidth <= 768 ? 'display:flex!important;' : 'display:none;'}">
              <span class="badge badge-${d.media}">${d.media === "movie" ? "MOVIE" : "TV"}</span>
              ${is4k ? '<span class="badge badge-4k">4K</span>' : ""}
              ${d.year ? `<span class="badge badge-year">${d.year}</span>` : ""}
              ${d.runtime ? `<span class="badge badge-meta">${d.runtime}m</span>` : ""}
              ${d.seasons ? `<span class="badge badge-meta">${d.seasons} Season${d.seasons>1?"s":""}</span>` : ""}
              <span class="pm-rating-num" style="margin-left:auto; color:var(--gold); font-weight:700;">★ ${d.rating.toFixed(1)}</span>
            </div>

            <!-- Tabs -->
            <div class="pm-tabs">
              <button class="pm-tab${_tab==="stream"?" active":""}" onclick="Player.switchTab('stream')">Stream</button>
              <button class="pm-tab${_tab==="download"?" active":""}" onclick="Player.switchTab('download')">Download</button>
              ${d.trailer ? `<button class="pm-tab" onclick="Player.openTrailer()">Trailer</button>` : ""}
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
                  allowfullscreen
                  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups">
                  </iframe>
              </div>

              ${_renderStreamServers()}
            </div>
            <div id="pm-tab-download" class="pm-tab-content${_tab==="download"?" active":""}">
              ${_renderDownloadServers()}
            </div>

            <!-- TV season/episode selector -->
            ${d.media === "tv" ? _renderTVControls() : ""}

            <!-- Overview -->
            ${d.overview ? `<p class="pm-overview">${_esc(d.overview)}</p>` : ""}
            ${genreNames ? `<p class="pm-genres"><span class="pm-label">Genres:</span> ${_esc(genreNames)}</p>` : ""}

            <!-- Cast -->
            ${d.cast?.length ? _renderCast(d.cast) : ""}

            <!-- Recommendations -->
            ${d.recommendations?.length ? _renderRecommendations(d.recommendations) : ""}
          </div>
        </div>
      </div>`;

    $("player-modal-bg").onclick = _handleBackdropClick;
  }

  // ── TV Controls ───────────────────────────────────────────────────────
  function _renderTVControls() {
    if (!_seasons.length) return "";
    const seasonOpts = _seasons.map(s =>
      `<option value="${s.season_number}" ${s.season_number===_season?"selected":""}>${_esc(s.name)}</option>`
    ).join("");
    return `
      <div class="pm-tv-ctrl">
        <select class="ep-sel" id="pm-season-sel" onchange="Player.onSeasonChange(this.value)">
          ${seasonOpts}
        </select>
        <select class="ep-sel" id="pm-episode-sel" onchange="Player.onEpisodeChange(this.value)">
          <option value="1" ${_episode===1?"selected":""}>Episode 1</option>
        </select>
        <button class="btn-primary" id="pm-next-ep-btn" onclick="Player.playNextEpisode()">Next Episode</button>
      </div>`;
  }

  function playNextEpisode() {
    const epSel = document.getElementById("pm-episode-sel");
    if (!epSel) return;
    const currentVal = parseInt(epSel.value);
    const options = Array.from(epSel.options);
    const currentIndex = options.findIndex(opt => parseInt(opt.value) === currentVal);

    if (currentIndex !== -1 && currentIndex + 1 < options.length) {
      const nextOption = options[currentIndex + 1];
      epSel.value = nextOption.value;
      onEpisodeChange(nextOption.value);
    } else {
      const seasonSel = document.getElementById("pm-season-sel");
      if (seasonSel) {
        const currentSeason = parseInt(seasonSel.value);
        const seasonOptions = Array.from(seasonSel.options);
        const nextSeasonIndex = seasonOptions.findIndex(opt => parseInt(opt.value) === currentSeason) + 1;
        if (nextSeasonIndex < seasonOptions.length) {
          const nextSeasonVal = seasonOptions[nextSeasonIndex].value;
          seasonSel.value = nextSeasonVal;
          onSeasonChange(nextSeasonVal).then(() => {
            setTimeout(() => {
              const freshEpSel = document.getElementById("pm-episode-sel");
              if (freshEpSel) {
                freshEpSel.value = "1";
                onEpisodeChange(1);
              }
            }, 600);
          });
        }
      }
    }
  }

  // Async: fetch season detail to populate episode list
  async function onSeasonChange(val) {
     console.log("Season changed:", val);
    _season  = parseInt(val);
    _episode = 1;
    const epSel = document.getElementById("pm-episode-sel");
    if (!epSel) return;
    epSel.innerHTML = `<option>Loading…</option>`;
    try {
      const season = await TMDB.getSeason(_item.id, _season);

        console.log("SEASON DATA:", season);
        console.log("EPISODE COUNT:", season.episodes?.length);

        epSel.innerHTML = season.episodes.map(ep =>
        `<option value="${ep.episode_number}">${ep.episode_number}. ${_esc(ep.name)}</option>`
        ).join("");
    } catch {
      epSel.innerHTML = `<option value="1">Episode 1</option>`;
    }
    _updateServerLinks();
    _updateDownloadTab();
  }

  function onEpisodeChange(val) {
    _episode = parseInt(val);
    _updateServerLinks();
    _updateDownloadTab();
  }


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

    const tvLabel = isTv ? ` · Season ${_season || 1}, Episode ${_episode || 1}` : "";

    return `
      <p class="pm-srv-label">Download sources${tvLabel} — opens in new tab</p>
      <div class="pm-dl-grid">
        ${DOWNLOAD_SERVERS.map(dl => {
          const url = typeof dl.url === "function" ? dl.url(item, _season || 1, _episode || 1) : "#";
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
      </div>`;
  }

  // ── Recommendations ───────────────────────────────────────────────────
  function _renderRecommendations(recs) {
    return `
      <h3 class="pm-section-title">You May Also Like</h3>
      <div class="pm-rec-scroll">
        ${recs.map(r => `
          <div class="rec-card" onclick="Player.open(${_jsonAttr(r)})">
            <div class="rec-poster" style="background-image:url('${r.poster||""}')">
              ${!r.poster ? `<span class="rec-no-img">${_esc(r.title.charAt(0))}</span>` : ""}
              <div class="rec-overlay"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
            </div>
            <div class="rec-title">${_esc(r.title)}</div>
            <div class="rec-year">${r.year} · <svg viewBox="0 0 24 24" width="11" height="11" fill="var(--gold)" style="vertical-align:middle;display:inline-block"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> ${r.rating.toFixed(1)}</div>
          </div>`).join("")}
      </div>`;
  }

  // ── Tab switch ────────────────────────────────────────────────────────
  function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll(".pm-tab").forEach((t, i) => {
      const tabs = ["stream","download","trailer"];
      t.classList.toggle("active", tabs[i] === tab);
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
    if (!_details?.trailer) return;
    window.open(`https://www.youtube.com/watch?v=${_details.trailer.key}`, "_blank");
  }

  // ── Watchlist toggle ──────────────────────────────────────────────────
  function toggleWL() {
    if (!_item) return;
    const added = Watchlist.toggle(_details || _item);
    const btn   = document.getElementById("pm-wl-btn");
    if (btn) {
      btn.className = `pm-wl-btn${added?" added":""}`;
      btn.textContent = added ? "Saved" : "Watchlist";
    }
    // Update card heart if visible
    const cardBtn = document.querySelector(`#card-${_item.media}-${_item.id} .card-wl`);
    if (cardBtn) {
      cardBtn.classList.toggle("added", added);
      cardBtn.innerHTML = added ? "Saved" : "Save";
    }
    // Dispatch global count update
    window.dispatchEvent(new CustomEvent("watchlist:change"));
  }

  // Track stream click → record in history
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
      const t = setTimeout(() => ctrl.abort(), 4000); // 4s timeout so player never hangs
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

  // Handle provider dropdown change & URL loading
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

    // Update select element UI
    const selectEl = document.getElementById("pm-provider-select");
    if (selectEl) {
      selectEl.value = targetProviderKey;
      Array.from(selectEl.options).forEach(opt => {
        const srv = STREAM_SERVERS.find(s => s.key === opt.value);
        const label = srv ? `${srv.label}${srv.recommended ? " (Recommended)" : ""}` : opt.value;
        const isSel = opt.value === targetProviderKey;
        opt.textContent = `${isSel ? "✓ " : "• "}${label}`;
      });
    }

    // Update iframe safely without sandbox restriction
    const frame = document.getElementById("stream-frame");
    if (frame) {
      const parent = frame.parentNode;
      const newFrame = document.createElement("iframe");
      for (const attr of frame.attributes) {
        if (attr.name !== "src" && attr.name !== "sandbox") {
          newFrame.setAttribute(attr.name, attr.value);
        }
      }

      // Security sandbox prevents third-party ads from hijacking the top window,
      // executing infinite redirect loops, or crashing mobile Chrome
      newFrame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups");
      newFrame.setAttribute("allowfullscreen", "true");
      newFrame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen");

      newFrame.src = finalEmbedUrl || "";
      parent.replaceChild(newFrame, frame);
    }

    _onStreamClick(targetProviderKey);
  }

  // Load server compatibility shim for legacy callers
  async function loadServer(event, url, serverKey) {
    return onProviderChange(serverKey || _selectedServer);
  }

  // Re-render server links with updated S/E
  async function _updateServerLinks() {
    return onProviderChange(_selectedServer);
  }

  // Global postMessage listener for player capabilities (auto-next, etc.)
  window.addEventListener("message", (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (!data) return;
      
      const evt = (data.event || data.type || data.action || "").toLowerCase();
      if (evt === "ended" || evt === "autonext" || evt === "video_ended" || evt === "player_ended") {
        console.log("[StreamX Player] Received ended event from provider, playing next episode...");
        if (_details && _details.media === "tv") {
          playNextEpisode();
        }
      }
    } catch (e) {
      // Ignore non-JSON postMessage data
    }
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
    toggleWL,
    switchTab,
    openTrailer,
    onSeasonChange,
    onEpisodeChange,
    onProviderChange,
    _onStreamClick,
    loadServer,
    playNextEpisode,
  };
})();

window.Player = Player;