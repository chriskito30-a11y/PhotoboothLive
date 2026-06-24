import { enforceModuleAccess, logoutFromModule } from "./modulys-access.js";
import { $, escapeHtml, createSession, MODULE_ID, friendlyErrorMessage } from "./core.js";
import { renderFreeLimitUpgrade, isFreeLimitError } from "./modulys-access.js";

let currentUser = null;
let currentAccess = null;

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
  currentAccess = result.access;
  $("#userEmail").textContent = currentUser?.email || "Compte connecté";
  $("#planLabel").textContent = currentAccess?.plan?.name || (currentAccess?.unlimited ? "Administrateur" : "Offre Découverte");

  loadSessions();
}

async function loadSessions() {
  const { db, ref, get, query, orderByChild, equalTo } = await import("./firebase-config.js");
  const ownerSessions = query(ref(db, `moduleData/${MODULE_ID}/sessions`), orderByChild("ownerUid"), equalTo(currentUser.uid));
  const snap = await get(ownerSessions);
  const sessions = Object.entries(snap.val() || {})
    .filter(([, session]) => session.ownerUid === currentUser.uid)
    .sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0));
  const list = $("#sessionsList");
  if (!sessions.length) {
    list.innerHTML = `<article class="empty-card"><strong>Aucune galerie pour le moment</strong><span>Créez votre première galerie photo collaborative.</span></article>`;
    return;
  }
  list.innerHTML = sessions.map(([id, session]) => `<article class="session-card">
    <div><strong>${escapeHtml(session.config?.title || id)}</strong><span>${escapeHtml(session.config?.subtitle || "Galerie photo")}</span></div>
    <a class="btn btn-secondary" href="session.html?session=${escapeHtml(id)}">Gérer</a>
  </article>`).join("");
}

$("#createForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setStatus("Création de la galerie…");
  try {
    const { sessionId } = await createSession({
      user: currentUser,
      access: currentAccess,
      title: form.title.value.trim(),
      subtitle: form.subtitle.value.trim(),
      eventDate: form.eventDate.value,
      welcomeMessage: form.welcomeMessage.value.trim(),
      moderationEnabled: form.moderationEnabled.checked
    });
    location.href = `session.html?session=${encodeURIComponent(sessionId)}`;
  } catch (error) {
    console.warn(error);
    if (isFreeLimitError(error)) {
      renderFreeLimitUpgrade("#limitBox", MODULE_ID, error);
      setStatus("", "");
      return;
    }
    setStatus(friendlyErrorMessage(error, "Impossible de créer la galerie."), "error");
  }
});

$("#logoutBtn")?.addEventListener("click", () => logoutFromModule());
boot();
