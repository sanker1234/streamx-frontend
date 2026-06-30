/**
 * StreamX v2 — tmdb.js
 * Pure TMDB API layer. Every piece of content data originates here.
 * NO hard-coded movie, TV, anime, or trending arrays.
 */

const TMDB = (() => {
  // Simple in-memory cache: endpoint → { data, ts }
  const _cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ── Core fetch ────────────────────────────────────────────────────────
  const API_BASE =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? "http://127.0.0.1:3000/api"
    : "https://streamx-backend-ih2r.onrender.com/api";

async function _fetch(endpoint, params = {}) {

  const url = new URL(`${API_BASE}${endpoint}`);

  url.searchParams.set("language", "en-US");

  Object.entries(params).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );

  const cacheKey = url.toString();
  const cached = _cache.get(cacheKey);

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Backend ${res.status}: ${endpoint}`);
  }

  const data = await res.json();

  _cache.set(cacheKey, {
    data,
    ts: Date.now()
  });

  return data;
}

  // ── Image helpers ─────────────────────────────────────────────────────
  function posterUrl(path, size = "poster_md") {
    return path ? `${IMG[size]}${path}` : null;
  }
  function backdropUrl(path, size = "backdrop_lg") {
    return path ? `${IMG[size]}${path}` : null;
  }
  function profileUrl(path) {
    return path ? `${IMG.profile}${path}` : null;
  }

  // ── Normalise items so app layer has a consistent shape ───────────────
  function _normalise(item, forcedMedia) {
    const media = forcedMedia || item.media_type || (item.first_air_date ? "tv" : "movie");
    return {
      id          : item.id,
      media       : media,
      title       : item.title || item.name || "Untitled",
      overview    : item.overview || "",
      year        : (item.release_date || item.first_air_date || "").slice(0, 4),
      rating      : parseFloat((item.vote_average || 0).toFixed(1)),
      votes       : item.vote_count || 0,
      popularity  : item.popularity || 0,
      poster      : posterUrl(item.poster_path),
      poster_lg   : posterUrl(item.poster_path, "poster_lg"),
      backdrop    : backdropUrl(item.backdrop_path),
      genre_ids   : item.genre_ids || [],
      genres      : (item.genres || []).map(g => g.name),
      adult       : item.adult || false,
      // TV-only
      seasons     : item.number_of_seasons || null,
      episodes    : item.number_of_episodes || null,
      status      : item.status || null,
      networks    : (item.networks || []).map(n => n.name),
      // Movie-only
      runtime     : item.runtime || null,
      budget      : item.budget || null,
      revenue     : item.revenue || null,
      tagline     : item.tagline || "",
    };
  }

  // ── Trending ──────────────────────────────────────────────────────────
  async function getTrending(mediaType = "all", timeWindow = "week", page = 1) {
    const data = await _fetch(`/trending/${mediaType}/${timeWindow}`, { page });
    return {
      results     : data.results.map(i => _normalise(i)),
      total_pages : data.total_pages,
      page        : data.page,
    };
  }

  // ── Popular / Top Rated / Now Playing / Upcoming ──────────────────────
  async function getList(mediaType, listName, page = 1) {
    // listName: popular | top_rated | now_playing | upcoming | on_the_air | airing_today
    const data = await _fetch(`/${mediaType}/${listName}`, { page });
    return {
      results     : data.results.map(i => _normalise(i, mediaType)),
      total_pages : data.total_pages,
      page        : data.page,
    };
  }

  // ── Discover ──────────────────────────────────────────────────────────
  async function discover(mediaType, params = {}) {
    const data = await _fetch(`/discover/${mediaType}`, params);
    return {
      results     : data.results.map(i => _normalise(i, mediaType)),
      total_pages : data.total_pages,
      page        : data.page || 1,
    };
  }

  // ── Generic row fetcher (driven by HOME_ROWS config) ─────────────────
  async function fetchRow(row, page = 1) {
    // endpoint may include query params already (e.g. /discover/tv?with_genres=16)
    const [path, qs] = row.endpoint.split("?");
    const params     = { page };
    if (qs) qs.split("&").forEach(pair => { const [k,v] = pair.split("="); params[k] = v; });

    const data = await _fetch(path, params);
    const media = row.media === "mixed" ? null : row.media;
    return {
      results     : (data.results || []).map(i => _normalise(i, media)),
      total_pages : data.total_pages || 1,
      page        : data.page || 1,
    };
  }

  // ── Details ───────────────────────────────────────────────────────────
  async function getDetails(mediaType, id) {
    const data = await _fetch(`/${mediaType}/${id}`, {
      append_to_response: "credits,recommendations,similar,videos,images,external_ids",
    });
    const norm = _normalise(data, mediaType);

    // Cast
    norm.cast = (data.credits?.cast || []).slice(0, 15).map(p => ({
      id      : p.id,
      name    : p.name,
      character: p.character || p.roles?.[0]?.character || "",
      photo   : profileUrl(p.profile_path),
    }));

    // Videos — pick best trailer
    const vids = data.videos?.results || [];
    norm.trailer = vids.find(v => v.type === "Trailer" && v.site === "YouTube")
                || vids.find(v => v.site === "YouTube")
                || null;

    // Recommendations
    norm.recommendations = (data.recommendations?.results || [])
      .slice(0, 12)
      .map(i => _normalise(i, mediaType));

    // Season list for TV
    norm.season_list = (data.seasons || []).filter(s => s.season_number > 0);

    return norm;
  }

  // ── TV Season detail ──────────────────────────────────────────────────
  async function getSeason(tvId, seasonNum) {
    const data = await _fetch(`/tv/${tvId}/season/${seasonNum}`);
    return {
      season_number : data.season_number,
      name          : data.name,
      overview      : data.overview,
      poster        : posterUrl(data.poster_path),
      air_date      : data.air_date,
      episodes      : (data.episodes || []).map(ep => ({
        id             : ep.id,
        episode_number : ep.episode_number,
        name           : ep.name,
        overview       : ep.overview,
        still          : ep.still_path ? `${IMG.still}${ep.still_path}` : null,
        air_date       : ep.air_date,
        runtime        : ep.runtime,
        rating         : ep.vote_average,
      })),
    };
  }

  // ── Search ────────────────────────────────────────────────────────────
  async function search(query, page = 1) {
    if (!query?.trim()) return { results: [], total_pages: 0, page: 1 };
    const data = await _fetch("/search/multi", { query: query.trim(), page, include_adult: false });
    return {
      results : (data.results || [])
        .filter(i => ["movie","tv"].includes(i.media_type) && i.poster_path)
        .map(i => _normalise(i)),
      total_pages : data.total_pages,
      page        : data.page,
    };
  }

  // ── Genre lists ───────────────────────────────────────────────────────
  async function getGenres(mediaType) {
    const data = await _fetch(`/genre/${mediaType}/list`);
    return data.genres || [];
  }

  // ── Person ────────────────────────────────────────────────────────────
  async function getPerson(id) {
    const data = await _fetch(`/person/${id}`, { append_to_response: "combined_credits" });
    return {
      id       : data.id,
      name     : data.name,
      bio      : data.biography,
      birthday : data.birthday,
      photo    : profileUrl(data.profile_path),
      known_for: data.known_for_department,
      credits  : (data.combined_credits?.cast || [])
        .filter(c => c.poster_path)
        .slice(0, 20)
        .map(i => _normalise(i)),
    };
  }

  // ── Expose public API ─────────────────────────────────────────────────
  return {
    getTrending,
    getList,
    discover,
    fetchRow,
    getDetails,
    getSeason,
    search,
    getGenres,
    getPerson,
    posterUrl,
    backdropUrl,
    _normalise,
  };
})();