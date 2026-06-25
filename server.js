"use strict";

const http = require("http");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4574);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const TASK_UPLOAD_DIR = path.join(__dirname, "uploads", "tasks");
const REPORT_UPLOAD_DIR = path.join(__dirname, "uploads", "reports");
const REPORT_MEDIA_MAX_BYTES = 250 * 1024 * 1024;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const APP_LOCALE = String(process.env.LOCALE || "en").trim().toLowerCase().startsWith("de")
  ? "de"
  : "en";
// Cloudflare / reverse-proxy support: when the app runs behind a TLS-terminating
// proxy (Cloudflare, Apache, Nginx), set TRUST_PROXY=true (or CLOUDFLARE=true) so
// session cookies are marked Secure even though the proxy talks to the app over HTTP.
const TRUST_PROXY = process.env.TRUST_PROXY === "true" || process.env.CLOUDFLARE === "true";
const SECURE_COOKIES = IS_PRODUCTION || TRUST_PROXY;

// Optional Discord bot token. When set, the current user's Discord avatar is
// refreshed on page load (throttled), so a changed profile picture shows up
// without the user having to sign in again.
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

// Update notice: compare the locally installed version against the latest
// GitHub release. Disable with UPDATE_CHECK=false, point at a fork with UPDATE_REPO.
const APP_VERSION = (() => {
  try {
    return require("./package.json").version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
const UPDATE_REPO = process.env.UPDATE_REPO || "NexHub-dev/planara";
const UPDATE_CHECK_ENABLED = process.env.UPDATE_CHECK !== "false";
const updateState = {
  current: APP_VERSION,
  latest: APP_VERSION,
  available: false,
  url: `https://github.com/${UPDATE_REPO}/releases`,
  checkedAt: 0
};

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map((part) => parseInt(part, 10) || 0);
  const pb = String(b).replace(/^v/, "").split(".").map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

async function checkForUpdate() {
  if (!UPDATE_CHECK_ENABLED) return updateState;
  if (Date.now() - updateState.checkedAt < 6 * 60 * 60 * 1000) return updateState;
  updateState.checkedAt = Date.now();
  try {
    const response = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { "User-Agent": "Planara", Accept: "application/vnd.github+json" }
    });
    if (!response.ok) return updateState;
    const data = await response.json();
    const latest = String(data.tag_name || "").replace(/^v/, "");
    if (latest) {
      updateState.latest = latest;
      updateState.available = compareSemver(latest, APP_VERSION) > 0;
      if (data.html_url) updateState.url = data.html_url;
    }
  } catch {
    // network problems should never break the app; keep the previous state
  }
  return updateState;
}

async function refreshDiscordAvatar(currentUser) {
  if (!DISCORD_BOT_TOKEN || !currentUser || !currentUser.discordId) return currentUser;
  const last = currentUser.avatarCheckedAt ? Date.parse(currentUser.avatarCheckedAt) : 0;
  if (Date.now() - last < 30 * 60 * 1000) return currentUser;
  try {
    const response = await fetch(`https://discord.com/api/v10/users/${currentUser.discordId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
    });
    if (!response.ok) return currentUser;
    const profile = await response.json();
    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(profile.id) % 6}.png`;
    const users = await readJson("users");
    const stored = users.find((item) => item.id === currentUser.id);
    if (!stored) return currentUser;
    stored.avatarCheckedAt = new Date().toISOString();
    if (stored.avatar !== avatar) stored.avatar = avatar;
    if (profile.global_name || profile.username) {
      stored.displayName = profile.global_name || profile.username;
    }
    await writeJson("users", users);
    return stored;
  } catch {
    return currentUser;
  }
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.headers["cf-connecting-ip"];
    if (cf) return String(cf).trim();
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}
const SESSION_COOKIE = "vlc_session";
const taskProjectTypes = new Set(["kleinprojekt", "mittelprojekt", "grossprojekt"]);

const DEFAULT_STATUSES = [
  { id: "starting", name: "Backlog", color: "#64748b", order: 0, isDefault: true, isDone: false },
  { id: "planung", name: "Planning", color: "#6d5dfc", order: 1, isDefault: false, isDone: false },
  { id: "entwicklung", name: "In Progress", color: "#0ea5e9", order: 2, isDefault: false, isDone: false },
  { id: "testing", name: "Testing", color: "#f59e0b", order: 3, isDefault: false, isDone: false },
  { id: "abgeschlossen", name: "Done", color: "#22c55e", order: 4, isDefault: false, isDone: true }
];

const DEFAULT_BRANDING = {
  productName: "Planara",
  tagline: "The project board for modern teams",
  logoUrl: "/assets/branding/planara-logo.svg",
  markUrl: "/assets/branding/planara-mark.svg",
  primaryColor: "#6d5dfc",
  accentColor: "#1fd1c6"
};

const API_TOKEN_PREFIX = "plnr_";

const DEFAULT_LEAD_GROUP_ID = "lead-developer";

const DEFAULT_GROUPS = [
  {
    id: "lead-developer",
    name: "Lead-Developer",
    color: "#6d5dfc",
    permissions: [
      "view_app",
      "create_task",
      "claim_task",
      "manage_tasks",
      "submit_changelog",
      "approve_changelog",
      "delete_changelog",
      "push_changelog",
      "manage_users",
      "manage_settings"
    ],
    order: 0
  },
  {
    id: "developer",
    name: "Developer",
    color: "#0ea5e9",
    permissions: ["view_app", "create_task", "claim_task", "manage_tasks", "submit_changelog"],
    order: 1
  },
  {
    id: "member",
    name: "Member",
    color: "#64748b",
    permissions: ["view_app"],
    order: 2
  }
];

const oauthStates = new Map();
let writeQueue = Promise.resolve();

const permissionCatalog = [
  { id: "view_app", name: "App ansehen", description: "Zugriff auf den freigeschalteten Workspace." },
  { id: "create_task", name: "Aufgaben erstellen", description: "Neue Aufgaben und Projekte anlegen." },
  { id: "claim_task", name: "Offene Aufgaben übernehmen", description: "Unbesetzte Aufgaben selbst übernehmen." },
  { id: "manage_tasks", name: "Aufgaben verwalten", description: "Alle Aufgaben bearbeiten, zuweisen und löschen." },
  { id: "submit_changelog", name: "Changelog einreichen", description: "Neue Changelog-Einträge zur Prüfung einreichen." },
  { id: "approve_changelog", name: "Changelog freigeben", description: "Changelog-Einträge bearbeiten und freigeben." },
  { id: "delete_changelog", name: "Changelog löschen", description: "Unveröffentlichte Changelog-Einträge löschen." },
  { id: "push_changelog", name: "Changelog veröffentlichen", description: "Freigegebene Changelogs per Discord Webhook senden." },
  { id: "manage_users", name: "Nutzer verwalten", description: "Nutzer freischalten und Gruppen zuweisen." },
  { id: "manage_settings", name: "Einstellungen verwalten", description: "Branding, Status und API-Tokens verwalten." }
];
const knownPermissions = new Set(permissionCatalog.map((permission) => permission.id));

const dataFiles = {
  users: path.join(DATA_DIR, "users.json"),
  groups: path.join(DATA_DIR, "groups.json"),
  areas: path.join(DATA_DIR, "areas.json"),
  tasks: path.join(DATA_DIR, "tasks.json"),
  ideas: path.join(DATA_DIR, "ideas.json"),
  bugs: path.join(DATA_DIR, "bugs.json"),
  sessions: path.join(DATA_DIR, "sessions.json"),
  changelogs: path.join(DATA_DIR, "changelogs.json"),
  changelogArchive: path.join(DATA_DIR, "changelog-archive.json"),
  statuses: path.join(DATA_DIR, "statuses.json"),
  apiTokens: path.join(DATA_DIR, "api-tokens.json"),
  settings: path.join(DATA_DIR, "settings.json")
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ico": "image/x-icon"
};

const taskImageTypes = {
  "image/jpeg": { extension: ".jpg", signatures: [[0xff, 0xd8, 0xff]] },
  "image/png": { extension: ".png", signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/gif": {
    extension: ".gif",
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
    ]
  },
  "image/webp": { extension: ".webp", signatures: [] }
};

const reportMediaTypes = {
  "image/jpeg": { extension: ".jpg", kind: "image" },
  "image/png": { extension: ".png", kind: "image" },
  "image/webp": { extension: ".webp", kind: "image" },
  "image/gif": { extension: ".gif", kind: "image" },
  "video/mp4": { extension: ".mp4", kind: "video" },
  "video/webm": { extension: ".webm", kind: "video" },
  "video/quicktime": { extension: ".mov", kind: "video" }
};

const blockedPublicPaths =
  /^\/(?:\.env(?:\..*)?|\.git(?:\/|$)|data(?:\/|$)|server\.js$|package(?:-lock)?\.json$)/i;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function readJson(name) {
  try {
    return JSON.parse(await fsp.readFile(dataFiles[name], "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      if (name === "statuses") {
        const seeded = DEFAULT_STATUSES.map((status) => ({ ...status }));
        await writeJson("statuses", seeded);
        return seeded;
      }
      if (name === "groups") {
        const seeded = DEFAULT_GROUPS.map((group) => ({
          ...group,
          permissions: [...group.permissions],
          createdAt: new Date().toISOString()
        }));
        await writeJson("groups", seeded);
        return seeded;
      }
      if (name === "settings") {
        await writeJson("settings", {});
        return {};
      }
      if (
        [
          "changelogArchive",
          "areas",
          "ideas",
          "bugs",
          "sessions",
          "apiTokens",
          "users",
          "tasks",
          "changelogs"
        ].includes(name)
      ) {
        await writeJson(name, []);
        return [];
      }
    }
    throw error;
  }
}

async function writeJson(name, value) {
  writeQueue = writeQueue.then(async () => {
    const temporary = `${dataFiles[name]}.tmp`;
    await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fsp.rename(temporary, dataFiles[name]);
  });
  return writeQueue;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

async function readBody(req, maxLength = 1_000_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxLength) throw new Error("Anfrage ist zu groß.");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Ungültige JSON-Anfrage.");
  }
}

