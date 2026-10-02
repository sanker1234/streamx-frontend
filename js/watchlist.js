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

  function getAll() {
    return _load().filter(i => {
      const m = (i.media || "").toLowerCase();
      return m !== "manga" && m !== "manhwa" && m !== "manhua";
    });
  }
  function count()          { return getAll().length; }
  function has(id, media)   { return _load().some(i => i.id === id && i.media === media); }

  function add(item) {
    const list = _load();
    if (list.some(i => i.id === item.id && i.media === item.media)) return;
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
    _save(_load().filter(i => !(i.id === id && i.media === media)));
  }

  function toggle(item) {
    has(item.id, item.media) ? remove(item.id, item.media) : add(item);
    return has(item.id, item.media);
  }

  function clear() { _save([]); }

  return { getAll, count, has, add, remove, toggle, clear };
})();

window.Watchlist = Watchlist;