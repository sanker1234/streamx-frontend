# CineJoy — Third-Party Streaming Server Audit Report

**Audit Date:** October 16, 2026  
**Auditor:** CineJoy Architecture & Quality Assurance  
**Target Environment:** `https://9cinejoy.pages.dev/` (Frontend: `streamx-v2`)  
**Standard Test Content:** *Fight Club* (TMDB ID: `550`) / TV Season 1, Episode 1  

---

## Executive Summary

An audit of all 12 third-party streaming server integrations configured in CineJoy was conducted using static code analysis, network header checks, and live payload analysis. 

The audit focused on:
1. **Embed URL generation & endpoint validity**
2. **Playback reliability & anti-sandbox detection**
3. **Unwanted advertising tabs & popunder mechanics**
4. **Availability of authorized direct-stream APIs (HLS/MP4)**

### Key Findings:
- **Clean / Recommended Providers:** **VidLink Pro**, **CineSrc**, and **VidCore** load streams without spawning unwanted advertising tabs or popunders.
- **Unwanted Ad Popunder Mechanisms:** **Videm**, **2Embed**, **FilmU**, **VidBolt**, **SmashyStream**, and **CodeSpecters** actively execute popunders or inject ad scripts (`tagivi`, `profiton`, `miscoinbrassic`, `adsterra`, or `window.open`).
- **Anti-Sandbox Blocks:** Providers that show ads actively check if their iframe is sandboxed (`hasAttribute('sandbox')`, `isReallySandboxed()`, or `opaqueOrigin()`). When sandboxed without popups/storage, they halt playback with error screens. Global sandboxing is therefore incompatible with these providers.
- **Direct-Playback Support:** None of the 12 third-party providers offer a documented, authorized direct-stream API (raw `.m3u8` or `.mp4` endpoints) for external custom video players; all operate as proprietary iframe embed services. (CineJoy's **Nxsha / Moobies** integration remains the sole provider supporting custom brand parameters, language selection, and an authorized download endpoint).

---

## Provider Audit Matrix

Statuses used:
- **PASS** — Verified working / verified clean.
- **FAIL** — Verified failure / verified intrusive ads.
- **UNKNOWN** — Insufficient evidence / endpoint unresponsive.
- **NOT IMPLEMENTED** — No integration found in codebase.

| Provider | Implementation Status | Playback Status | Unwanted New Tab | Fullscreen / Subtitles | Direct-Playback Support | Verified Evidence & Findings |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **VidLink Pro** (`vidlink`) | **PASS** | **PASS** | **PASS** | **PASS** | **FAIL** | HTTP 200 (83.6 KB). Next.js HLS player. Zero advertising scripts or `window.open` calls. Multi-subtitles and fullscreen work. If strict sandbox is applied, internal storage triggers an error; runs cleanly when unsandboxed. |
| **CineSrc** (`cinesrc`) | **PASS** | **PASS** | **PASS** | **PASS** | **FAIL** | HTTP 200 (19.6 KB). High-speed Next.js player. Zero advertising popunders or `window.open` calls. Quality selection, multi-language subtitles, and fullscreen work cleanly. |
| **VidCore** (`vidcore`) | **PASS** | **PASS** | **PASS** | **PASS** | **FAIL** | HTTP 200 (497 B). EdgeOne hosted player wrapper. Streams cleanly without unwanted tabs. Fullscreen works. |
| **VidBolt** (`vidbolt`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 200 (8.3 KB). Injects `miscoinbrassic` popunder ad script. Checks `sandboxed=false; if(framed)...`. Halts playback if run in sandbox. |
| **Videm** (`videm`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 200 (103.4 KB). Injects `tagivi.com` popunder script. Contains explicit `sandboxVerdict()` and `sandboxDeny()` blocking playback with: *"Sandbox is not allowed: Remove the sandbox attribute"*. Spawns popunder via `window.open('about:blank', '_blank')`. |
| **FilmU Embed** (`filmu`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 200 (8.4 KB). Injects ProfitOn ad scripts. Contains explicit `// ── Sandbox Blocker ──` detecting sandbox via `localStorage`/`indexedDB` exceptions and halting playback. |
| **CodeSpecters** (`codespecters`) | **PASS** | **FAIL** | **FAIL** | **UNKNOWN** | **FAIL** | HTTP 200 (20.1 KB). Injects Adsterra popunder network and AdShield overlay. Line 453 explicitly executes `window.open(adUrl, '_blank')` upon clicking play. Demo key `DEMO_36c18c68` is also forbidden outside preview domain. |
| **SmashyStream** (`smashystream`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 301 redirects to `https://anyembed.xyz/embed/tmdb-movie-550`. Injects ProfitOn domain verification and ad network popunders. |
| **2Embed** (`twoembed`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 200 (8.7 KB). Injects `tagivi.com` ad script. Employs `isReallySandboxed()` checking `fe.hasAttribute('sandbox')` and halting playback with *"Sandbox not allowed"*. Floating click-jack overlays use `target="_blank"`. |
| **EmbedMaster** (`embedmaster`) | **PASS** | **FAIL** (sandboxed)<br>**PASS** (unsandboxed) | **FAIL** | **PASS** | **FAIL** | HTTP 302 redirects to `embdmstrplayer.com`. Spawns popunder ad tabs on user play interaction. |
| **VidSrc** (`vidsrcsbs` / `vidsrc`) | **PASS** | **FAIL** | **FAIL** | **UNKNOWN** | **FAIL** | Configured domain `vidsrc.sbs` is dead (`ENOTFOUND vidsrc.sbs`). Mirror `vidsrc.to` returns 200 but uses intermediate multi-server redirects (`rcp` embed) with ad overlays. |
| **StreamFliz** (`streamflizo`) | **PASS** | **FAIL** | **UNKNOWN** | **FAIL** | **FAIL** | HTTP 400 Bad Request ("Invalid Request"). Endpoint is broken/unreachable. |

---

## Detailed Task Breakdown

### TASK 1 — Architectural Mapping

- **Server Definitions:**
  - Defined in `[streamx-v2/js/config.js](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/config.js#L192-L360)` in the `STREAM_SERVERS` array.
  - Security, sandbox registry, and ad classification documented in `PROVIDER_SECURITY_CONFIG` (`[streamx-v2/js/config.js](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/config.js#L75-L189)`).
- **Embed URL Generation:**
  - Configured per-server via closures: `movie: (id, options) => ...` and `tv: (id, s, e, options) => ...` in `STREAM_SERVERS`.
  - Resolved dynamically in `[streamx-v2/js/player.js](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/player.js#L971-L978)` via `_getSelectedServerUrl()` and `_resolveServerUrl()`.
- **Iframe Creation & Mounting:**
  - Declared initially in `_renderFull()` at `[streamx-v2/js/player.js:L339-348](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/player.js#L339-L348)`.
  - Dynamically re-created and swapped inside `onProviderChange()` (`[streamx-v2/js/player.js:L1027-L1046](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/player.js#L1027-L1046)`) to update permissions and ensure clean sandbox lifecycle transitions.
- **ID & Episode Handling:**
  - Movies: TMDB numeric ID (`_details.id`) passed to `server.movie(id)`.
  - TV Shows: TMDB show ID (`_details.id`), season (`_season`), and episode (`_episode`) passed to `server.tv(id, s, e)`.
- **Server Persistence & Selection:**
  - Persisted in browser `localStorage` under `streamx_provider` and `streamx_server`.
  - Switched via `#pm-provider-select` dropdown or `#pm-stream-tab` buttons calling `Player.onProviderChange()`.

---

### TASK 2 & 3 — Investigation of Unwanted New Tabs

1. **Root Cause Analysis:**
   - CineJoy's own JavaScript (`app.js`, `player.js`, `config.js`) contains **zero** `window.open()` or `target="_blank"` triggers during playback.
   - Unwanted new tabs originate **100% inside third-party provider iframes**:
     - **Videm:** Calls `window.open('about:blank', '_blank')` and loads `tagivi.com`.
     - **CodeSpecters:** AdShield click listener calls `window.open(adUrl, '_blank')`.
     - **2Embed:** Injects floating transparent overlays with `target="_blank"`.
     - **VidBolt & FilmU:** Inject `miscoinbrassic` and `ProfitOn` click-tracking scripts that spawn background popunders on the first user interaction.
2. **Sandbox Feasibility:**
   - Applying `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` (omitting `allow-popups`) successfully prevents the browser from opening new tabs.
   - **However**, 6 of the 12 providers actively inspect the DOM for sandboxing (`frameElement.hasAttribute('sandbox')`, `isReallySandboxed()`, or storage access checks). Upon detecting the sandbox, they immediately cease playback and display an error screen demanding the sandbox be removed.
   - **Conclusion:** Global iframe sandboxing cannot be applied without breaking these providers. CineJoy's architecture isolates compatibility policies per provider in `PROVIDER_SECURITY_CONFIG` and flags ad-heavy providers as `[Popups Required]` in the UI.

---

### TASK 4 — Custom Player Candidates & Direct-Stream APIs

| Provider | Public Documentation | Playable HLS / MP4 API | Subtitle / Quality API | Licensing / Auth | Assessment |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **VidLink Pro** | Embed docs available | No (encapsulated) | Via postMessage | None required | Excellent embed player; no authorized raw HLS stream extraction. |
| **CineSrc** | Embed docs available | No | Encapsulated in UI | None required | Excellent embed player; no public REST API for raw streams. |
| **Nxsha (Moobies)** | Full REST / Embed API | Embed + Direct Download | Multi-lang query params | Free (`disable_app_ad=true`) | Recommended primary provider. Supports custom brand colors, multi-audio, and download endpoints. |
| **VidCore** | None | No | Encapsulated in UI | None required | Embed iframe only. |
| **All Others** | None (Ad-monetized) | No | None | Unauthorized | Unsuitable for direct custom players. |

---

### TASK 5 & 6 — Actions & Applied Fixes

1. **Fixed Dead VidSrc Domain:**
   - Updated `vidsrcsbs` from dead domain `https://vidsrc.sbs` to active mirror `https://vidsrc.to` in `[js/config.js](file:///Users/ajayboddapati/Documents/STRX%20copy%202/streamx-v2/js/config.js)`.
2. **Eliminated SmashyStream 301 Redirect:**
   - Updated SmashyStream embed generator to target the canonical endpoint `https://anyembed.xyz/embed/tmdb-movie-${id}` directly, removing unnecessary HTTP redirect latency.
3. **Preserved Working Servers & Safe Sandbox Isolation:**
   - Clean providers (**Moobies / Nxsha**, **CineSrc**, **VidLink Pro**, **VidCore**) remain prioritized as "Recommended".
   - Ad-heavy servers remain functional but transparently labeled `[Popups Required]` without breaking user choice.
4. **Player Lifecycle & Cleanup:**
   - Verified that `Player.close()` and `Player.open()` detach previous iframe contexts and clean up event listeners to prevent duplicate stream playback or background audio leaks.
