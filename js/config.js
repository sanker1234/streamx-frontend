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
// ── PROVIDER SECURITY & SANDBOX REGISTRY ──────────────────────────────────
// Records independent testing results, advertising mechanisms, and minimum
// necessary sandbox restrictions to stop unwanted new tabs while preserving playback.
const PROVIDER_SECURITY_CONFIG = {
  nxsha: {
    tested: true,
    status: "compatible",
    sandbox: null,
    hasAds: false,
    adMechanism: "none",
    notes: "Nxsha Platform 2.0 (Moobies) embed engine. Supports multi-server auto-fallback, custom CineJoy brand color (%23ff2a6d), multi-language audio (?lang=), multi-language subtitle tracks (?sub=), ad-branding disable, and direct download endpoint."
  },
  cinesrc: {
    tested: true,
    status: "compatible",
    sandbox: null,
    hasAds: false,
    adMechanism: "none",
    notes: "Verified clean streaming provider. Streams HLS with subtitles, quality selector, and fullscreen without unwanted advertising tabs or popunders."
  },
  vidlink: {
    tested: true,
    status: "compatible",
    sandbox: null,
    hasAds: false,
    adMechanism: "none",
    notes: "High-quality 1080p player. Actively detects sandbox attributes and halts with 'Please Disable Sandbox'. When run unsandboxed, it streams cleanly."
  },
  vidcore: {
    tested: true,
    status: "compatible",
    sandbox: null,
    hasAds: false,
    adMechanism: "none",
    notes: "Clean EdgeOne-hosted player. Streams HLS without unwanted advertising tabs."
  },
  videm: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "tagivi_window_open",
    notes: "Injects tagivi.com popunder script. Actively checks for sandbox via frameElement.hasAttribute('sandbox') and blocks playback with 'Sandbox is not allowed'. Incompatible with desired ad-free experience (Requirement 10).",
    replacement: "cinesrc"
  },
  filmu: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "profiton_window_open",
    notes: "Injects ProfitOn ad script. Actively checks for sandbox and blocks playback with 'Playback Disabled: Remove sandbox attribute'. Incompatible with desired ad-free experience (Requirement 10).",
    replacement: "cinesrc"
  },
  embedmaster: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "popunder_ad_network",
    notes: "Actively checks for sandbox and blocks playback with 'Sandbox detected: you must remove sandbox attribute'. Incompatible with desired ad-free experience (Requirement 10).",
    replacement: "cinesrc"
  },
  smashystream: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "profiton_window_open",
    notes: "Redirects to AnyEmbed with ProfitOn ad integration. Requires unrestricted context. Incompatible (Requirement 10).",
    replacement: "cinesrc"
  },
  vidbolt: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "miscoinbrassic_window_open",
    notes: "Injects miscoinbrassic ad script. Actively tests document.domain and halts playback with 'Playback disabled: This player can\'t run in a sandboxed iframe'. Incompatible (Requirement 10).",
    replacement: "cinesrc"
  },
  twoembed: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "tagivi_and_target_blank",
    notes: "Injects tagivi script and transparent ad links. Employs isReallySandboxed() anti-sandbox detector and halts video with 'Sandbox not allowed'. Incompatible (Requirement 10).",
    replacement: "cinesrc"
  },
  codespecters: {
    tested: true,
    status: "incompatible",
    sandbox: null,
    hasAds: true,
    adMechanism: "adshield_and_adsterra",
    notes: "Contains ad-shield play overlay that calls window.open() to an ad network, plus Adsterra popunders. Demo API key is also forbidden outside preview domain. Incompatible (Requirement 10).",
    replacement: "cinesrc"
  },
  vidsrcsbs: {
    tested: true,
    status: "offline",
    sandbox: null,
    hasAds: false,
    adMechanism: "unknown",
    notes: "Domain unreachable (DNS / server connection failure).",
    replacement: "cinesrc"
  },
  streamflizo: {
    tested: true,
    status: "offline",
    sandbox: null,
    hasAds: false,
    adMechanism: "unknown",
    notes: "Endpoint returns HTTP 400 Bad Request.",
    replacement: "cinesrc"
  }
};
window.PROVIDER_SECURITY_CONFIG = PROVIDER_SECURITY_CONFIG;

