import express from "express";
import Docker from "dockerode";
import httpProxy from "http-proxy";
import cookie from "cookie";
import crypto from "crypto";
import { initDb } from "./db.js";

const app = express();
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "200kb" }));

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const proxy = httpProxy.createProxyServer({ ws: true });

const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "appnet";
const PREFIX = process.env.CONTAINER_PREFIX || "browser-";
const BROWSER_IMAGE = process.env.BROWSER_IMAGE || "remote-browser-browserbox:latest";
const DB_PATH = process.env.SESSION_DB_PATH || "/data/sessions.sqlite";

const BASE_URL = process.env.BASE_URL || "http://localhost";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev_cookie_secret";
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const ACCESS_MODE = process.env.ACCESS_MODE || "token"; // token|public

const DEFAULT_ALLOWLIST_HOSTS = process.env.DEFAULT_ALLOWLIST_HOSTS || "google.com,www.google.com,google.ch,www.google.ch";
const DEFAULT_START_URL = process.env.DEFAULT_START_URL || "https://www.google.com";

const SESSION_IDLE_TTL_SECONDS = Number(process.env.SESSION_IDLE_TTL_SECONDS || 1800);
const SESSION_HARD_TTL_SECONDS = Number(process.env.SESSION_HARD_TTL_SECONDS || 0);
const CLEANUP_INTERVAL_SECONDS = Number(process.env.CLEANUP_INTERVAL_SECONDS || 60);

const EXCHANGE_SHARED_SECRET = process.env.EXCHANGE_SHARED_SECRET || "";

const SECURE_COOKIES = BASE_URL.startsWith("https://");

const db = initDb(DB_PATH);

function now() { return Date.now(); }
function randId(bytes = 12) {
  // Use base64url and replace underscores with hyphens for Docker DNS compatibility
  return crypto.randomBytes(bytes).toString("base64url").replace(/_/g, '-');
}
function validateSid(sid) { return /^[a-zA-Z0-9_-]{8,64}$/.test(sid); }

function hmac(data) {
  return crypto.createHmac("sha256", COOKIE_SECRET).update(data).digest("hex");
}

// ---- Minimal JWT (HS256) ----
function signJwt(payloadObj, ttlSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { ...payloadObj, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + ttlSeconds };
  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}
function verifyJwt(token) {
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) return null;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function getUserFromCookie(req) {
  const c = cookie.parse(req.headers.cookie || "");
  const tok = c.rb_user;
  const payload = verifyJwt(tok);
  if (!payload?.user_id) return null;
  return payload;
}

