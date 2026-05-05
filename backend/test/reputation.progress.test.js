const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { computeLevelProgress } = require("../reputation");

describe("computeLevelProgress", () => {
  const levels = [
    { id: "a", level_number: 1, level_name: "Bronze", min_points: 0 },
    { id: "b", level_number: 2, level_name: "Silver", min_points: 100 },
    { id: "c", level_number: 3, level_name: "Gold", min_points: 300 },
  ];

  test("at zero points: first tier, partial progress toward second", () => {
    const r = computeLevelProgress(0, levels);
    assert.equal(r.current.level_number, 1);
    assert.equal(r.progressPercent, 0);
    assert.ok(r.next);
    assert.equal(r.next.min_points, 100);
  });

  test("mid-tier progress between Silver and Gold", () => {
    const r = computeLevelProgress(200, levels);
    assert.equal(r.current.level_number, 2);
    assert.equal(r.next.min_points, 300);
    assert.equal(r.progressPercent, 50);
  });

  test("at max tier: progress 100 and no next", () => {
    const r = computeLevelProgress(500, levels);
    assert.equal(r.current.level_number, 3);
    assert.equal(r.progressPercent, 100);
    assert.equal(r.next, null);
  });
});
