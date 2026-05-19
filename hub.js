/* hub.js — PRO-ESPACE DIGIY
   - charge ./modules.json
   - recherche + filtres
   - session légère via guard-espace.js
   - ouvre les activités avec phone + slug seulement si compatibles
   - supporte modules.json en tableau direct OU { modules:[...] }
   - garde visibles les activités sans lien, avec fallback vers ENTRY_URL
   - IMPORTANT : le slug est géré PAR ACTIVITÉ, pas comme une vérité universelle
   - FIX : évite d’envoyer un pro connu vers "commencer à payer" quand une route PRO peut être construite
*/

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const SITE_URL = "https://digiylyfe.com/";
const HUB_URL = "https://digiylyfe.com/#hub";
const TARIFS_URL = "https://tarifs.digiylyfe.com/";
const ENTRY_URL = "https://commencer-a-payer.digiylyfe.com/";
const MODULES_JSON_URL = "./modules.json";

/* DIGIY — nouvelles portes PRO : l'Espace PRO ouvre les HUB modules,
   pas les anciens dashboards ni les anciennes entrées. */
const PRO_MODULE_HUB_URLS = {
  POS: "https://commerce-pro.digiylyfe.com/hub.html",
  COMMERCE: "https://commerce-pro.digiylyfe.com/hub.html",
  DRIVER: "https://pro-driver.digiylyfe.com/hub.html",
  LOC: "https://pro-loc.digiylyfe.com/hub.html",
  RESA: "https://pro-resa-resto.digiylyfe.com/hub.html",
  RESTO: "https://pro-resa-resto.digiylyfe.com/hub.html",
  MARKET: "https://pro-market.digiylyfe.com/hub.html",
  BUILD: "https://pro-build.digiylyfe.com/hub.html",
  SERVICES: "https://pro-build.digiylyfe.com/hub.html",
  PAY: "https://pro-pay.digiylyfe.com/hub.html",
  JOBS: "https://pro-job.digiylyfe.com/hub.html",
  EXPLORE: "https://pro-explore.digiylyfe.com/hub.html"
};

function isOfficialProHubUrl(url) {
  const s = String(url || "");
  return Object.values(PRO_MODULE_HUB_URLS).some((u) => s === u);
}

function normalizeProModuleUrl(url, moduleCode = "") {
  const code = normModuleCode(moduleCode);
  if (code && PRO_MODULE_HUB_URLS[code]) return PRO_MODULE_HUB_URLS[code];

  const s = String(url || "").toLowerCase();
  if (s.includes("commerce-pro.digiylyfe.com")) return PRO_MODULE_HUB_URLS.COMMERCE;
  if (s.includes("pro-driver.digiylyfe.com")) return PRO_MODULE_HUB_URLS.DRIVER;
  if (s.includes("pro-loc.digiylyfe.com")) return PRO_MODULE_HUB_URLS.LOC;
  if (s.includes("pro-resa-resto.digiylyfe.com")) return PRO_MODULE_HUB_URLS.RESA;
  if (s.includes("pro-market.digiylyfe.com")) return PRO_MODULE_HUB_URLS.MARKET;
  if (s.includes("pro-build.digiylyfe.com")) return PRO_MODULE_HUB_URLS.BUILD;
  if (s.includes("pro-pay.digiylyfe.com")) return PRO_MODULE_HUB_URLS.PAY;
  if (s.includes("pro-job.digiylyfe.com")) return PRO_MODULE_HUB_URLS.JOBS;
  if (s.includes("pro-explore.digiylyfe.com")) return PRO_MODULE_HUB_URLS.EXPLORE;
  return url;
}

/* Clés officielles DIGIY */
const STORAGE_PHONE = "digiy_phone";
const STORAGE_SLUG = "digiy_slug";
const STORAGE_MODULE_SLUGS = "digiy_module_slugs";
const STORAGE_ACTIVE_MODULE = "digiy_active_module";