const STREAM_SERVERS = [
  {
    key    : "nxsha",
    label  : "Moobies (Nxsha)",
    recommended: true,
    icon   : "⚡",
    desc   : "Multi-Server · Multi-Lang Audio & Subs · 4K/1080p · Ad-Free",
    color  : "#f59e0b",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id, options = {}) => {
      const params = new URLSearchParams({
        disable_app_ad: "true",
        color: "%23ff2a6d"
      });
      const prefLang = localStorage.getItem("streamx_audio_lang") || options.lang;
      if (prefLang) params.set("lang", prefLang);
      const prefSub = localStorage.getItem("streamx_sub_lang") || options.sub;
      if (prefSub) params.set("sub", prefSub);
      if (options.server) params.set("server", options.server);
      if (options.one_server) params.set("one_server", "true");
      return `https://web.nxsha.app/embed/movie/${id}?${params.toString().replace(/%2523/g, "%23")}`;
    },
    tv     : (id, s, e, options = {}) => {
      const params = new URLSearchParams({
        disable_app_ad: "true",
        color: "%23ff2a6d"
      });
      const prefLang = localStorage.getItem("streamx_audio_lang") || options.lang;
      if (prefLang) params.set("lang", prefLang);
      const prefSub = localStorage.getItem("streamx_sub_lang") || options.sub;
      if (prefSub) params.set("sub", prefSub);
      if (options.server) params.set("server", options.server);
      if (options.one_server) params.set("one_server", "true");
      return `https://web.nxsha.app/embed/tv/${id}/${s}/${e}?${params.toString().replace(/%2523/g, "%23")}`;
    },
  },
  {
    key    : "cinesrc",
    label  : "CineSrc",
    recommended: true,
    icon   : "🎬",
    desc   : "Ultra HD · Fast · Auto-next · Ad-Free",
    color  : "#3b82f6",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://cinesrc.st/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}`,
  },
  {
    key    : "vidlink",
    label  : "VidLink Pro",
    recommended: true,
    icon   : "▶",
    desc   : "Ultra Fast · Auto Sub/Dub · 1080p (Clean)",
    color  : "#7c3aed",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidlink.pro/movie/${id}`,
    tv     : (id, s, e)  => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    key    : "vidcore",
    label  : "VidCore",
    recommended: true,
    icon   : "⚡",
    desc   : "HLS · Multi-server player · Ad-Free",
    color  : "#06b6d4",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidcore.org/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidcore.org/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "videm",
    label  : "Videm",
    icon   : "🛡️",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#3b82f6",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://videm.xyz/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://videm.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "filmu",
    label  : "FilmU Embed",
    icon   : "🎥",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#8b5cf6",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://embed.filmu.in/movie/${id}`,
    tv     : (id, s, e)  => `https://embed.filmu.in/tv/${id}/${s}/${e}`,
  },
  {
    key    : "embedmaster",
    label  : "EmbedMaster",
    icon   : "🔮",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#a855f7",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://embedmaster.link/movie/${id}`,
    tv     : (id, s, e)  => `https://embedmaster.link/tv/${id}/${s}/${e}`,
  },
  {
    key    : "smashystream",
    label  : "SmashyStream",
    icon   : "💥",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#f59e0b",
    incompatible: true,
    supportedCategories: ["hollywood", "indian", "kdrama", "cdrama", "jdrama"],
    movie  : (id)        => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    tv     : (id, s, e)  => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    key    : "vidbolt",
    label  : "VidBolt",
    icon   : "⚡",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#10b981",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidbolt.pro/movie/${id}`,
    tv     : (id, s, e)  => `https://vidbolt.pro/tv/${id}/${s}/${e}`,
  },
  {
    key    : "twoembed",
    label  : "2Embed",
    icon   : "🎞️",
    desc   : "Requires Ad Popups · Incompatible",
    color  : "#eab308",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://www.2embed.cc/embed/${id}`,
    tv     : (id, s, e)  => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    key    : "codespecters",
    label  : "CodeSpecters",
    icon   : "💎",
    desc   : "Ad-Shield & Demo Key Restricted · Incompatible",
    color  : "#8b5cf6",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://api.codespecters.com/embed/movie/${id}?apikey=DEMO_36c18c68`,
    tv     : (id, s, e)  => `https://api.codespecters.com/embed/tv/${id}/${s}/${e}?apikey=DEMO_36c18c69`,
  },
  {
    key    : "vidsrcsbs",
    label  : "VidSrc",
    icon   : "📺",
    desc   : "Multi-source CDN (Offline)",
    color  : "#10b981",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://vidsrc.sbs/embed/movie/${id}`,
    tv     : (id, s, e)  => `https://vidsrc.sbs/embed/tv/${id}/${s}/${e}`,
  },
  {
    key    : "streamflizo",
    label  : "StreamFliz",
    icon   : "🔥",
    desc   : "Multi-Audio (Offline)",
    color  : "#ff2a5f",
    incompatible: true,
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie  : (id)        => `https://streamflizoapi.top/stream/tmdb/${id}`,
    tv     : (id, s, e)  => `https://streamflizoapi.top/stream/tmdb/${id}/${s}/${e}/multi`,
  }
];
window.STREAM_SERVERS = STREAM_SERVERS;


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
    key   : "nxsha_dl",
    label : "Moobies (Nxsha DL)",
    icon  : "⚡",
    desc  : "Direct Download · 1080p/4K Multi-Node",
    color : "#f59e0b",
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
        return `https://web.nxsha.app/dl/tv/${id}/${s}/${e}`;
      }
      return `https://web.nxsha.app/dl/movie/${id}`;
    },
  },
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
window.DOWNLOAD_SERVERS = DOWNLOAD_SERVERS;



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

