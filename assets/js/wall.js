import { db, ref, onValue } from "./firebase-config.js";
import { $, escapeHtml, getSessionIdFromUrl, publicUrl, qrUrl, galleryItems, isExpired, ROOT_PATH } from "./core.js";

const sessionId = getSessionIdFromUrl();
let currentIndex = 0;
let items = [];

function boot() {
  if (!sessionId) return renderUnavailable("Session manquante.");
  onValue(ref(db, `${ROOT_PATH}/${sessionId}`), (snap) => {
    const session = snap.val();
    if (!session) return renderUnavailable("Galerie introuvable.");
    render(session);
  });
  window.setInterval(nextSlide, 5000);
}

function renderUnavailable(message) {
  document.body.innerHTML = `<main class="wall-screen"><section class="access-card"><h1>PhotoboothLive</h1><p>${escapeHtml(message)}</p></section></main>`;
}

function render(session) {
  items = galleryItems(session, false);
  $("#title").textContent = session.config?.title || "PhotoboothLive";
  $("#subtitle").textContent = session.config?.subtitle || "Mur photo live";
  $("#closedBadge").hidden = !isExpired(session);
  const join = publicUrl("join.html", sessionId);
  $("#qrImg").src = qrUrl(join, 180);
  $("#joinText").textContent = join.replace(/^https?:\/\//, "");
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

boot();