/* Compat anciennes clés si encore présentes */
const LEGACY_STORAGE_PHONE = "DIGIY_HUB_PHONE";
const LEGACY_STORAGE_SLUG = "DIGIY_PRO_SLUG";

/* Préfixes connus — sécurité anti-mauvais tiroir */
const DEFAULT_SLUG_PREFIX = {
  POS: "pos",
  COMMERCE: "commerce",
  DRIVER: "driver",
  LOC: "loc",
  RESA: "resa",
  MARKET: "market",
  BUILD: "build",
  PAY: "pay",
  JOBS: "jobs",
  EXPLORE: "explore",
  RESTO: "resto",
  NDIMBAL: "ndimbal"
};

const SLUG_PREFIX_ALIASES = {
  POS: ["pos", "commerce", "mon-commerce"],
  COMMERCE: ["commerce", "pos", "mon-commerce"],
  DRIVER: ["driver"],
  LOC: ["loc"],
  RESA: ["resa"],
  MARKET: ["market"],
  BUILD: ["build"],
  PAY: ["pay"],
  JOBS: ["jobs"],
  EXPLORE: ["explore"],
  RESTO: ["resto", "resa-resto"],
  NDIMBAL: ["ndimbal"]
};

let MODULES = [];

const state = {
  q: "",
  status: "all"
};

function normPhone(p) {
  const s = String(p || "").trim().replace(/[^\d]/g, "");
  return s; // format DB : "221771342889" sans +
}

function phoneDigits(p) {
  return String(p || "").replace(/\D/g, "");
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
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function getUrlParam(name) {
  try {
    return new URL(location.href).searchParams.get(name) || "";
  } catch (_) {
    return "";
  }
}

function resolveUrl(raw, base = location.href) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    return new URL(s, base).toString();
  } catch (_) {
    return "";
  }
}

function withParam(url, k, v) {
  if (!url || !v) return url;
  try {
    const u = new URL(url, location.href);
    u.searchParams.set(k, v);
    return u.toString();
  } catch (_) {
    return url;
  }
}

function go(url) {
  if (!url) return;
  location.href = url;
}

