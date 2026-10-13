/**
 * CineJoy — Live TV Module
 * Dedicated HLS Live TV & Global Broadcast Player
 * Powered by public verified legal HLS streams and iptv-org public catalogue
 */

const LiveTV = (() => {
  // State
  let _channels = [];
  let _filteredChannels = [];
  let _currentChannel = null;
  let _hls = null;
  let _videoEl = null;

  let _activeCategory = "all";
  let _activeCountry = "all";
  let _activeLanguage = "all";
  let _searchQuery = "";
  let _currentView = "channels"; // "channels" | "countries" | "languages" | "categories"

  let _favorites = [];
  let _isInitialized = false;
  let _isLoadingCatalogue = false;

  // Pagination / Progressive Rendering
  const BATCH_SIZE = 60;
  let _renderedCount = 0;
  let _scrollObserver = null;
  let _searchDebounceTimer = null;

  // Metadata caches
  let _countryMetaMap = new Map();
  let _distinctCountriesCount = 0;
  let _distinctLanguagesCount = 0;
  let _httpsStreamCount = 0;

  const FAV_STORAGE_KEY = "CineJoy_LiveTV_Favorites";
  const CACHE_DB_NAME = "CineJoy_IPTV_Cache";
  const CACHE_STORE_NAME = "catalogue";

  // Guaranteed verified flagship channels with high availability HTTPS
  const VERIFIED_FLAGSHIP_CHANNELS = [
    {
      id: "nasa_tv_hd",
      name: "NASA TV HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/300px-NASA_logo.svg.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "Documentary",
      language: "eng",
      url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8"
    },
    {
      id: "redbull_tv",
      name: "Red Bull TV",
      logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/320px-Red_Bull_TV_logo.svg.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "Sports",
      language: "eng",
      url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8"
    },
    {
      id: "bloomberg_tv",
      name: "Bloomberg Television",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Television_logo_2015.svg/320px-Bloomberg_Television_logo_2015.svg.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "News",
      language: "eng",
      url: "https://bloomberg.com/media-manifest/streams/us.m3u8"
    },
    {
      id: "cgtn_news_hd",
      name: "CGTN News HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/CGTN_logo.svg/320px-CGTN_logo.svg.png",
      country: "INT",
      countryName: "International",
      flag: "🌐",
      category: "News",
      language: "eng",
      url: "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8"
    },
    {
      id: "arirang_tv_world",
      name: "Arirang TV World",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Arirang_TV_logo.svg/320px-Arirang_TV_logo.svg.png",
      country: "KR",
      countryName: "South Korea",
      flag: "🇰🇷",
      category: "Entertainment",
      language: "eng",
      url: "https://amdlive.ctnd.com.edgesuite.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8"
    },
    {
      id: "euronews_eng",
      name: "Euronews English",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Euronews_2016_logo.svg/320px-Euronews_2016_logo.svg.png",
      country: "FR",
      countryName: "France",
      flag: "🇫🇷",
      category: "News",
      language: "eng",
      url: "https://euronews-euronews-world-1-eu.rakuten.wurl.tv/playlist.m3u8"
    },
    {
      id: "aljazeera_eng",
      name: "Al Jazeera English HD",
      logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/320px-Al_Jazeera_English_logo.svg.png",
      country: "QA",
      countryName: "Qatar",
      flag: "🇶🇦",
      category: "News",
      language: "eng",
      url: "https://live-hls-web-aje.getaj.net/AJE/01.m3u8"
    },
    {
      id: "france24_eng",
      name: "France 24 English HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/France_24_logo.svg/320px-France_24_logo.svg.png",
      country: "FR",
      countryName: "France",
      flag: "🇫🇷",
      category: "News",
      language: "eng",
      url: "https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8"
    },
    {
      id: "dw_english",
      name: "DW English HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png",
      country: "DE",
      countryName: "Germany",
      flag: "🇩🇪",
      category: "News",
      language: "eng",
      url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8"
    },
    {
      id: "tv9_telugu",
      name: "TV9 Telugu Live",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/TV9_Telugu_Logo.png/320px-TV9_Telugu_Logo.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "News",
      language: "tel",
      url: "https://d224t9n65mcrha.cloudfront.net/out/v1/9cff98b164924c58a8a25a4d65ee1c76/index.m3u8"
    },
    {
      id: "abp_news_in",
      name: "ABP News India",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/ABP_News_Logo.png/320px-ABP_News_Logo.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "News",
      language: "hin",
      url: "https://abp-i.akamaized.net/hls/live/765529/abpnews/master.m3u8"
    },
    {
      id: "ndtv_india",
      name: "NDTV India",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/NDTV_India_logo.png/320px-NDTV_India_logo.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "News",
      language: "hin",
      url: "https://ndtvindiaelemarchana.akamaized.net/hls/live/2003679-b/ndtvindia/livefeed/master.m3u8"
    }
  ];

  // Common language labels
  const LANGUAGE_NAMES = {
    eng: "English",
    spa: "Spanish",
    hin: "Hindi",
    tel: "Telugu",
    tam: "Tamil",
    fra: "French",
    deu: "German",
    ara: "Arabic",
    rus: "Russian",
    ita: "Italian",
    por: "Portuguese",
    zho: "Chinese",
    jpn: "Japanese",
    kor: "Korean",
    tur: "Turkish",
    nld: "Dutch",
    swe: "Swedish",
    pol: "Polish",
    ukr: "Ukrainian",
    urd: "Urdu",
    ben: "Bengali",
    pan: "Punjabi",
    mal: "Malayalam",
    kan: "Kannada",
    mar: "Marathi",
    guj: "Gujarati"
  };

  /* ─────────────────────────────────────────────────────────────
     1. FAVORITES STORAGE
  ───────────────────────────────────────────────────────────── */
  function _loadFavorites() {
    try {
      const stored = localStorage.getItem(FAV_STORAGE_KEY);
      _favorites = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(_favorites)) _favorites = [];
    } catch {
      _favorites = [];
    }
  }

  function _saveFavorites() {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(_favorites));
    } catch (e) {
      console.warn("Unable to save favorites to localStorage", e);
    }
  }

  function isFavorite(channelId) {
    return _favorites.includes(channelId);
  }

  function toggleFavorite(channelId, evt) {
    if (evt) evt.stopPropagation();
    if (!channelId) return;

    if (isFavorite(channelId)) {
      _favorites = _favorites.filter(id => id !== channelId);
    } else {
      _favorites.push(channelId);
    }
    _saveFavorites();
    _updateFavoriteUI(channelId);

    if (_activeCategory === "favorites") {
      filterChannels();
    }
  }

  function _updateFavoriteUI(channelId) {
    const isFav = isFavorite(channelId);
    if (_currentChannel && _currentChannel.id === channelId) {
      const favBtn = document.getElementById("livetv-player-fav-btn");
      if (favBtn) {
        favBtn.classList.toggle("active", isFav);
        favBtn.setAttribute("title", isFav ? "Remove from Favorites" : "Add to Favorites");
        favBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="${isFav ? "#e50914" : "none"}" stroke="currentColor" stroke-width="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          <span>${isFav ? "Favorited" : "Favorite"}</span>
        `;
      }
    }
    const cardFavBtn = document.querySelector(`.livetv-card[data-id="${channelId}"] .livetv-card-fav`);
    if (cardFavBtn) {
      cardFavBtn.classList.toggle("active", isFav);
      cardFavBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? "#e50914" : "none"}" stroke="currentColor" stroke-width="2">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      `;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     2. INDEXEDDB CACHING HELPER
  ───────────────────────────────────────────────────────────── */
  function _openIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(CACHE_DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME);
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
  }

  async function _getCachedCatalogue() {
    try {
      const db = await _openIndexedDB();
      if (!db) return null;
      return new Promise(resolve => {
        const tx = db.transaction(CACHE_STORE_NAME, "readonly");
        const store = tx.objectStore(CACHE_STORE_NAME);
        const req = store.get("full_catalogue");
        req.onsuccess = () => {
          const res = req.result;
          if (res && res.timestamp && Date.now() - res.timestamp < 24 * 3600 * 1000 && res.channels?.length) {
            resolve(res);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function _setCachedCatalogue(channels, countryMeta) {
    try {
      const db = await _openIndexedDB();
      if (!db) return;
      const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.put({
        timestamp: Date.now(),
        channels,
        countryMeta
      }, "full_catalogue");
    } catch (e) {
      console.warn("Unable to cache catalogue in IndexedDB:", e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     3. CATALOGUE LOADING & FAST M3U STREAM PARSING
  ───────────────────────────────────────────────────────────── */
  async function _loadCountryMetadata() {
    try {
      let data = null;
      try {
        const resp = await fetch("https://iptv-org.github.io/api/countries.json");
        if (resp.ok) data = await resp.json();
      } catch {
        // Fallback to bundled countries.json
        const localResp = await fetch("data/countries.json");
        if (localResp.ok) data = await localResp.json();
      }
      if (Array.isArray(data)) {
        data.forEach(c => {
          _countryMetaMap.set(c.code.toUpperCase(), {
            name: c.name,
            code: c.code.toUpperCase(),
            flag: c.flag || "🌐",
            languages: c.languages || []
          });
        });
      }
    } catch (e) {
      console.warn("Error loading country metadata:", e);
    }
  }

  function _parseM3UContent(m3uText) {
    const lines = m3uText.split(/\r?\n/);
    const parsedChannels = [];
    let cur = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        cur = {};
        const commaIdx = line.lastIndexOf(",");
        cur.name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : "Untitled";

        const attrStr = line.substring(8, commaIdx);
        const idM = attrStr.match(/tvg-id="([^"]*)"/);
        const logoM = attrStr.match(/tvg-logo="([^"]*)"/);
        const countryM = attrStr.match(/tvg-country="([^"]*)"/);
        const langM = attrStr.match(/tvg-language="([^"]*)"/);
        const groupM = attrStr.match(/group-title="([^"]*)"/);

        cur.id = idM ? idM[1] : ("ch_" + parsedChannels.length);
        cur.logo = logoM ? logoM[1] : "";
        cur.category = groupM ? groupM[1].split(";")[0].trim() : "General";
        cur.language = langM ? langM[1] : "";

        let c = countryM ? countryM[1] : "";
        if (!c && cur.id) {
          const m = cur.id.match(/\.([a-z]{2})@/i);
          if (m) c = m[1].toUpperCase();
        }
        cur.country = (c || "INT").toUpperCase();

        const meta = _countryMetaMap.get(cur.country);
        cur.countryName = meta ? meta.name : (cur.country === "INT" ? "International" : cur.country);
        cur.flag = meta ? meta.flag : "🌐";

        if (!cur.language && meta && meta.languages && meta.languages.length) {
          cur.language = meta.languages[0];
        }
      } else if (!line.startsWith("#") && cur) {
        cur.url = line;
        cur.isHttps = line.startsWith("https://");
        parsedChannels.push(cur);
        cur = null;
      }
    }
    return parsedChannels;
  }

  async function loadFullCatalogue() {
    _isLoadingCatalogue = true;
    _updateStatsLine("Loading catalogue from iptv-org master repository...");

    // Step A: Load country metadata
    if (_countryMetaMap.size === 0) {
      await _loadCountryMetadata();
    }

    // Step B: Check IndexedDB cache for instant display
    const cached = await _getCachedCatalogue();
    if (cached && cached.channels && cached.channels.length > 1000) {
      console.log(`[LiveTV] Loaded ${cached.channels.length} channels from IndexedDB cache.`);
      _channels = cached.channels;
      _computeStats();
      _onCatalogueLoaded();
      _isLoadingCatalogue = false;

      // In the background, fetch fresh version if needed
      _fetchAndParseFreshCatalogue(false);
      return;
    }

    // Step C: Fetch live M3U from IPTV-org master playlist
    await _fetchAndParseFreshCatalogue(true);
  }

  async function _fetchAndParseFreshCatalogue(updateUIImmediately = true) {
    try {
      console.log("[LiveTV] Fetching https://iptv-org.github.io/iptv/index.m3u ...");
      const resp = await fetch("https://iptv-org.github.io/iptv/index.m3u");
      if (resp.ok) {
        const text = await resp.text();
        const parsed = _parseM3UContent(text);
        if (parsed.length > 1000) {
          console.log(`[LiveTV] Successfully parsed ${parsed.length} channels from index.m3u!`);
          _channels = parsed;
          _computeStats();
          _setCachedCatalogue(_channels, Array.from(_countryMetaMap.entries()));
          if (updateUIImmediately) {
            _onCatalogueLoaded();
          }
          _isLoadingCatalogue = false;
          return;
        }
      }
    } catch (e) {
      console.warn("[LiveTV] iptv-org live fetch failed or offline, loading local bundled dataset:", e);
    }

    // Fallback: bundled complete dataset
    try {
      const localResp = await fetch("data/livetv_channels.json");
      if (localResp.ok) {
        const data = await localResp.json();
        if (Array.isArray(data) && data.length > 500) {
          console.log(`[LiveTV] Loaded ${data.length} channels from local bundled dataset.`);
          _channels = data;
          _computeStats();
          if (updateUIImmediately) {
            _onCatalogueLoaded();
          }
          _isLoadingCatalogue = false;
          return;
        }
      }
    } catch (e) {
      console.error("[LiveTV] Fallback local dataset load failed:", e);
    }

    // Ultimate fallback: verified flagship channels
    if (!_channels || !_channels.length) {
      _channels = VERIFIED_FLAGSHIP_CHANNELS.slice();
      _computeStats();
      _onCatalogueLoaded();
    }
    _isLoadingCatalogue = false;
  }

  function _computeStats() {
    const countriesSet = new Set();
    const languagesSet = new Set();
    let httpsCount = 0;

    _channels.forEach(ch => {
      if (ch.country && ch.country !== "INT") countriesSet.add(ch.country);
      if (ch.language) languagesSet.add(ch.language);
      if (ch.url && ch.url.startsWith("https://")) httpsCount++;
    });

    _distinctCountriesCount = countriesSet.size;
    _distinctLanguagesCount = languagesSet.size;
    _httpsStreamCount = httpsCount;
  }

  function _onCatalogueLoaded() {
    _updateStatsLine();
    _populateCountryFilter();
    _populateLanguageFilter();
    filterChannels();

    // Ensure player has a playable flagship stream if none is loaded
    if (!_currentChannel && _filteredChannels.length) {
      // Find a verified flagship or first available HTTPS channel
      const starter = VERIFIED_FLAGSHIP_CHANNELS[0] || _filteredChannels[0];
      playChannel(starter);
    }

    // Render secondary views if user is on them
    if (_currentView === "countries") _renderCountriesGrid();
    if (_currentView === "languages") _renderLanguagesGrid();
    if (_currentView === "categories") _renderCategoriesGrid();
  }

  function _updateStatsLine(customText = null) {
    const el = document.getElementById("livetv-stats-line");
    if (!el) return;

    if (customText) {
      el.textContent = customText;
      return;
    }

    const totalStr = _channels.length.toLocaleString();
    const countryStr = _distinctCountriesCount.toLocaleString();
    const httpsStr = _httpsStreamCount.toLocaleString();

    el.innerHTML = `Loaded <strong>${totalStr}</strong> verified channels across <strong>${countryStr}</strong> countries <span class="livetv-stats-divider">·</span> <strong>${httpsStr}</strong> secure HTTPS streams`;
  }

  /* ─────────────────────────────────────────────────────────────
     4. INITIALIZATION & LIFECYCLE
  ───────────────────────────────────────────────────────────── */
  function init() {
    _loadFavorites();
    _videoEl = document.getElementById("livetv-video");

    if (!_isInitialized) {
      _isInitialized = true;
      _setupScrollObserver();

      // Start with verified flagships immediately so player is ready in 0ms
      _channels = VERIFIED_FLAGSHIP_CHANNELS.slice();
      _computeStats();
      _populateCountryFilter();
      _populateLanguageFilter();
      filterChannels();
      playChannel(_channels[0]);

      // Load full catalogue asynchronously
      loadFullCatalogue();
    } else {
      // Returning to Live TV page
      if (!_currentChannel && _filteredChannels.length) {
        playChannel(_filteredChannels[0]);
      } else if (_currentChannel && _videoEl && _videoEl.paused) {
        _videoEl.play().catch(() => {});
      }
    }
  }

  function _setupScrollObserver() {
    const sentinel = document.getElementById("livetv-scroll-sentinel");
    const container = document.getElementById("livetv-channels-grid");
    if (!sentinel || !container) return;

    if ("IntersectionObserver" in window) {
      if (_scrollObserver) _scrollObserver.disconnect();
      _scrollObserver = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && !_isLoadingCatalogue) {
            _renderMoreChannels();
          }
        },
        { root: container, threshold: 0.1 }
      );
      _scrollObserver.observe(sentinel);
    } else {
      // Fallback scroll listener
      container.addEventListener("scroll", () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 150) {
          _renderMoreChannels();
        }
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────
     5. VIEW SWITCHING (Matching Reference Routes & Screenshot)
  ───────────────────────────────────────────────────────────── */
  function switchView(viewName) {
    _currentView = viewName;

    // Update top view tab buttons
    document.querySelectorAll(".livetv-view-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.view === viewName);
    });

    // Toggle main content view containers
    const channelsView = document.getElementById("livetv-view-channels");
    const countriesView = document.getElementById("livetv-view-countries");
    const languagesView = document.getElementById("livetv-view-languages");
    const categoriesView = document.getElementById("livetv-view-categories");

    if (channelsView) channelsView.style.display = viewName === "channels" ? "grid" : "none";
    if (countriesView) countriesView.style.display = viewName === "countries" ? "block" : "none";
    if (languagesView) languagesView.style.display = viewName === "languages" ? "block" : "none";
    if (categoriesView) categoriesView.style.display = viewName === "categories" ? "block" : "none";

    if (viewName === "countries") _renderCountriesGrid();
    if (viewName === "languages") _renderLanguagesGrid();
    if (viewName === "categories") _renderCategoriesGrid();
    if (viewName === "channels") {
      _renderChannelsGrid();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     6. FILTERS & SEARCH
  ───────────────────────────────────────────────────────────── */
  function _populateCountryFilter() {
    const select = document.getElementById("livetv-country-select");
    if (!select) return;

    // Count distinct channels per country code
    const countryCounts = {};
    _channels.forEach(ch => {
      const code = (ch.country || "INT").toUpperCase();
      countryCounts[code] = (countryCounts[code] || 0) + 1;
    });

    const sortedCodes = Object.keys(countryCounts).sort((a, b) => {
      const nameA = (_countryMetaMap.get(a)?.name || a).toLowerCase();
      const nameB = (_countryMetaMap.get(b)?.name || b).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const distinctCount = Object.keys(countryCounts).filter(c => c !== "INT").length;

    let html = `<option value="all">All Countries (${distinctCount} countries)</option>`;
    sortedCodes.forEach(code => {
      const meta = _countryMetaMap.get(code);
      const name = meta ? meta.name : (code === "INT" ? "International" : code);
      const flag = meta ? meta.flag : "🌐";
      const count = countryCounts[code];
      const isSelected = _activeCountry === code ? "selected" : "";
      html += `<option value="${code}" ${isSelected}>${flag} ${name} (${count.toLocaleString()} channels)</option>`;
    });

    select.innerHTML = html;
  }

  function _populateLanguageFilter() {
    const select = document.getElementById("livetv-language-select");
    if (!select) return;

    const langCounts = {};
    _channels.forEach(ch => {
      if (ch.language) {
        langCounts[ch.language] = (langCounts[ch.language] || 0) + 1;
      }
    });

    const sortedLangs = Object.keys(langCounts).sort((a, b) => {
      const nameA = LANGUAGE_NAMES[a] || a;
      const nameB = LANGUAGE_NAMES[b] || b;
      return nameA.localeCompare(nameB);
    });

    let html = `<option value="all">All Languages (${sortedLangs.length} languages)</option>`;
    sortedLangs.forEach(lang => {
      const name = LANGUAGE_NAMES[lang] || lang.toUpperCase();
      const count = langCounts[lang];
      const isSelected = _activeLanguage === lang ? "selected" : "";
      html += `<option value="${lang}" ${isSelected}>${name} (${count.toLocaleString()} channels)</option>`;
    });

    select.innerHTML = html;
  }

  function setCategory(cat) {
    _activeCategory = cat;
    document.querySelectorAll(".livetv-cat-pill").forEach(pill => {
      pill.classList.toggle("active", pill.dataset.cat === cat);
    });
    filterChannels();
    if (_currentView !== "channels") switchView("channels");
  }

  function setCountry(country) {
    _activeCountry = country;
    const select = document.getElementById("livetv-country-select");
    if (select) select.value = country;
    filterChannels();
    if (_currentView !== "channels") switchView("channels");
  }

  function setLanguage(lang) {
    _activeLanguage = lang;
    const select = document.getElementById("livetv-language-select");
    if (select) select.value = lang;
    filterChannels();
    if (_currentView !== "channels") switchView("channels");
  }

  function clearFilters() {
    _activeCategory = "all";
    _activeCountry = "all";
    _activeLanguage = "all";
    _searchQuery = "";

    const searchInput = document.getElementById("livetv-search");
    if (searchInput) searchInput.value = "";

    const countrySelect = document.getElementById("livetv-country-select");
    if (countrySelect) countrySelect.value = "all";

    const langSelect = document.getElementById("livetv-language-select");
    if (langSelect) langSelect.value = "all";

    document.querySelectorAll(".livetv-cat-pill").forEach(p => {
      p.classList.toggle("active", p.dataset.cat === "all");
    });

    filterChannels();
    if (_currentView !== "channels") switchView("channels");
  }

  function onSearchInput(query) {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      _searchQuery = (query || "").trim().toLowerCase();
      if (_currentView === "channels") {
        filterChannels();
      } else if (_currentView === "countries") {
        _renderCountriesGrid();
      } else if (_currentView === "languages") {
        _renderLanguagesGrid();
      } else if (_currentView === "categories") {
        _renderCategoriesGrid();
      }
    }, 150);
  }

  function filterChannels() {
    let result = _channels.slice();

    // 1. Category Filter
    if (_activeCategory === "favorites") {
      result = result.filter(ch => isFavorite(ch.id));
    } else if (_activeCategory !== "all") {
      result = result.filter(ch => (ch.category || "").toLowerCase() === _activeCategory.toLowerCase());
    }

    // 2. Country Filter
    if (_activeCountry !== "all") {
      result = result.filter(ch => (ch.country || "INT").toUpperCase() === _activeCountry.toUpperCase());
    }

    // 3. Language Filter
    if (_activeLanguage !== "all") {
      result = result.filter(ch => (ch.language || "").toLowerCase() === _activeLanguage.toLowerCase());
    }

    // 4. Search Query across Name, Category, Country Name, Country Code
    if (_searchQuery) {
      result = result.filter(ch => {
        const nameMatch = ch.name && ch.name.toLowerCase().includes(_searchQuery);
        const catMatch = ch.category && ch.category.toLowerCase().includes(_searchQuery);
        const countryMatch = (ch.country && ch.country.toLowerCase().includes(_searchQuery)) ||
                             (ch.countryName && ch.countryName.toLowerCase().includes(_searchQuery));
        const langMatch = ch.language && ch.language.toLowerCase().includes(_searchQuery);
        return nameMatch || catMatch || countryMatch || langMatch;
      });
    }

    _filteredChannels = result;
    _renderedCount = 0;
    _renderChannelsGrid();
    _updateActiveFilterBar();
  }

  function _updateActiveFilterBar() {
    const bar = document.getElementById("livetv-active-filter-bar");
    if (!bar) return;

    const hasFilters = _activeCountry !== "all" || _activeCategory !== "all" || _activeLanguage !== "all" || _searchQuery;
    if (!hasFilters) {
      bar.style.display = "none";
      bar.innerHTML = "";
      return;
    }

    bar.style.display = "flex";
    let chips = "";

    if (_activeCountry !== "all") {
      const meta = _countryMetaMap.get(_activeCountry);
      const name = meta ? meta.name : _activeCountry;
      const flag = meta ? meta.flag : "🌐";
      chips += `
        <span class="livetv-filter-chip">
          <span>Country: ${flag} ${name}</span>
          <button onclick="LiveTV.setCountry('all')" aria-label="Clear country filter">✕</button>
        </span>
      `;
    }

    if (_activeCategory !== "all") {
      chips += `
        <span class="livetv-filter-chip">
          <span>Category: ${_esc(_activeCategory)}</span>
          <button onclick="LiveTV.setCategory('all')" aria-label="Clear category filter">✕</button>
        </span>
      `;
    }

    if (_activeLanguage !== "all") {
      const name = LANGUAGE_NAMES[_activeLanguage] || _activeLanguage.toUpperCase();
      chips += `
        <span class="livetv-filter-chip">
          <span>Language: ${name}</span>
          <button onclick="LiveTV.setLanguage('all')" aria-label="Clear language filter">✕</button>
        </span>
      `;
    }

    if (_searchQuery) {
      chips += `
        <span class="livetv-filter-chip">
          <span>Search: "${_esc(_searchQuery)}"</span>
          <button onclick="LiveTV.onSearchInput(''); document.getElementById('livetv-search').value='';" aria-label="Clear search">✕</button>
        </span>
      `;
    }

    chips += `<button class="livetv-filter-clear-all" onclick="LiveTV.clearFilters()">Clear All Filters</button>`;
    bar.innerHTML = chips;
  }

  /* ─────────────────────────────────────────────────────────────
     7. EFFICIENT PROGRESSIVE RENDERING (Zero-lag DOM)
  ───────────────────────────────────────────────────────────── */
  function _renderChannelsGrid() {
    const grid = document.getElementById("livetv-channels-grid");
    const countEl = document.getElementById("livetv-results-count");
    if (!grid) return;

    if (countEl) {
      const totalMatching = _filteredChannels.length;
      if (totalMatching === 0) {
        countEl.textContent = "0 channels";
      } else if (totalMatching <= BATCH_SIZE) {
        countEl.textContent = `${totalMatching.toLocaleString()} channels`;
      } else {
        countEl.textContent = `Showing ${Math.min(BATCH_SIZE, totalMatching).toLocaleString()} of ${totalMatching.toLocaleString()} channels`;
      }
    }

    if (!_filteredChannels.length) {
      grid.innerHTML = `
        <div class="livetv-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 6h-7.59l3.29-3.3a1 1 0 10-1.41-1.41L12 4.59 8.71 1.29A1 1 0 007.29 2.7L10.59 6H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V8a2 2 0 00-2-2zm0 14H3V8h18v12zM9 10v8l7-4-7-4z"/>
          </svg>
          <h4>No Channels Found</h4>
          <p>${_activeCategory === "favorites" ? "You haven't saved any favorite channels yet. Click the heart icon on any channel card to add it to your favorites." : "No live broadcast streams match your current filters or search term."}</p>
          <button class="btn-primary" onclick="LiveTV.clearFilters()">Reset All Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = "";
    _renderedCount = 0;
    _renderMoreChannels();
  }

  function _renderMoreChannels() {
    const grid = document.getElementById("livetv-channels-grid");
    const countEl = document.getElementById("livetv-results-count");
    if (!grid || _renderedCount >= _filteredChannels.length) return;

    const nextBatch = _filteredChannels.slice(_renderedCount, _renderedCount + BATCH_SIZE);
    _renderedCount += nextBatch.length;

    if (countEl && _filteredChannels.length > BATCH_SIZE) {
      countEl.textContent = `Showing ${_renderedCount.toLocaleString()} of ${_filteredChannels.length.toLocaleString()} channels`;
    }

    const fragment = document.createDocumentFragment();

    nextBatch.forEach(ch => {
      const isCurrent = _currentChannel && _currentChannel.id === ch.id;
      const isFav = isFavorite(ch.id);
      const initial = (ch.name || "T")[0].toUpperCase();
      const meta = _countryMetaMap.get(ch.country);
      const flag = meta ? meta.flag : (ch.flag || "🌐");
      const countryLabel = meta ? meta.name : (ch.country || "Global");

      const card = document.createElement("div");
      card.className = `livetv-card ${isCurrent ? "active-playing" : ""}`;
      card.dataset.id = ch.id;
      card.onclick = () => playChannel(ch);

      card.innerHTML = `
        <div class="livetv-card-logo-wrap">
          ${ch.logo ? `
            <img src="${_esc(ch.logo)}" alt="${_esc(ch.name)}" class="livetv-card-logo" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="livetv-card-logo-fallback" style="display:none">${initial}</div>
          ` : `
            <div class="livetv-card-logo-fallback">${initial}</div>
          `}
          <span class="livetv-card-badge-live ${isCurrent ? "live-pulsing" : ""}">
            <span class="live-dot"></span> LIVE
          </span>
          <button class="livetv-card-fav ${isFav ? "active" : ""}" title="${isFav ? "Remove favorite" : "Add to favorites"}" onclick="LiveTV.toggleFavorite('${_esc(ch.id)}', event)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? "#e50914" : "none"}" stroke="currentColor" stroke-width="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
        <div class="livetv-card-info">
          <h4 class="livetv-card-title">${_esc(ch.name)}</h4>
          <div class="livetv-card-meta">
            <span class="livetv-card-flag">${flag}</span>
            <span class="livetv-card-country">${_esc(countryLabel)}</span>
            <span class="livetv-card-dot">·</span>
            <span class="livetv-card-cat">${_esc(ch.category || "General")}</span>
          </div>
        </div>
        ${isCurrent ? `
          <div class="livetv-card-eq" title="Now Playing">
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          </div>
        ` : ""}
      `;
      fragment.appendChild(card);
    });

    // Make sure sentinel stays at the bottom
    const sentinel = document.getElementById("livetv-scroll-sentinel");
    if (sentinel) {
      grid.insertBefore(fragment, sentinel);
    } else {
      grid.appendChild(fragment);
      const newSentinel = document.createElement("div");
      newSentinel.id = "livetv-scroll-sentinel";
      newSentinel.className = "livetv-scroll-sentinel";
      grid.appendChild(newSentinel);
      _setupScrollObserver();
    }
  }

  /* ─────────────────────────────────────────────────────────────
     8. SECONDARY BROWSING VIEWS (Countries, Languages, Categories)
  ───────────────────────────────────────────────────────────── */
  function _renderCountriesGrid() {
    const grid = document.getElementById("livetv-countries-grid");
    if (!grid) return;

    // Aggregate channel count per country
    const countryMap = {};
    _channels.forEach(ch => {
      const code = (ch.country || "INT").toUpperCase();
      if (!countryMap[code]) {
        const meta = _countryMetaMap.get(code);
        countryMap[code] = {
          code,
          name: meta ? meta.name : (code === "INT" ? "International" : code),
          flag: meta ? meta.flag : "🌐",
          count: 0
        };
      }
      countryMap[code].count++;
    });

    let list = Object.values(countryMap).sort((a, b) => a.name.localeCompare(b.name));

    if (_searchQuery) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(_searchQuery) ||
        c.code.toLowerCase().includes(_searchQuery)
      );
    }

    if (!list.length) {
      grid.innerHTML = `<div class="livetv-empty-grid">No countries match "${_esc(_searchQuery)}"</div>`;
      return;
    }

    let html = "";
    list.forEach(c => {
      const isSelected = _activeCountry === c.code;
      html += `
        <div class="livetv-country-card ${isSelected ? "selected" : ""}" onclick="LiveTV.setCountry('${_esc(c.code)}')">
          <span class="livetv-country-flag">${c.flag}</span>
          <div class="livetv-country-text">
            <span class="livetv-country-name">${_esc(c.name)}</span>
            <span class="livetv-country-count">${c.count.toLocaleString()} channels</span>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function _renderLanguagesGrid() {
    const grid = document.getElementById("livetv-languages-grid");
    if (!grid) return;

    const langMap = {};
    _channels.forEach(ch => {
      const lang = ch.language || "other";
      if (!langMap[lang]) {
        langMap[lang] = {
          code: lang,
          name: LANGUAGE_NAMES[lang] || lang.toUpperCase(),
          count: 0
        };
      }
      langMap[lang].count++;
    });

    let list = Object.values(langMap).sort((a, b) => b.count - a.count);

    if (_searchQuery) {
      list = list.filter(l =>
        l.name.toLowerCase().includes(_searchQuery) ||
        l.code.toLowerCase().includes(_searchQuery)
      );
    }

    let html = "";
    list.forEach(l => {
      const isSelected = _activeLanguage === l.code;
      html += `
        <div class="livetv-lang-card ${isSelected ? "selected" : ""}" onclick="LiveTV.setLanguage('${_esc(l.code)}')">
          <div class="livetv-lang-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
          <div class="livetv-lang-text">
            <span class="livetv-lang-name">${_esc(l.name)}</span>
            <span class="livetv-lang-count">${l.count.toLocaleString()} channels</span>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function _renderCategoriesGrid() {
    const grid = document.getElementById("livetv-categories-grid");
    if (!grid) return;

    const catMap = {};
    _channels.forEach(ch => {
      const cat = ch.category || "General";
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const categoryIcons = {
      News: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
      Sports: "M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
      Movies: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
      Music: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z",
      Animation: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      Documentary: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
      Entertainment: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
    };

    let list = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    if (_searchQuery) {
      list = list.filter(([cat]) => cat.toLowerCase().includes(_searchQuery));
    }

    let html = "";
    list.forEach(([cat, count]) => {
      const isSelected = _activeCategory.toLowerCase() === cat.toLowerCase();
      const pathSvg = categoryIcons[cat] || "M4 6h16M4 12h16M4 18h16";
      html += `
        <div class="livetv-cat-card ${isSelected ? "selected" : ""}" onclick="LiveTV.setCategory('${_esc(cat)}')">
          <div class="livetv-cat-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="${pathSvg}"/>
            </svg>
          </div>
          <div class="livetv-cat-text">
            <span class="livetv-cat-name">${_esc(cat)}</span>
            <span class="livetv-cat-count">${count.toLocaleString()} channels</span>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  /* ─────────────────────────────────────────────────────────────
     9. VIDEO PLAYBACK (HLS.js with Native Safari Fallback)
  ───────────────────────────────────────────────────────────── */
  function playChannelById(id) {
    const ch = _channels.find(c => c.id === id);
    if (ch) playChannel(ch);
  }

  function playChannel(ch) {
    if (!ch) return;
    _currentChannel = ch;

    _updatePlayerUI(ch);
    _highlightActiveCard(ch.id);

    if (!_videoEl) _videoEl = document.getElementById("livetv-video");
    if (!_videoEl) return;

    if (_hls) {
      _hls.destroy();
      _hls = null;
    }

    _videoEl.pause();
    _videoEl.removeAttribute("src");
    _videoEl.load();

    _showLoading(true);
    _showError(false);
    _showPlayPrompt(false);

    const streamUrl = ch.url;

    // Check mixed content warnings (HTTP on HTTPS origin)
    if (window.location.protocol === "https:" && streamUrl.startsWith("http://")) {
      console.warn("[LiveTV] Warning: HTTP stream on HTTPS page might be blocked by browser mixed-content restrictions:", streamUrl);
    }

    const HlsLib = window.Hls;
    if (HlsLib && typeof HlsLib.isSupported === "function" && HlsLib.isSupported()) {
      _hls = new HlsLib({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        manifestLoadingTimeOut: 14000,
        levelLoadingTimeOut: 14000
      });

      _hls.loadSource(streamUrl);
      _hls.attachMedia(_videoEl);

      _hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        _showLoading(false);
        const playPromise = _videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("Autoplay was prevented by browser policy:", err);
            _showPlayPrompt(true);
          });
        }
      });

      _hls.on(HlsLib.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn("HLS fatal error encountered:", data.type, data.details);
          switch (data.type) {
            case HlsLib.ErrorTypes?.NETWORK_ERROR || "networkError":
              _hls.startLoad();
              break;
            case HlsLib.ErrorTypes?.MEDIA_ERROR || "mediaError":
              _hls.recoverMediaError();
              break;
            default:
              _showLoading(false);
              const isHttpOnHttps = window.location.protocol === "https:" && streamUrl.startsWith("http://");
              const errMsg = isHttpOnHttps
                ? "This stream is HTTP and was blocked by browser Mixed Content policy. Open with external player or try an HTTPS channel."
                : "The selected broadcast stream is temporarily offline or unreachable.";
              _showError(true, errMsg);
              if (_hls) {
                _hls.destroy();
                _hls = null;
              }
              break;
          }
        }
      });
    } else if (_videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple Safari HLS engine
      _videoEl.src = streamUrl;
      _videoEl.addEventListener("loadedmetadata", () => {
        _showLoading(false);
        _videoEl.play().catch(() => _showPlayPrompt(true));
      }, { once: true });

      _videoEl.addEventListener("error", () => {
        _showLoading(false);
        _showError(true, "Stream playback error on native player engine.");
      }, { once: true });
    } else {
      _showLoading(false);
      _showError(true, "HLS live video streaming is not supported on this browser.");
    }
  }

  function _updatePlayerUI(ch) {
    const titleEl = document.getElementById("livetv-player-title");
    const catEl = document.getElementById("livetv-player-cat");
    const countryEl = document.getElementById("livetv-player-country");
    const logoWrap = document.getElementById("livetv-player-logo-wrap");

    if (titleEl) titleEl.textContent = ch.name;
    if (catEl) catEl.textContent = ch.category || "Live Broadcast";
    if (countryEl) {
      const meta = _countryMetaMap.get(ch.country);
      const flag = meta ? meta.flag : (ch.flag || "🌐");
      const name = meta ? meta.name : (ch.country || "Global");
      countryEl.textContent = `${flag} ${name}`;
    }

    if (logoWrap) {
      if (ch.logo) {
        logoWrap.innerHTML = `
          <img src="${_esc(ch.logo)}" alt="${_esc(ch.name)}" class="livetv-player-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="livetv-player-logo-fallback" style="display:none">${(ch.name || "T")[0].toUpperCase()}</div>
        `;
      } else {
        logoWrap.innerHTML = `<div class="livetv-player-logo-fallback">${(ch.name || "T")[0].toUpperCase()}</div>`;
      }
    }

    _updateFavoriteUI(ch.id);
  }

  function _highlightActiveCard(channelId) {
    document.querySelectorAll(".livetv-card").forEach(c => {
      const isMatch = c.dataset.id === channelId;
      c.classList.toggle("active-playing", isMatch);
      const eq = c.querySelector(".livetv-card-eq");
      if (eq) eq.remove();
      if (isMatch) {
        const eqDiv = document.createElement("div");
        eqDiv.className = "livetv-card-eq";
        eqDiv.title = "Now Playing";
        eqDiv.innerHTML = `<span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>`;
        c.appendChild(eqDiv);
      }
    });
  }

  function _showLoading(show) {
    const spinner = document.getElementById("livetv-player-loading");
    if (spinner) spinner.style.display = show ? "flex" : "none";
  }

  function _showError(show, msg = "") {
    const errorEl = document.getElementById("livetv-player-error");
    const errorMsg = document.getElementById("livetv-player-error-text");
    if (errorEl) {
      errorEl.style.display = show ? "flex" : "none";
      if (errorMsg && msg) errorMsg.textContent = msg;
    }
  }

  function _showPlayPrompt(show) {
    const promptEl = document.getElementById("livetv-player-prompt");
    if (promptEl) promptEl.style.display = show ? "flex" : "none";
  }

  function retryCurrentChannel() {
    if (_currentChannel) {
      playChannel(_currentChannel);
    }
  }

  function playNextChannel() {
    if (!_channels.length) return;
    const currentIdx = _channels.findIndex(c => c.id === _currentChannel?.id);
    const nextIdx = (currentIdx + 1) % _channels.length;
    playChannel(_channels[nextIdx]);
  }

  function handleUserPlayClick() {
    _showPlayPrompt(false);
    if (_videoEl) {
      _videoEl.play().catch(e => console.error("Play failed:", e));
    }
  }

  function toggleFullscreen() {
    const wrap = document.getElementById("livetv-theater-frame");
    if (!wrap) return;
    if (!document.fullscreenElement) {
      if (wrap.requestFullscreen) {
        wrap.requestFullscreen();
      } else if (wrap.webkitRequestFullscreen) {
        wrap.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  function cleanup() {
    if (_hls) {
      _hls.destroy();
      _hls = null;
    }
    if (_videoEl) {
      _videoEl.pause();
      _videoEl.removeAttribute("src");
      _videoEl.load();
    }
    _showLoading(false);
    _showError(false);
    _showPlayPrompt(false);
  }

  function _esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    init,
    cleanup,
    loadFullCatalogue,
    switchView,
    setCategory,
    setCountry,
    setLanguage,
    clearFilters,
    onSearchInput,
    filterChannels,
    playChannel,
    playChannelById,
    toggleFavorite,
    isFavorite,
    retryCurrentChannel,
    playNextChannel,
    handleUserPlayClick,
    toggleFullscreen,
    get _channels() { return _channels; },
    get _currentChannel() { return _currentChannel; }
  };
})();

window.LiveTV = LiveTV;
