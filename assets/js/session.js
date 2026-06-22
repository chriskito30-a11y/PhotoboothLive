import { db, ref, get, onValue, update } from "./firebase-config.js";
import { enforceModuleAccess } from "./modulys-access.js";
import { $, escapeHtml, formatDateTime, getSessionIdFromUrl, getPublicSession, publicUrl, qrUrl, isExpired, approvePhoto, rejectPhoto, MODULE_ID, ROOT_PATH } from "./core.js";

const sessionId = getSessionIdFromUrl();
let sessionData = null;
let currentUser = null;

function setStatus(message = "", type = "") {
  const el = $("#status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

async function boot() {
  const result = await enforceModuleAccess(MODULE_ID, { mode: "hard" });
  if (!result.ok) return;
  currentUser = result.user;
  if (!sessionId) {
    document.body.innerHTML = `<main class="access-screen"><section class="access-card"><h1>Session introuvable</h1><a class="btn btn-primary" href="index.html">Retour</a></section></main>`;
    return;
  }
  const base = `${ROOT_PATH}/${sessionId}`;
  const [ownerSnap, metadata, moderationSnap] = await Promise.all([
    get(ref(db, `${base}/ownerUid`)),
    getPublicSession(sessionId),
    get(ref(db, `${base}/config/moderationEnabled`))
  ]);
  if (!ownerSnap.exists() || !metadata) return renderUnavailable("Galerie introuvable");
  if (ownerSnap.val() !== currentUser.uid) {
    renderUnavailable("Accès réservé à l’organisateur");
    return;
  }

  sessionData = {
    ...metadata,
    config: { ...(metadata.config || {}), moderationEnabled: Boolean(moderationSnap.val()) },
    publicWrites: {},
    gallery: {},
    participants: {}
  };
  renderMetadata(sessionData);
  $("#moderationEnabled").checked = sessionData.config.moderationEnabled;

  onValue(ref(db, `${base}/ownerUid`), (snap) => {
    if (!snap.exists()) renderUnavailable("Galerie introuvable");
    else if (snap.val() !== currentUser.uid) {
      renderUnavailable("Accès réservé à l’organisateur");
    }
  });
  onValue(ref(db, `${base}/publicWrites`), (snap) => {
    sessionData.publicWrites = snap.val() || {};
    renderModeration(sessionData);
  });
  onValue(ref(db, `${base}/gallery`), (snap) => {
    sessionData.gallery = snap.val() || {};
    renderGallery(sessionData);
  });
  onValue(ref(db, `${base}/participants`), (snap) => {
    sessionData.participants = snap.val() || {};
    $("#participantsCount").textContent = String(Object.keys(sessionData.participants).length);
  });
}

function renderUnavailable(title) {
  document.body.innerHTML = `<main class="access-screen"><section class="access-card"><h1>${escapeHtml(title)}</h1><a class="btn btn-primary" href="index.html">Retour</a></section></main>`;
}

function renderMetadata(session) {
  const join = publicUrl("join.html", sessionId);
  const wall = publicUrl("wall.html", sessionId);
  $("#title").textContent = session.config?.title || "PhotoboothLive";
  $("#subtitle").textContent = session.config?.subtitle || "Galerie photo collaborative";
  $("#expiresAt").textContent = formatDateTime(session.expiresAt);
  $("#joinLink").value = join;
  $("#wallLink").value = wall;
  $("#qrImg").src = qrUrl(join, 280);
  $("#openJoin").href = join;
  $("#openWall").href = wall;
  $("#expiredBadge").hidden = !isExpired(session);
}

function renderModeration(session) {
  const publicWrites = Object.values(session.publicWrites || {}).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const pending = publicWrites.filter((item) => item.status !== "approved" && item.status !== "rejected");
  $("#pendingCount").textContent = String(pending.length);
  const moderation = $("#moderationList");
  moderation.innerHTML = publicWrites.length
    ? publicWrites.map((item) => renderModerationItem(item, session.config?.moderationEnabled)).join("")
    : `<article class="empty-card"><strong>Aucune photo reçue</strong><span>Partagez le QR code avec vos invités.</span></article>`;
}

function renderGallery(session) {
  const gallery = Object.values(session.gallery || {}).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  $("#photoCount").textContent = String(gallery.length);
  const grid = $("#galleryGrid");
  grid.innerHTML = gallery.length ? gallery.map(renderGalleryItem).join("") : `<article class="empty-card"><strong>Galerie vide</strong><span>Les photos approuvées apparaîtront ici.</span></article>`;
}

function renderModerationItem(item, moderationEnabled) {
  const status = item.status || (moderationEnabled ? "pending" : "approved");
  return `<article class="photo-card" data-id="${escapeHtml(item.id)}">
    <img src="${escapeHtml(item.imageUrl)}" alt="Photo envoyée par ${escapeHtml(item.participantName || "un invité")}">
    <div class="photo-body">
      <strong>${escapeHtml(item.participantName || "Invité")}</strong>
      <span>${escapeHtml(item.message || "Sans message")}</span>
      <small>Statut : ${escapeHtml(status)}</small>
      <div class="photo-actions">
        <button class="btn btn-primary" type="button" data-approve="${escapeHtml(item.id)}">Approuver</button>
        <button class="btn btn-secondary" type="button" data-reject="${escapeHtml(item.id)}">Refuser</button>
      </div>
    </div>
  </article>`;
}

function renderGalleryItem(item) {
  return `<figure class="gallery-tile"><img src="${escapeHtml(item.imageUrl)}" alt="Photo de ${escapeHtml(item.participantName || "invité")}"><figcaption><strong>${escapeHtml(item.participantName || "Invité")}</strong><span>${escapeHtml(item.message || "")}</span></figcaption></figure>`;
}

document.addEventListener("click", async (event) => {
  const approveId = event.target?.dataset?.approve;
  const rejectId = event.target?.dataset?.reject;
  if (!approveId && !rejectId) return;
  const item = sessionData?.publicWrites?.[approveId || rejectId];
  if (!item) return;
  try {
    if (approveId) await approvePhoto(sessionId, item);
    if (rejectId) await rejectPhoto(sessionId, rejectId);
  } catch (error) {
    setStatus(error.message || "Action impossible.", "error");
  }
});

$("#copyJoin")?.addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#joinLink").value);
  setStatus("Lien participant copié.", "success");
});
$("#copyWall")?.addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#wallLink").value);
  setStatus("Lien écran copié.", "success");
});
$("#saveConfig")?.addEventListener("click", async () => {
  if (!sessionData) return;
  const moderationEnabled = $("#moderationEnabled").checked;
  await update(ref(db, `${ROOT_PATH}/${sessionId}`), {
    "config/moderationEnabled": moderationEnabled,
    updatedAt: Date.now()
  });
  sessionData.config.moderationEnabled = moderationEnabled;
  renderModeration(sessionData);
  setStatus("Paramètres enregistrés.", "success");
});

boot();