function decodeTaskImage(body) {
  const mimeType = String(body.mimeType || "").toLowerCase();
  const config = taskImageTypes[mimeType];
  if (!config) throw new Error("Erlaubt sind JPEG-, PNG-, WebP- und GIF-Bilder.");
  const encoded = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
  if (!encoded || !/^[a-z0-9+/=\r\n]+$/i.test(encoded)) {
    throw new Error("Das Bild konnte nicht gelesen werden.");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error("Ein Bild darf maximal 5 MB groß sein.");
  }
  const hasSignature =
    mimeType === "image/webp"
      ? buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      : config.signatures.some((signature) =>
          signature.every((byte, index) => buffer[index] === byte)
        );
  if (!hasSignature) throw new Error("Dateiinhalt und Bildformat stimmen nicht überein.");
  return { buffer, mimeType, extension: config.extension };
}

async function deleteTaskImageFile(image) {
  if (!image?.fileName) return;
  const filePath = path.join(TASK_UPLOAD_DIR, path.basename(image.fileName));
  await fsp.unlink(filePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

async function setSession(res, userId, remember = false) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const maxAgeSeconds = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
  const storedSessions = await readJson("sessions");
  const activeSessions = storedSessions.filter((session) => session.expiresAt > now);
  activeSessions.push({
    id: sessionId,
    userId,
    persistent: Boolean(remember),
    createdAt: new Date(now).toISOString(),
    expiresAt: now + maxAgeSeconds * 1000
  });
  await writeJson("sessions", activeSessions);
  const secure = SECURE_COOKIES ? "; Secure" : "";
  const persistence = remember ? `; Max-Age=${maxAgeSeconds}` : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax${persistence}${secure}`
  );
}

async function updateSessionPersistence(req, res, remember) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  const storedSessions = await readJson("sessions");
  const session = storedSessions.find((item) => item.id === sessionId);
  if (!session) {
    sendJson(res, 401, { error: "Die Anmeldung ist nicht mehr gültig." });
    return false;
  }
  const maxAgeSeconds = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
  session.persistent = Boolean(remember);
  session.expiresAt = Date.now() + maxAgeSeconds * 1000;
  await writeJson("sessions", storedSessions);
  const secure = SECURE_COOKIES ? "; Secure" : "";
  const persistence = remember ? `; Max-Age=${maxAgeSeconds}` : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax${persistence}${secure}`
  );
  return true;
}

