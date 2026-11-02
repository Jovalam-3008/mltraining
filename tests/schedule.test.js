"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { seedSchedule, seedScheduleV6, migrateScheduleV6, migrateDailyV6, migrateScheduleV7, migrateDailyV7, migrateWeeklyKeysV7, monday, sourceRoute } = require("../app.js");

const duration = item => {
  const toMinutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return (toMinutes(item.end) - toMinutes(item.start)) / 60;
};

test("the November template totals 90 hours with fixed meals and six training hours", () => {
  const schedule = seedSchedule();
  assert.equal(schedule.filter(item => item.counted).reduce((total, item) => total + duration(item), 0), 90);
  assert.equal(schedule.filter(item => item.counted && item.category === "fitness").reduce((total, item) => total + duration(item), 0), 6);
  assert.deepEqual(Array.from({ length: 7 }, (_, day) => schedule.filter(item => item.weekday === day && item.counted && item.category !== "fitness").reduce((total, item) => total + duration(item), 0)), [9.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12]);
  for (const weekday of [1, 2, 3, 4, 5]) {
    assert.ok(schedule.some(item => item.weekday === weekday && item.category === "project" && item.start === "20:30" && item.end === "22:00"));
  }
  assert.deepEqual(schedule.filter(item => item.title.endsWith("Weekly Exam")).map(item => [item.weekday, item.start, duration(item)]), [[0, "14:00", 1], [0, "15:00", 1], [6, "16:00", 1], [6, "17:00", 1]]);
  assert.equal(schedule.filter(item => item.title === "ML Engineer Recall").length, 2);
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    const meals = schedule.filter(item => item.weekday === weekday && ["Desayuno", "Almuerzo", "Cena"].includes(item.title));
    assert.deepEqual(meals.map(item => [item.start, item.end]), [["08:00", "08:30"], ["13:00", "14:00"], ["18:00", "18:30"]]);
    assert.ok(meals.every(item => item.locked && !item.counted));
  }
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    const counted = schedule.filter(item => item.weekday === weekday && item.counted).sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 1; index < counted.length; index++) assert.ok(counted[index - 1].end <= counted[index].start, `overlapping load on day ${weekday}`);
  }
});

test("migration updates only untouched default blocks and retains personal edits", () => {
  const previous = [
    { id: "base-1", weekday: 0, start: "06:00", end: "07:00", title: "Activación", category: "care", counted: false, note: "" },
    { id: "base-30", weekday: 1, start: "22:30", end: "23:00", title: "Desactivación", category: "sleep", counted: false, note: "" },
    { id: "base-75", weekday: 3, start: "16:30", end: "18:00", title: "AI Project · Build", category: "project", counted: true, note: "" },
    { id: "base-90", weekday: 6, start: "18:30", end: "20:00", title: "Project · Integrate & Debug", category: "project", counted: true, note: "" },
    { id: "base-91", weekday: 6, start: "20:00", end: "21:00", title: "Build Portfolio", category: "project", counted: true, note: "" },
    { id: "weekly-exam-me", weekday: 0, start: "15:30", end: "16:00", title: "ML Engineer Weekly Exam", category: "recall", counted: true, note: "" },
    { id: "weekly-exam-ga", weekday: 0, start: "16:00", end: "16:30", title: "GenAI Weekly Exam", category: "recall", counted: true, note: "" },
    { id: "base-40", weekday: 5, start: "07:15", end: "08:45", title: "Mi bloque editado", category: "ds", counted: true, note: "personal" },
    { id: "custom-night", weekday: 2, start: "21:00", end: "22:00", title: "Tiempo familiar", category: "personal", counted: false, note: "" },
  ];
  const migrated = migrateScheduleV6(previous);
  assert.equal(previous[0].start, "06:00", "migration must not mutate the old state in place");
  assert.equal(migrated.find(item => item.id === "base-1").start, "06:30");
  assert.equal(migrated.find(item => item.id === "base-30").start, "23:00");
  assert.equal(migrated.find(item => item.id === "base-75").counted, false);
  assert.equal(migrated.find(item => item.id === "base-75").title, "Descanso");
  assert.equal(migrated.find(item => item.id === "base-90").title, "Fundamentals Recall");
  assert.equal(migrated.find(item => item.id === "base-91").start, "19:30");
  assert.equal(migrated.find(item => item.id === "weekly-exam-me").end, "16:15");
  assert.equal(migrated.find(item => item.id === "weekly-exam-ga").start, "16:15");
  assert.deepEqual(migrated.find(item => item.id === "base-40"), previous.find(item => item.id === "base-40"));
  assert.deepEqual(migrated.find(item => item.id === "custom-night"), previous.find(item => item.id === "custom-night"));
  assert.ok(!migrated.some(item => item.id === "v6-project-2"), "do not overlap a personal block");
  assert.equal(migrateScheduleV6(migrated).length, migrated.length, "migration is repeatable");
});

test("ML engineering sources feed the ML Engineer exam", () => {
  const topic = { module: "Pipeline", title: "MLflow" };
  assert.equal(sourceRoute("krish-mlops", topic), "me");
  assert.equal(sourceRoute("ibm-de", topic), "me");
  assert.equal(sourceRoute("anyoneai", { module: "Sprint 4", title: "Model Deployment" }), "me");
});

test("Sunday exams belong to the Monday–Sunday week that just ended", () => {
  assert.equal(monday(new Date("2026-11-08T12:00:00")).toLocaleDateString("en-CA"), "2026-11-02");
});

