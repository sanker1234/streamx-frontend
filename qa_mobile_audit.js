// Injected by qa harness — audits a frame document for REAL mobile issues.
// Overflow is only a bug when no horizontally-scrollable ancestor absorbs it.
(function () {
  function isHorizontalScroller(el) {
    var cs = el.ownerDocument.defaultView.getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2;
  }
  function absorbedByScroller(el) {
    var p = el.parentElement;
    while (p && p !== el.ownerDocument.body) {
      if (isHorizontalScroller(p)) return true;
      p = p.parentElement;
    }
    return false;
  }
  function audit(win) {
    var d = win.document, vw = win.innerWidth;
    var out = { viewport: vw + "x" + win.innerHeight, realOverflows: [], clippedText: [], tinyFonts: 0, smallTargets: [], hscroll: d.documentElement.scrollWidth > vw + 2 };
    var els = d.querySelectorAll("button, a, input, select, [onclick], .pm-tab, .dl-btn, .srv-btn, .sx-error-retry-btn, .sx-provider-pill");
    var seen = {};
    for (var i = 0; i < els.length; i++) {
      var el = els[i], r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var key = (el.className || el.tagName) + "@" + Math.round(r.left);
      if (seen[key]) continue;
      seen[key] = 1;
      if (r.right > vw + 4 && r.width > 24 && !absorbedByScroller(el)) {
        out.realOverflows.push({ tag: el.tagName, cls: String(el.className).slice(0, 44), right: Math.round(r.right), w: Math.round(r.width) });
      }
      var isTap = el.tagName === "BUTTON" || el.tagName === "A" || el.hasAttribute("onclick");
      if (isTap && (r.height < 34 || r.width < 34) && out.smallTargets.length < 8) {
        out.smallTargets.push({ cls: String(el.className).slice(0, 36), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    var leaves = d.querySelectorAll("h1,h2,h3,h4,p,span,td,li,label");
    var checked = 0;
    for (var j = 0; j < leaves.length && checked < 500; j++) {
      var t = leaves[j];
      if (t.children.length || !t.textContent.trim()) continue;
      checked++;
      var cs = win.getComputedStyle(t);
      if (parseFloat(cs.fontSize) < 10.5) out.tinyFonts++;
      if (t.scrollWidth > t.clientWidth + 6 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && t.clientWidth > 0 && out.clippedText.length < 8) {
        out.clippedText.push({ cls: String(t.className).slice(0, 36), txt: t.textContent.trim().slice(0, 28), sw: t.scrollWidth, cw: t.clientWidth });
      }
    }
    // de-dup overflow list
    var uniq = {}; out.realOverflows = out.realOverflows.filter(function (o) { var k = o.cls + o.w; if (uniq[k]) return false; uniq[k] = 1; return true; }).slice(0, 8);
    return out;
  }
  window.__mobileAudit = audit;
})();
