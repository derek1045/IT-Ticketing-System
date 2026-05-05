const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS device_identifier TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS operating_system TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS additional_notes TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS best_contact_time TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS best_contact_time TEXT;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL DEFAULT 'managed-by-demo-auth',
  role TEXT NOT NULL CHECK (role IN ('requester', 'technician', 'admin')),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  tickets_assigned INTEGER NOT NULL DEFAULT 0 CHECK (tickets_assigned >= 0),
  tickets_responded INTEGER NOT NULL DEFAULT 0 CHECK (tickets_responded >= 0),
  tickets_resolved INTEGER NOT NULL DEFAULT 0 CHECK (tickets_resolved >= 0),
  tickets_reopened INTEGER NOT NULL DEFAULT 0 CHECK (tickets_reopened >= 0),
  first_response_avg_seconds INTEGER CHECK (first_response_avg_seconds IS NULL OR first_response_avg_seconds >= 0),
  resolution_avg_seconds INTEGER CHECK (resolution_avg_seconds IS NULL OR resolution_avg_seconds >= 0),
  completion_rate NUMERIC(5,2) CHECK (completion_rate IS NULL OR (completion_rate >= 0 AND completion_rate <= 100)),
  reopen_rate NUMERIC(5,2) CHECK (reopen_rate IS NULL OR (reopen_rate >= 0 AND reopen_rate <= 100)),
  sla_breaches INTEGER NOT NULL DEFAULT 0 CHECK (sla_breaches >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'performance',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS ticket_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id)
);

CREATE TABLE IF NOT EXISTS thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES ticket_threads(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_message_id UUID REFERENCES thread_messages(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('comment', 'answer')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
  body TEXT NOT NULL,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_votes (
  id BIGSERIAL PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES thread_messages(id) ON DELETE CASCADE,
  voter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL DEFAULT 'upvote' CHECK (vote_type IN ('upvote')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, voter_user_id)
);

CREATE TABLE IF NOT EXISTS accepted_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES ticket_threads(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES thread_messages(id) ON DELETE CASCADE,
  accepted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id),
  UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('positive', 'negative')),
  reason_code TEXT NOT NULL,
  points_delta INTEGER NOT NULL,
  source_entity_type TEXT NOT NULL CHECK (
    source_entity_type IN ('ticket', 'thread_message', 'vote', 'badge', 'manual_adjustment', 'system')
  ),
  source_entity_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (
    (event_type = 'positive' AND points_delta > 0) OR
    (event_type = 'negative' AND points_delta < 0)
  )
);

