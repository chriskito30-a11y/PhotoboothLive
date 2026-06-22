<<<<<<< HEAD
import { db, functions, ref, get, update, httpsCallable } from "./firebase-config.js";
=======
import { db, ref, get, set, update } from "./firebase-config.js";
import { currentBillingPeriod } from "./modulys-access.js";
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595

export const MODULE_ID = "photoboothlive";
export const ROOT_PATH = `moduleData/${MODULE_ID}/sessions`;
export const DEFAULT_FREE_LIMITS = {
<<<<<<< HEAD
  eventsPerPeriod: 1,
  quotaPeriod: "month",
=======
  eventsPerMonth: 1,
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
  participantsPerEvent: 30,
  photosPerParticipant: 1,
  maxPhotoSizeBytes: 900000,
  retentionHours: 24
};
<<<<<<< HEAD
=======
export const EVENT_PASS_LIMITS = {
  participantsPerEvent: 75,
  photosPerParticipant: 1,
  maxPhotoSizeBytes: 1000000,
  retentionHours: 48
};
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595

export function $(selector, root = document) { return root.querySelector(selector); }
export function $all(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeSlug(value, maxLength = 48) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

export function makeSessionId(title = "") {
  const base = normalizeSlug(title, 28) || "album";
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${random}`;
}

export function getSessionIdFromUrl() {
  return normalizeSlug(new URLSearchParams(window.location.search).get("session"), 48);
}

export function publicUrl(page, sessionId) {
  const url = new URL(page, window.location.origin + window.location.pathname.replace(/[^/]*$/, ""));
  url.searchParams.set("session", sessionId);
  return url.href;
}

export function qrUrl(targetUrl, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function isExpired(session = {}) {
  const expiresAt = Number(session.expiresAt || 0);
  return expiresAt > 0 && expiresAt <= Date.now();
}

<<<<<<< HEAD
export async function getPublicSession(sessionId) {
  const base = `${ROOT_PATH}/${sessionId}`;
  const publicSnap = await get(ref(db, `${base}/public`));
  if (publicSnap.exists()) {
    const publicData = publicSnap.val() || {};
    return {
      public: publicData,
      expiresAt: publicData.expiresAt,
      storagePath: publicData.storagePath,
      config: { ...publicData }
    };
  }

  const fields = [
    "expiresAt",
    "storagePath",
    "config/title",
    "config/subtitle",
    "config/welcomeMessage",
    "config/participantsLimit",
    "config/maxPhotoSizeBytes",
    "config/retentionHours"
  ];
  const snapshots = await Promise.all(fields.map((path) => get(ref(db, `${base}/${path}`))));
  if (!snapshots.some((snap) => snap.exists())) return null;
  const values = Object.fromEntries(fields.map((path, index) => [path, snapshots[index].val()]));
  return {
    expiresAt: values.expiresAt,
    storagePath: values.storagePath || `${MODULE_ID}/${sessionId}`,
    config: {
      title: values["config/title"],
      subtitle: values["config/subtitle"],
      welcomeMessage: values["config/welcomeMessage"],
      participantsLimit: values["config/participantsLimit"],
      maxPhotoSizeBytes: values["config/maxPhotoSizeBytes"],
      retentionHours: values["config/retentionHours"]
    }
  };
}

export function sessionLimitsForPlan(planId = "free", moduleLimits = {}, accessLimits = {}) {
  const configured = moduleLimits?.[planId] || moduleLimits?.free || {};
  return {
    eventsPerPeriod: Number(accessLimits.eventsPerPeriod || configured.eventsPerPeriod || configured.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerPeriod),
    quotaPeriod: String(accessLimits.quotaPeriod || configured.quotaPeriod || DEFAULT_FREE_LIMITS.quotaPeriod),
    participantsPerEvent: Number(accessLimits.participantsPerEvent || configured.participantsPerEvent || DEFAULT_FREE_LIMITS.participantsPerEvent),
    photosPerParticipant: Number(accessLimits.photosPerParticipant || configured.photosPerParticipant || DEFAULT_FREE_LIMITS.photosPerParticipant),
    maxPhotoSizeBytes: Number(accessLimits.maxPhotoSizeBytes || configured.maxPhotoSizeBytes || DEFAULT_FREE_LIMITS.maxPhotoSizeBytes),
    retentionHours: Number(accessLimits.retentionHours || configured.retentionHours || DEFAULT_FREE_LIMITS.retentionHours)
=======
export function sessionLimitsForPlan(planId = "free", moduleLimits = {}) {
  if (planId === "event_pass") return EVENT_PASS_LIMITS;
  const free = moduleLimits?.free || {};
  return {
    eventsPerMonth: Number(free.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerMonth),
    participantsPerEvent: Number(free.participantsPerEvent || DEFAULT_FREE_LIMITS.participantsPerEvent),
    photosPerParticipant: Number(free.photosPerParticipant || DEFAULT_FREE_LIMITS.photosPerParticipant),
    maxPhotoSizeBytes: Number(free.maxPhotoSizeBytes || DEFAULT_FREE_LIMITS.maxPhotoSizeBytes),
    retentionHours: Number(free.retentionHours || DEFAULT_FREE_LIMITS.retentionHours)
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
  };
}


export function makeAllowedSlots(limit = 30) {
<<<<<<< HEAD
  const max = Math.max(1, Math.min(Number(limit || 30), 250));
=======
  const max = Math.max(1, Math.min(Number(limit || 30), 75));
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
  const slots = {};
  for (let i = 1; i <= max; i += 1) {
    slots[String(i).padStart(2, "0")] = true;
  }
  return slots;
}

<<<<<<< HEAD
function offerLimitError({ access, limits, period }) {
  const error = new Error("Limite de l’offre atteinte");
  error.code = "modulys/offer-limit-reached";
  error.period = period;
  error.limits = limits;
  error.offerName = access?.plan?.name || access?.planId || "Découverte";
  return error;
}

export async function createSession({ user, access, title, subtitle, eventDate, welcomeMessage, moderationEnabled }) {
  if (!user) throw new Error("Utilisateur non connecté.");
  if (user.isAnonymous) throw new Error("Connectez-vous avec votre compte Modulys pour créer une galerie.");
  const callable = httpsCallable(functions, "createPhotoboothSession");
  const requestKey = `photoboothlive:create:${user.uid}`;
  let requestId = sessionStorage.getItem(requestKey);
  if (!/^[0-9a-f-]{36}$/i.test(requestId || "")) {
    requestId = crypto.randomUUID();
    sessionStorage.setItem(requestKey, requestId);
  }
  try {
    const result = await callable({ requestId, title, subtitle, eventDate, welcomeMessage, moderationEnabled });
    sessionStorage.removeItem(requestKey);
    return result.data;
  } catch (error) {
    if (error?.code === "functions/resource-exhausted" || error?.details?.reason === "quota") {
      throw offerLimitError({
        access: { ...access, plan: { name: error?.details?.offerName || access?.plan?.name } },
        limits: error?.details?.limits || access?.limits || {},
        period: error?.details?.period || access?.billingPeriod || ""
      });
    }
    throw error;
  }
=======
export async function createSession({ user, access, title, subtitle, eventDate, welcomeMessage, moderationEnabled }) {
  if (!user) throw new Error("Utilisateur non connecté.");
  if (user.isAnonymous) throw new Error("Connectez-vous avec votre compte Modulys pour créer une galerie.");
  const planId = access?.planId || "free";
  const moduleData = access?.module || {};
  const limits = access?.unlimited ? {
    participantsPerEvent: 300,
    photosPerParticipant: 1,
    maxPhotoSizeBytes: 1200000,
    retentionHours: 72
  } : sessionLimitsForPlan(planId, moduleData?.limits || {});

  const period = currentBillingPeriod();
  const usageSnap = await get(ref(db, `usage/${user.uid}/${period}/${MODULE_ID}/eventsCreated`));
  const used = Number(usageSnap.val() || 0);
  const monthlyLimit = Number(limits.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerMonth);
  if (!access?.unlimited && planId === "free" && used >= monthlyLimit) {
    const err = new Error("Limite gratuite atteinte");
    err.code = "modulys/free-limit-reached";
    err.period = period;
    err.limits = limits;
    throw err;
  }

  const sessionId = makeSessionId(title);
  const now = Date.now();
  const retentionHours = Number(limits.retentionHours || 24);
  const eventAt = eventDate ? new Date(`${eventDate}T23:59:59`).getTime() : now;
  const expiresAt = Math.max(now + 2 * 60 * 60 * 1000, eventAt + retentionHours * 60 * 60 * 1000);

  const session = {
    ownerUid: user.uid,
    ownerEmail: user.email || "",
    moduleId: MODULE_ID,
    planId,
    billingPeriod: period,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    storagePath: `${MODULE_ID}/${sessionId}`,
    config: {
      title: String(title || "Mon album photo").slice(0, 120),
      subtitle: String(subtitle || "Partagez vos plus beaux souvenirs").slice(0, 160),
      welcomeMessage: String(welcomeMessage || "Scannez le QR code, ajoutez votre photo et laissez un message souvenir.").slice(0, 260),
      eventDate: eventDate || "",
      participantsLimit: Number(limits.participantsPerEvent || 30),
      allowedSlots: makeAllowedSlots(Number(limits.participantsPerEvent || 30)),
      photosPerParticipant: Number(limits.photosPerParticipant || 1),
      maxPhotoSizeBytes: Number(limits.maxPhotoSizeBytes || 900000),
      retentionHours,
      moderationEnabled: Boolean(moderationEnabled),
      videoEnabled: false
    },
    stats: {
      participantsCount: 0,
      photosCount: 0,
      approvedCount: 0,
      pendingCount: 0
    }
  };

  await set(ref(db, `${ROOT_PATH}/${sessionId}`), session);
  if (!access?.unlimited) {
    await update(ref(db, `usage/${user.uid}/${period}/${MODULE_ID}`), {
      eventsCreated: used + 1,
      [`entities/${sessionId}`]: true,
      updatedAt: now
    });
  }
  return { sessionId, session };
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
}

export function countObject(obj = {}) {
  return Object.keys(obj || {}).length;
}

export function galleryItems(session = {}, includePending = false) {
  const gallery = session.gallery || {};
  const publicWrites = session.publicWrites || {};
  const merged = [];
  Object.values(gallery).forEach((item) => merged.push({ ...item, source: "gallery" }));
  if (includePending) {
    Object.values(publicWrites).forEach((item) => {
      if (!gallery[item.id] && item.status !== "rejected") merged.push({ ...item, source: "publicWrites" });
    });
  }
  return merged.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function approvePhoto(sessionId, item) {
  const now = Date.now();
  const id = item.id || item.participantId || `photo-${now}`;
  await update(ref(db, `${ROOT_PATH}/${sessionId}`), {
    [`gallery/${id}`]: { ...item, id, status: "approved", approvedAt: now },
    [`publicWrites/${id}/status`]: "approved",
    [`publicWrites/${id}/approvedAt`]: now,
    updatedAt: now
  });
}

export async function rejectPhoto(sessionId, itemId) {
  const now = Date.now();
  await update(ref(db, `${ROOT_PATH}/${sessionId}`), {
    [`publicWrites/${itemId}/status`]: "rejected",
    [`publicWrites/${itemId}/rejectedAt`]: now,
<<<<<<< HEAD
    [`gallery/${itemId}`]: null,
=======
>>>>>>> 16228d0d8b510496f3be0d8b7ce8f50394c9c595
    updatedAt: now
  });
}
