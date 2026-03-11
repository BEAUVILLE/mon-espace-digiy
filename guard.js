// guard-espace.js — DIGIY ESPACE soft gate
// Rôle : capter phone/slug/module depuis l’URL, mémoriser proprement,
// exposer une session légère, et NE JAMAIS rediriger automatiquement.

(() => {
  "use strict";

  const LS_PHONE = "digiy_phone";
  const LS_SLUG = "digiy_slug"; // slug global éventuel (fallback léger)
  const LS_MODULE_SLUGS = "digiy_module_slugs";
  const LS_ACTIVE_MODULE = "digiy_active_module";

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
      .replace(/[\s-]+/g, "_")   // IMPORTANT : "fret-client" => "FRET_CLIENT"
      .replace(/[^A-Z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
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

  function getStoredActiveModule() {
    return normModuleCode(localStorage.getItem(LS_ACTIVE_MODULE) || "");
  }

  function setStoredPhone(phone) {
    const p = normPhone(phone);
    if (!p) return;
    try {
      localStorage.setItem(LS_PHONE, p);
    } catch (_) {}
  }

  function setStoredSlug(slug) {
    const s = normSlug(slug);
    if (!s) return;
    try {
      localStorage.setItem(LS_SLUG, s);
    } catch (_) {}
  }

  function setStoredActiveModule(moduleCode) {
    const code = normModuleCode(moduleCode);
    if (!code) return;
    try {
      localStorage.setItem(LS_ACTIVE_MODULE, code);
    } catch (_) {}
  }

  function setModuleSlug(moduleCode, slug) {
    const code = normModuleCode(moduleCode);
    const s = normSlug(slug);
    if (!code || !s) return;

    const map = readModuleSlugs();
    map[code] = s;
    writeModuleSlugs(map);
  }

  function getModuleSlug(moduleCode) {
    const code = normModuleCode(moduleCode);
    if (!code) return "";
    const map = readModuleSlugs();
    return normSlug(map[code] || "");
  }

  function getSlugForModule(moduleCode) {
    const code = normModuleCode(moduleCode);
    if (!code) return getStoredSlug();

    const specific = getModuleSlug(code);
    if (specific) return specific;

    // fallback prudent : ne renvoyer le slug global
    // que s’il ressemble au module demandé
    const generic = getStoredSlug();
    if (!generic) return "";

    const expectedPrefix = code.toLowerCase().replace(/_/g, "-");
    if (generic.startsWith(expectedPrefix + "-")) return generic;

    return "";
  }

  function getSession() {
    const activeModule = getStoredActiveModule();
    return {
      phone: getStoredPhone(),
      slug: getStoredSlug(),
      activeModule,
      moduleSlugs: readModuleSlugs(),
      currentModuleSlug: activeModule ? getSlugForModule(activeModule) : ""
    };
  }

  function clearSession() {
    try {
      localStorage.removeItem(LS_PHONE);
      localStorage.removeItem(LS_SLUG);
      localStorage.removeItem(LS_MODULE_SLUGS);
      localStorage.removeItem(LS_ACTIVE_MODULE);

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
    if (moduleQ) setStoredActiveModule(moduleQ);

    // IMPORTANT :
    // si on a module + slug, on stocke surtout dans le mapping du module
    // et on évite de polluer le slug global avec un slug d’un autre module
    if (moduleQ && slugQ) {
      setModuleSlug(moduleQ, slugQ);
    } else if (slugQ) {
      setStoredSlug(slugQ);
    }
  }

  try {
    bootstrapFromUrl();

    const session = getSession();

    window.DIGIY_ESPACE = {
      ready: Promise.resolve(session),
      getSession,
      clearSession,
      getSlugForModule,
      getModuleSlug,
      setPhone(phone) {
        setStoredPhone(phone);
      },
      setSlug(slug) {
        setStoredSlug(slug);
      },
      setActiveModule(moduleCode) {
        setStoredActiveModule(moduleCode);
      },
      setModuleSlug(moduleCode, slug) {
        setModuleSlug(moduleCode, slug);
      }
    };

    document.documentElement.dataset.digiyEspaceReady = "1";
    document.documentElement.dataset.digiyPhone = session.phone || "";
    document.documentElement.dataset.digiySlug =
      session.currentModuleSlug || session.slug || "";
    document.documentElement.dataset.digiyActiveModule =
      session.activeModule || "";
  } catch (_) {
    window.DIGIY_ESPACE = {
      ready: Promise.resolve({
        phone: "",
        slug: "",
        activeModule: "",
        moduleSlugs: {},
        currentModuleSlug: ""
      }),
      getSession: () => ({
        phone: "",
        slug: "",
        activeModule: "",
        moduleSlugs: {},
        currentModuleSlug: ""
      }),
      clearSession,
      getSlugForModule: () => "",
      getModuleSlug: () => ""
    };
  }
})();
