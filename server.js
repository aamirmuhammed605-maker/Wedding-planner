const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

// Keep local development convenient without adding a dotenv dependency. Hosting
// providers can still inject normal process environment variables as usual.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = process.env.DB_FILE ? path.resolve(ROOT, process.env.DB_FILE) : path.join(DATA_DIR, 'planner.sqlite');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, time TEXT DEFAULT '',
    venue TEXT DEFAULT '', address TEXT DEFAULT '', maps_url TEXT DEFAULT '',
    status TEXT DEFAULT 'Planned', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT NOT NULL, event_id INTEGER, vendor TEXT DEFAULT '',
    agreed_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0, additional_paid REAL DEFAULT 0,
    payment_date TEXT DEFAULT '', next_due_date TEXT DEFAULT '', payment_method TEXT DEFAULT 'UPI',
    status TEXT DEFAULT 'Pending', notes TEXT DEFAULT '', attachment_url TEXT DEFAULT '', created_at TEXT NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, service_type TEXT DEFAULT '', phone TEXT DEFAULT '', address TEXT DEFAULT '',
    quotation_amount REAL DEFAULT 0, negotiated_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
    booking_status TEXT DEFAULT 'To confirm', payment_deadline TEXT DEFAULT '', agreement_details TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT DEFAULT '', responsible TEXT DEFAULT '', priority TEXT DEFAULT 'Medium',
    event_id INTEGER, start_date TEXT DEFAULT '', deadline TEXT DEFAULT '', status TEXT DEFAULT 'Not Started',
    notes TEXT DEFAULT '', created_at TEXT NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS travel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL, title TEXT NOT NULL, start_location TEXT DEFAULT '', destination TEXT DEFAULT '',
    travel_date TEXT DEFAULT '', departure_time TEXT DEFAULT '', arrival_time TEXT DEFAULT '', distance_km REAL DEFAULT 0,
    passengers INTEGER DEFAULT 0, driver TEXT DEFAULT '', estimated_cost REAL DEFAULT 0, fuel_cost REAL DEFAULT 0,
    toll_cost REAL DEFAULT 0, parking_cost REAL DEFAULT 0, rental_cost REAL DEFAULT 0, advance_paid REAL DEFAULT 0,
    status TEXT DEFAULT 'Planned', reference TEXT DEFAULT '', maps_url TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, side TEXT DEFAULT 'Family', phone TEXT DEFAULT '', rsvp TEXT DEFAULT 'Pending',
    event_id INTEGER, guest_count INTEGER DEFAULT 1, notes TEXT DEFAULT '', created_at TEXT NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS accommodation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, location TEXT DEFAULT '', maps_url TEXT DEFAULT '', check_in TEXT DEFAULT '', check_out TEXT DEFAULT '',
    rooms INTEGER DEFAULT 0, guests INTEGER DEFAULT 0, room_type TEXT DEFAULT '', booking_reference TEXT DEFAULT '', phone TEXT DEFAULT '',
    total_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0, cancellation_policy TEXT DEFAULT '', status TEXT DEFAULT 'Planned', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS construction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL, category TEXT DEFAULT 'Miscellaneous', supplier TEXT DEFAULT '', quantity REAL DEFAULT 0,
    unit_price REAL DEFAULT 0, total_amount REAL DEFAULT 0, advance_paid REAL DEFAULT 0, amount_paid REAL DEFAULT 0,
    payment_date TEXT DEFAULT '', stage TEXT DEFAULT 'Planning', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS family_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT DEFAULT 'Other', amount REAL DEFAULT 0, payment_date TEXT DEFAULT '',
    frequency TEXT DEFAULT 'One-off', payment_method TEXT DEFAULT 'UPI', notes TEXT DEFAULT '', created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const seed = (table, values) => {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map(key => values[key]));
};

