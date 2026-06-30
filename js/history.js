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
  function recordWatch(item, season = null, episode = null) {
    const list = _load(WATCH_KEY).filter(
      i => !(i.id === item.id && i.media === item.media)
    );
    list.unshift({
    id        : item.id,
    media     : item.media,
    title     : item.title,
    year      : item.year,
    poster    : item.poster,
    rating    : item.rating,

    season,
    episode,

    progress  : 0,      // watched seconds
    duration  : 0,      // total seconds

    watchedAt : Date.now(),
});
    _save(WATCH_KEY, list);
  }

  function getWatchHistory()     { return _load(WATCH_KEY); }
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

  function getRecentlyViewed()  { return _load(RECENT_KEY); }
  function clearRecentlyViewed(){ _save(RECENT_KEY, []); }

  // Last watched season/episode for a TV show
  function getLastEpisode(id) {
    const entry = _load(WATCH_KEY).find(i => i.id === id && i.media === "tv");
    return entry ? { season: entry.season, episode: entry.episode } : null;
  }

  return {
    recordWatch,
    getWatchHistory,
    clearWatchHistory,
    removeFromWatch,
    recordView,
    getRecentlyViewed,
    clearRecentlyViewed,
    getLastEpisode,
  };
})();