function readModuleSlugs() {
  try {
    const raw = localStorage.getItem(STORAGE_MODULE_SLUGS);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeModuleSlugs(map) {
  try {
    localStorage.setItem(STORAGE_MODULE_SLUGS, JSON.stringify(map || {}));
  } catch (_) {}
}

function getPhone() {
  try {
    const official = normPhone(localStorage.getItem(STORAGE_PHONE) || "");
    if (official) return official;

    const legacy = normPhone(localStorage.getItem(LEGACY_STORAGE_PHONE) || "");
    if (legacy) return legacy;
  } catch (_) {}
  return "";
}

function getGenericSlug() {
  try {
    const official = normSlug(localStorage.getItem(STORAGE_SLUG) || "");
    if (official) return official;

    const legacy = normSlug(localStorage.getItem(LEGACY_STORAGE_SLUG) || "");
    if (legacy) return legacy;
  } catch (_) {}
  return "";
}

function savePhone(phone) {
  const p = normPhone(phone);
  if (!p) return;
  try {
    localStorage.setItem(STORAGE_PHONE, p);
    localStorage.setItem(LEGACY_STORAGE_PHONE, p);
  } catch (_) {}
}

function saveGenericSlug(slug) {
  const s = normSlug(slug);
  if (!s) return;
  try {
    localStorage.setItem(STORAGE_SLUG, s);
    localStorage.setItem(LEGACY_STORAGE_SLUG, s);
  } catch (_) {}
}

function saveActiveModule(moduleCode) {
  const code = normModuleCode(moduleCode);
  if (!code) return;
  try {
    localStorage.setItem(STORAGE_ACTIVE_MODULE, code);
  } catch (_) {}
}

function saveModuleSlug(moduleCode, slug) {
  const code = normModuleCode(moduleCode);
  const s = normSlug(slug);
  if (!code || !s) return;

  const moduleObj = findModuleByCode(code) || { code };
  if (!slugMatchesModule(s, moduleObj)) {
    console.warn("DIGIY HUB — slug refusé car il ne correspond pas à cette activité", {
      module: code,
      slug: s
    });
    return;
  }

  const map = readModuleSlugs();
  map[code] = s;
  writeModuleSlugs(map);
}

function clearSession() {
  try {
    if (window.DIGIY_ESPACE && typeof window.DIGIY_ESPACE.clearSession === "function") {
      window.DIGIY_ESPACE.clearSession();
      return;
    }
  } catch (_) {}

  try {
    localStorage.removeItem(STORAGE_PHONE);
    localStorage.removeItem(STORAGE_SLUG);
    localStorage.removeItem(STORAGE_MODULE_SLUGS);
    localStorage.removeItem(STORAGE_ACTIVE_MODULE);

    localStorage.removeItem(LEGACY_STORAGE_PHONE);
    localStorage.removeItem(LEGACY_STORAGE_SLUG);
  } catch (_) {}
}

function uniqueList(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function getModulePrefixes(moduleObj) {
  const code = normModuleCode(moduleObj?.code || moduleObj?.key || "");
  const explicit = String(moduleObj?.slugPrefix || "").trim().toLowerCase().replace(/_+/g, "-");
  const fallback = code ? code.toLowerCase().replace(/_/g, "-") : "";

  return uniqueList([
    explicit,
    ...(SLUG_PREFIX_ALIASES[code] || []),
    DEFAULT_SLUG_PREFIX[code],
    fallback
  ].map(normSlug));
}

function getPrimarySlugPrefix(moduleObj) {
  const prefixes = getModulePrefixes(moduleObj);
  return prefixes[0] || "";
}

function slugMatchesModule(slug, moduleObj) {
  const s = normSlug(slug);
  const prefixes = getModulePrefixes(moduleObj);

  if (!s || !prefixes.length) return false;

  return prefixes.some((prefix) => {
    return s === prefix || s.startsWith(prefix + "-");
  });
}

function findModuleByCode(code) {
  const c = normModuleCode(code);
  if (!c) return null;
  return MODULES.find((m) => normModuleCode(m.code || m.key || "") === c) || null;
}

function getModuleSlugFromMap(moduleCode) {
  const code = normModuleCode(moduleCode);
  if (!code) return "";

  const map = readModuleSlugs();
  return normSlug(map[code] || "");
}

function buildExpectedSlugFromPhone(moduleObj) {
  const phone = getPhone();
  const digits = phoneDigits(phone);
  const prefix = getPrimarySlugPrefix(moduleObj);

  if (!digits || !prefix) return "";
  return normSlug(`${prefix}-${digits}`);
}

function getBestSlugForModule(moduleObj) {
  const code = normModuleCode(moduleObj.code || moduleObj.key || "");

  try {
    if (window.DIGIY_ESPACE?.getSlugForModule) {
      const s = normSlug(window.DIGIY_ESPACE.getSlugForModule(code) || "");
      if (s && slugMatchesModule(s, moduleObj)) return s;
    }
  } catch (_) {}

  const specificSlug = getModuleSlugFromMap(code);
  if (specificSlug && slugMatchesModule(specificSlug, moduleObj)) {
    return specificSlug;
  }

  const genericSlug = getGenericSlug();
  if (genericSlug && slugMatchesModule(genericSlug, moduleObj)) {
    return genericSlug;
  }

  /*
    Dernier filet utile :
    si le téléphone est connu, on construit le slug standard attendu.
    Si l’accès n’existe pas réellement, le guard du module affichera la protection.
    Mais on évite de renvoyer trop vite vers "commencer à payer".
  */
  const expectedSlug = buildExpectedSlugFromPhone(moduleObj);
  if (expectedSlug) return expectedSlug;

  return "";
}

function badgeHTML(status, label) {
  const cls = escapeHtml(status || "soon");
  const txt = escapeHtml(label || (status ? status.toUpperCase() : "—"));
  return `<span class="tag ${cls}">${txt}</span>`;
}

function cardHTML(m) {
  const downNote = !m.directUrl
    ? `<div style="margin-top:8px;font-size:11px;color:#fecaca;font-weight:800">Porte en préparation • inscription DIGIY disponible</div>`
    : "";

  return `
    <div class="cardModule" data-key="${escapeHtml(m.key)}" tabindex="0" role="button" aria-label="${escapeHtml(m.name)}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="display:flex;gap:12px;align-items:flex-start;min-width:0">
          <div style="font-size:28px;line-height:1">${escapeHtml(m.icon || "∞")}</div>
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:950">${escapeHtml(m.name)}</div>
            <div style="font-size:12px;color:#fde68a;font-weight:900;margin-top:4px">${escapeHtml(m.tag || "")}</div>
            <div style="font-size:12px;color:#cbd5e1;line-height:1.45;margin-top:6px">${escapeHtml(m.desc || "")}</div>
            ${downNote}
          </div>
        </div>
        <div>${badgeHTML(m.status, m.statusLabel)}</div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="smallbtn" data-action="open" type="button" style="min-width:160px;flex:1">Entrer →</button>
        <button class="smallbtn" data-action="copy" type="button" style="min-width:160px;flex:1">Copier lien</button>
      </div>
    </div>
  `;
}

function buildEntryUrl(moduleCode = "") {
  const u = new URL(ENTRY_URL);

  const code = normModuleCode(moduleCode);
  const phone = getPhone();

  if (code) u.searchParams.set("module", code);
  if (phone) u.searchParams.set("phone", phone);

  return u.toString();
}

function normalizeKnownUrl(url, moduleCode = "") {
  const s = String(url || "").trim();
  if (!s) return "";

  const lower = s.toLowerCase();

  if (lower.includes("tarif") || lower.includes("pricing") || lower.includes("price")) {
    return TARIFS_URL;
  }

  return normalizeProModuleUrl(s, moduleCode);
}

function buildModuleLink(m) {
  const phone = getPhone();
  const slug = getBestSlugForModule(m);
  const code = normModuleCode(m.code || m.key || "");
  const needsSlug = m.slugParam !== false;

  let url = resolveUrl(normalizeKnownUrl(m.directUrl || "", code));
  url = normalizeProModuleUrl(url, code);

  if (!url) {
    return buildEntryUrl(code);
  }

  /*
    Nouvelle doctrine : depuis Mon Espace PRO, on ouvre le HUB du module.
    On ne propage plus phone/slug dans l'adresse visible ; le guard/PIN du module prend le relais.
  */
  if (isOfficialProHubUrl(url)) {
    return url;
  }

  /*
    Avant : si pas de slug trouvé => commencer à payer.
    Maintenant : si téléphone connu, getBestSlugForModule construit un slug logique.
    Si aucun téléphone, seulement là on renvoie vers l’inscription.
  */
  /*
    DIGIY terrain : si pas de téléphone ou pas de slug,
    on ouvre le module directement — son guard gère l'auth.
    On ne renvoie JAMAIS vers "commencer à payer" si une directUrl existe.
  */
  if (!phone) {
    return url; /* directUrl brut — guard du module prend le relais */
  }

  if (needsSlug && !slug) {
    /* Téléphone connu mais pas de slug → module avec phone seulement */
    let u = withParam(url, "phone", phone);
    if (code) u = withParam(u, "module", code);
    return u;
  }

  if (needsSlug && slug) {
    url = withParam(url, "slug", slug);
  }

  if (m.phoneParam && phone) {
    url = withParam(url, "phone", phone);
  }

  if (code) {
    url = withParam(url, "module", code);
  }

  return url;
}

function updateHeader() {
  const subtitleEl = $("#subtitle");
  const statusEl = $("#status");
  const miniEl = $("#mini");

  const phone = getPhone();

  if (!subtitleEl || !statusEl || !miniEl) return;

  if (!phone) {
    subtitleEl.textContent = "Accès PRO • session non détectée";
    statusEl.innerHTML = "<span class='err'>Aucune session détectée</span>";
    miniEl.innerHTML = "Passe par l’inscription DIGIY pour créer ton espace PRO et ouvrir tes activités.";
    return;
  }

  subtitleEl.textContent = "Compte détecté • choisis ton activité";

  statusEl.innerHTML = "<span class='ok'>Espace prêt</span>";
  miniEl.innerHTML = "Choisis une porte. DIGIY garde le bon accès et t’envoie vers l’outil utile 👑";
}

function filteredModules() {
  const q = String(state.q || "").trim().toLowerCase();

  return MODULES.filter((m) => {
    if (state.status !== "all" && m.status !== state.status) return false;
    if (!q) return true;

    const hay = [
      m.key,
      m.code,
      m.name,
      m.tag,
      m.desc,
      m.status,
      m.statusLabel,
      m.slugPrefix
    ].join(" ").toLowerCase();

    return hay.includes(q);
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("clipboard unavailable"));
}

function openModule(m) {
  const phone = getPhone();
  const slug = getBestSlugForModule(m);
  const code = normModuleCode(m.code || m.key || "");
  const url = buildModuleLink(m);

  if (phone) savePhone(phone);
  if (code) saveActiveModule(code);

  try {
    if (window.DIGIY_ESPACE?.setActiveModule && code) {
      window.DIGIY_ESPACE.setActiveModule(code);
    }
  } catch (_) {}

  /*
    On mémorise le slug seulement s’il appartient vraiment à cette activité.
    Exemple évité : un slug LOC rangé dans MARKET.
  */
  if (slug && code && slugMatchesModule(slug, m)) {
    saveModuleSlug(code, slug);
    try {
      if (window.DIGIY_ESPACE?.setModuleSlug) {
        window.DIGIY_ESPACE.setModuleSlug(code, slug);
      }
    } catch (_) {}
  }

  console.info("DIGIY HUB openModule", {
    module: code,
    phone,
    slug,
    finalUrl: url
  });

  go(url);
}

function copyModuleLink(m) {
  const link = buildModuleLink(m);
  copyToClipboard(link).then(
    () => alert("Copié ✅\n" + link),
    () => alert("Lien prêt 👇\n" + link)
  );
}

function renderModules() {
  const grid = $("#modulesGrid");
  if (!grid) return;

  const list = filteredModules();

  if (!list.length) {
    grid.innerHTML = `<div class="empty">Aucune activité trouvée.</div>`;
    return;
  }

  grid.innerHTML = list.map(cardHTML).join("");

  $$(".cardModule", grid).forEach((card) => {
    const key = card.getAttribute("data-key");
    const m = MODULES.find((x) => x.key === key);
    if (!m) return;

    card.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button");
      const action = btn?.dataset?.action || "open";

      if (action === "copy") {
        e.preventDefault();
        e.stopPropagation();
        copyModuleLink(m);
        return;
      }

      openModule(m);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModule(m);
      }
    });
  });
}

async function loadModules() {
  const jsonUrl = resolveUrl(MODULES_JSON_URL);
  const r = await fetch(`${jsonUrl}?v=${Date.now()}`, { cache: "no-store" });

  if (!r.ok) throw new Error(`modules.json HTTP ${r.status}`);

  const j = await r.json();

  const arr = Array.isArray(j)
    ? j
    : Array.isArray(j.modules)
      ? j.modules
      : [];

  const normalized = arr
    .filter(Boolean)
    .map((m) => {
      const rawUrl = String(m.directUrl || "").trim();
      const code = normModuleCode(m.code || m.key || "");
      const cleanUrl = normalizeKnownUrl(rawUrl, code);
      const resolvedUrl = resolveUrl(cleanUrl);
      const key = String(m.key || code || "").trim();

      return {
        key,
        code,
        name: String(m.name || "").trim(),
        icon: String(m.icon || "∞"),
        tag: String(m.tag || "").trim(),
        desc: String(m.desc || "").trim(),
        status: String(m.status || "").trim().toLowerCase(),
        statusLabel: String(m.statusLabel || "").trim(),
        phoneParam: m.phoneParam !== false,
        slugParam: m.slugParam !== false,
        slugPrefix: String(m.slugPrefix || "").trim().toLowerCase(),
        directUrl: resolvedUrl,
        directUrlRaw: rawUrl
      };
    })
    .filter((m) => m.key && m.name);

  MODULES = normalized;

  const broken = MODULES.filter((m) => !m.directUrl);
  if (broken.length) {
    console.warn("DIGIY HUB — activités sans directUrl valide :", broken.map((m) => ({
      key: m.key,
      code: m.code,
      name: m.name,
      directUrlRaw: m.directUrlRaw
    })));
  }

  console.table(MODULES.map((m) => ({
    key: m.key,
    code: m.code,
    name: m.name,
    status: m.status,
    slugPrefix: m.slugPrefix || "(auto)",
    directUrl: m.directUrl || "(fallback inscription)"
  })));
}

function bindStaticActions() {
  $("#searchInput")?.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    renderModules();
  });

  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.status = btn.dataset.status || "all";
      renderModules();
    });
  });

  $("#btnInscription")?.addEventListener("click", () => {
    go(buildEntryUrl(""));
  });

  $("#btnRefresh")?.addEventListener("click", () => {
    location.reload();
  });

  $("#logout")?.addEventListener("click", () => {
    if (!confirm("Déconnexion ?")) return;
    clearSession();
    location.reload();
  });
}

