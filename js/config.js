/**
 * StreamX v2 — config.js
 * All user-configurable settings live here.
 * NO movie/TV/anime datasets. All content comes from TMDB at runtime.
 */

// ── TMDB API ──────────────────────────────────────────────────────────────
const TMDB_API_KEY = ""; // https://www.themoviedb.org/settings/api
const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_IMG     = "https://image.tmdb.org/t/p";

// Image size presets
const IMG = {
  poster_sm  : `${TMDB_IMG}/w185`,
  poster_md  : `${TMDB_IMG}/w342`,
  poster_lg  : `${TMDB_IMG}/w500`,
  backdrop_sm: `${TMDB_IMG}/w780`,
  backdrop_lg: `${TMDB_IMG}/w1280`,
  still      : `${TMDB_IMG}/w300`,
  profile    : `${TMDB_IMG}/w185`,
};

// ── STREAM SERVERS ────────────────────────────────────────────────────────
// Each server receives (tmdbId, mediaType, season?, episode?) at runtime.
// const STREAM_SERVERS = [
//   {
//     key    : "vidlink",
//     label  : "VidLink Pro",
//     icon   : "▶",
//     desc   : "Best quality · Auto sub/dub",
//     color  : "#7c3aed",
//     movie  : (id)        => `https://vidlink.pro/movie/${id}`,
//     tv     : (id, s, e)  => `https://vidlink.pro/tv/${id}/${s}/${e}`,
//   },
//   {
//     key    : "vidsrc",
//     label  : "VidSrc",
//     icon   : "⚡",
//     desc   : "Fast · Multi-source",
//     color  : "#0071eb",
//     movie  : (id)        => `https://vidsrc.to/embed/movie/${id}`,
//     tv     : (id, s, e)  => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
//   },
//   {
//     key    : "vidsrccc",
//     label  : "VidSrc CC",
//     icon   : "📺",
//     desc   : "High-speed CDN",
//     color  : "#06b6d4",
//     movie  : (id)        => `https://vidsrc.cc/v2/embed/movie/${id}`,
//     tv     : (id, s, e)  => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
//   },
//   {
//     key    : "autoembed",
//     label  : "AutoEmbed",
//     icon   : "🔄",
//     desc   : "Auto multi-provider fallback",
//     color  : "#10b981",
//     movie  : (id)        => `https://player.autoembed.cc/embed/movie/${id}`,
//     tv     : (id, s, e)  => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
//   },
//   {
//     key    : "2embed",
//     label  : "2Embed",
//     icon   : "🎬",
//     desc   : "Reliable backup server",
//     color  : "#f59e0b",
//     movie  : (id)        => `https://www.2embed.cc/embed/${id}`,
//     tv     : (id, s, e)  => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
//   },
// ];
const STREAM_SERVERS = [
  {
    key    : "videm",
    label  : "Videm",
    recommended: true,
    icon   : "🎬",
    desc   : "Fast · Auto-source · Fullscreen",
    color  : "#3b82f6",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://videm.xyz/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://videm.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidbolt",
    label  : "VidBolt",
    icon   : "⚡",
    desc   : "4K Player · Zero Config",
    color  : "#10b981",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidbolt.pro/movie/${id}`,
    tv     : (id, s, e)  => `https://vidbolt.pro/tv/${id}/${s}/${e}`,
  },
  {
    key    : "codespecters",
    label  : "CodeSpecters",
    icon   : "💎",
    desc   : "Ultra HD · Multi-server embed",
    color  : "#8b5cf6",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://api.codespecters.com/embed/movie/${id}?apikey=DEMO_36c18c68`,
    tv     : (id, s, e)  => `https://api.codespecters.com/embed/tv/${id}/${s}/${e}?apikey=DEMO_36c18c69`,
  },
  {
    key    : "streamflizo",
    label  : "StreamFliz",
    icon   : "🔥",
    desc   : "Multi-Audio · Sub/Dub",
    color  : "#ff2a5f",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://streamflizoapi.top/stream/tmdb/${id}`,
    tv     : (id, s, e)  => `https://streamflizoapi.top/stream/tmdb/${id}/${s}/${e}/multi`,
  },
  {
    key    : "cinesrc",
    label  : "CineSrc",
    icon   : "🎬",
    desc   : "Fast · Subtitles · Auto-next",
    color  : "#3b82f6",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://cinesrc.st/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}`,
  },
  {
    key    : "filmu",
    label  : "FilmU Embed",
    icon   : "🎥",
    desc   : "Multi-source streaming",
    color  : "#8b5cf6",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://embed.filmu.in/movie/${id}`,
    tv     : (id, s, e)  => `https://embed.filmu.in/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidcore",
    label  : "VidCore",
    icon   : "⚡",
    desc   : "HLS · Multi-server player",
    color  : "#06b6d4",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidcore.org/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidcore.org/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidsrcsbs",
    label  : "VidSrc",
    icon   : "📺",
    desc   : "Fast · Multi-source CDN",
    color  : "#10b981",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidsrc.sbs/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidsrc.sbs/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "smashystream",
    label  : "SmashyStream",
    icon   : "💥",
    desc   : "Recommended mirror nodes",
    color  : "#f59e0b",
    supportedCategories: ["hollywood", "indian", "kdrama", "cdrama", "jdrama"],
    movie  : (id)        => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    tv     : (id, s, e)  => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    key    : "twoembed",
    label  : "2Embed",
    icon   : "🎞️",
    desc   : "Reliable fallback server",
    color  : "#eab308",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://www.2embed.cc/embed/${id}`,
    tv     : (id, s, e)  => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    key    : "embedmaster",
    label  : "EmbedMaster",
    icon   : "🔮",
    desc   : "PlayerJS API · Custom subtitles",
    color  : "#a855f7",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://embedmaster.link/movie/${id}`,
    tv     : (id, s, e)  => `https://embedmaster.link/tv/${id}/${s}/${e}`,
  }
];


