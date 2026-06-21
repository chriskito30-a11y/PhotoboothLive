import { db, ref, get, set, update } from "./firebase-config.js";
import { currentBillingPeriod } from "./modulys-access.js";

export const MODULE_ID = "photoboothlive";
export const ROOT_PATH = `moduleData/${MODULE_ID}/sessions`;
export const DEFAULT_FREE_LIMITS = {
  eventsPerMonth: 1,
  participantsPerEvent: 30,
  photosPerParticipant: 1,
  maxPhotoSizeBytes: 900000,
  retentionHours: 24
};
export const EVENT_PASS_LIMITS = {
  participantsPerEvent: 75,
  photosPerParticipant: 1,
  maxPhotoSizeBytes: 1000000,
  retentionHours: 48
};

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

export function sessionLimitsForPlan(planId = "free", moduleLimits = {}) {
  if (planId === "event_pass") return EVENT_PASS_LIMITS;
  const free = moduleLimits?.free || {};
  return {
    eventsPerMonth: Number(free.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerMonth),
    participantsPerEvent: Number(free.participantsPerEvent || DEFAULT_FREE_LIMITS.participantsPerEvent),
    photosPerParticipant: Number(free.photosPerParticipant || DEFAULT_FREE_LIMITS.photosPerParticipant),
    maxPhotoSizeBytes: Number(free.maxPhotoSizeBytes || DEFAULT_FREE_LIMITS.maxPhotoSizeBytes),
    retentionHours: Number(free.retentionHours || DEFAULT_FREE_LIMITS.retentionHours)
  };
}

export async function createSession({ user, access, title, subtitle, eventDate, welcomeMessage, moderationEnabled }) {
  if (!user) throw new Error("Utilisateur non connecté.");
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
    "stats/approvedCount": Date.now(),
    updatedAt: now
  });
}

export async function rejectPhoto(sessionId, itemId) {
  const now = Date.now();
  await update(ref(db, `${ROOT_PATH}/${sessionId}`), {
    [`publicWrites/${itemId}/status`]: "rejected",
    [`publicWrites/${itemId}/rejectedAt`]: now,
    updatedAt: now
  });
}