async function waitHubIfPresent() {
  try {
    if (window.DIGIY_ESPACE?.ready) {
      await window.DIGIY_ESPACE.ready;
    }
  } catch (_) {}
}

function absorbUrlSession() {
  const phoneQ = normPhone(getUrlParam("phone"));
  const slugQ = normSlug(getUrlParam("slug"));
  const moduleQ = normModuleCode(getUrlParam("module"));

  if (phoneQ) savePhone(phoneQ);

  /*
    Correction importante :
    si module + slug arrivent ensemble, on ne range le slug dans ce module
    que s’il correspond vraiment au préfixe attendu.
    Cela évite MARKET avec un identifiant LOC, ou inversement.
  */
  if (moduleQ && slugQ) {
    saveActiveModule(moduleQ);

    const temporaryModule = findModuleByCode(moduleQ) || { code: moduleQ };

    if (slugMatchesModule(slugQ, temporaryModule)) {
      saveModuleSlug(moduleQ, slugQ);

      try {
        if (window.DIGIY_ESPACE?.setActiveModule) {
          window.DIGIY_ESPACE.setActiveModule(moduleQ);
        }
        if (window.DIGIY_ESPACE?.setModuleSlug) {
          window.DIGIY_ESPACE.setModuleSlug(moduleQ, slugQ);
        }
      } catch (_) {}
    } else {
      console.warn("DIGIY HUB — slug URL ignoré car incompatible avec l’activité", {
        module: moduleQ,
        slug: slugQ
      });
    }

    return;
  }

  if (slugQ) {
    saveGenericSlug(slugQ);
    try {
      if (window.DIGIY_ESPACE?.setSlug) {
        window.DIGIY_ESPACE.setSlug(slugQ);
      }
    } catch (_) {}
  }
}

async function boot() {
  bindStaticActions();

  await waitHubIfPresent();

  const grid = $("#modulesGrid");
  if (grid) {
    grid.innerHTML = `<div class="empty">Chargement des activités…</div>`;
  }

  await loadModules();

  /*
    On absorbe la session APRÈS modules.json.
    Comme ça, on peut vérifier qu’un slug appartient bien à l’activité demandée.
  */
  absorbUrlSession();
  updateHeader();
  renderModules();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("hub.js boot error:", err);
    updateHeader();

    const grid = $("#modulesGrid");
    if (grid) {
      grid.innerHTML = `<div class="empty">Impossible de charger les activités.</div>`;
    }
  });
});


