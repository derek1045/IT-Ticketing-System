const { createAttachDbUser } = require("./middleware/attachDbUser");
const {
  authenticate,
  signToken,
  requireAuth,
  requireRoles,
} = require("./auth");
const reputation = require("./reputation");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function registerHttpRoutes(app, pool) {
  const attachDbUser = createAttachDbUser(pool);

  app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = authenticate(String(username), String(password));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    try {
      const row = await pool.query(
        `SELECT id, username, role, display_name FROM users WHERE username = $1 AND is_active = TRUE`,
        [user.username]
      );
      if (row.rows.length === 0) {
        return res.status(500).json({ error: "User directory not initialized" });
      }
      const db = row.rows[0];
      const token = signToken({
        userId: db.id,
        username: db.username,
        role: db.role,
      });
      res.json({
        token,
        user: {
          id: db.id,
          username: db.username,
          role: db.role,
          displayName: db.display_name,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/auth/me", requireAuth, attachDbUser, (req, res) => {
    const u = req.dbUser;
    res.json({
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.display_name,
      email: u.email,
      bio: u.bio,
      avatarUrl: u.avatar_url,
    });
  });

  app.get("/badges", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, code, name, description, category, criteria, is_active
         FROM badges WHERE is_active = TRUE ORDER BY category, name`
      );
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load badges" });
    }
  });

  app.get("/levels", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, level_number, level_name, min_points, description
         FROM level_definitions ORDER BY min_points ASC`
      );
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load levels" });
    }
  });

  app.get("/profiles/:userId", requireAuth, attachDbUser, async (req, res) => {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {
      const u = await pool.query(
        `SELECT id, username, role, display_name, email, bio, avatar_url, created_at
         FROM users WHERE id = $1 AND is_active = TRUE`,
        [userId]
      );
      if (u.rows.length === 0) return res.status(404).json({ error: "Profile not found" });

      const lvl = await pool.query(
        `SELECT ul.total_points, ul.progress_percent, ld.level_number, ld.level_name, ld.min_points
         FROM user_levels ul
         JOIN level_definitions ld ON ld.id = ul.current_level_id
         WHERE ul.user_id = $1`,
        [userId]
      );

      const badges = await pool.query(
        `SELECT b.code, b.name, b.description, b.category, ub.awarded_at, ub.evidence
         FROM user_badges ub
         JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = $1
         ORDER BY ub.awarded_at DESC`,
        [userId]
      );

      res.json({
        user: u.rows[0],
        level: lvl.rows[0] || null,
        badges: badges.rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  app.get("/profiles/:userId/metrics", requireAuth, attachDbUser, async (req, res) => {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.range || "30").replace(/\D/g, ""), 10) || 30));
    try {
      const r = await pool.query(
        `SELECT metric_date, tickets_assigned, tickets_resolved, tickets_reopened,
              first_response_avg_seconds, resolution_avg_seconds, completion_rate, reopen_rate, sla_breaches
       FROM support_metrics_daily
       WHERE user_id = $1 AND metric_date >= (CURRENT_DATE - ($2::int) * INTERVAL '1 day')
       ORDER BY metric_date ASC`,
        [userId, days]
      );
      res.json({ rangeDays: days, series: r.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load metrics" });
    }
  });

  app.get("/profiles/:userId/badges", requireAuth, attachDbUser, async (req, res) => {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {
      const r = await pool.query(
        `SELECT b.id, b.code, b.name, b.description, b.category, ub.awarded_at, ub.evidence
         FROM user_badges ub
         JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = $1
         ORDER BY ub.awarded_at DESC`,
        [userId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load user badges" });
    }
  });

  app.get("/profiles/:userId/reputation", requireAuth, attachDbUser, async (req, res) => {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {
      const total = await reputation.getTotalPoints(pool, userId);
      const hist = await pool.query(
        `SELECT id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata
         FROM reputation_events
         WHERE user_id = $1
         ORDER BY occurred_at DESC
         LIMIT 100`,
        [userId]
      );
      res.json({ totalPoints: total, events: hist.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load reputation" });
    }
  });

  app.get("/profiles/:userId/level", requireAuth, attachDbUser, async (req, res) => {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    try {
      const r = await pool.query(
        `SELECT ul.total_points, ul.progress_percent, ul.last_recalculated_at,
                ld.level_number, ld.level_name, ld.min_points
         FROM user_levels ul
         JOIN level_definitions ld ON ld.id = ul.current_level_id
         WHERE ul.user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Level state not found" });
      res.json(r.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load level" });
    }
  });

  async function ensureThreadForTicket(client, ticketId, createdById) {
    const existing = await client.query(
      `SELECT * FROM ticket_threads WHERE ticket_id = $1`,
      [ticketId]
    );
    if (existing.rows.length) return existing.rows[0];
    const ins = await client.query(
      `INSERT INTO ticket_threads (ticket_id, created_by, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ticketId, createdById, `Discussion for ticket #${ticketId}`]
    );
    return ins.rows[0];
  }

  app.get("/tickets/:ticketId/thread", requireAuth, attachDbUser, async (req, res) => {
    const ticketId = parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket id" });
    const viewer = req.dbUser;
    const isStaff = viewer.role === "technician" || viewer.role === "admin";
    try {
      const t = await pool.query(`SELECT id FROM tickets WHERE id = $1`, [ticketId]);
      if (t.rows.length === 0) return res.status(404).json({ error: "Ticket not found" });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const thread = await ensureThreadForTicket(client, ticketId, viewer.id);
        const messages = await client.query(
          `SELECT m.*,
            (SELECT COUNT(*)::int FROM message_votes v WHERE v.message_id = m.id) AS upvote_count,
            EXISTS(SELECT 1 FROM message_votes v2 WHERE v2.message_id = m.id AND v2.voter_user_id = $2) AS viewer_has_upvoted
           FROM thread_messages m
           WHERE m.thread_id = $1
           ${isStaff ? "" : "AND (m.visibility = 'public')"}
           ORDER BY m.created_at ASC`,
          [thread.id, viewer.id]
        );
        const accepted = await client.query(
          `SELECT * FROM accepted_solutions WHERE ticket_id = $1`,
          [ticketId]
        );
        await client.query("COMMIT");
        res.json({
          thread,
          messages: messages.rows,
          acceptedSolution: accepted.rows[0] || null,
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load thread" });
    }
  });

  app.post("/tickets/:ticketId/thread/messages", requireAuth, attachDbUser, async (req, res) => {
    const ticketId = parseInt(req.params.ticketId, 10);
    if (Number.isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket id" });
    const { messageType, visibility, body, parentMessageId } = req.body || {};
    if (!body || !messageType) {
      return res.status(400).json({ error: "messageType and body are required" });
    }
    if (!["comment", "answer"].includes(messageType)) {
      return res.status(400).json({ error: "Invalid messageType" });
    }
    const vis = visibility || "public";
    if (!["public", "internal"].includes(vis)) {
      return res.status(400).json({ error: "Invalid visibility" });
    }
    const viewer = req.dbUser;
    const isStaff = viewer.role === "technician" || viewer.role === "admin";
    if (vis === "internal" && !isStaff) {
      return res.status(403).json({ error: "Only staff can post internal messages" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = await client.query(`SELECT id FROM tickets WHERE id = $1`, [ticketId]);
      if (t.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ticket not found" });
      }
      const thread = await ensureThreadForTicket(client, ticketId, viewer.id);
      const ins = await client.query(
        `INSERT INTO thread_messages (thread_id, author_user_id, parent_message_id, message_type, visibility, body)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [thread.id, viewer.id, parentMessageId || null, messageType, vis, String(body)]
      );
      await client.query("COMMIT");
      res.status(201).json(ins.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(err);
      res.status(500).json({ error: "Failed to post message" });
    } finally {
      client.release();
    }
  });

  app.post("/thread/messages/:messageId/upvote", requireAuth, attachDbUser, async (req, res) => {
    const { messageId } = req.params;
    if (!UUID_RE.test(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const voter = req.dbUser;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const msg = await client.query(
        `SELECT m.*, t.ticket_id
         FROM thread_messages m
         JOIN ticket_threads t ON t.id = m.thread_id
         WHERE m.id = $1`,
        [messageId]
      );
      if (msg.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Message not found" });
      }
      const row = msg.rows[0];
      if (row.author_user_id === voter.id) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cannot upvote your own message" });
      }
      const ins = await client.query(
        `INSERT INTO message_votes (message_id, voter_user_id, vote_type)
         VALUES ($1, $2, 'upvote')
         ON CONFLICT (message_id, voter_user_id) DO NOTHING
         RETURNING id`,
        [messageId, voter.id]
      );
      if (ins.rows.length === 0) {
        await client.query("COMMIT");
        return res.json({ ok: true, awarded: false, reason: "already_voted" });
      }
      const todayAwarded = await reputation.getUpvotePointsAwardedToday(client, row.author_user_id);
      let awarded = false;
      if (todayAwarded < reputation.UPVOTE_AUTHOR_DAILY_CAP) {
        await reputation.insertReputationEvent(client, {
          userId: row.author_user_id,
          eventType: "positive",
          reasonCode: "UPVOTE_RECEIVED",
          pointsDelta: reputation.UPVOTE_POINTS_PER_VOTE,
          sourceEntityType: "vote",
          sourceEntityId: ins.rows[0]?.id || messageId,
          metadata: { messageId, voterId: voter.id },
        });
        awarded = true;
      }
      await client.query("COMMIT");
      res.json({ ok: true, awarded });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(err);
      res.status(500).json({ error: "Failed to upvote" });
    } finally {
      client.release();
    }
  });

  app.delete("/thread/messages/:messageId/upvote", requireAuth, attachDbUser, async (req, res) => {
    const { messageId } = req.params;
    if (!UUID_RE.test(messageId)) return res.status(400).json({ error: "Invalid message id" });
    try {
      await pool.query(
        `DELETE FROM message_votes WHERE message_id = $1 AND voter_user_id = $2`,
        [messageId, req.dbUser.id]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to remove upvote" });
    }
  });

  app.post(
    "/thread/messages/:messageId/accept",
    requireAuth,
    requireRoles("technician", "admin"),
    attachDbUser,
    async (req, res) => {
      const { messageId } = req.params;
      if (!UUID_RE.test(messageId)) return res.status(400).json({ error: "Invalid message id" });
      const accepter = req.dbUser;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const msg = await client.query(
          `SELECT m.*, t.id AS thread_id, t.ticket_id
           FROM thread_messages m
           JOIN ticket_threads t ON t.id = m.thread_id
           WHERE m.id = $1`,
          [messageId]
        );
        if (msg.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Message not found" });
        }
        const m = msg.rows[0];
        if (m.message_type !== "answer") {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Only answers can be accepted" });
        }
        await client.query(
          `INSERT INTO accepted_solutions (ticket_id, thread_id, message_id, accepted_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ticket_id) DO UPDATE SET
             message_id = EXCLUDED.message_id,
             thread_id = EXCLUDED.thread_id,
             accepted_by = EXCLUDED.accepted_by,
             accepted_at = NOW()`,
          [m.ticket_id, m.thread_id, messageId, accepter.id]
        );
        await reputation.insertReputationEvent(client, {
          userId: m.author_user_id,
          eventType: "positive",
          reasonCode: "ANSWER_ACCEPTED",
          pointsDelta: reputation.ACCEPTED_ANSWER_AUTHOR_POINTS,
          sourceEntityType: "thread_message",
          sourceEntityId: messageId,
          metadata: { ticketId: m.ticket_id, acceptedBy: accepter.id },
        });
        const acceptedCount = await client.query(
          `SELECT COUNT(*)::int AS c FROM accepted_solutions ac
           JOIN thread_messages tm ON tm.id = ac.message_id
           WHERE tm.author_user_id = $1`,
          [m.author_user_id]
        );
        const c = acceptedCount.rows[0].c;
        if (c >= 3) {
          const b = await client.query(`SELECT id FROM badges WHERE code = 'KNOWLEDGE_CONTRIBUTOR'`);
          if (b.rows[0]) {
            await client.query(
              `INSERT INTO user_badges (user_id, badge_id, evidence)
               VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (user_id, badge_id) DO UPDATE SET evidence = EXCLUDED.evidence, awarded_at = NOW()`,
              [m.author_user_id, b.rows[0].id, JSON.stringify({ acceptedAnswers: c })]
            );
          }
        }
        await client.query("COMMIT");
        res.json({ ok: true });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(err);
        res.status(500).json({ error: "Failed to accept solution" });
      } finally {
        client.release();
      }
    }
  );

  app.get("/health", async (req, res) => {
    try {
      const result = await pool.query("SELECT NOW()");
      res.json({
        status: "ok",
        time: result.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database connection failed" });
    }
  });

  app.get("/tickets", requireAuth, attachDbUser, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM tickets ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/tickets/:id", requireAuth, attachDbUser, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM tickets WHERE id = $1",
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.post("/tickets", requireAuth, attachDbUser, async (req, res) => {
    const {
      title,
      description,
      priority,
      category,
      impact,
      deviceType,
      deviceIdentifier,
      operatingSystem,
      location,
      stepsToReproduce,
      additionalNotes,
      contactName,
      contactEmail,
      contactPhone,
      preferredContactMethod,
      bestContactTime,
    } = req.body || {};
    if (!title || !description || !priority) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const norm = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim());
    const email = norm(contactEmail);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid contact email" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO tickets
          (title, description, priority, category, impact,
           device_type, device_identifier, operating_system, location,
           steps_to_reproduce, additional_notes,
           contact_name, contact_email, contact_phone,
           preferred_contact_method, best_contact_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          title,
          description,
          priority,
          norm(category),
          norm(impact),
          norm(deviceType),
          norm(deviceIdentifier),
          norm(operatingSystem),
          norm(location),
          norm(stepsToReproduce),
          norm(additionalNotes),
          norm(contactName),
          email,
          norm(contactPhone),
          norm(preferredContactMethod),
          norm(bestContactTime),
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.put(
    "/tickets/:id",
    requireAuth,
    requireRoles("technician", "admin"),
    attachDbUser,
    async (req, res) => {
      const { id } = req.params;
      const { status, priority, note } = req.body || {};
      const VALID_STATUS = ["Open", "In Progress", "Closed"];
      const VALID_PRIORITY = ["Low", "Medium", "High"];
      if (status != null && !VALID_STATUS.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      if (priority != null && !VALID_PRIORITY.includes(priority)) {
        return res.status(400).json({ error: "Invalid priority" });
      }
      if (status == null && priority == null) {
        return res.status(400).json({ error: "Provide status or priority" });
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const prev = await client.query(
          `SELECT status, priority FROM tickets WHERE id = $1`,
          [id]
        );
        if (prev.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Ticket not found" });
        }
        const fromStatus = prev.rows[0].status;
        const fromPriority = prev.rows[0].priority;
        const nextStatus = status ?? fromStatus;
        const nextPriority = priority ?? fromPriority;

        const result = await client.query(
          "UPDATE tickets SET status = $1, priority = $2 WHERE id = $3 RETURNING *",
          [nextStatus, nextPriority, id]
        );
        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Ticket not found" });
        }

        if (fromStatus !== nextStatus || fromPriority !== nextPriority) {
          await client.query(
            `INSERT INTO ticket_status_history
              (ticket_id, changed_by, from_status, to_status, from_priority, to_priority, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              req.dbUser.id,
              fromStatus,
              nextStatus,
              fromPriority,
              nextPriority,
              note ? String(note).trim() || null : null,
            ]
          );
        }

        const wasClosed = String(fromStatus) === "Closed";
        const nowClosed = String(nextStatus) === "Closed";
        if (nowClosed && !wasClosed) {
          await reputation.insertReputationEvent(client, {
            userId: req.dbUser.id,
            eventType: "positive",
            reasonCode: "TICKET_RESOLVED",
            pointsDelta: reputation.TICKET_RESOLVED_POINTS,
            sourceEntityType: "ticket",
            sourceEntityId: id,
            metadata: {},
          });
        }
        await client.query("COMMIT");
        res.json(result.rows[0]);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(err);
        res.status(500).json({ error: "Failed to update ticket" });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/tickets/:id/notes",
    requireAuth,
    attachDbUser,
    async (req, res) => {
      const ticketId = parseInt(req.params.id, 10);
      if (Number.isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket id" });
      }
      const isStaff =
        req.dbUser.role === "technician" || req.dbUser.role === "admin";
      try {
        const t = await pool.query(`SELECT id FROM tickets WHERE id = $1`, [ticketId]);
        if (t.rows.length === 0) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        const result = await pool.query(
          `SELECT n.id, n.ticket_id, n.author_user_id, n.body,
                  n.visibility, n.is_pinned, n.created_at, n.updated_at,
                  u.username AS author_username, u.display_name AS author_display_name,
                  u.role AS author_role
             FROM ticket_notes n
             JOIN users u ON u.id = n.author_user_id
            WHERE n.ticket_id = $1
              ${isStaff ? "" : "AND n.visibility = 'public'"}
            ORDER BY n.is_pinned DESC, n.created_at DESC`,
          [ticketId]
        );
        res.json(result.rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load notes" });
      }
    }
  );

  app.post(
    "/tickets/:id/notes",
    requireAuth,
    attachDbUser,
    async (req, res) => {
      const ticketId = parseInt(req.params.id, 10);
      if (Number.isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket id" });
      }
      const { body, visibility, isPinned } = req.body || {};
      if (!body || !String(body).trim()) {
        return res.status(400).json({ error: "Note body is required" });
      }
      const isStaff =
        req.dbUser.role === "technician" || req.dbUser.role === "admin";
      const vis = visibility || (isStaff ? "internal" : "public");
      if (!["public", "internal"].includes(vis)) {
        return res.status(400).json({ error: "Invalid visibility" });
      }
      if (vis === "internal" && !isStaff) {
        return res.status(403).json({ error: "Only staff can add internal notes" });
      }
      const pinned = Boolean(isPinned) && isStaff;
      try {
        const t = await pool.query(`SELECT id FROM tickets WHERE id = $1`, [ticketId]);
        if (t.rows.length === 0) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        const ins = await pool.query(
          `INSERT INTO ticket_notes (ticket_id, author_user_id, body, visibility, is_pinned)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, ticket_id, author_user_id, body, visibility, is_pinned, created_at, updated_at`,
          [ticketId, req.dbUser.id, String(body).trim(), vis, pinned]
        );
        const row = ins.rows[0];
        res.status(201).json({
          ...row,
          author_username: req.dbUser.username,
          author_display_name: req.dbUser.display_name,
          author_role: req.dbUser.role,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add note" });
      }
    }
  );

  app.patch(
    "/tickets/:ticketId/notes/:noteId",
    requireAuth,
    attachDbUser,
    async (req, res) => {
      const ticketId = parseInt(req.params.ticketId, 10);
      const noteId = req.params.noteId;
      if (Number.isNaN(ticketId) || !UUID_RE.test(noteId)) {
        return res.status(400).json({ error: "Invalid ids" });
      }
      const { body, isPinned } = req.body || {};
      const isStaff =
        req.dbUser.role === "technician" || req.dbUser.role === "admin";
      try {
        const existing = await pool.query(
          `SELECT * FROM ticket_notes WHERE id = $1 AND ticket_id = $2`,
          [noteId, ticketId]
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Note not found" });
        }
        const note = existing.rows[0];
        const isAuthor = note.author_user_id === req.dbUser.id;
        if (!isAuthor && !isStaff) {
          return res.status(403).json({ error: "Cannot edit this note" });
        }
        const updates = [];
        const params = [];
        if (typeof body === "string" && body.trim()) {
          params.push(body.trim());
          updates.push(`body = $${params.length}`);
        }
        if (typeof isPinned === "boolean" && isStaff) {
          params.push(isPinned);
          updates.push(`is_pinned = $${params.length}`);
        }
        if (updates.length === 0) {
          return res.status(400).json({ error: "Nothing to update" });
        }
        updates.push(`updated_at = NOW()`);
        params.push(noteId);
        const result = await pool.query(
          `UPDATE ticket_notes SET ${updates.join(", ")}
            WHERE id = $${params.length}
           RETURNING *`,
          params
        );
        res.json(result.rows[0]);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update note" });
      }
    }
  );

  app.delete(
    "/tickets/:ticketId/notes/:noteId",
    requireAuth,
    attachDbUser,
    async (req, res) => {
      const ticketId = parseInt(req.params.ticketId, 10);
      const noteId = req.params.noteId;
      if (Number.isNaN(ticketId) || !UUID_RE.test(noteId)) {
        return res.status(400).json({ error: "Invalid ids" });
      }
      const isStaff =
        req.dbUser.role === "technician" || req.dbUser.role === "admin";
      try {
        const existing = await pool.query(
          `SELECT author_user_id FROM ticket_notes WHERE id = $1 AND ticket_id = $2`,
          [noteId, ticketId]
        );
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: "Note not found" });
        }
        const isAuthor = existing.rows[0].author_user_id === req.dbUser.id;
        if (!isAuthor && !isStaff) {
          return res.status(403).json({ error: "Cannot delete this note" });
        }
        await pool.query(`DELETE FROM ticket_notes WHERE id = $1`, [noteId]);
        res.json({ ok: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete note" });
      }
    }
  );

  app.get(
    "/tickets/:id/status-history",
    requireAuth,
    attachDbUser,
    async (req, res) => {
      const ticketId = parseInt(req.params.id, 10);
      if (Number.isNaN(ticketId)) {
        return res.status(400).json({ error: "Invalid ticket id" });
      }
      try {
        const result = await pool.query(
          `SELECT h.id, h.from_status, h.to_status, h.from_priority, h.to_priority,
                  h.note, h.changed_at,
                  u.username AS changed_by_username, u.display_name AS changed_by_display_name
             FROM ticket_status_history h
             JOIN users u ON u.id = h.changed_by
            WHERE h.ticket_id = $1
            ORDER BY h.changed_at DESC
            LIMIT 50`,
          [ticketId]
        );
        res.json(result.rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load history" });
      }
    }
  );

  app.delete(
    "/tickets/:id",
    requireAuth,
    requireRoles("admin"),
    attachDbUser,
    async (req, res) => {
      const { id } = req.params;
      try {
        const result = await pool.query(
          "DELETE FROM tickets WHERE id = $1 RETURNING id",
          [id]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Ticket not found" });
        }
        res.json({ message: "Ticket deleted" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete ticket" });
      }
    }
  );
}

module.exports = { registerHttpRoutes };
