"use strict";

const { createClient } = require("@supabase/supabase-js");
const { buildPublicSummary } = require("./public-summary");

const SUPABASE_URL = "https://yrutfhxtrakhzqvvumrc.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_waLDIkQRmDey99vsiISp7w_62obi46v";
const OWNER_ID = "18eea104-0317-4152-af5a-ce7cf047a921";
const PENDING_KEY = "mltraining-cloud-pending";
const LOCAL_KEY = "mltraining-v1";
const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY);

let revision = 0;
let seedMap;
let queuedState = null;
let writing = false;
let blocked = false;
let migrationRequired = false;
let owner = false;
let retryTimer = null;

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const total = values => values.reduce((sum, value) => sum + (Number(value) || 0), 0);
const percent = (part, whole) => whole ? Math.round(100 * part / whole) : 0;

function status(message, type = "") {
  const target = owner ? $("#cloudStatus") : $("#publicStatus");
  if (!target) return;
  target.textContent = message;
  target.dataset.status = type;
}

function localState() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); }
  catch { return null; }
}

function downloadLocalBackup() {
  const data = localState();
  if (!data) return status("No existe una copia local en este navegador.", "error");
  downloadJSON(data, `mltraining-copia-local-${new Date().toISOString().slice(0, 10)}.json`);
}

function downloadJSON(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderPublic(summary = {}, updatedAt = null) {
  const levels = summary.competencies || {};
  const projects = Array.isArray(summary.projects) ? summary.projects : [];
  const rows = seedMap.routes.map(route => {
    const items = route.competencies;
    const score = total(items.map(item => Math.max(0, Math.min(4, Number(levels[item.id]?.level) || 0))));
    return { name: route.name, count: items.length, progress: percent(score, items.length * 4) };
  });
  const demonstrated = seedMap.routes.flatMap(route => route.competencies).filter(item => Number(levels[item.id]?.level) >= 3).length;
  const hours = total(Object.values(summary.hoursByDay || {}));
  $("#publicMetrics").innerHTML = `
    <article class="metric-card"><span>Competencias demostradas</span><strong>${demonstrated} / ${rows.reduce((sum, row) => sum + row.count, 0)}</strong><small>Niveles 3 o 4</small></article>
    <article class="metric-card"><span>Horas registradas</span><strong>${hours.toFixed(1)} h</strong><small>Desde el inicio del ciclo</small></article>
    <article class="metric-card"><span>Proyectos</span><strong>${projects.length}</strong><small>Portafolio en construcción</small></article>
    <article class="metric-card"><span>Última actualización</span><strong>${updatedAt ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(updatedAt)) : "—"}</strong><small>${updatedAt ? new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt)) : "Aún sin progreso publicado"}</small></article>`;
  $("#publicRoutes").innerHTML = rows.map(row => `<article class="route-card"><h3>${esc(row.name)}</h3><p>${row.count} competencias</p><div class="progress-track"><i style="width:${row.progress}%"></i></div><small>${row.progress}% de avance ponderado</small></article>`).join("");
  $("#publicProjects").innerHTML = projects.length ? projects.map(project => `<article class="project-card"><h3>${esc(project.title)}</h3><p>${project.status === "active" ? "En curso" : project.status === "done" ? "Finalizado" : "Planificado"}</p><div class="progress-track"><i style="width:${Math.max(0, Math.min(100, Number(project.progress) || 0))}%"></i></div><small>${Math.max(0, Math.min(100, Number(project.progress) || 0))}% de fases completas</small></article>`).join("") : `<p class="help">Los proyectos aparecerán cuando se publiquen avances.</p>`;
}

async function readPublic() {
  const { data, error } = await client.from("mltraining_public").select("summary,revision,updated_at").eq("id", "main").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La base de datos aún no está preparada.");
  return data;
}

async function readPrivate() {
  const { data, error } = await client.from("mltraining_private").select("data,revision").eq("id", "main").single();
  if (error) throw error;
  return data;
}

async function boot(seed, fallbackState) {
  seedMap = seed;
  $("#publicApp").hidden = false;
  $("#ownerApp").hidden = true;
  $("#ownerLoginButton").addEventListener("click", () => { $("#ownerLoginForm").hidden = !$("#ownerLoginForm").hidden; });
  $("#ownerLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#ownerLoginForm button[type=submit]");
    button.disabled = true;
    status("Comprobando acceso…");
    const form = new FormData(event.currentTarget);
    const { data, error } = await client.auth.signInWithPassword({ email: String(form.get("email") || ""), password: String(form.get("password") || "") });
    $("#ownerPassword").value = "";
    button.disabled = false;
    if (error) return status("No se pudo iniciar sesión. Revisa el correo y la contraseña de Supabase Auth.", "error");
    if (data.user?.id !== OWNER_ID) {
      await client.auth.signOut();
      return status("Esta cuenta no tiene permiso de edición.", "error");
    }
    location.reload();
  });
  $("#ownerMagicButton").addEventListener("click", async () => {
    const email = $("#ownerLoginForm input[name=email]");
    if (!email.reportValidity()) return;
    $("#ownerMagicButton").disabled = true;
    const { error } = await client.auth.signInWithOtp({ email: email.value, options: { shouldCreateUser: false, emailRedirectTo: "https://jovalam-3008.github.io/mltraining/" } });
    $("#ownerMagicButton").disabled = false;
    status(error ? "No se pudo enviar el enlace. Comprueba que tu usuario esté confirmado en Supabase Auth." : "Revisa tu correo y abre el enlace de acceso desde este navegador.", error ? "error" : "ok");
  });

  let publicReady = false;
  try {
    const publicData = await readPublic();
    renderPublic(publicData.summary, Number(publicData.revision) > 0 ? publicData.updated_at : null);
    status("Resumen público. Los registros personales permanecen privados.");
    publicReady = true;
  } catch {
    renderPublic();
    status("El almacenamiento todavía no está configurado o no responde. No se habilitará la edición hasta verificarlo.", "error");
  }

  const { data: authData } = await client.auth.getUser();
  if (!publicReady || !authData.user || authData.user.id !== OWNER_ID) return { owner: false };
  try {
    const remote = await readPrivate();
    owner = true;
    revision = Number(remote.revision) || 0;
    const hasRemote = revision > 0 && remote.data?.version != null;
    const hasLocalSnapshot = localStorage.getItem(LOCAL_KEY) !== null;
    const pending = localStorage.getItem(PENDING_KEY) === "1" && hasLocalSnapshot;
    migrationRequired = pending || (!hasRemote && hasLocalSnapshot);
    const activeState = pending || !hasRemote ? fallbackState : remote.data;
    if (!pending && hasRemote && hasLocalSnapshot && JSON.stringify(fallbackState) !== JSON.stringify(remote.data)) {
      localStorage.setItem("mltraining-local-before-cloud", JSON.stringify(fallbackState));
    }
    $("#publicApp").hidden = true;
    $("#ownerApp").hidden = false;
    $("#cloudOwnerActions").hidden = false;
    $("#cloudBackupButton").addEventListener("click", downloadLocalBackup);
    const previous = localStorage.getItem("mltraining-local-before-cloud");
    $("#cloudPreviousBackupButton").hidden = !previous;
    $("#cloudPreviousBackupButton").addEventListener("click", () => {
      try { downloadJSON(JSON.parse(localStorage.getItem("mltraining-local-before-cloud")), "mltraining-copia-anterior.json"); }
      catch { status("No se pudo recuperar la copia anterior.", "error"); }
    });
    $("#cloudLogoutButton").addEventListener("click", async () => {
      if (localStorage.getItem(PENDING_KEY) === "1" && !confirm("Hay cambios pendientes de sincronizar. La copia local se conserva, pero conviene descargar un respaldo antes de salir. ¿Salir igualmente?")) return;
      await client.auth.signOut();
      location.reload();
    });
    $("#cloudUploadButton").addEventListener("click", async () => {
      if (!confirm("¿Subir la copia de este navegador a Supabase? Si ya existe progreso remoto, será reemplazado. Descarga antes un respaldo si tienes dudas.")) return;
      try { revision = Number((await readPrivate()).revision) || 0; }
      catch { return status("No se pudo comprobar la versión remota. Tu copia local permanece intacta.", "error"); }
      migrationRequired = false;
      blocked = false;
      queueSave(localState() || activeState);
      $("#cloudUploadButton").hidden = true;
    });
    $("#cloudUploadButton").hidden = !migrationRequired;
    status(migrationRequired ? "Copia local pendiente de subir. Descarga un respaldo y pulsa «Subir copia local» cuando estés listo." : "Conectado · cambios guardados en Supabase", migrationRequired ? "warning" : "ok");
    window.addEventListener("online", () => { if (queuedState) void flush(); });
    return { owner: true, state: activeState };
  } catch {
    status("No se pudo verificar el registro privado. La edición permanece bloqueada.", "error");
    return { owner: false };
  }
}