// ---- Signed iframe token (sid + user_id) ----
function signIframeToken({ sid, user_id }, ttlSeconds = 900) {
  const exp = Math.floor(Date.now()/1000) + ttlSeconds;
  const payloadStr = JSON.stringify({ sid, user_id, exp });
  const mac = hmac(payloadStr);
  return `${Buffer.from(payloadStr).toString("base64url")}.${mac}`;
}
function verifyIframeToken(t) {
  try {
    const [b64, mac] = t.split(".");
    if (!b64 || !mac) return null;
    const payloadStr = Buffer.from(b64, "base64url").toString("utf8");
    const expected = hmac(payloadStr);
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const payload = JSON.parse(payloadStr);
    if (!payload.exp || Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- Container control (persistent per-session profile volume) ----
async function createContainer({ sid, allowlist_hosts, start_url }) {
  console.log("Spawning container for sid:", sid);
  const name = `${PREFIX}${sid}`;
  const profileVolume = `profile_${sid}`;
  try { 
    await docker.createVolume({ Name: profileVolume }); 
  } catch (err) {
    console.error("Volume creation failed:", err);
  }

  const container = await docker.createContainer({
    Image: BROWSER_IMAGE,
    name,
    Hostname: name,
    Env: [
      `ALLOWLIST_HOSTS=${allowlist_hosts}`,
      `START_URL=${start_url}`,
      `USER_DATA_DIR=/profile`,
      `SCREEN_WIDTH=1366`,
      `SCREEN_HEIGHT=768`
    ],
    HostConfig: {
      ShmSize: 2 * 1024 * 1024 * 1024,
      AutoRemove: false,
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`${profileVolume}:/profile`]
    },
    NetworkingConfig: { EndpointsConfig: { [DOCKER_NETWORK]: {} } }
  });

  await container.start();
  return { name };
}

async function stopContainer(containerName) {
  const c = docker.getContainer(containerName);
  try { await c.stop({ t: 5 }); } catch {}
}
async function startContainer(containerName) {
  const c = docker.getContainer(containerName);
  try { await c.start(); } catch {}
}
async function removeContainer(containerName) {
  const c = docker.getContainer(containerName);
  try { await c.remove({ force: true }); } catch {}
}

// ---- Auth exchange (called by Next.js server) ----
app.post("/auth/exchange", (req, res) => {
  if (!EXCHANGE_SHARED_SECRET) return res.status(500).json({ error: "EXCHANGE_SHARED_SECRET not set" });
  const provided = String(req.headers["x-exchange-secret"] || "");
  if (provided !== EXCHANGE_SHARED_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const { sub } = req.body || {};
  if (!sub || typeof sub !== "string" || sub.length > 200) return res.status(400).json({ error: "Bad sub" });

  let user = db.prepare("SELECT id, sub FROM users WHERE sub=?").get(sub);
  if (!user) {
    const id = "u_" + randId(10);
    db.prepare("INSERT INTO users (id, sub, created_at) VALUES (?,?,?)").run(id, sub, now());
    user = { id, sub };
  }

  const jwt = signJwt({ user_id: user.id, sub: user.sub }, 60 * 60 * 24 * 7);
  res.setHeader("Set-Cookie", cookie.serialize("rb_user", jwt, {
    httpOnly: true,
    sameSite: "Lax",
    secure: SECURE_COOKIES,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  }));

  res.json({ ok: true, user_id: user.id });
});

// ---- Nginx auth_request verify ----
app.get("/auth/verify", (req, res) => {
  if (ACCESS_MODE === "public") return res.status(204).end();

  const sid = req.headers["x-session-id"];
  if (typeof sid !== "string" || !validateSid(sid)) return res.status(400).send("Bad sid");

  // token bootstrap from first iframe request
  const originalUri = String(req.headers["x-original-uri"] || "");
  let t = "";
  try {
    const u = new URL(`http://x${originalUri || req.url}`);
    t = u.searchParams.get("t") || "";
  } catch {}

  if (t) {
    const payload = verifyIframeToken(t);
    if (!payload || payload.sid !== sid) return res.status(401).send("Bad token");

    const sess = db.prepare("SELECT sid, user_id FROM sessions WHERE sid=?").get(sid);
    if (!sess || sess.user_id !== payload.user_id) return res.status(403).send("Forbidden");

    const cookieName = `rb_sid_${sid}`;
    const val = signIframeToken({ sid, user_id: payload.user_id }, 3600);
    res.setHeader("Set-Cookie", cookie.serialize(cookieName, val, {
      httpOnly: true,
      sameSite: "Lax",
      secure: SECURE_COOKIES,
      path: `/s/${sid}/`,
      maxAge: 3600
    }));

    db.prepare("UPDATE sessions SET last_used_at=? WHERE sid=?").run(now(), sid);
    return res.status(204).end();
  }

  // otherwise require session cookie
  const cookies = cookie.parse(req.headers.cookie || "");
  const cName = `rb_sid_${sid}`;
  const sessionTok = cookies[cName];
  const payload = verifyIframeToken(sessionTok);
  if (!payload || payload.sid !== sid) return res.status(401).send("Unauthorized");

  const sess = db.prepare("SELECT sid, user_id FROM sessions WHERE sid=?").get(sid);
  if (!sess || sess.user_id !== payload.user_id) return res.status(403).send("Forbidden");

  db.prepare("UPDATE sessions SET last_used_at=? WHERE sid=?").run(now(), sid);
  return res.status(204).end();
});

// ---- Sessions API (requires rb_user cookie) ----
function requireUser(req, res, next) {
  const u = getUserFromCookie(req);
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  req.user = u;
  next();
}

// ---- Settings Routes ----
app.get("/settings", requireUser, (req, res) => {
  const row = db.prepare(`
    SELECT start_url, allowlist_hosts FROM user_settings WHERE user_id=?
  `).get(req.user.user_id);
  
  if (row) {
    return res.json(row);
  }
  
  // Return defaults if no settings exist
  res.json({
    start_url: DEFAULT_START_URL,
    allowlist_hosts: DEFAULT_ALLOWLIST_HOSTS
  });
});

app.post("/settings", requireUser, (req, res) => {
  const { start_url, allowlist_hosts } = req.body;
  
  if (!start_url || !allowlist_hosts) {
    return res.status(400).json({ error: "start_url and allowlist_hosts are required" });
  }
  
  db.prepare(`
    INSERT INTO user_settings (user_id, start_url, allowlist_hosts, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      start_url=excluded.start_url,
      allowlist_hosts=excluded.allowlist_hosts,
      updated_at=excluded.updated_at
  `).run(req.user.user_id, start_url, allowlist_hosts, now());
  
  res.json({ ok: true });
});

app.get("/sessions", requireUser, (req, res) => {
  const rows = db.prepare(`
    SELECT sid, user_id, created_at, last_used_at, allowlist_hosts, start_url, status
    FROM sessions WHERE user_id=? ORDER BY created_at DESC
  `).all(req.user.user_id);

  res.json({
    ok: true,
    sessions: rows.map(s => ({
      ...s,
      iframeUrl: `${BASE_URL}/s/${s.sid}/`,
      apiBase: `${BASE_URL}/api/s/${s.sid}`
    }))
  });
});

app.get("/sessions/all", (req, res) => {
  const rows = db.prepare(`
    SELECT sid, user_id, created_at, last_used_at, allowlist_hosts, start_url, status
    FROM sessions ORDER BY created_at DESC
  `).all();

  res.json({
    ok: true,
    sessions: rows.map(s => {
      // Create an admin token that can access any user's session
      const adminToken = signIframeToken({ sid: s.sid, user_id: s.user_id }, 3600);
      return {
        ...s,
        iframeUrl: `${BASE_URL}/s/${s.sid}/?t=${adminToken}`,
        apiBase: `${BASE_URL}/api/s/${s.sid}`
      };
    })
  });
});

app.post("/sessions", requireUser, async (req, res) => {
  const sid = randId(12);
  
  // Get user's custom settings or fall back to defaults
  const userSettings = db.prepare(`
    SELECT start_url, allowlist_hosts FROM user_settings WHERE user_id=?
  `).get(req.user.user_id);
  
  const defaultStartUrl = userSettings?.start_url || DEFAULT_START_URL;
  const defaultAllowlistHosts = userSettings?.allowlist_hosts || DEFAULT_ALLOWLIST_HOSTS;
  
  const allowlist_hosts = String(req.body?.allowlist_hosts || defaultAllowlistHosts).trim();
  const start_url = String(req.body?.start_url || defaultStartUrl).trim();
  if (!allowlist_hosts) return res.status(400).json({ error: "allowlist_hosts required" });

  const container_name = `${PREFIX}${sid}`;
  db.prepare(`
    INSERT INTO sessions (sid, user_id, container_name, created_at, last_used_at, allowlist_hosts, start_url, status)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(sid, req.user.user_id, container_name, now(), now(), allowlist_hosts, start_url, "running");

  try {
    await createContainer({ sid, allowlist_hosts, start_url });
  } catch (e) {
    db.prepare("UPDATE sessions SET status=? WHERE sid=?").run("error", sid);
    return res.status(500).json({ error: "Container create failed", details: String(e) });
  }

  const iframeToken = signIframeToken({ sid, user_id: req.user.user_id }, 900);

  res.json({
    ok: true,
    sid,
    iframeUrl: `${BASE_URL}/s/${sid}/?t=${encodeURIComponent(iframeToken)}`,
    apiBase: `${BASE_URL}/api/s/${sid}`,
    iframeToken
  });
});

app.get("/sessions/:sid/health", requireUser, async (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).json({ error: "Bad sid" });

  const sess = db.prepare("SELECT * FROM sessions WHERE sid=?").get(sid);
  if (!sess || sess.user_id !== req.user.user_id) return res.status(404).json({ error: "Not found" });

  try {
    const container = await docker.getContainer(sess.container_name);
    const info = await container.inspect();
    
    if (!info.State.Running) {
      return res.status(503).json({ ok: false, ready: false, status: "not_running" });
    }

    // Check if the browser API is responding
    try {
      const http = require('http');
      const healthCheck = await new Promise((resolve, reject) => {
        const req = http.get(`http://${sess.container_name}:3000/health`, { timeout: 2000 }, (response) => {
          resolve(response.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });

      res.json({ ok: true, ready: healthCheck, status: "running" });
    } catch (e) {
      res.json({ ok: true, ready: false, status: "starting" });
    }
  } catch (e) {
    res.status(503).json({ ok: false, ready: false, status: "error", error: String(e) });
  }
});

app.post("/sessions/:sid/stop", requireUser, async (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).json({ error: "Bad sid" });

  const sess = db.prepare("SELECT * FROM sessions WHERE sid=?").get(sid);
  if (!sess || sess.user_id !== req.user.user_id) return res.status(404).json({ error: "Not found" });

  await stopContainer(sess.container_name);
  db.prepare("UPDATE sessions SET status=? WHERE sid=?").run("stopped", sid);
  res.json({ ok: true });
});

