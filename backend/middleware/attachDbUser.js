/**
 * Resolves JWT identity to a row in `users` (provisioned at schema seed).
 */
function createAttachDbUser(pool) {
  return async function attachDbUser(req, res, next) {
    if (!req.user?.username) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const result = await pool.query(
        `SELECT id, username, role, display_name, email, bio, avatar_url, created_at
         FROM users WHERE username = $1 AND is_active = TRUE`,
        [req.user.username]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "User account not provisioned" });
      }
      req.dbUser = result.rows[0];
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to resolve user" });
    }
  };
}

module.exports = { createAttachDbUser };
