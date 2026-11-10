import test from "node:test";
import assert from "node:assert/strict";
import { reportProgress, taskLifecycle } from "../lib/task-journey.js";

const emptyReport = { workPerformed: "", outcome: "", hoursRecorded: false, revision: 0 };
const task = (patch = {}) => ({ status: "progress", reviewRequired: true, hours: 0, ...patch });
const details = (report = {}) => ({ report: { ...emptyReport, ...report } });

test("a task that has not started has nothing done and starting is next", () => {
  const progress = reportProgress(task({ status: "backlog" }), details());
  assert.deepEqual(progress.steps.map((step) => step.key), ["start", "work", "outcome", "hours", "submit"]);
  assert.deepEqual(progress.steps.map((step) => step.done), [false, false, false, false, false]);
  assert.equal(progress.done, 0);
  assert.equal(progress.total, 5);
  assert.equal(progress.percent, 0);
  assert.equal(progress.next.key, "start");
});

test("only saved report parts count as done", () => {
  const progress = reportProgress(task(), details({ workPerformed: "Checked the logs", outcome: "   " }));
  assert.deepEqual(progress.steps.map((step) => step.done), [true, true, false, false, false]);
  assert.equal(progress.done, 2);
  assert.equal(progress.percent, 40);
  assert.equal(progress.next.key, "outcome");
});

test("hours count only once they are recorded in the report, not from a legacy total", () => {
  assert.equal(reportProgress(task({ hours: 3 }), details()).steps[3].done, false);
  assert.equal(reportProgress(task({ hours: 0 }), details({ hoursRecorded: true })).steps[3].done, true);
});

test("the next step is the first one still open, even when later parts are saved", () => {
  const progress = reportProgress(task(), details({ outcome: "Resolved", hoursRecorded: true }));
  assert.equal(progress.next.key, "work");
  assert.equal(progress.done, 3);
});

test("blocked and returned tasks keep their started step and saved parts", () => {
  for (const status of ["blocked", "returned"]) {
    const progress = reportProgress(task({ status }), details({ workPerformed: "Done", outcome: "Fixed", hoursRecorded: true }));
    assert.deepEqual(progress.steps.map((step) => step.done), [true, true, true, true, false], status);
    assert.equal(progress.next.key, "submit");
  }
});

test("submitted and completed tasks are fully done and have no next step", () => {
  const full = details({ workPerformed: "Done", outcome: "Fixed", hoursRecorded: true });
  for (const status of ["review", "done"]) {
    const progress = reportProgress(task({ status }), full);
    assert.equal(progress.done, 5, status);
    assert.equal(progress.percent, 100);
    assert.equal(progress.next, null);
  }
});

test("an older task submitted without a structured report keeps its gaps", () => {
  const progress = reportProgress(task({ status: "review" }), details());
  assert.deepEqual(progress.steps.map((step) => step.done), [true, false, false, false, true]);
  assert.equal(progress.next.key, "work");
});

test("the final step is named for the way the task closes", () => {
  assert.equal(reportProgress(task(), details()).steps[4].label, "Review & submit");
  assert.equal(reportProgress(task({ reviewRequired: false }), details()).steps[4].label, "Review & complete");
});

test("missing details are treated as an empty report", () => {
  const progress = reportProgress(task({ status: "todo" }), undefined);
  assert.equal(progress.done, 0);
  assert.equal(progress.next.key, "start");
});

test("the lifecycle marks the current stage for every open status", () => {
  const states = (status) => taskLifecycle(task({ status })).map((stage) => `${stage.key}:${stage.state}`);
  assert.deepEqual(states("backlog"), ["assigned:current", "work:upcoming", "review:upcoming", "complete:upcoming"]);
  assert.deepEqual(states("todo"), ["assigned:current", "work:upcoming", "review:upcoming", "complete:upcoming"]);
  for (const status of ["progress", "blocked", "returned"]) {
    assert.deepEqual(states(status), ["assigned:done", "work:current", "review:upcoming", "complete:upcoming"], status);
  }
  assert.deepEqual(states("review"), ["assigned:done", "work:done", "review:current", "complete:upcoming"]);
  assert.deepEqual(states("done"), ["assigned:done", "work:done", "review:done", "complete:done"]);
});

test("a review-exempt task has no manager review stage", () => {
  const stages = taskLifecycle(task({ reviewRequired: false }));
  assert.deepEqual(stages.map((stage) => stage.key), ["assigned", "work", "complete"]);
  assert.deepEqual(stages.map((stage) => stage.label), ["Assigned", "Work", "Complete"]);
});

test("a cancelled task has no lifecycle", () => {
  assert.deepEqual(taskLifecycle(task({ status: "cancelled" })), []);
});