CREATE TABLE IF NOT EXISTS level_definitions (
  id SERIAL PRIMARY KEY,
  level_number INTEGER NOT NULL UNIQUE CHECK (level_number > 0),
  level_name TEXT NOT NULL,
  min_points INTEGER NOT NULL UNIQUE CHECK (min_points >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_levels (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_level_id INTEGER NOT NULL REFERENCES level_definitions(id) ON DELETE RESTRICT,
  total_points INTEGER NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_recalculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_priority TEXT,
  to_priority TEXT,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'user_badges_user_id_badge_id_key'
       AND conrelid = 'user_badges'::regclass
  ) THEN
    ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_support_metrics_daily_user_date ON support_metrics_daily(user_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_created ON thread_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_votes_message ON message_votes(message_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_user_occurred ON reputation_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_notes_ticket_created ON ticket_notes(ticket_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket ON ticket_status_history(ticket_id, changed_at DESC);

INSERT INTO level_definitions (level_number, level_name, min_points, description)
VALUES
  (1, 'Associate Support Analyst', 0, 'Entry level contributor'),
  (2, 'Support Specialist', 200, 'Consistent support contributor'),
  (3, 'Senior Specialist', 600, 'High quality issue resolver'),
  (4, 'Incident Lead', 1200, 'Leads complex incident handling'),
  (5, 'Knowledge Mentor', 2000, 'Top quality mentor and contributor')
ON CONFLICT (level_number) DO NOTHING;
`;

const DEMO_USER_ROWS = [
  { username: "admin", role: "admin", display_name: "Admin User" },
  { username: "tech", role: "technician", display_name: "Technician" },
  { username: "user", role: "requester", display_name: "Requester" },
  {
    username: "demo",
    role: "technician",
    display_name: "Demo Showcase",
    bio: "Curated showcase account: busy queue, balanced resolutions, and an accepted Q&A solution.",
  },
];

const DEMO_BADGES = [
  {
    code: "FAST_RESPONDER",
    name: "Fast Responder",
    description: "Consistently responds within SLA targets.",
    category: "performance",
    criteria: { minMedianFirstResponseSeconds: 900 },
  },
  {
    code: "RESOLUTION_SPECIALIST",
    name: "Resolution Specialist",
    description: "High rate of first-touch resolution without escalation.",
    category: "quality",
    criteria: { minCompletionRate: 85 },
  },
  {
    code: "KNOWLEDGE_CONTRIBUTOR",
    name: "Knowledge Contributor",
    description: "Provides accepted solutions in Q&A threads.",
    category: "knowledge",
    criteria: { minAcceptedAnswers: 3 },
  },
];

async function initializeSchema(pool) {
  await pool.query(SCHEMA_SQL);
}

async function seedDemoData(pool) {
  for (const u of DEMO_USER_ROWS) {
    await pool.query(
      `INSERT INTO users (username, email, role, display_name, bio, password_hash)
       VALUES ($1, $2, $3, $4, $5, 'managed-by-demo-auth')
       ON CONFLICT (username) DO UPDATE SET
         role = EXCLUDED.role,
         display_name = EXCLUDED.display_name,
         bio = COALESCE(EXCLUDED.bio, users.bio),
         password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
         updated_at = NOW()`,
      [u.username, `${u.username}@demo.local`, u.role, u.display_name, u.bio || null]
    );
  }

  for (const b of DEMO_BADGES) {
    await pool.query(
      `INSERT INTO badges (code, name, description, category, criteria)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         criteria = EXCLUDED.criteria,
         updated_at = NOW()`,
      [b.code, b.name, b.description, b.category, JSON.stringify(b.criteria)]
    );
  }

  const users = await pool.query(`SELECT id, username FROM users WHERE username = ANY($1)`, [
    DEMO_USER_ROWS.map((u) => u.username),
  ]);
  const byName = Object.fromEntries(users.rows.map((r) => [r.username, r.id]));

  const level1 = await pool.query(
    `SELECT id FROM level_definitions WHERE level_number = 1 LIMIT 1`
  );
  const level1Id = level1.rows[0]?.id;
  if (!level1Id) return;

  for (const id of Object.values(byName)) {
    await pool.query(
      `INSERT INTO user_levels (user_id, current_level_id, total_points, progress_percent)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, level1Id]
    );
  }

  const techId = byName.tech;
  if (techId) {
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO support_metrics_daily
        (user_id, metric_date, tickets_assigned, tickets_responded, tickets_resolved, tickets_reopened,
         first_response_avg_seconds, resolution_avg_seconds, completion_rate, reopen_rate, sla_breaches)
       VALUES ($1, $2::date, 6, 6, 5, 1, 480, 7200, 83.3, 16.7, 0)
       ON CONFLICT (user_id, metric_date) DO UPDATE SET
         tickets_assigned = EXCLUDED.tickets_assigned,
         tickets_resolved = EXCLUDED.tickets_resolved,
         completion_rate = EXCLUDED.completion_rate,
         reopen_rate = EXCLUDED.reopen_rate,
         updated_at = NOW()`,
      [techId, today]
    );
  }

  await seedDemoShowcase(pool, byName);
}

const DEMO_TICKETS = [
  {
    title: "Outlook crashes opening shared calendar",
    description:
      "Outlook freezes for ~30 seconds then crashes whenever I open the Finance shared calendar. Reproducible on every launch today.",
    priority: "High",
    status: "In Progress",
    category: "Software",
    impact: "A small team",
    device_type: "Laptop",
    device_identifier: "LAP-09283",
    operating_system: "Windows 11 23H2",
    location: "HQ Floor 3 — Desk 42",
    steps_to_reproduce:
      "1. Open Outlook\n2. Navigate to Calendars\n3. Click Finance shared calendar\n4. Outlook hangs, then crashes",
    additional_notes: "Already tried running Outlook in safe mode — same crash.",
  },
  {
    title: "Printer HP-CORP-07 stuck in offline state",
    description: "Third-floor printer shows offline for all users even after power cycle.",
    priority: "Medium",
    status: "Open",
    category: "Hardware",
    impact: "A whole department",
    device_type: "Printer",
    device_identifier: "HP-CORP-07",
    operating_system: "Network device",
    location: "HQ Floor 3 — Print room",
    steps_to_reproduce: "1. Print any doc\n2. Job queues, never sends\n3. Printer LCD reads 'Ready'",
    additional_notes: "Cable and IP look correct; possibly driver queue issue.",
  },
  {
    title: "Cannot connect to corporate VPN from home",
    description:
      "Getting 'Authentication failed' after MFA prompt. Other remote colleagues can connect.",
    priority: "High",
    status: "Open",
    category: "Network",
    impact: "Just me",
    device_type: "Laptop",
    device_identifier: "LAP-11420",
    operating_system: "macOS 14.5",
    location: "Remote — Home office",
    steps_to_reproduce: "1. Launch VPN client\n2. Enter credentials\n3. Approve MFA push\n4. 'Authentication failed'",
    additional_notes: "Password works on the web portal.",
  },
  {
    title: "New hire needs Salesforce access",
    description: "Provision Salesforce Sales Cloud access for new AE starting Monday.",
    priority: "Low",
    status: "Closed",
    category: "Access / Account",
    impact: "Just me",
    device_type: "Laptop",
    device_identifier: "LAP-12901",
    operating_system: "Windows 11 23H2",
    location: "HQ Floor 2 — Sales bay",
    additional_notes: "Resolved: license assigned, SSO verified, welcome email sent.",
  },
  {
    title: "Laptop battery drains in under 2 hours",
    description: "Battery hits 20% within 2 hours of idle use. Was fine last month.",
    priority: "Medium",
    status: "In Progress",
    category: "Hardware",
    impact: "Just me",
    device_type: "Laptop",
    device_identifier: "LAP-08842",
    operating_system: "Windows 11 22H2",
    location: "HQ Floor 1 — Engineering",
    steps_to_reproduce: "1. Unplug laptop at 100%\n2. Light browsing\n3. Battery at 20% within ~110 minutes",
    additional_notes: "Battery health report attached to this ticket.",
  },
  {
    title: "Company Wi-Fi intermittently disconnecting",
    description: "Wi-Fi drops for 5–10 seconds several times per hour on the 5 GHz SSID.",
    priority: "High",
    status: "Closed",
    category: "Network",
    impact: "A whole department",
    device_type: "Network device",
    operating_system: "Network device",
    location: "HQ Floor 4 — Design team",
    additional_notes: "Resolved: AP replaced and firmware updated.",
  },
  {
    title: "Phishing email reported from 'finance-alerts@...'",
    description:
      "Suspicious email impersonating CFO requesting urgent wire transfer. Header shows spoofed domain.",
    priority: "High",
    status: "Closed",
    category: "Security",
    impact: "Organization-wide",
    device_type: "Phone",
    device_identifier: "IPH-0094",
    operating_system: "iOS 18.2",
    location: "Remote",
    additional_notes: "Resolved: blocked sender, quarantined mailbox, alert sent to all staff.",
  },
  {
    title: "Zoom audio echoes during meetings",
    description: "Participants hear a strong echo when I speak in conference room B.",
    priority: "Low",
    status: "Open",
    category: "Software",
    impact: "A small team",
    device_type: "Desktop",
    device_identifier: "CONF-ROOMB-01",
    operating_system: "Windows 11 23H2",
    location: "HQ Floor 2 — Conference Room B",
    steps_to_reproduce: "1. Join any Zoom meeting\n2. Speak into room mic\n3. Participants hear echo",
    additional_notes: "Only happens in this room; Conference Room A is fine.",
  },
  {
    title: "Monitor flickers on dock disconnect",
    description:
      "External monitor flickers and goes black for ~3s when undocking. Picture returns on its own.",
    priority: "Low",
    status: "Closed",
    category: "Hardware",
    impact: "Just me",
    device_type: "Laptop",
    device_identifier: "LAP-09283",
    operating_system: "Windows 11 23H2",
    location: "HQ Floor 3 — Desk 42",
    additional_notes: "Resolved: dock firmware updated via WSUS.",
  },
  {
    title: "How do I enable hardware keys for SSO?",
    description:
      "Looking for steps to register a YubiKey for corporate SSO and whether backup codes are still needed.",
    priority: "Low",
    status: "In Progress",
    category: "Security",
    impact: "Just me",
    device_type: "Laptop",
    device_identifier: "LAP-14402",
    operating_system: "macOS 14.5",
    location: "HQ Floor 2 — Marketing",
    additional_notes: "This will be the ticket used to show the accepted-solution flow.",
  },
  {
    title: "Shared drive 'ProjectX' read-only for my account",
    description: "I can open files in ProjectX but every save fails with 'permission denied'.",
    priority: "Medium",
    status: "Open",
    category: "Access / Account",
    impact: "A small team",
    device_type: "Laptop",
    device_identifier: "LAP-13701",
    operating_system: "Windows 11 23H2",
    location: "HQ Floor 3 — PM pod",
    additional_notes: "Others on the team can save fine.",
  },
  {
    title: "Server backup job failed overnight",
    description: "Backup job on SRV-DB-02 reports 'insufficient space' on target NAS.",
    priority: "High",
    status: "In Progress",
    category: "Hardware",
    impact: "Organization-wide",
    device_type: "Server",
    device_identifier: "SRV-DB-02",
    operating_system: "Ubuntu 22.04 LTS",
    location: "Datacenter Rack R2",
    steps_to_reproduce: "Nightly backup job runs at 01:30; fails at 02:12 with SPACE_FULL.",
    additional_notes: "NAS at 94% capacity; evaluating cleanup vs. expansion.",
  },
];

async function seedDemoShowcase(pool, byName) {
  const demoId = byName.demo;
  if (!demoId) return;

  const marker = await pool.query(
    `SELECT 1 FROM reputation_events WHERE user_id = $1 AND reason_code = 'DEMO_SEED_V1' LIMIT 1`,
    [demoId]
  );
  if (marker.rows.length > 0) {
    return;
  }

  const ticketIds = [];
  for (const t of DEMO_TICKETS) {
    const row = await pool.query(
      `INSERT INTO tickets
        (title, description, priority, status, category, impact,
         device_type, device_identifier, operating_system, location,
         steps_to_reproduce, additional_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        t.title,
        t.description,
        t.priority,
        t.status || "Open",
        t.category || null,
        t.impact || null,
        t.device_type || null,
        t.device_identifier || null,
        t.operating_system || null,
        t.location || null,
        t.steps_to_reproduce || null,
        t.additional_notes || null,
      ]
    );
    ticketIds.push({ id: row.rows[0].id, ...t });
  }

  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const assigned = weekend ? 2 : 5 + (i % 3);
    const resolved = weekend ? 1 : Math.max(3, assigned - 1);
    const reopened = i % 7 === 0 ? 1 : 0;
    const firstResponseSec = 480 + (i % 4) * 90;
    const resolutionSec = 5400 + (i % 5) * 1200;
    const completionRate = Math.round((resolved / assigned) * 1000) / 10;
    const reopenRate = Math.round((reopened / Math.max(resolved, 1)) * 1000) / 10;
    const sla = i % 6 === 0 ? 1 : 0;

    await pool.query(
      `INSERT INTO support_metrics_daily
        (user_id, metric_date, tickets_assigned, tickets_responded, tickets_resolved, tickets_reopened,
         first_response_avg_seconds, resolution_avg_seconds, completion_rate, reopen_rate, sla_breaches)
       VALUES ($1,$2::date,$3,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id, metric_date) DO UPDATE SET
         tickets_assigned = EXCLUDED.tickets_assigned,
         tickets_responded = EXCLUDED.tickets_responded,
         tickets_resolved = EXCLUDED.tickets_resolved,
         tickets_reopened = EXCLUDED.tickets_reopened,
         first_response_avg_seconds = EXCLUDED.first_response_avg_seconds,
         resolution_avg_seconds = EXCLUDED.resolution_avg_seconds,
         completion_rate = EXCLUDED.completion_rate,
         reopen_rate = EXCLUDED.reopen_rate,
         sla_breaches = EXCLUDED.sla_breaches,
         updated_at = NOW()`,
      [
        demoId,
        dateStr,
        assigned,
        resolved,
        reopened,
        firstResponseSec,
        resolutionSec,
        completionRate,
        reopenRate,
        sla,
      ]
    );
  }

  const closedTickets = ticketIds.filter((t) => t.status === "Closed");
  let daysAgo = 1;
  for (const t of closedTickets) {
    await pool.query(
      `INSERT INTO reputation_events
        (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata)
       VALUES ($1, 'positive', 'TICKET_RESOLVED', 15, 'ticket', $2, NOW() - ($3 || ' days')::interval, $4::jsonb)`,
      [demoId, String(t.id), daysAgo, JSON.stringify({ title: t.title, priority: t.priority })]
    );
    daysAgo += 1;
  }

  for (let i = 0; i < 28; i++) {
    const historicalDaysAgo = 5 + i * 3;
    await pool.query(
      `INSERT INTO reputation_events
        (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata)
       VALUES ($1, 'positive', 'TICKET_RESOLVED', 15, 'ticket', $2, NOW() - ($3 || ' days')::interval, $4::jsonb)`,
      [
        demoId,
        `demo-hist-${i}`,
        historicalDaysAgo,
        JSON.stringify({ source: "demo_seed_history" }),
      ]
    );
  }

  for (let i = 0; i < 40; i++) {
    const hoursAgo = 4 + i * 6;
    await pool.query(
      `INSERT INTO reputation_events
        (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata)
       VALUES ($1, 'positive', 'UPVOTE_RECEIVED', 1, 'vote', $2, NOW() - ($3 || ' hours')::interval, $4::jsonb)`,
      [demoId, `seed-vote-${i}`, hoursAgo, JSON.stringify({ source: "demo_seed" })]
    );
  }

  const qnaTicket = ticketIds.find((t) =>
    t.title.toLowerCase().includes("hardware keys")
  );
  if (qnaTicket) {
    const thread = await pool.query(
      `INSERT INTO ticket_threads (ticket_id, created_by, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (ticket_id) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [qnaTicket.id, demoId, "How do I enable hardware keys for SSO?"]
    );
    const threadId = thread.rows[0].id;

    const requesterId = byName.user;
    const question = await pool.query(
      `INSERT INTO thread_messages
        (thread_id, author_user_id, message_type, visibility, body, created_at)
       VALUES ($1, $2, 'comment', 'public', $3, NOW() - INTERVAL '3 days')
       RETURNING id`,
      [
        threadId,
        requesterId || demoId,
        "I've got a YubiKey 5C NFC. What's the corporate process to register it with our SSO and are the backup codes still required after?",
      ]
    );

    const answer = await pool.query(
      `INSERT INTO thread_messages
        (thread_id, author_user_id, parent_message_id, message_type, visibility, body, created_at)
       VALUES ($1, $2, $3, 'answer', 'public', $4, NOW() - INTERVAL '2 days')
       RETURNING id`,
      [
        threadId,
        demoId,
        question.rows[0].id,
        [
          "Here's the quick recipe we're using this quarter:",
          "",
          "1. Open https://sso.corp.local/security and sign in with your primary password.",
          "2. Choose 'Security keys' → 'Register a new key' and insert the YubiKey when prompted.",
          "3. Tap the gold disc to confirm presence; give the key a friendly name (e.g. 'Laptop USB-C').",
          "4. Repeat for a backup key if you have one.",
          "",
          "Backup codes: keep them. They're our only fallback if you lose every registered key.",
        ].join("\n"),
      ]
    );

    const adminId = byName.admin;
    await pool.query(
      `INSERT INTO accepted_solutions (ticket_id, thread_id, message_id, accepted_by, accepted_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day')
       ON CONFLICT (ticket_id) DO NOTHING`,
      [qnaTicket.id, threadId, answer.rows[0].id, adminId || demoId]
    );

    await pool.query(
      `INSERT INTO reputation_events
        (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata)
       VALUES ($1, 'positive', 'ANSWER_ACCEPTED', 25, 'thread_message', $2, NOW() - INTERVAL '1 day', $3::jsonb)`,
      [demoId, answer.rows[0].id, JSON.stringify({ ticketId: qnaTicket.id })]
    );

    for (let v = 0; v < 3; v++) {
      await pool.query(
        `INSERT INTO reputation_events
          (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, occurred_at, metadata)
         VALUES ($1, 'positive', 'UPVOTE_RECEIVED', 1, 'vote', $2, NOW() - ($3 || ' hours')::interval, $4::jsonb)`,
        [
          demoId,
          `seed-answer-upvote-${v}`,
          6 + v * 3,
          JSON.stringify({ messageId: answer.rows[0].id }),
        ]
      );
    }
  }

  await pool.query(
    `INSERT INTO reputation_events
      (user_id, event_type, reason_code, points_delta, source_entity_type, source_entity_id, metadata)
     VALUES ($1, 'positive', 'DEMO_SEED_V1', 1, 'system', 'demo-seed-v1', $2::jsonb)`,
    [demoId, JSON.stringify({ seeded: true })]
  );

  const reputation = require("./reputation");
  await reputation.recalculateUserLevel(pool, demoId);
  await reputation.maybeAutoBadges(pool, demoId);
}

module.exports = {
  initializeSchema,
  seedDemoData,
  SCHEMA_SQL,
};