async function clearSession(req, res) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (sessionId) {
    const storedSessions = await readJson("sessions");
    await writeJson(
      "sessions",
      storedSessions.filter((session) => session.id !== sessionId)
    );
  }
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${SECURE_COOKIES ? "; Secure" : ""}`
  );
}

async function getCurrentUser(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return null;
  const storedSessions = await readJson("sessions");
  const now = Date.now();
  const session = storedSessions.find((item) => item.id === sessionId);
  if (!session || session.expiresAt < now) {
    if (session) {
      await writeJson(
        "sessions",
        storedSessions.filter((item) => item.id !== sessionId && item.expiresAt > now)
      );
    }
    return null;
  }
  const users = await readJson("users");
  const user = users.find((item) => item.id === session.userId) || null;
  if (!user?.approved || !user.groupId) return user;
  const groups = await readJson("groups");
  const group = groups.find((item) => item.id === user.groupId);
  if (group && JSON.stringify(user.permissions) !== JSON.stringify(group.permissions)) {
    user.permissions = [...group.permissions];
    await writeJson("users", users);
  }
  return user;
}

function hasPermission(user, permission) {
  return Boolean(
    user &&
      user.approved &&
      (user.isAdmin || user.permissions.includes(permission))
  );
}

function requirePermission(user, permission, res) {
  if (!hasPermission(user, permission)) {
    sendJson(res, 403, { error: "Dafür fehlen dir die notwendigen Rechte." });
    return false;
  }
  return true;
}

function requireAdmin(user, res) {
  if (!user?.isAdmin) {
    sendJson(res, 403, { error: "Diese Funktion ist nur für Administratoren verfügbar." });
    return false;
  }
  return true;
}

function validateOrigin(req) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function sanitizeText(value, maxLength, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error("Bitte alle Pflichtfelder ausfüllen.");
  if (text.length > maxLength) throw new Error(`Eingabe darf maximal ${maxLength} Zeichen haben.`);
  return text;
}

function publicUser(user) {
  return {
    id: user.id,
    discordId: user.discordId,
    authProvider: user.authProvider || (user.discordId ? "discord" : "local"),
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    approved: user.approved,
    isAdmin: Boolean(user.isAdmin),
    groupId: user.groupId,
    areaIds: Array.isArray(user.areaIds) ? user.areaIds : [],
    permissions: user.permissions,
    createdAt: user.createdAt,
    tutorialCompletedAt: user.tutorialCompletedAt || null
  };
}

function sanitizePermissions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((permission) => knownPermissions.has(permission)))];
}

function sanitizeAreaIds(value, areas) {
  if (!Array.isArray(value)) return [];
  const knownAreaIds = new Set(areas.map((area) => area.id));
  return [...new Set(value.map(String).filter((areaId) => knownAreaIds.has(areaId)))];
}

function sanitizeTaskAreaId(value, areas) {
  const areaId = String(value || "").trim();
  if (!areaId) return null;
  if (!areas.some((area) => area.id === areaId)) {
    throw new Error("Der ausgewählte Bereich existiert nicht.");
  }
  return areaId;
}

function userBelongsToArea(user, areaId) {
  return !areaId || (Array.isArray(user.areaIds) && user.areaIds.includes(areaId));
}

function isTaskAssignee(task, user) {
  if (!task?.assigneeId || !user) return false;
  const assigneeId = String(task.assigneeId);
  return [user.id, user.discordId, user.username]
    .filter(Boolean)
    .some((identifier) => String(identifier) === assigneeId);
}

function validateTaskAssignee(users, assigneeId, areaId) {
  if (!assigneeId) return null;
  const assignee = users.find((item) => item.id === assigneeId && item.approved);
  if (!assignee) throw new Error("Die ausgewählte Person ist nicht verfügbar.");
  if (!userBelongsToArea(assignee, areaId)) {
    throw new Error("Die ausgewählte Person gehört nicht zum Aufgabenbereich.");
  }
  return assignee;
}

async function createTaskRecord(body, user, users, areas, source = null) {
  const areaId = sanitizeTaskAreaId(body.areaId, areas);
  const assigneeId = String(body.assigneeId || "").trim() || null;
  validateTaskAssignee(users, assigneeId, areaId);
  const statuses = await getStatuses();
  const statusId = statuses.some((status) => status.id === body.status)
    ? body.status
    : defaultStatusId(statuses);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: sanitizeText(body.title, 100),
    description: sanitizeText(body.description, 1000, false),
    projectType: taskProjectTypes.has(body.projectType)
      ? body.projectType
      : "kleinprojekt",
    priority: ["niedrig", "mittel", "hoch", "kritisch"].includes(body.priority)
      ? body.priority
      : "mittel",
    status: statusId,
    dueDate: null,
    assigneeId,
    areaId,
    createdBy: user.id,
    roadmap: sanitizeText(body.roadmap, 3000, false),
    notes: [],
    images: [],
    source,
    createdAt: now,
    updatedAt: now
  };
}

function reportMediaHasValidSignature(mimeType, buffer) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "video/webm") {
    return buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3;
  }
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

function decodeUploadName(value) {
  let name = String(value || "Medienupload");
  try {
    name = decodeURIComponent(name);
  } catch {
  }
  return sanitizeText(path.basename(name).replace(/[\u0000-\u001f\u007f]/g, ""), 180);
}

async function receiveReportMedia(req) {
  const mimeType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const config = reportMediaTypes[mimeType];
  if (!config) {
    throw new Error("Erlaubt sind JPEG, PNG, WebP, GIF, MP4, WebM und MOV.");
  }
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > REPORT_MEDIA_MAX_BYTES) {
    const error = new Error("Der Medienupload darf maximal 250 MB groß sein.");
    error.statusCode = 413;
    throw error;
  }

  await fsp.mkdir(REPORT_UPLOAD_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const fileName = `${id}${config.extension}`;
  const temporaryPath = path.join(REPORT_UPLOAD_DIR, `${fileName}.tmp`);
  const finalPath = path.join(REPORT_UPLOAD_DIR, fileName);
  const handle = await fsp.open(temporaryPath, "wx");
  let size = 0;
  let signature = Buffer.alloc(0);

  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > REPORT_MEDIA_MAX_BYTES) {
        const error = new Error("Der Medienupload darf maximal 250 MB groß sein.");
        error.statusCode = 413;
        throw error;
      }
      if (signature.length < 32) {
        signature = Buffer.concat([
          signature,
          chunk.subarray(0, Math.max(0, 32 - signature.length))
        ]);
      }
      await handle.write(chunk);
    }
    await handle.close();
    if (!size) throw new Error("Die hochgeladene Datei ist leer.");
    if (!reportMediaHasValidSignature(mimeType, signature)) {
      throw new Error("Dateiinhalt und Medienformat stimmen nicht überein.");
    }
    await fsp.rename(temporaryPath, finalPath);
  } catch (error) {
    await handle.close().catch(() => {});
    await fsp.unlink(temporaryPath).catch(() => {});
    await fsp.unlink(finalPath).catch(() => {});
    throw error;
  }

  return {
    id,
    fileName,
    url: `/uploads/reports/${fileName}`,
    originalName: decodeUploadName(req.headers["x-file-name"]),
    mimeType,
    kind: config.kind,
    size,
    uploadedAt: new Date().toISOString()
  };
}

function sanitizeColor(value) {
  const color = String(value || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Bitte eine gueltige Gruppenfarbe angeben.");
  return color.toLowerCase();
}

function sanitizeDate(value) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    throw new Error("Bitte ein gueltiges Fertigstellungsdatum angeben.");
  }
  return date;
}

function germanDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin"
  }).format(new Date(value));
}

function sanitizeHexColor(value, message = "Bitte eine gueltige Farbe im Format #rrggbb angeben.") {
  const color = String(value || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(message);
  return color.toLowerCase();
}

function sanitizeBrandingUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (!/^\/[a-z0-9._\-/]+\.(?:svg|png|jpg|jpeg|webp|gif|ico)$/i.test(url)) {
    throw new Error("Logo-Pfad muss ein relativer Pfad zu einer Bilddatei sein (z. B. /assets/...).");
  }
  return url;
}

async function getStatuses() {
  const statuses = await readJson("statuses");
  return Array.isArray(statuses) && statuses.length
    ? statuses
    : DEFAULT_STATUSES.map((status) => ({ ...status }));
}

function defaultStatusId(statuses) {
  const fallback = statuses.find((status) => status.isDefault) || statuses[0];
  return fallback ? fallback.id : "starting";
}

function publicStatuses(statuses) {
  return [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function withSourceStatus(record, tasks) {
  const task = record.taskId ? tasks.find((item) => item.id === record.taskId) : null;
  return {
    ...record,
    converted: Boolean(record.taskId),
    taskStatus: task ? task.status : null,
    taskTitle: task ? task.title : null
  };
}

async function getBranding() {
  const settings = await readJson("settings");
  return { ...DEFAULT_BRANDING, ...(settings.branding || {}) };
}

function findLeadGroup(groups) {
  return (
    groups.find((group) => group.id === DEFAULT_LEAD_GROUP_ID) ||
    groups.find(
      (group) => Array.isArray(group.permissions) && group.permissions.includes("manage_users")
    ) ||
    groups[0] ||
    null
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  return (
    expectedBuffer.length === derivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, derivedBuffer)
  );
}

function hashApiToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function publicApiToken(record) {
  return {
    id: record.id,
    name: record.name,
    scope: record.scope,
    prefix: record.prefix,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt || null
  };
}

const API_WRITE_PERMISSIONS = [
  "view_app",
  "create_task",
  "claim_task",
  "manage_tasks",
  "submit_changelog",
  "approve_changelog",
  "delete_changelog",
  "push_changelog"
];

async function authenticateApiToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const provided = match[1].trim();
  if (!provided.startsWith(API_TOKEN_PREFIX)) return null;
  const tokens = await readJson("apiTokens");
  const tokenHash = hashApiToken(provided);
  const record = tokens.find((item) => item.tokenHash === tokenHash);
  if (!record) return null;
  record.lastUsedAt = new Date().toISOString();
  await writeJson("apiTokens", tokens).catch(() => {});
  const canWrite = record.scope === "write";
  return {
    id: `token:${record.id}`,
    username: record.name,
    displayName: `API-Token: ${record.name}`,
    approved: true,
    isAdmin: false,
    isApiToken: true,
    scope: record.scope,
    groupId: null,
    areaIds: [],
    permissions: canWrite ? [...API_WRITE_PERMISSIONS] : ["view_app"]
  };
}

async function migrateTaskStatuses() {
  const [tasks, statuses] = await Promise.all([readJson("tasks"), getStatuses()]);
  const validIds = new Set(statuses.map((status) => status.id));
  const fallback = defaultStatusId(statuses);
  let changed = false;
  for (const task of tasks) {
    let next = task.status;
    if (next === "blockiert") next = "planung";
    if (!validIds.has(next)) next = fallback;
    if (next !== task.status) {
      task.status = next;
      task.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) await writeJson("tasks", tasks);
}

async function migratePublishedChangelogs() {
  const changelogs = await readJson("changelogs");
  const publishedEntries = changelogs.filter((entry) => entry.publishedAt);
  if (!publishedEntries.length) return;

  const archive = await readJson("changelogArchive");
  const settings = await readJson("settings");
  const groups = new Map();
  for (const entry of publishedEntries) {
    const key = entry.publishedAt;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const [publishedAt, entries] of groups) {
    const existing = archive.some(
      (item) =>
        item.publishedAt === publishedAt &&
        item.entries.some((archivedEntry) => archivedEntry.id === entries[0].id)
    );
    if (existing) continue;
    const lastPush = settings.lastChangelogPush;
    archive.push({
      id: crypto.randomUUID(),
      title: `Changelog vom ${germanDate(publishedAt)}`,
      publishedAt,
      effectiveAt:
        lastPush?.publishedAt === publishedAt ? lastPush.effectiveAt : publishedAt,
      publishedBy: lastPush?.publishedBy || null,
      publishedByName: "Lead-Developer",
      entries
    });
  }

  archive.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  await writeJson("changelogArchive", archive);
  await writeJson(
    "changelogs",
    changelogs.filter((entry) => !entry.publishedAt)
  );
}

async function upsertDiscordUser(discordUser) {
  const users = await readJson("users");
  const groups = await readJson("groups");
  const adminIds = (process.env.ADMIN_DISCORD_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const isAdmin = adminIds.includes(discordUser.id);
  const existing = users.find((user) => user.discordId === discordUser.id);
  const group = isAdmin ? findLeadGroup(groups) : groups.find((item) => item.id === existing?.groupId);
  const avatar = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.id) % 6}.png`;

  if (existing) {
    existing.username = discordUser.username;
    existing.displayName = discordUser.global_name || discordUser.username;
    existing.avatar = avatar;
    existing.isAdmin = isAdmin;
    if (group) existing.permissions = [...group.permissions];
    if (isAdmin) {
      existing.approved = true;
      existing.groupId = group ? group.id : null;
      existing.permissions = group ? [...group.permissions] : [];
    }
    existing.lastLoginAt = new Date().toISOString();
    await writeJson("users", users);
    return existing;
  }

  const user = {
    id: crypto.randomUUID(),
    discordId: discordUser.id,
    username: discordUser.username,
    displayName: discordUser.global_name || discordUser.username,
    avatar,
    approved: isAdmin,
    isAdmin,
    groupId: isAdmin && group ? group.id : null,
    permissions: isAdmin && group ? [...group.permissions] : [],
    areaIds: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    tutorialCompletedAt: null
  };
  users.push(user);
  await writeJson("users", users);
  return user;
}

