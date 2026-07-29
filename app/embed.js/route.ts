// Serves the public embed loader at GET /embed.js
// Host sites include:  <script src="https://APP/embed.js?id=TENANT_ID" async></script>
// The script reads its own ?id= and origin at runtime, so a single static file
// works for every tenant.

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

  // Guard against double-inject (e.g. the plugin plus a hand-pasted snippet).
  // A synchronous window flag is required: deferred copies of this script all
  // run before DOMContentLoaded, so a DOM check alone would let each one
  // register a listener and mount its own widget.
  window.__summitxChatbot = window.__summitxChatbot || {};
  if (window.__summitxChatbot[tenantId] || document.getElementById(ID)) return;
  window.__summitxChatbot[tenantId] = true;

  var open = false;

  // ---- Launcher button ----
  var button = document.createElement("button");
  button.id = ID;
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:9999px;" +
    "border:none;cursor:pointer;background:#111827;color:#fff;font-size:26px;line-height:60px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:2147483646;transition:transform .15s ease;";
  button.innerHTML = "&#128172;"; // speech balloon
  button.onmouseenter = function () { button.style.transform = "scale(1.06)"; };
  button.onmouseleave = function () { button.style.transform = "scale(1)"; };

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
    button.innerHTML = open ? "&#10005;" : "&#128172;"; // ✕ / balloon
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }

  button.addEventListener("click", function () { setOpen(!open); });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(button);
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
      // Cache at the edge; the script body is identical for all tenants.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
