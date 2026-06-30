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
    History.recordView(item);

    // Restore last watched episode if TV
    if (item.media === "tv") {
      const last = History.getLastEpisode(item.id);
      if (last) { _season = last.season || 1; _episode = last.episode || 1; }
    }

    try {
         _details = await TMDB.getDetails(item.media, item.id);
        _seasons = _details.season_list || [];

        _renderFull();

        if (_details.media === "tv" && _seasons.length) {
            setTimeout(() => onSeasonChange(_season), 100);
        }
    } catch (err) {
      console.error("Player: detail fetch failed", err);
      _renderError(err.message);
    }
  }

  function close() {

    const frame = document.getElementById("stream-frame");

    if (frame) {
        frame.src = "";
    }

    $("player-modal-bg").classList.remove("open");
    document.body.style.overflow = "";

    _item = null;
    _details = null;
}

  // ── Skeleton ──────────────────────────────────────────────────────────
  function _renderSkeleton(item) {
    $("player-modal-bg").innerHTML = `
      <div class="player-modal" role="dialog" aria-modal="true">
        <div class="pm-header">
          <button class="pm-close" onclick="Player.close()" aria-label="Close">✕</button>
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
    $("player-modal-bg").onclick = e => { if (e.target === $("player-modal-bg")) close(); };
  }

  function _renderError(msg) {
    $("player-modal-bg").innerHTML = `
      <div class="player-modal">
        <div class="pm-header">
          <button class="pm-close" onclick="Player.close()">✕</button>
          <span class="pm-header-title">Error</span>
        </div>
        <div class="pm-body" style="padding:40px;text-align:center;color:var(--text3)">
          <p style="font-size:32px;margin-bottom:12px">⚠️</p>
          <p>${_esc(msg)}</p>
          ${msg.includes("API key") ? `<p style="margin-top:12px;font-size:12px">Open <code>js/config.js</code> and paste your TMDB API key.</p>` : ""}
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
          <button class="pm-close" onclick="Player.close()" aria-label="Close">✕</button>
          <span class="pm-header-title">${_esc(d.title)}</span>
          <div class="pm-header-actions">
            <button class="pm-wl-btn${wl?" added":""}" onclick="Player.toggleWL()" id="pm-wl-btn">
              ${wl ? "♥ Saved" : "♡ Watchlist"}
            </button>
          </div>
        </div>

        <div class="pm-body">
          <!-- Hero backdrop -->
          <div class="pm-hero" style="background-image:url('${d.backdrop||""}')">
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
            </div>
          </div>

          <div class="pm-content">
            <!-- Overview -->
            ${d.overview ? `<p class="pm-overview">${_esc(d.overview)}</p>` : ""}
            ${genreNames ? `<p class="pm-genres"><span class="pm-label">Genres:</span> ${_esc(genreNames)}</p>` : ""}

            <!-- TV season/episode selector -->
            ${d.media === "tv" ? _renderTVControls() : ""}

            <!-- Tabs -->
            <div class="pm-tabs">
              <button class="pm-tab${_tab==="stream"?" active":""}" onclick="Player.switchTab('stream')">▶ Stream</button>
              <button class="pm-tab${_tab==="download"?" active":""}" onclick="Player.switchTab('download')">⬇ Download</button>
              ${d.trailer ? `<button class="pm-tab" onclick="Player.openTrailer()">🎬 Trailer</button>` : ""}
            </div>

            <div id="pm-tab-stream" class="pm-tab-content${_tab==="stream"?" active":""}">

            <div class="pm-player-wrap">
                <iframe
                id="stream-frame"
                width="100%"
                height="500"
                frameborder="0"
                allowfullscreen>
                </iframe>
            </div>

            ${_renderStreamServers()}
            </div>
            <div id="pm-tab-download" class="pm-tab-content${_tab==="download"?" active":""}">
              ${_renderDownloadServers()}
            </div>

            <!-- Cast -->
            ${d.cast?.length ? _renderCast(d.cast) : ""}

            <!-- Recommendations -->
            ${d.recommendations?.length ? _renderRecommendations(d.recommendations) : ""}
          </div>
        </div>
      </div>`;

    $("player-modal-bg").onclick = e => { if (e.target === $("player-modal-bg")) close(); };
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
      </div>`;
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
  }

  function onEpisodeChange(val) {
    _episode = parseInt(val);
    _updateServerLinks();
  }

  // Re-render server links with updated S/E
  function _updateServerLinks() {
    const frame = document.getElementById("stream-frame");

        if (frame) {
            frame.src = "";
        }
    }
  //dont render the server links when season or episode changes, just update the iframe src if it is already loaded


  // ── Stream servers ────────────────────────────────────────────────────
    function _renderStreamServers() {
    const isTV = _details?.media === "tv";

    return `
        <p class="pm-srv-label">Select a server</p>

        <div class="pm-srv-grid">
        ${STREAM_SERVERS.map(srv => {
            const url = isTV
            ? srv.tv(_details.id, _season, _episode)
            : srv.movie(_details.id);

            return `
            <button class="srv-btn ${_selectedServer === srv.key ? 'active' : ''}"
       onclick="Player.loadServer(event,'${url}','${srv.key}')">

                <div class="srv-icon"
                    style="background:${srv.color}22;color:${srv.color}">
                ${srv.icon}
                </div>

                <div class="srv-info">
                <div class="srv-name">${_esc(srv.label)}</div>
                <div class="srv-desc">${_esc(srv.desc)}</div>
                </div>

            </button>
            `;
        }).join("")}
        </div>

        <p class="pm-note">
        ( Intitally ,Click once selected server to play )->If a server fails, try another one.
        </p>
    `;
    }

  // ── Download servers ──────────────────────────────────────────────────
  function _renderDownloadServers() {
    const item = _details || _item;
    return `
      <p class="pm-srv-label">Download sources — opens in new tab</p>
      <div class="pm-dl-grid">
        ${DOWNLOAD_SERVERS.map(dl => {
          const url = dl.url(item);
          return `<a class="dl-btn" href="${url}" target="_blank" rel="noopener noreferrer">
            <div class="dl-icon">${dl.icon}</div>
            <div class="srv-info">
              <div class="dl-name">${_esc(dl.label)}</div>
              <div class="srv-desc">${_esc(dl.desc)}</div>
            </div>
            <span class="dl-arrow">↗</span>
          </a>`;
        }).join("")}
      </div>
      <p class="pm-note">Download links search the title on each site. YTS for movies · Nyaa for anime.</p>`;
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
              <div class="rec-overlay"><span>▶</span></div>
            </div>
            <div class="rec-title">${_esc(r.title)}</div>
            <div class="rec-year">${r.year} · ⭐ ${r.rating.toFixed(1)}</div>
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
    if (el) el.classList.add("active");
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
      btn.textContent = added ? "♥ Saved" : "♡ Watchlist";
    }
    // Update card heart if visible
    const cardBtn = document.querySelector(`#card-${_item.media}-${_item.id} .card-wl`);
    if (cardBtn) {
      cardBtn.classList.toggle("added", added);
      cardBtn.innerHTML = added ? "♥" : "♡";
    }
    // Dispatch global count update
    window.dispatchEvent(new CustomEvent("watchlist:change"));
  }

  // Track stream click → record in history
  function _onStreamClick(serverKey) {
    if (!_details && !_item) return;
    const item = _details || _item;
    History.recordWatch(
      item,
      item.media === "tv" ? _season : null,
      item.media === "tv" ? _episode : null
    );
  }
  let _selectedServer = localStorage.getItem("streamx_server") || "";

  // Load server in iframe
  function loadServer(event,url, serverKey) {
    _selectedServer = serverKey;

     console.log("Clicked:", serverKey);
    
    document.querySelectorAll(".srv-btn").forEach(btn => {
    btn.classList.remove("active");
});

event.currentTarget.classList.add("active");


    localStorage.setItem("streamx_server", serverKey);

    const frame = document.getElementById("stream-frame");

    if (frame) {
        frame.src = url;
    }

        // redraw buttons so active server is highlighted
    _onStreamClick(serverKey);
}

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
      `<span class="star${i<full?"":" empty"}">★</span>`
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
  _onStreamClick,
  loadServer,
};
})();