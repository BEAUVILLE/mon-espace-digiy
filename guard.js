// guard-espace.js — DIGIY ESPACE soft gate
// Rôle : capter phone/slug/module depuis l’URL, mémoriser proprement,
// exposer une session légère, et NE JAMAIS rediriger automatiquement.

(() => {
  "use strict";

  const LS_PHONE = "digiy_phone";
  const LS_SLUG = "digiy_slug";
  const LS_MODULE_SLUGS = "digiy_module_slugs";

  function normPhone(p) {
    let s = String(p || "").trim();
    s = s.replace(/[^\d+]/g, "");
    if (!s) return "";
    if (!s.startsWith("+") && s.startsWith("221")) s = "+" + s;
    return s;
  }

  function normSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normModuleCode(m) {
    return String(m || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "");
  }

  function getParam(name) {
    try {
      return new URL(location.href).searchParams.get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function readModuleSlugs() {
    try {
      const raw = localStorage.getItem(LS_MODULE_SLUGS);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeModuleSlugs(map) {
    try {
      localStorage.setItem(LS_MODULE_SLUGS, JSON.stringify(map || {}));
    } catch (_) {}
  }

  function getStoredPhone() {
    return normPhone(localStorage.getItem(LS_PHONE) || "");
  }

  function getStoredSlug() {
    return normSlug(localStorage.getItem(LS_SLUG) || "");
  }

  function setStoredPhone(phone) {
    const p = normPhone(phone);
    if (!p) return;
    try { localStorage.setItem(LS_PHONE, p); } catch (_) {}
  }

  function setStoredSlug(slug) {
    const s = normSlug(slug);
    if (!s) return;
    try { localStorage.setItem(LS_SLUG, s); } catch (_) {}
  }

  function setModuleSlug(moduleCode, slug) {
    const code = normModuleCode(moduleCode);
    const s = normSlug(slug);
    if (!code || !s) return;

    const map = readModuleSlugs();
    map[code] = s;
    writeModuleSlugs(map);
  }

  function getSession() {
    return {
      phone: getStoredPhone(),
      slug: getStoredSlug(),
      moduleSlugs: readModuleSlugs()
    };
  }

  function clearSession() {
    try {
      localStorage.removeItem(LS_PHONE);
      localStorage.removeItem(LS_SLUG);
      localStorage.removeItem(LS_MODULE_SLUGS);

      localStorage.removeItem("DIGIY_LOC_PRO_SESSION");
      localStorage.removeItem("DIGIY_DRIVER_PRO_SESSION");
      localStorage.removeItem("DIGIY_BUILD_PRO_SESSION");
      localStorage.removeItem("DIGIY_MARKET_PRO_SESSION");
      localStorage.removeItem("DIGIY_JOBS_PRO_SESSION");
      localStorage.removeItem("DIGIY_EXPLORE_PRO_SESSION");
      localStorage.removeItem("DIGIY_RESA_PRO_SESSION");
      localStorage.removeItem("DIGIY_CAISSE_PRO_SESSION");
      localStorage.removeItem("DIGIY_PAY_PRO_SESSION");
      localStorage.removeItem("DIGIY_FRET_CLIENT_PRO_SESSION");
      localStorage.removeItem("DIGIY_FRET_CHAUFFEUR_PRO_SESSION");
    } catch (_) {}
  }

  function bootstrapFromUrl() {
    const phoneQ = normPhone(getParam("phone"));
    const slugQ = normSlug(getParam("slug"));
    const moduleQ = normModuleCode(getParam("module"));

    if (phoneQ) setStoredPhone(phoneQ);
    if (slugQ) setStoredSlug(slugQ);
    if (moduleQ && slugQ) setModuleSlug(moduleQ, slugQ);
  }

  try {
    bootstrapFromUrl();

    const session = getSession();

    window.DIGIY_ESPACE = {
      ready: Promise.resolve(session),
      getSession,
      clearSession,
      setPhone(phone) { setStoredPhone(phone); },
      setSlug(slug) { setStoredSlug(slug); },
      setModuleSlug(moduleCode, slug) { setModuleSlug(moduleCode, slug); }
    };

    document.documentElement.dataset.digiyEspaceReady = "1";
    document.documentElement.dataset.digiyPhone = session.phone || "";
    document.documentElement.dataset.digiySlug = session.slug || "";
  } catch (_) {
    window.DIGIY_ESPACE = {
      ready: Promise.resolve({ phone: "", slug: "", moduleSlugs: {} }),
      getSession: () => ({ phone: "", slug: "", moduleSlugs: {} }),
      clearSession
    };
  }
})();
