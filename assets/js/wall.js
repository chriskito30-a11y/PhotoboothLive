import { $, escapeHtml, getSessionIdFromUrl, getWallState, publicUrl, qrUrl, isExpired } from "./core.js";

const sessionId = getSessionIdFromUrl();
let currentIndex = 0;
let items = [];
let publicSession = null;
let expiryTimer = 0;
let refreshTimer = 0;

async function boot() {
  if (!sessionId) return renderUnavailable("Session manquante.");
  await refreshWall();
  refreshTimer = window.setInterval(() => {
    refreshWall().catch((error) => {
      console.warn(error);
      renderUnavailable("Galerie expirée ou indisponible.");
    });
  }, 4000);
  window.setInterval(nextSlide, 5000);
}

async function refreshWall() {
  const state = await getWallState(sessionId);
  if (!state || isExpired(state)) return renderUnavailable("Galerie expirée ou indisponible.");
  publicSession = state;
  items = Array.isArray(state.gallery) ? state.gallery : [];
  renderMetadata(publicSession);
  renderGallery();
}

function renderUnavailable(message) {
  window.clearInterval(refreshTimer);
  document.body.innerHTML = `<main class="wall-screen"><section class="access-card"><h1>PhotoboothLive</h1><p>${escapeHtml(message)}</p></section></main>`;
}

function renderMetadata(session) {
  $("#title").textContent = session.config?.title || "PhotoboothLive";
  $("#subtitle").textContent = session.config?.subtitle || "Mur photo live";
  $("#closedBadge").hidden = !isExpired(session);
  const join = publicUrl("join.html", sessionId);
  $("#qrImg").src = qrUrl(join, 180);
  $("#joinText").textContent = join.replace(/^https?:\/\//, "");
  window.clearTimeout(expiryTimer);
  const remaining = Number(session.expiresAt || session.config?.expiresAt || 0) - Date.now();
  if (remaining <= 0) return renderUnavailable("Galerie expirée.");
  expiryTimer = window.setTimeout(() => renderUnavailable("Galerie expirée."), Math.min(remaining, 2_147_483_647));
}

function renderGallery() {
  const grid = $("#wallGrid");
  grid.innerHTML = items.length ? items.slice(0, 24).map((item) => `<figure class="wall-tile"><img src="${escapeHtml(item.imageUrl)}" alt="Photo"><figcaption>${escapeHtml(item.participantName || "Invité")}</figcaption></figure>`).join("") : `<div class="wall-empty">Les premières photos apparaîtront ici ✨</div>`;
  renderSlide();
}

function renderSlide() {
  const slide = $("#slide");
  if (!slide || !items.length) {
    if (slide) slide.innerHTML = `<div class="wall-empty">En attente de photos…</div>`;
    return;
  }
  const item = items[currentIndex % items.length];
  slide.innerHTML = `<img src="${escapeHtml(item.imageUrl)}" alt="Photo"><div><strong>${escapeHtml(item.participantName || "Invité")}</strong><span>${escapeHtml(item.message || "")}</span></div>`;
}

function nextSlide() {
  if (!items.length) return;
  currentIndex = (currentIndex + 1) % items.length;
  renderSlide();
}

boot().catch((error) => {
  console.warn(error);
  renderUnavailable("Galerie expirée ou indisponible.");
});
