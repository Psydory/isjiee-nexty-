// =========================
// CONFIG
// =========================
const COOKIE_KEY = "cookie_consent_v2";

// =========================
// GET / SET CONSENT
// =========================
function getConsent() {
  return localStorage.getItem(COOKIE_KEY);
}

function setConsent(value) {
  localStorage.setItem(COOKIE_KEY, value);
}

// =========================
// LOAD SCRIPTS
// =========================
function loadAdSense() {
  if (document.getElementById("adsenseScript")) return;

  const script = document.createElement("script");
  script.id = "adsenseScript";
  script.async = true;
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX";
  script.crossOrigin = "anonymous";

  document.head.appendChild(script);
}

// =========================
// OPTIONAL ANALYTICS
// =========================
function loadAnalytics() {
  console.log("Analytics loaded (placeholder)");
}

// =========================
// APPLY CONSENT
// =========================
function applyConsent(consent) {
  if (consent === "accepted") {
    loadAdSense();
    loadAnalytics();
  }
}

// =========================
// BANNER UI
// =========================
function createBanner() {

  const banner = document.createElement("div");

  banner.id = "cookieBanner";

  banner.style = `
    position:fixed;
    bottom:0;
    left:0;
    width:100%;
    background:#111;
    color:#fff;
    padding:20px;
    z-index:9999;
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
  `;

  banner.innerHTML = `
    <p style="max-width:600px;">
      Nous utilisons des cookies pour améliorer votre expérience,
      analyser le trafic et afficher des publicités personnalisées.
    </p>

    <div style="margin-top:10px;">
      <button id="acceptCookies">Accepter</button>
      <button id="refuseCookies">Refuser</button>
    </div>

    <div style="margin-top:10px;font-size:12px;">
      <a href="/privacy.html" style="color:cyan;">Privacy Policy</a> |
      <a href="/terms.html" style="color:cyan;">Terms</a>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById("acceptCookies").onclick = () => {
    setConsent("accepted");
    applyConsent("accepted");
    banner.remove();
  };

  document.getElementById("refuseCookies").onclick = () => {
    setConsent("refused");
    banner.remove();
  };
}

// =========================
// INIT
// =========================
export function initCookies() {

  const consent = getConsent();

  if (!consent) {
    createBanner();
  } else {
    applyConsent(consent);
  }
}