/**
 * StreamX v2 — watchlist.js
 * Manages the user's watchlist in localStorage.
 * Stores only IDs + minimal metadata so TMDB is always the source of truth.
 */

const Watchlist = (() => {
  const KEY = "streamx_v2_watchlist";

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }
  function _save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
    _dispatchChange();
  }
  function _dispatchChange() {
    window.dispatchEvent(new CustomEvent("watchlist:change", { detail: getAll() }));
  }

  function _mediaMatches(m1, m2) {
    if (!m1 || !m2) return true;
    const a = String(m1).toLowerCase();
    const b = String(m2).toLowerCase();
    if (a === b) return true;
    const tvSet = new Set(["tv", "series", "show", "shows", "drama", "kdrama"]);
    if (tvSet.has(a) && tvSet.has(b)) return true;
    const animeSet = new Set(["anime", "donghua"]);
    if (animeSet.has(a) && animeSet.has(b)) return true;
    return false;
  }

  function getAll() {
    return _load().filter(i => {
      const m = (i.media || "").toLowerCase();
      return m !== "manga" && m !== "manhwa" && m !== "manhua";
    });
  }
  function count()          { return getAll().length; }
  function has(id, media) {
    const targetId = String(id);
    return _load().some(i => (String(i.id) === targetId || String(i.animeId) === targetId) && (!media || _mediaMatches(i.media, media)));
  }

  function add(item) {
    const list = _load();
    const targetId = String(item.id);
    if (list.some(i => (String(i.id) === targetId || String(i.animeId) === targetId) && _mediaMatches(i.media, item.media))) return;
    list.unshift({
      id      : item.id,
      media   : item.media,
      title   : item.title,
      year    : item.year,
      poster  : item.poster,
      rating  : item.rating,
      addedAt : Date.now(),
    });
    _save(list);
  }

  function remove(id, media) {
    const targetId = String(id);
    _save(_load().filter(i => {
      const matchId = String(i.id) === targetId || String(i.animeId) === targetId;
      if (!matchId) return true;
      if (media && !_mediaMatches(i.media, media)) return true;
      return false;
    }));
  }

  function toggle(item) {
    has(item.id, item.media) ? remove(item.id, item.media) : add(item);
    return has(item.id, item.media);
  }

  function clear() { _save([]); }

  return { getAll, count, has, add, remove, toggle, clear };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Watchlist;
}

window.Watchlist = Watchlist;