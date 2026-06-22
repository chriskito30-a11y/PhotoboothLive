import { app, db, storage, ref, get, set, storageRef, uploadBytes, getDownloadURL } from "./firebase-config.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { $, escapeHtml, getSessionIdFromUrl, isExpired, countObject, ROOT_PATH } from "./core.js";
import { compressImage } from "./image-tools.js";

const auth = getAuth(app);
const sessionId = getSessionIdFromUrl();
let sessionData = null;
let participantId = null;
let selectedBlob = null;

function setStatus(message = "", type = "") {
  const el = $("#status");
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function waitForUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

async function ensureAnonUser() {
  if (!auth.currentUser) {
    try { await signInAnonymously(auth); } catch (error) {
      throw new Error("L’envoi nécessite l’authentification anonyme Firebase. Activez-la dans Firebase Auth > Sign-in method.");
    }
  }
  const user = auth.currentUser || await waitForUser();
  participantId = user.uid;
  return user;
}

async function boot() {
  if (!sessionId) return renderUnavailable("Lien incomplet : session manquante.");
  await ensureAnonUser();
  const snap = await get(ref(db, `${ROOT_PATH}/${sessionId}`));
  sessionData = snap.val();
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

function slotId(n) {
  return String(n).padStart(2, "0");
}

function shuffledSlots(limit) {
  const max = Math.max(1, Math.min(Number(limit || 30), 75));
  const arr = Array.from({ length: max }, (_, i) => slotId(i + 1));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function reserveSlot(limit) {
  const now = Date.now();
  for (const id of shuffledSlots(limit)) {
    try {
      await set(ref(db, `${ROOT_PATH}/${sessionId}/slots/${id}`), {
        id,
        participantId,
        createdAt: now
      });
      return id;
    } catch (error) {
      // Slot occupé ou refusé par les rules : on essaie le suivant.
    }
  }
  throw new Error("La limite de participants est atteinte pour cette galerie.");
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
    const freshSnap = await get(ref(db, `${ROOT_PATH}/${sessionId}`));
    const session = freshSnap.val();
    if (!session || isExpired(session)) throw new Error("La galerie est fermée.");
    if (session.publicWrites?.[participantId] || session.gallery?.[participantId]) throw new Error("Vous avez déjà envoyé une photo pour cette galerie.");

    const now = Date.now();
    const limit = Number(session.config?.participantsLimit || 30);
    const existingParticipant = session.participants?.[participantId];
    let reservedSlotId = existingParticipant?.slotId || "";

    // Sécurité quota : on réserve une place numérotée avant tout upload Storage.
    // Les rules RTDB n’autorisent que 30 slots en free et 75 en event_pass.
    if (!reservedSlotId) {
      reservedSlotId = await reserveSlot(limit);
    }

    await set(ref(db, `${ROOT_PATH}/${sessionId}/participants/${participantId}`), {
      id: participantId,
      slotId: reservedSlotId,
      name,
      joinedAt: existingParticipant?.joinedAt || now,
      lastSeenAt: now
    });

    setStatus("Envoi de la photo…");
    const path = `photoboothlive/${sessionId}/${participantId}/photo.jpg`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, selectedBlob, {
      contentType: "image/jpeg",
      customMetadata: { moduleId: "photoboothlive", sessionId, participantId, slotId: reservedSlotId }
    });
    const imageUrl = await getDownloadURL(fileRef);
    const item = {
      id: participantId,
      slotId: reservedSlotId,
      participantId,
      participantName: name,
      imageUrl,
      storagePath: path,
      message,
      status: "pending",
      createdAt: now
    };

    await set(ref(db, `${ROOT_PATH}/${sessionId}/publicWrites/${participantId}`), item);

    form.reset();
    $("#preview").hidden = true;
    setStatus("Photo envoyée. Elle apparaîtra après validation par l’organisateur.", "success");
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

boot();
