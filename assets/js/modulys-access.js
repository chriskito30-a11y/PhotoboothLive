import { app, db, ref, get, set } from "./firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const auth = getAuth(app);
const DEFAULT_FREE_LIMITS = { eventsPerMonth: 1, participantsPerEvent: 30 };

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function isActiveGrant(grant) {
  if (!grant) return false;
  if (grant === true) return true;
  const status = String(grant.status || "active").toLowerCase();
  if (!["active", "trial", "lifetime"].includes(status)) return false;
  if (grant.lifetime === true || status === "lifetime") return true;
  const expiresAt = normalizeTimestamp(grant.expiresAt);
  return !expiresAt || expiresAt > Date.now();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function currentBillingPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function waitForCurrentUser(timeoutMs = 1600) {
  return new Promise((resolve) => {
    let done = false;
    let unsubscribe = () => {};
    const finish = (user) => {
      if (done) return;
      done = true;
      try { unsubscribe(); } catch {}
      resolve(user || null);
    };
    unsubscribe = onAuthStateChanged(auth, finish, () => finish(null));
    window.setTimeout(() => finish(auth.currentUser || null), timeoutMs);
  });
}

function resolveLimits(moduleKey, moduleData = {}, planData = {}) {
  const moduleFree = moduleData?.limits?.free || {};
  const planLimits = planData?.limits || {};
  const perModule = planLimits?.[moduleKey] || {};
  return {
    eventsPerMonth: Number(moduleFree.eventsPerMonth || perModule.eventsPerMonth || planLimits.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerMonth),
    participantsPerEvent: Number(moduleFree.participantsPerEvent || perModule.participantsPerEvent || planLimits.participantsPerEvent || DEFAULT_FREE_LIMITS.participantsPerEvent)
  };
}

export async function getAccessForUser(moduleKey, user) {
  const moduleSnap = await get(ref(db, `modules/${moduleKey}`));
  const moduleData = moduleSnap.val() || null;

  if (!moduleData) return { allowed: false, reason: "module_not_declared", module: null };
  if (moduleData.active === false) return { allowed: false, reason: "module_inactive", module: moduleData };
  if (moduleData.accessMode === "public") return { allowed: true, reason: "public", module: moduleData };
  if (!user) return { allowed: false, reason: "not_authenticated", module: moduleData };

  const [adminsSnap, adminSnap, accessSnap, subscriptionSnap, freePlanSnap] = await Promise.all([
    get(ref(db, `admins/${user.uid}`)),
    get(ref(db, `admin/${user.uid}`)),
    get(ref(db, `userAccess/${user.uid}`)),
    get(ref(db, `subscriptions/${user.uid}`)),
    get(ref(db, "plans/free"))
  ]);

  const isAdmin = Boolean(adminsSnap.val() || adminSnap.val());
  const access = accessSnap.val() || {};
  const subscription = subscriptionSnap.val() || null;
  const freePlan = freePlanSnap.val() || {};
  const freeLimits = resolveLimits(moduleKey, moduleData, freePlan);
  const accessPlanId = String(access.planId || "").toLowerCase();
  const isFreePlan = !accessPlanId || accessPlanId === "free";

  if (isAdmin) return { allowed: true, reason: "admin", module: moduleData, isAdmin, access, subscription, planId: "admin", limits: null, unlimited: true };
  if (isActiveGrant(access.allModules)) {
    return isFreePlan
      ? { allowed: true, reason: "free_all_modules", module: moduleData, isAdmin, access, subscription, planId: "free", limits: freeLimits, unlimited: false }
      : { allowed: true, reason: "all_modules", module: moduleData, isAdmin, access, subscription, planId: access.planId || "custom", limits: null, unlimited: true };
  }
  if (isActiveGrant(access.modules?.[moduleKey])) {
    return isFreePlan
      ? { allowed: true, reason: "free_module_grant", module: moduleData, isAdmin, access, subscription, planId: "free", limits: freeLimits, unlimited: false }
      : { allowed: true, reason: "module_grant", module: moduleData, isAdmin, access, subscription, planId: access.planId || "custom", limits: null, unlimited: true };
  }
  if (isActiveGrant(subscription) && (subscription.scope === "allModules" || subscription.modules?.[moduleKey] === true)) {
    const subscriptionPlanId = String(subscription.planId || subscription.id || "subscription").toLowerCase();
    return subscriptionPlanId === "free"
      ? { allowed: true, reason: "free_subscription", module: moduleData, isAdmin, access, subscription, planId: "free", limits: freeLimits, unlimited: false }
      : { allowed: true, reason: "subscription", module: moduleData, isAdmin, access, subscription, planId: subscription.planId || "subscription", limits: null, unlimited: true };
  }
  if (moduleData.accessMode === "free_authenticated") {
    return { allowed: true, reason: "free_authenticated", module: moduleData, isAdmin, access, subscription, planId: "free", limits: freeLimits, unlimited: false };
  }
  return { allowed: false, reason: "no_grant", module: moduleData, isAdmin, access, subscription, planId: "none", limits: freeLimits, unlimited: false };
}

export function isFreeLimitError(error) {
  return Boolean(error && (error.code === "modulys/free-limit-reached" || String(error.message || "").toLowerCase().includes("limite gratuite atteinte")));
}

export function upgradeOfferHtml(moduleKey, error = {}) {
  const limits = error.limits || {};
  const period = error.period || currentBillingPeriod();
  const max = Number(limits.eventsPerMonth || DEFAULT_FREE_LIMITS.eventsPerMonth || 1);
  return `<div class="upgrade-box">
    <strong>Limite gratuite atteinte</strong>
    <span>Votre offre gratuite permet ${max} création${max > 1 ? "s" : ""} par mois pour PhotoboothLive. La limite est déjà utilisée pour ${escapeHtml(period)}.</span>
    <div class="upgrade-actions">
      <a class="btn btn-primary" href="https://modulys.top/#tarifs" target="_blank" rel="noopener">Voir les offres</a>
      <a class="btn btn-secondary" href="https://modulys.top/#contact" target="_blank" rel="noopener">Débloquer mon accès</a>
    </div>
    <small>Options prévues : Pass événement, abonnement mensuel, annuel ou Lifetime.</small>
  </div>`;
}

export function renderFreeLimitUpgrade(target, moduleKey, error = {}) {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return false;
  el.innerHTML = upgradeOfferHtml(moduleKey, error);
  return true;
}

function reasonLabel(reason) {
  return {
    not_authenticated: "Vous devez vous connecter avec votre compte Modulys pour ouvrir ce module.",
    module_not_declared: "PhotoboothLive n’est pas encore déclaré dans Firebase.",
    module_inactive: "PhotoboothLive est actuellement désactivé.",
    no_grant: "Votre compte ne possède pas encore les droits pour ce module."
  }[reason] || "Accès non disponible.";
}

function renderLoginRequired(moduleKey, reason) {
  document.body.innerHTML = `<main class="access-screen"><section class="access-card">
    <p class="eyebrow">Modulys</p>
    <h1>Connexion requise</h1>
    <p>${escapeHtml(reasonLabel(reason))}</p>
    <form id="modulysModuleLoginForm" class="stack">
      <input name="email" type="email" autocomplete="email" required placeholder="Email">
      <input name="password" type="password" autocomplete="current-password" required placeholder="Mot de passe">
      <button class="btn btn-primary" type="submit">Me connecter</button>
      <a class="btn btn-secondary" href="https://modulys.top/mes-modules.html">Créer un compte</a>
      <p id="modulysLoginFeedback" class="status"></p>
    </form>
  </section></main>`;
  document.querySelector("#modulysModuleLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = document.querySelector("#modulysLoginFeedback");
    const form = event.currentTarget;
    try {
      if (feedback) feedback.textContent = "Connexion…";
      await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      location.reload();
    } catch (error) {
      if (feedback) feedback.textContent = "Connexion impossible. Vérifiez l’email et le mot de passe.";
      console.warn("Modulys module login failed", error);
    }
  });
}

function renderBlocked(moduleKey, reason) {
  if (reason === "not_authenticated") return renderLoginRequired(moduleKey, reason);
  document.body.innerHTML = `<main class="access-screen"><section class="access-card"><p class="eyebrow">Modulys</p><h1>Accès non disponible</h1><p>${escapeHtml(reasonLabel(reason))}</p><a class="btn btn-primary" href="https://modulys.top/mes-modules.html">Retour à mes modules</a></section></main>`;
}

export async function enforceModuleAccess(moduleKey, options = {}) {
  const mode = options.mode || "soft";
  try {
    const user = await waitForCurrentUser(options.timeoutMs || 1800);
    const access = await getAccessForUser(moduleKey, user);
    if (access.allowed) return { ok: true, user, access };
    if (mode === "hard") {
      renderBlocked(moduleKey, access.reason);
      return { ok: false, user, access };
    }
    return { ok: true, user, access };
  } catch (error) {
    console.warn("Modulys access check failed", error);
    if (mode === "hard") renderBlocked(moduleKey, "access_check_error");
    return { ok: false, user: null, access: null };
  }
}

export { auth, signOut };
