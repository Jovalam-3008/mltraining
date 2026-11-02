"use strict";

function safeHours(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(24, number)) : 0;
}
const isMeal = item => ["Desayuno", "Almuerzo", "Cena"].includes(item?.title);

function buildPublicSummary(state) {
  const competencies = {};
  for (const [id, record] of Object.entries(state.competencies || {})) {
    const level = Number(record?.level);
    competencies[id] = { level: Number.isFinite(level) ? Math.max(0, Math.min(4, Math.trunc(level))) : 0 };
  }

  const projects = (Array.isArray(state.projects) ? state.projects : []).map(project => {
    const phases = Array.isArray(project.phases) ? project.phases : [];
    return {
      id: String(project.id || "").slice(0, 100),
      title: String(project.title || "Proyecto sin título").slice(0, 160),
      status: String(project.status || "planned").slice(0, 30),
      bucket: project.bucket === "principal" ? "principal" : "secondary",
      progress: phases.length ? Math.round(phases.filter(phase => phase.done).length / phases.length * 100) : 0,
    };
  });

  const hoursByDay = {};
  const cycleStart = /^\d{4}-\d{2}-\d{2}$/.test(state.cycleStart || "") ? state.cycleStart : "2026-11-02";
  const daily = state.daily || {};
  const activityLog = state.activityLog || {};
  const events = [...(Array.isArray(state.schedule) ? state.schedule : []), ...(Array.isArray(state.extraEvents) ? state.extraEvents : [])];
  const countableEvents = new Set(events.filter(event => event.counted && event.category !== "fitness" && !isMeal(event)).map(event => event.id));
  for (const date of new Set([...Object.keys(daily), ...Object.keys(activityLog)])) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < cycleStart) continue;
    const tasks = Array.isArray(daily[date]?.tasks) ? daily[date].tasks : [];
    const tracked = new Set(tasks.map(task => task.eventId).filter(Boolean));
    const taskHours = tasks.reduce((total, task) => total + (task.category === "fitness" || isMeal(task) ? 0 : safeHours(task.actual)), 0);
    const directHours = Object.entries(activityLog[date] || {}).reduce((total, [id, record]) => total + (tracked.has(id) || !countableEvents.has(id) ? 0 : safeHours(record?.actual)), 0);
    hoursByDay[date] = Math.round((taskHours + directHours) * 100) / 100;
  }

  return {
    cycleStart,
    competencies,
    projects,
    hoursByDay,
  };
}

module.exports = { buildPublicSummary };