// ── DOWNLOAD SERVERS ──────────────────────────────────────────────────────
// Each receives the item object (with title, year, genre) at runtime.
// const DOWNLOAD_SERVERS = [
//   {
//     key   : "yts",
//     label : "YTS",
//     icon  : "⬇",
//     desc  : "Best movie torrents · 1080p/4K",
//     color : "#10b981",
//     url   : (item) =>
//       `https://yts.mx/movies/${encodeURIComponent(
//         item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
//       )}-${item.year}`,
//   },
//   {
//     key   : "nyaa",
//     label : "Nyaa",
//     icon  : "🐱",
//     desc  : "Best anime downloads",
//     color : "#7c3aed",
//     url   : (item) => `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(item.title)}`,
//   },
//   {
//     key   : "1337x",
//     label : "1337x",
//     icon  : "📁",
//     desc  : "Movies, TV & anime torrents",
//     color : "#f59e0b",
//     url   : (item) =>
//       `https://1337x.to/search/${encodeURIComponent(item.title)}+${item.year}/1/`,
//   },
//   {
//     key   : "torrentgalaxy",
//     label : "TorrentGalaxy",
//     icon  : "🌌",
//     desc  : "Large torrent index",
//     color : "#0071eb",
//     url   : (item) =>
//       `https://torrentgalaxy.to/torrents.php?search=${encodeURIComponent(item.title)}`,
//   },
//   {
//     key   : "subscene",
//     label : "Subscene",
//     icon  : "💬",
//     desc  : "Subtitle files for downloads",
//     color : "#06b6d4",
//     url   : (item) =>
//       `https://subscene.com/subtitles/searchbytitle?query=${encodeURIComponent(item.title)}`,
//   },
//   {
//     key   : "opensubtitles",
//     label : "OpenSubtitles",
//     icon  : "📝",
//     desc  : "Free subtitle downloads",
//     color : "#ec4899",
//     url   : (item) =>
//       `https://www.opensubtitles.org/en/search2/moviename-${encodeURIComponent(item.title)}`,
//   },
// ];
const DOWNLOAD_SERVERS = [
  {
    key   : "vidvault",
    label : "VidVault",
    icon  : "⬇",
    desc  : "Direct Download · Works with TMDB ID",
    color : "#00d2ff",
    url   : (item, currentSeason = 1, currentEpisode = 1) => {
      if (!item) return "#";
      const id = item.tmdb_id || item.id;
      if (!id) return "#";

      const isExplicitMovie = item.media === "movie" || item.media_type === "movie" || item.type === "movie";
      const isTv = !isExplicitMovie && (
        item.media === "tv" ||
        item.media === "series" ||
        item.media_type === "tv" ||
        item.media_type === "series" ||
        item.type === "tv" ||
        item.type === "series" ||
        Boolean(item.first_air_date) ||
        Boolean(item.number_of_seasons) ||
        Boolean(item.season_list?.length) ||
        Boolean(item.seasons) ||
        Boolean(item.season)
      );

      if (isTv) {
        const s = item.season || currentSeason || 1;
        const e = item.episode || currentEpisode || 1;
        return `https://vidvault.to/tv/${id}/${s}/${e}`;
      }
      return `https://vidvault.to/movie/${id}`;
    },
  }
];



