/* hub.js — PRO-ESPACE DIGIY
   - charge ./modules.json
   - recherche + filtres
   - session légère via guard-espace.js
   - ouvre les modules avec phone + slug seulement si compatibles
*/

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const ENTRY_URL = "https://commencer-a-payer.digiylyfe.com/";
const MODULES_JSON_URL = "./modules.json";

/* Clés officielles DIGIY */
const STORAGE_PHONE = "digiy_phone";
const STORAGE_SLUG = "digiy_slug";
const STORAGE_MODULE_SLUGS = "digiy_module_slugs";

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

    localStorage.removeItem(LEGACY_STORAGE_PHONE);
    localStorage.removeItem(LEGACY_STORAGE_SLUG);
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
  if (!url || !v) return url;

  try {
    const u = new URL(url);
    u.searchParams.set(k, v);
    return u.toString();
  } catch (_) {
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + encodeURIComponent(k) + "=" + encodeURIComponent(v);
  }
}

function go(url) {
  location.href = url;
}

function badgeHTML(status, label) {
  const cls = escapeHtml(status || "soon");
  const txt = escapeHtml(label || (status ? status.toUpperCase() : "—"));
  return `<span class="tag ${cls}">${txt}</span>`;
}

function cardHTML(m) {
  return `
    <div class="cardModule" data-key="${escapeHtml(m.key)}" tabindex="0" role="button" aria-label="${escapeHtml(m.name)}">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="display:flex;gap:12px;align-items:flex-start;min-width:0">
          <div style="font-size:28px;line-height:1">${escapeHtml(m.icon || "∞")}</div>
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:950">${escapeHtml(m.name)}</div>
            <div style="font-size:12px;color:#fde68a;font-weight:900;margin-top:4px">${escapeHtml(m.tag || "")}</div>
            <div style="font-size:12px;color:#cbd5e1;line-height:1.45;margin-top:6px">${escapeHtml(m.desc || "")}</div>
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

  if (moduleCode) u.searchParams.set("module", moduleCode);

  const phone = getPhone();
  if (phone) u.searchParams.set("phone", phone);

  return u.toString();
}

function buildModuleLink(m) {
  const phone = getPhone();
  const slug = getBestSlugForModule(m);

  let url = m.directUrl;

  if (m.slugParam && slug) {
    url = withParam(url, "slug", slug);
  }

  if (m.phoneParam && phone) {
    url = withParam(url, "phone", phone);
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
  const url = buildModuleLink(m);

  if (phone) savePhone(phone);
  if (slug) {
    saveGenericSlug(slug);
    if (m.code) saveModuleSlug(m.code, slug);
  }

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
  const r = await fetch(`${MODULES_JSON_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`modules.json HTTP ${r.status}`);

  const j = await r.json();
  const arr = Array.isArray(j.modules) ? j.modules : [];

  MODULES = arr
    .filter(Boolean)
    .map((m) => ({
      key: String(m.key || "").trim(),
      code: String(m.code || m.key || "").trim().toUpperCase(),
      name: String(m.name || "").trim(),
      icon: String(m.icon || "∞"),
      tag: String(m.tag || "").trim(),
      desc: String(m.desc || "").trim(),
      status: String(m.status || "").trim().toLowerCase(),
      statusLabel: String(m.statusLabel || "").trim(),
      phoneParam: m.phoneParam !== false,
      slugParam: m.slugParam !== false,
      slugPrefix: String(m.slugPrefix || "").trim().toLowerCase(),
      directUrl: String(m.directUrl || "").trim()
    }))
    .filter((m) => m.key && m.name && m.directUrl);
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
  const moduleQ = String(getUrlParam("module") || "").trim().toUpperCase();

  if (phoneQ) savePhone(phoneQ);
  if (slugQ) saveGenericSlug(slugQ);
  if (moduleQ && slugQ) saveModuleSlug(moduleQ, slugQ);
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
