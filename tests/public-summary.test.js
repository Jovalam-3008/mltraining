"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildPublicSummary } = require("../src/public-summary");

test("public summary excludes private notes, energy and review answers", () => {
  const state = {
    cycleStart: "2026-11-02",
    competencies: { DS01: { level: 3, evidence: "private-link", notes: "private-note" } },
    projects: [{ id: "p1", title: "Modelo", description: "secret", notes: "secret", status: "active", bucket: "principal", phases: [{ done: true }, { done: false }] }],
    schedule: [{ id: "study", category: "ds", counted: true }, { id: "training", category: "fitness", counted: true }],
    daily: { "2026-11-02": { tasks: [{ eventId: "study", category: "ds", actual: 1.5, title: "secret" }, { eventId: "training", category: "fitness", actual: 1 }] } },
    activityLog: { "2026-11-02": { study: { actual: 1.5 }, training: { actual: 1 }, other: { actual: 2 } } },
    energy: { "2026-11-02": { sleep: 6 } },
    dailyReviews: { "2026-11-02": { learned: "secret" } },
  };
  const summary = buildPublicSummary(state);
  assert.deepEqual(summary.competencies, { DS01: { level: 3 } });
  assert.deepEqual(summary.projects, [{ id: "p1", title: "Modelo", status: "active", bucket: "principal", progress: 50 }]);
  assert.equal(summary.hoursByDay["2026-11-02"], 1.5);
  assert.doesNotMatch(JSON.stringify(summary), /private|secret|energy|dailyReviews/);
});

test("direct calendar activity contributes once to the public hours", () => {
  const summary = buildPublicSummary({
    schedule: [{ id: "study", category: "ds", counted: true }],
    daily: {},
    activityLog: { "2026-11-03": { study: { done: true, actual: 2 } } },
  });
  assert.equal(summary.hoursByDay["2026-11-03"], 2);
});

test("the public hours begin with the cycle, not the prior template", () => {
  const summary = buildPublicSummary({
    cycleStart: "2026-11-02",
    daily: { "2026-11-01": { tasks: [{ actual: 3 }] }, "2026-11-02": { tasks: [{ actual: 4 }] } },
  });
  assert.deepEqual(summary.hoursByDay, { "2026-11-02": 4 });
});
