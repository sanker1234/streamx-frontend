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
    const targetId = String(item.id);
    const list = _load(WATCH_KEY).filter(
      i => !( (String(i.id) === targetId || String(i.animeId) === targetId) && _mediaMatches(i.media, item.media) && (!normAudio || i.audio === normAudio) )
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

  function _idsMatch(id1, id2) {
    if (id1 == null || id2 == null) return false;
    const s1 = String(id1).trim();
    const s2 = String(id2).trim();
    if (s1 === s2) return true;
    const clean1 = s1.replace(/^(tmdb|anilist|mal|imdb)-/i, "");
    const clean2 = s2.replace(/^(tmdb|anilist|mal|imdb)-/i, "");
    return clean1 === clean2;
  }

  function _mediaMatches(m1, m2) {
    if (!m1 || !m2) return true;
    const a = String(m1).toLowerCase();
    const b = String(m2).toLowerCase();
    if (a === b) return true;
    const movieSet = new Set(["movie", "movies", "film", "films"]);
    if (movieSet.has(a) && movieSet.has(b)) return true;
    const tvSet = new Set(["tv", "series", "show", "shows", "drama", "kdrama"]);
    if (tvSet.has(a) && tvSet.has(b)) return true;
    const animeSet = new Set(["anime", "donghua"]);
    if (animeSet.has(a) && animeSet.has(b)) return true;
    return false;
  }

  function removeFromWatch(id, media) {
    _save(WATCH_KEY, _load(WATCH_KEY).filter(i => {
      const matchId = _idsMatch(i.id, id) || _idsMatch(i.animeId, id);
      if (!matchId) return true;
      if (media && i.media && !_mediaMatches(i.media, media)) return true;
      return false;
    }));
  }

  // ── Recently Viewed (detail modal views) ─────────────────────────────
  function recordView(item) {
    const list = _load(RECENT_KEY).filter(
      i => !( (_idsMatch(i.id, item.id) || _idsMatch(i.animeId, item.id)) && _mediaMatches(i.media, item.media) )
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
    _save(RECENT_KEY, _load(RECENT_KEY).filter(i => {
      const matchId = _idsMatch(i.id, id) || _idsMatch(i.animeId, id);
      if (!matchId) return true;
      if (media && i.media && !_mediaMatches(i.media, media)) return true;
      return false;
    }));
  }

  function clearHistory() {
    clearWatchHistory();
    clearRecentlyViewed();
    try {
      localStorage.removeItem(WATCH_KEY);
      localStorage.removeItem(RECENT_KEY);
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("history:change")); } catch (_) {}
  }

  // Last watched season/episode for a TV show or anime
  function getLastEpisode(id, audio = null) {
    const targetId = String(id);
    const normAudio = audio ? String(audio).toUpperCase().replace("-", "_") : null;
    const entry = _load(WATCH_KEY).find(i => 
      (String(i.id) === targetId || String(i.animeId) === targetId) &&
      (i.media === "tv" || i.media === "series" || i.media === "anime" || i.media === "donghua") &&
      (!normAudio || i.audio === normAudio)
    );
    return entry ? { season: entry.season, episode: entry.episode, provider: entry.provider, audio: entry.audio, progress: entry.progress || entry.position || 0 } : null;
  }

  function updateProgress(id, media, progress, duration, season = null, episode = null, provider = null, audio = null) {
    const targetId = String(id);
    const normAudio = audio ? String(audio).toUpperCase().replace("-", "_") : null;
    const list = _load(WATCH_KEY);
    let entry = list.find(i => (String(i.id) === targetId || String(i.animeId) === targetId) && _mediaMatches(i.media, media) && (!normAudio || i.audio === normAudio));
    if (!entry) {
      entry = list.find(i => (String(i.id) === targetId || String(i.animeId) === targetId) && _mediaMatches(i.media, media));
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
    recordProgress: (item, cur, dur) => {
      if (item && item.id) updateProgress(item.id, item.media, cur, dur);
    },
    clearHistory,
    getProgress,
  };
})();

window.StreamXHistory = History;
window.CineJoyHistory = History;
if (typeof module !== "undefined" && module.exports) {
  module.exports = History;
}