async function handleDiscordStart(res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    redirect(res, "/?authError=Discord%20OAuth%20ist%20noch%20nicht%20konfiguriert.");
    return;
  }
  const state = crypto.randomBytes(18).toString("hex");
  oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state
  });
  redirect(res, `https://discord.com/oauth2/authorize?${params}`);
}

async function handleDiscordCallback(url, res) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthState = oauthStates.get(state);
  oauthStates.delete(state);
  if (!code || !state || !oauthState || oauthState.expiresAt < Date.now()) {
    redirect(res, "/?authError=Discord-Anmeldung%20ist%20abgelaufen.");
    return;
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    })
  });
  if (!tokenResponse.ok) throw new Error("Discord hat die Anmeldung abgelehnt.");
  const token = await tokenResponse.json();
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if (!userResponse.ok) throw new Error("Discord-Profil konnte nicht geladen werden.");
  const discordUser = await userResponse.json();
  const user = await upsertDiscordUser(discordUser);
  await setSession(res, user.id, false);
  redirect(res, "/?loginPrompt=1");
}

async function handleDemoLogin(req, res) {
  if (IS_PRODUCTION) {
    sendJson(res, 404, { error: "Nicht gefunden." });
    return;
  }
  const groups = await readJson("groups");
  const users = await readJson("users");
  let user = users.find((item) => item.discordId === "demo-admin");
  if (!user) {
    const group = findLeadGroup(groups);
    user = {
      id: crypto.randomUUID(),
      discordId: "demo-admin",
      username: "demo.leitung",
      displayName: "Demo Leitung",
      avatar: null,
      approved: true,
      isAdmin: true,
      groupId: group.id,
      permissions: group.permissions,
      areaIds: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      tutorialCompletedAt: null
    };
    users.push(user);
    await writeJson("users", users);
  } else if (!user.isAdmin) {
    user.isAdmin = true;
    await writeJson("users", users);
  }
  await readBody(req);
  await setSession(res, user.id, false);
  sendJson(res, 200, { ok: true });
}

async function handleRegister(req, res) {
  const body = await readBody(req);
  const username = String(body.username || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Benutzername: 3 bis 32 Zeichen, nur a-z, 0-9, Punkt, Unterstrich, Minus.");
  }
  const displayName = sanitizeText(body.displayName || body.username, 60);
  const password = String(body.password || "");
  if (password.length < 8) throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  const [users, groups] = await Promise.all([readJson("users"), readJson("groups")]);
  if (users.some((item) => item.passwordHash && (item.username || "").toLowerCase() === username)) {
    throw new Error("Dieser Benutzername ist bereits vergeben.");
  }
  const isFirstUser = users.length === 0;
  const leadGroup = findLeadGroup(groups);
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    discordId: null,
    authProvider: "local",
    username,
    displayName,
    avatar: null,
    passwordHash: hashPassword(password),
    approved: isFirstUser,
    isAdmin: isFirstUser,
    groupId: isFirstUser && leadGroup ? leadGroup.id : null,
    permissions: isFirstUser && leadGroup ? [...leadGroup.permissions] : [],
    areaIds: [],
    createdAt: now,
    lastLoginAt: now,
    tutorialCompletedAt: null
  };
  users.push(user);
  await writeJson("users", users);
  await setSession(res, user.id, body.remember === true);
  sendJson(res, 201, { user: publicUser(user), pending: !user.approved });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const users = await readJson("users");
  const user = users.find(
    (item) => item.passwordHash && (item.username || "").toLowerCase() === username
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, { error: "Benutzername oder Passwort ist falsch." });
    return;
  }
  user.lastLoginAt = new Date().toISOString();
  await writeJson("users", users);
  await setSession(res, user.id, body.remember === true);
  sendJson(res, 200, { user: publicUser(user), pending: !user.approved });
}

