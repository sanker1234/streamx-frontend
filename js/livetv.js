/**
 * CineJoy — Live TV Module
 * Dedicated HLS Live TV & Global Broadcast Player
 * Powered by public verified legal HLS streams and iptv-org public catalogue
 */

const LiveTV = (() => {
  let _channels = [];
  let _filteredChannels = [];
  let _currentChannel = null;
  let _hls = null;
  let _videoEl = null;
  let _activeCategory = "all";
  let _activeCountry = "all";
  let _searchQuery = "";
  let _favorites = [];
  let _isInitialized = false;

  const FAV_STORAGE_KEY = "CineJoy_LiveTV_Favorites";

  // Guaranteed fallback flagship channels with verified HTTPS and CORS
  const DEFAULT_CHANNELS = [
    {
      id: "nasa_tv",
      name: "NASA TV HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/300px-NASA_logo.svg.png",
      country: "US",
      category: "Documentary",
      url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8"
    },
    {
      id: "redbull_tv",
      name: "Red Bull TV",
      logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/320px-Red_Bull_TV_logo.svg.png",
      country: "Global",
      category: "Sports",
      url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8"
    },
    {
      id: "bloomberg_us",
      name: "Bloomberg Television",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Television_logo_2015.svg/320px-Bloomberg_Television_logo_2015.svg.png",
      country: "US",
      category: "News",
      url: "https://bloomberg.com/media-manifest/streams/us.m3u8"
    },
    {
      id: "cgtn_news",
      name: "CGTN News HD",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/CGTN_logo.svg/320px-CGTN_logo.svg.png",
      country: "Global",
      category: "News",
      url: "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8"
    },
    {
      id: "arirang_tv",
      name: "Arirang TV World",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Arirang_TV_logo.svg/320px-Arirang_TV_logo.svg.png",
      country: "KR",
      category: "Entertainment",
      url: "https://amdlive.ctnd.com.edgesuite.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8"
    },
    {
      id: "3catinfo_5",
      name: "3CatInfo Live",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Logo_3Cat.svg/320px-Logo_3Cat.svg.png",
      country: "ES",
      category: "News",
      url: "https://directes-tv-int.3catdirectes.cat/live-origin/canal324-hls/master.m3u8"
    },
    {
      id: "3aw_1",
      name: "3AW Melbourne",
      logo: "https://i.imgur.com/81Y7y6U.png",
      country: "AU",
      category: "News",
      url: "https://3awlive.akamaized.net/hls/live/2032295/3AW/index.m3u8"
    },
    {
      id: "6_tv_telugu_10",
      name: "6 TV Telugu",
      logo: "https://yuppparoriglin.akamaized.net/181224/logo.png",
      country: "IN",
      category: "News",
      url: "https://yuppparoriglin.akamaized.net/181224/smil:6tv.smil/playlist.m3u8"
    }
  ];

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
    if (isFavorite(channelId)) {
      _favorites = _favorites.filter(id => id !== channelId);
    } else {
      _favorites.push(channelId);
    }
    _saveFavorites();
    _updateFavoriteUI(channelId);

    // If currently viewing favorites category, re-filter
    if (_activeCategory === "favorites") {
      filterChannels();
    }
  }

  function _updateFavoriteUI(channelId) {
    const isFav = isFavorite(channelId);
    // Update player heart if active channel
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
    // Update card button
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

  async function loadChannelsData() {
    try {
      const resp = await fetch("data/livetv_channels.json");
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length) {
          _channels = data;
          return;
        }
      }
    } catch (e) {
      console.warn("Using default verified Live TV channels:", e);
    }
    _channels = DEFAULT_CHANNELS;
  }

  function init() {
    _loadFavorites();
    _videoEl = document.getElementById("livetv-video");

    if (!_isInitialized) {
      _isInitialized = true;
      if (!_channels || !_channels.length) {
        _channels = DEFAULT_CHANNELS.slice();
      }
      _populateCountryFilter();
      filterChannels();
      if (!_currentChannel && _filteredChannels.length) {
        playChannel(_filteredChannels[0]);
      }
      loadChannelsData().then(() => {
        _populateCountryFilter();
        filterChannels();
      });
    } else {
      // Re-entering Live TV page
      if (!_currentChannel && _filteredChannels.length) {
        playChannel(_filteredChannels[0]);
      } else if (_currentChannel && _videoEl && _videoEl.paused) {
        _videoEl.play().catch(() => {});
      }
    }
  }

  function _populateCountryFilter() {
    const select = document.getElementById("livetv-country-select");
    if (!select) return;

    const countries = Array.from(new Set(_channels.map(c => c.country || "Global"))).sort();
    let html = `<option value="all">All Countries (${_channels.length})</option>`;
    countries.forEach(c => {
      const count = _channels.filter(ch => (ch.country || "Global") === c).length;
      html += `<option value="${c}">${c} (${count})</option>`;
    });
    select.innerHTML = html;
  }

  function setCategory(cat) {
    _activeCategory = cat;
    document.querySelectorAll(".livetv-cat-pill").forEach(pill => {
      pill.classList.toggle("active", pill.dataset.cat === cat);
    });
    filterChannels();
  }

  function setCountry(country) {
    _activeCountry = country;
    filterChannels();
  }

  function onSearchInput(query) {
    _searchQuery = (query || "").trim().toLowerCase();
    filterChannels();
  }

  function filterChannels() {
    let result = _channels.slice();

    // Category filter
    if (_activeCategory === "favorites") {
      result = result.filter(ch => isFavorite(ch.id));
    } else if (_activeCategory !== "all") {
      result = result.filter(ch => (ch.category || "").toLowerCase() === _activeCategory.toLowerCase());
    }

    // Country filter
    if (_activeCountry !== "all") {
      result = result.filter(ch => (ch.country || "Global").toUpperCase() === _activeCountry.toUpperCase());
    }

    // Search query
    if (_searchQuery) {
      result = result.filter(ch =>
        ch.name.toLowerCase().includes(_searchQuery) ||
        (ch.category || "").toLowerCase().includes(_searchQuery) ||
        (ch.country || "").toLowerCase().includes(_searchQuery)
      );
    }

    _filteredChannels = result;
    _renderChannelsGrid();
  }

  function _renderChannelsGrid() {
    const grid = document.getElementById("livetv-channels-grid");
    const countEl = document.getElementById("livetv-results-count");
    if (!grid) return;

    if (countEl) {
      countEl.textContent = `${_filteredChannels.length} channel${_filteredChannels.length === 1 ? "" : "s"}`;
    }

    if (!_filteredChannels.length) {
      grid.innerHTML = `
        <div class="livetv-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 6h-7.59l3.29-3.3a1 1 0 10-1.41-1.41L12 4.59 8.71 1.29A1 1 0 007.29 2.7L10.59 6H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V8a2 2 0 00-2-2zm0 14H3V8h18v12zM9 10v8l7-4-7-4z"/>
          </svg>
          <h4>No Channels Found</h4>
          <p>${_activeCategory === "favorites" ? "You haven't saved any favorite channels yet. Click the heart icon on any channel card to add it here." : "Try adjusting your search query or filters to find live streams."}</p>
          ${_activeCategory === "favorites" ? `<button class="btn-primary" onclick="LiveTV.setCategory('all')">Browse All Channels</button>` : ""}
        </div>
      `;
      return;
    }

    let html = "";
    _filteredChannels.forEach(ch => {
      const isCurrent = _currentChannel && _currentChannel.id === ch.id;
      const isFav = isFavorite(ch.id);
      const initial = (ch.name || "T")[0].toUpperCase();

      html += `
        <div class="livetv-card ${isCurrent ? "active-playing" : ""}" data-id="${_esc(ch.id)}" onclick="LiveTV.playChannelById('${_esc(ch.id)}')">
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
              <span class="livetv-card-cat">${_esc(ch.category || "General")}</span>
              <span class="livetv-card-dot">·</span>
              <span class="livetv-card-country">${_esc(ch.country || "Global")}</span>
            </div>
          </div>
          ${isCurrent ? `
            <div class="livetv-card-eq" title="Now Playing">
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
            </div>
          ` : ""}
        </div>
      `;
    });

    grid.innerHTML = html;
  }

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

    // Clean up previous HLS stream
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

    if (window.Hls && Hls.isSupported()) {
      _hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000
      });

      _hls.loadSource(streamUrl);
      _hls.attachMedia(_videoEl);

      _hls.on(Hls.Events.MANIFEST_PARSED, () => {
        _showLoading(false);
        const playPromise = _videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn("Autoplay was prevented by browser policy:", err);
            _showPlayPrompt(true);
          });
        }
      });

      _hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn("HLS fatal error encountered:", data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              _hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              _hls.recoverMediaError();
              break;
            default:
              _showLoading(false);
              _showError(true, "The selected broadcast stream is temporarily offline or unreachable.");
              if (_hls) {
                _hls.destroy();
                _hls = null;
              }
              break;
          }
        }
      });
    } else if (_videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple / Safari HLS engine
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
    const logoEl = document.getElementById("livetv-player-logo");
    const logoWrap = document.getElementById("livetv-player-logo-wrap");

    if (titleEl) titleEl.textContent = ch.name;
    if (catEl) catEl.textContent = ch.category || "Live Broadcast";
    if (countryEl) countryEl.textContent = ch.country || "Global";

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
    setCategory,
    setCountry,
    onSearchInput,
    filterChannels,
    playChannel,
    playChannelById,
    toggleFavorite,
    isFavorite,
    retryCurrentChannel,
    playNextChannel,
    handleUserPlayClick,
    toggleFullscreen
  };
})();

window.LiveTV = LiveTV;
