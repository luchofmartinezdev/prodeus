-- Composite index for predictions(user_id, group_id) — used by:
--   1. score-match Edge Function: batch-fetch all points per (user, group) pair
--   2. ranking.repository: getUserHistory(userId, groupId)
--   3. prediction.repository: getByGroup with user filter
CREATE INDEX IF NOT EXISTS predictions_user_group_idx
  ON predictions(user_id, group_id);

-- Partial composite index only on rows with earned points — used by:
--   score-match: sum of earned points for score recalculation
CREATE INDEX IF NOT EXISTS predictions_user_group_earned_idx
  ON predictions(user_id, group_id)
  WHERE points_earned IS NOT NULL;

-- Composite index for scores(group_id, total_points DESC) — used by:
--   ranking.repository: getGroupRanking sorted by points within a group
CREATE INDEX IF NOT EXISTS scores_group_points_idx
  ON scores(group_id, total_points DESC);