app.post("/sessions/:sid/start", requireUser, async (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).json({ error: "Bad sid" });

  const sess = db.prepare("SELECT * FROM sessions WHERE sid=?").get(sid);
  if (!sess || sess.user_id !== req.user.user_id) return res.status(404).json({ error: "Not found" });

  await startContainer(sess.container_name);
  db.prepare("UPDATE sessions SET status=? WHERE sid=?").run("running", sid);

  const iframeToken = signIframeToken({ sid, user_id: req.user.user_id }, 900);

  res.json({
    ok: true,
    sid,
    iframeUrl: `${BASE_URL}/s/${sid}/?t=${encodeURIComponent(iframeToken)}`,
    apiBase: `${BASE_URL}/api/s/${sid}`,
    iframeToken
  });
});

app.delete("/sessions/:sid", requireUser, async (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).json({ error: "Bad sid" });

  const sess = db.prepare("SELECT * FROM sessions WHERE sid=?").get(sid);
  if (!sess || sess.user_id !== req.user.user_id) return res.status(404).json({ error: "Not found" });

  await removeContainer(sess.container_name);
  db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
  res.json({ ok: true });
});

app.delete("/sessions/:sid/admin", async (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).json({ error: "Bad sid" });

  const sess = db.prepare("SELECT * FROM sessions WHERE sid=?").get(sid);
  if (!sess) return res.status(404).json({ error: "Not found" });

  await removeContainer(sess.container_name);
  db.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
  res.json({ ok: true });
});

