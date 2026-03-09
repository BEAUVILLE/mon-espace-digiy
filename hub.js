/* PRO-ESPACE — HUB PRO (JSON) — version DIGIY recousue
   - charge ./modules.json
   - filtre + recherche
   - ouvre les modules avec phone + slug module-compatible
   - compatible avec guard-espace.js
*/

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* === Clés officielles HUB DIGIY === */
const STORAGE_PHONE = "digiy_phone";
const STORAGE_SLUG = "digiy_slug";
const STORAGE_MODULE_SLUGS = "digiy_module_slugs";

/* === Compat anciennes clés (fallback) === */
const LEGACY_STORAGE_PHONE = "DIGIY_HUB_PHONE";
const LEGACY_STORAGE_SLUG = "DIGIY_PRO_SLUG";

let MODULES = [];
const MODULES_JSON_URL = "./modules.json";

const state = {
  q: "",
  status: "all" // all | live | nouveau | priorite | beta...
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

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

function getUrlParam(name) {
  try {
    return new URL(location.href).searchParams.get(name) || "";
  } catch (_) {
    return "";
  }
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
  const urlSlug = normSlug(getUrlParam("slug"));
  if (urlSlug) return urlSlug;

  try {
    const official = normSlug(localStorage.getItem(STORAGE_SLUG) || "");
    if (official) return official;

    const legacy = normSlug(localStorage.getItem(LEGACY_STORAGE_SLUG) || "");
    if (legacy) return legacy;
  } catch (_) {}

  return "";
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

function saveGenericSlug(slug) {
  const s = normSlug(slug);
  if (!s) return;
  try {
    localStorage.setItem(STORAGE_SLUG, s);
    localStorage.setItem(LEGACY_STORAGE_SLUG, s);
  } catch (_) {}
}

function savePhone(phone) {
  const p = normPhone(phone);
  if (!p) return;
  try {
    localStorage.setItem(STORAGE_PHONE, p);
    localStorage.setItem(LEGACY_STORAGE_PHONE, p);
  } catch (_) {}
}

function saveModuleSlug(moduleCode, slug) {
  const code = String(moduleCode || "").trim().toUpperCase();
  const s = normSlug(slug);
  if (!code || !s) return;

  try {
    const map = readModuleSlugs();
    map[code] = s;
    localStorage.setItem(STORAGE_MODULE_SLUGS, JSON.stringify(map));
  } catch (_) {}
}

function slugMatchesModule(slug, moduleObj) {
  const s = normSlug(slug);
  const prefix = String(moduleObj.slugPrefix || "").trim().toLowerCase();
  if (!s || !prefix) return false;
  return s.startsWith(prefix);
}

function getBestSlugForModule(moduleObj) {
  const map = readModuleSlugs();

  if (moduleObj.code && map[moduleObj.code] && slugMatchesModule(map[moduleObj.code], moduleObj)) {
    return map[moduleObj.code];
  }

  const genericSlug = getGenericSlug();
  if (slugMatchesModule(genericSlug, moduleObj)) {
    return genericSlug;
  }

  return "";
}

function withParam(url, k, v) {
  if (!url) return "";
  if (!v) return url;

  try {
    const u = new URL(url);
    u.searchParams.set(k, v);
    return u.toString();
  } catch (_) {
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + encodeURIComponent(k) + "=" + encodeURIComponent(v);
  }
}

async function waitHubIfPresent() {
  try {
    if (window.DIGIY_ESPACE && window.DIGIY_ESPACE.ready) {
      await window.DIGIY_ESPACE.ready;
    }
  } catch (_) {}
}

async function loadModules() {
  const r = await fetch(`${MODULES_JSON_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`modules.json HTTP ${r.status}`);

  const j = await r.json();
  const arr = Array.isArray(j.modules) ? j.modules : [];

  MODULES = arr
    .filter(Boolean)
    .map(m => ({
      key: String(m.key || "").trim(),
      code: String(m.code || m.key || "").trim().toUpperCase(),
      name: String(m.name || "").trim(),
      icon: m.icon || "∞",
      tag: String(m.tag || "").trim(),
      desc: String(m.desc || "").trim(),
      kind: "pro",
      status: String(m.status || "").trim(),
      statusLabel: String(m.statusLabel || "").trim(),
      phoneParam: m.phoneParam !== false,
      slugParam: m.slugParam !== false,
      slugPrefix: String(m.slugPrefix || "").trim().toLowerCase(),
      directUrl: String(m.directUrl || "").trim()
    }))
    .filter(m => m.key && m.name && m.directUrl);
}

function badgeHTML(status, label) {
  const cls = status || "soon";
  const txt = label || (status ? status.toUpperCase() : "—");
  return `<span class="badge ${escapeHtml(cls)}">${escapeHtml(txt)}</span>`;
}

function cardHTML(m) {
  return `
  <div class="card" data-key="${escapeHtml(m.key)}" tabindex="0" role="button" aria-label="${escapeHtml(m.name)}">
    <div class="cardTop">
      <div class="icon">${escapeHtml(m.icon)}</div>
      <div style="flex:1;min-width:0">
        <div class="cardTitle">${escapeHtml(m.name)}</div>
        <div class="cardTag">${escapeHtml(m.tag)}</div>
        <div class="cardDesc">${escapeHtml(m.desc)}</div>
        <div class="badges">${badgeHTML(m.status, m.statusLabel)}</div>
      </div>
    </div>
    <div class="cardActions">
      <button class="btn primary" data-action="open" type="button">Entrer →</button>
      <button class="btn" data-action="copy" type="button">Copier lien</button>
    </div>
  </div>`;
}

function filtered() {
  const q = (state.q || "").trim().toLowerCase();

  return MODULES.filter(m => {
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

function buildModuleLink(m) {
  const phone = getPhone();
  const slug = getBestSlugForModule(m);

  let url = m.directUrl;

  // règle DIGIY :
  // - on transmet le slug seulement s’il est compatible avec le module
  // - on peut transmettre aussi le phone si le module l’accepte
  if (m.slugParam && slug) {
    url = withParam(url, "slug", slug);
  }

  if (m.phoneParam && phone) {
    url = withParam(url, "phone", phone);
  }

  return url;
}

function openModule(m) {
  const url = buildModuleLink(m);

  const phone = getPhone();
  const slug = getBestSlugForModule(m);

  if (phone) savePhone(phone);
  if (slug) {
    saveGenericSlug(slug);
    if (m.code) saveModuleSlug(m.code, slug);
  }

  window.location.href = url;
}

function copyModuleLink(m) {
  const link = buildModuleLink(m);

  navigator.clipboard?.writeText(link).then(
    () => alert("Copié ✅\n" + link),
    () => alert("Lien prêt 👇\n" + link)
  );
}

function render() {
  const grid = $("#modulesGrid");
  if (!grid) return;

  const list = filtered();
  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<div class="empty">Aucun module PRO trouvé.</div>`;

  $$(".card", grid).forEach(card => {
    const key = card.getAttribute("data-key");
    const m = MODULES.find(x => x.key === key);
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

async function boot() {
  await waitHubIfPresent();

  // si phone/slug arrivent directement dans l'URL, on les garde
  const phoneQ = normPhone(getUrlParam("phone"));
  const slugQ = normSlug(getUrlParam("slug"));
  const moduleQ = String(getUrlParam("module") || "").trim().toUpperCase();

  if (phoneQ) savePhone(phoneQ);
  if (slugQ) saveGenericSlug(slugQ);
  if (moduleQ && slugQ) saveModuleSlug(moduleQ, slugQ);

  $("#searchInput")?.addEventListener("input", (e) => {
    state.q = e.target.value;
    render();
  });

  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.status = btn.dataset.status || "all";
      render();
    });
  });

  await loadModules();
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch(err => {
    console.error("PRO-ESPACE boot error:", err);
    const grid = $("#modulesGrid");
    if (grid) {
      grid.innerHTML = `<div class="empty">Impossible de charger les modules.</div>`;
    }
  });
});