async function handleApi(req, res, url) {
  if (!validateOrigin(req)) {
    sendJson(res, 403, { error: "Ungueltiger Anfrageursprung." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    let user = await getCurrentUser(req);
    if (user) user = await refreshDiscordAvatar(user);
    const [users, branding] = await Promise.all([readJson("users"), getBranding()]);
    sendJson(res, 200, {
      user: user ? publicUser(user) : null,
      branding,
      locale: APP_LOCALE,
      demoAvailable: !IS_PRODUCTION,
      localAuth: true,
      registrationOpen: true,
      setupRequired: users.length === 0,
      oauthConfigured: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/branding") {
    sendJson(res, 200, { branding: await getBranding() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    await handleRegister(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/demo-login") {
    await handleDemoLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    await clearSession(req, res);
    sendJson(res, 200, { ok: true });
    return;
  }

  const user = (await authenticateApiToken(req)) || (await getCurrentUser(req));
  if (!user) {
    sendJson(res, 401, { error: "Bitte zuerst anmelden." });
    return;
  }
  if (user.isApiToken && user.scope === "read" && req.method !== "GET") {
    sendJson(res, 403, { error: "Dieser API-Token hat nur Lesezugriff." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/session/remember") {
    const body = await readBody(req);
    if (!(await updateSessionPersistence(req, res, body.remember === true))) return;
    sendJson(res, 200, { ok: true, persistent: body.remember === true });
    return;
  }

  if (!user.approved) {
    sendJson(res, 403, { error: "Dein Account muss noch freigeschaltet werden.", pending: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const [
      users,
      groups,
      areas,
      tasks,
      ideas,
      bugs,
      changelogs,
      archivedChangelogs,
      settings,
      statuses,
      branding
    ] = await Promise.all([
      readJson("users"),
      readJson("groups"),
      readJson("areas"),
      readJson("tasks"),
      readJson("ideas"),
      readJson("bugs"),
      readJson("changelogs"),
      readJson("changelogArchive"),
      readJson("settings"),
      getStatuses(),
      getBranding()
    ]);
    sendJson(res, 200, {
      me: publicUser(user),
      users: users.map(publicUser),
      groups,
      areas,
      tasks,
      ideas,
      bugs,
      changelogs,
      archivedChangelogs,
      statuses: publicStatuses(statuses),
      branding,
      locale: APP_LOCALE,
      update: {
        current: updateState.current,
        latest: updateState.latest,
        available: updateState.available,
        url: updateState.url
      },
      apiTokens: hasPermission(user, "manage_settings") ? (await readJson("apiTokens")).map(publicApiToken) : [],
      permissionCatalog,
      settings: {
        webhookConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL),
        lastChangelogPush: settings.lastChangelogPush
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tutorial/complete") {
    const users = await readJson("users");
    const target = users.find((item) => item.id === user.id);
    if (!target) {
      sendJson(res, 404, { error: "Nutzer nicht gefunden." });
      return;
    }
    target.tutorialCompletedAt = new Date().toISOString();
    await writeJson("users", users);
    sendJson(res, 200, { user: publicUser(target) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/areas") {
    if (!requireAdmin(user, res)) return;
    const body = await readBody(req);
    const areas = await readJson("areas");
    const name = sanitizeText(body.name, 60);
    if (areas.some((area) => area.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ein Bereich mit diesem Namen existiert bereits.");
    }
    const area = {
      id: crypto.randomUUID(),
      name,
      color: sanitizeColor(body.color),
      createdAt: new Date().toISOString()
    };
    areas.push(area);
    await writeJson("areas", areas);
    sendJson(res, 201, { area });
    return;
  }

  const areaMatch = url.pathname.match(/^\/api\/areas\/([^/]+)$/);
  if (areaMatch && req.method === "PATCH") {
    if (!requireAdmin(user, res)) return;
    const body = await readBody(req);
    const areas = await readJson("areas");
    const area = areas.find((item) => item.id === areaMatch[1]);
    if (!area) {
      sendJson(res, 404, { error: "Bereich nicht gefunden." });
      return;
    }
    const name = sanitizeText(body.name, 60);
    if (areas.some((item) => item.id !== area.id && item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ein Bereich mit diesem Namen existiert bereits.");
    }
    area.name = name;
    area.color = sanitizeColor(body.color);
    area.updatedAt = new Date().toISOString();
    await writeJson("areas", areas);
    sendJson(res, 200, { area });
    return;
  }

  if (areaMatch && req.method === "DELETE") {
    if (!requireAdmin(user, res)) return;
    const [areas, users, tasks] = await Promise.all([
      readJson("areas"),
      readJson("users"),
      readJson("tasks")
    ]);
    const areaIndex = areas.findIndex((item) => item.id === areaMatch[1]);
    if (areaIndex < 0) {
      sendJson(res, 404, { error: "Bereich nicht gefunden." });
      return;
    }
    if (users.some((target) => Array.isArray(target.areaIds) && target.areaIds.includes(areaMatch[1]))) {
      sendJson(res, 409, { error: "Der Bereich ist noch Nutzern zugewiesen." });
      return;
    }
    if (tasks.some((task) => task.areaId === areaMatch[1])) {
      sendJson(res, 409, { error: "Der Bereich wird noch von Aufgaben verwendet." });
      return;
    }
    areas.splice(areaIndex, 1);
    await writeJson("areas", areas);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/groups") {
    if (!requireAdmin(user, res)) return;
    const body = await readBody(req);
    const groups = await readJson("groups");
    const name = sanitizeText(body.name, 60);
    if (groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Eine Gruppe mit diesem Namen existiert bereits.");
    }
    const group = {
      id: crypto.randomUUID(),
      name,
      color: sanitizeColor(body.color),
      permissions: sanitizePermissions(body.permissions),
      order: groups.length,
      createdAt: new Date().toISOString()
    };
    groups.push(group);
    await writeJson("groups", groups);
    sendJson(res, 201, { group });
    return;
  }

  const groupMatch = url.pathname.match(/^\/api\/groups\/([^/]+)$/);
  if (groupMatch && req.method === "PATCH") {
    if (!requireAdmin(user, res)) return;
    const body = await readBody(req);
    const groups = await readJson("groups");
    const group = groups.find((item) => item.id === groupMatch[1]);
    if (!group) {
      sendJson(res, 404, { error: "Gruppe nicht gefunden." });
      return;
    }
    if (body.action === "reorder") {
      const sorted = [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      sorted.forEach((item, index) => {
        if (typeof item.order !== "number") item.order = index;
      });
      const index = sorted.findIndex((item) => item.id === group.id);
      const swap = body.direction === "up" ? index - 1 : index + 1;
      if (swap >= 0 && swap < sorted.length) {
        const tmp = sorted[index].order;
        sorted[index].order = sorted[swap].order;
        sorted[swap].order = tmp;
        await writeJson("groups", groups);
      }
      sendJson(res, 200, { ok: true });
      return;
    }
    const name = sanitizeText(body.name, 60);
    if (groups.some((item) => item.id !== group.id && item.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Eine Gruppe mit diesem Namen existiert bereits.");
    }
    group.name = name;
    group.color = sanitizeColor(body.color);
    group.permissions = sanitizePermissions(body.permissions);
    group.updatedAt = new Date().toISOString();
    await writeJson("groups", groups);

    const users = await readJson("users");
    let usersChanged = false;
    for (const target of users) {
      if (target.groupId === group.id) {
        target.permissions = [...group.permissions];
        usersChanged = true;
      }
    }
    if (usersChanged) await writeJson("users", users);
    sendJson(res, 200, { group });
    return;
  }

  if (groupMatch && req.method === "DELETE") {
    if (!requireAdmin(user, res)) return;
    const [groups, users] = await Promise.all([readJson("groups"), readJson("users")]);
    const lead = findLeadGroup(groups);
    if (lead && groupMatch[1] === lead.id) {
      sendJson(res, 409, { error: "Die Standard-Leitungsrolle kann nicht geloescht werden." });
      return;
    }
    const groupIndex = groups.findIndex((item) => item.id === groupMatch[1]);
    if (groupIndex < 0) {
      sendJson(res, 404, { error: "Gruppe nicht gefunden." });
      return;
    }
    if (users.some((target) => target.groupId === groupMatch[1])) {
      sendJson(res, 409, { error: "Die Gruppe ist noch Nutzern zugewiesen und kann nicht geloescht werden." });
      return;
    }
    groups.splice(groupIndex, 1);
    await writeJson("groups", groups);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PATCH" && url.pathname === "/api/branding") {
    if (!requirePermission(user, "manage_settings", res)) return;
    const body = await readBody(req);
    const settings = await readJson("settings");
    const next = { ...DEFAULT_BRANDING, ...(settings.branding || {}) };
    if (body.productName !== undefined) next.productName = sanitizeText(body.productName, 40);
    if (body.tagline !== undefined) next.tagline = sanitizeText(body.tagline, 120, false);
    if (body.logoUrl !== undefined) next.logoUrl = sanitizeBrandingUrl(body.logoUrl) || DEFAULT_BRANDING.logoUrl;
    if (body.markUrl !== undefined) next.markUrl = sanitizeBrandingUrl(body.markUrl) || DEFAULT_BRANDING.markUrl;
    if (body.primaryColor !== undefined) next.primaryColor = sanitizeHexColor(body.primaryColor);
    if (body.accentColor !== undefined) next.accentColor = sanitizeHexColor(body.accentColor);
    settings.branding = next;
    await writeJson("settings", settings);
    sendJson(res, 200, { branding: next });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/statuses") {
    if (!requirePermission(user, "view_app", res)) return;
    sendJson(res, 200, { statuses: publicStatuses(await getStatuses()) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/statuses") {
    if (!requirePermission(user, "manage_settings", res)) return;
    const body = await readBody(req);
    const statuses = await readJson("statuses");
    const status = {
      id: crypto.randomUUID(),
      name: sanitizeText(body.name, 40),
      color: sanitizeHexColor(body.color),
      order: statuses.length,
      isDefault: false,
      isDone: Boolean(body.isDone)
    };
    statuses.push(status);
    await writeJson("statuses", statuses);
    sendJson(res, 201, { status, statuses: publicStatuses(statuses) });
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/statuses\/([^/]+)$/);
  if (statusMatch && req.method === "PATCH") {
    if (!requirePermission(user, "manage_settings", res)) return;
    const body = await readBody(req);
    const statuses = await readJson("statuses");
    const status = statuses.find((item) => item.id === statusMatch[1]);
    if (!status) {
      sendJson(res, 404, { error: "Status nicht gefunden." });
      return;
    }
    if (body.action === "reorder") {
      const sorted = [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const index = sorted.findIndex((item) => item.id === status.id);
      const swap = body.direction === "up" ? index - 1 : index + 1;
      if (swap >= 0 && swap < sorted.length) {
        const tmp = sorted[index].order;
        sorted[index].order = sorted[swap].order;
        sorted[swap].order = tmp;
        await writeJson("statuses", statuses);
      }
      sendJson(res, 200, { ok: true, statuses: publicStatuses(statuses) });
      return;
    }
    if (body.name !== undefined) status.name = sanitizeText(body.name, 40);
    if (body.color !== undefined) status.color = sanitizeHexColor(body.color);
    if (body.isDone !== undefined) status.isDone = Boolean(body.isDone);
    if (body.order !== undefined && Number.isFinite(Number(body.order))) {
      status.order = Number(body.order);
    }
    if (body.isDefault === true) {
      for (const item of statuses) item.isDefault = item.id === status.id;
    }
    await writeJson("statuses", statuses);
    sendJson(res, 200, { status, statuses: publicStatuses(statuses) });
    return;
  }

  if (statusMatch && req.method === "DELETE") {
    if (!requirePermission(user, "manage_settings", res)) return;
    const [statuses, tasks] = await Promise.all([readJson("statuses"), readJson("tasks")]);
    if (statuses.length <= 1) {
      sendJson(res, 409, { error: "Mindestens ein Status muss bestehen bleiben." });
      return;
    }
    const index = statuses.findIndex((item) => item.id === statusMatch[1]);
    if (index < 0) {
      sendJson(res, 404, { error: "Status nicht gefunden." });
      return;
    }
    if (tasks.some((task) => task.status === statusMatch[1])) {
      sendJson(res, 409, { error: "Dieser Status wird noch von Aufgaben verwendet." });
      return;
    }
    const [removed] = statuses.splice(index, 1);
    if (removed.isDefault && statuses.length) statuses[0].isDefault = true;
    statuses.forEach((item, order) => {
      item.order = order;
    });
    await writeJson("statuses", statuses);
    sendJson(res, 200, { ok: true, statuses: publicStatuses(statuses) });
    return;
  }

  if (url.pathname === "/api/tokens" && (req.method === "GET" || req.method === "POST")) {
    if (!requirePermission(user, "manage_settings", res)) return;
    if (user.isApiToken) {
      sendJson(res, 403, { error: "API-Tokens koennen nicht ueber die API verwaltet werden." });
      return;
    }
    if (req.method === "GET") {
      const tokens = await readJson("apiTokens");
      sendJson(res, 200, { tokens: tokens.map(publicApiToken) });
      return;
    }
    const body = await readBody(req);
    const name = sanitizeText(body.name, 60);
    const scope = body.scope === "write" ? "write" : "read";
    const tokens = await readJson("apiTokens");
    const secret = `${API_TOKEN_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
    const record = {
      id: crypto.randomUUID(),
      name,
      scope,
      prefix: secret.slice(0, 12),
      tokenHash: hashApiToken(secret),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    };
    tokens.push(record);
    await writeJson("apiTokens", tokens);
    sendJson(res, 201, { token: secret, record: publicApiToken(record) });
    return;
  }

  const tokenMatch = url.pathname.match(/^\/api\/tokens\/([^/]+)$/);
  if (tokenMatch && req.method === "DELETE") {
    if (!requirePermission(user, "manage_settings", res)) return;
    if (user.isApiToken) {
      sendJson(res, 403, { error: "API-Tokens koennen nicht ueber die API verwaltet werden." });
      return;
    }
    const tokens = await readJson("apiTokens");
    const index = tokens.findIndex((item) => item.id === tokenMatch[1]);
    if (index < 0) {
      sendJson(res, 404, { error: "Token nicht gefunden." });
      return;
    }
    tokens.splice(index, 1);
    await writeJson("apiTokens", tokens);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    if (!requirePermission(user, "view_app", res)) return;
    sendJson(res, 200, { tasks: await readJson("tasks") });
    return;
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && req.method === "PATCH") {
    if (!requirePermission(user, "manage_users", res)) return;
    const body = await readBody(req);
    const [users, groups, areas] = await Promise.all([
      readJson("users"),
      readJson("groups"),
      readJson("areas")
    ]);
    const target = users.find((item) => item.id === userMatch[1]);
    const group = groups.find((item) => item.id === body.groupId);
    if (!target || !group) {
      sendJson(res, 404, { error: "Nutzer oder Gruppe nicht gefunden." });
      return;
    }
    if (target.isAdmin && body.approved === false) {
      sendJson(res, 409, { error: "Ein Administrator kann nicht gesperrt werden." });
      return;
    }
    target.approved = body.approved !== false;
    target.groupId = target.approved ? group.id : null;
    target.permissions = target.approved ? [...group.permissions] : [];
    target.areaIds = target.approved ? sanitizeAreaIds(body.areaIds, areas) : [];
    target.approvedBy = user.id;
    target.approvedAt = target.approved ? new Date().toISOString() : null;
    await writeJson("users", users);
    sendJson(res, 200, { user: publicUser(target) });
    return;
  }

  if (userMatch && req.method === "DELETE") {
    if (!requirePermission(user, "manage_users", res)) return;
    if (userMatch[1] === user.id) {
      sendJson(res, 409, { error: "Du kannst dich nicht selbst loeschen." });
      return;
    }
    const [users, sessions] = await Promise.all([readJson("users"), readJson("sessions")]);
    const index = users.findIndex((item) => item.id === userMatch[1]);
    if (index < 0) {
      sendJson(res, 404, { error: "Nutzer nicht gefunden." });
      return;
    }
    if (users[index].isAdmin) {
      sendJson(res, 409, { error: "Ein Administrator kann nicht geloescht werden." });
      return;
    }
    users.splice(index, 1);
    await writeJson("users", users);
    await writeJson("sessions", sessions.filter((session) => session.userId !== userMatch[1]));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ideas") {
    if (!requirePermission(user, "view_app", res)) return;
    const [ideas, tasks] = await Promise.all([readJson("ideas"), readJson("tasks")]);
    sendJson(res, 200, { ideas: ideas.map((idea) => withSourceStatus(idea, tasks)) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ideas") {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const idea = {
      id: crypto.randomUUID(),
      text: sanitizeText(body.text, 2000),
      authorId: user.id,
      authorName: user.displayName,
      taskId: null,
      convertedBy: null,
      convertedAt: null,
      createdAt: now,
      updatedAt: now
    };
    const ideas = await readJson("ideas");
    ideas.unshift(idea);
    await writeJson("ideas", ideas);
    sendJson(res, 201, { idea });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/bugs") {
    if (!requirePermission(user, "view_app", res)) return;
    const [bugs, tasks] = await Promise.all([readJson("bugs"), readJson("tasks")]);
    sendJson(res, 200, { bugs: bugs.map((bug) => withSourceStatus(bug, tasks)) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bugs") {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const bug = {
      id: crypto.randomUUID(),
      subject: sanitizeText(body.subject, 120),
      description: sanitizeText(body.description, 3000),
      importance: ["niedrig", "mittel", "hoch", "kritisch"].includes(body.importance)
        ? body.importance
        : "mittel",
      media: null,
      authorId: user.id,
      authorName: user.displayName,
      taskId: null,
      convertedBy: null,
      convertedAt: null,
      createdAt: now,
      updatedAt: now
    };
    const bugs = await readJson("bugs");
    bugs.unshift(bug);
    await writeJson("bugs", bugs);
    sendJson(res, 201, { bug });
    return;
  }

  const bugMediaMatch = url.pathname.match(/^\/api\/bugs\/([^/]+)\/media$/);
  if (bugMediaMatch && req.method === "POST") {
    const bugs = await readJson("bugs");
    const bug = bugs.find((item) => item.id === bugMediaMatch[1]);
    if (!bug) {
      sendJson(res, 404, { error: "Bug-Report nicht gefunden." });
      return;
    }
    if (bug.authorId !== user.id && !hasPermission(user, "create_task")) {
      sendJson(res, 403, { error: "Du darfst zu diesem Bug keine Datei hochladen." });
      return;
    }
    if (bug.media) {
      sendJson(res, 409, { error: "Dieser Bug besitzt bereits einen Medienupload." });
      return;
    }
    const media = await receiveReportMedia(req);
    try {
      bug.media = {
        ...media,
        uploadedBy: user.id
      };
      bug.updatedAt = media.uploadedAt;
      await writeJson("bugs", bugs);
    } catch (error) {
      await fsp.unlink(path.join(REPORT_UPLOAD_DIR, media.fileName)).catch(() => {});
      throw error;
    }
    sendJson(res, 201, { media: bug.media, bug });
    return;
  }

  const sourceConvertMatch = url.pathname.match(/^\/api\/(ideas|bugs)\/([^/]+)\/convert$/);
  if (sourceConvertMatch && req.method === "POST") {
    if (!requirePermission(user, "create_task", res)) return;
    const body = await readBody(req);
    const sourceType = sourceConvertMatch[1] === "ideas" ? "idea" : "bug";
    const sourceCollection = sourceType === "idea" ? "ideas" : "bugs";
    const records = await readJson(sourceCollection);
    const record = records.find((item) => item.id === sourceConvertMatch[2]);
    if (!record) {
      sendJson(res, 404, {
        error: sourceType === "idea" ? "Idee nicht gefunden." : "Bug-Report nicht gefunden."
      });
      return;
    }
    if (record.taskId) {
      sendJson(res, 409, { error: "Daraus wurde bereits eine Aufgabe erstellt." });
      return;
    }
    const [users, areas, tasks] = await Promise.all([
      readJson("users"),
      readJson("areas"),
      readJson("tasks")
    ]);
    const task = await createTaskRecord(body, user, users, areas, {
      type: sourceType,
      id: record.id
    });
    tasks.unshift(task);
    record.taskId = task.id;
    record.convertedBy = user.id;
    record.convertedAt = new Date().toISOString();
    record.updatedAt = record.convertedAt;
    await writeJson("tasks", tasks);
    await writeJson(sourceCollection, records);
    sendJson(res, 201, { task, record });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    if (!requirePermission(user, "create_task", res)) return;
    const body = await readBody(req);
    const [users, areas, tasks] = await Promise.all([
      readJson("users"),
      readJson("areas"),
      readJson("tasks")
    ]);
    const task = await createTaskRecord(body, user, users, areas);
    tasks.unshift(task);
    await writeJson("tasks", tasks);
    sendJson(res, 201, { task });
    return;
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === "PATCH") {
    const body = await readBody(req);
    const [tasks, users, areas, statuses] = await Promise.all([
      readJson("tasks"),
      readJson("users"),
      readJson("areas"),
      getStatuses()
    ]);
    const task = tasks.find((item) => item.id === taskMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "Aufgabe nicht gefunden." });
      return;
    }
    if (body.action === "claim") {
      if (task.assigneeId) {
        sendJson(res, 409, { error: "Diese Aufgabe ist bereits zugewiesen." });
        return;
      }
      if (!hasPermission(user, "claim_task")) {
        sendJson(res, 403, { error: "Du darfst keine offenen Aufgaben übernehmen." });
        return;
      }
      if (!userBelongsToArea(user, task.areaId)) {
        sendJson(res, 403, { error: "Du gehörst nicht zum Bereich dieser Aufgabe." });
        return;
      }
      task.assigneeId = user.id;
    } else if (body.action === "set_due_date") {
      if (!isTaskAssignee(task, user)) {
        sendJson(res, 403, { error: "Nur die zugewiesene Person darf das Fertigstellungsdatum setzen." });
        return;
      }
      task.dueDate = sanitizeDate(body.dueDate);
    } else if (body.action === "set_area") {
      if (!isTaskAssignee(task, user)) {
        sendJson(res, 403, { error: "Nur die zugewiesene Person darf den Aufgabenbereich ändern." });
        return;
      }
      const nextAreaId = sanitizeTaskAreaId(body.areaId, areas);
      if (nextAreaId && !userBelongsToArea(user, nextAreaId)) {
        sendJson(res, 403, { error: "Du kannst die Aufgabe nur in einen deiner Bereiche verschieben." });
        return;
      }
      task.areaId = nextAreaId;
    } else if (body.action === "set_status") {
      if (!isTaskAssignee(task, user) && !hasPermission(user, "manage_tasks")) {
        sendJson(res, 403, { error: "Du darfst nur den Status deiner eigenen Aufgaben ändern." });
        return;
      }
      if (!statuses.some((status) => status.id === body.status)) {
        sendJson(res, 400, { error: "Der ausgewählte Aufgabenstatus ist ungültig." });
        return;
      }
      task.status = body.status;
    } else {
      if (!hasPermission(user, "manage_tasks")) {
        sendJson(res, 403, { error: "Du darfst die Aufgabe nicht allgemein bearbeiten." });
        return;
      }
      const nextAreaId =
        body.areaId !== undefined ? sanitizeTaskAreaId(body.areaId, areas) : task.areaId || null;
      const nextAssigneeId =
        body.assigneeId !== undefined ? body.assigneeId || null : task.assigneeId || null;
      validateTaskAssignee(users, nextAssigneeId, nextAreaId);
      if (body.title !== undefined) task.title = sanitizeText(body.title, 100);
      if (body.description !== undefined) {
        task.description = sanitizeText(body.description, 1000, false);
      }
      if (body.roadmap !== undefined) {
        task.roadmap = sanitizeText(body.roadmap, 3000, false);
      }
      if (taskProjectTypes.has(body.projectType)) task.projectType = body.projectType;
      if (["niedrig", "mittel", "hoch", "kritisch"].includes(body.priority)) task.priority = body.priority;
      if (statuses.some((status) => status.id === body.status)) {
        task.status = body.status;
      }
      task.areaId = nextAreaId;
      task.assigneeId = nextAssigneeId;
    }
    task.updatedAt = new Date().toISOString();
    await writeJson("tasks", tasks);
    sendJson(res, 200, { task });
    return;
  }

  if (taskMatch && req.method === "DELETE") {
    if (!requirePermission(user, "manage_tasks", res)) return;
    const tasks = await readJson("tasks");
    const taskIndex = tasks.findIndex((item) => item.id === taskMatch[1]);
    if (taskIndex < 0) {
      sendJson(res, 404, { error: "Aufgabe nicht gefunden." });
      return;
    }
    const [deletedTask] = tasks.splice(taskIndex, 1);
    await Promise.all((deletedTask.images || []).map(deleteTaskImageFile));
    await writeJson("tasks", tasks);
    if (
      deletedTask.source?.id &&
      ["idea", "bug"].includes(deletedTask.source.type)
    ) {
      const sourceCollection = deletedTask.source.type === "idea" ? "ideas" : "bugs";
      const records = await readJson(sourceCollection);
      const record = records.find((item) => item.id === deletedTask.source.id);
      if (record?.taskId === deletedTask.id) {
        record.taskId = null;
        record.convertedBy = null;
        record.convertedAt = null;
        record.updatedAt = new Date().toISOString();
        await writeJson(sourceCollection, records);
      }
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  const taskImagesMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/images$/);
  if (taskImagesMatch && req.method === "POST") {
    const body = await readBody(req, 8_000_000);
    const tasks = await readJson("tasks");
    const task = tasks.find((item) => item.id === taskImagesMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "Aufgabe nicht gefunden." });
      return;
    }
    const mayUpload = hasPermission(user, "manage_tasks") || task.createdBy === user.id;
    if (!mayUpload) {
      sendJson(res, 403, { error: "Du darfst dieser Aufgabe keine Bilder hinzufügen." });
      return;
    }
    if (!Array.isArray(task.images)) task.images = [];
    if (task.images.length >= 5) {
      sendJson(res, 409, { error: "Pro Aufgabe sind maximal fünf Bilder möglich." });
      return;
    }
    const imageData = decodeTaskImage(body);
    await fsp.mkdir(TASK_UPLOAD_DIR, { recursive: true });
    const imageId = crypto.randomUUID();
    const fileName = `${imageId}${imageData.extension}`;
    await fsp.writeFile(path.join(TASK_UPLOAD_DIR, fileName), imageData.buffer, {
      flag: "wx"
    });
    const image = {
      id: imageId,
      fileName,
      url: `/uploads/tasks/${fileName}`,
      originalName: sanitizeText(body.name || "Bild", 120),
      mimeType: imageData.mimeType,
      size: imageData.buffer.length,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString()
    };
    task.images.push(image);
    task.updatedAt = image.uploadedAt;
    await writeJson("tasks", tasks);
    sendJson(res, 201, { image, task });
    return;
  }

  const taskImageMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/images\/([^/]+)$/);
  if (taskImageMatch && req.method === "DELETE") {
    if (!requirePermission(user, "manage_tasks", res)) return;
    const tasks = await readJson("tasks");
    const task = tasks.find((item) => item.id === taskImageMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "Aufgabe nicht gefunden." });
      return;
    }
    if (!Array.isArray(task.images)) task.images = [];
    const imageIndex = task.images.findIndex((image) => image.id === taskImageMatch[2]);
    if (imageIndex < 0) {
      sendJson(res, 404, { error: "Bild nicht gefunden." });
      return;
    }
    const [image] = task.images.splice(imageIndex, 1);
    await deleteTaskImageFile(image);
    task.updatedAt = new Date().toISOString();
    await writeJson("tasks", tasks);
    sendJson(res, 200, { task });
    return;
  }

  const taskNotesMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/notes$/);
  if (taskNotesMatch && req.method === "POST") {
    const body = await readBody(req);
    const tasks = await readJson("tasks");
    const task = tasks.find((item) => item.id === taskNotesMatch[1]);
    if (!task) {
      sendJson(res, 404, { error: "Aufgabe nicht gefunden." });
      return;
    }
    const note = {
      id: crypto.randomUUID(),
      text: sanitizeText(body.text, 1500),
      authorId: user.id,
      authorName: user.displayName,
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(task.notes)) task.notes = [];
    task.notes.push(note);
    task.updatedAt = note.createdAt;
    await writeJson("tasks", tasks);
    sendJson(res, 201, { note, task });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/changelogs") {
    if (!requirePermission(user, "submit_changelog", res)) return;
    const body = await readBody(req);
    if (!["hinzugefuegt", "bearbeitet", "entfernt"].includes(body.type)) {
      throw new Error("Ungueltiger Changelog-Typ.");
    }
    const now = new Date().toISOString();
    const entry = {
      id: crypto.randomUUID(),
      type: body.type,
      scriptName: sanitizeText(body.scriptName, 80),
      description: sanitizeText(body.description, 500),
      authorId: user.id,
      authorName: user.displayName,
      approved: false,
      approvedBy: null,
      approvedAt: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now
    };
    const changelogs = await readJson("changelogs");
    changelogs.unshift(entry);
    await writeJson("changelogs", changelogs);
    sendJson(res, 201, { entry });
    return;
  }

  const changeMatch = url.pathname.match(/^\/api\/changelogs\/([^/]+)$/);
  if (changeMatch && req.method === "PATCH") {
    if (!requirePermission(user, "approve_changelog", res)) return;
    const body = await readBody(req);
    const changelogs = await readJson("changelogs");
    const entry = changelogs.find((item) => item.id === changeMatch[1]);
    if (!entry) {
      sendJson(res, 404, { error: "Changelog-Eintrag nicht gefunden." });
      return;
    }
    if (body.type && ["hinzugefuegt", "bearbeitet", "entfernt"].includes(body.type)) {
      entry.type = body.type;
    }
    if (body.scriptName !== undefined) entry.scriptName = sanitizeText(body.scriptName, 80);
    if (body.description !== undefined) entry.description = sanitizeText(body.description, 500);
    if (body.approved !== undefined) {
      entry.approved = Boolean(body.approved);
      entry.approvedBy = entry.approved ? user.id : null;
      entry.approvedAt = entry.approved ? new Date().toISOString() : null;
    }
    entry.updatedAt = new Date().toISOString();
    await writeJson("changelogs", changelogs);
    sendJson(res, 200, { entry });
    return;
  }

  if (changeMatch && req.method === "DELETE") {
    const changelogs = await readJson("changelogs");
    const entryIndex = changelogs.findIndex((item) => item.id === changeMatch[1]);
    const entry = changelogs[entryIndex];
    if (!entry) {
      sendJson(res, 404, { error: "Changelog-Eintrag nicht gefunden." });
      return;
    }
    if (entry.publishedAt) {
      sendJson(res, 409, { error: "Bereits veroeffentlichte Eintraege koennen nicht geloescht werden." });
      return;
    }
    const mayDelete =
      hasPermission(user, "delete_changelog") ||
      (entry.authorId === user.id && !entry.approved && hasPermission(user, "submit_changelog"));
    if (!mayDelete) {
      sendJson(res, 403, { error: "Du darfst diesen Changelog-Eintrag nicht loeschen." });
      return;
    }
    changelogs.splice(entryIndex, 1);
    await writeJson("changelogs", changelogs);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/changelogs/push") {
    if (!requirePermission(user, "push_changelog", res)) return;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("Der Discord-Webhook ist noch nicht konfiguriert.");
    const body = await readBody(req);
    const effectiveDate = new Date(body.effectiveAt);
    if (Number.isNaN(effectiveDate.getTime())) throw new Error("Bitte eine gueltige Restart-Zeit angeben.");
    const changelogs = await readJson("changelogs");
    if (!changelogs.length) throw new Error("Der aktive Changelog ist leer.");
    const pendingEntries = changelogs.filter((entry) => !entry.approved);
    if (pendingEntries.length) {
      throw new Error(
        `Vor dem Push muessen alle Eintraege freigegeben sein. Noch offen: ${pendingEntries.length}.`
      );
    }
    const entries = [...changelogs];

    const labels = {
      hinzugefuegt: "Hinzugefuegt",
      bearbeitet: "Bearbeitet",
      entfernt: "Entfernt"
    };
    const sections = Object.keys(labels).map((type) => {
      const lines = entries
        .filter((entry) => entry.type === type)
        .map((entry) => `- **${entry.scriptName}** - ${entry.description}`);
      return `**${labels[type]}:**\n${lines.length ? lines.join("\n") : "- nichts"}`;
    });
    const unix = Math.floor(effectiveDate.getTime() / 1000);
    const today = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin"
    }).format(new Date());
    const payload = {
      username: (await getBranding()).productName,
      embeds: [
        {
          title: `Changelog vom ${today}`,
          color: 0x8b5cf6,
          description: `${sections.join("\n\n")}\n\n**Changelog gilt ab dem Restart um <t:${unix}:F>**`,
          footer: { text: `Freigegeben von ${user.displayName}` },
          timestamp: effectiveDate.toISOString()
        }
      ]
    };
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!webhookResponse.ok) throw new Error("Discord-Webhook konnte nicht gesendet werden.");

    const publishedAt = new Date().toISOString();
    const archive = await readJson("changelogArchive");
    const archiveEntry = {
      id: crypto.randomUUID(),
      title: `Changelog vom ${today}`,
      publishedAt,
      effectiveAt: effectiveDate.toISOString(),
      publishedBy: user.id,
      publishedByName: user.displayName,
      entries: entries.map((entry) => ({ ...entry, publishedAt }))
    };
    archive.unshift(archiveEntry);
    await writeJson("changelogArchive", archive);
    await writeJson("changelogs", []);
    const settings = await readJson("settings");
    settings.lastChangelogPush = {
      archiveId: archiveEntry.id,
      publishedAt,
      effectiveAt: effectiveDate.toISOString(),
      publishedBy: user.id,
      entryCount: entries.length
    };
    await writeJson("settings", settings);
    sendJson(res, 200, { ok: true, count: entries.length, archive: archiveEntry });
    return;
  }

  sendJson(res, 404, { error: "API-Endpunkt nicht gefunden." });
}

async function serveStatic(url, res) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Zugriff verweigert." });
    return;
  }
  try {
    const data = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const cacheControl =
      [".html", ".js", ".css"].includes(extension)
        ? "no-cache"
        : IS_PRODUCTION
          ? "public, max-age=300"
          : "no-store";
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": cacheControl
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await fsp.readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(index);
      return;
    }
    throw error;
  }
}

async function serveTaskUpload(req, url, res) {
  const user = await getCurrentUser(req);
  if (!hasPermission(user, "view_app")) {
    sendJson(res, 403, { error: "Zugriff verweigert." });
    return;
  }
  const fileName = path.basename(decodeURIComponent(url.pathname.slice("/uploads/tasks/".length)));
  if (!/^[0-9a-f-]+\.(?:jpg|png|webp|gif)$/i.test(fileName)) {
    sendJson(res, 404, { error: "Nicht gefunden." });
    return;
  }
  try {
    const filePath = path.join(TASK_UPLOAD_DIR, fileName);
    const data = await fsp.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Bild nicht gefunden." });
      return;
    }
    throw error;
  }
}

async function serveReportUpload(req, url, res) {
  const user = await getCurrentUser(req);
  if (!hasPermission(user, "view_app")) {
    sendJson(res, 403, { error: "Zugriff verweigert." });
    return;
  }
  const fileName = path.basename(decodeURIComponent(url.pathname.slice("/uploads/reports/".length)));
  if (!/^[0-9a-f-]+\.(?:jpg|png|webp|gif|mp4|webm|mov)$/i.test(fileName)) {
    sendJson(res, 404, { error: "Nicht gefunden." });
    return;
  }

  try {
    const filePath = path.join(REPORT_UPLOAD_DIR, fileName);
    const stats = await fsp.stat(filePath);
    const contentType =
      mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes"
    };
    let start = 0;
    let end = stats.size - 1;
    let status = 200;
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
        res.end();
        return;
      }
      if (!match[1] && match[2]) {
        const suffixLength = Math.min(Number(match[2]), stats.size);
        start = stats.size - suffixLength;
      } else {
        start = Number(match[1] || 0);
        end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= stats.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
        res.end();
        return;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
    }

    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", reject);
      stream.on("end", resolve);
      res.on("close", resolve);
      stream.pipe(res);
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Medienupload nicht gefunden." });
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (blockedPublicPaths.test(url.pathname)) {
      sendJson(res, 404, { error: "Nicht gefunden." });
      return;
    }
    if (req.method === "GET" && url.pathname === "/auth/discord") {
      await handleDiscordStart(res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/auth/discord/callback") {
      await handleDiscordCallback(url, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/uploads/tasks/")) {
      await serveTaskUpload(req, url, res);
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/uploads/reports/")) {
      await serveReportUpload(req, url, res);
      return;
    }
    if (req.method === "GET") {
      await serveStatic(url, res);
      return;
    }
    sendJson(res, 405, { error: "Methode nicht erlaubt." });
  } catch (error) {
    if (!error.statusCode || error.statusCode >= 500) console.error(error);
    if (!res.headersSent) {
      sendJson(res, error.statusCode || 400, {
        error: error.message || "Interner Serverfehler."
      });
    } else {
      res.destroy();
    }
  }
});

async function startServer() {
  await migrateTaskStatuses();
  await migratePublishedChangelogs();
  server.listen(PORT, HOST, () => {
    console.log(`Planara laeuft auf http://${HOST}:${PORT}`);
    if (!IS_PRODUCTION) console.log("Lokaler Demo-Login ist aktiviert.");
  });
  if (UPDATE_CHECK_ENABLED) {
    checkForUpdate();
    setInterval(checkForUpdate, 6 * 60 * 60 * 1000).unref();
  }
}

startServer().catch((error) => {
  console.error("Server konnte nicht gestartet werden:", error);
  process.exitCode = 1;
});