// ── STREAMING PLATFORMS (Interactive Showcase / Watch Providers) ──────────
const STREAMING_PLATFORMS = [
  {
    id: "netflix",
    name: "Netflix",
    headline: "Only on Netflix",
    tagline: "Popular movies, award-winning series & originals",
    providerId: "8",
    color: "#e50914",
    accentColor: "#ff2a44",
    badgeLabel: "Netflix Original",
    logoHtml: `<span class="platform-logo-txt netflix-txt">NETFLIX</span>`
  },
  {
    id: "prime",
    name: "Prime Video",
    headline: "Only on Prime Video",
    tagline: "Blockbuster movies, hit originals & entertainment included with Prime",
    providerId: "9|119|2100",
    color: "#00A8E1",
    accentColor: "#00b8ff",
    badgeLabel: "Prime Original",
    logoHtml: `<div class="prime-logo-box"><span class="prime-logo-txt">prime video</span><svg class="prime-arrow-svg" width="36" height="7" viewBox="0 0 36 7" fill="none"><path d="M2 2 C 13 6, 24 6, 32 2" stroke="#00A8E1" stroke-width="2" stroke-linecap="round"/><path d="M29 1 L33 2 L31 5" stroke="#00A8E1" stroke-width="1.8" stroke-linecap="round"/></svg></div>`
  },
  {
    id: "max",
    name: "HBO Max",
    headline: "Only on HBO Max",
    tagline: "Blockbuster movies, iconic DC universe & legendary HBO originals",
    providerId: "1899|384",
    color: "#9933FF",
    accentColor: "#a855f7",
    badgeLabel: "Max Original",
    logoHtml: `<span class="platform-logo-txt max-txt">HBO<span class="max-sub">MAX</span></span>`
  },
  {
    id: "disney",
    name: "Disney+",
    headline: "Only on Disney+",
    tagline: "The best stories from Disney, Pixar, Marvel, Star Wars & National Geographic",
    providerId: "337",
    color: "#113CCF",
    accentColor: "#3b82f6",
    badgeLabel: "Disney+ Original",
    logoHtml: `<span class="platform-logo-txt disney-txt">Disney<span class="disney-plus">+</span></span>`
  },
  {
    id: "apple",
    name: "Apple TV+",
    headline: "Only on Apple TV+",
    tagline: "Award-winning Apple Original films, documentaries & groundbreaking series",
    providerId: "350",
    color: "#FFFFFF",
    accentColor: "#f3f4f6",
    badgeLabel: "Apple Original",
    logoHtml: `<span class="platform-logo-txt apple-txt">tv+</span>`
  },
  {
    id: "paramount",
    name: "Paramount+",
    headline: "Only on Paramount+",
    tagline: "A mountain of entertainment, blockbuster hits, live sports & originals",
    providerId: "2303|2616|582|531",
    color: "#0064FF",
    accentColor: "#38bdf8",
    badgeLabel: "Paramount+ Original",
    logoHtml: `<span class="platform-logo-txt paramount-txt">Paramount<span class="paramount-plus">+</span></span>`
  },
  {
    id: "hulu",
    name: "Hulu",
    headline: "Only on Hulu",
    tagline: "Popular titles on this streaming service",
    providerId: "15",
    color: "#1CE783",
    accentColor: "#1ee380",
    badgeLabel: "Hulu Original",
    logoHtml: `<span class="platform-logo-txt hulu-txt">hulu</span>`
  }
];

