// Minimal demo app used as the system under test.
// Plain Node.js (no dependencies) so the project stays focused on the tests.
// Features: session login, role-based access (admin / staff), applicant onboarding
// with server-side validation and duplicate-email prevention.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Demo accounts. Never store plain-text passwords in a real system.
const USERS = [
  { id: 1, name: 'Ada Admin', email: 'admin@demo.test', password: 'Admin123!', role: 'admin' },
  { id: 2, name: 'Sam Staff', email: 'staff@demo.test', password: 'Staff123!', role: 'staff' },
];

const sessions = new Map(); // session token -> user id
const applicants = []; // in-memory store, resets when the server restarts

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{10,14}$/;
const TRACKS = ['creator', 'sales', 'operations'];

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

// Resolves to the parsed body, {} for an empty body, or null for invalid JSON
// or JSON that is not an object (e.g. a bare string or an array).
function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const parsed = JSON.parse(data);
        const isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
        resolve(isObject ? parsed : null);
      } catch {
        resolve(null);
      }
    });
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key]) => key)
      .map(([key, ...rest]) => [key, decodeURIComponent(rest.join('='))]),
  );
}

function currentUser(req) {
  const token = parseCookies(req).session;
  const userId = token && sessions.get(token);
  return USERS.find((u) => u.id === userId) || null;
}

function publicUser({ password, ...user }) {
  return user;
}

function validateApplicant(body) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const value = {
    fullName: str(body.fullName),
    email: str(body.email).toLowerCase(),
    phone: str(body.phone).replace(/[\s-]/g, ''),
    track: str(body.track),
  };
  const errors = {};
  if (value.fullName.length < 2) errors.fullName = 'Full name is required.';
  if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address.';
  if (!PHONE_RE.test(value.phone)) errors.phone = 'Enter a valid phone number (10 to 14 digits).';
  if (!TRACKS.includes(value.track)) errors.track = 'Select a track.';
  if (body.consent !== true) errors.consent = 'You must accept the terms.';
  return { value, errors };
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') return sendJson(res, 200, { status: 'ok' });

  if (route === 'POST /api/login') {
    const body = await readJson(req);
    if (body === null) return sendJson(res, 400, { error: 'Invalid JSON body.' });
    if (!body.email || !body.password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }
    const email = String(body.email).trim().toLowerCase();
    const user = USERS.find((u) => u.email === email && u.password === body.password);
    if (!user) return sendJson(res, 401, { error: 'Invalid email or password.' });

    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return sendJson(res, 200, { user: publicUser(user) }, {
      'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Lax`,
    });
  }

  if (route === 'POST /api/logout') {
    const token = parseCookies(req).session;
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
    });
  }

  // Everything below requires a signed-in user.
  const user = currentUser(req);
  if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

  if (route === 'GET /api/me') return sendJson(res, 200, { user: publicUser(user) });

  if (route === 'GET /api/admin/users') {
    if (user.role !== 'admin') return sendJson(res, 403, { error: 'Forbidden.' });
    return sendJson(res, 200, { users: USERS.map(publicUser), applicantCount: applicants.length });
  }

  if (route === 'POST /api/applicants') {
    const body = await readJson(req);
    if (body === null) return sendJson(res, 400, { error: 'Invalid JSON body.' });
    const { value, errors } = validateApplicant(body);
    if (Object.keys(errors).length) {
      return sendJson(res, 400, { error: 'Validation failed.', fields: errors });
    }
    if (applicants.some((a) => a.email === value.email)) {
      return sendJson(res, 409, {
        error: 'Duplicate applicant.',
        fields: { email: 'An applicant with this email already exists.' },
      });
    }
    const applicant = {
      id: applicants.length + 1,
      ...value,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    applicants.push(applicant);
    return sendJson(res, 201, { applicant });
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

function serveStatic(res, url) {
  const pathname = url.pathname === '/' ? '/login.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error(err);
      sendJson(res, 500, { error: 'Internal server error.' });
    });
    return;
  }
  serveStatic(res, url);
});

server.listen(PORT, () => {
  console.log(`Demo app running at http://localhost:${PORT}`);
});