if (db.prepare('SELECT COUNT(*) AS count FROM settings').get().count === 0) {
  seed('settings', { key: 'planner_name', value: 'Ashikha & Afzal Wedding Command Centre' });
  seed('settings', { key: 'wedding_budget', value: '0' });
  seed('settings', { key: 'currency', value: 'INR' });
  seed('settings', { key: 'timezone', value: 'Asia/Kolkata' });
}
if (db.prepare('SELECT COUNT(*) AS count FROM events').get().count === 0) {
  seed('events', { name: 'Mehendi', type: 'Pre-wedding', date: '2027-01-08', time: 'Evening', venue: 'Family residence', address: 'Hennas House, Vanimel, Kozhikkode', maps_url: '', status: 'Planned', notes: 'Decoration, food, costumes, photography and transportation are editable here.', created_at: now() });
  seed('events', { name: 'Nikah / Wedding Ceremony', type: 'Wedding', date: '2027-01-09', time: '4:00 PM', venue: 'Athafy Auditorium, Vadakara', address: 'Vadakara, Kerala, India', maps_url: 'https://maps.app.goo.gl/3YiYevoiUjohNGTk7', status: 'Confirmed', notes: 'Wedding ceremony arrangements, food, decoration, photography, transport and accommodation.', created_at: now() });
  seed('events', { name: 'Reception', type: 'Reception', date: '2027-01-14', time: '6:00 PM', venue: 'Eden Garden Convention Centre', address: 'Pandalam, Pathanamthitta, Kerala, India', maps_url: 'https://maps.google.com/?q=Pandalam%2C+Pathanamthitta%2C+Kerala', status: 'Confirmed', notes: 'Accommodation is optional and can be added in the accommodation section.', created_at: now() });
}
if (db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count === 0) {
  const weddingId = db.prepare("SELECT id FROM events WHERE name = 'Nikah / Wedding Ceremony'").get()?.id || null;
  ['Confirm photographer', 'Book auditorium', 'Confirm catering', 'Finalise guest list', 'Confirm decoration', 'Confirm transportation'].forEach((name, index) => seed('tasks', { name, description: '', responsible: '', priority: index < 2 ? 'High' : 'Medium', event_id: weddingId, start_date: '', deadline: '', status: 'Not Started', notes: '', created_at: now() }));
}

const resources = {
  events: { table: 'events', columns: ['name', 'type', 'date', 'time', 'venue', 'address', 'maps_url', 'status', 'notes'], required: ['name', 'date'] },
  expenses: { table: 'expenses', columns: ['name', 'category', 'event_id', 'vendor', 'agreed_amount', 'advance_paid', 'additional_paid', 'payment_date', 'next_due_date', 'payment_method', 'status', 'notes', 'attachment_url'], required: ['name', 'category'] },
  vendors: { table: 'vendors', columns: ['name', 'service_type', 'phone', 'address', 'quotation_amount', 'negotiated_amount', 'advance_paid', 'booking_status', 'payment_deadline', 'agreement_details', 'notes'], required: ['name'] },
  tasks: { table: 'tasks', columns: ['name', 'description', 'responsible', 'priority', 'event_id', 'start_date', 'deadline', 'status', 'notes'], required: ['name'] },
  travel: { table: 'travel', columns: ['mode', 'title', 'start_location', 'destination', 'travel_date', 'departure_time', 'arrival_time', 'distance_km', 'passengers', 'driver', 'estimated_cost', 'fuel_cost', 'toll_cost', 'parking_cost', 'rental_cost', 'advance_paid', 'status', 'reference', 'maps_url', 'notes'], required: ['mode', 'title'] },
  guests: { table: 'guests', columns: ['name', 'side', 'phone', 'rsvp', 'event_id', 'guest_count', 'notes'], required: ['name'] },
  accommodation: { table: 'accommodation', columns: ['name', 'location', 'maps_url', 'check_in', 'check_out', 'rooms', 'guests', 'room_type', 'booking_reference', 'phone', 'total_amount', 'advance_paid', 'cancellation_policy', 'status', 'notes'], required: ['name'] },
  construction: { table: 'construction', columns: ['description', 'category', 'supplier', 'quantity', 'unit_price', 'total_amount', 'advance_paid', 'amount_paid', 'payment_date', 'stage', 'notes'], required: ['description'] },
  familyExpenses: { table: 'family_expenses', columns: ['name', 'category', 'amount', 'payment_date', 'frequency', 'payment_method', 'notes'], required: ['name'] },
};

