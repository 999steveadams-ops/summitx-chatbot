// Serves the public embed loader at GET /embed.js
// Host sites include:  <script src="https://APP/embed.js?id=TENANT_ID" async></script>
// The script reads its own ?id= and origin at runtime, so a single static file
// works for every tenant. It fetches /api/widget-config for per-tenant branding.

const SCRIPT = /* js */ `(function () {
  var current =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("/embed.js") !== -1) return scripts[i];
      }
      return null;
    })();
  if (!current) return;

  var url = new URL(current.src);
  var tenantId = url.searchParams.get("id");
  var base = url.origin;
  if (!tenantId) {
    console.error("[SummitX ChatBot] embed script is missing ?id=<tenantId>");
    return;
  }

  var ID = "summitx-chatbot-" + tenantId;

  // Guard against double-inject. A synchronous window flag is required: deferred
  // copies of this script all run before DOMContentLoaded, so a DOM check alone
  // would let each one mount its own widget.
  window.__summitxChatbot = window.__summitxChatbot || {};
  if (window.__summitxChatbot[tenantId] || document.getElementById(ID)) return;
  window.__summitxChatbot[tenantId] = true;

  var GREET_DELAY = 45000; // ms — never pop the greeting before this.
  var open = false;
  var greetShown = false;
  var cfg = { brandColor: "#4f46e5", logoUrl: null, launcherText: "Have any questions? Ask away!" };

  var CHAT_SVG =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5z" fill="#fff"/>' +
    '<circle cx="9" cy="9.5" r="1.2" fill="currentColor"/><circle cx="12" cy="9.5" r="1.2" fill="currentColor"/>' +
    '<circle cx="15" cy="9.5" r="1.2" fill="currentColor"/></svg>';
  var CLOSE_SVG =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';

  // ---- Launcher button ----
  var button = document.createElement("button");
  button.id = ID;
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:9999px;" +
    "border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
    "background:" + cfg.brandColor + ";box-shadow:0 8px 24px rgba(0,0,0,.28);" +
    "z-index:2147483646;transition:transform .15s ease;padding:0;color:" + cfg.brandColor + ";";
  button.innerHTML = CHAT_SVG;
  button.onmouseenter = function () { button.style.transform = "scale(1.06)"; };
  button.onmouseleave = function () { button.style.transform = "scale(1)"; };

  // ---- Greeting bubble (host page, above the launcher) ----
  var bubble = document.createElement("div");
  bubble.style.cssText =
    "position:fixed;bottom:92px;right:20px;max-width:240px;background:#fff;color:#111827;" +
    "font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 32px 12px 14px;" +
    "border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:2147483645;display:none;cursor:pointer;";
  var bubbleText = document.createElement("span");
  bubble.appendChild(bubbleText);
  var bubbleClose = document.createElement("span");
  bubbleClose.innerHTML = "&#10005;";
  bubbleClose.setAttribute("aria-label", "Dismiss");
  bubbleClose.style.cssText =
    "position:absolute;top:6px;right:8px;font-size:13px;color:#9ca3af;line-height:1;padding:2px;";

  var dismissKey = "summitx_greet_dismissed_" + tenantId;

  function hideBubble() { bubble.style.display = "none"; }
  function showBubble() {
    if (open || greetShown) return;
    try { if (localStorage.getItem(dismissKey)) return; } catch (e) {}
    bubbleText.textContent = cfg.launcherText;
    bubble.style.display = "block";
    greetShown = true;
  }
  bubbleClose.addEventListener("click", function (e) {
    e.stopPropagation();
    hideBubble();
    try { localStorage.setItem(dismissKey, "1"); } catch (e2) {}
  });
  bubble.addEventListener("click", function () { setOpen(true); });
  bubble.appendChild(bubbleClose);

  // ---- Chat panel (iframe) ----
  var frame = document.createElement("iframe");
  frame.title = "Chat";
  frame.src = base + "/widget/" + encodeURIComponent(tenantId);
  frame.style.cssText =
    "position:fixed;bottom:92px;right:20px;width:380px;height:600px;max-width:calc(100vw - 40px);" +
    "max-height:calc(100vh - 120px);border:none;border-radius:16px;overflow:hidden;" +
    "box-shadow:0 16px 48px rgba(0,0,0,.28);z-index:2147483646;display:none;background:#fff;";

  function setOpen(next) {
    open = next;
    frame.style.display = open ? "block" : "none";
    button.innerHTML = open ? CLOSE_SVG : (cfg.logoUrl ? launcherLogo() : CHAT_SVG);
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) hideBubble();
  }

  function launcherLogo() {
    return '<img src="' + cfg.logoUrl + '" alt="" style="width:60px;height:60px;border-radius:9999px;object-fit:cover;" />';
  }

  function applyConfig() {
    button.style.background = cfg.brandColor;
    button.style.color = cfg.brandColor;
    if (!open) button.innerHTML = cfg.logoUrl ? launcherLogo() : CHAT_SVG;
  }

  button.addEventListener("click", function () { setOpen(!open); });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(bubble);
    document.body.appendChild(button);

    // Fetch branding, then style the launcher.
    fetch(base + "/api/widget-config/" + encodeURIComponent(tenantId))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (d.brandColor) cfg.brandColor = d.brandColor;
        if (d.logoUrl) cfg.logoUrl = d.logoUrl;
        if (d.launcherText) cfg.launcherText = d.launcherText;
        applyConfig();
      })
      .catch(function () {});

    setTimeout(showBubble, GREET_DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
