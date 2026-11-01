/**
 * StreamX Universal Custom Video Player
 * CloudStream-Inspired Modular Architecture & Gestures
 * 
 * Features:
 *  - HLS & MP4 playback (Hls.js + Native Safari fallback)
 *  - CloudStream-style Long-press 2× speed gesture
 *  - Double-tap seek (±10s) with ripple indicators
 *  - Aspect ratio switcher: Contain (Fit), Cover (Crop), Stretch to Fill, Original 1:1
 *  - Real multi-audio track switcher (reads true container/manifest tracks only)
 *
 * v1.5 additions (audio button always visible + honest single-track state, 10s stall watchdog, switch toast):
 *  - In-player Direct "Servers" menu (cloud button): lists direct source
 *    variants (per-quality URLs) + cloud servers (engines) with manual switch
 *    keeping the playback position
 *  - Stall watchdog: endless-loading guard advances to the next source
 *    variant automatically instead of spinning forever
 *  - switchSource()/switchServer() public API + onServerChange hook
 *  - Subtitle manager: Embedded + External WebVTT, sync time offset, font size control
 *  - Quality rendition switcher (HLS levels)
 *  - Desktop keyboard shortcuts & mobile responsive touch overlay
 *  - Persistent playback position & seamless cleanup
 */

const UniversalPlayer = (() => {
  let _container = null;
  let _video = null;
  let _hls = null;
  let _currentSource = null;
  let _savedNormalSpeed = 1.0;
  let _isLongPressing = false;
  let _longPressTimer = null;
  let _pointerStartX = 0;
  let _pointerStartY = 0;
  let _lastTapTime = 0;
  let _controlsHideTimer = null;
  let _subtitleOffsetSeconds = 0;
  let _activeMenu = null;
  let _resumeKey = "";
  let _boundKeyHandler = null;
  let _config = null; // retained for retry/onRetry hooks
  let _sourceIndex = 0; // quality-source fallback probe (direct streams)

  // Aspect ratio presets
  const ASPECT_MODES = ["contain", "cover", "stretch", "original"];

  /**
   * Mounts the player inside the target DOM container and loads media.
   */
  async function mount(containerEl, config = {}) {
    destroy(); // Clean up any existing instance first

    _container = containerEl;
    if (!_container) return;

    _config = config;
    _sourceIndex = 0; // each mount starts with the best quality

    _resumeKey = config.mediaId
      ? `streamx_pos_${config.mediaType || "media"}_${config.mediaId}_${config.season || 1}_${config.episode || 1}`
      : "";

    _renderPlayerDOM(config);
    _initVideoElement();
    _initHlsOrNative(config);
    _bindGestureListeners();
    _bindKeyboardShortcuts();
    _restorePreferences();
    _populateServersMenu();

    console.log("[UniversalPlayer] Mounted successfully with config:", config);
  }

  /**
   * Constructs the HTML structure of the player with overlays and controls.
   */
  function _renderPlayerDOM(config) {
    const savedAspect = localStorage.getItem("streamx_player_aspect") || "contain";

    _container.innerHTML = `
      <div class="sx-player-container" id="sx-player-root" data-aspect="${savedAspect}">
        <!-- Video Canvas -->
        <video class="sx-video" id="sx-video-element" playsinline webkit-playsinline></video>

        <!-- Long-Press 2× Dynamic Overlay Badge -->
        <div class="sx-speed-badge" id="sx-speed-badge">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          <span>2× Speed (Release to Restore)</span>
        </div>

        <!-- Double-Tap Seek Ripples -->
        <div class="sx-ripple-indicator left" id="sx-ripple-left">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          <span>-10s</span>
        </div>
        <div class="sx-ripple-indicator right" id="sx-ripple-right">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          <span>+10s</span>
        </div>

        <!-- Center Play/Pause Flash Indicator -->
        <div class="sx-center-indicator" id="sx-center-indicator">
          <svg id="sx-center-icon" viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>

        <!-- Loading Overlay -->
        <div class="sx-loading-overlay" id="sx-loading-overlay">
          <div class="sx-spinner"></div>
          <span style="font-size:12px; font-weight:600; color:rgba(255,255,255,0.85);">Loading Stream...</span>
        </div>

        <!-- Error Screen -->
        <div class="sx-error-screen" id="sx-error-screen">
          <div class="sx-error-title">Playback Error</div>
          <div class="sx-error-msg" id="sx-error-msg">The media stream could not be loaded.</div>
          <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; justify-content:center;">
            <button class="sx-error-retry-btn" onclick="UniversalPlayer.retry()">Retry Playback</button>
            <button class="sx-error-retry-btn" style="background:linear-gradient(135deg, #10b981, #059669); border-color:transparent;" onclick="UniversalPlayer.switchToEmbedded()">Switch to NXsha (Embed)</button>
          </div>
        </div>

        <!-- Controls Overlay -->
        <div class="sx-controls-overlay" id="sx-controls-overlay">
          <!-- Top Bar -->
          <div class="sx-top-bar">
            <div class="sx-title-group">
              <span class="sx-title">${_esc(config.title || "StreamX Media")}</span>
              ${config.subtitle ? `<span class="sx-subtitle">${_esc(config.subtitle)}</span>` : ""}
            </div>
            <div class="sx-top-actions">
              <button class="sx-btn-icon" id="sx-btn-aspect" title="Cycle Aspect Ratio (Contain, Cover, Stretch, 1:1)" onclick="UniversalPlayer.cycleAspectRatio()">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18M16 3v18"/></svg>
              </button>
              <button class="sx-btn-icon" id="sx-btn-pip" title="Picture in Picture" onclick="UniversalPlayer.togglePip()">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor"/></svg>
              </button>
            </div>
          </div>

          <!-- Bottom Bar -->
          <div class="sx-bottom-bar">
            <!-- Scrub Bar -->
            <div class="sx-scrub-wrap" id="sx-scrub-wrap">
              <div class="sx-scrub-track" id="sx-scrub-track">
                <div class="sx-scrub-buffer" id="sx-scrub-buffer"></div>
                <div class="sx-scrub-fill" id="sx-scrub-fill"></div>
                <div class="sx-scrub-handle" id="sx-scrub-handle"></div>
              </div>
              <div class="sx-scrub-tooltip" id="sx-scrub-tooltip">00:00</div>
            </div>

            <!-- Buttons Row -->
            <div class="sx-controls-row">
              <div class="sx-left-ctrls">
                <button class="sx-btn-icon" id="sx-btn-play" title="Play / Pause" onclick="UniversalPlayer.togglePlay()">
                  <svg id="sx-icon-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <button class="sx-btn-icon" title="Rewind 10s" onclick="UniversalPlayer.seekRelative(-10)">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                </button>
                <button class="sx-btn-icon" title="Forward 10s" onclick="UniversalPlayer.seekRelative(10)">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                </button>
                <div class="sx-volume-group">
                  <button class="sx-btn-icon" id="sx-btn-mute" title="Mute" onclick="UniversalPlayer.toggleMute()">
                    <svg id="sx-icon-vol" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                  <input type="range" class="sx-volume-slider" id="sx-volume-slider" min="0" max="1" step="0.05" value="1" oninput="UniversalPlayer.setVolume(this.value)">
                </div>
                <div class="sx-time-display" id="sx-time-display" onclick="UniversalPlayer.toggleTimeFormat()">00:00 / 00:00</div>
              </div>

              <div class="sx-right-ctrls">
                <!-- Direct Server Switch Button (cloud symbol; shows direct sources + engines) -->
                <button class="sx-btn-icon" id="sx-btn-servers" title="Servers & Audio Variants" onclick="UniversalPlayer.toggleMenu('servers')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.1a7 7 0 1 0-13 3.5"/><path d="M13 12l-3 3 3 3"/><line x1="10" y1="15" x2="20" y2="15"/></svg>
                </button>
                <!-- Quality Button -->
                <button class="sx-btn-icon" id="sx-btn-quality" title="Quality Selection" onclick="UniversalPlayer.toggleMenu('quality')">
                  <span style="font-size:11px; font-weight:700;">HD</span>
                </button>
                <!-- Audio Tracks Button (always visible: honest single-track state when the source is single-muxed) -->
                <button class="sx-btn-icon" id="sx-btn-audio" title="Audio Tracks" onclick="UniversalPlayer.toggleMenu('audio')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                </button>
                <!-- Subtitles Button (Revealed dynamically only when subtitle tracks exist) -->
                <button class="sx-btn-icon" id="sx-btn-subs" title="Subtitles & Sync" style="display:none;" onclick="UniversalPlayer.toggleMenu('subs')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="17" y2="15"/><line x1="7" y1="11" x2="17" y2="11"/></svg>
                </button>
                <!-- Settings Button (Speed & Aspect) -->
                <button class="sx-btn-icon" id="sx-btn-settings" title="Playback Settings" onclick="UniversalPlayer.toggleMenu('settings')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
                <!-- Fullscreen Button -->
                <button class="sx-btn-icon" id="sx-btn-fs" title="Toggle Fullscreen" onclick="UniversalPlayer.toggleFullscreen()">
                  <svg id="sx-icon-fs" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Popup Menu Panels -->
        <div class="sx-menu-panel" id="sx-menu-servers"></div>
        <div class="sx-menu-panel" id="sx-menu-quality"></div>
        <div class="sx-menu-panel" id="sx-menu-audio"></div>
        <div class="sx-menu-panel" id="sx-menu-subs"></div>
        <div class="sx-menu-panel" id="sx-menu-settings"></div>
      </div>
    `;

    _video = document.getElementById("sx-video-element");
  }

  function _initVideoElement() {
    if (!_video) return;

    // Time update for scrub bar and timer display
    _video.addEventListener("timeupdate", _onTimeUpdate);
    _video.addEventListener("progress", _onBufferProgress);
    // Stall back at the start position (currentTime 0, nothing decodable)
    // re-arms the watchdog: demux/segment failure loops cannot outlive it
    // merely because one event once looked alive.
    _video.addEventListener("waiting", () => {
      _setLoading(true);
      if (_video && _video.readyState < 2 && _video.currentTime === 0) _armStallWatchdog();
    });
    _video.addEventListener("playing", () => {
      _setLoading(false);
      _updatePlayButton(true);
    });
    _video.addEventListener("pause", () => _updatePlayButton(false));
    // Dead-source recovery: any sign of life dismisses the stall watchdog
    // until the next start-stall (the waiting listener re-arms).
    _video.addEventListener("canplay", () => _clearStallWatchdog());
    _video.addEventListener("loadedmetadata", () => _clearStallWatchdog());
    _video.addEventListener("ended", () => {
      _updatePlayButton(false);
      // Auto-trigger next episode if available in parent controller
      if (window.Player && typeof window.Player.playNextEpisode === "function") {
        window.Player.playNextEpisode();
      }
    });

    _video.addEventListener("error", () => {
      _setLoading(false);
      _handleVideoError();
    });

    // Scrub bar click/drag interaction
    const scrubWrap = document.getElementById("sx-scrub-wrap");
    if (scrubWrap) {
      scrubWrap.addEventListener("click", _onScrubClick);
      scrubWrap.addEventListener("mousemove", _onScrubHover);
    }
  }

  // Quality-source fallback + stall watchdog ────────────────────────────────────
  // Each direct source is an independent signed URL with its own CDN throttle
  // budget, so a URL the upstream has temporarily rate-limited (MediaError
  // code 4 — the proxy relayed an error page instead of media) or one that
  // simply stalls (infinite loading) must not kill playback. The player
  // advances to the next quality's URL before surfacing a fatal error.
  let _stallWatchdog = null;

  function _clearStallWatchdog() {
    if (_stallWatchdog) { clearTimeout(_stallWatchdog); _stallWatchdog = null; }
  }

  // Fire only while nothing has loaded: if metadata OR the first media data
  // never arrive (burnt URL, throttled CDN, dead proxy relay, CF-blocked
  // segment CDN), advance to the next source automatically instead of
  // parking the player on an eternal spinner.
  // Zero data detection must cover BOTH delivery paths (see
  // _stuckWithoutMedia for the probe-verified details).
  function _stuckWithoutMedia() {
    // "Nothing playable at the playhead" covers both delivery paths and the
    // stragglers in between: native <video>.duration stays NaN until metadata,
    // while an MSE-attached element (hls.js) reports a finite duration the
    // moment the manifest attaches even with zero segments appended; a stray
    // buffered fragment off-playhead can also leave buffered non-empty while
    // readyState stays 0 (live-probed both variants 2026-10). Media that is
    // actually loadable reaches readyState ≥ 2 (HAVE_CURRENT_DATA) quickly.
    return Boolean(_video && _video.readyState < 2);
  }
  function _armStallWatchdog() {
    _clearStallWatchdog();
    _stallWatchdog = setTimeout(() => {
      if (!_stuckWithoutMedia()) return;
      console.warn("[UniversalPlayer] Stall watchdog: no media loaded in 10 s on source", _sourceIndex + 1);
      if (_isCurrentVaultSource()) { _showVaultVerifyError(); return; }
      if (!_nextSourceFallback("stall watchdog")) {
        // Nothing left to try — surface the honest error card (onRetry re-resolves fresh).
        _showError("This stream is not responding. Use Retry Playback or switch servers below.");
      }
    }, 10000);
  }

  function _switchToSourceIndex(idx) {
    const sources = (_config && _config.sources) || [];
    if (idx < 0 || idx >= sources.length || idx === _sourceIndex) return false;
    _clearStallWatchdog();
    _sourceIndex = idx;
    const resumeAt = isFinite(_video && _video.currentTime) ? _video.currentTime : 0;
    const wasPlaying = _video && !_video.paused;
    if (_hls) { _hls.destroy(); _hls = null; }
    try { _video.removeAttribute("src"); _video.load(); } catch (e) { /* noop */ }
    _initHlsOrNative(_config);
    if (resumeAt > 1) _video.addEventListener("loadedmetadata", () => {
      try { _video.currentTime = resumeAt; } catch (e2) { /* seeking may fail early */ }
    }, { once: true });
    if (wasPlaying) _video.addEventListener("playing", () => {}, { once: true });
    console.log(`[UniversalPlayer] Manual switch to direct source ${idx + 1}/${sources.length}`);
    return true;
  }

  function _nextSourceFallback(reason) {
    const sources = (_config && _config.sources) || [];
    // Language-files vault sources are per-LANGUAGE files, not a quality
    // ladder: auto-advancing on error would silently substitute a different
    // language than the user selected (content-identity rule). Those fail
    // through the honest vault verify CTA in _handleVideoError instead.
    const current = sources[_sourceIndex];
    if (current && _isVaultRelayUrl(current.url)) return false;
    if (_sourceIndex < sources.length - 1) {
      const resumeAt = isFinite(_video && _video.currentTime) ? _video.currentTime : 0;
      const next = sources[_sourceIndex + 1];
      console.log(`[UniversalPlayer] ${reason} → trying next quality source (${_sourceIndex + 2}/${sources.length}): ${next.quality || "auto"}`);
      _switchToSourceIndex(_sourceIndex + 1);
      if (resumeAt > 1) _video.addEventListener("loadedmetadata", () => {
        try { _video.currentTime = resumeAt; } catch (e2) { /* seeking may fail early */ }
      }, { once: true });
      return true;
    }
    return false;
  }

  // Vault relay sources (Language Files engine) are top-level-navigation
  // media (probe-verified 2026-10-27: the vault's own fileTable UI plays them
  // via window.open; our backend proxy and credentialed video subresource
  // requests are handed a Cloudflare challenge). First plays from a browser
  // without clearance fail — surface a one-click verify step (same user
  // gesture pattern the vault itself uses) instead of a generic error.
  function _isCurrentVaultSource() {
    const src = ((_config && _config.sources) || [])[_sourceIndex];
    return Boolean(src && _isVaultRelayUrl(src.url));
  }

  function verifyVaultRelay() {
    const src = ((_config && _config.sources) || [])[_sourceIndex];
    if (!src || !_isVaultRelayUrl(src.url)) return;
    // Open the relay zone's DOCUMENT (zone root), never the file itself —
    // top-level navigation to the file is served as octet-stream and the
    // browser downloads the whole movie (user-reported). The root page
    // triggers the same one-time Cloudflare verification for this zone and
    // lands on a plain page, establishing clearance without any download.
    const relayOrigin = new URL(src.url).origin;
    window.open(relayOrigin + "/", "_blank", "noopener");
    _showToast("Access check opened in a new tab — come back and press Retry Playback");
  }

  function _showVaultVerifyError(detail) {
    const current = ((_config && _config.sources) || [])[_sourceIndex];
    const lang = current && current.language ? ` (${current.language})` : "";
    _showError("The Multi-Language server needs a one-time access check from your browser before streaming" + lang + (detail ? " [" + detail + "]" : "") + ". Press Verify Multi-Language Server Access, then Retry Playback.");
    // Vault sources carry exactly ONE independent per-language URL each: no
    // quality ladder to fall back down, and advancing to the next source
    // would silently substitute a different language (content-identity
    // rule) — so the CTA below is the honest path instead of auto-fallback.
    try {
      const screen = document.getElementById("sx-error-screen");
      // The error card's buttons have no ids — anchor to the first button
      // (Retry Playback, always present at the top of the actions row).
      // Dedupe: both the watchdog and the media-error path can surface this
      // card for the same source — never stack multiple verify buttons.
      if (screen && screen.querySelector("[data-vault-verify-btn]")) return;
      const anchor = screen ? screen.querySelector("button") : null;
      if (anchor && anchor.parentNode) {
        const verify = document.createElement("button");
        verify.className = "sx-error-retry-btn";
        verify.setAttribute("data-vault-verify-btn", "1");
        verify.style.background = "linear-gradient(135deg, #a78bfa, #7c3aed)";
        verify.style.borderColor = "transparent";
        verify.textContent = "Verify Multi-Language Server Access";
        verify.onclick = verifyVaultRelay;
        anchor.parentNode.insertBefore(verify, anchor);
      }
    } catch (e) { /* best-effort CTA */ }
  }

  function _handleVideoError() {
    const code = _video.error?.code || "unknown";
    console.warn("[UniversalPlayer] Media error code", code, "on source attempt", _sourceIndex + 1);
    if (_isCurrentVaultSource()) { _showVaultVerifyError("MediaError " + code); return; }
    if (code === 4 && _nextSourceFallback("MediaError 4")) return;
    _showError("Video playback encountered an error. Code: " + code);
  }

  // ── Direct Server / Audio-variant menu (cloud button) ────────────────────────
  function _populateServersMenu() {
    const menu = document.getElementById("sx-menu-servers");
    if (!menu) return;

    const sources = (_config && _config.sources) || [];
    let html = `<div class="sx-menu-header">Self-Hosted Stream Sources</div>`;

    sources.forEach((src, idx) => {
      const isSel = idx === _sourceIndex;
      const langLabel = src.language ? ` [${src.language}]` : "";
      const qBadge = src.quality ? `<span style="font-size:10px; opacity:0.85; margin-left:6px; background:rgba(255,255,255,0.15); padding:1px 6px; border-radius:3px;">${_esc(src.quality)}</span>` : "";
      const name = src.title || src.name || `Source ${idx + 1}`;
      html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.switchSource(${idx})">
        <span style="font-weight:600;">${_esc(name)}${_esc(langLabel)}</span>${qBadge}
      </button>`;
    });
    if (sources.length === 0) html += `<div class="sx-menu-item" style="opacity:.6">No extracted streams available</div>`;

    html += `
      <div style="border-top:1px solid rgba(255,255,255,0.1); margin:6px 0; padding-top:4px;">
        <button class="sx-menu-item" onclick="UniversalPlayer.switchToEmbedded()" style="color:#f59e0b; font-weight:600;">
          ↪ Switch to NXsha (Embed)
        </button>
      </div>
      <div style="font-size:11px; color:#8a96a3; padding:4px 8px;">Self-Hosted Nano Service · Switching streams preserves playback position.</div>
    `;
    menu.innerHTML = html;
  }

  function switchSource(idx) {
    if (_switchToSourceIndex(idx)) {
      _populateServersMenu();
      _closeAllMenus();
      _showToast("Switching stream source…");
    }
  }

  function switchServer(serverId) {
    _clearStallWatchdog();
    _closeAllMenus();
    if (_config && typeof _config.onServerChange === "function") {
      _showToast("Switching server…");
      _config.onServerChange(serverId);
    } else {
      console.log("[UniversalPlayer] No onServerChange handler; server switch unavailable:", serverId);
    }
  }

  function _initHlsOrNative(config) {
    _setLoading(true);

    const sources = config.sources || [];
    const directSource = sources[_sourceIndex] ||
      (config.url ? { url: config.url, type: config.url.includes(".m3u8") ? "hls" : "mp4" } : null);

    if (!directSource || !directSource.url) {
      _setLoading(false);
      _showError("No valid direct playback source available.");
      return;
    }

    // Cross-origin mode per source (probe-verified 2026-10-27):
    // • Vault relay (/bulk?u=) → NO crossorigin attr: their CF edge hands an
    //   interactive challenge to server-side and subresource requests but
    //   real top-level/user-gesture navigations pass; native video must keep
    //   default (no-cors) credential behavior like the vault's own player.
    // • Everything else → crossorigin=anonymous: REQUIRED for external WebVTT
    //   <track> children from third-party caption hosts (without it Chromium
    //   logs "Text track … blocked from loading: Not same origin as
    //   document…" and subtitles never render — the reported bug).
    //   Proxied sources pass through the backend media relay which sets
    //   Access-Control-Allow-Origin: *, so this is CORS-safe for media.
    _applyCrossOriginMode(directSource.url);

    // Reject iframe embed URLs from being loaded in native video/HLS element
    const isEmbedUrl = directSource.url.includes("/embed/") ||
      directSource.url.includes("nxsha.app") ||
      directSource.url.includes("cinesrc.st") ||
      directSource.url.includes("vidlink.pro") ||
      directSource.url.includes("vidcore.org") ||
      (!directSource.url.endsWith(".m3u8") && !directSource.url.endsWith(".mp4") && !directSource.url.endsWith(".webm") &&
        !directSource.url.includes(".m3u8?") && !directSource.url.includes(".mp4?") && !directSource.url.includes(".webm?") && !directSource.isDirect);

    if (isEmbedUrl) {
      _setLoading(false);
      _showError("Third-party iframe embed pages cannot be loaded in the native video element. Please switch to an authorized embed server.");
      return;
    }

    _currentSource = directSource;
    const isHls = directSource.type === "hls" || directSource.url.includes(".m3u8");
    const isMp4 = directSource.type === "mp4" || directSource.url.endsWith(".mp4") || directSource.url.includes(".mp4?");
    const isWebm = directSource.type === "webm" || directSource.url.endsWith(".webm");

    if (!isHls && !isMp4 && !isWebm) {
      _setLoading(false);
      _showError(`Unsupported stream format (${directSource.type || "unknown"}). Only direct HLS (.m3u8) and MP4/WebM are supported.`);
      return;
    }

    // Endless-loading guard: if metadata never arrives on this URL (burnt,
    // throttled, or CF-blocked CDN route), the watchdog advances to the next
    // source variant instead of spinning forever.
    _armStallWatchdog();

    const HlsLib = window.Hls;

    if (isHls && HlsLib && HlsLib.isSupported()) {
      _hls = new HlsLib({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        enableWorker: true
      });

      _hls.loadSource(directSource.url);
      _hls.attachMedia(_video);

      _hls.on(HlsLib.Events.MANIFEST_PARSED, (event, data) => {
        // Manifest success is NOT media success: keep the stall watchdog
        // armed (re-arm resets the 10 s budget) until actual media data
        // arrives — canplay/loadedmetadata clear it (live repro: master
        // playlist 200 but every segment 403 → parked readyState 0 forever
        // when the watchdog was cleared here).
        _armStallWatchdog();
        _setLoading(false);
        _populateQualityMenu(data.levels || []);
        _populateAudioMenu();
        _restorePlaybackPosition();
        _video.play().catch(() => console.log("[UniversalPlayer] Autoplay prevented, awaiting user gesture."));
      });

      // Sample/preview clip rejection guard for HLS
      _video.addEventListener("loadedmetadata", () => {
        if (_config && _config.mediaType === "movie" && _video.duration > 0 && _video.duration < 720) {
          console.warn(`[UniversalPlayer] HLS stream is only ${_video.duration}s (sample/preview clip detected). Advancing to full movie stream...`);
          if (_nextSourceFallback("HLS sample clip rejected")) return;
        }
      }, { once: true });

      _hls.on(HlsLib.Events.AUDIO_TRACKS_UPDATED, () => {
        _populateAudioMenu();
      });

      _hls.on(HlsLib.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        console.log("[UniversalPlayer] HLS audio track switched to index:", data.id);
        _populateAudioMenu();
      });

      _hls.on(HlsLib.Events.SUBTITLE_TRACKS_UPDATED, () => {
        _populateSubtitlesMenu(config.subtitles || []);
      });

      _hls.on(HlsLib.Events.ERROR, (event, data) => {
        console.warn("[UniversalPlayer] HLS event error:", data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case HlsLib.ErrorTypes.NETWORK_ERROR:
              // Signed-URL CDNs rate-limit aggressively; after one recovery
              // attempt on the same URL, advance to the next quality source.
              if (_nextSourceFallback("HLS fatal network error")) break;
              console.log("[UniversalPlayer] Attempting network recovery...");
              _hls.startLoad();
              // startLoad can loop fatal network errors forever with no next
              // source; re-arm the watchdog so the stuck session still ends
              // in the honest error card.
              _armStallWatchdog();
              break;
            case HlsLib.ErrorTypes.MEDIA_ERROR:
              console.log("[UniversalPlayer] Attempting media recovery...");
              _hls.recoverMediaError();
              // recoverMediaError() can loop fatal demux errors forever;
              // while nothing is decodable at the playhead, keep the stall
              // watchdog armed as the bounded exit.
              if (_stuckWithoutMedia()) _armStallWatchdog();
              break;
            default:
              _hls.destroy();
              if (_nextSourceFallback("HLS fatal error")) break;
              _showError("Unrecoverable streaming error encountered.");
              break;
          }
        }
      });
    } else {
      // Native MP4 or Native Safari HLS
      _video.src = directSource.url;
      _video.addEventListener("loadedmetadata", () => {
        _clearStallWatchdog();
        // Guard against sample / 10-minute preview clips for full movies:
        if (_config && _config.mediaType === "movie" && _video.duration > 0 && _video.duration < 720) {
          console.warn(`[UniversalPlayer] Native stream is only ${_video.duration}s (sample/preview clip detected). Advancing to full movie stream...`);
          if (_nextSourceFallback("Native sample clip rejected")) return;
        }
        _setLoading(false);
        _populateQualityMenu();
        _populateAudioMenu();
        _populateSubtitlesMenu(config.subtitles || []);
        _restorePlaybackPosition();
        _video.play().catch(() => {});
      }, { once: true });
    }

    // Attach external WebVTT subtitles if present in config
    if (Array.isArray(config.subtitles)) {
      _attachExternalSubtitles(config.subtitles);
    }
  }

  // Native language names (upstream caption labels) → ISO-639 codes for
  // <track srclang>; unknown names fall back to "und".
  const LANG_CODE_MAP = {
    "اَلْعَرَبِيَّةُ": "ar", "العربية": "ar",
    "বাংলা": "bn", "English": "en", "Filipino": "fil", "Français": "fr",
    "हिन्दी": "hi", "हिंदी": "hi", "Indonesian": "id", "Malay": "ms",
    "ਪੰਜਾਬੀ": "pa", "Português": "pt", "Русский": "ru", "Kiswahili": "sw",
    "اُردُو": "ur", "中文": "zh", "Español": "es", "Deutsch": "de",
    "日本語": "ja", "한국어": "ko", "தமிழ்": "ta", "తెలుగు": "te",
    "Français (Canada)": "fr",
  };

  // ── Cross-origin mode for external <track> subtitles ─────────────────────
  // The Language Files vault relay host (mirrors the backend's
  // STREAMX_FILESERVER_RELAY default; the frontend has no process.env).
  const VAULT_RELAY_HOST = "p.111477.xyz";

  function _isVaultRelayUrl(url) {
    try {
      const u = new URL(url, location.href);
      return u.hostname === VAULT_RELAY_HOST && u.pathname === "/bulk";
    } catch (e) { return false; }
  }

  function _applyCrossOriginMode(sourceUrl) {
    if (!_video) return;
    if (_isVaultRelayUrl(sourceUrl)) {
      _video.removeAttribute("crossorigin");
    } else {
      _video.crossOrigin = "anonymous";
    }
  }

  function _attachExternalSubtitles(subtitles) {
    // Remove existing tracks
    const existing = _video.querySelectorAll("track");
    existing.forEach(t => t.remove());

    subtitles.forEach((sub, i) => {
      const track = document.createElement("track");
      track.kind = sub.kind || "subtitles";
      track.label = sub.label || `Track ${i + 1}`;
      track.srclang = sub.srclang && sub.srclang !== "und"
        ? sub.srclang
        : (LANG_CODE_MAP[sub.label] || "und");
      // <track> can only render WebVTT. Caption sources come in two
      // probe-verified shapes (2026-10-27):
      //  1. .srt / .vtt by EXTENSION — resolved below without a fetch.
      //  2. EXTENSIONLESS caption API URLs (strem.io subs: /file/<id>,
      //     content-type application/x-subrip) — the extension check alone
      //     mislabels these as VTT and the track silently never renders
      //     (the "subtitles not working" bug). Extensionless sources are
      //     fetched once, sniffed (WEBVTT magic vs SRT cue-numbering) and
      //     converted to a same-origin WebVTT blob, which also bypasses the
      //     video crossorigin constraint for the track resource itself.
      const ext = _subtitleUrlExtension(sub.src);
      if (ext === "srt") {
        _attachFetchedSubAsVtt(track, sub.src);
      } else if (ext === "vtt") {
        track.src = sub.src;
      } else {
        // Unknown / missing extension: fetch + sniff, then convert or attach.
        _attachFetchedSubAsVtt(track, sub.src);
      }
      if (sub.default) track.default = true;
      _video.appendChild(track);
    });

    _populateSubtitlesMenu(subtitles);
  }

  function _subtitleUrlExtension(src) {
    if (!src) return "";
    try {
      const clean = String(src).split("?")[0].split("#")[0];
      const m = clean.toLowerCase().match(/\.([a-z0-9]+)$/);
      return m ? m[1] : "";
    } catch (e) {
      return "";
    }
  }

  // Fetches a caption resource, detects SRT vs WebVTT by CONTENT (extension
  // can lie or be absent, e.g. strem.io /file/<id> endpoints), converts SRT
  // to WebVTT and swaps the track's src to a same-origin blob URL. Keeps the
  // player's existing subtitle menu behaviour and offset controls working.
  function _attachFetchedSubAsVtt(track, captionUrl) {
    fetch(captionUrl, { credentials: "omit" })
      .then(res => {
        if (!res.ok) throw new Error(`caption fetch ${res.status}`);
        return res.text();
      })
      .then(text => {
        const trimmed = String(text).replace(/^\uFEFF/, "").trim();
        let vttText;
        if (/^WEBVTT/.test(trimmed)) {
          vttText = trimmed; // already WebVTT — attach verbatim
        } else if (_looksLikeSrt(trimmed)) {
          vttText = _srtToVtt(trimmed);
        } else {
          // Neither WebVTT nor SRT: honest failure, never a blank track.
          throw new Error("unrecognized caption format (no WEBVTT header, no SRT cue numbering)");
        }
        track.src = URL.createObjectURL(new Blob([vttText], { type: "text/vtt" }));
      })
      .catch(err => {
        console.warn("[UniversalPlayer] caption fetch/convert failed; track will not render:", err.message);
      });
  }

  function _looksLikeSrt(text) {
    if (!text) return false;
    // SRT shapes: sequential trailing numbers before blocks and comma-ms
    // timing lines (00:00:01,234 --> 00:00:02,345). WebVTT uses dots.
    const hasArrow = /-->/.test(text);
    const hasNumbering = /^\s*\d+\s*$/m.test(text);
    const hasCommaTiming = /\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(text);
    return hasArrow && (hasNumbering || hasCommaTiming);
  }

  function _isSrtSource(src) {
    if (!src) return false;
    try {
      const clean = String(src).split("?")[0].split("#")[0];
      return clean.toLowerCase().endsWith(".srt");
    } catch (e) {
      return false;
    }
  }

  // Fetches an SRT caption, converts it to WebVTT and swaps the track's src
  // to a blob URL. Keeps the player's existing subtitle menu behaviour and
  // offset controls working with SRT-only providers.
  function _attachSrtAsVtt(track, srtUrl) {
    fetch(srtUrl)
      .then(res => {
        if (!res.ok) throw new Error(`caption fetch ${res.status}`);
        return res.text();
      })
      .then(srtText => {
        const vttText = _srtToVtt(srtText);
        track.src = URL.createObjectURL(new Blob([vttText], { type: "text/vtt" }));
      })
      .catch(err => {
        console.warn("[UniversalPlayer] SRT→VTT conversion failed; subtitle track will not render:", err.message);
      });
  }

  function _srtToVtt(srtText) {
    // Strip BOM, normalise line endings
    const body = String(srtText).replace(/^\uFEFF/, "").replace(/\r+/g, "");
    const blocks = body.split(/\n{2,}/).filter(b => b.trim());
    const cues = [];

    for (const block of blocks) {
      const lines = block.split("\n");
      const timeLineIdx = lines.findIndex(l => l.includes("-->"));
      if (timeLineIdx < 1) continue; // expect index line above the timestamp
      const timeLine = lines[timeLineIdx];
      const timing = timeLine.split("-->");
      if (timing.length !== 2) continue;
      // SRT uses a comma for milliseconds; WebVTT requires a dot.
      const start = timing[0].trim().replace(/,/g, ".");
      // Drop any trailing cue settings (position:, align:, ...) from the end timestamp
      const end = timing[1].trim().split(/\s+/)[0].replace(/,/g, ".");
      const text = lines.slice(timeLineIdx + 1).join("\n").trim();
      if (!text) continue;
      cues.push(`${start} --> ${end}\n${text}\n`);
    }

    return `WEBVTT\n\n${cues.join("\n")}`;
  }

  // ── Gestures: Long-Press 2× Speed & Double-Tap Seek ─────────────────────────
  function _bindGestureListeners() {
    const root = document.getElementById("sx-player-root");
    if (!root) return;

    // Pointer Down (Touch / Mouse)
    root.addEventListener("pointerdown", (e) => {
      // Ignore if clicking interactive controls
      if (e.target.closest(".sx-btn-icon, .sx-scrub-wrap, .sx-menu-panel, .sx-volume-slider, .sx-error-retry-btn")) {
        return;
      }

      _pointerStartX = e.clientX;
      _pointerStartY = e.clientY;

      // Handle Double-Tap Seek detection
      const now = Date.now();
      const rect = root.getBoundingClientRect();
      const isRightSide = (e.clientX - rect.left) > (rect.width / 2);

      if (now - _lastTapTime < 300) {
        // Double tap confirmed!
        clearTimeout(_longPressTimer);
        _cancelLongPress();
        if (isRightSide) {
          seekRelative(10);
          _triggerRipple("right");
        } else {
          seekRelative(-10);
          _triggerRipple("left");
        }
        _lastTapTime = 0;
        return;
      }
      _lastTapTime = now;

      // Start Long-Press 2× Timer (threshold 350ms)
      clearTimeout(_longPressTimer);
      _longPressTimer = setTimeout(() => {
        _activateLongPress2x();
      }, 350);
    });

    // Pointer Move: Cancel long press if user is scrolling or dragging
    root.addEventListener("pointermove", (e) => {
      _showControlsBriefly();
      if (_longPressTimer || _isLongPressing) {
        const dx = Math.abs(e.clientX - _pointerStartX);
        const dy = Math.abs(e.clientY - _pointerStartY);
        if (dx > 18 || dy > 18) {
          clearTimeout(_longPressTimer);
          if (_isLongPressing) _cancelLongPress();
        }
      }
    });

    // Pointer Up / Cancel / Leave: Restore previous playback rate
    const cancelEvents = ["pointerup", "pointercancel", "pointerleave"];
    cancelEvents.forEach(evt => {
      root.addEventListener(evt, () => {
        clearTimeout(_longPressTimer);
        if (_isLongPressing) {
          _cancelLongPress();
        }
      });
    });

    // Suppress context menu on long-press
    root.addEventListener("contextmenu", (e) => {
      if (_isLongPressing) {
        e.preventDefault();
      }
    });

    // Click on video toggles controls or play
    root.addEventListener("click", (e) => {
      if (e.target.closest(".sx-btn-icon, .sx-scrub-wrap, .sx-menu-panel, .sx-volume-slider, .sx-error-retry-btn")) {
        return;
      }
      _closeAllMenus();
      const overlay = document.getElementById("sx-controls-overlay");
      if (overlay) {
        const isHidden = overlay.classList.contains("autohide");
        if (isHidden) {
          _showControlsBriefly();
        } else {
          // If controls visible on mobile, toggle play
          togglePlay();
        }
      }
    });
  }

  function _activateLongPress2x() {
    if (!_video || _video.paused) return;
    _isLongPressing = true;
    _savedNormalSpeed = _video.playbackRate || 1.0;
    _video.playbackRate = 2.0;

    const badge = document.getElementById("sx-speed-badge");
    if (badge) badge.classList.add("visible");
    console.log("[UniversalPlayer] Long-press 2× speed engaged. Prior rate was:", _savedNormalSpeed);
  }

  function _cancelLongPress() {
    if (!_isLongPressing) return;
    _isLongPressing = false;
    if (_video) {
      _video.playbackRate = _savedNormalSpeed || 1.0;
    }
    const badge = document.getElementById("sx-speed-badge");
    if (badge) badge.classList.remove("visible");
    console.log("[UniversalPlayer] Long-press 2× released. Restored rate:", _savedNormalSpeed);
  }

  function _triggerRipple(side) {
    const el = document.getElementById(side === "right" ? "sx-ripple-right" : "sx-ripple-left");
    if (el) {
      el.classList.add("active");
      setTimeout(() => el.classList.remove("active"), 450);
    }
  }

  // ── Keyboard Shortcuts (Desktop) ─────────────────────────────────────────────
  function _bindKeyboardShortcuts() {
    _boundKeyHandler = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (!_container || !_video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekRelative(-10);
          _triggerRipple("left");
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekRelative(10);
          _triggerRipple("right");
          break;
        case "arrowup":
          e.preventDefault();
          setVolume(Math.min(1, (_video.volume || 1) + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume(Math.max(0, (_video.volume || 1) - 0.1));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          togglePip();
          break;
        case "a":
          e.preventDefault();
          cycleAspectRatio();
          break;
        case "2":
          e.preventDefault();
          _video.playbackRate = _video.playbackRate === 2 ? 1 : 2;
          _showToast(`Speed: ${_video.playbackRate}×`);
          break;
      }
      _showControlsBriefly();
    };

    window.addEventListener("keydown", _boundKeyHandler);
  }

  // ── Aspect Ratio & Stretch Modes ────────────────────────────────────────────
  function cycleAspectRatio() {
    const root = document.getElementById("sx-player-root");
    if (!root) return;

    const current = root.getAttribute("data-aspect") || "contain";
    const nextIdx = (ASPECT_MODES.indexOf(current) + 1) % ASPECT_MODES.length;
    const nextMode = ASPECT_MODES[nextIdx];

    setAspectRatio(nextMode);
  }

  function setAspectRatio(mode) {
    const root = document.getElementById("sx-player-root");
    if (!root || !ASPECT_MODES.includes(mode)) return;

    root.setAttribute("data-aspect", mode);
    localStorage.setItem("streamx_player_aspect", mode);

    const labels = {
      contain: "Contain (Fit 16:9)",
      cover: "Cover (Crop / Zoom)",
      stretch: "Stretch to Fill (Distorted)",
      original: "Original (1:1 Native)"
    };

    _showToast(`Aspect Ratio: ${labels[mode]}`);
    console.log(`[UniversalPlayer] Aspect ratio set to '${mode}'`);
  }

  // ── Quality, Audio & Subtitles Menus ────────────────────────────────────────
  function _populateQualityMenu(levels) {
    const menu = document.getElementById("sx-menu-quality");
    if (!menu) return;

    // 1. Adaptive HLS rendition levels (when manifest provides multivariant levels)
    if (_hls && levels && levels.length > 1) {
      let html = `<div class="sx-menu-header">Quality Renditions</div>`;
      html += `<button class="sx-menu-item ${_hls.currentLevel === -1 ? "active" : ""}" onclick="UniversalPlayer.setQuality(-1)">Auto (Adaptive)</button>`;

      levels.forEach((lvl, idx) => {
        const label = lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`;
        const isSel = _hls.currentLevel === idx;
        html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.setQuality(${idx})">${label}</button>`;
      });

      menu.innerHTML = html;
      return;
    }

    // 2. Discrete Extractor Quality Streams (when scrapers return discrete 4K, 1080p, 720p, 480p sources)
    const sources = (_config && _config.sources) || [];
    const qualityVariants = [];
    const seenQualities = new Set();
    sources.forEach((s, idx) => {
      const q = s.quality || "";
      if (q && !seenQualities.has(q)) {
        seenQualities.add(q);
        qualityVariants.push({
          idx,
          quality: q,
          isActive: idx === _sourceIndex
        });
      }
    });

    if (qualityVariants.length > 1) {
      let html = `<div class="sx-menu-header">Available Stream Qualities</div>`;
      qualityVariants.forEach(v => {
        html += `<button class="sx-menu-item ${v.isActive ? "active" : ""}" onclick="UniversalPlayer.switchQualitySource(${v.idx})">
          <span style="font-weight:600;">${_esc(v.quality)}</span>
        </button>`;
      });
      menu.innerHTML = html;
      return;
    }

    // 3. Single default quality
    const curQual = sources[_sourceIndex]?.quality || "Source Default";
    menu.innerHTML = `
      <div class="sx-menu-header">Quality</div>
      <div class="sx-menu-item active">${_esc(curQual)} (Auto)</div>
      <div style="font-size:11px; color:#8a96a3; padding:4px 8px;">Single quality rendition provided by upstream server.</div>
    `;
  }

  function switchQualitySource(idx) {
    if (_switchToSourceIndex(idx)) {
      _populateQualityMenu();
      _populateServersMenu();
      _closeAllMenus();
      const sources = (_config && _config.sources) || [];
      const q = sources[idx]?.quality || `Source ${idx + 1}`;
      _showToast(`Quality switched to ${q}`);
    }
  }

  function setQuality(levelIdx) {
    if (_hls && _hls.levels && _hls.levels.length > 0) {
      _hls.currentLevel = levelIdx;
      _populateQualityMenu(_hls.levels);
      _closeAllMenus();
      const label = levelIdx === -1 ? "Auto" : (_hls.levels[levelIdx]?.height ? `${_hls.levels[levelIdx].height}p` : `Level ${levelIdx}`);
      _showToast(`Quality set to ${label}`);
    } else {
      switchQualitySource(levelIdx);
    }
  }

  function _populateAudioMenu() {
    const menu = document.getElementById("sx-menu-audio");
    const audioBtn = document.getElementById("sx-btn-audio");
    if (!menu) return;

    let tracks = [];
    if (_hls && _hls.audioTracks && _hls.audioTracks.length > 0) {
      tracks = _hls.audioTracks;
    } else if (_video && _video.audioTracks && _video.audioTracks.length > 0) {
      tracks = Array.from(_video.audioTracks);
    }

    if (audioBtn) {
      // Always visible: the menu reports available audio tracks or language streams
      audioBtn.style.display = "flex";
    }

    let html = `<div class="sx-menu-header">Audio Tracks</div>`;

    const sources = (_config && _config.sources) || [];
    // Detect multi-language streams in sources
    const languageVariants = [];
    sources.forEach((s, idx) => {
      let lang = s.language;
      if (!lang && s.title) {
        const m = s.title.match(/\b(telugu|hindi|tamil|kannada|malayalam|english|bengali|marathi|multi)\b/i);
        if (m) lang = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      }
      if (lang) {
        languageVariants.push({
          idx,
          language: lang,
          title: s.title || `${lang} Stream`,
          quality: s.quality || "",
          isActive: idx === _sourceIndex
        });
      }
    });

    let renderedSection = false;

    // 1. Language Streams: if multiple sources carry different languages
    if (languageVariants.length > 1) {
      renderedSection = true;
      html += `<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; padding:6px 12px 3px;">Language Streams</div>`;
      languageVariants.forEach(v => {
        const isSel = v.isActive;
        const qBadge = v.quality ? `<span style="font-size:10px; opacity:0.75; margin-left:6px; background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:3px;">${_esc(v.quality)}</span>` : "";
        html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.switchAudioSource(${v.idx})">
          <span style="font-weight:600;">${_esc(v.language)}</span>${qBadge}
        </button>`;
      });
    }

    // 2. Container/HLS Audio Tracks: if manifest/mp4 declares internal alternate audio tracks
    if (tracks.length > 1) {
      renderedSection = true;
      if (languageVariants.length > 1) {
        html += `<div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; padding:8px 12px 3px; border-top:1px solid rgba(255,255,255,0.08); margin-top:4px;">Embedded Audio Tracks</div>`;
      }
      tracks.forEach((track, idx) => {
        const isSel = _hls ? _hls.audioTrack === idx : track.enabled;
        const name = track.name || track.label || track.lang || `Audio Track ${idx + 1}`;
        html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.setAudioTrack(${idx})">${_esc(name)}</button>`;
      });
    }

    // 3. Fallback: single muxed audio track notice
    if (!renderedSection) {
      const srcMeta = sources[_sourceIndex];
      const upstreamLang = srcMeta && srcMeta.language
        ? srcMeta.language
        : (srcMeta && Array.isArray(srcMeta.audioTracks) && srcMeta.audioTracks.length > 0
            ? (srcMeta.audioTracks[0].label || srcMeta.audioTracks[0].language)
            : null);
      html += `<div class="sx-menu-item active">${upstreamLang ? "1 Track: " + _esc(upstreamLang) + " (Original)" : "1 Track: Original Audio"}</div>`;
      html += `<div style="font-size:11px; color:#8a96a3; padding:4px 8px;">This source carries a single muxed audio track — no alternate language tracks detected in this stream.</div>`;
    }

    menu.innerHTML = html;
  }

  function switchAudioSource(idx) {
    const sources = (_config && _config.sources) || [];
    const targetSource = sources[idx];
    if (targetSource && targetSource.language) {
      localStorage.setItem("streamx_audio_lang", targetSource.language);
    }
    if (_switchToSourceIndex(idx)) {
      _populateAudioMenu();
      _populateServersMenu();
      _closeAllMenus();
      const langName = targetSource?.language || `Source ${idx + 1}`;
      _showToast(`Audio Language: ${langName}`);
    }
  }

  function setAudioTrack(trackIdx) {
    if (_hls && _hls.audioTracks && _hls.audioTracks.length > trackIdx) {
      _hls.audioTrack = trackIdx;
      _populateAudioMenu();
      _closeAllMenus();
      const track = _hls.audioTracks[trackIdx];
      const name = track?.name || track?.label || track?.lang || `Audio Track ${trackIdx + 1}`;
      _showToast(`Audio Track: ${name}`);
    } else if (_video && _video.audioTracks && _video.audioTracks.length > trackIdx) {
      for (let i = 0; i < _video.audioTracks.length; i++) {
        _video.audioTracks[i].enabled = (i === trackIdx);
      }
      _populateAudioMenu();
      _closeAllMenus();
      const track = _video.audioTracks[trackIdx];
      const name = track?.label || track?.language || `Audio Track ${trackIdx + 1}`;
      _showToast(`Audio Track: ${name}`);
    }
  }

  function _populateSubtitlesMenu(externalSubs = []) {
    const menu = document.getElementById("sx-menu-subs");
    const subBtn = document.getElementById("sx-btn-subs");
    if (!menu) return;

    // External and internal tracks
    const tracks = _video ? Array.from(_video.textTracks) : [];
    const hasSubs = tracks.length > 0 || (Array.isArray(externalSubs) && externalSubs.length > 0);
    if (subBtn) {
      subBtn.style.display = hasSubs ? "flex" : "none";
    }

    let html = `<div class="sx-menu-header">Subtitles</div>`;
    html += `<button class="sx-menu-item" onclick="UniversalPlayer.setSubtitleTrack(-1)">Off</button>`;

    tracks.forEach((t, idx) => {
      const isSel = t.mode === "showing";
      html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.setSubtitleTrack(${idx})">${_esc(t.label || t.language || "Subtitle " + (idx + 1))}</button>`;
    });

    // Subtitle Sync Offset Slider
    html += `
      <div class="sx-sync-slider-row">
        <div class="sx-sync-label-row">
          <span>Timing Sync Offset:</span>
          <span id="sx-sync-val">${_subtitleOffsetSeconds >= 0 ? "+" : ""}${_subtitleOffsetSeconds.toFixed(1)}s</span>
        </div>
        <input type="range" min="-5" max="5" step="0.5" value="${_subtitleOffsetSeconds}" style="width:100%; cursor:pointer;" oninput="UniversalPlayer.setSubtitleOffset(parseFloat(this.value))">
      </div>
    `;

    menu.innerHTML = html;
  }

  function setSubtitleTrack(trackIdx) {
    if (!_video) return;
    const tracks = _video.textTracks;

    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = (i === trackIdx) ? "showing" : "disabled";
    }

    _populateSubtitlesMenu();
    _closeAllMenus();
    _showToast(trackIdx === -1 ? "Subtitles Off" : `Subtitles: ${tracks[trackIdx]?.label || "Enabled"}`);
  }

  function setSubtitleOffset(seconds) {
    _subtitleOffsetSeconds = seconds;
    const label = document.getElementById("sx-sync-val");
    if (label) label.textContent = `${seconds >= 0 ? "+" : ""}${seconds.toFixed(1)}s`;

    // Apply offset to active cues if supported
    if (_video) {
      Array.from(_video.textTracks).forEach(track => {
        if (track.cues) {
          // Track cues dynamic adjust
        }
      });
    }
  }


  function _populateSettingsMenu() {
    const menu = document.getElementById("sx-menu-settings");
    if (!menu) return;

    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentRate = _video ? _video.playbackRate : 1.0;

    let html = `<div class="sx-menu-header">Playback Speed</div>`;
    rates.forEach(rate => {
      const isSel = Math.abs(currentRate - rate) < 0.05;
      html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.setSpeed(${rate})">${rate}×</button>`;
    });

    html += `<div class="sx-menu-header" style="margin-top:8px;">Aspect Ratio</div>`;
    ASPECT_MODES.forEach(mode => {
      const cur = document.getElementById("sx-player-root")?.getAttribute("data-aspect") || "contain";
      const isSel = cur === mode;
      html += `<button class="sx-menu-item ${isSel ? "active" : ""}" onclick="UniversalPlayer.setAspectRatio('${mode}')">${mode.toUpperCase()}</button>`;
    });

    menu.innerHTML = html;
  }

  function setSpeed(rate) {
    if (_video) {
      _video.playbackRate = rate;
      _savedNormalSpeed = rate;
      _closeAllMenus();
      _showToast(`Speed: ${rate}×`);
    }
  }

  function toggleMenu(menuKey) {
    const menuEl = document.getElementById(`sx-menu-${menuKey}`);
    if (!menuEl) return;

    const isOpen = menuEl.classList.contains("open");
    _closeAllMenus();

    if (!isOpen) {
      if (menuKey === "settings") _populateSettingsMenu();
      menuEl.classList.add("open");
      _activeMenu = menuKey;
    }
  }

  function _closeAllMenus() {
    document.querySelectorAll(".sx-menu-panel").forEach(m => m.classList.remove("open"));
    _activeMenu = null;
  }

  // ── Video Controls Methods ──────────────────────────────────────────────────
  function togglePlay() {
    if (!_video) return;
    if (_video.paused) {
      _video.play().catch(() => {});
      _flashCenterIcon("play");
    } else {
      _video.pause();
      _flashCenterIcon("pause");
    }
  }

  function seekRelative(seconds) {
    if (!_video) return;
    _video.currentTime = Math.max(0, Math.min(_video.duration || 0, _video.currentTime + seconds));
  }

  function setVolume(val) {
    if (!_video) return;
    _video.volume = Math.max(0, Math.min(1, val));
    _video.muted = (_video.volume === 0);
    _updateVolumeIcon();
    const slider = document.getElementById("sx-volume-slider");
    if (slider) slider.value = _video.volume;
  }

  function toggleMute() {
    if (!_video) return;
    _video.muted = !_video.muted;
    _updateVolumeIcon();
  }

  function togglePip() {
    if (!_video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (_video.requestPictureInPicture) {
      _video.requestPictureInPicture().catch(() => _showToast("PiP not supported for this source"));
    }
  }

  function toggleFullscreen() {
    const root = document.getElementById("sx-player-root");
    if (!root) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (root.requestFullscreen) root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  // ── UI Updates & Scrubbing ──────────────────────────────────────────────────
  function _onTimeUpdate() {
    if (!_video || !_video.duration) return;
    const cur = _video.currentTime;
    const dur = _video.duration;
    const pct = (cur / dur) * 100;

    const fill = document.getElementById("sx-scrub-fill");
    const handle = document.getElementById("sx-scrub-handle");
    const timeDisp = document.getElementById("sx-time-display");

    if (fill) fill.style.width = `${pct}%`;
    if (handle) handle.style.left = `${pct}%`;
    if (timeDisp) timeDisp.textContent = `${_fmtTime(cur)} / ${_fmtTime(dur)}`;

    // Debounced persist position
    if (_resumeKey && Math.floor(cur) % 5 === 0) {
      localStorage.setItem(_resumeKey, Math.floor(cur));
    }
  }

  function _onBufferProgress() {
    if (!_video || !_video.duration) return;
    const buffer = document.getElementById("sx-scrub-buffer");
    if (!buffer) return;

    if (_video.buffered.length > 0) {
      const bufferedEnd = _video.buffered.end(_video.buffered.length - 1);
      const pct = (bufferedEnd / _video.duration) * 100;
      buffer.style.width = `${pct}%`;
    }
  }

  function _onScrubClick(e) {
    if (!_video || !_video.duration) return;
    const track = document.getElementById("sx-scrub-track");
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _video.currentTime = pos * _video.duration;
  }

  function _onScrubHover(e) {
    if (!_video || !_video.duration) return;
    const track = document.getElementById("sx-scrub-track");
    const tip = document.getElementById("sx-scrub-tooltip");
    if (!track || !tip) return;

    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * _video.duration;

    tip.style.left = `${pos * 100}%`;
    tip.textContent = _fmtTime(time);
  }

  function _updatePlayButton(isPlaying) {
    const icon = document.getElementById("sx-icon-play");
    if (!icon) return;
    icon.innerHTML = isPlaying
      ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`
      : `<path d="M8 5v14l11-7z"/>`;
  }

  function _updateVolumeIcon() {
    const icon = document.getElementById("sx-icon-vol");
    if (!icon || !_video) return;

    if (_video.muted || _video.volume === 0) {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
    } else {
      icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
    }
  }

  function _flashCenterIcon(type) {
    const wrap = document.getElementById("sx-center-indicator");
    const icon = document.getElementById("sx-center-icon");
    if (!wrap || !icon) return;

    icon.innerHTML = type === "play"
      ? `<path d="M8 5v14l11-7z"/>`
      : `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;

    wrap.classList.add("flash");
    setTimeout(() => wrap.classList.remove("flash"), 400);
  }

  function _showControlsBriefly() {
    const overlay = document.getElementById("sx-controls-overlay");
    if (!overlay) return;

    overlay.classList.remove("autohide");
    clearTimeout(_controlsHideTimer);

    if (_video && !_video.paused) {
      _controlsHideTimer = setTimeout(() => {
        if (!_activeMenu) {
          overlay.classList.add("autohide");
        }
      }, 3500);
    }
  }

  function _setLoading(isLoading) {
    const loader = document.getElementById("sx-loading-overlay");
    if (loader) {
      loader.classList.toggle("visible", isLoading);
    }
  }

  function _showError(msg) {
    const screen = document.getElementById("sx-error-screen");
    const msgEl = document.getElementById("sx-error-msg");
    if (screen && msgEl) {
      // Vault-verify CTA is per-error-render: drop any stale one so a later
      // NON-vault error never shows a leftover verify button.
      screen.querySelectorAll("[data-vault-verify-btn]").forEach((b) => b.remove());
      msgEl.textContent = msg;
      screen.classList.add("visible");
      // The loading spinner must not keep spinning behind the error card.
      _setLoading(false);
    }
  }

  function retry() {
    const screen = document.getElementById("sx-error-screen");
    if (screen) screen.classList.remove("visible");
    // Preferred retry path: let the host re-resolve fresh sources (signed
    // direct URLs expire — TTL ~1h). Falls back to reloading the in-memory
    // source when no onRetry hook was provided.
    if (typeof _config?.onRetry === "function") {
      try {
        _config.onRetry();
      } catch (e) {
        console.warn("[UniversalPlayer] onRetry hook failed; reloading current source:", e.message);
        _video?.load();
      }
      return;
    }
    if (_video && _currentSource) {
      _video.load();
      _video.play().catch(() => {});
    }
  }

  function switchToEmbedded() {
    if (window.Player && typeof window.Player.switchPlaybackMode === "function") {
      window.Player.switchPlaybackMode("embed");
    } else {
      const embedTab = document.querySelector('[onclick*="switchPlaybackMode(\'embed\')"]') || document.querySelector('[data-mode="embed"]');
      if (embedTab) embedTab.click();
    }
  }

  function _restorePlaybackPosition() {
    if (!_resumeKey || !_video) return;
    const saved = localStorage.getItem(_resumeKey);
    if (saved) {
      const pos = parseFloat(saved);
      if (pos > 10 && (!pos.duration || pos < pos.duration - 30)) {
        _video.currentTime = pos;
        _showToast(`Resumed from ${_fmtTime(pos)}`);
      }
    }
  }

  function _restorePreferences() {
    const savedAspect = localStorage.getItem("streamx_player_aspect");
    if (savedAspect) {
      setAspectRatio(savedAspect);
    }
  }

  function _showToast(text) {
    const root = document.getElementById("sx-player-root");
    if (!root) return;

    let toast = document.getElementById("sx-player-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sx-player-toast";
      toast.style.cssText = `
        position:absolute; bottom:65px; left:20px;
        background:rgba(15,17,23,0.9); backdrop-filter:blur(8px);
        color:#fff; padding:6px 14px; border-radius:6px;
        font-size:12px; font-weight:600; z-index:55;
        opacity:0; transition:opacity 0.2s ease; pointer-events:none;
        border:1px solid rgba(255,255,255,0.15);
      `;
      root.appendChild(toast);
    }

    toast.textContent = text;
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
    }, 2000);
  }

  function _fmtTime(sec) {
    if (isNaN(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function _esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Destroys current player instance, detaches listeners, releases memory.
   */
  function destroy() {
    clearTimeout(_longPressTimer);
    clearTimeout(_controlsHideTimer);

    if (_boundKeyHandler) {
      window.removeEventListener("keydown", _boundKeyHandler);
      _boundKeyHandler = null;
    }

    if (_hls) {
      _hls.destroy();
      _hls = null;
    }

    if (_video) {
      _video.pause();
      _video.removeAttribute("src");
      _video.load();
      _video = null;
    }

    if (_container) {
      _container.innerHTML = "";
    }

    _currentSource = null;
    _config = null;
    _activeMenu = null;
    _isLongPressing = false;
  }

  return {
    mount,
    destroy,
    play: () => _video?.play(),
    pause: () => _video?.pause(),
    togglePlay,
    seekRelative,
    setVolume,
    toggleMute,
    setSpeed,
    cycleAspectRatio,
    setAspectRatio,
    setQuality,
    setAudioTrack,
    setSubtitleTrack,
    setSubtitleOffset,
    toggleMenu,
    togglePip,
    toggleFullscreen,
    retry,
    switchSource,
    switchAudioSource,
    switchQualitySource,
    switchServer,
    switchToEmbedded,
    getAudioTracks: () => (_hls?.audioTracks || []),
    getSources: () => ((_config && _config.sources) || []),
    isMounted: () => Boolean(_video)
  };
})();

window.UniversalPlayer = UniversalPlayer;
