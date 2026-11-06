/**
 * StreamX v2 — config.js
 * All user-configurable settings live here.
 * NO movie/TV/anime datasets. All content comes from TMDB at runtime.
 */

// ── TMDB API ──────────────────────────────────────────────────────────────
const TMDB_API_KEY = ""; // https://www.themoviedb.org/settings/api
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

// Image size presets
const IMG = {
  poster_sm: `${TMDB_IMG}/w185`,
  poster_md: `${TMDB_IMG}/w342`,
  poster_lg: `${TMDB_IMG}/w500`,
  backdrop_sm: `${TMDB_IMG}/w780`,
  backdrop_lg: `${TMDB_IMG}/w1280`,
  still: `${TMDB_IMG}/w300`,
  profile: `${TMDB_IMG}/w185`,
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
// NXsha maintains secure sandbox restrictions (allow-scripts allow-same-origin allow-forms).
// External embed engines (CinemaOS, CineSrc, 0vidads, Vidy, Atlantic, VidCore, Mapple, etc.) are unsandboxed
// (sandbox: null) so they are not blocked by iframe sandbox restrictions or Cloudflare/storage checks.
const PROVIDER_SECURITY_CONFIG = {
  nxsha: {
    tested: true,
    status: "compatible",
    isDirect: false,
    sandbox: "allow-scripts allow-same-origin allow-forms",
    hasAds: false,
    adMechanism: "none",
    notes: "NXsha embed player (web.nxsha.app/embed). Sandboxed with allow-scripts allow-same-origin allow-forms to stop top-navigation redirects and new tab popups."
  },
  cinesrc: { tested: true, status: "compatible", sandbox: null },
  "0vidads": { tested: true, status: "compatible", sandbox: null },
  atlantic: { tested: true, status: "compatible", sandbox: null },
  cinemaos: { tested: true, status: "compatible", sandbox: null },
  vidcore: { tested: true, status: "compatible", sandbox: null },
  mapple: { tested: true, status: "compatible", sandbox: null },
  vidrift: { tested: true, status: "compatible", sandbox: null },
  vidy: { tested: true, status: "compatible", sandbox: null },
  cinezo: { tested: true, status: "compatible", sandbox: null },
  vidrock: { tested: true, status: "compatible", sandbox: null },
  velarium: { tested: true, status: "compatible", sandbox: null },
  stellar: { tested: true, status: "compatible", sandbox: null },
  fmov: { tested: true, status: "compatible", sandbox: null },
  vidup: { tested: true, status: "compatible", sandbox: null },
  "viduki-1": { tested: true, status: "compatible", sandbox: null },
  "viduki-2": { tested: true, status: "compatible", sandbox: null },
  "viduki-4": { tested: true, status: "compatible", sandbox: null }
};
window.PROVIDER_SECURITY_CONFIG = PROVIDER_SECURITY_CONFIG;

// Normalizes language preference to standard ISO 639-1 code accepted by NXsha
function normalizeNxshaLang(lang) {
  if (!lang) return null;
  const clean = String(lang).trim().toLowerCase();
  const map = {
    te: "te", telugu: "te",
    hi: "hi", hindi: "hi",
    ta: "ta", tamil: "ta",
    kn: "kn", kannada: "kn",
    ml: "ml", malayalam: "ml",
    en: "en", english: "en",
    es: "es", spanish: "es",
    fr: "fr", french: "fr",
    ko: "ko", korean: "ko",
    ja: "ja", japanese: "ja",
    zh: "zh", chinese: "zh"
  };
  return map[clean] || (/^[a-z]{2}$/.test(clean) ? clean : null);
}

const STREAM_SERVERS = [
  // ── 1ST PRIORITY (DEFAULT): NXSHA ──────────────────────────────────────────
  {
    key: "nxsha",
    label: "NXsha",
    category: "embed",
    isDirect: false,
    playbackType: "embed",
    recommended: true,
    desc: "NXsha Embed Engine · Direct Playback · Ad-Free",
    badge: "Direct 4K",
    color: "#f59e0b",
    supportedCategories: ["hollywood", "kdrama", "cdrama", "jdrama", "indian"],
    movie: (id, options = {}) => {
      const params = new URLSearchParams({
        disable_app_ad: "true",
        color: "#EBEAE6"
      });
      const rawLang = options.lang || localStorage.getItem("streamx_audio_lang");
      const isoLang = normalizeNxshaLang(rawLang);
      if (isoLang) params.set("lang", isoLang);

      const rawSub = options.sub || localStorage.getItem("streamx_sub_lang");
      const isoSub = normalizeNxshaLang(rawSub);
      if (isoSub) params.set("sub", isoSub);

      return `https://web.nxsha.app/embed/movie/${id}?${params.toString().replace(/%2523/g, "%23")}`;
    },
    tv: (id, s, e, options = {}) => {
      const params = new URLSearchParams({
        disable_app_ad: "true",
        color: "#EBEAE6"
      });
      const rawLang = options.lang || localStorage.getItem("streamx_audio_lang");
      const isoLang = normalizeNxshaLang(rawLang);
      if (isoLang) params.set("lang", isoLang);

      const rawSub = options.sub || localStorage.getItem("streamx_sub_lang");
      const isoSub = normalizeNxshaLang(rawSub);
      if (isoSub) params.set("sub", isoSub);

      return `https://web.nxsha.app/embed/tv/${id}/${s || 1}/${e || 1}?${params.toString().replace(/%2523/g, "%23")}`;
    },
    anime: (id, e, options = {}) => {
      return `https://web.nxsha.app/embed/tv/${id}/1/${e || 1}?disable_app_ad=true&color=%23EBEAE6`;
    }
  },

  // ── 2ND PRIORITY: CINESRC ──────────────────────────────────────────────────
  {
    key: "cinesrc",
    label: "CineSrc",
    category: "embed",
    badge: "HLS Stream",
    desc: "CineSrc Fast Engine · Clean Video Player",
    color: "#f59e0b",
    movie: (id) => `https://cinesrc.st/embed/movie/${id}?seek=15&autoplay=true&autonext=true&color=%23f59e0b`,
    tv: (id, s, e) => `https://cinesrc.st/embed/tv/${id}?s=${s || 1}&e=${e || 1}&seek=15&autoplay=true&autonext=true&color=%23f59e0b`,
    anime: (id, e) => `https://cinesrc.st/embed/tv/${id}?s=1&e=${e || 1}&seek=15&autoplay=true&autonext=true&color=%23f59e0b`
  },

  // ── VIDUKI API 1 (MULTI SERVER) ───────────────────────────────────────────
  {
    key: "viduki-1",
    label: "Viduki 1",
    category: "embed",
    badge: "Multi-Server",
    desc: "Viduki API 1 · Multi-Server Auto-Fallback",
    color: "#ef4444",
    movie: (id) => `https://viduki.net/1/movie/${id}?color=ff2a6d`,
    tv: (id, s, e) => `https://viduki.net/1/tv/${id}/${s || 1}/${e || 1}?color=ff2a6d`,
    anime: (id, e) => `https://viduki.net/1/tv/${id}/1/${e || 1}?color=ff2a6d`
  },

  // ── VIDUKI API 2 (MULTI LANGUAGE) ─────────────────────────────────────────
  {
    key: "viduki-2",
    label: "Viduki 2",
    category: "embed",
    badge: "Multi-Lang",
    desc: "Viduki API 2 · Multi-Language Audio & Dubs",
    color: "#f87171",
    movie: (id) => `https://viduki.net/2/movie/${id}?color=ff2a6d`,
    tv: (id, s, e) => `https://viduki.net/2/tv/${id}/${s || 1}/${e || 1}?color=ff2a6d`,
    anime: (id, e) => `https://viduki.net/2/tv/${id}/1/${e || 1}?color=ff2a6d`
  },

  // ── VIDUKI API 4 (PREMIUM EMBEDS) ─────────────────────────────────────────
  {
    key: "viduki-4",
    label: "Viduki 4",
    category: "embed",
    badge: "Premium",
    desc: "Viduki API 4 · Premium Fast Embeds",
    color: "#dc2626",
    movie: (id) => `https://viduki.net/4/movie/${id}?color=ff2a6d`,
    tv: (id, s, e) => `https://viduki.net/4/tv/${id}/${s || 1}/${e || 1}?color=ff2a6d`,
    anime: (id, e) => `https://viduki.net/4/tv/${id}/1/${e || 1}?color=ff2a6d`
  },

  // ── 3RD PRIORITY: 0VIDADS ──────────────────────────────────────────────────
  {
    key: "0vidads",
    label: "0vidads",
    category: "embed",
    badge: "Ad-Free",
    desc: "0vidads High-Speed Embed · Auto-Next",
    color: "#8B5CF6",
    movie: (id) => `https://0vidads.top/embed/movie/${id}`,
    tv: (id, s, e) => `https://0vidads.top/embed/tv/${id}/${s || 1}/${e || 1}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true`,
    anime: (id, e) => `https://0vidads.top/embed/tv/${id}/1/${e || 1}?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true`
  },

  // ── 3RD PRIORITY: ATLANTIC ────────────────────────────────────────────────
  {
    key: "atlantic",
    label: "Atlantic",
    category: "embed",
    badge: "Fast HD",
    desc: "Atlantic Engine · Clean Video Stream",
    color: "#38bdf8",
    movie: (id) => `https://atlantic.st/embed/movie/${id}`,
    tv: (id, s, e) => `https://atlantic.st/embed/tv/${id}/${s || 1}/${e || 1}`,
    anime: (id, e) => `https://atlantic.st/embed/tv/${id}/1/${e || 1}`
  },

  // ── 4TH PRIORITY: CINEMAOS ────────────────────────────────────────────────
  {
    key: "cinemaos",
    label: "CinemaOS",
    category: "embed",
    badge: "Cinema Pro",
    desc: "CinemaOS Fast Responsive Player",
    color: "#ffffff",
    movie: (id) => `https://cinemaos.tech/player/${id}?theme=ffffff`,
    tv: (id, s, e) => `https://cinemaos.tech/player/${id}/${s || 1}/${e || 1}?theme=ffffff`,
    anime: (id, e) => `https://cinemaos.tech/player/${id}/1/${e || 1}?theme=ffffff`
  },

  // ── VIDCORE ───────────────────────────────────────────────────────────────
  {
    key: "vidcore",
    label: "VidCore",
    category: "embed",
    badge: "EdgeOne CDN",
    desc: "VidCore High-Speed Streaming Mirror",
    color: "#3b82f6",
    movie: (id) => `https://vidcore.io/movie/${id}?autoPlay=true`,
    tv: (id, s, e) => `https://vidcore.io/tv/${id}/${s || 1}/${e || 1}?autoPlay=true`,
    anime: (id, e) => `https://vidcore.io/tv/${id}/1/${e || 1}?autoPlay=true`
  },

  // ── MAPPLE ────────────────────────────────────────────────────────────────
  {
    key: "mapple",
    label: "Mapple",
    category: "embed",
    badge: "Auto-Next",
    desc: "Mapple Direct Cloud Player",
    color: "#10b981",
    movie: (id) => `https://mapple.fun/watch/movie/${id}?autoPlay=true`,
    tv: (id, s, e) => `https://mapple.fun/watch/tv/${id}-${s || 1}-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`,
    anime: (id, e) => `https://mapple.fun/watch/tv/${id}-1-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`
  },

  // ── 5TH PRIORITY: VIDRIFT ─────────────────────────────────────────────────
  {
    key: "vidrift",
    label: "VidRift",
    category: "embed",
    badge: "Multi-Source",
    desc: "VidRift Stream · Built-In Servers & Failover",
    color: "#00d1b2",
    movie: (id) => `https://embed.vidrift.net/embed/movie/${id}?exit=1`,
    tv: (id, s, e) => `https://embed.vidrift.net/embed/tv/${id}/${s || 1}/${e || 1}?exit=1`,
    anime: (id, e) => `https://embed.vidrift.net/embed/anilist/${id}/${e || 1}?exit=1`
  },

  // ── 6TH PRIORITY: VIDY ───────────────────────────────────────────────────
  {
    key: "vidy",
    label: "Vidy",
    category: "embed",
    badge: "StreamX",
    desc: "Vidy Engine · Progress Tracking & Episodes",
    color: "#DC2626",
    movie: (id) => `https://vidy.st/movie/${id}?color=DC2626&autoplay=true`,
    tv: (id, s, e) => `https://vidy.st/tv/${id}/${s || 1}/${e || 1}?nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true&color=DC2626&autoplay=true`,
    anime: (id, e) => `https://vidy.st/anime/${id}/${e || 1}?color=DC2626&episodeSelector=true&autoplay=true`
  },

  // ── 7TH PRIORITY: CINEZO ──────────────────────────────────────────────────
  {
    key: "cinezo",
    label: "Cinezo",
    category: "embed",
    badge: "Universal",
    desc: "Cinezo Live Stream · Multi-server & Chromecast",
    color: "#e8b86d",
    movie: (id) => `https://player.cinezo.live/embed/movie/${id}?autoplay=true&poster=true&chromecast=true`,
    tv: (id, s, e) => `https://player.cinezo.live/embed/tv/${id}/${s || 1}/${e || 1}?autoplay=true&poster=true&chromecast=true&nextButton=true`,
    anime: (id, e) => `https://player.cinezo.live/embed/anime/${id}/${e || 1}?dub=true&autoplay=true`
  },

  // ── 8TH PRIORITY: VIDROCK ─────────────────────────────────────────────────
  {
    key: "vidrock",
    label: "VidRock",
    category: "embed",
    badge: "Cloud Stream",
    desc: "VidRock High-Speed Mirror",
    color: "#f8fafc",
    movie: (id) => `https://vidrock.net/movie/${id}?autoplay=true`,
    tv: (id, s, e) => `https://vidrock.net/tv/${id}/${s || 1}/${e || 1}?autoplay=true&autonext=true`,
    anime: (id, e) => `https://vidrock.net/tv/${id}/1/${e || 1}?autoplay=true&autonext=true`
  },

  // ── 9TH PRIORITY: VELARIUM ────────────────────────────────────────────────
  {
    key: "velarium",
    label: "Velarium",
    category: "embed",
    badge: "4K Master",
    desc: "Velarium Global Master · Intros & Outros Skipped",
    color: "#A8E6CF",
    movie: (id) => `https://velarium.cc/en/watch/movie/${id}?autoPlay=true&title=true&poster=true`,
    tv: (id, s, e) => `https://velarium.cc/en/watch/tv/${id}-${s || 1}-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`,
    anime: (id, e) => `https://velarium.cc/en/watch/tv/${id}-1-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`
  },

  // ── 10TH PRIORITY: STELLAR ────────────────────────────────────────────────
  {
    key: "stellar",
    label: "Stellar",
    category: "embed",
    badge: "Ad-Free",
    desc: "Stellar 4K Player · Ultra-Clean Stream",
    color: "#9B8CFF",
    movie: (id) => `https://stellar.rip/en/watch/embed/movie/${id}?autoPlay=true&title=true&poster=true`,
    tv: (id, s, e) => `https://stellar.rip/en/watch/embed/tv/${id}-${s || 1}-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`,
    anime: (id, e) => `https://stellar.rip/en/watch/embed/tv/${id}-1-${e || 1}?autoPlay=true&autoNext=true&nextButton=true`
  },

  // ── 11TH PRIORITY: FMOV ───────────────────────────────────────────────────
  {
    key: "fmov",
    label: "FMOV",
    category: "embed",
    badge: "Vector Core",
    desc: "FMOV High-Speed Failover Engine",
    color: "#14b8a6",
    movie: (id) => `https://fmov.my/embed/movie/${id}?autoplay=1&color=14b8a6`,
    tv: (id, s, e) => `https://fmov.my/embed/series/${id}/${s || 1}/${e || 1}?autoplay=1&color=14b8a6&autoplayNextEpisode=true`,
    anime: (id, e) => `https://fmov.my/embed/anime/${id}/${e || 1}?autoplay=1&color=14b8a6&autoplayNextEpisode=true`
  },

  // ── VIDUP ──────────────────────────────────────────────────
  {
    key: "vidup",
    label: "VidUp",
    category: "embed",
    badge: "Direct Play",
    desc: "VidUp Stream · Seamless Autoplay",
    color: "#FF0000",
    movie: (id) => `https://vidup.to/movie/${id}?autoPlay=true&theme=FF0000`,
    tv: (id, s, e) => `https://vidup.to/tv/${id}/${s || 1}/${e || 1}?autoPlay=true&nextButton=true&autoNext=true&theme=FF0000`,
    anime: (id, e) => `https://vidup.to/tv/${id}/1/${e || 1}?autoPlay=true&nextButton=true&autoNext=true&theme=FF0000`
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
    key: "nxsha_dl",
    label: "Moobies (Nxsha DL)",
    icon: "",
    desc: "Direct Download · 1080p/4K Multi-Node",
    color: "#f59e0b",
    url: (item, currentSeason = 1, currentEpisode = 1) => {
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
    key: "vidvault",
    label: "VidVault",
    icon: "",
    desc: "Direct Download · Works with TMDB ID",
    color: "#00d2ff",
    url: (item, currentSeason = 1, currentEpisode = 1) => {
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
  },
  {
    id: "peacock",
    name: "Peacock",
    headline: "Only on Peacock",
    tagline: "Stream hit movies, current NBC shows, live sports & originals",
    providerId: "386|387",
    color: "#000000",
    accentColor: "#e5a823",
    badgeLabel: "Peacock Original",
    logoHtml: `<span class="platform-logo-txt peacock-txt">peacock</span>`
  },
  {
    id: "crunchyroll",
    name: "Crunchyroll",
    headline: "Anime on Crunchyroll",
    tagline: "The world's largest anime library & simulcasts",
    providerId: "283",
    color: "#F47521",
    accentColor: "#f97316",
    badgeLabel: "Crunchyroll",
    logoHtml: `<span class="platform-logo-txt cr-txt">CRUNCHYROLL</span>`
  },
  {
    id: "starz",
    name: "Starz",
    headline: "Only on Starz",
    tagline: "Obsession-worthy original series and hit movies",
    providerId: "43",
    color: "#002D32",
    accentColor: "#06b6d4",
    badgeLabel: "Starz",
    logoHtml: `<span class="platform-logo-txt starz-txt">STARZ</span>`
  },
  {
    id: "amc",
    name: "AMC+",
    headline: "Only on AMC+",
    tagline: "The best of AMC, BBC America, IFC Films & Sundance",
    providerId: "528",
    color: "#004750",
    accentColor: "#14b8a6",
    badgeLabel: "AMC+ Original",
    logoHtml: `<span class="platform-logo-txt amc-txt">amc+</span>`
  },
  {
    id: "mgm",
    name: "MGM+",
    headline: "Only on MGM+",
    tagline: "Acclaimed series, hit movies and original docs",
    providerId: "584",
    color: "#1A1A1A",
    accentColor: "#fbbf24",
    badgeLabel: "MGM+",
    logoHtml: `<span class="platform-logo-txt mgm-txt">MGM+</span>`
  },
  {
    id: "tubi",
    name: "Tubi TV",
    headline: "Watch on Tubi",
    tagline: "1000s of free movies and hit TV shows",
    providerId: "73",
    color: "#501258",
    accentColor: "#eab308",
    badgeLabel: "Tubi",
    logoHtml: `<span class="platform-logo-txt tubi-txt">tubi</span>`
  },
  {
    id: "pluto",
    name: "Pluto TV",
    headline: "Watch on Pluto TV",
    tagline: "Drop in to 100s of channels and 1000s of movies free",
    providerId: "300",
    color: "#000000",
    accentColor: "#facc15",
    badgeLabel: "Pluto",
    logoHtml: `<span class="platform-logo-txt pluto-txt">pluto tv</span>`
  }
];

// Home page row configuration — drives what TMDB endpoints are called
const HOME_ROWS = [
  { id: "upcoming_tv", label: "Current & Upcoming TV Shows", endpoint: "/tv/on_the_air", media: "tv", cardType: "backdrop", category: "tv" },
  { id: "trending_week", label: "Trending This Week", subtitle: "What everyone is watching this week", endpoint: "/trending/all/week", media: "mixed", cardType: "poster", category: "all" },
  { id: "trending_movies", label: "Trending Movies", endpoint: "/trending/movie/week", media: "movie", cardType: "poster", category: "movie" },
  { id: "trending_tv", label: "Trending TV Shows", endpoint: "/trending/tv/week", media: "tv", cardType: "poster", category: "tv" },
  { id: "popular_movies", label: "Popular Movies", endpoint: "/movie/popular", media: "movie", cardType: "poster", category: "movie" },
  { id: "popular_tv", label: "Popular TV Shows", endpoint: "/tv/popular", media: "tv", cardType: "poster", category: "tv" },
  { id: "top_movies", label: "Top 10 / Most Watched", endpoint: "/movie/top_rated", media: "movie", cardType: "poster", category: "movie" },
  { id: "top_tv", label: "Top Rated TV Shows", endpoint: "/tv/top_rated", media: "tv", cardType: "poster", category: "tv" },
  { id: "now_playing", label: "Now Playing in Theatres", endpoint: "/movie/now_playing", media: "movie", cardType: "poster", category: "movie" },
  { id: "upcoming", label: "Coming Soon", endpoint: "/movie/upcoming", media: "movie", cardType: "poster", category: "movie" },
  { id: "action", label: "Action & Thriller", endpoint: "/discover/movie?with_genres=28,53", media: "movie", cardType: "poster", category: "movie" },
  { id: "scifi", label: "Sci-Fi & Fantasy", endpoint: "/discover/movie?with_genres=878,14", media: "movie", cardType: "poster", category: "movie" },
  { id: "kdrama", label: "K-Drama Hits", endpoint: "/discover/tv?with_origin_country=KR&with_genres=18", media: "tv", cardType: "poster", category: "tv" },
  { id: "cdrama", label: "C-Drama", endpoint: "/discover/tv?with_origin_country=CN&with_genres=18", media: "tv", cardType: "poster", category: "tv" },
  { id: "jdrama", label: "J-Drama", endpoint: "/discover/tv?with_origin_country=JP&with_genres=18", media: "tv", cardType: "poster", category: "tv" },
  { id: "bollywood", label: "Bollywood Hits", endpoint: "/discover/movie?with_origin_country=IN&with_original_language=hi", media: "movie", cardType: "poster", category: "movie" },
  { id: "tollywood", label: "Tollywood Hits", endpoint: "/discover/movie?with_origin_country=IN&with_original_language=te", media: "movie", cardType: "poster", category: "movie" },
  { id: "kollywood", label: "Kollywood", endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ta", media: "movie", cardType: "poster", category: "movie" },
  { id: "mollywood", label: "Mollywood", endpoint: "/discover/movie?with_origin_country=IN&with_original_language=ml", media: "movie", cardType: "poster", category: "movie" },
  { id: "sandalwood", label: "Kannada", endpoint: "/discover/movie?with_origin_country=IN&with_original_language=kn", media: "movie", cardType: "poster", category: "movie" },
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
  { id: "horror", label: "Horror", endpoint: "/discover/movie?with_genres=27", media: "movie" },
  { id: "comedy", label: "Comedy", endpoint: "/discover/movie?with_genres=35", media: "movie" },
  { id: "documentary", label: "Documentaries", endpoint: "/discover/movie?with_genres=99", media: "movie" },
];

// Dedicated Anime & Donghua Rows Configuration
const ANIME_ROWS = [
  { id: "anime_trending", label: "Trending Anime", endpoint: "/trending", media: "anime" },
  { id: "anime_popular", label: "Popular Anime", endpoint: "/popular", media: "anime" },
  { id: "anime_top", label: "Top Rated Anime", endpoint: "/popular?sort=SCORE_DESC", media: "anime" },
  { id: "anime_airing", label: "Currently Airing", endpoint: "/airing", media: "anime" },
  { id: "anime_upcoming", label: "Upcoming Anime", endpoint: "/upcoming", media: "anime" },
  { id: "donghua_trending", label: "Trending Donghua", endpoint: "/trending?origin=CN", media: "donghua" },
  { id: "donghua_popular", label: "Popular Donghua", endpoint: "/popular?origin=CN", media: "donghua" },
  { id: "donghua_top", label: "Top Rated Donghua", endpoint: "/popular?sort=SCORE_DESC&origin=CN", media: "donghua" },
  { id: "donghua_airing", label: "Currently Airing Donghua", endpoint: "/airing?origin=CN", media: "donghua" },
  { id: "donghua_upcoming", label: "Upcoming Donghua", endpoint: "/upcoming?origin=CN", media: "donghua" }
];

// App settings
const APP_CONFIG = {
  name: "CineJoy",
  version: "2.0",
  items_per_row: 20,       // items fetched per row
  hero_count: 8,        // number of hero banner items to rotate
  search_debounce: 400,      // ms debounce on search input
  history_limit: 50,       // max items in continue watching
  img_lazy_root: null,     // IntersectionObserver root
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
    // When running on localhost, default to local backend on port 3000
    return _verifiedBackendUrl || LOCAL_STREAMX_BACKEND;
  }

  return PROD_STREAMX_BACKEND;
}

async function _probeLocalBackendAsync() {
  if (_backendFailoverTried) return;
  _backendFailoverTried = true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${LOCAL_STREAMX_BACKEND}/`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res.ok) {
      _verifiedBackendUrl = LOCAL_STREAMX_BACKEND;
    }
  } catch (e) {
    // When running locally, remain pinned to local backend to avoid breaking local dev endpoints
    const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
    _verifiedBackendUrl = isLocal ? LOCAL_STREAMX_BACKEND : PROD_STREAMX_BACKEND;
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