// ── GENRE MAPPINGS ────────────────────────────────────────────────────────
// TMDB genre IDs — used for discover queries, NOT for hard-coded data.
const GENRE_MAP = {
  movie: {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
    53: "Thriller", 10752: "War", 37: "Western",
  },
  tv: {
    10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
    10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
    10768: "War & Politics", 37: "Western",
  },
};

// Anime keyword ID on TMDB
const ANIME_KEYWORD_ID = 210024;

// Home page row configuration — drives what TMDB endpoints are called
const HOME_ROWS = [
  { id: "trending_all",    label: "Trending Now",         endpoint: "/trending/all/week",                                          media: "mixed"  },
  { id: "trending_movies", label: "Trending Movies",      endpoint: "/trending/movie/week",                                         media: "movie"  },
  { id: "trending_tv",     label: "Trending TV Shows",    endpoint: "/trending/tv/week",                                            media: "tv"     },
  { id: "popular_movies",  label: "Popular Movies",       endpoint: "/movie/popular",                                               media: "movie"  },
  { id: "popular_tv",      label: "Popular TV Shows",     endpoint: "/tv/popular",                                                  media: "tv"     },
  { id: "top_movies",      label: "Top Rated Movies",     endpoint: "/movie/top_rated",                                             media: "movie"  },
  { id: "top_tv",          label: "Top Rated TV Shows",   endpoint: "/tv/top_rated",                                                media: "tv"     },
  { id: "now_playing",     label: "Now Playing",          endpoint: "/movie/now_playing",                                           media: "movie"  },
  { id: "upcoming",        label: "Coming Soon",          endpoint: "/movie/upcoming",                                              media: "movie"  },
  { id: "action",          label: "Action & Thriller",    endpoint: "/discover/movie?with_genres=28,53",                            media: "movie"  },
  { id: "scifi",           label: "Sci-Fi & Fantasy",     endpoint: "/discover/movie?with_genres=878,14",                           media: "movie"  },
  { id: "kdrama",          label: "K-Drama",              endpoint: "/discover/tv?with_origin_country=KR&with_genres=18",           media: "tv"     },
  { id: "cdrama",          label: "C-Drama",              endpoint: "/discover/tv?with_origin_country=CN&with_genres=18",           media: "tv" },
  { id: "jdrama",          label: "J-Drama",              endpoint: "/discover/tv?with_origin_country=JP&with_genres=18",           media: "tv" },
  { id: "bollywood",       label: "Bollywood",            endpoint: "/discover/movie?with_origin_country=IN&with_original_language=hi", media: "movie" },
  { id: "tollywood",       label: "Tollywood",            endpoint: "/discover/movie?with_origin_country=IN&with_original_language=te", media: "movie" },
  { id: "kollywood",       label: "Kollywood",            endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ta", media: "movie" },
  { id: "mollywood",       label: "Mollywood",            endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ml", media: "movie" },
  { id: "sandalwood",      label: "Kannada",              endpoint: "/discover/movie?with_origin_country=IN&with_original_language=kn", media: "movie" },
  // ===== Bollywood =====
{
  id: "bollywood_trending",
  label: "Trending Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "bollywood_popular",
  label: "Popular Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "bollywood_top",
  label: "Top Rated Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "bollywood_tv",
  label: "Hindi TV Shows",
  endpoint: "/discover/tv?with_original_language=hi",
  media: "tv"
},

// ===== Tollywood =====
{
  id: "tollywood_trending",
  label: "Trending Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "tollywood_popular",
  label: "Popular Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "tollywood_top",
  label: "Top Rated Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "tollywood_tv",
  label: "Telugu TV Shows",
  endpoint: "/discover/tv?with_original_language=te",
  media: "tv"
},

// ===== Kollywood =====
{
  id: "kollywood_trending",
  label: "Trending Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "kollywood_popular",
  label: "Popular Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "kollywood_top",
  label: "Top Rated Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "kollywood_tv",
  label: "Tamil TV Shows",
  endpoint: "/discover/tv?with_original_language=ta",
  media: "tv"
},

// ===== Mollywood =====
{
  id: "mollywood_trending",
  label: "Trending Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "mollywood_popular",
  label: "Popular Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "mollywood_top",
  label: "Top Rated Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "mollywood_tv",
  label: "Malayalam TV Shows",
  endpoint: "/discover/tv?with_original_language=ml",
  media: "tv"
},

// ===== Kannada =====
{
  id: "sandalwood_trending",
  label: "Trending Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "sandalwood_popular",
  label: "Popular Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "sandalwood_top",
  label: "Top Rated Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "sandalwood_tv",
  label: "Kannada TV Shows",
  endpoint: "/discover/tv?with_original_language=kn",
  media: "tv"
},
  { id: "horror",          label: "Horror",               endpoint: "/discover/movie?with_genres=27",                               media: "movie"  },
  { id: "comedy",          label: "Comedy",               endpoint: "/discover/movie?with_genres=35",                               media: "movie"  },
  { id: "documentary",     label: "Documentaries",        endpoint: "/discover/movie?with_genres=99",                               media: "movie"  },
];

// Dedicated Anime & Donghua Rows Configuration
const ANIME_ROWS = [
  { id: "anime_trending",  label: "Trending Anime",       endpoint: "/trending",                                 media: "anime" },
  { id: "anime_popular",   label: "Popular Anime",        endpoint: "/popular",                                  media: "anime" },
  { id: "anime_top",       label: "Top Rated Anime",      endpoint: "/popular?sort=SCORE_DESC",                  media: "anime" },
  { id: "anime_airing",    label: "Currently Airing",     endpoint: "/airing",                                   media: "anime" },
  { id: "anime_upcoming",  label: "Upcoming Anime",       endpoint: "/upcoming",                                 media: "anime" },
  { id: "donghua_trending", label: "Trending Donghua",     endpoint: "/trending?origin=CN",                       media: "donghua" },
  { id: "donghua_popular",  label: "Popular Donghua",      endpoint: "/popular?origin=CN",                        media: "donghua" },
  { id: "donghua_top",      label: "Top Rated Donghua",     endpoint: "/popular?sort=SCORE_DESC&origin=CN",        media: "donghua" },
  { id: "donghua_airing",   label: "Currently Airing Donghua", endpoint: "/airing?origin=CN",                     media: "donghua" },
  { id: "donghua_upcoming", label: "Upcoming Donghua",     endpoint: "/upcoming?origin=CN",                       media: "donghua" }
];

// App settings
const APP_CONFIG = {
  name           : "StreamX",
  version        : "2.0",
  items_per_row  : 20,       // items fetched per row
  hero_count     : 8,        // number of hero banner items to rotate
  search_debounce: 400,      // ms debounce on search input
  history_limit  : 50,       // max items in continue watching
  img_lazy_root  : null,     // IntersectionObserver root
  img_lazy_margin: "200px",  // load images 200px before visible
};

const STREAMX_NAV_SECTIONS = [
  {
    section: "Entertainment",
    items: [
      { id: "home", label: "Home", action: "page", target: "home", icon: "home" },
      { id: "movies", label: "Movies", action: "browse", target: "trending_movies", icon: "movies" },
      { id: "series", label: "Series", action: "browse", target: "trending_tv", icon: "tv" },
      { id: "dramas", label: "Dramas", action: "browse", target: "kdrama", icon: "drama" }
    ]
  },
  {
    section: "Anime & Donghua",
    items: [
      { id: "anime", label: "Anime", action: "page", target: "anime", icon: "anime" },
      { id: "donghua", label: "Donghua", action: "page", target: "donghua", icon: "donghua" }
    ]
  },
  {
    section: "Library",
    items: [
      { id: "watchlist", label: "Watchlist", action: "page", target: "watchlist", icon: "watchlist" },
      { id: "history", label: "History", action: "page", target: "history-page", icon: "history" },
      { id: "continue", label: "Continue Watching", action: "page", target: "continue-page", icon: "continue" }
    ]
  },
  {
    section: "Account",
    items: [
      { id: "profile", label: "My Profile", action: "page", target: "profile", icon: "user" }
    ]
  },
  {
    section: "Settings & Legal",
    items: [
      { id: "settings", label: "Settings", action: "page", target: "settings-page", icon: "settings" },
      { id: "disclaimer", label: "Legal & Guidelines", action: "disclaimer", target: "non-hosting", icon: "shield" },
      { id: "install-app", label: "Install App", action: "install_pwa", target: "install", icon: "download" }
    ]
  }
];

// ── BACKEND API RESOLVER ──────────────────────────────────────────────────
function getStreamXBackendUrl() {
  const custom = localStorage.getItem("streamx_backend_url");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "" ||
    window.location.protocol === "file:"
    ? "http://127.0.0.1:3000"
    : "https://streamx-backend-ih2r.onrender.com";
}

window.getStreamXBackendUrl = getStreamXBackendUrl;