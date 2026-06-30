/**
 * StreamX v2 — app.js
 * Main application controller.
 * Orchestrates TMDB data → UI rendering.
 * ZERO hard-coded content. All content flows from TMDB API responses.
 */

const App = (() => {
  // ── State ─────────────────────────────────────────────────────────────
  let _currentPage   = "home";
  let _searchQuery   = "";
  let _searchPage    = 1;
  let _searchTotal   = 1;
  let _searchTimer   = null;
  let _heroItems     = [];
  let _heroIdx       = 0;
  let _heroTimer     = null;
  let _infiniteState = {}; // rowId → { page, total, loading }
  let _imgObserver   = null;

  // ── Boot ──────────────────────────────────────────────────────────────
  async function init() {
    if (!TMDB_API_KEY || TMDB_API_KEY === "PASTE_YOUR_TMDB_API_KEY_HERE") {
      _showApiKeyBanner();
    }

    _setupLazyObserver();
    _bindGlobalEvents();
    _updateWLCount();
    _renderHistoryRows();

    await Promise.all([
    _loadHero(),
    _renderHomeRows()
]);
    // Keyboard shortcut: / to focus search
document.addEventListener("keydown", (e) => {

    // "/" focuses the search bar
    if (
        e.key === "/" &&
        _currentPage === "home" &&
        document.activeElement.tagName !== "INPUT"
    ) {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
    }

    // Escape closes the player
    if (e.key === "Escape") {
        Player.close();
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
    
  }
    document.addEventListener("mousedown", function(e) {
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
  

  // ── API key missing banner ─────────────────────────────────────────────
  function _showApiKeyBanner() {
    const banner = document.createElement("div");
    banner.id = "api-banner";
    banner.innerHTML = `
      <strong>⚠️ TMDB API Key Required</strong>
      Open <code>js/config.js</code>, replace <code>PASTE_YOUR_TMDB_API_KEY_HERE</code> with your free key from
      <a href="https://www.themoviedb.org/settings/api" target="_blank">themoviedb.org</a>.
      <button onclick="this.parentElement.remove()">✕</button>`;
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
            img.classList.add("loaded");
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
  }

  // ── Hero banner ───────────────────────────────────────────────────────
  async function _loadHero() {
    try {
      const data = await TMDB.getTrending("all", "week");
      _heroItems = data.results
        .filter(i => i.backdrop && i.overview)
        .slice(0, APP_CONFIG.hero_count);
      _heroIdx = 0;
      _renderHero();
      _startHeroRotation();
      const hero = document.getElementById("hero");

hero.addEventListener("mouseenter", () => {
    clearInterval(_heroTimer);
});

hero.addEventListener("mouseleave", () => {
    _startHeroRotation();
});
    } catch (err) {
      console.error("Hero load failed:", err);
    }
  }

  function _renderHero() {
    const hero = document.getElementById("hero");
    if (!hero || !_heroItems.length) return;
    const item = _heroItems[_heroIdx];
    const genreNames = item.genre_ids
      .slice(0,3)
      .map(gid => GENRE_MAP[item.media]?.[gid])
      .filter(Boolean)
      .join(" · ");

    hero.style.backgroundImage = `url('${item.backdrop}')`;
    hero.innerHTML = `
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-badges">
          <span class="badge badge-${item.media}">${item.media === "movie" ? "MOVIE" : "TV"}</span>
          ${item.year ? `<span class="badge badge-year">${item.year}</span>` : ""}
          ${genreNames ? `<span class="hero-genres">${_esc(genreNames)}</span>` : ""}
        </div>
        <h1 class="hero-title">${_esc(item.title)}</h1>
        <p class="hero-overview">${_esc(item.overview.slice(0, 200))}${item.overview.length > 200 ? "…" : ""}</p>
        <div class="hero-rating">
          ${_starsHTML(item.rating)}
          <span class="hero-rating-num">${item.rating.toFixed(1)}</span>
        </div>
        <div class="hero-btns">
          <button class="btn-primary" onclick="App.openItem(${_jsonAttr(item)})">▶ Watch Now</button>
          <button class="btn-secondary" onclick="App.openItem(${_jsonAttr(item)})">ℹ More Info</button>
        </div>
      </div>
     <div class="hero-arrow hero-prev" onclick="App.prevHero()">
    <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M15 18L9 12L15 6"
              stroke="white"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"/>
    </svg>
</div>

<div class="hero-arrow hero-next" onclick="App.nextHero()">
    <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M9 18L15 12L9 6"
              stroke="white"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"/>
    </svg>
</div>
<div class="hero-dots">
  ${_heroItems.map((_,i)=>
    `<span class="hero-dot${i===_heroIdx?" active":""}"
      onclick="App.goHero(${i})"></span>`).join("")}
</div>`;
  }

  function _startHeroRotation() {
    clearInterval(_heroTimer);
    _heroTimer = setInterval(() => {
      _heroIdx = (_heroIdx + 1) % _heroItems.length;
      _renderHero();
    }, 8000);
  }

  function goHero(idx) {
    _heroIdx = idx;
    _renderHero();
    _startHeroRotation(); // reset timer
  }
  function prevHero() {

    if (!_heroItems.length) return;

    _heroIdx =
        (_heroIdx - 1 + _heroItems.length) %
        _heroItems.length;

    _renderHero();
    _startHeroRotation();
}

function nextHero() {

    if (!_heroItems.length) return;

    _heroIdx =
        (_heroIdx + 1) %
        _heroItems.length;

    _renderHero();
    _startHeroRotation();
}


  // ── Home rows ─────────────────────────────────────────────────────────
  async function _renderHomeRows() {
    const container = document.getElementById("home-rows");
    if (!container) return;
    container.innerHTML = "";

    // Render rows sequentially so page is progressively filled
    for (const row of HOME_ROWS) {
      const section = _createRowSection(row);
      container.appendChild(section);
      _loadRow(row, section); // async, non-blocking
    }
  }

  function _createRowSection(row) {
    const section = document.createElement("section");
    section.className = "row-section";
    section.id = `row-${row.id}`;
    section.innerHTML = `
      <div class="row-header">
        <h2 class="row-title">${_esc(row.label)}</h2>
        <button class="row-see-all" onclick="App.openBrowse('${row.id}')">See all →</button>
      </div>
      <div class="row-scroll" id="row-scroll-${row.id}">
        ${Array(8).fill('<div class="card card-skeleton"></div>').join("")}
      </div>`;
    return section;
  }

  async function _loadRow(row, section) {
    try {
      const data = await TMDB.fetchRow(row, 1);
      _infiniteState[row.id] = { page: 1, total: data.total_pages, loading: false };

      const scroll = section.querySelector(`#row-scroll-${row.id}`);
      if (!scroll) return;
      scroll.innerHTML = data.results
        .filter(i => i.poster)
        .map(i => _cardHTML(i))
        .join("");

      // Observe lazy images
      scroll.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));

      // Infinite scroll on the row
      _setupRowInfiniteScroll(row, scroll);
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
        const data = await TMDB.fetchRow(row, state.page + 1);
        state.page++;
        state.total   = data.total_pages;
        loader.remove();

        const frag = document.createDocumentFragment();
        data.results.filter(i => i.poster).forEach(i => {
          const div = document.createElement("div");
          div.innerHTML = _cardHTML(i);
          const card = div.firstElementChild;
          frag.appendChild(card);
          card.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
        });
        scroll.insertBefore(frag, sentinel);
      } catch {}
      state.loading = false;
    }, { rootMargin: "300px" });

    obs.observe(sentinel);
  }

  // ── Card HTML ─────────────────────────────────────────────────────────
  function _cardHTML(item) {
    const wl   = Watchlist.has(item.id, item.media);
    const isTV = item.media === "tv";
    return `
      <div class="card" id="card-${item.media}-${item.id}" onclick="App.openItem(${_jsonAttr(item)})">
        <div class="card-poster">
          <img data-src="${item.poster}" alt="${_esc(item.title)}" class="card-img lazy" loading="lazy">
          <div class="card-no-img" style="display:${item.poster?"none":"flex"}">${_esc(item.title.charAt(0))}</div>
          <div class="card-overlay">
            <div class="card-play-btn">▶</div>
          </div>
          <span class="card-badge badge-${item.media}">${isTV ? "TV" : "MOVIE"}</span>
          <button class="card-wl${wl?" added":""}"
            onclick="event.stopPropagation();App.toggleWL(${_jsonAttr(item)})"
            aria-label="${wl?"Remove from":"Add to"} watchlist">
            ${wl ? "♥" : "♡"}
          </button>
        </div>
        <div class="card-info">
          <div class="card-title">${_esc(item.title)}</div>
          <div class="card-meta">
            <span class="card-rating">⭐ ${item.rating.toFixed(1)}</span>
            ${item.year ? `<span class="card-year">${item.year}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  // ── History rows (Continue Watching / Recently Viewed) ─────────────────
  function _renderHistoryRows() {
    const container = document.getElementById("history-rows");
    if (!container) return;
    container.innerHTML = "";

    const watched = History.getWatchHistory();
    const recent  = History.getRecentlyViewed();

    if (watched.length) {
      container.appendChild(_buildStaticRow("Continue Watching", watched, true));
    }
    if (recent.length) {
      container.appendChild(_buildStaticRow("Recently Viewed", recent, false));
    }
  }

  function _buildStaticRow(label, items, showEpInfo) {
    const section = document.createElement("section");
    section.className = "row-section";
    section.innerHTML = `
      <div class="row-header">
        <h2 class="row-title">${label}</h2>
        ${label === "Continue Watching" ? `<button class="row-see-all" onclick="History.clearWatchHistory();App._renderHistoryRows()">Clear</button>` : ""}
      </div>
      <div class="row-scroll">
        ${items.map(i => _historyCardHTML(i, showEpInfo)).join("")}
      </div>`;
    section.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
    return section;
  }

  function _historyCardHTML(item, showEpInfo) {
    const epLabel = showEpInfo && item.season
      ? `<div class="history-ep">S${item.season} E${item.episode||1}</div>` : "";
    return `
      <div class="card history-card" onclick="App.openItem(${_jsonAttr(item)})">
        <div class="card-poster">
          <img data-src="${item.poster||""}" alt="${_esc(item.title)}" class="card-img lazy">
          <div class="card-overlay"><div class="card-play-btn">▶</div></div>
          ${epLabel}
        </div>
        <div class="card-info">
          <div class="card-title">${_esc(item.title)}</div>
          <div class="card-meta"><span class="card-year">${item.year||""}</span></div>
        </div>
      </div>`;
  }

  // ── Search ────────────────────────────────────────────────────────────
  function onSearchInput(val) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => _doSearch(val), APP_CONFIG.search_debounce);
  }

  async function _doSearch(query) {
    query = query.trim();
    if (!query) {
      _showPage("home");
      return;
    }
    _searchQuery = query;
    _searchPage  = 1;
    _showPage("search");
    document.getElementById("search-label").textContent = `Searching for "${query}"…`;
    document.getElementById("search-grid").innerHTML =
      Array(8).fill('<div class="card card-skeleton"></div>').join("");

    try {
      const data = await TMDB.search(query, 1);
      _searchTotal = data.total_pages;
      _renderSearchResults(data.results, false);
    } catch (err) {
      document.getElementById("search-grid").innerHTML =
        `<p class="search-error">Search failed: ${_esc(err.message)}</p>`;
    }
  }

  function _renderSearchResults(results, append) {
    const grid  = document.getElementById("search-grid");
    const label = document.getElementById("search-label");
    if (!grid) return;

    if (!results.length && !append) {
      label.textContent = `No results for "${_searchQuery}"`;
      grid.innerHTML = "";
      return;
    }

    label.textContent = `Results for "${_searchQuery}"`;
    const html = results.filter(i => i.poster).map(i => _cardHTML(i)).join("");

    if (append) {
      grid.insertAdjacentHTML("beforeend", html);
    } else {
      grid.innerHTML = html;
    }
    grid.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));

    // Search infinite scroll sentinel
    const existing = document.getElementById("search-sentinel");
    if (existing) existing.remove();
    if (_searchPage < _searchTotal) {
      const sentinel = document.createElement("div");
      sentinel.id = "search-sentinel";
      grid.appendChild(sentinel);
      const obs = new IntersectionObserver(async entries => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        _searchPage++;
        try {
          const more = await TMDB.search(_searchQuery, _searchPage);
          _searchTotal = more.total_pages;
          _renderSearchResults(more.results, true);
        } catch {}
      }, { rootMargin: "200px" });
      obs.observe(sentinel);
    }
  }

  // ── Browse page (full discover for a row) ─────────────────────────────
  async function openBrowse(rowId) {
   
    if (
  rowId === "bollywood" ||
  rowId === "tollywood" ||
  rowId === "kollywood" ||
  rowId === "mollywood" ||
  rowId === "sandalwood"
) {

  _showPage("browse");
  const grid = document.getElementById("browse-grid");
const rows = document.getElementById("browse-rows");

grid.style.display = "none";
rows.style.display = "block";

  document.getElementById("browse-title").textContent =
    rowId.charAt(0).toUpperCase() + rowId.slice(1);

 rows.innerHTML = `


<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">🔥 Trending</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_trending')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-trending"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">⭐ Popular</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_popular')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-popular"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">🏆 Top Rated</h2>
    <button class="row-see-all" onclick="App.openBrowse('${rowId}_top')">
      See all →
    </button>
  </div>
  <div class="row-scroll" id="${rowId}-top"></div>
</section>

<section class="row-section">
  <div class="row-header">
    <h2 class="row-title">📺 TV Shows</h2>
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
    document.getElementById("browse-grid").style.display = "grid";
document.getElementById("browse-rows").style.display = "none";

    const row = HOME_ROWS.find(r => r.id === rowId);
    if (!row) return;
    _showPage("browse");
    document.getElementById("browse-title").textContent = row.label;
    document.getElementById("browse-grid").innerHTML =
      Array(12).fill('<div class="card card-skeleton"></div>').join("");

    let page = 1; let total = 1;

    const loadMore = async () => {
      const data = await TMDB.fetchRow(row, page);
      total = data.total_pages;
      const grid = document.getElementById("browse-grid");
      if (!grid) return;
      if (page === 1) grid.innerHTML = "";
      const html = data.results.filter(i=>i.poster).map(i=>_cardHTML(i)).join("");
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
        }, { rootMargin:"300px" });
        obs.observe(sentinel);
      }
    };

    try { await loadMore(); }
    catch (err) {
      document.getElementById("browse-grid").innerHTML =
        `<p class="row-error">${_esc(err.message)}</p>`;
    }
  }
 // ── Load Indian row (for Bollywood, Tollywood, etc.) ─────────────────
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

  // ── Watchlist page ────────────────────────────────────────────────────
  function _renderWatchlistPage() {
    const container = document.getElementById("wl-grid");
    if (!container) return;
    const items = Watchlist.getAll();
    document.getElementById("wl-count").textContent = `(${items.length} title${items.length!==1?"s":""})`;
    if (!items.length) {
      container.innerHTML = `<div class="empty-state">
        <p style="font-size:40px;margin-bottom:12px">🎬</p>
        <p>Your watchlist is empty.</p>
        <p style="font-size:12px;margin-top:6px">Click ♡ on any title to save it.</p>
      </div>`;
      return;
    }
    container.innerHTML = items.map(i => _cardHTML(i)).join("");
    container.querySelectorAll("img[data-src]").forEach(img => _observeImg(img));
  }

  // ── Page routing ──────────────────────────────────────────────────────
  function _showPage(page) {
    _currentPage = page;
    ["home","search","browse","watchlist"].forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.style.display = p === page ? "block" : "none";
    });
    if (page !== "search") document.getElementById("search-input").value = "";
    if (page === "home") {
  document.getElementById("browse-grid").innerHTML = "";
  _renderHistoryRows();
  _renderHomeRows();
}
    if (page === "watchlist") _renderWatchlistPage();
  }

  function showPage(page) { _showPage(page); }

  // ── Watchlist toggle (from cards) ─────────────────────────────────────
  function toggleWL(item) {
    const added = Watchlist.toggle(item);
    const btn = document.querySelector(`#card-${item.media}-${item.id} .card-wl`);
    if (btn) { btn.classList.toggle("added", added); btn.innerHTML = added ? "♥" : "♡"; }
  }

  // ── Open item (open Player modal) ─────────────────────────────────────
  function openItem(item) {
    Player.open(item);
  }

  // ── WL count badge ────────────────────────────────────────────────────
  function _updateWLCount() {
    const el = document.getElementById("wl-count-badge");
    if (el) el.textContent = Watchlist.count();
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function _jsonAttr(obj) {
    return _esc(JSON.stringify(obj));
  }
  function _starsHTML(rating) {
    const full = Math.round(rating/2);
    return Array.from({length:5},(_,i)=>`<span class="star${i<full?"":" empty"}">★</span>`).join("");
  }

  return {
    init,
    goHero,
    openItem,
    openBrowse,
    toggleWL,
    showPage,
    onSearchInput,
    _renderHistoryRows,
    prevHero,
    nextHero,
  };
})();

// Boot when DOM is ready
document.addEventListener("DOMContentLoaded", () => App.init());
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(reg => console.log("✅ Service Worker Registered", reg))
      .catch(err => console.error("❌ Service Worker Error:", err));
  });
}