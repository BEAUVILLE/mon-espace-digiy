/* hub.js — PRO-ESPACE DIGIY
   - charge ./modules.json
   - recherche + filtres
   - session légère via guard-espace.js
   - ouvre les modules avec phone + slug seulement si compatibles
   - supporte modules.json en tableau direct OU { modules:[...] }
   - garde visibles les modules sans lien, avec fallback vers ENTRY_URL
   - IMPORTANT : le slug est géré PAR MODULE, pas comme une vérité universelle
*/

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const ENTRY_URL = "https://commencer-a-payer.digiylyfe.com/";
const MODULES_JSON_URL = "./modules.json";

/* Clés officielles DIGIY */
const STORAGE_PHONE = "digiy_phone";
const STORAGE_SLUG = "digiy_slug";
const STORAGE_MODULE_SLUGS = "digiy_module_slugs";
const STORAGE_ACTIVE_MODULE = "digiy_active_module";

/* Compat anciennes clés si encore présentes */
const LEGACY_STORAGE_PHONE = "DIGIY_HUB_PHONE";
const LEGACY_STORAGE_SLUG = "DIGIY_PRO_SLUG";

let MODULES = [];

const state = {
  q: "",
  status: "all"
};

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

function getModulePrefix(moduleObj) {
  const explicit = String(moduleObj.slugPrefix || "").trim().toLowerCase();
  if (explicit) return explicit.replace(/_+/g, "-");

  const code = normModuleCode(moduleObj.code || moduleObj.key || "");
  if (!code) return "";
  return code.toLowerCase().replace(/_/g, "-");
}

function slugMatchesModule(slug, moduleObj) {
  const s = normSlug(slug);
  const prefix = getModulePrefix(moduleObj);

  if (!s || !prefix) return false;
  return s === prefix || s.startsWith(prefix + "-");
}

function getModuleSlugFromMap(moduleCode) {
  const code = normModuleCode(moduleCode);
  if (!code) return "";

  const map = readModuleSlugs();
  return normSlug(map[code] || "");
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

  return "";
}

function badgeHTML(status, label) {
  const cls = escapeHtml(status || "soon");
  const txt = escapeHtml(label || (status ? status.toUpperCase() : "—"));
  return `<span class="tag ${cls}">${txt}</span>`;
}

function cardHTML(m) {
  const downNote = !m.directUrl
    ? `<div style="margin-top:8px;font-size:11px;color:#fecaca;font-weight:800">Lien module non branché • renvoi vers l’inscription DIGIY</div>`
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

function buildModuleLink(m) {
  const phone = getPhone();
  const slug = getBestSlugForModule(m);
  const code = normModuleCode(m.code || m.key || "");
  const needsSlug = m.slugParam !== false;

  let url = resolveUrl(m.directUrl || "");

  if (!url) {
    return buildEntryUrl(code);
  }

  // IMPORTANT :
  // si le module attend un slug et qu'on ne l'a pas,
  // on ne tente PAS d'ouvrir le module à vide.
  if (needsSlug && !slug) {
    return buildEntryUrl(code);
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
  const slug = getGenericSlug();

  if (!subtitleEl || !statusEl || !miniEl) return;

  if (!phone) {
    subtitleEl.textContent = "Accès PRO • boulevards métiers • session non détectée";
    statusEl.innerHTML = "<span class='err'>Aucune session détectée</span>";
    miniEl.innerHTML = "Passe par l’inscription DIGIY pour créer ton espace PRO et ouvrir tes boulevards métiers.";
    return;
  }

  subtitleEl.textContent = slug
    ? `${phone} • ${slug}`
    : `${phone} • téléphone détecté`;

  statusEl.innerHTML = "<span class='ok'>Rond-point prêt</span>";
  miniEl.innerHTML = slug
    ? "Choisis ton boulevard métier. Le <b>slug</b> ne part que s’il correspond au bon module 👑"
    : "Choisis ton boulevard métier. Le <b>phone</b> est prêt, le module prendra le relais 👑";
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

  // IMPORTANT :
  // on mémorise le slug pour LE module seulement.
  // On évite de repolluer le slug global à chaque clic.
  if (slug && code) {
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
    grid.innerHTML = `<div class="empty">Aucun boulevard métier trouvé.</div>`;
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
      const resolvedUrl = resolveUrl(rawUrl);
      const code = normModuleCode(m.code || m.key || "");
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
    console.warn("DIGIY HUB — modules sans directUrl valide :", broken.map((m) => ({
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

  // IMPORTANT :
  // si module + slug => on range dans le tiroir du module
  // sinon seulement on accepte un slug global
  if (moduleQ && slugQ) {
    saveActiveModule(moduleQ);
    saveModuleSlug(moduleQ, slugQ);

    try {
      if (window.DIGIY_ESPACE?.setActiveModule) {
        window.DIGIY_ESPACE.setActiveModule(moduleQ);
      }
      if (window.DIGIY_ESPACE?.setModuleSlug) {
        window.DIGIY_ESPACE.setModuleSlug(moduleQ, slugQ);
      }
    } catch (_) {}
  } else if (slugQ) {
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
  absorbUrlSession();
  updateHeader();

  const grid = $("#modulesGrid");
  if (grid) {
    grid.innerHTML = `<div class="empty">Chargement des modules…</div>`;
  }

  await loadModules();
  renderModules();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("hub.js boot error:", err);
    updateHeader();

    const grid = $("#modulesGrid");
    if (grid) {
      grid.innerHTML = `<div class="empty">Impossible de charger les modules.</div>`;
    }
  });
});
