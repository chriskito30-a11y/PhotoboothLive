import { db, ref, onValue } from "./firebase-config.js";
<<<<<<< HEAD
import { $, escapeHtml, getSessionIdFromUrl, getPublicSession, publicUrl, qrUrl, isExpired, ROOT_PATH } from "./core.js";
=======
import { $, escapeHtml, getSessionIdFromUrl, publicUrl, qrUrl, galleryItems, isExpired, ROOT_PATH } from "./core.js";
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595

const sessionId = getSessionIdFromUrl();
let currentIndex = 0;
let items = [];
<<<<<<< HEAD
let publicSession = null;
let expiryTimer = 0;

async function boot() {
  if (!sessionId) return renderUnavailable("Session manquante.");
  publicSession = await getPublicSession(sessionId);
  if (!publicSession) return renderUnavailable("Galerie introuvable.");
  renderMetadata(publicSession);
  const hasPublicNode = Boolean(publicSession.public);

  const handleReadDenied = () => renderUnavailable("Galerie expirée ou indisponible.");
  onValue(ref(db, `${ROOT_PATH}/${sessionId}/public`), (snap) => {
    if (!snap.exists()) {
      if (hasPublicNode) renderUnavailable("Galerie introuvable.");
      return;
    }
    const data = snap.val() || {};
    publicSession = { public: data, config: data, expiresAt: data.expiresAt, storagePath: data.storagePath };
    renderMetadata(publicSession);
  }, handleReadDenied);
  onValue(ref(db, `${ROOT_PATH}/${sessionId}/gallery`), (snap) => {
    items = Object.values(snap.val() || {}).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    renderGallery();
  }, handleReadDenied);
=======

function boot() {
  if (!sessionId) return renderUnavailable("Session manquante.");
  onValue(ref(db, `${ROOT_PATH}/${sessionId}`), (snap) => {
    const session = snap.val();
    if (!session) return renderUnavailable("Galerie introuvable.");
    render(session);
  });
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
  window.setInterval(nextSlide, 5000);
}

function renderUnavailable(message) {
  document.body.innerHTML = `<main class="wall-screen"><section class="access-card"><h1>PhotoboothLive</h1><p>${escapeHtml(message)}</p></section></main>`;
}

<<<<<<< HEAD
function renderMetadata(session) {
=======
function render(session) {
  items = galleryItems(session, false);
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
  $("#title").textContent = session.config?.title || "PhotoboothLive";
  $("#subtitle").textContent = session.config?.subtitle || "Mur photo live";
  $("#closedBadge").hidden = !isExpired(session);
  const join = publicUrl("join.html", sessionId);
  $("#qrImg").src = qrUrl(join, 180);
  $("#joinText").textContent = join.replace(/^https?:\/\//, "");
<<<<<<< HEAD
  window.clearTimeout(expiryTimer);
  const remaining = Number(session.expiresAt || session.config?.expiresAt || 0) - Date.now();
  if (remaining <= 0) return renderUnavailable("Galerie expirée.");
  expiryTimer = window.setTimeout(() => renderUnavailable("Galerie expirée."), Math.min(remaining, 2_147_483_647));
}

function renderGallery() {
=======
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
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

<<<<<<< HEAD
boot().catch((error) => {
  console.warn(error);
  renderUnavailable("Connexion à la galerie impossible.");
});
=======
boot();
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