// ---- Dynamic router to per-session containers ----
function proxyTo(kind) {
  return (req, res) => {
    const sid = req.params.sid;
    if (!validateSid(sid)) return res.status(400).send("Bad sid");

    const port = kind === "novnc" ? 6080 : 3000;
    const target = `http://${PREFIX}${sid}:${port}`;

    // Strip the prefix so the upstream receives paths it understands
    // /novnc/<sid>/foo  -> /foo
    // /novnc/<sid>      -> /
    const prefix = `/${kind}/${sid}`;
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length) || "/";
    }

    proxy.web(req, res, { target, changeOrigin: true }, (err) => {
      res.status(502).send(`Bad gateway: ${String(err)}`);
    });
  };
}

app.use("/novnc/:sid", (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).send("Bad sid");

  // IMPORTANT: Express strips the mount path, so here req.url is already "/...", not "/novnc/<sid>/..."
  const target = `http://${PREFIX}${sid}:6080`;

  proxy.web(req, res, { target, changeOrigin: true }, (err) => {
    console.error("novnc proxy error:", err);
    res.status(502).send("Bad gateway");
  });
});

app.use("/api/:sid", (req, res) => {
  const sid = req.params.sid;
  if (!validateSid(sid)) return res.status(400).send("Bad sid");

  const target = `http://${PREFIX}${sid}:3000`; // assuming your API inside session listens on 3000
  proxy.web(req, res, { target, changeOrigin: true }, (err) => {
    console.error("api proxy error:", err);
    res.status(502).send("Bad gateway");
  });
});



const server = app.listen(8080, () => console.log("Gateway listening on :8080"));
server.on("upgrade", (req, socket, head) => {
  const m = req.url.match(/^\/novnc\/([0-9A-Za-z_-]{8,64})(\/.*)?$/);
  if (!m) return socket.destroy();

  const sid = m[1];
  const rest = m[2] || "/";

  req.url = rest; // send only the path noVNC expects
  const target = `http://${PREFIX}${sid}:6080`;

  proxy.ws(req, socket, head, { target }, () => socket.destroy());
});



// ---- Cleanup loop (idle stop + optional hard delete) ----
async function cleanupLoop() {
  const idleMs = SESSION_IDLE_TTL_SECONDS * 1000;
  const hardMs = SESSION_HARD_TTL_SECONDS > 0 ? SESSION_HARD_TTL_SECONDS * 1000 : 0;

  while (true) {
    await new Promise(r => setTimeout(r, CLEANUP_INTERVAL_SECONDS * 1000));
    const t = now();

    const rows = db.prepare("SELECT sid, container_name, created_at, last_used_at, status FROM sessions").all();
    for (const s of rows) {
      const idleTooLong = (t - s.last_used_at) > idleMs;
      const hardTooLong = hardMs > 0 && (t - s.created_at) > hardMs;

      try {
        if (hardTooLong) {
          await removeContainer(s.container_name);
          db.prepare("DELETE FROM sessions WHERE sid=?").run(s.sid);
          continue;
        }
        if (idleTooLong && s.status === "running") {
          await stopContainer(s.container_name);
          db.prepare("UPDATE sessions SET status=? WHERE sid=?").run("stopped", s.sid);
        }
      } catch {
        // ignore; retry next loop
      }
    }
  }
}
cleanupLoop().catch(() => {});