function queueSave(nextState) {
  if (!owner) return;
  localStorage.setItem(PENDING_KEY, "1");
  queuedState = structuredClone(nextState);
  if (migrationRequired || blocked) {
    status("Copia local pendiente; no se ha sobrescrito el progreso remoto.", "warning");
    return;
  }
  status("Guardando en Supabase…", "warning");
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void flush(), 400);
}

async function flush() {
  if (!owner || writing || blocked || migrationRequired || !queuedState) return;
  writing = true;
  const candidate = queuedState;
  queuedState = null;
  const { data, error } = await client.rpc("mltraining_save", {
    p_state: candidate,
    p_summary: buildPublicSummary(candidate),
    p_expected_revision: revision,
  });
  writing = false;
  if (error) {
    queuedState = queuedState || candidate;
    if (error.code === "40001" || error.message?.includes("revision_conflict")) {
      blocked = true;
      $("#cloudUploadButton").hidden = false;
      status("Hay cambios de otra sesión. Tu copia local está a salvo; descarga un respaldo antes de decidir qué versión conservar.", "error");
    } else {
      status("Sin conexión o error de guardado. Tus cambios siguen en este navegador y se reintentará.", "warning");
      retryTimer = setTimeout(() => void flush(), 5000);
    }
    return;
  }
  revision = Number(data);
  if (queuedState) return void flush();
  localStorage.removeItem(PENDING_KEY);
  status("Conectado · cambios guardados en Supabase", "ok");
}

window.MLCloud = { boot, queueSave };
