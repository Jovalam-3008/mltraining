"use strict";

// La línea pública representa la plantilla de 90 h: excluye las 6 h de ejercicio.
const BASE_STUDY_HOURS = Object.freeze([9.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12]);
const DAY_MS = 86400000;
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "2026-11-02";
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "2026-11-02";
};
const dayNumber = date => Date.parse(`${date}T12:00:00Z`) / DAY_MS;
const addDays = (date, offset) => new Date((dayNumber(date) + offset) * DAY_MS).toISOString().slice(0, 10);
const shortDate = date => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function periodStartFor(cycleStart, referenceDate) {
  const start = validDate(cycleStart), reference = validDate(referenceDate);
  const elapsed = Math.max(0, Math.floor(dayNumber(reference) - dayNumber(start)));
  return addDays(start, Math.floor(elapsed / 28) * 28);
}

function chartModel(summary, periodStart, today) {
  const cycleStart = validDate(summary?.cycleStart);
  const start = periodStartFor(cycleStart, periodStart || today);
  const actualByDay = summary?.hoursByDay || {};
  const points = Array.from({ length: 28 }, (_, index) => {
    const date = addDays(start, index);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const raw = Number(actualByDay[date]);
    return { date, planned: BASE_STUDY_HOURS[weekday], actual: date <= today && Number.isFinite(raw) ? Math.max(0, raw) : 0, elapsed: date <= today };
  });
  const elapsed = points.filter(point => point.elapsed);
  const todayWeekday = new Date(`${validDate(today)}T12:00:00Z`).getUTCDay();
  return {
    start,
    end: points[27].date,
    points,
    studied: elapsed.reduce((sum, point) => sum + point.actual, 0),
    plannedToday: today >= cycleStart ? BASE_STUDY_HOURS[todayWeekday] : 0,
    studyDays: elapsed.filter(point => point.actual > 0).length,
    firstWeek: Math.floor((dayNumber(start) - dayNumber(cycleStart)) / 7) + 1,
  };
}

function chartMarkup(model) {
  const points = model.points;
  const x = index => 48 + index * 864 / 27;
  const maximum = Math.max(4, Math.ceil(Math.max(...points.flatMap(point => [point.actual, point.planned])) / 4) * 4);
  const y = value => 190 - Math.min(maximum, value) * 155 / maximum;
  const grid = [0, .25, .5, .75, 1].map(ratio => {
    const value = Math.round(maximum * ratio), position = y(value);
    return `<line x1="48" x2="912" y1="${position}" y2="${position}" class="chart-grid"/><text x="38" y="${position + 4}" text-anchor="end" class="chart-label">${value}</text>`;
  }).join("");
  const weekLines = [7, 14, 21].map(index => `<line x1="${x(index)}" x2="${x(index)}" y1="35" y2="190" class="chart-week-line"/>`).join("");
  const labels = [0, 7, 14, 21].map(index => `<text x="${x(index)}" y="216" text-anchor="middle" class="chart-label">S${model.firstWeek + index / 7} · ${shortDate(points[index].date)}</text>`).join("");
  const plannedLine = points.map((point, index) => `${x(index)},${y(point.planned)}`).join(" ");
  const actualLine = points.filter(point => point.elapsed).map((point, index) => `${x(index)},${y(point.actual)}`).join(" ");
  const dots = points.map((point, index) => point.elapsed && point.actual > 0 ? `<circle cx="${x(index)}" cy="${y(point.actual)}" r="4" class="chart-dot"><title>${shortDate(point.date)}: ${point.actual.toFixed(1)} h reales / ${point.planned.toFixed(1)} h del plan base</title></circle>` : "").join("");
  return `<svg viewBox="0 0 960 230" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${grid}${weekLines}<polyline points="${plannedLine}" class="chart-planned"/>${actualLine ? `<polyline points="${actualLine}" class="chart-actual"/>` : ""}${dots}${labels}</svg><div class="chart-legend"><span class="actual-key">Horas reales</span><span class="planned-key">Plan base de estudio</span></div>`;
}

module.exports = { BASE_STUDY_HOURS, addDays, shortDate, periodStartFor, chartModel, chartMarkup };
