/**
 * StreamX v2 — history.js
 * Tracks Continue Watching and Recently Viewed in localStorage.
 * Stores only IDs + minimal metadata + watch progress.
 */

const History = (() => {
  const WATCH_KEY  = "streamx_v2_watch_history";
  const RECENT_KEY = "streamx_v2_recent";
  const MAX        = APP_CONFIG.history_limit;

  function _load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }
  function _save(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, MAX))); } catch {}
    window.dispatchEvent(new CustomEvent("history:change"));
  }

  // ── Continue Watching ─────────────────────────────────────────────────
  // Called when user opens the player modal and picks a server
  function recordWatch(item, season = null, episode = null, provider = null, audio = null) {
    const normAudio = audio ? String(audio).toUpperCase().replace("-", "_") : null;
    const list = _load(WATCH_KEY).filter(
      i => !(i.id === item.id && i.media === item.media && (!normAudio || i.audio === normAudio))
    );
    list.unshift({
      id        : item.id,
      animeId   : item.id,
      media     : item.media,
      title     : item.title,
      year      : item.year,
      poster    : item.poster,
      rating    : item.rating,

      season,
      episode,
      provider  : provider || null,
      audio     : normAudio,

      progress  : 0,      // watched seconds
      position  : 0,      // standardized position
      duration  : 0,      // total seconds

      watchedAt : Date.now(),
    });
    _save(WATCH_KEY, list);
  }

  function _cleanList(list) {
    return (list || []).filter(i => {
      const m = (i.media || "").toLowerCase();
      return m !== "manga" && m !== "manhwa" && m !== "manhua";
    });
  }

  function getWatchHistory()     { return _cleanList(_load(WATCH_KEY)); }
  function clearWatchHistory()   { _save(WATCH_KEY, []); }

  function removeFromWatch(id, media) {
    _save(WATCH_KEY, _load(WATCH_KEY).filter(i => !(i.id === id && i.media === media)));
  }

  // ── Recently Viewed (detail modal views) ─────────────────────────────
  function recordView(item) {
    const list = _load(RECENT_KEY).filter(
      i => !(i.id === item.id && i.media === item.media)
    );
    list.unshift({
      id      : item.id,
      media   : item.media,
      title   : item.title,
      year    : item.year,
      poster  : item.poster,
      rating  : item.rating,
      viewedAt: Date.now(),
    });
    _save(RECENT_KEY, list);
  }

  function getRecentlyViewed()  { return _cleanList(_load(RECENT_KEY)); }
  function clearRecentlyViewed(){ _save(RECENT_KEY, []); }

  function removeFromRecent(id, media) {
    _save(RECENT_KEY, _load(RECENT_KEY).filter(i => !(i.id === id && i.media === media)));
  }

  // Last watched season/episode for a TV show or anime
  function getLastEpisode(id, audio = null) {
    const normAudio = audio ? String(audio).toUpperCase().replace("-", "_") : null;
    const entry = _load(WATCH_KEY).find(i => 
      i.id === id && (i.media === "tv" || i.media === "anime") && (!normAudio || i.audio === normAudio)
    );
    return entry ? { season: entry.season, episode: entry.episode, provider: entry.provider, audio: entry.audio, progress: entry.progress || entry.position || 0 } : null;
  }

  function updateProgress(id, media, progress, duration, season = null, episode = null, provider = null, audio = null) {
    const normAudio = audio ? String(audio).toUpperCase().replace("-", "_") : null;
    const list = _load(WATCH_KEY);
    let entry = list.find(i => i.id === id && i.media === media && (!normAudio || i.audio === normAudio));
    if (!entry) {
      entry = list.find(i => i.id === id && i.media === media);
    }
    if (entry) {
      entry.progress = progress;
      entry.position = progress;
      entry.duration = duration;
      if (season !== null) entry.season = season;
      if (episode !== null) entry.episode = episode;
      if (provider !== null) entry.provider = provider;
      if (normAudio !== null) entry.audio = normAudio;
      entry.watchedAt = Date.now();
      _save(WATCH_KEY, list);
    }
  }

  function getProgress(id, media) {
    const entry = _load(WATCH_KEY).find(i => i.id === id && i.media === media);
    return entry ? { progress: entry.progress, duration: entry.duration } : null;
  }

  return {
    recordWatch,
    getWatchHistory,
    clearWatchHistory,
    removeFromWatch,
    recordView,
    getRecentlyViewed,
    clearRecentlyViewed,
    removeFromRecent,
    getLastEpisode,
    updateProgress,
    getProgress,
  };
})();

window.StreamXHistory = History;