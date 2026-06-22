import { app, db, functions, ref, get, httpsCallable } from "./firebase-config.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { $, escapeHtml, getSessionIdFromUrl, getPublicSession, isExpired, ROOT_PATH } from "./core.js";
import { compressImage } from "./image-tools.js";

const auth = getAuth(app);
const sessionId = getSessionIdFromUrl();
let sessionData = null;
let participantId = null;
let selectedBlob = null;

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function setStatus(message = "", type = "") {
  const el = $("#status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function waitForUser(timeoutMs = 1800) {
  return new Promise((resolve) => {
    let done = false;
    let unsub = () => {};
    const finish = (user) => {
      if (done) return;
      done = true;
      try { unsub(); } catch {}
      resolve(user || null);
    };
    unsub = onAuthStateChanged(auth, finish, () => finish(null));
    window.setTimeout(() => finish(auth.currentUser || null), timeoutMs);
  });
}

async function ensureParticipantUser() {
  // Important : au chargement, auth.currentUser peut être null pendant que Firebase restaure
  // le vrai compte Modulys. Il ne faut donc pas créer une session anonyme immédiatement,
  // sinon l'organisateur est remplacé par un invité sur tout le sous-domaine.
  const existingUser = auth.currentUser || await waitForUser();
  if (existingUser) {
    participantId = existingUser.uid;
    return existingUser;
  }

  try {
    // Les invités anonymes restent limités à l'onglet/session du navigateur autant que possible,
    // afin d'éviter de polluer la connexion organisateur sur PhotoboothLive.
    await setPersistence(auth, browserSessionPersistence);
    const credential = await signInAnonymously(auth);
    participantId = credential.user.uid;
    return credential.user;
  } catch (error) {
    throw new Error("L’envoi nécessite l’authentification anonyme Firebase. Activez-la dans Firebase Auth > Sign-in method.");
  }
}

async function boot() {
  if (!sessionId) return renderUnavailable("Lien incomplet : session manquante.");
  await ensureParticipantUser();
  sessionData = await getPublicSession(sessionId);
  if (!sessionData) return renderUnavailable("Cette galerie n’existe pas ou n’est plus disponible.");
  if (isExpired(sessionData)) return renderUnavailable("Cette galerie est expirée. Les envois sont fermés.");
  renderSession(sessionData);
}

function renderUnavailable(message) {
  document.body.innerHTML = `<main class="access-screen"><section class="access-card"><p class="eyebrow">PhotoboothLive</p><h1>Galerie indisponible</h1><p>${escapeHtml(message)}</p></section></main>`;
}

function renderSession(session) {
  $("#title").textContent = session.config?.title || "PhotoboothLive";
  $("#subtitle").textContent = session.config?.subtitle || "Partagez vos souvenirs";
  $("#welcomeMessage").textContent = session.config?.welcomeMessage || "Ajoutez votre photo et un petit message.";
  $("#limitsText").textContent = `1 photo par participant · ${Math.round(Number(session.config?.maxPhotoSizeBytes || 900000) / 1000)} Ko max après compression`;
}

async function reserveSlot() {
  const reserve = httpsCallable(functions, "reservePhotoboothSlot");
  const result = await reserve({ sessionId });
  return String(result.data?.slotId || "");
}

$("#photoFile")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  selectedBlob = null;
  if (!file) return;
  setStatus("Compression de la photo…");
  try {
    selectedBlob = await compressImage(file, {
      maxBytes: Number(sessionData?.config?.maxPhotoSizeBytes || 900000),
      maxSide: 1600
    });
    $("#preview").src = URL.createObjectURL(selectedBlob);
    $("#preview").hidden = false;
    setStatus(`Photo prête (${Math.round(selectedBlob.size / 1024)} Ko).`, "success");
  } catch (error) {
    setStatus(error.message || "Photo impossible à compresser.", "error");
  }
});

$("#uploadForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.name.value.trim().slice(0, 80);
  const message = form.message.value.trim().slice(0, 180);
  if (!name) return setStatus("Indiquez votre prénom.", "error");
  if (!selectedBlob) return setStatus("Choisissez une photo.", "error");

  try {
    setStatus("Vérification des limites…");
    const session = await getPublicSession(sessionId);
    if (!session || isExpired(session)) throw new Error("La galerie est fermée.");

    // P0 sécurisé : le navigateur ne lit/écrit plus les nœuds privés pour pré-vérifier.
    // La réservation, l’anti-doublon et les quotas sont contrôlés par les Cloud Functions.
    const reservedSlotId = await reserveSlot();

    setStatus("Envoi sécurisé de la photo…");
    const photoBase64 = await blobToBase64(selectedBlob);
    const finalizeUpload = httpsCallable(functions, "finalizePhotoboothUpload");
    const result = await finalizeUpload({ sessionId, slotId: reservedSlotId, participantName: name, message, photoBase64 });

    form.reset();
    $("#preview").hidden = true;
    selectedBlob = null;
    const status = result.data?.item?.status;
    setStatus(status === "approved" ? "Photo envoyée et publiée sur le mur." : "Photo envoyée. Elle apparaîtra après validation par l’organisateur.", "success");
  } catch (error) {
    console.warn(error);
    const msg = String(error?.message || "");
    if (msg.includes("PERMISSION_DENIED") || msg.includes("Permission denied")) {
      setStatus("La limite de participants/photos est atteinte ou l’envoi n’est plus autorisé.", "error");
    } else {
      setStatus(error.message || "Envoi impossible.", "error");
    }
  }
});

boot().catch((error) => {
  console.warn(error);
  renderUnavailable("Cette galerie est expirée ou indisponible.");
});
