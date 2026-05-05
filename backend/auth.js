const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const TTL_MS = 8 * 60 * 60 * 1000;

const DEMO_USERS = [
  {
    username: process.env.AUTH_ADMIN_USER || "admin",
    password: process.env.AUTH_ADMIN_PASS || "admin",
    role: "admin",
  },
  {
    username: process.env.AUTH_TECH_USER || "tech",
    password: process.env.AUTH_TECH_PASS || "tech",
    role: "technician",
  },
  {
    username: process.env.AUTH_REQUESTER_USER || "user",
    password: process.env.AUTH_REQUESTER_PASS || "user",
    role: "requester",
  },
  {
    username: process.env.AUTH_DEMO_USER || "demo",
    password: process.env.AUTH_DEMO_PASS || "demo",
    role: "technician",
  },
];

function authenticate(username, password) {
  const row = DEMO_USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!row) return null;
  return { username: row.username, role: row.role };
}

function signToken(payload) {
  const data = { ...payload, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const body = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.exp === "number" && Date.now() > parsed.exp) return null;
  if (!parsed.username || !parsed.role) return null;
  return {
    username: parsed.username,
    role: parsed.role,
    userId: parsed.userId || null,
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = user;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = {
  authenticate,
  signToken,
  verifyToken,
  requireAuth,
  requireRoles,
};
