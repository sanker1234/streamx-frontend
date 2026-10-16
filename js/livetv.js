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
  let _currentStreamUrl = "";

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
  let _activeCatalogueSource = "";
  let _epgUrl = "";

  const FAV_STORAGE_KEY = "CineJoy_LiveTV_Favorites";
  const CACHE_DB_NAME = "CineJoy_IPTV_Cache_v5";
  const CACHE_STORE_NAME = "catalogue";

  // Official IPTV-Org playlist catalogue sources with verified fallbacks
  const CATALOGUE_SOURCES = [
    {
      id: "official_master",
      name: "IPTV-Org Master (Official)",
      type: "m3u",
      url: "https://iptv-org.github.io/iptv/index.m3u",
      minChannels: 1000
    },
    {
      id: "jsdelivr_mirror",
      name: "IPTV-Org jsDelivr Mirror (Verified)",
      type: "m3u",
      url: "https://cdn.jsdelivr.net/gh/iptv-org/iptv@gh-pages/index.m3u",
      minChannels: 1000
    },
    {
      id: "github_raw",
      name: "IPTV-Org GitHub Raw (Verified)",
      type: "m3u",
      url: "https://raw.githubusercontent.com/iptv-org/iptv/gh-pages/index.m3u",
      minChannels: 500
    },
    {
      id: "bundled_fallback",
      name: "Bundled Local Snapshot (Offline)",
      type: "json",
      url: "data/livetv_channels.json",
      minChannels: 100
    }
  ];

  // Guaranteed verified flagship channels with high availability HTTPS
  const VERIFIED_FLAGSHIP_CHANNELS = [
    {
      id: "dw_english",
      name: "DW English HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png",
      country: "DE",
      countryName: "Germany",
      flag: "🇩🇪",
      category: "News",
      language: "eng",
      url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
      isHttps: true
    },
    {
      id: "france24_eng",
      name: "France 24 English HD",
      logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_FRANCE_24/images/LOGO_HD/image.png",
      country: "FR",
      countryName: "France",
      flag: "🇫🇷",
      category: "News",
      language: "eng",
      url: "https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8",
      isHttps: true
    },
    {
      id: "aljazeera_eng",
      name: "Al Jazeera English HD",
      logo: "https://i.imgur.com/7bRVpnu.png",
      country: "QA",
      countryName: "Qatar",
      flag: "🇶🇦",
      category: "News",
      language: "eng",
      url: "https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8",
      isHttps: true
    },
    {
      id: "euronews_eng",
      name: "Euronews English HD",
      logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Euro_News.png",
      country: "FR",
      countryName: "France",
      flag: "🇫🇷",
      category: "News",
      language: "eng",
      url: "https://dash4.antik.sk/live/test_euronews/playlist.m3u8",
      isHttps: true
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
      url: "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8",
      isHttps: true
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
      url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
      isHttps: true
    },
    {
      id: "nasa_tv_hd",
      name: "NASA TV HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/300px-NASA_logo.svg.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "Documentary",
      language: "eng",
      url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
      isHttps: true
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
      url: "https://bloomberg.com/media-manifest/streams/us.m3u8",
      isHttps: true
    },
    {
      id: "kids_3abn",
      name: "3ABN Kids",
      logo: "https://i.imgur.com/z3npqO1.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "Animation",
      language: "eng",
      url: "https://3abn.bozztv.com/3abn2/Kids_live/smil:Kids_live.smil/playlist.m3u8",
      isHttps: true
    },
    {
      id: "replay_00s",
      name: "00s Replay",
      logo: "https://images.pluto.tv/channels/62ba60f059624e000781c436/colorLogoPNG.png",
      country: "US",
      countryName: "United States",
      flag: "🇺🇸",
      category: "Movies",
      language: "eng",
      url: "https://jmp2.uk/plu-62ba60f059624e000781c436.m3u8",
      isHttps: true
    },
    {
      id: "one_plus_one_int",
      name: "1+1 International HD",
      logo: "https://i.imgur.com/LOY0rtp.png",
      country: "UA",
      countryName: "Ukraine",
      flag: "🇺🇦",
      category: "General",
      language: "ukr",
      url: "https://dash2.antik.sk/live/test_one_plus_one_int_tizen/playlist.m3u8",
      isHttps: true
    },
    {
      id: "SunGeminiComedy.in",
      name: "Sun Gemini Comedy",
      altNames: ["Gemini Comedy", "Sun జెమినీ Comedy"],
      network: "Sun Gemini",
      logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Gemini_Comedy.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Comedy",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0573/master.m3u8",
      altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
      isHttps: false
    },
    {
      id: "SunGeminiMovies.in",
      name: "Sun Gemini Movies",
      altNames: ["Gemini Movies", "Sun జెమినీ Movies", "Teja TV"],
      network: "Sun Gemini",
      logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MOVIES/images/LOGO_HD/image.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Movies",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
      altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
      isHttps: false
    },
    {
      id: "SunGeminiMusic.in",
      name: "Sun Gemini Music",
      altNames: ["Gemini Music", "Sun జెమినీ Music"],
      network: "Sun Gemini",
      logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MUSIC/images/LOGO_HD/image.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Music",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0589/master.m3u8",
      altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
      isHttps: false
    },
    {
      id: "SunGeminiLife.in",
      name: "Sun Gemini Life",
      altNames: ["Gemini Life", "Sun జెమినీ Life"],
      network: "Sun Gemini",
      logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_LIFE/images/LOGO_HD/image.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "General",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0584/master.m3u8",
      altUrl: "http://stream.mcquack.net/451/index.m3u8",
      isHttps: false
    },
    {
      id: "SunGemini.in",
      name: "Sun Gemini",
      altNames: ["Gemini TV", "Gemini", "Sun జెమినీ"],
      network: "Sun Gemini",
      logo: "https://sund-images.sunnxt.com/194396/300x300_SunGemini_194396_22c18c1e-7eb9-4855-9c4e-12e109911559.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Entertainment",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8",
      altUrl: "http://stream.mcquack.net/451/index.m3u8",
      isHttps: false
    },
    {
      id: "StarMaa.in",
      name: "Star Maa",
      altNames: ["Star Maa HD", "Maa TV", "స్టార్ మా", "JioStar"],
      network: "Disney Star",
      logo: "https://i.imgur.com/5c9PVS0.png",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Entertainment",
      language: "tel",
      url: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/chunklist_b2628000.m3u8",
      altUrl: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8",
      isHttps: true
    },
    {
      id: "StarMaaMovies.in",
      name: "Star Maa Movies",
      altNames: ["Maa Movies", "స్టార్ మా మూవీస్", "JioStar"],
      network: "Disney Star",
      logo: "https://dtil.tmsimg.com/assets/s143826_ld_h15_aa.png?lock=720x540",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Movies",
      language: "tel",
      url: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/chunklist_b2628000.m3u8",
      altUrl: "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/playlist.m3u8",
      isHttps: true
    },
    {
      id: "SunTV.in",
      name: "Sun TV HD",
      altNames: ["Sun TV", "சன் டிவி"],
      network: "Sun TV Network",
      logo: "https://dtil.tmsimg.com/assets/GNLZZGG002Z0M0Y.png?lock=720x540",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Entertainment",
      language: "tam",
      url: "http://ptuf.ridsys.in/riptv/live/SUN_TV/index.m3u8",
      altUrl: "http://103.151.60.162:2122/play/a02a/index.m3u8?hls",
      isHttps: false
    },
    {
      id: "ZeeTelugu.in",
      name: "Zee Telugu",
      altNames: ["జీ తెలుగు"],
      network: "Zee",
      logo: "https://dtil.tmsimg.com/assets/s52528_ld_h15_aa.png?lock=720x540",
      country: "IN",
      countryName: "India",
      flag: "🇮🇳",
      category: "Entertainment",
      language: "tel",
      url: "http://iptvcasomsapi.jprdigital.in/x-media/C0537/master.m3u8",
      altUrl: "https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeTeluguHD.m3u8",
      isHttps: false
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
          if (res && res.timestamp && (Date.now() - res.timestamp < 24 * 3600 * 1000) && Array.isArray(res.channels) && res.channels.length > 500) {
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

  async function _setCachedCatalogue(channels, countryMeta, source = "") {
    try {
      const db = await _openIndexedDB();
      if (!db) return;
      const tx = db.transaction(CACHE_STORE_NAME, "readwrite");
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.put({
        timestamp: Date.now(),
        source: source || _activeCatalogueSource || "IPTV-Org Master (Official)",
        channels,
        countryMeta
      }, "full_catalogue");
    } catch (e) {
      console.warn("Unable to cache catalogue in IndexedDB:", e);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     3. CATALOGUE LOADING & DEFENSIVE M3U STREAM PARSING
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
          if (c && c.code) {
            _countryMetaMap.set(c.code.toUpperCase(), {
              name: c.name || c.code,
              code: c.code.toUpperCase(),
              flag: c.flag || "🌐",
              languages: Array.isArray(c.languages) ? c.languages : []
            });
          }
        });
      }
    } catch (e) {
      console.warn("Error loading country metadata:", e);
    }
  }

  function _parseM3UContent(m3uText) {
    if (!m3uText || typeof m3uText !== "string") return [];
    const lines = m3uText.split(/\r?\n/);
    const parsedChannels = [];
    let cur = null;

    // Check for independent EPG URL on header line (decoupled from channel parsing)
    if (lines.length > 0 && lines[0].startsWith("#EXTM3U")) {
      const epgMatch = lines[0].match(/x-tvg-url="([^"]*)"/i) || lines[0].match(/x-tvg-url=([^\s]+)/i);
      if (epgMatch) _epgUrl = epgMatch[1];
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        cur = {};
        const commaIdx = line.lastIndexOf(",");
        const rawName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : "";
        const attrStr = commaIdx !== -1 ? line.substring(8, commaIdx) : line.substring(8);

        // Defensive attribute parsing supporting quoted or unquoted attributes
        const idM = attrStr.match(/tvg-id="([^"]*)"/i) || attrStr.match(/tvg-id=([^\s,]+)/i);
        const nameM = attrStr.match(/tvg-name="([^"]*)"/i) || attrStr.match(/tvg-name=([^\s,]+)/i);
        const logoM = attrStr.match(/tvg-logo="([^"]*)"/i) || attrStr.match(/tvg-logo=([^\s,]+)/i);
        const countryM = attrStr.match(/tvg-country="([^"]*)"/i) || attrStr.match(/tvg-country=([^\s,]+)/i);
        const langM = attrStr.match(/tvg-language="([^"]*)"/i) || attrStr.match(/tvg-language=([^\s,]+)/i);
        const groupM = attrStr.match(/group-title="([^"]*)"/i) || attrStr.match(/group-title=([^\s,]+)/i);

        cur.name = rawName || (nameM ? nameM[1].trim() : (idM ? idM[1].trim() : "Channel"));
        cur.id = idM ? idM[1].trim() : ("ch_" + parsedChannels.length);
        cur.logo = logoM ? logoM[1].trim() : "";

        // Category / Genre extraction
        if (groupM && groupM[1].trim()) {
          cur.category = groupM[1].split(";")[0].trim();
        } else {
          cur.category = "General";
        }

        cur.language = langM ? langM[1].trim().toLowerCase() : "";

        // Country code extraction
        let countryCode = countryM ? countryM[1].trim().toUpperCase() : "";
        if (!countryCode && cur.id) {
          // iptv-org convention: ChannelName.countryCode@variant (e.g. 00sReplay.us@SD, SunGemini.in)
          const m = cur.id.match(/\.([a-z]{2})(?:@[^\s"]*|$)/i);
          if (m) countryCode = m[1].toUpperCase();
        }
        cur.country = countryCode || "INT";

        // Country metadata enrichment (independent of EPG)
        const meta = _countryMetaMap.get(cur.country);
        cur.countryName = meta ? meta.name : (cur.country === "INT" ? "International" : cur.country);
        cur.flag = meta ? meta.flag : "🌐";

        // Intelligent Regional Language Inference for Indian Channels
        const checkStr = (cur.id + " " + cur.name).toLowerCase();
        if (/\b(telugu|maa|gemini|etv|sakshi|tv9telugu|v6|tnews|ntv|10tv|tollywood|bhakti)\b/i.test(checkStr) || /star\s*maa/i.test(checkStr) || checkStr.includes("starmaa") || checkStr.includes("geminitv")) {
          cur.language = "tel";
        } else if (/\b(tamil|sun\s*tv|ktv|vijay|kalaignar|jaya|polimer)\b/i.test(checkStr) || checkStr.includes("suntv")) {
          cur.language = "tam";
        } else if (/\b(kannada|udaya|suvarna)\b/i.test(checkStr)) {
          cur.language = "kan";
        } else if (/\b(malayalam|asianet|surya|mazhavil)\b/i.test(checkStr)) {
          cur.language = "mal";
        } else if (!cur.language && meta && Array.isArray(meta.languages) && meta.languages.length > 0) {
          cur.language = meta.languages[0].toLowerCase();
        }
      } else if (!line.startsWith("#") && cur) {
        // Stream URL (first non-comment line following #EXTINF)
        if (line.startsWith("http://") || line.startsWith("https://")) {
          let streamUrl = line;
          // Normalization: ptuf.ridsys.in lacks CORS headers and gets blocked by browsers.
          // Point Sun Gemini directly to verified CORS-enabled JPR Digital master endpoint:
          if (streamUrl.includes("ptuf.ridsys.in/riptv/live/GEMINI_TV") || (cur.id && cur.id.startsWith("SunGemini"))) {
            streamUrl = "http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8";
            cur.altUrl = "http://stream.mcquack.net/451/index.m3u8";
          } else if (cur.id && cur.id.startsWith("StarMaa")) {
            cur.altUrl = "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8";
          }
          cur.url = streamUrl;
          cur.isHttps = streamUrl.startsWith("https://");
          parsedChannels.push(cur);
        }
        cur = null;
      }
    }
    return parsedChannels;
  }

  async function loadFullCatalogue(forceRefresh = false) {
    if (_isLoadingCatalogue && !forceRefresh) return;
    _isLoadingCatalogue = true;
    _updateStatsLine("Connecting to official IPTV-Org directory...");

    // Step A: Load country metadata independently (decoupled)
    if (_countryMetaMap.size === 0) {
      await _loadCountryMetadata();
    }

    // Step B: Check IndexedDB cache for instant display
    if (!forceRefresh) {
      const cached = await _getCachedCatalogue();
      if (cached && Array.isArray(cached.channels) && cached.channels.length > 500) {
        console.log(`[LiveTV] Loaded ${cached.channels.length} channels from IndexedDB cache (${cached.source || "Cache"}).`);
        _channels = cached.channels;
        _activeCatalogueSource = cached.source || "Cached Catalogue";
        _computeStats();
        _onCatalogueLoaded();
        _isLoadingCatalogue = false;

        // Background revalidation if cache is older than 6 hours
        if (cached.timestamp && (Date.now() - cached.timestamp > 6 * 3600 * 1000)) {
          _revalidateCatalogueInBackground();
        }
        return;
      }
    }

    // Step C: Try official primary source and verified fallback sources sequentially
    let loadedSuccessfully = false;

    for (let i = 0; i < CATALOGUE_SOURCES.length; i++) {
      const src = CATALOGUE_SOURCES[i];
      try {
        console.log(`[LiveTV] Fetching catalogue from [${src.name}]: ${src.url}`);
        _updateStatsLine(`Fetching catalogue from ${src.name}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 14000);

        const resp = await fetch(src.url, {
          signal: controller.signal,
          cache: forceRefresh ? "reload" : "default"
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }

        let parsedChannels = [];
        if (src.type === "m3u") {
          const text = await resp.text();
          parsedChannels = _parseM3UContent(text);
        } else if (src.type === "json") {
          const json = await resp.json();
          if (Array.isArray(json)) {
            parsedChannels = json.map(c => ({
              ...c,
              isHttps: (c.url || "").startsWith("https://")
            }));
          }
        }

        if (parsedChannels.length >= src.minChannels) {
          console.log(`[LiveTV] Successfully parsed ${parsedChannels.length} channels from ${src.name}.`);
          _channels = parsedChannels;
          _activeCatalogueSource = src.name;
          _computeStats();
          _setCachedCatalogue(_channels, Array.from(_countryMetaMap.entries()), src.name);
          _onCatalogueLoaded();
          _isLoadingCatalogue = false;
          loadedSuccessfully = true;
          break;
        } else {
          console.warn(`[LiveTV] ${src.name} returned only ${parsedChannels.length} channels (expected >= ${src.minChannels}).`);
        }
      } catch (err) {
        console.warn(`[LiveTV] Catalogue source ${src.name} failed:`, err.message || err);
      }
    }

    // Step D: Ultimate emergency fallback if all sources failed
    if (!loadedSuccessfully) {
      console.error("[LiveTV] All remote and local catalogue sources failed. Falling back to emergency flagships.");
      _channels = VERIFIED_FLAGSHIP_CHANNELS.slice();
      _activeCatalogueSource = "Emergency Flagship Backup";
      _computeStats();
      _onCatalogueLoaded();
      _isLoadingCatalogue = false;
      _updateStatsLine("Could not reach remote IPTV directory. Loaded emergency flagship channels.", true);
    }
  }

  async function _revalidateCatalogueInBackground() {
    try {
      const primary = CATALOGUE_SOURCES[0];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(primary.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const text = await resp.text();
        const parsed = _parseM3UContent(text);
        if (parsed.length >= primary.minChannels) {
          console.log(`[LiveTV] Background revalidation successful: ${parsed.length} channels from ${primary.name}.`);
          _channels = parsed;
          _activeCatalogueSource = primary.name;
          _computeStats();
          _setCachedCatalogue(_channels, Array.from(_countryMetaMap.entries()), primary.name);
          _updateStatsLine();
        }
      }
    } catch (e) {
      console.log("[LiveTV] Background catalogue revalidation deferred:", e.message || e);
    }
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

    // Ensure player has a playable stream if none is loaded
    if (!_currentChannel && _filteredChannels.length) {
      // Find a verified HTTPS channel so browser autoplay/playback succeeds cleanly
      const starter = _filteredChannels.find(c => c.isHttps) || VERIFIED_FLAGSHIP_CHANNELS[0] || _filteredChannels[0];
      playChannel(starter);
    }

    // Render secondary views if user is on them
    if (_currentView === "countries") _renderCountriesGrid();
    if (_currentView === "languages") _renderLanguagesGrid();
    if (_currentView === "categories") _renderCategoriesGrid();
  }

  function _updateStatsLine(customText = null, isError = false) {
    const el = document.getElementById("livetv-stats-line");
    if (!el) return;

    if (customText) {
      el.innerHTML = isError ? `<span style="color:#ff6b6b">${_esc(customText)}</span>` : _esc(customText);
      return;
    }

    const totalStr = _channels.length.toLocaleString();
    const countryStr = _distinctCountriesCount.toLocaleString();
    const httpsStr = _httpsStreamCount.toLocaleString();
    const sourceLabel = _activeCatalogueSource ? ` [${_activeCatalogueSource}]` : "";

    el.innerHTML = `Loaded <strong>${totalStr}</strong> channels across <strong>${countryStr}</strong> countries <span class="livetv-stats-divider">·</span> <strong>${httpsStr}</strong> secure HTTPS streams <span class="livetv-stats-source" style="opacity:0.75;font-size:0.85em;">${_esc(sourceLabel)}</span> <button class="livetv-refresh-btn" onclick="LiveTV.loadFullCatalogue(true)" title="Refresh catalogue from official IPTV-Org source" style="background:none;border:none;color:var(--accent-primary,#e50914);cursor:pointer;font-size:0.85em;margin-left:6px;text-decoration:underline;font-family:inherit;">⟳ Refresh</button>`;
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
      const starter = _channels.find(c => c.isHttps) || _channels[0];
      playChannel(starter);

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

    // 4. Intelligent Search Query across Name, Alt Names, Network, ID, Category, Country & Language
    if (_searchQuery) {
      const queryTerms = _searchQuery.split(/\s+/).filter(Boolean);
      result = result.filter(ch => {
        const altNamesStr = Array.isArray(ch.altNames) ? ch.altNames.join(" ") : (ch.altNames || "");
        const combined = (
          (ch.name || "") + " " +
          (ch.id || "") + " " +
          (ch.network || "") + " " +
          (ch.category || "") + " " +
          (ch.country || "") + " " +
          (ch.countryName || "") + " " +
          (ch.language || "") + " " +
          altNamesStr
        ).toLowerCase();

        return queryTerms.every(term => combined.includes(term));
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

  // Fallback stream URLs for popular channels with dead upstream feeds
  const CHANNEL_FALLBACK_URLS = {
    "SunGemini.in": ["http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8", "http://stream.mcquack.net/451/index.m3u8"],
    "SunGemini.in@SD": ["http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8", "http://stream.mcquack.net/451/index.m3u8"],
    "GeminiTV.in": ["http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8", "http://stream.mcquack.net/451/index.m3u8"],
    "SunGeminiComedy.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0573/master.m3u8",
    "GeminiComedy.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0573/master.m3u8",
    "SunGeminiMovies.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    "GeminiMovies.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    "SunGeminiMusic.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0589/master.m3u8",
    "GeminiMusic.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0589/master.m3u8",
    "SunGeminiLife.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0584/master.m3u8",
    "GeminiLife.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0584/master.m3u8",
    "StarMaa.in": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8"
    ],
    "StarMaa.in@HD": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8"
    ],
    "MaaTV.in": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8"
    ],
    "MaaTV.in@SD": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:starmaa1.smil/playlist.m3u8"
    ],
    "StarMaaMovies.in": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/playlist.m3u8"
    ],
    "StarMaaMovies.in@HD": [
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/chunklist_b2628000.m3u8",
      "https://da86m1sqpm3o0.cloudfront.net/28072023/smil:maamovies.smil/playlist.m3u8"
    ],
    "TejaTV.in": "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    "SunTV.in": ["http://ptuf.ridsys.in/riptv/live/SUN_TV/index.m3u8", "http://103.151.60.162:2122/play/a02a/index.m3u8?hls"],
    "ZeeTelugu.in": [
      "http://iptvcasomsapi.jprdigital.in/x-media/C0537/master.m3u8",
      "https://d1rc86nwwc9fag.cloudfront.net/260723/smil:zeetelugu.smil/chunklist_b2628000.m3u8",
      "https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeTeluguHD.m3u8"
    ],
    "ZeeTelugu.in@HD": [
      "http://iptvcasomsapi.jprdigital.in/x-media/C0537/master.m3u8",
      "https://d1rc86nwwc9fag.cloudfront.net/260723/smil:zeetelugu.smil/chunklist_b2628000.m3u8",
      "https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeTeluguHD.m3u8"
    ],
    "ZeeCinemalu.in@HD": "https://d116gfrn8orazi.cloudfront.net/index.m3u8?akes=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NjcxOTc5NzJ9.O4qmdMPbHwKrCg6hFXvD70vjSPWKQd0a7NrjmFdeMB8",
    "TV9Telugu.in@SD": "https://dyjmyiv3bp2ez.cloudfront.net/pub-iotv9telcmjhcs/liveabr/playlist.m3u8",
    "TV9Telugu.in@HD": "https://dyjmyiv3bp2ez.cloudfront.net/pub-iotv9telcmjhcs/liveabr/playlist.m3u8",
    "NTVTelugu.in@SD": "https://cdn.pishow.tv/ott/live/385/master.m3u8",
    "10TV.in@SD": "https://cdn.pishow.tv/ott/live/385/master.m3u8",
    "ABNAJ.in@SD": "https://dyjmyiv3bp2ez.cloudfront.net/pub-iotv9telcmjhcs/liveabr/playlist.m3u8"
  };

  let _bufferingWatchdogTimer = null;
  let _currentNetworkRetries = 0;
  let _hasAttemptedFallback = false;

  function _startBufferingWatchdog(timeoutMs = 8000) {
    _clearBufferingWatchdog();
    _bufferingWatchdogTimer = setTimeout(() => {
      if (_videoEl && (_videoEl.paused || _videoEl.readyState < 3)) {
        console.warn("[LiveTV] Buffering watchdog triggered after " + timeoutMs + "ms for:", _currentChannel?.name);
        _showLoading(false);
        const isHttpsOrigin = window.location.protocol === "https:";
        const isHttpStream = (_currentStreamUrl || _currentChannel?.url || "").startsWith("http://");
        let errMsg = "Broadcast stream timed out. The upstream server is unreachable or offline.";
        if (isHttpsOrigin && isHttpStream) {
          errMsg = "This broadcast stream uses HTTP (plain text), which modern browsers block on HTTPS sites. Click 'Direct Stream Link' to open directly or copy into VLC.";
        }
        _showError(true, errMsg);
        if (_hls) {
          _hls.destroy();
          _hls = null;
        }
      }
    }, timeoutMs);
  }

  function _clearBufferingWatchdog() {
    if (_bufferingWatchdogTimer) {
      clearTimeout(_bufferingWatchdogTimer);
      _bufferingWatchdogTimer = null;
    }
  }

  function playChannel(ch, isRetry = false) {
    if (!ch) return;
    _currentChannel = ch;

    _highlightActiveCard(ch.id);

    if (!_videoEl) _videoEl = document.getElementById("livetv-video");
    if (!_videoEl) return;

    _clearBufferingWatchdog();
    if (!isRetry) {
      _currentNetworkRetries = 0;
      _hasAttemptedFallback = false;
    }

    if (_hls) {
      _hls.destroy();
      _hls = null;
    }

    _videoEl.pause();
    _videoEl.removeAttribute("src");
    _videoEl.load();

    _showLoading(true, isRetry ? "Attempting backup stream..." : "Buffering live broadcast...");
    _showError(false);
    _showPlayPrompt(false);

    // Determine target URL with healthy stream normalization
    const channelKey = ch.id || "";
    const baseKey = channelKey.split("@")[0];
    const fallbackEntry = CHANNEL_FALLBACK_URLS[channelKey] || CHANNEL_FALLBACK_URLS[baseKey];
    const fallbackList = Array.isArray(fallbackEntry) ? fallbackEntry : (fallbackEntry ? [fallbackEntry] : []);

    let streamUrl = ch.url || "";
    // Known non-CORS or decommissioned hosts that must immediately switch to verified healthy streams
    const hasKnownBadHost = !streamUrl || streamUrl.includes("ptuf.ridsys.in") || streamUrl.includes("smartplaytv.in") || streamUrl.includes("static.france24.com");

    if (hasKnownBadHost && fallbackList.length > 0) {
      streamUrl = fallbackList[0];
    } else if (_hasAttemptedFallback && (fallbackList.length > 0 || ch.altUrl)) {
      streamUrl = fallbackList.find(u => u !== streamUrl) || ch.altUrl || fallbackList[0];
    }

    _currentStreamUrl = streamUrl;
    _updatePlayerUI(ch, streamUrl);

    // Check mixed content warnings (HTTP on HTTPS origin)
    if (window.location.protocol === "https:" && streamUrl.startsWith("http://")) {
      console.warn("[LiveTV] Warning: HTTP stream on HTTPS page might be blocked by browser mixed-content restrictions:", streamUrl);
    }

    // Attach native HTML5 video event handlers
    _videoEl.onplaying = () => {
      _clearBufferingWatchdog();
      _showLoading(false);
      _showError(false);
      _showPlayPrompt(false);
    };

    _videoEl.oncanplay = () => {
      _clearBufferingWatchdog();
      _showLoading(false);
    };

    _videoEl.onwaiting = () => {
      _showLoading(true, "Buffering stream...");
      _startBufferingWatchdog(7000);
    };

    _videoEl.onerror = () => {
      _clearBufferingWatchdog();
      _showLoading(false);
      _showError(true, "Video playback error. The stream cannot be decoded.");
    };

    // Start 8.5-second watchdog timer
    _startBufferingWatchdog(8500);

    const HlsLib = window.Hls;
    if (HlsLib && typeof HlsLib.isSupported === "function" && HlsLib.isSupported()) {
      _hls = new HlsLib({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 8000,
        levelLoadingMaxRetry: 2,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 2
      });

      _hls.loadSource(streamUrl);
      _hls.attachMedia(_videoEl);

      _hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        const playPromise = _videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("Autoplay was prevented by browser policy:", err);
            _clearBufferingWatchdog();
            _showLoading(false);
            _showPlayPrompt(true);
          });
        }
      });

      _hls.on(HlsLib.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        console.warn("[LiveTV] Fatal HLS error encountered:", data.type, data.details, data.response?.code);

        // Check if an alternate stream exists before giving up
        const allFallbacks = [
          ...fallbackList,
          ...(ch.altUrl ? [ch.altUrl] : [])
        ];
        const nextFallback = allFallbacks.find(u => u && u !== streamUrl);

        if (nextFallback && !_hasAttemptedFallback) {
          _hasAttemptedFallback = true;
          console.log("[LiveTV] Primary stream failed, trying backup stream for", ch.name, ":", nextFallback);
          _showLoading(true, "Switching to backup stream...");
          if (_hls) {
            _hls.destroy();
            _hls = null;
          }
          ch.altUrl = nextFallback;
          playChannel(ch, true);
          return;
        }

        if (data.type === HlsLib.ErrorTypes?.NETWORK_ERROR || data.type === "networkError") {
          const status = data.response?.code;
          // If status is 404, 403, 410 or already retried once -> FAIL FAST!
          if (status === 404 || status === 403 || status === 410 || _currentNetworkRetries >= 1) {
            _clearBufferingWatchdog();
            _showLoading(false);
            const isHttpsOrigin = window.location.protocol === "https:";
            const isHttpStream = streamUrl.startsWith("http://");
            let errMsg = "Broadcast stream is currently unreachable.";
            if (isHttpsOrigin && isHttpStream) {
              errMsg = "This stream uses plain HTTP, which browsers block on HTTPS sites. Use the Direct Stream Link to open in VLC.";
            } else if (status === 404) {
              errMsg = "Broadcast stream is currently offline (HTTP 404 Not Found).";
            } else if (status === 403) {
              errMsg = "Stream access restricted (HTTP 403 Forbidden).";
            } else if (status === 410) {
              errMsg = "Stream endpoint has expired (HTTP 410 Gone).";
            } else if (!status || status === 0) {
              errMsg = "Stream connection failed (CORS or server unreachable).";
            } else {
              errMsg = `Broadcast stream error (HTTP ${status}).`;
            }
            _showError(true, errMsg);
            if (_hls) {
              _hls.destroy();
              _hls = null;
            }
            return;
          }

          // Transient network hiccup: allow 1 retry
          _currentNetworkRetries++;
          _hls.startLoad();
          return;
        }

        if (data.type === HlsLib.ErrorTypes?.MEDIA_ERROR || data.type === "mediaError") {
          _hls.recoverMediaError();
          return;
        }

        // Other fatal errors
        _clearBufferingWatchdog();
        _showLoading(false);
        _showError(true, "Stream offline or unreachable. Please try another channel.");
        if (_hls) {
          _hls.destroy();
          _hls = null;
        }
      });
    } else if (_videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple Safari HLS engine
      _videoEl.src = streamUrl;
      _videoEl.addEventListener("loadedmetadata", () => {
        _clearBufferingWatchdog();
        _showLoading(false);
        _videoEl.play().catch(() => _showPlayPrompt(true));
      }, { once: true });

      _videoEl.addEventListener("error", () => {
        _clearBufferingWatchdog();
        _showLoading(false);
        _showError(true, "Stream playback error on native player engine.");
      }, { once: true });
    } else {
      _clearBufferingWatchdog();
      _showLoading(false);
      _showError(true, "HLS live video streaming is not supported on this browser.");
    }
  }

  function _updatePlayerUI(ch, streamUrl = "") {
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

    const extBtn = document.getElementById("livetv-player-ext-btn");
    if (extBtn) {
      extBtn.href = streamUrl || _currentStreamUrl || ch.url || "#";
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

  function _showLoading(show, msg = "Buffering live broadcast...") {
    const spinner = document.getElementById("livetv-player-loading");
    if (spinner) {
      spinner.style.display = show ? "flex" : "none";
      const span = spinner.querySelector("span");
      if (span && msg) span.textContent = msg;
    }
  }

  function _showError(show, msg = "") {
    const errorEl = document.getElementById("livetv-player-error");
    const errorMsg = document.getElementById("livetv-player-error-text");
    const extLink = document.getElementById("livetv-error-ext-link");
    if (errorEl) {
      errorEl.style.display = show ? "flex" : "none";
      if (errorMsg && msg) errorMsg.textContent = msg;
      if (extLink) {
        const targetUrl = _currentStreamUrl || _currentChannel?.url;
        if (targetUrl) {
          extLink.href = targetUrl;
          extLink.style.display = "inline-flex";
        } else {
          extLink.style.display = "none";
        }
      }
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
    _clearBufferingWatchdog();
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