const numberFields = new Set(['event_id', 'agreed_amount', 'advance_paid', 'additional_paid', 'quotation_amount', 'negotiated_amount', 'distance_km', 'passengers', 'estimated_cost', 'fuel_cost', 'toll_cost', 'parking_cost', 'rental_cost', 'guest_count', 'rooms', 'guests', 'total_amount', 'quantity', 'unit_price', 'amount_paid', 'amount']);
const normalize = (resource, input) => {
  const spec = resources[resource];
  const output = {};
  for (const key of spec.columns) {
    if (!(key in input)) continue;
    const value = input[key];
    output[key] = numberFields.has(key) ? (value === '' || value === null || value === undefined ? 0 : Number(value) || 0) : String(value ?? '').trim();
  }
  return output;
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function sendError(res, status, message) { sendJson(res, status, { error: message }); }
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 2_000_000) reject(new Error('Payload too large')); });
    req.on('end', () => { if (!body) return resolve({}); try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function rows(resource, searchParams) {
  const spec = resources[resource];
  let sql = `SELECT * FROM ${spec.table}`;
  const filters = [];
  const values = [];
  if (searchParams.get('event_id')) { filters.push('event_id = ?'); values.push(Number(searchParams.get('event_id'))); }
  if (searchParams.get('status')) { filters.push('status = ?'); values.push(searchParams.get('status')); }
  if (searchParams.get('rsvp')) { filters.push('rsvp = ?'); values.push(searchParams.get('rsvp')); }
  if (searchParams.get('q')) {
    const q = `%${searchParams.get('q')}%`;
    const searchable = ['name', 'description', 'vendor', 'supplier', 'title', 'destination', 'location', 'category'].filter(column => spec.columns.includes(column));
    if (searchable.length) { filters.push(`(${searchable.map(column => `${column} LIKE ?`).join(' OR ')})`); values.push(...searchable.map(() => q)); }
  }
  if (filters.length) sql += ` WHERE ${filters.join(' AND ')}`;
  sql += ' ORDER BY id DESC';
  return db.prepare(sql).all(...values);
}
function calculateSummary() {
  const budget = Number(db.prepare("SELECT value FROM settings WHERE key = 'wedding_budget'").get()?.value || 0);
  const expense = db.prepare('SELECT COALESCE(SUM(agreed_amount),0) AS agreed, COALESCE(SUM(advance_paid),0) AS advances, COALESCE(SUM(additional_paid),0) AS additional FROM expenses').get();
  const construction = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(amount_paid),0) AS paid FROM construction').get();
  const family = db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM family_expenses').get();
  const tasks = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed FROM tasks").get();
  const guests = db.prepare("SELECT COALESCE(SUM(guest_count),0) AS total, SUM(CASE WHEN rsvp = 'Confirmed' THEN guest_count ELSE 0 END) AS confirmed FROM guests").get();
  const categories = db.prepare('SELECT category, COALESCE(SUM(advance_paid + additional_paid),0) AS spent FROM expenses GROUP BY category ORDER BY spent DESC').all();
  const upcomingEvents = db.prepare("SELECT * FROM events WHERE date >= date('now', 'localtime') ORDER BY date ASC LIMIT 4").all();
  const upcomingPayments = db.prepare("SELECT * FROM expenses WHERE next_due_date <> '' AND next_due_date >= date('now', 'localtime') ORDER BY next_due_date ASC LIMIT 5").all();
  const spent = Number(expense.advances || 0) + Number(expense.additional || 0);
  return { budget, agreed: Number(expense.agreed || 0), advances: Number(expense.advances || 0), spent, outstanding: Math.max(0, Number(expense.agreed || 0) - spent), construction: { total: Number(construction.total || 0), paid: Number(construction.paid || 0), outstanding: Math.max(0, Number(construction.total || 0) - Number(construction.paid || 0)) }, familyTotal: Number(family.total || 0), tasks: { total: Number(tasks.total || 0), completed: Number(tasks.completed || 0), pending: Number(tasks.total || 0) - Number(tasks.completed || 0) }, guests: { total: Number(guests.total || 0), confirmed: Number(guests.confirmed || 0) }, categories, upcomingEvents, upcomingPayments, recentExpenses: db.prepare('SELECT * FROM expenses ORDER BY id DESC LIMIT 6').all() };
}
function csvValue(value) { const text = value === null || value === undefined ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function exportCsv(res, resource) {
  const spec = resources[resource]; if (!spec) return sendError(res, 404, 'Unknown export');
  const data = rows(resource, new URLSearchParams());
  const headers = data.length ? Object.keys(data[0]) : spec.columns.concat(['id', 'created_at']);
  const body = [headers.join(','), ...data.map(row => headers.map(key => csvValue(row[key])).join(','))].join('\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${resource}.csv"` }); res.end(body);
}
function allData() {
  const backup = { version: 1, exportedAt: now(), settings: db.prepare('SELECT * FROM settings').all() };
  for (const [key, spec] of Object.entries(resources)) backup[key] = db.prepare(`SELECT * FROM ${spec.table}`).all();
  return backup;
}
function restoreData(payload) {
  db.exec('BEGIN');
  try {
    for (const [key, spec] of Object.entries(resources)) {
      db.prepare(`DELETE FROM ${spec.table}`).run();
      for (const row of Array.isArray(payload[key]) ? payload[key] : []) {
        const data = normalize(key, row); const columns = spec.columns.filter(column => column in data); if (!columns.length) continue;
        const values = columns.map(column => data[column]); db.prepare(`INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
      }
    }
    if (Array.isArray(payload.settings)) { db.prepare('DELETE FROM settings').run(); for (const setting of payload.settings) if (setting.key) db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(setting.key, String(setting.value ?? '')); }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const resource = parts[1];
  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'wedding-family-planner', time: now() });
  if (url.pathname === '/api/summary' && req.method === 'GET') return sendJson(res, 200, calculateSummary());
  if (url.pathname === '/api/backup' && req.method === 'GET') return sendJson(res, 200, allData());
  if (url.pathname === '/api/restore' && req.method === 'POST') { try { restoreData(await parseBody(req)); return sendJson(res, 200, { ok: true }); } catch (error) { return sendError(res, 400, error.message); } }
  if (parts[1] === 'export' && req.method === 'GET') return exportCsv(res, parts[2]);
  if (url.pathname === '/api/settings' && req.method === 'GET') { const entries = db.prepare('SELECT key,value FROM settings').all(); return sendJson(res, 200, Object.fromEntries(entries.map(entry => [entry.key, entry.value]))); }
  if (url.pathname === '/api/settings' && req.method === 'PATCH') { try { const body = await parseBody(req); for (const [key, value] of Object.entries(body)) db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, String(value)); return sendJson(res, 200, body); } catch (error) { return sendError(res, 400, error.message); } }
  if (!resources[resource]) return sendError(res, 404, 'Resource not found');
  const spec = resources[resource]; const id = parts[2] ? Number(parts[2]) : null;
  try {
    if (req.method === 'GET') return sendJson(res, 200, rows(resource, url.searchParams));
    if (req.method === 'POST') {
      const input = normalize(resource, await parseBody(req));
      for (const required of spec.required) if (!input[required]) return sendError(res, 422, `${required} is required`);
      const columns = Object.keys(input); const result = db.prepare(`INSERT INTO ${spec.table} (${columns.join(', ')}, created_at) VALUES (${columns.map(() => '?').join(', ')}, ?)`).run(...columns.map(column => input[column]), now());
      return sendJson(res, 201, db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(Number(result.lastInsertRowid)));
    }
    if (!id) return sendError(res, 400, 'An id is required');
    if (req.method === 'PATCH') {
      const input = normalize(resource, await parseBody(req)); const columns = Object.keys(input); if (!columns.length) return sendError(res, 422, 'No changes supplied');
      db.prepare(`UPDATE ${spec.table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE id = ?`).run(...columns.map(column => input[column]), id);
      return sendJson(res, 200, db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(id));
    }
    if (req.method === 'DELETE') { db.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).run(id); return sendJson(res, 200, { ok: true }); }
    return sendError(res, 405, 'Method not allowed');
  } catch (error) { console.error(error); return sendError(res, 500, 'Database operation failed'); }
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function staticFile(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  const relative = path.relative(PUBLIC_DIR, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return sendError(res, 403, 'Forbidden');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file).toLowerCase();
  const cacheControl = ['.html', '.js', '.css'].includes(ext) ? 'no-store' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': cacheControl }); fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  staticFile(req, res, url.pathname);
});
server.listen(PORT, () => console.log(`Wedding Family Planner running at http://localhost:${PORT}`));
process.on('SIGINT', () => { db.close(); server.close(() => process.exit(0)); });
