/**
 * Build Full Live TV Catalogue from iptv-org API and verified stream sources
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "CineJoy-Catalog-Builder/2.0" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

// Special verified stream mappings for high-demand channels
const SPECIAL_CHANNEL_STREAMS = {
  "SunGemini.in": {
    url: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    altUrl: "http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8",
    logo: "https://sund-images.sunnxt.com/194396/300x300_SunGemini_194396_22c18c1e-7eb9-4855-9c4e-12e109911559.png",
    category: "Entertainment",
    language: "tel"
  },
  "GeminiTV.in": {
    url: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    altUrl: "http://iptvcasomsapi.jprdigital.in/x-media/C0568/master.m3u8",
    logo: "https://sund-images.sunnxt.com/194396/300x300_SunGemini_194396_22c18c1e-7eb9-4855-9c4e-12e109911559.png",
    category: "Entertainment",
    language: "tel"
  },
  "SunGeminiComedy.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0573/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Gemini_Comedy.png",
    category: "Comedy",
    language: "tel"
  },
  "GeminiComedy.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0573/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Gemini_Comedy.png",
    category: "Comedy",
    language: "tel"
  },
  "SunGeminiMovies.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MOVIES/images/LOGO_HD/image.png",
    category: "Movies",
    language: "tel"
  },
  "GeminiMovies.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MOVIES/images/LOGO_HD/image.png",
    category: "Movies",
    language: "tel"
  },
  "SunGeminiMusic.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0589/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MUSIC/images/LOGO_HD/image.png",
    category: "Music",
    language: "tel"
  },
  "GeminiMusic.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0589/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MUSIC/images/LOGO_HD/image.png",
    category: "Music",
    language: "tel"
  },
  "SunGeminiLife.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0584/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_LIFE/images/LOGO_HD/image.png",
    category: "General",
    language: "tel"
  },
  "GeminiLife.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0584/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_LIFE/images/LOGO_HD/image.png",
    category: "General",
    language: "tel"
  },
  "TejaTV.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0586/master.m3u8",
    altUrl: "http://ptuf.ridsys.in/riptv/live/GEMINI_TV/index.m3u8",
    logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_GEMINI_MOVIES/images/LOGO_HD/image.png",
    category: "Movies",
    language: "tel"
  },
  "SunTV.in": {
    url: "http://ptuf.ridsys.in/riptv/live/SUN_TV/index.m3u8",
    altUrl: "http://103.151.60.162:2122/play/a02a/index.m3u8?hls",
    logo: "https://dtil.tmsimg.com/assets/GNLZZGG002Z0M0Y.png?lock=720x540",
    category: "Entertainment",
    language: "tam"
  },
  "ZeeTelugu.in": {
    url: "http://iptvcasomsapi.jprdigital.in/x-media/C0537/master.m3u8",
    altUrl: "https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/ZeeTeluguHD.m3u8",
    logo: "https://dtil.tmsimg.com/assets/s52528_ld_h15_aa.png?lock=720x540",
    category: "Entertainment",
    language: "tel"
  }
};

async function build() {
  console.log("Loading country metadata...");
  const countryList = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
  const countryMap = new Map();
  countryList.forEach(c => countryMap.set(c.code.toUpperCase(), c));

  console.log("Loading current dataset...");
  const existingChannels = JSON.parse(fs.readFileSync("data/livetv_channels.json", "utf8"));
  const existingMap = new Map();
  existingChannels.forEach(c => {
    if (c.id) existingMap.set(c.id, c);
    // Also map base id without @quality
    const baseId = c.id.split("@")[0];
    if (!existingMap.has(baseId)) existingMap.set(baseId, c);
  });

  console.log("Fetching iptv-org channels and streams...");
  const [channels, streams] = await Promise.all([
    fetchJson("https://iptv-org.github.io/api/channels.json"),
    fetchJson("https://iptv-org.github.io/api/streams.json")
  ]);

  console.log(`Fetched ${channels.length} channels, ${streams.length} streams.`);

  // Index streams by channel ID
  const streamsByChannel = new Map();
  streams.forEach(s => {
    if (!s.channel) return;
    if (!streamsByChannel.has(s.channel)) streamsByChannel.set(s.channel, []);
    streamsByChannel.get(s.channel).push(s);
  });

  // Map of replaced_by references
  const replacedByMap = new Map();
  channels.forEach(c => {
    if (c.replaced_by) {
      replacedByMap.set(c.id, c.replaced_by);
    }
  });

  const finalChannels = [];
  const processedChannelIds = new Set();

  // First, add all channels from channels.json that:
  // a) Have direct streams in streams.json
  // b) Have a replacement channel with streams
  // c) Have special verified stream mapping
  // d) Exist in current dataset
  channels.forEach(ch => {
    const chId = ch.id;
    const special = SPECIAL_CHANNEL_STREAMS[chId];
    const streamList = streamsByChannel.get(chId) || (ch.replaced_by ? streamsByChannel.get(ch.replaced_by) : null);
    const existing = existingMap.get(chId);

    if (!special && !streamList && !existing) {
      return; // Skip channels without any stream or existing mapping
    }

    processedChannelIds.add(chId);

    // Pick best stream URL
    let streamUrl = "";
    let altStreamUrl = "";
    let quality = "";

    if (special) {
      streamUrl = special.url;
      altStreamUrl = special.altUrl || "";
    } else if (streamList && streamList.length > 0) {
      // Prefer HTTPS streams if available
      const httpsStream = streamList.find(s => s.url && s.url.startsWith("https://"));
      const chosen = httpsStream || streamList[0];
      streamUrl = chosen.url;
      quality = chosen.quality || "";
      if (streamList.length > 1) {
        const alt = streamList.find(s => s.url !== streamUrl);
        if (alt) altStreamUrl = alt.url;
      }
    } else if (existing) {
      streamUrl = existing.url;
    }

    if (!streamUrl) return;

    // Determine Country Metadata
    const cCode = (ch.country || "INT").toUpperCase();
    const cMeta = countryMap.get(cCode);
    const countryName = cMeta ? cMeta.name : (cCode === "INT" ? "International" : cCode);
    const flag = cMeta ? cMeta.flag : "🌐";

    // Determine Category
    let category = "General";
    if (special && special.category) {
      category = special.category;
    } else if (ch.categories && ch.categories.length > 0) {
      category = ch.categories[0].charAt(0).toUpperCase() + ch.categories[0].slice(1);
    } else if (existing && existing.category) {
      category = existing.category;
    }

    // Determine Language
    let language = "";
    if (special && special.language) {
      language = special.language;
    } else if (cMeta && cMeta.languages && cMeta.languages.length) {
      language = cMeta.languages[0];
    } else if (existing && existing.language) {
      language = existing.language;
    }

    // Logo
    let logo = "";
    if (special && special.logo) {
      logo = special.logo;
    } else if (existing && existing.logo) {
      logo = existing.logo;
    } else if (ch.network && ch.network.includes("Sun")) {
      logo = "https://sund-images.sunnxt.com/194396/300x300_SunGemini_194396_22c18c1e-7eb9-4855-9c4e-12e109911559.png";
    }

    // Alt Names & Aliases
    const altNames = Array.isArray(ch.alt_names) ? ch.alt_names.slice() : [];
    if (ch.network && !altNames.includes(ch.network)) {
      altNames.push(ch.network);
    }
    if (ch.replaced_by) {
      altNames.push(ch.replaced_by.replace(/\.[a-z]{2}$/i, ""));
    }
    // For Gemini channels, ensure Telugu and historical names are in altNames
    if (/gemini/i.test(ch.name || "") || /gemini/i.test(chId)) {
      if (!altNames.includes("Gemini")) altNames.push("Gemini");
      if (!altNames.includes("Sun Gemini")) altNames.push("Sun Gemini");
      if (!altNames.includes("Sun జెమినీ")) altNames.push("Sun జెమినీ");
      if (/comedy/i.test(ch.name || "")) {
        altNames.push("Gemini Comedy");
        altNames.push("Sun Gemini Comedy");
      }
      if (/movies/i.test(ch.name || "")) {
        altNames.push("Gemini Movies");
        altNames.push("Sun Gemini Movies");
      }
      if (/music/i.test(ch.name || "")) {
        altNames.push("Gemini Music");
        altNames.push("Sun Gemini Music");
      }
      if (/life/i.test(ch.name || "")) {
        altNames.push("Gemini Life");
        altNames.push("Sun Gemini Life");
      }
      if (/teja/i.test(ch.name || "")) {
        altNames.push("Teja TV");
        altNames.push("Gemini Movies");
      }
    }

    const item = {
      id: chId,
      name: ch.name || chId,
      altNames: altNames.length ? altNames : undefined,
      network: ch.network || undefined,
      logo: logo || undefined,
      category: category,
      language: language,
      country: cCode,
      countryName: countryName,
      flag: flag,
      url: streamUrl,
      altUrl: altStreamUrl || undefined,
      quality: quality || undefined,
      isHttps: streamUrl.startsWith("https://")
    };

    finalChannels.push(item);
  });

  // Second, preserve any existing channels from livetv_channels.json that were not matched
  existingChannels.forEach(ex => {
    const baseId = (ex.id || "").split("@")[0];
    if (!processedChannelIds.has(baseId) && !processedChannelIds.has(ex.id)) {
      finalChannels.push(ex);
    }
  });

  console.log(`Final combined catalogue has ${finalChannels.length} channels.`);

  // Test Gemini channels in final catalogue
  const geminiCh = finalChannels.filter(c => /gemini/i.test(c.name || "") || /gemini/i.test(c.id || ""));
  console.log("Gemini channels present in final catalogue:", geminiCh.length);
  geminiCh.forEach(g => {
    console.log(`  - [${g.id}] ${g.name} -> ${g.category} (${g.language}) [URL: ${g.url}]`);
  });

  // Write to data/livetv_channels.json
  const outPath = path.resolve("data/livetv_channels.json");
  fs.writeFileSync(outPath, JSON.stringify(finalChannels, null, 2), "utf8");
  console.log("Successfully updated data/livetv_channels.json!");
}

build().catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
