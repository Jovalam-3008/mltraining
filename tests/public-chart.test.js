"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BASE_STUDY_HOURS, periodStartFor, chartModel, chartMarkup } = require("../src/public-chart");
const { seedSchedule } = require("../app.js");

test("the public reference matches the 90-hour template excluding exercise", () => {
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const schedule = seedSchedule();
  for (let weekday = 0; weekday < 7; weekday++) {
    const study = schedule.filter(item => item.weekday === weekday && item.counted && item.category !== "fitness")
      .reduce((sum, item) => sum + (minutes(item.end) - minutes(item.start)) / 60, 0);
    assert.equal(BASE_STUDY_HOURS[weekday], study);
  }
  assert.equal(BASE_STUDY_HOURS.reduce((sum, hours) => sum + hours, 0), 84);
});

test("the first public period starts on November 2 and crosses into December by weeks", () => {
  const summary = { cycleStart: "2026-11-02", hoursByDay: { "2026-11-02": 2, "2026-12-01": 3 } };
  const first = chartModel(summary, periodStartFor(summary.cycleStart, "2026-11-02"), "2026-11-03");
  assert.equal(first.start, "2026-11-02");
  assert.equal(first.end, "2026-11-29");
  assert.equal(first.plannedToday, 12.5);
  assert.equal(first.studied, 2);
  assert.equal(first.studyDays, 1);
  const next = chartModel(summary, periodStartFor(summary.cycleStart, "2026-12-01"), "2026-12-01");
  assert.equal(next.start, "2026-11-30");
  assert.equal(next.points[1].date, "2026-12-01");
  assert.equal(next.points[1].actual, 3);
  assert.equal(next.firstWeek, 5);
});

test("real-hour dots use the period index, not the day of the month", () => {
  const model = chartModel({ cycleStart: "2026-11-02", hoursByDay: { "2026-11-02": 1 } }, "2026-11-02", "2026-11-02");
  const markup = chartMarkup(model);
  assert.match(markup, /<circle cx="48"/);
  assert.match(markup, /S1 · 2 nov/);
  assert.doesNotMatch(markup, /private-note|dailyReviews|energy/);
});