// Home page row configuration — drives what TMDB endpoints are called
const HOME_ROWS = [
  { id: "upcoming_tv",     label: "Current & Upcoming TV Shows", endpoint: "/tv/on_the_air",                                           media: "tv",    cardType: "backdrop", category: "tv" },
  { id: "trending_week",   label: "Trending This Week",          subtitle: "What everyone is watching this week", endpoint: "/trending/all/week", media: "mixed", cardType: "poster", category: "all" },
  { id: "trending_movies", label: "Trending Movies",             endpoint: "/trending/movie/week",                                         media: "movie", cardType: "poster", category: "movie" },
  { id: "trending_tv",     label: "Trending TV Shows",           endpoint: "/trending/tv/week",                                            media: "tv",    cardType: "poster", category: "tv" },
  { id: "popular_movies",  label: "Popular Movies",              endpoint: "/movie/popular",                                               media: "movie", cardType: "poster", category: "movie" },
  { id: "popular_tv",      label: "Popular TV Shows",            endpoint: "/tv/popular",                                                  media: "tv",    cardType: "poster", category: "tv" },
  { id: "top_movies",      label: "Top 10 / Most Watched",       endpoint: "/movie/top_rated",                                             media: "movie", cardType: "poster", category: "movie" },
  { id: "top_tv",          label: "Top Rated TV Shows",          endpoint: "/tv/top_rated",                                                media: "tv",    cardType: "poster", category: "tv" },
  { id: "now_playing",     label: "Now Playing in Theatres",     endpoint: "/movie/now_playing",                                           media: "movie", cardType: "poster", category: "movie" },
  { id: "upcoming",        label: "Coming Soon",                 endpoint: "/movie/upcoming",                                              media: "movie", cardType: "poster", category: "movie" },
  { id: "action",          label: "Action & Thriller",           endpoint: "/discover/movie?with_genres=28,53",                            media: "movie", cardType: "poster", category: "movie" },
  { id: "scifi",           label: "Sci-Fi & Fantasy",            endpoint: "/discover/movie?with_genres=878,14",                           media: "movie", cardType: "poster", category: "movie" },
  { id: "kdrama",          label: "K-Drama Hits",                endpoint: "/discover/tv?with_origin_country=KR&with_genres=18",           media: "tv",    cardType: "poster", category: "tv" },
  { id: "cdrama",          label: "C-Drama",                     endpoint: "/discover/tv?with_origin_country=CN&with_genres=18",           media: "tv",    cardType: "poster", category: "tv" },
  { id: "jdrama",          label: "J-Drama",                     endpoint: "/discover/tv?with_origin_country=JP&with_genres=18",           media: "tv",    cardType: "poster", category: "tv" },
  { id: "bollywood",       label: "Bollywood Hits",              endpoint: "/discover/movie?with_origin_country=IN&with_original_language=hi", media: "movie", cardType: "poster", category: "movie" },
  { id: "tollywood",       label: "Tollywood Hits",              endpoint: "/discover/movie?with_origin_country=IN&with_original_language=te", media: "movie", cardType: "poster", category: "movie" },
  { id: "kollywood",       label: "Kollywood",                   endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ta", media: "movie", cardType: "poster", category: "movie" },
  { id: "mollywood",       label: "Mollywood",                   endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ml", media: "movie", cardType: "poster", category: "movie" },
  { id: "sandalwood",      label: "Kannada",                     endpoint: "/discover/movie?with_origin_country=IN&with_original_language=kn", media: "movie", cardType: "poster", category: "movie" },
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
  name           : "9CineJoy",
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
    section: "Live Television",
    items: [
      { id: "livetv", label: "Live TV", action: "page", target: "livetv", icon: "livetv" }
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

// ── BACKEND API RESOLVER WITH DYNAMIC FAILOVER & HEALTH RESILIENCE ────────
const PROD_STREAMX_BACKEND = "https://streamx-backend-ih2r.onrender.com";
const LOCAL_STREAMX_BACKEND = "http://127.0.0.1:3000";

let _verifiedBackendUrl = null;
let _backendFailoverTried = false;

function getStreamXBackendUrl() {
  const custom = localStorage.getItem("streamx_backend_url");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }

  if (_verifiedBackendUrl) {
    return _verifiedBackendUrl;
  }

  const isLocal = window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "" ||
    window.location.protocol === "file:";

  if (isLocal) {
    _probeLocalBackendAsync();
    // Default to production cloud backend until local is confirmed alive
    // This prevents instant "Failed to fetch" if user runs frontend without starting node on port 3000
    return _verifiedBackendUrl || PROD_STREAMX_BACKEND;
  }

  return PROD_STREAMX_BACKEND;
}

async function _probeLocalBackendAsync() {
  if (_backendFailoverTried) return;
  _backendFailoverTried = true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 600);
    const res = await fetch(`${LOCAL_STREAMX_BACKEND}/`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res.ok) {
      _verifiedBackendUrl = LOCAL_STREAMX_BACKEND;
    }
  } catch (e) {
    _verifiedBackendUrl = PROD_STREAMX_BACKEND;
  }
}

function handleBackendFailover(failedUrl) {
  if (failedUrl && failedUrl.includes("127.0.0.1:3000")) {
    console.warn("[Backend Failover] Local backend unreachable, switching to production cloud backend:", PROD_STREAMX_BACKEND);
    _verifiedBackendUrl = PROD_STREAMX_BACKEND;
    return PROD_STREAMX_BACKEND;
  } else if (failedUrl && failedUrl.includes("onrender.com")) {
    console.warn("[Backend Failover] Production backend error, trying local backend:", LOCAL_STREAMX_BACKEND);
    _verifiedBackendUrl = LOCAL_STREAMX_BACKEND;
    return LOCAL_STREAMX_BACKEND;
  }
  return PROD_STREAMX_BACKEND;
}

window.getStreamXBackendUrl = getStreamXBackendUrl;
window.getCineJoyBackendUrl = getStreamXBackendUrl;
window.handleBackendFailover = handleBackendFailover;