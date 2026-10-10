require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(session({
  name: 'kuznia.sid',
  secret: process.env.SESSION_SECRET || 'change-this-session-secret-before-deploying',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

const db = new Database(path.join(DATA_DIR, 'db.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ru TEXT NOT NULL DEFAULT '',
  title_uk TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  desc_ru TEXT NOT NULL DEFAULT '',
  desc_uk TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  answers TEXT NOT NULL DEFAULT '',
  contact_type TEXT NOT NULL DEFAULT '',
  contact_value TEXT NOT NULL DEFAULT '',
  files TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_ru TEXT NOT NULL DEFAULT '',
  text_uk TEXT NOT NULL DEFAULT '',
  text_en TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  options TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'upload';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }
});

function isAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function getBot() {
  return global.bot || null;
}

function sendEmail(to, subject, text) {
  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) return Promise.resolve();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Admin authentication
app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin credentials are not configured' });
  }
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Wrong login or password' });
});

app.post('/api/logout', isAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/me', (req, res) => res.json({ admin: Boolean(req.session && req.session.admin) }));

// Portfolio
app.get('/api/works', (_req, res) => {
  res.json(db.prepare('SELECT * FROM works ORDER BY created_at DESC, id DESC').all());
});

app.post('/api/works', isAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose an image or video' });
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO works (title_ru,title_uk,title_en,desc_ru,desc_uk,desc_en,price,image)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    b.title_ru || '', b.title_uk || '', b.title_en || '',
    b.desc_ru || '', b.desc_uk || '', b.desc_en || '',
    b.price || '', `/uploads/${req.file.filename}`
  );
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete('/api/works/:id', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  const work = db.prepare('SELECT image FROM works WHERE id = ?').get(id);
  if (work) {
    db.prepare('DELETE FROM works WHERE id = ?').run(id);
    const filename = path.basename(work.image || '');
    if (filename) fs.promises.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
  }
  res.json({ ok: true });
});

// Questions for order form
app.get('/api/questions', (_req, res) => {
  res.json(db.prepare('SELECT * FROM questions ORDER BY sort ASC, id ASC').all());
});

app.post('/api/questions', isAdmin, (req, res) => {
  const b = req.body;
  const type = ['text', 'select', 'number'].includes(b.type) ? b.type : 'text';
  const options = Array.isArray(b.options) ? b.options : [];
  const result = db.prepare(`
    INSERT INTO questions (text_ru,text_uk,text_en,type,options,sort)
    VALUES (?,?,?,?,?,?)
  `).run(
    b.text_ru || '', b.text_uk || '', b.text_en || '',
    type, JSON.stringify(options), Number(b.sort || 0)
  );
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete('/api/questions/:id', isAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Orders
app.post('/api/order', upload.array('files', 10), async (req, res) => {
  const answers = String(req.body.answers || '').slice(0, 20000);
  const contactType = String(req.body.contact_type || 'telegram');
  const contactValue = String(req.body.contact_value || '').trim().slice(0, 500);
  const email = String(req.body.email || '').trim().slice(0, 500);
  if (!contactValue) return res.status(400).json({ error: 'Please provide contact details' });

  const uploadedFiles = (req.files || []).map(f => `/uploads/${f.filename}`);
  const result = db.prepare(`
    INSERT INTO orders (answers,contact_type,contact_value,files)
    VALUES (?,?,?,?)
  `).run(answers, contactType, contactValue, JSON.stringify(uploadedFiles));

  const orderId = Number(result.lastInsertRowid);
  const notification = `🔔 Новый заказ #${orderId}\n\n📝 Ответы:\n${answers || 'Не указаны'}\n\n📞 Способ связи: ${contactType}\nКонтакт: ${contactValue}\n\n📎 Файлы: ${uploadedFiles.length ? uploadedFiles.join(', ') : 'нет'}`;

  const bot = getBot();
  if (bot && process.env.ADMIN_TELEGRAM_ID) {
    bot.telegram.sendMessage(process.env.ADMIN_TELEGRAM_ID, notification).catch(err => console.error('Telegram order notification failed:', err.message));
  }
  if (process.env.ORDER_NOTIFICATION_EMAIL) {
    sendEmail(process.env.ORDER_NOTIFICATION_EMAIL, `Новый заказ #${orderId}`, notification)
      .catch(err => console.error('Order email failed:', err.message));
  }
  if (email) {
    sendEmail(email, 'Ваш заказ принят', 'Спасибо! Мы получили ваш заказ и свяжемся с вами для уточнения цены и деталей.')
      .catch(err => console.error('Customer email failed:', err.message));
  }
  res.json({ ok: true, id: orderId });
});

app.get('/api/orders', isAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC').all());
});

app.post('/api/orders/:id/reply', isAdmin, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const message = String(req.body.message || '').trim().slice(0, 4000);
  if (!message) return res.status(400).json({ error: 'Message is empty' });

  try {
    if (order.contact_type === 'telegram') {
      const bot = getBot();
      if (!bot) return res.status(503).json({ error: 'Telegram bot is not running' });
      await bot.telegram.sendMessage(order.contact_value.replace(/^@/, ''), `Ответ по вашему заказу #${order.id}:\n\n${message}`);
    } else if (order.contact_type === 'email') {
      await sendEmail(order.contact_value, `Ответ по заказу #${order.id}`, message);
    } else {
      return res.status(400).json({ error: 'Automatic replies are supported for Telegram or email contacts' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Reply failed:', err.message);
    res.status(502).json({ error: 'Could not send reply' });
  }
});

// Contact details / site settings
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(rows.map(row => [row.key, row.value])));
});

app.post('/api/settings', isAdmin, (req, res) => {
  const allowed = ['phone', 'telegram', 'email', 'address'];
  const save = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  const transaction = db.transaction(body => {
    for (const key of allowed) {
      if (body[key] !== undefined) save.run(key, String(body[key]).slice(0, 1000));
    }
  });
  transaction(req.body || {});
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 50 MB)' : err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Kuznia site listening on port ${PORT}`));

// Start the Telegram bot after the web server is initialized.
require('./bot');
