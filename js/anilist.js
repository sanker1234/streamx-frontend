/**
 * StreamX v2 — anilist.js
 * API layer for AniList.
 */

const Anilist = (() => {
  const _cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function _getApiBase() {
    const base = typeof getStreamXBackendUrl === "function" ? getStreamXBackendUrl() : "http://127.0.0.1:3000";
    return `${base}/api/anime`;
  }

  async function _fetch(endpoint, params = {}) {
    const url = new URL(`${_getApiBase()}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, v);
      }
    });

    const cacheKey = url.toString();
    const cached = _cache.get(cacheKey);

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`AniList Backend ${res.status}: ${endpoint}`);
    }

    const data = await res.json();
    _cache.set(cacheKey, {
      data,
      ts: Date.now()
    });

    return data;
  }

  function _normalise(item, forcedMedia) {
    if (!item) return null;
    return {
      id: item.id,
      idMal: item.idMal,
      media: forcedMedia || item.media || "anime",
      title: item.title || "Untitled",
      overview: item.overview || "",
      year: item.year || "",
      rating: item.vote_average || 0,
      votes: item.vote_count || 0,
      popularity: item.popularity || 0,
      poster: item.poster_path || "",
      poster_lg: item.poster_path || "",
      backdrop: item.backdrop_path || "",
      genres: (item.genres || []).map(g => g.name || g),
      genre_ids: item.genre_ids || [],
      seasons: item.number_of_seasons || 1,
      episodes: item.number_of_episodes || 1,
      status: item.status || "",
      tagline: item.tagline || "",
    };
  }

  async function getTrending(origin, page = 1) {
    const data = await _fetch("/trending", { origin, page });
    const mediaType = origin === "CN" ? "donghua" : "anime";
    return {
      results: (data.results || []).map(i => _normalise(i, mediaType)),
      total_pages: data.total_pages || 1,
      page: data.page || 1
    };
  }

  async function getList(listType, origin, page = 1) {
    const mediaType = origin === "CN" ? "donghua" : "anime";
    if (listType === "top") {
      return getPopular(origin, page, "SCORE_DESC");
    }

    const data = await _fetch(`/${listType}`, { page, origin });
    return {
      results: (data.results || []).map(i => _normalise(i, mediaType)),
      total_pages: data.total_pages || 1,
      page: data.page || 1
    };
  }

  async function getPopular(origin, page = 1, sort = "POPULARITY_DESC") {
    const mediaType = origin === "CN" ? "donghua" : "anime";
    const params = { page, sort };
    if (origin) params.origin = origin;
    const data = await _fetch("/popular", params);
    return {
      results: (data.results || []).map(i => _normalise(i, mediaType)),
      total_pages: data.total_pages || 1,
      page: data.page || 1
    };
  }

  async function getDetails(id, mediaType = "anime") {
    const data = await _fetch(`/details/${id}`, { media: mediaType });
    const norm = _normalise(data, mediaType);
    if (!norm) return null;

    norm.cast = data.cast || [];
    norm.trailer = data.trailer || null;
    norm.recommendations = (data.recommendations || []).map(i => _normalise(i, mediaType));
    norm.season_list = data.season_list || [{ season_number: 1, name: "Season 1" }];
    norm.episodes_list = data.episodes_list || [];
    norm.relations = data.relations || [];

    return norm;
  }

  async function search(query, page = 1) {
    if (!query?.trim()) return { results: [], total_pages: 0, page: 1 };
    const data = await _fetch("/search", { query: query.trim(), q: query.trim(), page });
    return {
      results: (data.results || []).map(i => _normalise(i)),
      total_pages: data.total_pages || 1,
      page: data.page || 1
    };
  }

  return {
    getTrending,
    getList,
    getPopular,
    getDetails,
    search,
    _normalise
  };
})();

window.Anilist = Anilist;
