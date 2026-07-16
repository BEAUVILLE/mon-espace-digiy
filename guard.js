// guard.js — MON ESPACE PRO = répertoire neutre des portes métier
// Aucun téléphone, slug ou session globale n'est requis ni transmis.
(() => {
  "use strict";

  const GLOBAL_KEYS = [
    "DIGIY_PRO_SESSION",
    "DIGIY_PRO_PHONE",
    "DIGIY_PHONE",
    "digiy_phone",
    "digiy_pro_phone",
    "DIGIY_SLUG",
    "digiy_slug",
    "digiy_pro_slug",
    "digiy_module_slugs",
    "digiy_active_module",
    "DIGIY_PRO_ESPACE_SESSION"
  ];

  const SENSITIVE_PARAMS = [
    "phone", "tel", "p_phone", "owner_phone", "slug", "pro_slug",
    "module", "pin", "code", "token", "session", "access", "return", "from"
  ];

  const ROUTES = [
    ["pro-action-digiy.digiylyfe.com", "https://pro-action-digiy.digiylyfe.com/"],
    ["commerce-pro.digiylyfe.com", "https://commerce-pro.digiylyfe.com/pin.html"],
    ["pro-driver.digiylyfe.com", "https://pro-driver.digiylyfe.com/pin.html"],
    ["pro-loc.digiylyfe.com", "https://pro-loc.digiylyfe.com/pin.html"],
    ["pro-resa-resto.digiylyfe.com", "https://pro-resa-resto.digiylyfe.com/pin.html"],
    ["pro-market.digiylyfe.com", "https://pro-market.digiylyfe.com/pin.html"],
    ["pro-build.digiylyfe.com", "https://pro-build.digiylyfe.com/pin.html"],
    ["pro-job.digiylyfe.com", "https://pro-job.digiylyfe.com/pin.html"],
    ["pro-explore.digiylyfe.com", "https://pro-explore.digiylyfe.com/pin.html"],
    ["digiy-carnet-pro.digiylyfe.com", "https://pro-carnet.digiylyfe.com/pin.html"],
    ["pro-carnet.digiylyfe.com", "https://pro-carnet.digiylyfe.com/pin.html"]
  ];

  function remove(storage, key) {
    try { storage.removeItem(key); } catch (_) {}
  }

  function clearGlobalIdentity() {
    for (const storage of [localStorage, sessionStorage]) {
      GLOBAL_KEYS.forEach((key) => remove(storage, key));
    }
  }

  function cleanUrl() {
    try {
      const url = new URL(location.href);
      let changed = false;
      SENSITIVE_PARAMS.forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });
      if (changed) history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function canonicalUrl(raw) {
    try {
      const url = new URL(raw, location.href);
      const match = ROUTES.find(([host]) => url.hostname === host);
      return match ? match[1] : url.toString();
    } catch (_) {
      return raw;
    }
  }

  function applyDirectoryPolicy() {
    clearGlobalIdentity();
    cleanUrl();

    document.body?.classList.remove("digiy-locked");
    document.body?.classList.add("digiy-unlocked");

    const gate = document.getElementById("accessGate");
    if (gate) gate.remove();

    const kicker = document.querySelector(".kicker");
    if (kicker) kicker.textContent = "Répertoire des portes PRO DIGIY";

    const lead = document.querySelector(".lead");
    if (lead) {
      lead.textContent = "Choisis ton métier. Chaque module ouvre ensuite sa propre porte téléphone + PIN, sans transmettre ton téléphone ni ton identifiant dans l’URL.";
    }

    const logout = document.getElementById("logout");
    if (logout) logout.textContent = "🧹 Nettoyer mes sessions";

    document.querySelectorAll("a.moduleCard").forEach((card) => {
      const href = card.getAttribute("href") || "";

      if (href.includes("pro-resto.digiylyfe.com")) {
        card.remove();
        return;
      }

      card.setAttribute("href", canonicalUrl(href));
      card.removeAttribute("data-phone");
      card.removeAttribute("data-slug");
    });

    const carnet = Array.from(document.querySelectorAll("a.moduleCard")).find((card) =>
      /carnet|argent|pay/i.test((card.dataset.keywords || "") + " " + card.textContent)
    );
    if (carnet) carnet.setAttribute("href", "https://pro-carnet.digiylyfe.com/pin.html");

    const action = Array.from(document.querySelectorAll("a.moduleCard")).find((card) =>
      /action voix oreille/i.test((card.dataset.keywords || "") + " " + card.textContent)
    );
    if (action) {
      action.setAttribute("href", "https://pro-action-digiy.digiylyfe.com/");
      const tag = action.querySelector(".moduleTag");
      if (tag) tag.textContent = "Ouvrir ACTION public";
    }

    const note = document.querySelector(".note");
    if (note && !note.textContent.includes("Aucun téléphone")) {
      note.append(document.createElement("br"));
      note.append("Aucun téléphone, slug ou PIN n’est transmis par Mon Espace PRO.");
    }
  }

  const directorySession = Object.freeze({
    phone: "",
    slug: "",
    activeModule: "PIN_DIRECTORY",
    moduleSlugs: {},
    currentModuleSlug: "",
    directory: true
  });

  window.DIGIY_ESPACE = {
    ready: Promise.resolve(directorySession),
    getSession() { return directorySession; },
    clearSession() {
      clearGlobalIdentity();
      return true;
    },
    getSlugForModule() { return ""; },
    getModuleSlug() { return ""; },
    setPhone() {},
    setSlug() {},
    setActiveModule() {},
    setModuleSlug() {}
  };

  cleanUrl();
  clearGlobalIdentity();
  document.documentElement.dataset.digiyEspaceReady = "1";
  document.documentElement.dataset.digiyPhone = "";
  document.documentElement.dataset.digiySlug = "";
  document.documentElement.dataset.digiyActiveModule = "PIN_DIRECTORY";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDirectoryPolicy, { once: true });
  } else {
    applyDirectoryPolicy();
  }
})();