test("old Sunday-keyed exam and review notes move to the Monday week", () => {
  const state = { exams: { "2026-11-01": { ds: { score: 80 } }, "2026-11-02": { me: { score: 75 } } }, weeklyReviews: { "2026-11-01": { proof: "repo" } } };
  migrateWeeklyKeysV7(state);
  assert.deepEqual(state.exams["2026-11-02"], { ds: { score: 80 }, me: { score: 75 } });
  assert.deepEqual(state.weeklyReviews["2026-11-02"], { proof: "repo" });
  assert.ok(!state.exams["2026-11-01"]);
});

test("existing v6 daily plans gain new sessions without losing completed work", () => {
  const schedule = seedScheduleV6();
  const find = (weekday, title) => schedule.find(item => item.weekday === weekday && item.title === title);
  const wednesdayRest = find(3, "Descanso");
  const saturdayRecall = find(6, "Fundamentals Recall");
  const mondayStudy = find(1, "Data Science Core");
  const data = {
    cycleStart: "2026-11-02", schedule, activityLog: {},
    daily: {
      "2026-11-02": { initialized: true, tasks: [{ id: "kept", eventId: mondayStudy.id, title: "Mi estudio personalizado", planned: 2, actual: 1, done: true, category: "ds" }] },
      "2026-11-04": { initialized: true, tasks: [{ id: "old-wed", eventId: wednesdayRest.id, title: "AI Project · Build", planned: 1.5, actual: 0, done: false, category: "project" }] },
      "2026-11-07": { initialized: true, tasks: [{ id: "old-sat", eventId: saturdayRecall.id, title: "Project · Integrate & Debug", planned: 1.5, actual: 0, done: false, category: "project" }] },
      "2026-11-08": { initialized: true, tasks: [{ id: "old-exam", eventId: "weekly-exam-me", title: "ML Engineer Weekly Exam", planned: 0.5, actual: 0, done: false, category: "recall" }] },
      "2026-11-09": { tasks: [] },
    },
  };
  migrateDailyV6(data);
  assert.deepEqual(data.daily["2026-11-02"].tasks.find(item => item.id === "kept"), { id: "kept", eventId: mondayStudy.id, title: "Mi estudio personalizado", planned: 2, actual: 1, done: true, category: "ds" });
  assert.ok(data.daily["2026-11-02"].tasks.some(item => item.eventId === "v6-project-1"));
  assert.ok(!data.daily["2026-11-04"].tasks.some(item => item.id === "old-wed"));
  assert.equal(data.daily["2026-11-07"].tasks.find(item => item.id === "old-sat").planned, 1);
  assert.equal(data.daily["2026-11-07"].tasks.find(item => item.id === "old-sat").title, "Fundamentals Recall");
  assert.equal(data.daily["2026-11-08"].tasks.find(item => item.id === "old-exam").planned, 0.75);
  assert.ok(data.daily["2026-11-08"].tasks.some(item => item.eventId === "v6-weekly-review"));
  assert.deepEqual(data.daily["2026-11-09"].tasks, [], "uninitialized days remain untouched");
});

test("v7 migration preserves custom and completed work while moving the default timetable", () => {
  const previous = seedScheduleV6();
  assert.equal(migrateScheduleV7(previous).filter(item => item.counted).reduce((total, item) => total + duration(item), 0), 90);
  const mondayStudy = previous.find(item => item.weekday === 1 && item.title === "Data Science Core");
  const oldProject = previous.find(item => item.weekday === 1 && item.title === "Project · Build");
  const meal = previous.find(item => item.weekday === 1 && item.title === "Desayuno");
  previous.push({ id: "personal", weekday: 2, start: "14:00", end: "15:00", title: "Tiempo familiar", category: "personal", counted: false, note: "" });
  const migrated = migrateScheduleV7(previous);
  assert.deepEqual(migrated.find(item => item.id === "personal"), previous.at(-1));
  assert.equal(migrated.find(item => item.id === mondayStudy.id).start, "06:00");
  assert.equal(migrated.find(item => item.id === meal.id).locked, true);
  assert.ok(migrated.some(item => item.weekday === 6 && item.title === "Data Science Weekly Exam"));
  const state = { cycleStart: "2026-11-02", schedule: migrated, activityLog: {}, daily: {
    "2026-11-02": { initialized: true, tasks: [
      { id: "study", eventId: mondayStudy.id, title: mondayStudy.title, planned: 1.5, actual: 0, done: false, category: "ds" },
      { id: "project", eventId: oldProject.id, title: oldProject.title, planned: 2, actual: 1, done: true, category: "project" },
      { id: "meal", eventId: meal.id, title: meal.title, planned: .5, actual: .5, done: true, category: "care" },
    ] },
  } };
  migrateDailyV7(state, previous);
  assert.equal(state.daily["2026-11-02"].tasks.find(item => item.id === "study").planned, 2);
  assert.deepEqual(state.daily["2026-11-02"].tasks.find(item => item.id === "project"), { id: "project", eventId: oldProject.id, title: oldProject.title, planned: 2, actual: 1, done: true, category: "project" });
  assert.ok(!state.daily["2026-11-02"].tasks.some(item => item.id === "meal"));
  assert.ok(state.daily["2026-11-02"].tasks.some(item => item.title === "GenAI Recall" && item.planned === .5));
});
