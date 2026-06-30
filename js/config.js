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
    key    : "vidlink",
    label  : "VidLink Pro",
    icon   : "▶",
    desc   : "Best quality · Auto sub/dub",
    color  : "#7c3aed",
    movie  : (id)        => `https://vidlink.pro/movie/${id}`,
    tv     : (id, s, e)  => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidsrc",
    label  : "VidSrc",
    icon   : "⚡",
    desc   : "Fast · Multi-source",
    color  : "#0071eb",
    movie  : (id)        => `https://vidsrc.to/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidsrccc",
    label  : "VidSrc CC",
    icon   : "📺",
    desc   : "High-speed CDN",
    color  : "#06b6d4",
    movie  : (id)        => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
 
  {
    key    : "2embed",
    label  : "2Embed",
    icon   : "🎬",
    desc   : "Reliable fallback mirror",
    color  : "#f59e0b",
    movie  : (id)        => `https://www.2embed.cc/embed/${id}`,
    tv     : (id, s, e)  => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    key    : "videasy",
    label  : "Videasy",
    icon   : "📼",
    desc   : "Alternative streaming network",
    color  : "#f43f5e",
    movie  : (id)        => `https://player.videasy.to/movie/${id}`,
    tv     : (id, s, e)  => `https://player.videasy.to/tv/${id}/${s}/${e}`,
  },
{
    key    : "vidsrcpm",
    label  : "VidSrc PM (MegaCloud)",
    icon   : "☁️",
    desc   : "Direct MegaCloud & UpCloud server routing",
    color  : "#3b82f6",
    movie  : (id)        => `https://vidsrc.pm/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
  },
  
  
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
    key   : "nyaa",
    label : "Nyaa (Anime Specific)",
    icon  : "🐱",
    desc  : "Absolute best for Anime · Sub/Dub batches",
    color : "#7c3aed",
    url   : (item) => {
      const cleanTitle = item.title.replace(/[:!?]/g, "");
      return `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(cleanTitle)}`;
    },
  },
  {
    key   : "yts",
    label : "YTS (Movies Only)",
    icon  : "⬇",
    desc  : "Best movie torrents(change-to:.lu) · 1080p/4K light files",
    color : "#10b981",
    url   : (item) => {
      const slug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      return item.year
        ? `https://yts.lu/movies/${slug}-${item.year}`
        : `https://yts.lu/browse-movies/${encodeURIComponent(item.title)}`;
    },
  },
  {
    key   : "1337x",
    label : "1337x",
    icon  : "📁",
    desc  : "General Movies, TV Shows & Pack sets",
    color : "#f59e0b",
    url   : (item) => {
      const cleanTitle = item.title.replace(/[:!?]/g, "");
      const query = item.year ? `${cleanTitle} ${item.year}` : cleanTitle;
      return `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    },
  },
  {
    key   : "torrentgalaxy",
    label : "TorrentGalaxy",
    icon  : "🌌",
    desc  : "High-speed clean scene releases",
    color : "#0071eb",
    url   : (item) => {
      const cleanTitle = item.title.replace(/[:!?]/g, "");
      const query = item.year ? `${cleanTitle} ${item.year}` : cleanTitle;
      return `https://torrentgalaxy.to/torrents.php?search=${encodeURIComponent(query)}`;
    },
  },
  {
    key   : "subdl",
    label : "SubDL (Subtitles)",
    icon  : "💬",
    desc  : "Modern community subtitle indexer",
    color : "#06b6d4",
    url   : (item) =>
      `https://subdl.com/search?q=${encodeURIComponent(item.title)}`,
  },
  {
    key   : "opensubtitles",
    label : "OpenSubtitles",
    icon  : "📝",
    desc  : "Subtitle backup source",
    color : "#ec4899",
    url   : (item) =>
      `https://www.opensubtitles.org/en/search2/moviename-${encodeURIComponent(item.title)}`,
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
  { id: "anime",           label: "Anime",                endpoint: `/discover/tv?with_genres=16&with_keywords=${ANIME_KEYWORD_ID}`, media: "tv"     },
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
  label: "🔥 Trending Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "bollywood_popular",
  label: "⭐ Popular Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "bollywood_top",
  label: "🏆 Top Rated Hindi Movies",
  endpoint: "/discover/movie?with_original_language=hi&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "bollywood_tv",
  label: "📺 Hindi TV Shows",
  endpoint: "/discover/tv?with_original_language=hi",
  media: "tv"
},

// ===== Tollywood =====
{
  id: "tollywood_trending",
  label: "🔥 Trending Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "tollywood_popular",
  label: "⭐ Popular Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "tollywood_top",
  label: "🏆 Top Rated Telugu Movies",
  endpoint: "/discover/movie?with_original_language=te&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "tollywood_tv",
  label: "📺 Telugu TV Shows",
  endpoint: "/discover/tv?with_original_language=te",
  media: "tv"
},

// ===== Kollywood =====
{
  id: "kollywood_trending",
  label: "🔥 Trending Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "kollywood_popular",
  label: "⭐ Popular Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "kollywood_top",
  label: "🏆 Top Rated Tamil Movies",
  endpoint: "/discover/movie?with_original_language=ta&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "kollywood_tv",
  label: "📺 Tamil TV Shows",
  endpoint: "/discover/tv?with_original_language=ta",
  media: "tv"
},

// ===== Mollywood =====
{
  id: "mollywood_trending",
  label: "🔥 Trending Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "mollywood_popular",
  label: "⭐ Popular Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "mollywood_top",
  label: "🏆 Top Rated Malayalam Movies",
  endpoint: "/discover/movie?with_original_language=ml&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "mollywood_tv",
  label: "📺 Malayalam TV Shows",
  endpoint: "/discover/tv?with_original_language=ml",
  media: "tv"
},

// ===== Kannada =====
{
  id: "sandalwood_trending",
  label: "🔥 Trending Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=popularity.desc",
  media: "movie"
},
{
  id: "sandalwood_popular",
  label: "⭐ Popular Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=vote_count.desc",
  media: "movie"
},
{
  id: "sandalwood_top",
  label: "🏆 Top Rated Kannada Movies",
  endpoint: "/discover/movie?with_original_language=kn&sort_by=vote_average.desc&vote_count.gte=100",
  media: "movie"
},
{
  id: "sandalwood_tv",
  label: "📺 Kannada TV Shows",
  endpoint: "/discover/tv?with_original_language=kn",
  media: "tv"
},
  { id: "horror",          label: "Horror",               endpoint: "/discover/movie?with_genres=27",                               media: "movie"  },
  { id: "comedy",          label: "Comedy",               endpoint: "/discover/movie?with_genres=35",                               media: "movie"  },
  { id: "documentary",     label: "Documentaries",        endpoint: "/discover/movie?with_genres=99",                               media: "movie"  },
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