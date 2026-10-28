(() => {
  "use strict";
  const KEY = "mltraining-v1";
  const DEFAULT_CYCLE_START = "2026-11-02";
  const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const SHORT_DAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const ROUTE_COLORS = { ds: "#54a8ff", me: "#6bcbb5", ai: "#a487f4", ga: "#e0b349" };
  const SOURCE_NAMES = { "FUT": "Futura", "AAI": "AnyoneAI", "IBM-AI": "IBM AI Engineering", "CF": "Código Facilito", "K-MLOPS": "Krish MLOps", "IBM-DE": "IBM AI-Native Data Engineering", "K-MATH": "Krish Mathematics", "PROY": "Proyectos" };
  const QUALITY_GATES = [["problem", "Problema y decisión", 10], ["data", "Datos y calidad", 10], ["eda", "EDA y estadística", 15], ["baseline", "Baseline y validación", 15], ["model", "Modelado y error", 15], ["engineering", "Ingeniería y reproducibilidad", 15], ["communication", "Comunicación y documentación", 10], ["impact", "Utilidad e impacto", 10]];
  const CAT = {
    ds: ["Data Science Core", "#3788ec"], ai: ["AI Engineering", "#9874e6"],
    ga: ["GenAI Engineering", "#d5a537"], me: ["MLOps / Data Engineering", "#63b9aa"],
    recall: ["Recall y exámenes", "#6ddab0"], project: ["Proyectos", "#7ac5d9"],
    math: ["Matemáticas y software", "#dbaf68"], fitness: ["Entrenamiento", "#be8276"],
    care: ["Comida y cuidado", "#9daa3a"], sleep: ["Descanso", "#657480"], personal: ["Personal", "#8a98a3"],
  };
  let seed, state, page = "inicio", weekStart, planDate, energyDate, homeMonth, reviewOffset = 0, openCompetencyId = null, openTopicId = null, projectTab = "principal";
  let calendarFollowsToday = true, planFollowsToday = true;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const expandSourceCodes = value => String(value ?? "").replace(/\b(?:IBM-AI|IBM-DE|K-MLOPS|K-MATH|FUT|AAI|CF|PROY)\b/g, code => SOURCE_NAMES[code] || code);
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const atNoon = value => new Date(`${value}T12:00:00`);
  const addDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
  const sunday = date => addDays(date, -date.getDay());
  const today = () => localDate(new Date());
  const currentWeekKey = offset => localDate(sunday(addDays(atNoon(today()), offset * 7)));
  const hours = (start, end) => Math.max(0, (minutes(end) - minutes(start)) / 60);
  const minutes = time => { const [h, m] = String(time).split(":").map(Number); return h * 60 + m; };
  const timeLabel = value => String(value).padStart(2, "0") + ":00";
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const fmtDay = value => new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(atNoon(value));
  const fmtShort = value => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(atNoon(value));
  const pct = (part, total) => total ? Math.round(part / total * 100) : 0;
  const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
  function notice(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(notice.timer); notice.timer = setTimeout(() => el.classList.remove("show"), 2600); }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); updateSidebar(); }
  function load() {
    const defaults = {
      version: 5, theme: "dark", cycleStart: DEFAULT_CYCLE_START, competencies: {}, customCompetencies: [], futura: {}, curriculum: {},
      sequence: {}, projects: [],
      schedule: seedSchedule(), extraEvents: [], daily: {}, activityLog: {}, energy: {}, dailyReviews: {}, weeklyReviews: {}, exams: {}, history: [],
    };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || typeof saved !== "object") return defaults;
      const merged = { ...defaults, ...saved };
      for (const key of ["competencies", "futura", "curriculum", "sequence", "daily", "activityLog", "energy", "dailyReviews", "weeklyReviews", "exams"]) if (!merged[key] || typeof merged[key] !== "object") merged[key] = defaults[key];
      for (const key of ["customCompetencies", "projects", "schedule", "extraEvents", "history"]) if (!Array.isArray(merged[key])) merged[key] = defaults[key];
      if (Number(merged.version) < 2) {
        const old = Object.fromEntries(seed.portfolio.map(item => [item.id, item]));
        merged.projects = merged.projects.filter(item => {
          const original = old[item.id];
          return !original || !(item.title === original.name && item.description === original.capabilities && item.acceptance === original.acceptance && item.status === "planned" && !item.evidence);
        }).map((item, index) => ({ ...item, custom: true, bucket: item.bucket || (index === 0 ? "principal" : "secondary") }));
        merged.version = 2;
        localStorage.setItem(KEY, JSON.stringify(merged));
      }
      if (Number(merged.version) < 3) {
        merged.cycleStart = DEFAULT_CYCLE_START;
        merged.version = 3;
        localStorage.setItem(KEY, JSON.stringify(merged));
      }
      if (Number(merged.version) < 4) {
        const obsolete = new Set(["Weekly Review|15:30|16:00", "Weekly Planning|16:00|16:30"]);
        merged.schedule = merged.schedule.filter(item => !(item.weekday === 0 && obsolete.has(`${item.title}|${item.start}|${item.end}`)));
        if (!merged.schedule.some(item => item.weekday === 0 && item.title === "ML Engineer Weekly Exam")) {
          merged.schedule.push({ id: "weekly-exam-me", weekday: 0, start: "15:30", end: "16:15", title: "ML Engineer Weekly Exam", category: "recall", counted: true, note: "" });
        }
        if (!merged.schedule.some(item => item.weekday === 0 && item.title === "GenAI Weekly Exam")) {
          merged.schedule.push({ id: "weekly-exam-ga", weekday: 0, start: "16:15", end: "17:00", title: "GenAI Weekly Exam", category: "recall", counted: true, note: "" });
        }
        merged.version = 4;
        try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* Keep the migrated schedule in memory if storage is full. */ }
      }
      if (Number(merged.version) < 5) {
        const meExam = merged.schedule.find(item => item.id === "weekly-exam-me" && item.weekday === 0);
        const genAiExam = merged.schedule.find(item => item.id === "weekly-exam-ga" && item.weekday === 0);
        if (meExam?.title === "ML Engineer Weekly Exam" && meExam.start === "15:30" && meExam.end === "16:15") meExam.end = "16:00";
        if (genAiExam?.title === "GenAI Weekly Exam" && genAiExam.start === "16:15" && genAiExam.end === "17:00") {
          genAiExam.start = "16:00";
          genAiExam.end = "16:30";
        }
        merged.version = 5;
        try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* Keep the migrated schedule in memory if storage is full. */ }
      }
      return merged;
    } catch { return defaults; }
  }
  function seedSchedule() {
    const rows = [];
    const put = (days, start, end, title, category, counted = false) => days.forEach(weekday => rows.push({ id: `base-${rows.length + 1}`, weekday, start, end, title, category, counted, note: "" }));
    const all = [0, 1, 2, 3, 4, 5, 6], work = [1, 2, 3, 4, 5];
    put(all, "06:00", "07:00", "Activación", "care");
    put(all, "08:30", "09:00", "Desayuno", "care");
    put(all, "13:00", "14:00", "Almuerzo", "care");
    put(all, "18:00", "18:30", "Cena", "care");
    put(all, "22:30", "23:00", "Desactivación", "sleep");
    put(work, "07:00", "08:30", "Data Science Core", "ds", true);
    put(work, "09:00", "10:30", "Data Science Core", "ds", true);
    put(work, "10:30", "11:00", "DS Recall", "recall", true);
    put(work, "11:00", "13:00", "IBM AI Engineering · Deep Work", "ai", true);
    put(work, "14:00", "16:00", "AI Engineering · Deep Practice", "ai", true);
    put(work, "16:00", "16:30", "AI Recall", "recall", true);
    put([1, 2, 4, 5], "16:30", "18:00", "Entrenamiento + ducha", "fitness", true);
    put([3], "16:30", "18:00", "AI Project · Build", "project", true);
    put(work, "18:30", "20:30", "GenAI Engineering", "ga", true);
    put(work, "20:30", "21:00", "GenAI Recall", "recall", true);
    put([0, 6], "07:00", "08:30", "MLOps Bootcamp", "me", true);
    put([0, 6], "09:00", "11:00", "MLOps Bootcamp", "me", true);
    put([0, 6], "11:00", "13:00", "IBM AI-Native Data Engineering", "me", true);
    put([6], "14:00", "16:00", "Matemáticas y Estadística", "math", true);
    put([6], "16:00", "18:00", "Software Engineering", "math", true);
    put([6], "18:30", "20:00", "Project · Integrate & Debug", "project", true);
    put([6], "20:00", "21:00", "Build Portfolio", "project", true);
    put([0], "14:00", "14:45", "Data Science Weekly Exam", "recall", true);
    put([0], "14:45", "15:30", "AI Engineering Weekly Exam", "recall", true);
    rows.push({ id: "weekly-exam-me", weekday: 0, start: "15:30", end: "16:00", title: "ML Engineer Weekly Exam", category: "recall", counted: true, note: "" });
    rows.push({ id: "weekly-exam-ga", weekday: 0, start: "16:00", end: "16:30", title: "GenAI Weekly Exam", category: "recall", counted: true, note: "" });
    return rows;
  }
  function allCompetencies(route) { return [...route.competencies, ...state.customCompetencies.filter(item => item.routeId === route.id)]; }
  function competence(item) { return state.competencies[item.id] || {}; }
  function level(item) { return Math.max(0, Math.min(4, Number(competence(item).level) || 0)); }
  function allItems() { return seed.routes.flatMap(allCompetencies); }
  function demonstrated(item) { return level(item) >= 3; }
  function routeProgress(route) { const items = allCompetencies(route); return pct(sum(items.map(level)), items.length * 4); }
  function metric(label, value, note, progress = null) { return `<article class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small>${progress == null ? "" : `<div class="progress-track"><i style="width:${Math.min(100, Math.max(0, progress))}%"></i></div>`}</article>`; }
  function updateSidebar() {
    if (!seed || !state) return;
    const all = allItems(), count = all.filter(demonstrated).length;
    $("#sidebarProgress").textContent = `${count} / ${all.length}`;
    $("#sidebarBar").style.width = `${pct(count, all.length)}%`;
  }
  function showPage(next, updateHash = true) {
    if (next === "futura") next = "fuentes";
    if (next === "anti") next = "metodo";
    if (!document.getElementById(`page-${next}`)) next = "inicio";
    page = next;
    $$(".page").forEach(el => { el.hidden = el.id !== `page-${next}`; });
    $$("[data-page]").forEach(el => el.classList.toggle("active", el.dataset.page === next));
    const button = $(`[data-page="${next}"]`), group = button?.closest(".nav-group");
    if (group) { group.classList.add("open"); group.querySelector(".nav-group-toggle").setAttribute("aria-expanded", "true"); }
    const names = { inicio: "Panel general", competencias: "Mapa de competencias", fuentes: "Fuentes", secuencia: "Secuencia de 12 semanas", portafolio: "Portafolio integrado", evidencias: "Evidencias", metodo: "Método", calendario: "Calendario", plan: "Plan diario", energia: "Energía", examenes: "Weekly Exam", diaria: "Recall", semanal: "Revisión semanal" };
    $("#pageLabel").textContent = names[next];
    $("#sectionLabel").textContent = group ? group.dataset.group : "Inicio";
    $("#sidebar").classList.remove("open");
    if (updateHash) history.replaceState(null, "", `#${next}`);
    renderPage(next);
    document.querySelector("main").scrollIntoView({ block: "start" });
  }
  function renderPage(which) {
    ({ inicio: renderHome, competencias: renderCompetencies, fuentes: renderSources, secuencia: renderSequence,
      portafolio: renderProjects, evidencias: renderEvidence, metodo: renderMethod,
      calendario: renderCalendar, plan: renderPlan, energia: renderEnergy, examenes: renderExams,
      diaria: renderDailyReview, semanal: renderWeeklyReview })[which]?.();
  }
  function renderHome() {
    const all = allItems(), shown = all.filter(demonstrated).length, weighted = pct(sum(all.map(level)), all.length * 4);
    const weekly = sum(state.schedule.filter(item => item.counted).map(item => hours(item.start, item.end)));
    const fitness = sum(state.schedule.filter(item => item.counted && item.category === "fitness").map(item => hours(item.start, item.end)));
    const formation = Math.max(0, weekly - fitness);
    const thisWeek = currentWeekKey(0), weekEnd = localDate(addDays(atNoon(thisWeek), 7));
    const days = Object.entries(state.daily).filter(([date]) => date >= thisWeek && date < weekEnd).map(([, data]) => data);
    const actual = sum(days.flatMap(day => day.tasks || []).map(task => task.actual));
    const currentProject = state.projects.find(item => item.bucket === "principal" && item.status === "active") || state.projects.find(item => item.bucket === "principal") || state.projects.find(item => item.status === "active") || state.projects[0];
    const phases = currentProject?.phases || [], projectProgress = pct(phases.filter(item => item.done).length, phases.length);
    $("#homeMetrics").innerHTML = metric("Avance de competencias", `${weighted}%`, `${shown} demostradas de ${all.length}`, weighted) + metric("Proyecto actual", currentProject ? `${projectProgress}%` : "—", currentProject?.title || "Crea tu proyecto principal", currentProject ? projectProgress : null) + metric("Carga semanal programada", `${weekly.toFixed(1)} h`, "Incluye 6 h de ejercicio; no son horas netas") + metric("Horas reales esta semana", `${actual.toFixed(1)} h`, "Regístralas en Plan diario", pct(actual, weekly));
    $("#homeFocus").innerHTML = seed.routes.map(route => { const next = allCompetencies(route).find(item => item.priority === "P0" && level(item) < 3) || allCompetencies(route).find(item => level(item) < 4); return `<div class="focus-row"><div><strong>${esc(route.name)}</strong><small>${next ? esc(next.id + " · " + (competence(next).title || next.title)) : "Ruta consolidada"}</small></div><span>${routeProgress(route)}%</span></div>`; }).join("");
    $("#homeLoad").innerHTML = `<p>La referencia de ${weekly.toFixed(1)} h combina formación, práctica, recall, proyectos, evaluaciones y ejercicio. Protege 23:00–06:00 para dormir y ajusta si el sueño real baja.</p><div class="load-bar"><i style="width:${pct(formation, weekly)}%;background:#3788ec"></i><i style="width:${pct(fitness, weekly)}%;background:#be8276"></i></div><div class="load-line"><span>${formation.toFixed(1)} h formación y seguimiento</span><span>${fitness.toFixed(1)} h ejercicio</span></div><div class="alert">Prioriza calidad y recuperación. Si durante dos días seguidos cae el foco, reduce tareas antes de alargar la jornada.</div>`;
    $("#homeRoutes").innerHTML = seed.routes.map(route => `<article class="route-card"><span class="route-code">${route.id.toUpperCase()} · ${allCompetencies(route).length} COMPETENCIAS</span><h3>${esc(route.name)}</h3><p>${esc(route.purpose)}</p><div class="progress-track"><i style="width:${routeProgress(route)}%;background:${ROUTE_COLORS[route.id]}"></i></div><small>${routeProgress(route)}% avance ponderado</small><br><button class="link-button" data-go="competencias" data-route="${route.id}">Abrir ruta →</button></article>`).join("");
    renderMonthChart();
  }
  function studyHoursForDay(date) {
    const tasks = state.daily[date]?.tasks || [], trackedIds = new Set(tasks.map(item => item.eventId).filter(Boolean));
    const actualTasks = sum(tasks.filter(item => item.category !== "fitness").map(item => item.actual));
    const extra = eventsForDate(date).filter(item => item.counted && item.category !== "fitness" && !trackedIds.has(item.id));
    const actual = actualTasks + sum(extra.map(item => state.activityLog[date]?.[item.id]?.actual));
    const planned = tasks.length ? sum(tasks.filter(item => item.category !== "fitness").map(item => item.planned)) : sum(eventsForDate(date).filter(item => item.counted && item.category !== "fitness").map(item => hours(item.start, item.end)));
    return { actual, planned };
  }
  function periodForDate(date) {
    if (date <= state.cycleStart) return state.cycleStart;
    const dayOffset = Math.floor((atNoon(date) - atNoon(state.cycleStart)) / 86400000);
    return localDate(addDays(atNoon(state.cycleStart), Math.floor(dayOffset / 28) * 28));
  }
  function renderMonthChart() {
    const count = 28, dates = Array.from({ length: count }, (_, i) => localDate(addDays(atNoon(homeMonth), i)));
    const points = dates.map(date => ({ date, ...studyHoursForDay(date) }));
    const elapsed = points.filter(item => item.date <= today()), totalActual = sum(elapsed.map(item => item.actual)), plannedToday = studyHoursForDay(today()).planned;
    $("#homeMonthLabel").textContent = `${fmtShort(dates[0])} – ${fmtShort(dates[count - 1])} ${atNoon(dates[count - 1]).getFullYear()}`;
    $("#homeMonthSummary").innerHTML = `<span><strong>${totalActual.toFixed(1)} h</strong> estudiadas en el período</span><span><strong>${plannedToday.toFixed(1)} h</strong> planificadas para hoy</span><span><strong>${elapsed.filter(item => item.actual > 0).length}</strong> días con estudio</span>`;
    $('[data-month-nav="prev"]').disabled = homeMonth <= state.cycleStart;
    const x = i => 48 + i * 864 / Math.max(1, count - 1), max = Math.max(4, Math.ceil(Math.max(...points.flatMap(item => [item.actual, item.planned])) / 4) * 4), y = value => 190 - Math.min(max, value) * 155 / max;
    const grid = [0, .25, .5, .75, 1].map(ratio => { const value = Math.round(max * ratio), yy = y(value); return `<line x1="48" x2="912" y1="${yy}" y2="${yy}" class="chart-grid"/><text x="38" y="${yy + 4}" text-anchor="end" class="chart-label">${value}</text>`; }).join("");
    const weekStart = Math.floor((atNoon(homeMonth) - atNoon(state.cycleStart)) / 604800000) + 1;
    const weekLines = [7, 14, 21].map(index => `<line x1="${x(index)}" x2="${x(index)}" y1="35" y2="190" class="chart-week-line"/>`).join("");
    const labels = [0, 7, 14, 21].map(index => `<text x="${x(index)}" y="216" text-anchor="middle" class="chart-label">S${weekStart + index / 7} · ${esc(fmtShort(dates[index]))}</text>`).join("");
    const plannedLine = points.map((item, i) => `${x(i)},${y(item.planned)}`).join(" "), actualLine = elapsed.map((item, i) => `${x(i)},${y(item.actual)}`).join(" ");
    const dots = elapsed.filter(item => item.actual > 0).map(item => { const index = Number(item.date.slice(-2)) - 1; return `<circle cx="${x(index)}" cy="${y(item.actual)}" r="4" class="chart-dot"><title>${esc(fmtShort(item.date))}: ${item.actual.toFixed(1)} h reales / ${item.planned.toFixed(1)} h planificadas</title></circle>`; }).join("");
    $("#homeMonthChart").innerHTML = `<svg viewBox="0 0 960 230" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${grid}${weekLines}<polyline points="${plannedLine}" class="chart-planned"/>${actualLine ? `<polyline points="${actualLine}" class="chart-actual"/>` : ""}${dots}${labels}</svg><div class="chart-legend"><span class="actual-key">Horas reales</span><span class="planned-key">Horas planificadas</span></div>`;
  }
  function renderCompetencies() {
    const items = allItems(), active = items.filter(item => level(item) > 0 && level(item) < 3).length;
    $("#competencyMetrics").innerHTML = metric("Competencias", items.length, "Cuatro rutas conectadas") + metric("En progreso", active, "Niveles 1 y 2") + metric("Demostradas", items.filter(demonstrated).length, "Niveles 3 y 4 con evidencia") + metric("Avance ponderado", `${pct(sum(items.map(level)), items.length * 4)}%`, "Basado en escala 0–4");
    const routeFilter = $("#routeFilter").value, search = $("#competencySearch").value.toLocaleLowerCase(), priority = $("#priorityFilter").value, status = $("#statusFilter").value;
    $("#competencyList").innerHTML = seed.routes.filter(route => routeFilter === "all" || route.id === routeFilter).map(route => {
      const filtered = allCompetencies(route).filter(item => (priority === "all" || item.priority === priority) && (status === "all" || (status === "pending" && level(item) === 0) || (status === "active" && level(item) > 0 && level(item) < 3) || (status === "demonstrated" && demonstrated(item))) && (!search || expandSourceCodes(`${item.id} ${competence(item).title || item.title} ${item.prerequisitesAndSources} ${item.evidence}`).toLocaleLowerCase().includes(search)));
      return `<div class="route-section"><div class="route-section-head"><div><h2 style="color:${ROUTE_COLORS[route.id]}">${esc(route.name)}</h2><small>${filtered.length} visibles · ${routeProgress(route)}% de avance</small></div><button class="secondary-btn" data-add-competency="${route.id}">＋ Añadir competencia</button></div>${filtered.length ? filtered.map(item => competencyCard(item)).join("") : `<div class="list-card">Sin competencias para este filtro.</div>`}</div>`;
    }).join("");
  }
  function competencyCard(item) {
    const record = competence(item), n = level(item), opened = openCompetencyId === item.id;
    return `<article class="competency-card ${opened ? "open" : ""}" data-competency="${esc(item.id)}"><button class="competency-main" data-open-competency="${esc(item.id)}"><span class="code">${esc(item.id)}</span><span><strong>${esc(record.title || item.title)}</strong><small>${esc(item.suggestedWindow || "Personalizada")} · ${esc(expandSourceCodes(item.prerequisitesAndSources || "Fuente por definir"))}</small></span><span class="priority ${item.priority.toLowerCase()}">${esc(item.priority)}</span><span class="level-badge l${n}">Nivel ${n}</span><span class="level-badge">${esc(record.autonomy || "—")}</span><span>⌄</span></button><div class="competency-detail"><div class="detail-grid"><label>Título<input data-comp-field="title" value="${esc(record.title || item.title)}"></label><label>Nivel<select data-comp-field="level">${seed.levels.map(entry => `<option value="${entry.level}" ${n === entry.level ? "selected" : ""}>${entry.level} · ${esc(entry.definition)}</option>`).join("")}</select></label><label>Autonomía<select data-comp-field="autonomy"><option value="">Sin evaluar</option>${["S · solo", "D · con documentación", "IA · con ayuda IA"].map(value => `<option ${record.autonomy === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Fuente principal<input data-comp-field="source" value="${esc(expandSourceCodes(record.source || item.prerequisitesAndSources || ""))}"></label><label class="full">Evidencia esperada<input value="${esc(item.evidence || "")}" readonly></label><label class="full">Enlace o descripción de evidencia<input data-comp-field="evidence" value="${esc(record.evidence || "")}" placeholder="Repositorio, notebook, informe o resultado reproducible"></label><label class="full">Explicación en español<textarea data-comp-field="explainEs">${esc(record.explainEs || "")}</textarea></label><label class="full">Explain it in English<textarea data-comp-field="explainEn">${esc(record.explainEn || "")}</textarea></label><label class="full">Notas / siguiente práctica<textarea data-comp-field="notes">${esc(record.notes || "")}</textarea></label></div><div class="detail-actions"><button data-quiz="${esc(item.id)}">Copiar reto de autoevaluación</button>${item.custom ? `<button data-delete-competency="${esc(item.id)}">Eliminar competencia</button>` : ""}</div></div></article>`;
  }
  function renderFutura() {
    const modules = seed.curricula[0].modules, classes = modules.flatMap(module => module.classes), practiced = classes.filter(item => Number(state.futura[item.id]?.status) >= 2).length;
    $("#sourceMetrics").innerHTML = metric("Módulos", modules.length, "Python, estadística, ingeniería de variables y ML") + metric("Clases", classes.length, "72 horas en vivo") + metric("Practicadas", practiced, "Estado 2 o 3", pct(practiced, classes.length)) + metric("Por consolidar", classes.filter(item => Number(state.futura[item.id]?.status || 0) < 3).length, "Con prueba propia");
    $("#sourceContent").innerHTML = modules.map((module, index) => `<article class="module-card"><div class="module-head"><div><div class="eyebrow">MÓDULO ${String(index + 1).padStart(2, "0")}</div><h2>${esc(module.name)}</h2><p>${module.classes.length} clases · ${module.liveHours} h en vivo</p></div><strong>${module.classes.filter(item => Number(state.futura[item.id]?.status) >= 2).length}/${module.classes.length} practicadas</strong></div>${module.classes.map((item, i) => topicMarkup(item, "futura", String(i + 1).padStart(2, "0"))).join("")}</article>`).join("");
  }
  function sourceRecord(item) {
    const raw = state.curriculum[item.id];
    return typeof raw === "boolean" ? { status: raw ? 2 : 0, note: "" } : raw && typeof raw === "object" ? raw : { status: 0, note: "" };
  }
  function topicRecord(kind, id) { return kind === "futura" ? state.futura[id] || {} : sourceRecord({ id }); }
  function editableTopicRecord(kind, id) {
    if (kind === "futura") return state.futura[id] ||= {};
    return state.curriculum[id] = sourceRecord({ id });
  }
  function topicMarkup(item, kind, number) {
    const record = topicRecord(kind, item.id), opened = openTopicId === item.id;
    const statusAttr = kind === "futura" ? `data-futura-id="${esc(item.id)}" data-futura-field="status"` : `data-curriculum-id="${esc(item.id)}" data-curriculum-field="status"`;
    const subtopics = Array.isArray(record.subtopics) ? record.subtopics : [];
    return `<div class="source-topic ${opened ? "open" : ""}" data-topic-id="${esc(item.id)}" data-topic-kind="${kind}"><div class="class-row"><span>${esc(number)}</span><b>${esc(item.title)}${item.estimatedHours ? `<small class="source-hours">${item.estimatedHours} h estimadas</small>` : ""}</b><select ${statusAttr} aria-label="Estado de ${esc(item.title)}">${["No iniciado", "Estudiado", "Practicado", "Consolidado"].map((label, n) => `<option value="${n}" ${Number(record.status || 0) === n ? "selected" : ""}>${label}</option>`).join("")}</select><button type="button" class="topic-toggle" data-topic-toggle="${esc(item.id)}" aria-expanded="${opened}" aria-label="${opened ? "Cerrar" : "Abrir"} notas y subtemas de ${esc(item.title)}">${opened ? "⌃" : "⌄"}</button></div><div class="source-topic-detail" ${opened ? "" : "hidden"}><label>Lo que aprendí<textarea data-topic-field="learned" placeholder="Explica con tus palabras qué comprendiste, practicastes y qué dudas quedan.">${esc(record.learned || "")}</textarea></label><label>Prueba o nota breve<input data-topic-field="note" value="${esc(record.note || "")}" placeholder="Evidencia, enlace o resultado"></label><div class="subtopic-heading"><strong>Subtemas personalizados</strong><small>${subtopics.length} añadidos</small></div><div class="subtopic-list">${subtopics.map(subtopic => `<div class="subtopic-row" data-subtopic-id="${esc(subtopic.id)}"><input data-subtopic-field="title" value="${esc(subtopic.title || "")}" placeholder="Nombre del subtema" aria-label="Nombre del subtema"><textarea data-subtopic-field="note" placeholder="Lo que aprendí en este subtema">${esc(subtopic.note || "")}</textarea><button type="button" class="danger-btn" data-delete-subtopic="${esc(subtopic.id)}" aria-label="Eliminar subtema">×</button></div>`).join("")}</div><button type="button" class="secondary-btn" data-add-subtopic="${esc(item.id)}">＋ Añadir subtema</button></div></div>`;
  }
  function renderSources() {
    $("#sourceGlossary").innerHTML = seed.sources.map(item => { const description = item.code === "IBM-DE" ? "IBM AI-Native Data Engineering · 7 cursos · 155 horas estimadas" : item.description; const use = item.code === "IBM-DE" ? "Currícula completa de sistemas, bases vectoriales, lakehouse, datos no estructurados y pipelines reproducibles" : item.use; return `<article class="source-card"><b>${esc(SOURCE_NAMES[item.code] || item.code)}</b><p>${esc(expandSourceCodes(description || ""))}</p><small>${esc(expandSourceCodes(use || ""))}</small></article>`; }).join("");
    const selected = $("#curriculumFilter").value;
    if (selected === "futura") { renderFutura(); return; }
    if (selected === "proyectos") {
      $("#sourceMetrics").innerHTML = metric("Proyectos propios", state.projects.length, "Fuente de evidencia transversal") + metric("Con evidencia", state.projects.filter(item => item.evidence).length, "Enlace o resultado revisable");
      $("#sourceContent").innerHTML = `<article class="panel"><h2>Aprender construyendo</h2><p>Los proyectos conectan las cuatro rutas. Define el problema, registra las decisiones y guarda una evidencia reproducible.</p><button class="primary-btn" data-go="portafolio">Abrir portafolio →</button></article>`;
      return;
    }
    const curriculum = seed.curricula.find(item => item.id === selected) || seed.curricula[1];
    const practiced = curriculum.items.filter(item => Number(sourceRecord(item).status) >= 2).length;
    $("#sourceMetrics").innerHTML = metric("Fuente", curriculum.name, "Currícula de referencia") + metric("Temas", curriculum.items.length, "Puedes priorizar solo lo necesario") + metric("Practicados", practiced, "Estado 2 o 3", pct(practiced, curriculum.items.length));
    const grouped = Object.groupBy ? Object.groupBy(curriculum.items, item => item.module) : curriculum.items.reduce((acc, item) => { (acc[item.module] ||= []).push(item); return acc; }, {});
    $("#sourceContent").innerHTML = Object.entries(grouped).map(([name, items]) => `<article class="module-card"><div class="module-head"><div><div class="eyebrow">${esc(curriculum.name)}</div><h2>${esc(name)}</h2><p>${items.length} temas · ${items.filter(item => Number(sourceRecord(item).status) >= 2).length} practicados</p></div></div>${items.map(item => topicMarkup(item, "curriculum", item.number)).join("")}</article>`).join("");
  }
  function renderSequence() {
    $("#cycleStart").value = state.cycleStart;
    const tracks = [...seed.routes.map(route => [route.id, route.name, ROUTE_COLORS[route.id]]), ["fundamentals", "Fundamentos", "#d6ab74"]];
    $("#sequenceList").innerHTML = seed.sequence.map(entry => { const date = localDate(addDays(atNoon(state.cycleStart), (entry.week - 1) * 7)); return `<article class="sequence-card"><h2>Semana ${entry.week}<span>${esc(fmtShort(date))}</span></h2>${tracks.map(([id, name, color]) => `<label class="sequence-field"><b style="color:${color}">${esc(name)}</b><input data-sequence-week="${entry.week}" data-sequence-route="${id}" value="${esc(state.sequence[entry.week]?.[id] ?? entry[id])}"></label>`).join("")}</article>`; }).join("");
  }
  function renderProjects() {
    $$('[data-project-tab]').forEach(button => { const active = button.dataset.projectTab === projectTab; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    const visible = state.projects.filter(item => (item.bucket || "principal") === projectTab);
    $("#projectList").innerHTML = visible.length ? visible.map(item => {
      const phases = Array.isArray(item.phases) ? item.phases : [], gates = item.gates || {}, score = sum(QUALITY_GATES.filter(([id]) => gates[id]).map(([, , points]) => points)), phaseDone = phases.filter(phase => phase.done).length;
      return `<article class="project-card project-workspace" data-project="${esc(item.id)}"><div class="project-card-top"><div><div class="eyebrow">${projectTab === "principal" ? "PROYECTO PRINCIPAL" : "PROYECTO SECUNDARIO"}</div><label>Título<input data-project-field="title" value="${esc(item.title || "")}" placeholder="Nombre del proyecto"></label></div><div class="project-score"><strong>${score}</strong><span>/100</span></div></div><label>Problema, usuario y decisión<textarea data-project-field="description" placeholder="¿Qué problema resuelve y para quién?">${esc(item.description || "")}</textarea></label><div class="project-field-grid"><label>Stack<input data-project-field="stack" value="${esc(item.stack || "")}" placeholder="Por definir"></label><label>Estado<select data-project-field="status">${[["planned", "Planificado"], ["active", "En progreso"], ["review", "En revisión"], ["done", "Entregado"]].map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Enlace / evidencia<input data-project-field="evidence" value="${esc(item.evidence || "")}" placeholder="https://..."></label></div><div class="project-block-head"><strong>Plan de trabajo · ${pct(phaseDone, phases.length)}%</strong><small>${phaseDone}/${phases.length} fases</small></div><div class="progress-track"><i style="width:${pct(phaseDone, phases.length)}%"></i></div><div class="project-phases">${phases.length ? phases.map(phase => `<div class="project-phase" data-phase-id="${esc(phase.id)}"><input type="checkbox" data-phase-field="done" ${phase.done ? "checked" : ""} aria-label="Fase completada"><input data-phase-field="title" value="${esc(phase.title || "")}" aria-label="Nombre de fase"><button data-delete-phase="${esc(phase.id)}" aria-label="Eliminar fase">×</button></div>`).join("") : `<p class="help">Aún no hay fases. Añade la primera para construir tu plan.</p>`}</div><div class="project-block-head"><strong>Puertas de calidad</strong><small>${score}/100</small></div><div class="quality-grid">${QUALITY_GATES.map(([id, label, points]) => `<label><input type="checkbox" data-gate="${id}" ${gates[id] ? "checked" : ""}><span>${label} · ${points}</span></label>`).join("")}</div><p class="quality-hint">${score < 75 ? "Menos de 75/100: sigue en construcción." : "75/100 o más: revisa si la evidencia respalda cada puerta marcada."}</p><label>Criterio de aceptación<textarea data-project-field="acceptance" placeholder="¿Qué debe demostrar el resultado?">${esc(item.acceptance || "")}</textarea></label><label>Notas<textarea data-project-field="notes" placeholder="Decisiones, riesgos y próximos pasos">${esc(item.notes || "")}</textarea></label><div class="actions"><button class="secondary-btn" data-add-phase="${esc(item.id)}">＋ Añadir fase</button><button class="danger-btn" data-delete-project="${esc(item.id)}">Eliminar proyecto</button></div></article>`;
    }).join("") : `<article class="panel project-empty"><h2>${projectTab === "principal" ? "Tu proyecto principal empieza aquí" : "Todavía no hay proyectos secundarios"}</h2><p>Crea un proyecto propio y define el problema, las fases y la evidencia que quieres producir.</p></article>`;
  }
  function renderEvidence() {
    const competencies = allItems().filter(item => competence(item).evidence), projects = state.projects.filter(item => item.evidence);
    $("#evidenceList").innerHTML = `<div class="metric-grid">${metric("Competencias con evidencia", competencies.length, "Revisables por otra persona")}${metric("Proyectos con evidencia", projects.length, "Entregables de portafolio")}</div><div class="section-head"><h2>Competencias</h2></div>${competencies.length ? competencies.map(item => `<article class="list-card"><strong>${esc(item.id)} · ${esc(competence(item).title || item.title)}</strong><p>Nivel ${level(item)} · ${esc(competence(item).evidence)}</p></article>`).join("") : `<article class="list-card">Aún no hay evidencias. Registra una en el mapa de competencias.</article>`}<div class="section-head"><h2>Proyectos</h2></div>${projects.length ? projects.map(item => `<article class="list-card"><strong>${esc(item.title)}</strong><p>${esc(item.evidence)}</p></article>`).join("") : `<article class="list-card">Aún no hay proyectos con evidencia.</article>`}`;
  }
  function renderMethod() { $("#levelScale").innerHTML = seed.levels.map(item => `<article class="panel"><b>NIVEL ${item.level}</b><h2>${esc(item.definition)}</h2><p>${esc(item.minimumProof)}</p></article>`).join(""); }
  function eventsForDate(date) {
    const weekday = atNoon(date).getDay();
    return [...state.schedule.filter(item => item.weekday === weekday).map(item => ({ ...item, date, weekly: true })), ...state.extraEvents.filter(item => item.date === date).map(item => ({ ...item, weekly: false }))].sort((a, b) => minutes(a.start) - minutes(b.start));
  }
  function weekDates() { return Array.from({ length: 7 }, (_, i) => localDate(addDays(atNoon(weekStart), i))); }
  function weekHours() { return sum(weekDates().flatMap(eventsForDate).filter(item => item.counted).map(item => hours(item.start, item.end))); }
  function trackingFor(date, id) {
    const logged = state.activityLog[date]?.[id];
    if (logged) return logged;
    const task = state.daily[date]?.tasks?.find(item => item.eventId === id);
    return task ? { done: !!task.done, actual: Number(task.actual) || 0 } : { done: false, actual: 0 };
  }
  function trackSession(date, id, done, actual, counted) {
    (state.activityLog[date] ||= {})[id] = { done: !!done, actual: Math.max(0, Number(actual) || 0) };
    if (counted) {
      const day = ensureDay(date), task = day.tasks.find(item => item.eventId === id);
      if (task) { task.done = !!done; task.actual = Math.max(0, Number(actual) || 0); }
    }
  }
  function renderCalendar() { renderCalendarInto("calendar"); }
  function renderCalendarInto(prefix) {
    const dates = weekDates(), last = dates[6];
    const selected = id => $(`#${prefix}${id}`);
    selected("WeekLabel").textContent = `${fmtShort(dates[0])} – ${fmtShort(last)} ${atNoon(last).getFullYear()}`;
    const allEvents = dates.flatMap(eventsForDate), completed = allEvents.filter(item => trackingFor(item.date, item.id).done).length;
    const actual = sum(allEvents.map(item => trackingFor(item.date, item.id).actual));
    selected("Summary").innerHTML = `<span>${weekHours().toFixed(1)} h programadas (carga)</span><span>${actual.toFixed(1)} h reales (todos los bloques)</span><span>${completed}/${allEvents.length} bloques completados · haz clic para registrar</span>`;
    selected("Legend").innerHTML = Object.entries(CAT).map(([key, [name, color]]) => `<span style="--tag-color:${color}">${esc(name)}</span>`).join("");
    selected("Head").innerHTML = `<div>GMT−05</div>` + dates.map((date, i) => `<div class="${date === today() ? "is-today" : ""}">${SHORT_DAYS[i]}<strong>${atNoon(date).getDate()}</strong></div>`).join("");
    const axis = `<div class="time-axis">${Array.from({ length: 18 }, (_, i) => `<span style="top:${i * 60}px">${String(i + 6).padStart(2, "0")}:00</span>`).join("")}</div>`;
    selected("Grid").innerHTML = axis + dates.map(date => {
      const blocks = eventsForDate(date).filter(item => minutes(item.end) > 360 && minutes(item.start) < 1380);
      const now = date === today() && minutes(`${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`) >= 360 && minutes(`${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`) <= 1380 ? `<div class="now-line" style="top:${(new Date().getHours() - 6) * 60 + new Date().getMinutes()}px"></div>` : "";
      return `<div class="day-column" data-calendar-date="${date}">${blocks.map(item => { const top = Math.max(0, minutes(item.start) - 360), bottom = Math.min(1020, minutes(item.end) - 360), height = Math.max(14, bottom - top - 2), tracked = trackingFor(date, item.id); return `<button class="cal-event ${item.counted ? "" : "muted"} ${tracked.done ? "completed" : ""}" style="top:${top}px;height:${height}px;--event-color:${CAT[item.category]?.[1] || CAT.personal[1]}" data-block-id="${esc(item.id)}" data-block-date="${date}" title="${esc(item.title)} · ${item.start}–${item.end}${tracked.done ? ` · completado · ${tracked.actual} h reales` : ""}"><strong>${tracked.done ? "✓ " : ""}${esc(item.title)}</strong><small>${item.start}–${item.end}${tracked.actual ? ` · ${tracked.actual} h real` : ""}</small></button>`; }).join("")}${now}</div>`;
    }).join("");
  }
  function openBlock(item = null, date = today(), time = "09:00") {
    const form = $("#blockForm"); form.reset();
    form.elements.id.value = item?.id || ""; form.elements.title.value = item?.title || "";
    form.elements.start.value = item?.start || time;
    form.elements.end.value = item?.end || `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, "0")}:${time.slice(3)}`;
    form.elements.date.value = date; form.elements.category.value = item?.category || "personal";
    form.elements.weekly.checked = item?.weekly || false; form.elements.counted.checked = item?.counted || false;
    form.elements.note.value = item?.note || "";
    const tracked = item ? trackingFor(date, item.id) : { done: false, actual: 0 };
    form.elements.completed.checked = !!tracked.done;
    form.elements.actual.value = tracked.actual || 0;
    $("#deleteBlockButton").hidden = !item;
    $("#blockDialogTitle").textContent = item ? "Editar bloque" : "Añadir bloque";
    $("#blockDialog").showModal();
  }
  function saveBlock(event) {
    event.preventDefault();
    const form = $("#blockForm"), id = form.elements.id.value, date = form.elements.date.value, weekly = form.elements.weekly.checked;
    const start = form.elements.start.value, end = form.elements.end.value;
    if (minutes(end) <= minutes(start)) { notice("La hora final debe ser posterior a la inicial."); return; }
    const existingWeekly = state.schedule.find(item => item.id === id), existingOne = state.extraEvents.find(item => item.id === id);
    const record = { id: id || uid("block"), title: form.elements.title.value.trim(), start, end, category: form.elements.category.value, counted: form.elements.counted.checked, note: form.elements.note.value.trim() };
    if (!record.title) { notice("Escribe una actividad."); return; }
    if (existingWeekly) state.schedule = state.schedule.filter(item => item.id !== id);
    if (existingOne) state.extraEvents = state.extraEvents.filter(item => item.id !== id);
    if (weekly) state.schedule.push({ ...record, weekday: atNoon(date).getDay() });
    else state.extraEvents.push({ ...record, date });
    trackSession(date, record.id, form.elements.completed.checked, form.elements.actual.value, record.counted);
    save(); $("#blockDialog").close(); renderCalendar(); renderHome(); if (page === "plan") renderPlan(); notice("Bloque y sesión guardados.");
  }
  function deleteBlock() {
    const id = $("#blockForm").elements.id.value;
    if (!id) return;
    state.schedule = state.schedule.filter(item => item.id !== id);
    state.extraEvents = state.extraEvents.filter(item => item.id !== id);
    save(); $("#blockDialog").close(); renderCalendar(); renderHome(); notice("Bloque eliminado.");
  }
  function ensureDay(date) {
    if (!state.daily[date]) state.daily[date] = { tasks: [] };
    const day = state.daily[date];
    if (!day.initialized) { addMissingTasks(date); day.initialized = true; save(); }
    return day;
  }
  function addMissingTasks(date) {
    const day = state.daily[date] ||= { tasks: [] };
    const present = new Set(day.tasks.map(item => item.eventId));
    eventsForDate(date).filter(item => item.counted && !present.has(item.id)).forEach(item => { const tracked = trackingFor(date, item.id); day.tasks.push({ id: uid("task"), eventId: item.id, title: item.title, planned: hours(item.start, item.end), actual: tracked.actual, done: tracked.done, category: item.category }); });
  }
  function renderPlan() {
    $("#planDate").value = planDate;
    const day = ensureDay(planDate), planned = sum(day.tasks.map(item => item.planned)), actual = sum(day.tasks.map(item => item.actual)), done = day.tasks.filter(item => item.done).length;
    $("#dayMetrics").innerHTML = metric("Fecha", fmtShort(planDate), DAY_NAMES[atNoon(planDate).getDay()]) + metric("Plan", `${planned.toFixed(1)} h`, `${day.tasks.length} tareas`) + metric("Real", `${actual.toFixed(1)} h`, "Carga registrada", pct(actual, planned)) + metric("Completadas", `${done}/${day.tasks.length}`, "Valora resultados, no solo horas", pct(done, day.tasks.length));
    $("#dailyTaskList").innerHTML = day.tasks.length ? day.tasks.map(item => `<div class="task-row" data-task-id="${esc(item.id)}"><input type="checkbox" data-task-field="done" ${item.done ? "checked" : ""} aria-label="Completada"><input data-task-field="title" value="${esc(item.title)}" aria-label="Tarea"><small class="task-category">${esc(CAT[item.category]?.[0] || "Personal")}</small><input data-task-field="planned" type="number" min="0" step="0.25" value="${item.planned}" aria-label="Horas planeadas"><input data-task-field="actual" type="number" min="0" step="0.25" value="${item.actual}" aria-label="Horas reales"><button data-delete-task="${esc(item.id)}" aria-label="Eliminar tarea">×</button></div>`).join("") : `<article class="list-card">Día sin tareas. Añade una para empezar.</article>`;
  }
  function renderEnergy() {
    $("#energyDate").value = energyDate;
    const record = state.energy[energyDate] || {};
    $("#energyForm").innerHTML = `<label>Horas de sueño<input type="number" min="0" max="14" step="0.25" data-energy-field="sleep" value="${esc(record.sleep ?? "")}" placeholder="7"></label><label>Ejercicio (min)<input type="number" min="0" max="300" step="5" data-energy-field="exercise" value="${esc(record.exercise ?? "")}" placeholder="45"></label><label>Foco (1–5)<select data-energy-field="focus"><option value="">Sin evaluar</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(record.focus) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Energía (1–5)<select data-energy-field="mood"><option value="">Sin evaluar</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(record.mood) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label class="full">Nota de recuperación<textarea data-energy-field="note" placeholder="¿Qué te ayudó o agotó hoy?">${esc(record.note || "")}</textarea></label>`;
    $("#energyTrend").innerHTML = Array.from({ length: 7 }, (_, i) => localDate(addDays(atNoon(energyDate), i - 6))).map(date => { const data = state.energy[date] || {}; const sleep = Number(data.sleep) || 0; return `<div class="trend-row"><strong>${fmtShort(date)}</strong><div class="progress-track"><i style="width:${pct(sleep, 8)}%;background:${sleep >= 7 ? "var(--good)" : "var(--warn)"}"></i></div><small>${sleep ? `${sleep} h sueño` : "Sin registro"} · foco ${data.focus || "—"}/5</small></div>`; }).join("");
  }
  function examWeek() { return currentWeekKey(reviewOffset); }
  function sourceRoute(curriculum, item) {
    if (["futura", "krish-maths"].includes(curriculum)) return "ds";
    if (curriculum === "codigo-facilito") return "ga";
    if (curriculum === "anyoneai") {
      const label = `${item.module} ${item.title}`.toLowerCase();
      if (/genai|generative|llm|prompt|rag|agent/.test(label)) return "ga";
      if (/deep learning|neural|pytorch|tensorflow|transformer|nlp/.test(label)) return "ai";
      return "ds";
    }
    if (curriculum === "ibm-ai" && /machine learning with python/i.test(item.title)) return "ds";
    if (curriculum === "ibm-ai" && /generative|llm|prompt|rag|agent/i.test(item.title)) return "ga";
    return "ai";
  }
  function weeklyTopics(key, routeId) {
    const end = localDate(addDays(atNoon(key), 6)), items = [], sources = [];
    for (let offset = 0; offset < 7; offset++) {
      const record = state.dailyReviews[localDate(addDays(atNoon(key), offset))]?.[routeId];
      if (record?.learned?.trim()) items.push(record.learned.trim());
      if (record?.practice?.trim()) items.push(record.practice.trim());
    }
    for (const change of state.history) {
      if (change.date < key || change.date > end || Number(change.to) <= Number(change.from)) continue;
      const route = seed.routes.find(item => item.id === routeId), competency = route && allCompetencies(route).find(item => item.id === change.id);
      if (competency) items.push(competence(competency).title || competency.title);
    }
    for (const curriculum of seed.curricula) {
      const topics = curriculum.modules ? curriculum.modules.flatMap(module => module.classes) : curriculum.items || [];
      for (const item of topics) {
        const record = curriculum.id === "futura" ? state.futura[item.id] : sourceRecord(item);
        if (sourceRoute(curriculum.id, item) !== routeId || !record?.lastStudiedAt || record.lastStudiedAt < key || record.lastStudiedAt > end) continue;
        if (Number(record.status) > 0 || record.learned || record.note || record.subtopics?.length) sources.push(item.title);
      }
    }
    const logged = [...new Set([...items, ...sources])].filter(Boolean).slice(0, 12);
    if (logged.length) return { topics: logged.join("\n"), source: "Recall y Fuentes registrados durante esta semana" };
    const cycleWeek = Math.floor((atNoon(key) - sunday(atNoon(state.cycleStart))) / 604800000) + 1;
    const sequence = seed.sequence.find(item => item.week === cycleWeek);
    const plan = state.sequence[cycleWeek]?.[routeId] ?? sequence?.[routeId];
    if (plan?.trim()) return { topics: plan.trim(), source: `Foco sugerido de la secuencia · semana ${cycleWeek}` };
    const route = seed.routes.find(item => item.id === routeId), next = route && allCompetencies(route).find(item => level(item) < 3);
    return { topics: next?.title || "Define aquí los temas que estudiaste esta semana", source: "Foco sugerido; edítalo según tu estudio real" };
  }
  function examPrompt(key, routeId) {
    const names = { ds: "Data Science", ai: "AI Engineer", ga: "GenAI Engineer" }, record = state.exams[key]?.[routeId] || {}, topics = record.topics?.trim() || weeklyTopics(key, routeId).topics;
    const criteria = { ds: "formulación, estadística, validación, leakage, métricas e interpretación", ai: "fundamentos de redes, implementación, entrenamiento, debugging y evaluación", ga: "LLM, prompts, RAG, agentes, evaluación, seguridad, costo y latencia" };
    return `Actúa como examinador exigente de ${names[routeId]}. Evalúame sobre lo que estudié en la semana ${fmtShort(key)}–${fmtShort(localDate(addDays(atNoon(key), 6)))}. Temas:\n${topics}\n\nDiseña un examen avanzado de 45 minutos con 4 preguntas conceptuales, 2 ejercicios aplicados y 1 caso de diagnóstico o debugging. Adapta cada pregunta a los temas indicados; si son escasos, profundiza en ellos sin inventar contenidos que no estudié. Evalúa especialmente ${criteria[routeId]}. No muestres soluciones hasta que responda. Después califica de 0 a 100, explica mis errores, pide una solución mejorada y haz que defienda una respuesta en español y otra en inglés.`;
  }
  function renderExams() {
    const key = examWeek(), dates = `${fmtShort(key)} – ${fmtShort(localDate(addDays(atNoon(key), 6)))}`;
    $("#examPanel").innerHTML = `<div class="calendar-toolbar"><div><button class="secondary-btn" data-review-nav="prev">‹</button><button class="secondary-btn" data-review-nav="today">Semana actual</button><button class="secondary-btn" data-review-nav="next">›</button><strong>${dates}</strong></div></div><div class="alert">Los temas se actualizan con tu Recall y los avances de Fuentes. Si aún no hay registros, se sugiere la secuencia semanal. Puedes editar la lista antes de generar cada examen.</div>${[["ds", "Data Science"], ["ai", "AI Engineer"], ["ga", "GenAI Engineer"]].map(([id, title]) => { const record = state.exams[key]?.[id] || {}, suggested = weeklyTopics(key, id); return `<article class="exam-card" data-exam="${id}"><div><h2>${title}</h2><p>Examen de 45 min · ${esc(suggested.source)}</p></div><select data-exam-field="status" aria-label="Estado del examen de ${title}"><option value="pending" ${record.status === "pending" ? "selected" : ""}>Pendiente</option><option value="done" ${record.status === "done" ? "selected" : ""}>Realizado</option><option value="review" ${record.status === "review" ? "selected" : ""}>Corregir</option></select><label class="exam-topics">Temas de esta semana (editables)<textarea data-exam-field="topics" placeholder="Un tema por línea">${esc(record.topics ?? suggested.topics)}</textarea></label><button class="secondary-btn" data-exam-quiz="${id}">Copiar prompt de examen</button><input type="number" min="0" max="100" step="1" data-exam-field="score" value="${esc(record.score ?? "")}" placeholder="Puntuación /100" aria-label="Puntuación de ${title}"><textarea data-exam-field="notes" placeholder="Errores, corrección y siguiente práctica" aria-label="Notas de ${title}">${esc(record.notes || "")}</textarea></article>`; }).join("")}`;
  }
  function renderDailyReview() {
    const date = planDate, record = state.dailyReviews[date] || {}, day = ensureDay(date), actual = sum(day.tasks.map(item => item.actual)), done = day.tasks.filter(item => item.done).length;
    const legacy = ["learned", "gap", "next", "english"].some(field => record[field]?.trim());
    $("#dailyReview").innerHTML = `<div class="toolbar-panel"><label>Fecha<input type="date" id="dailyReviewDate" value="${date}"></label></div><div class="review-metrics"><div><strong>${actual.toFixed(1)} h</strong><span>Trabajo real</span></div><div><strong>${done}/${day.tasks.length}</strong><span>Tareas completas</span></div><div><strong>${state.energy[date]?.sleep || "—"} h</strong><span>Sueño registrado</span></div><div><strong>${state.energy[date]?.focus || "—"}/5</strong><span>Foco</span></div></div><div class="recall-grid">${[["ds", "DS Recall", "Data Science"], ["ai", "AI Recall", "AI Engineer"], ["ga", "GenAI Recall", "GenAI Engineer"]].map(([id, title, subtitle]) => { const item = record[id] || {}; return `<article class="panel recall-card" data-recall-route="${id}"><div class="panel-head"><div><div class="eyebrow">${esc(subtitle)}</div><h2>${title}</h2></div><button class="link-button" data-recall-prompt="${id}">Copiar quiz →</button></div><div class="review-form"><label class="full">¿Qué estudiaste hoy?<textarea data-recall-field="learned" placeholder="Temas y conceptos concretos">${esc(item.learned || "")}</textarea></label><label class="full">Recuerda sin apuntes: explícalo con tus palabras<textarea data-recall-field="recall" placeholder="Definiciones, mecanismo, ejemplos y límites">${esc(item.recall || "")}</textarea></label><label class="full">¿Qué aplicaste y dónde fallaste?<textarea data-recall-field="practice" placeholder="Ejercicio, error y corrección">${esc(item.practice || "")}</textarea></label><label class="full">Ahora explícalo en inglés<textarea data-recall-field="english" placeholder="Explain what you learned in English">${esc(item.english || "")}</textarea></label><label class="full">Siguiente repaso o práctica<textarea data-recall-field="next" placeholder="La próxima acción concreta">${esc(item.next || "")}</textarea></label></div></article>`; }).join("")}</div>${legacy ? `<details class="panel legacy-review"><summary>Notas de revisión diaria anteriores (sin ruta)</summary><div class="review-form"><label class="full">¿Qué construí o comprendí?<textarea data-daily-review="learned">${esc(record.learned || "")}</textarea></label><label class="full">Brecha<textarea data-daily-review="gap">${esc(record.gap || "")}</textarea></label><label class="full">Siguiente acción<textarea data-daily-review="next">${esc(record.next || "")}</textarea></label><label class="full">English<textarea data-daily-review="english">${esc(record.english || "")}</textarea></label></div></details>` : ""}`;
  }
  function renderWeeklyReview() {
    const key = examWeek(), dates = Array.from({ length: 7 }, (_, i) => localDate(addDays(atNoon(key), i))), days = dates.map(date => state.daily[date]).filter(Boolean);
    const actual = sum(days.flatMap(day => day.tasks || []).map(item => item.actual)), done = sum(days.map(day => day.tasks.filter(item => item.done).length)), total = sum(days.map(day => day.tasks.length));
    const newProof = state.history.filter(item => item.date >= key && item.date <= dates[6] && item.to >= 3 && item.from < 3).length;
    const sleeps = dates.map(date => Number(state.energy[date]?.sleep)).filter(Number.isFinite).filter(n => n > 0), avgSleep = sleeps.length ? (sum(sleeps) / sleeps.length).toFixed(1) : "—";
    const record = state.weeklyReviews[key] || {}, planned = sum(dates.flatMap(eventsForDate).filter(item => item.counted).map(item => hours(item.start, item.end)));
    $("#weeklyReview").innerHTML = `<div class="calendar-toolbar"><div><button class="secondary-btn" data-review-nav="prev">‹</button><button class="secondary-btn" data-review-nav="today">Semana actual</button><button class="secondary-btn" data-review-nav="next">›</button><strong>${fmtShort(key)} – ${fmtShort(dates[6])}</strong></div></div><div class="review-metrics"><div><strong>${actual.toFixed(1)} h</strong><span>Horas reales / ${planned.toFixed(1)} h plantilla</span></div><div><strong>${done}/${total}</strong><span>Tareas completadas</span></div><div><strong>${newProof}</strong><span>Nuevas competencias demostradas</span></div><div><strong>${avgSleep} h</strong><span>Sueño medio registrado</span></div></div><div class="review-form"><label class="full">Evidencias concretas de la semana<textarea data-weekly-review="proof">${esc(record.proof || "")}</textarea></label><label>Mayor brecha o error<textarea data-weekly-review="gap">${esc(record.gap || "")}</textarea></label><label>Qué dejaré de hacer / reduciré<textarea data-weekly-review="stop">${esc(record.stop || "")}</textarea></label><label class="full">Tres prioridades de la próxima semana<textarea data-weekly-review="next">${esc(record.next || "")}</textarea></label><label class="full">Ajuste de energía y sostenibilidad<textarea data-weekly-review="energy">${esc(record.energy || "")}</textarea></label></div>`;
  }
  function copyText(value) { navigator.clipboard.writeText(value).then(() => notice("Prompt copiado al portapapeles."), () => notice("No se pudo copiar; verifica permisos del navegador.")); }
  function quizForCompetency(item) { return `Actúa como examinador riguroso de ML/AI Engineering. Evalúa mi competencia «${item.title}». Crea 5 preguntas de nivel avanzado, 1 ejercicio práctico nuevo y 1 caso de debugging. No reveles soluciones hasta que responda. Luego califica, detecta lagunas y pide una explicación en español y otra en inglés. Evalúa si puedo explicar, implementar y resolver sin tutorial.`; }
  function click(event) {
    const target = event.target, button = target.closest("button");
    if (button?.dataset.page) { showPage(button.dataset.page); return; }
    if (button?.dataset.go) { if (button.dataset.route) $("#routeFilter").value = button.dataset.route; showPage(button.dataset.go); return; }
    if (button?.classList.contains("nav-group-toggle")) { const group = button.closest(".nav-group"), open = !group.classList.contains("open"); group.classList.toggle("open", open); button.setAttribute("aria-expanded", String(open)); return; }
    if (button?.dataset.openCompetency) { openCompetencyId = openCompetencyId === button.dataset.openCompetency ? null : button.dataset.openCompetency; renderCompetencies(); return; }
    if (button?.dataset.addCompetency) { const routeId = button.dataset.addCompetency, title = prompt("Nombre de la nueva competencia:"); if (!title?.trim()) return; const item = { id: uid(routeId.toUpperCase()), routeId, title: title.trim(), priority: "P1", suggestedWindow: "Personalizada", prerequisitesAndSources: "", evidence: "Definir evidencia", custom: true }; state.customCompetencies.push(item); openCompetencyId = item.id; save(); renderCompetencies(); return; }
    if (button?.dataset.deleteCompetency) { if (!confirm("¿Eliminar esta competencia personalizada?")) return; state.customCompetencies = state.customCompetencies.filter(item => item.id !== button.dataset.deleteCompetency); delete state.competencies[button.dataset.deleteCompetency]; openCompetencyId = null; save(); renderCompetencies(); return; }
    if (button?.dataset.quiz) { const item = allItems().find(row => row.id === button.dataset.quiz); if (item) copyText(quizForCompetency(item)); return; }
    if (button?.dataset.topicToggle) { openTopicId = openTopicId === button.dataset.topicToggle ? null : button.dataset.topicToggle; renderSources(); return; }
    if (button?.dataset.addSubtopic) { const wrapper = button.closest("[data-topic-id]"), record = editableTopicRecord(wrapper.dataset.topicKind, wrapper.dataset.topicId); (record.subtopics ||= []).push({ id: uid("subtopic"), title: "", note: "" }); openTopicId = wrapper.dataset.topicId; save(); renderSources(); return; }
    if (button?.dataset.deleteSubtopic) { const wrapper = button.closest("[data-topic-id]"), record = editableTopicRecord(wrapper.dataset.topicKind, wrapper.dataset.topicId); record.subtopics = (record.subtopics || []).filter(item => item.id !== button.dataset.deleteSubtopic); save(); renderSources(); return; }
    if (button?.dataset.projectTab) { projectTab = button.dataset.projectTab; renderProjects(); return; }
    if (button?.dataset.addPhase) { const project = state.projects.find(item => item.id === button.dataset.addPhase); if (project) { (project.phases ||= []).push({ id: uid("phase"), title: "Nueva fase", done: false }); save(); renderProjects(); } return; }
    if (button?.dataset.deletePhase) { const project = state.projects.find(item => item.id === button.closest("[data-project]")?.dataset.project); if (project) { project.phases = (project.phases || []).filter(phase => phase.id !== button.dataset.deletePhase); save(); renderProjects(); } return; }
    if (button?.dataset.deleteProject) { if (!confirm("¿Eliminar este proyecto personalizado?")) return; state.projects = state.projects.filter(item => item.id !== button.dataset.deleteProject); save(); renderProjects(); return; }
    if (button?.id === "addProjectButton") { state.projects.push({ id: uid("p"), title: "Nuevo proyecto", description: "", acceptance: "", stack: "", notes: "", status: "planned", evidence: "", phases: [{ id: uid("phase"), title: "Definir alcance", done: false }], gates: {}, bucket: projectTab, custom: true }); save(); renderProjects(); return; }
    if (button?.dataset.weekNav) { if (button.dataset.weekNav === "today") { weekStart = currentWeekKey(0); calendarFollowsToday = true; } else { weekStart = localDate(addDays(atNoon(weekStart), button.dataset.weekNav === "prev" ? -7 : 7)); calendarFollowsToday = false; } renderCalendar(); return; }
    if (button?.dataset.monthNav) { const delta = button.dataset.monthNav === "prev" ? -28 : 28; homeMonth = button.dataset.monthNav === "today" ? periodForDate(today()) : localDate(addDays(atNoon(homeMonth), delta)); if (homeMonth < state.cycleStart) homeMonth = state.cycleStart; renderMonthChart(); return; }
    if (button?.id === "addBlockButton") { openBlock(null, today()); return; }
    if (button?.dataset.blockId) { const item = [...state.schedule, ...state.extraEvents].find(row => row.id === button.dataset.blockId); if (item) openBlock({ ...item, weekly: item.weekday != null }, button.dataset.blockDate); return; }
    if (target.classList.contains("day-column")) { const rect = target.getBoundingClientRect(), y = Math.max(0, Math.min(1019, event.clientY - rect.top)), minute = 360 + Math.floor(y / 30) * 30, time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; openBlock(null, target.dataset.calendarDate, time); return; }
    if (button?.id === "closeBlockDialog" || button?.id === "cancelBlockButton") { $("#blockDialog").close(); return; }
    if (button?.id === "deleteBlockButton") { if (confirm("¿Eliminar este bloque?")) deleteBlock(); return; }
    if (button?.id === "planTodayButton") { planDate = today(); planFollowsToday = true; renderPlan(); return; }
    if (button?.id === "syncDayButton") { addMissingTasks(planDate); save(); renderPlan(); notice("Bloques nuevos añadidos."); return; }
    if (button?.id === "addDayTaskButton") { ensureDay(planDate).tasks.push({ id: uid("task"), eventId: null, title: "Nueva tarea", planned: 0, actual: 0, done: false, category: "personal" }); save(); renderPlan(); return; }
    if (button?.dataset.deleteTask) { ensureDay(planDate).tasks = ensureDay(planDate).tasks.filter(item => item.id !== button.dataset.deleteTask); save(); renderPlan(); return; }
    if (button?.dataset.reviewNav) { reviewOffset = button.dataset.reviewNav === "today" ? 0 : reviewOffset + (button.dataset.reviewNav === "prev" ? -1 : 1); renderPage(page); return; }
    if (button?.dataset.examQuiz) { copyText(examPrompt(examWeek(), button.dataset.examQuiz)); return; }
    if (button?.dataset.recallPrompt) { const id = button.dataset.recallPrompt, item = state.dailyReviews[planDate]?.[id] || {}, names = { ds: "Data Science", ai: "AI Engineering", ga: "GenAI Engineering" }; copyText(`Actúa como tutor exigente de ${names[id]}. Hoy estudié: ${item.learned?.trim() || "todavía no he registrado mis temas"}. Hazme 5 preguntas de recuerdo activo y un ejercicio de transferencia. No des pistas hasta que responda. Luego corrige mis errores, pídeme que explique el concepto en español y finalmente en inglés. Enfócate en mis dudas: ${item.practice?.trim() || "por identificar"}.`); return; }
    if (button?.id === "menuButton") { $("#sidebar").classList.toggle("open"); return; }
    if (button?.id === "themeButton") { state.theme = state.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = state.theme; save(); return; }
    if (button?.id === "exportButton") { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `mltraining-respaldo-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
    if (button?.id === "importButton") { $("#importFile").click(); return; }
  }
  function change(event) {
    const el = event.target;
    if (["routeFilter", "priorityFilter", "statusFilter", "competencySearch"].includes(el.id)) { renderCompetencies(); return; }
    if (el.dataset.compField) {
      const id = el.closest("[data-competency]")?.dataset.competency, item = allItems().find(row => row.id === id);
      if (!item) return;
      const record = state.competencies[id] ||= {}, field = el.dataset.compField, value = el.value;
      if (field === "level") {
        const next = Number(value), before = Number(record.level) || 0;
        const evidence = el.closest(".competency-detail").querySelector('[data-comp-field="evidence"]').value.trim();
        if (next >= 3 && !evidence) { el.value = String(before); notice("Para el nivel 3 o 4, añade evidencia revisable."); return; }
        record.evidence = evidence; record.level = next; if (before !== next) state.history.push({ id, from: before, to: next, date: today() });
        save(); renderCompetencies(); return;
      }
      if (field === "evidence" && !value.trim() && level(item) >= 3) { el.value = record.evidence || ""; notice("Conserva una evidencia para el nivel 3 o 4."); return; }
      record[field] = value; save(); if (field === "title" || field === "autonomy") renderCompetencies(); return;
    }
    if (el.dataset.futuraId) { const record = state.futura[el.dataset.futuraId] ||= {}; record[el.dataset.futuraField] = el.dataset.futuraField === "status" ? Number(el.value) : el.value; record.lastStudiedAt = today(); save(); if (el.dataset.futuraField === "status") renderSources(); return; }
    if (el.dataset.curriculumId) { const record = sourceRecord({ id: el.dataset.curriculumId }); record[el.dataset.curriculumField] = el.dataset.curriculumField === "status" ? Number(el.value) : el.value; record.lastStudiedAt = today(); state.curriculum[el.dataset.curriculumId] = record; save(); if (el.dataset.curriculumField === "status") renderSources(); return; }
    if (el.dataset.topicField) { const wrapper = el.closest("[data-topic-id]"), record = editableTopicRecord(wrapper.dataset.topicKind, wrapper.dataset.topicId); record[el.dataset.topicField] = el.value; record.lastStudiedAt = today(); save(); return; }
    if (el.dataset.subtopicField) { const wrapper = el.closest("[data-topic-id]"), record = editableTopicRecord(wrapper.dataset.topicKind, wrapper.dataset.topicId), subtopic = record.subtopics?.find(item => item.id === el.closest("[data-subtopic-id]")?.dataset.subtopicId); if (subtopic) { subtopic[el.dataset.subtopicField] = el.value; record.lastStudiedAt = today(); save(); } return; }
    if (el.id === "curriculumFilter") { renderSources(); return; }
    if (el.id === "cycleStart") { state.cycleStart = el.value || DEFAULT_CYCLE_START; homeMonth = periodForDate(today()); save(); renderSequence(); return; }
    if (el.dataset.sequenceWeek) { (state.sequence[el.dataset.sequenceWeek] ||= {})[el.dataset.sequenceRoute] = el.value; save(); return; }
    if (el.dataset.projectField) { const project = state.projects.find(item => item.id === el.closest("[data-project]")?.dataset.project); if (project) { project[el.dataset.projectField] = el.value; save(); } return; }
    if (el.dataset.phaseField) { const project = state.projects.find(item => item.id === el.closest("[data-project]")?.dataset.project), phase = project?.phases?.find(item => item.id === el.closest("[data-phase-id]")?.dataset.phaseId); if (phase) { phase[el.dataset.phaseField] = el.dataset.phaseField === "done" ? el.checked : el.value; save(); if (el.dataset.phaseField === "done") renderProjects(); } return; }
    if (el.dataset.gate) { const project = state.projects.find(item => item.id === el.closest("[data-project]")?.dataset.project); if (project) { (project.gates ||= {})[el.dataset.gate] = el.checked; save(); renderProjects(); } return; }
    if (el.id === "planDate" || el.id === "dailyReviewDate") { planDate = el.value || today(); planFollowsToday = false; renderPage(page); return; }
    if (el.dataset.taskField) { const task = ensureDay(planDate).tasks.find(item => item.id === el.closest("[data-task-id]")?.dataset.taskId); if (task) { task[el.dataset.taskField] = el.dataset.taskField === "done" ? el.checked : ["planned", "actual"].includes(el.dataset.taskField) ? Math.max(0, Number(el.value) || 0) : el.value; if (task.eventId) (state.activityLog[planDate] ||= {})[task.eventId] = { done: !!task.done, actual: Number(task.actual) || 0 }; save(); renderPlan(); } return; }
    if (el.id === "energyDate") { energyDate = el.value || today(); renderEnergy(); return; }
    if (el.dataset.energyField) { (state.energy[energyDate] ||= {})[el.dataset.energyField] = el.value; save(); renderEnergy(); return; }
    if (el.dataset.examField) { const key = examWeek(), id = el.closest("[data-exam]")?.dataset.exam; if (id) { (((state.exams[key] ||= {})[id]) ||= {})[el.dataset.examField] = el.value; save(); } return; }
    if (el.dataset.recallField) { const id = el.closest("[data-recall-route]")?.dataset.recallRoute; if (id) { ((((state.dailyReviews[planDate] ||= {})[id]) ||= {}))[el.dataset.recallField] = el.value; save(); } return; }
    if (el.dataset.dailyReview) { (state.dailyReviews[planDate] ||= {})[el.dataset.dailyReview] = el.value; save(); return; }
    if (el.dataset.weeklyReview) { (state.weeklyReviews[examWeek()] ||= {})[el.dataset.weeklyReview] = el.value; save(); return; }
    if (el.id === "importFile") { const file = el.files?.[0]; if (!file) return; file.text().then(text => { const parsed = JSON.parse(text); if (!parsed || !Array.isArray(parsed.projects) || !parsed.competencies || !Array.isArray(parsed.schedule)) throw Error("Formato incompatible"); if (!confirm("¿Reemplazar el progreso local de MLTraining por este respaldo?")) return; localStorage.setItem(KEY, JSON.stringify(parsed)); state = load(); document.documentElement.dataset.theme = state.theme; renderPage(page); updateSidebar(); notice("Respaldo importado."); }).catch(() => notice("No se pudo importar el respaldo.")); el.value = ""; }
  }
  async function init() {
    try { const response = await fetch("./mapa.json"); if (!response.ok) throw Error("No se pudo leer el mapa"); seed = await response.json(); }
    catch { $("#homeFocus").innerHTML = `<div class="alert">No se pudo cargar el mapa de formación. Abre la página desde un servidor web o vuelve a cargarla.</div>`; return; }
    state = load(); weekStart = currentWeekKey(0); planDate = today(); energyDate = today(); homeMonth = periodForDate(today());
    document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
    $("#todayLabel").textContent = fmtDay(today());
    $("#blockForm").elements.category.innerHTML = Object.entries(CAT).map(([key, [label]]) => `<option value="${key}">${esc(label)}</option>`).join("");
    document.addEventListener("click", click); document.addEventListener("change", change);
    $("#blockForm").addEventListener("submit", saveBlock);
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1) || "inicio", false));
    setInterval(() => { const now = today(); if (now !== $("#todayLabel").dataset.date) { $("#todayLabel").dataset.date = now; $("#todayLabel").textContent = fmtDay(now); if (calendarFollowsToday) weekStart = currentWeekKey(0); if (planFollowsToday) planDate = now; energyDate = now; renderPage(page); } }, 60000);
    $("#todayLabel").dataset.date = today();
    updateSidebar(); showPage(location.hash.slice(1) || "inicio", false);
  }
  init();
})();
