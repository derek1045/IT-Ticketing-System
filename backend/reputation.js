/**
 * Reputation and level progression (quality-adjusted rules).
 * Point caps and reason codes are enforced at write time in route handlers.
 */

const UPVOTE_POINTS_PER_VOTE = 1;
const UPVOTE_AUTHOR_DAILY_CAP = 20;
const TICKET_RESOLVED_POINTS = 15;
const ACCEPTED_ANSWER_AUTHOR_POINTS = 25;

/**
 * Pure level progression from sorted level_definitions rows (min_points ASC).
 * @param {number} total
 * @param {{ id: string, level_number: number, level_name: string, min_points: number }[]} rows
 */
function computeLevelProgress(total, rows) {
  if (!rows?.length) {
    return {
      currentLevelId: null,
      totalPoints: total,
      progressPercent: 100,
      current: null,
      next: null,
    };
  }
  let current = rows[0];
  for (const row of rows) {
    if (total >= row.min_points) current = row;
  }
  const next = rows.find((r) => r.min_points > current.min_points);
  let progress = 100;
  if (next) {
    const span = next.min_points - current.min_points;
    const gained = total - current.min_points;
    progress = Math.min(100, Math.max(0, Math.round((gained / span) * 10000) / 100));
  }
  return {
    currentLevelId: current.id,
    totalPoints: total,
    progressPercent: progress,
    current,
    next: next || null,
  };
}

async function getTotalPoints(client, userId) {
  const r = await client.query(
    `SELECT COALESCE(SUM(points_delta), 0)::int AS total FROM reputation_events WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0].total;
}

async function getUpvotePointsAwardedToday(client, userId) {
  const r = await client.query(
    `SELECT COALESCE(SUM(points_delta), 0)::int AS total
     FROM reputation_events
     WHERE user_id = $1
       AND reason_code = 'UPVOTE_RECEIVED'
       AND (occurred_at::date = CURRENT_DATE)`,
    [userId]
  );
  return r.rows[0].total;
}

/**
 * Recompute user_levels row from sum(reputation_events) and level_definitions.
 */
async function recalculateUserLevel(client, userId) {
  const total = await getTotalPoints(client, userId);

  const levels = await client.query(
    `SELECT id, level_number, level_name, min_points
     FROM level_definitions
     ORDER BY min_points ASC`
  );
  const rows = levels.rows;
  if (!rows.length) return;

  const { currentLevelId, progressPercent, current, next } = computeLevelProgress(total, rows);

  await client.query(
    `INSERT INTO user_levels (user_id, current_level_id, total_points, progress_percent, last_recalculated_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       current_level_id = EXCLUDED.current_level_id,
       total_points = EXCLUDED.total_points,
       progress_percent = EXCLUDED.progress_percent,
       last_recalculated_at = NOW(),
       updated_at = NOW()`,
    [userId, currentLevelId, total, progressPercent]
  );

  return {
    totalPoints: total,
    currentLevel: current,
    progressPercent,
    nextLevel: next || null,
  };
}

async function insertReputationEvent(client, params) {
  const {
    userId,
    eventType,
    reasonCode,
    pointsDelta,
    sourceEntityType,
    sourceEntityId,
    metadata = {},
  } = params;

  await client.query(
    `INSERT INTO reputation_events
      (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      userId,
      eventType,
      reasonCode,
      pointsDelta,
      sourceEntityType,
      sourceEntityId == null ? null : String(sourceEntityId),
      metadata,
    ]
  );

  const level = await recalculateUserLevel(client, userId);
  await maybeAutoBadges(client, userId);
  return level;
}

async function maybeAutoBadges(client, userId) {
  const total = await getTotalPoints(client, userId);
  const badgeCodes = [];
  if (total >= 200) badgeCodes.push("RESOLUTION_SPECIALIST");
  if (total >= 50) badgeCodes.push("FAST_RESPONDER");

  for (const code of badgeCodes) {
    const b = await client.query(`SELECT id FROM badges WHERE code = $1 AND is_active = TRUE`, [code]);
    if (!b.rows[0]) continue;
    await client.query(
      `INSERT INTO user_badges (user_id, badge_id, evidence)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, badge_id) DO UPDATE SET
         evidence = EXCLUDED.evidence,
         awarded_at = NOW()`,
      [userId, b.rows[0].id, JSON.stringify({ auto: true, totalPoints: total })]
    );
  }
}

module.exports = {
  UPVOTE_POINTS_PER_VOTE,
  UPVOTE_AUTHOR_DAILY_CAP,
  TICKET_RESOLVED_POINTS,
  ACCEPTED_ANSWER_AUTHOR_POINTS,
  computeLevelProgress,
  getTotalPoints,
  getUpvotePointsAwardedToday,
  recalculateUserLevel,
  insertReputationEvent,
  maybeAutoBadges,
};
