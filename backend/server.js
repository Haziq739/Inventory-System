const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
//const PORT = 5000;
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'jannat_uniforms.db');
let db;

// Save database to file periodically and on changes
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, file)
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      grand_total REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_code TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      client_id INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  // Seed data
  seedData();
  saveDb();
}

// Helper functions for db queries
function dbAll(query, params = []) {
  const stmt = db.prepare(query);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(query, params = []) {
  const results = dbAll(query, params);
  return results.length > 0 ? results[0] : null;
}

function dbRun(query, params = []) {
  db.run(query, params);
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
    changes: db.getRowsModified()
  };
}

function seedData() {
  const result = dbGet('SELECT COUNT(*) as count FROM clients');
  if (result.count > 0) return;

  console.log('Seeding database...');

  // Insert clients
  const clients = [
    ['Asia Book Depot', 'ABD'],
    ['Royal Genius Cambridge High School', 'RGCHS'],
    ['IAFAA Publishers', 'IAFAA'],
    ['Gujranwala Food Industry', 'GFI']
  ];
  for (const [name, code] of clients) {
    dbRun('INSERT INTO clients (name, code) VALUES (?, ?)', [name, code]);
  }

  // Insert categories
  dbRun("INSERT INTO categories (name) VALUES (?)", ['RILLS']);
  dbRun("INSERT INTO categories (name) VALUES (?)", ['STEP SCHOOL']);

  const rills = dbGet("SELECT id FROM categories WHERE name = 'RILLS'");
  const step = dbGet("SELECT id FROM categories WHERE name = 'STEP SCHOOL'");
  const rillsId = rills.id;
  const stepId = step.id;

  // Insert inventory items
  const items = [
    ['Rills Boy Shirt 18', 'RILLS-SH-18', rillsId, 760],
    ['Rills Boy Shirt 20', 'RILLS-SH-20', rillsId, 760],
    ['Rills Boy Shirt 22', 'RILLS-SH-22', rillsId, 810],
    ['Rills Boy Shirt 24', 'RILLS-SH-24', rillsId, 810],
    ['Rills Boy Shirt 26', 'RILLS-SH-26', rillsId, 880],
    ['Rills Boy Shirt 28', 'RILLS-SH-28', rillsId, 880],
    ['Rills Boy Shirt 30', 'RILLS-SH-30', rillsId, 930],
    ['Rills Boy Shirt 32', 'RILLS-SH-32', rillsId, 930],
    ['Rills Boy Shirt 34', 'RILLS-SH-34', rillsId, 1000],
    ['Rills Boy Shirt 36', 'RILLS-SH-36', rillsId, 1000],
    ['Rills Boys Trouser 24', 'RILLS-TR-24', rillsId, 880],
    ['Rills Boys Trouser 26', 'RILLS-TR-26', rillsId, 880],
    ['Rills Boys Trouser 28', 'RILLS-TR-28', rillsId, 930],
    ['Rills Boys Trouser 30', 'RILLS-TR-30', rillsId, 930],
    ['Rills Boys Trouser 32', 'RILLS-TR-32', rillsId, 980],
    ['Rills Boys Trouser 34', 'RILLS-TR-34', rillsId, 980],
    ['Rills Boys Trouser 36', 'RILLS-TR-36', rillsId, 1030],
    ['Rills Boys Trouser 38', 'RILLS-TR-38', rillsId, 1030],
    ['Rills Boys Trouser 40', 'RILLS-TR-40', rillsId, 1080],
    ['Rills Boys Trouser 42', 'RILLS-TR-42', rillsId, 1080],
    ['Rills Girls Suit 30', 'RILLS-GS-30', rillsId, 1600],
    ['Rills Girls Suit 32', 'RILLS-GS-32', rillsId, 1600],
    ['Rills Girls Suit 34', 'RILLS-GS-34', rillsId, 1700],
    ['Rills Girls Suit 36', 'RILLS-GS-36', rillsId, 1800],
    ['Rills Girls Suit 38', 'RILLS-GS-38', rillsId, 1900],
    ['Rills Girls Suit 40', 'RILLS-GS-40', rillsId, 2000],
    ['Rills Girls Suit 42', 'RILLS-GS-42', rillsId, 2100],
    ['Rills Girls Suit 44', 'RILLS-GS-44', rillsId, 2200],
    ['Rills Girls Suit 46', 'RILLS-GS-46', rillsId, 2300],
    ['Rills Girls Dupatta', 'RILLS-DUP-01', rillsId, 875],
    ['Step School Shirt 18', 'STEP-SH-18', stepId, 495],
    ['Step School Shirt 20', 'STEP-SH-20', stepId, 495],
    ['Step School Shirt 22', 'STEP-SH-22', stepId, 495],
    ['Step School Shirt 24', 'STEP-SH-24', stepId, 495],
    ['Step School Boys Trouser 24', 'STEP-TR-24', stepId, 575],
    ['Step School Boys Trouser 26', 'STEP-TR-26', stepId, 575],
    ['Step School Boys Trouser 28', 'STEP-TR-28', stepId, 575],
    ['Step School Boys Trouser 30', 'STEP-TR-30', stepId, 575],
  ];

  for (const [name, code, catId, price] of items) {
    dbRun('INSERT INTO inventory (name, code, category_id, price) VALUES (?, ?, ?, ?)', [name, code, catId, price]);
  }

  // Initialize invoice sequences
  const allClients = dbAll('SELECT id FROM clients');
  for (const c of allClients) {
    dbRun('INSERT INTO invoice_sequences (client_id, last_number) VALUES (?, 0)', [c.id]);
  }

  // Default settings
  dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light')");
  dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_sequence', '0')");

  console.log('Database seeded successfully!');
}

// ============================================================
// API ROUTES
// ============================================================

// --- CLIENTS ---
app.get('/api/clients', (req, res) => {
  const clients = dbAll('SELECT * FROM clients ORDER BY name');
  res.json(clients);
});

app.get('/api/clients/:id', (req, res) => {
  const client = dbGet('SELECT * FROM clients WHERE id = ?', [Number(req.params.id)]);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// --- CATEGORIES ---
app.get('/api/categories', (req, res) => {
  const categories = dbAll('SELECT * FROM categories ORDER BY name');
  res.json(categories);
});

// --- INVENTORY ---
app.get('/api/inventory', (req, res) => {
  const { search, category_id } = req.query;
  let query = `
    SELECT i.*, c.name as category_name 
    FROM inventory i 
    JOIN categories c ON i.category_id = c.id
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push('(i.name LIKE ? OR i.code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category_id) {
    conditions.push('i.category_id = ?');
    params.push(Number(category_id));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY c.name, i.name';

  const items = dbAll(query, params);
  res.json(items);
});

app.put('/api/inventory/:id/price', (req, res) => {
  const { price } = req.body;
  if (price == null || price < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  const result = dbRun('UPDATE inventory SET price = ? WHERE id = ?', [price, Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });
  saveDb();
  const item = dbGet('SELECT i.*, c.name as category_name FROM inventory i JOIN categories c ON i.category_id = c.id WHERE i.id = ?', [Number(req.params.id)]);
  res.json(item);
});

// --- INVOICES ---
app.get('/api/invoices', (req, res) => {
  const { client_id } = req.query;
  let query = `
    SELECT inv.*, cl.name as client_name, cl.code as client_code
    FROM invoices inv
    JOIN clients cl ON inv.client_id = cl.id
  `;
  const params = [];

  if (client_id) {
    query += ' WHERE inv.client_id = ?';
    params.push(Number(client_id));
  }
  query += ' ORDER BY inv.created_at DESC';

  const invoices = dbAll(query, params);
  res.json(invoices);
});

app.get('/api/invoices/:id', (req, res) => {
  const invoice = dbGet(`
    SELECT inv.*, cl.name as client_name, cl.code as client_code
    FROM invoices inv
    JOIN clients cl ON inv.client_id = cl.id
    WHERE inv.id = ?
  `, [Number(req.params.id)]);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const items = dbAll('SELECT * FROM invoice_items WHERE invoice_id = ?', [Number(req.params.id)]);
  invoice.items = items;
  res.json(invoice);
});

app.post('/api/invoices', (req, res) => {
  const { client_id, items, date } = req.body;

  if (!client_id || !items || items.length === 0) {
    return res.status(400).json({ error: 'Client and at least one item are required' });
  }

  const client = dbGet('SELECT * FROM clients WHERE id = ?', [Number(client_id)]);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  try {
    // Get and increment sequence
    const seq = dbGet('SELECT last_number FROM invoice_sequences WHERE client_id = ?', [Number(client_id)]);
    const nextNum = (seq ? seq.last_number : 0) + 1;
    dbRun('UPDATE invoice_sequences SET last_number = ? WHERE client_id = ?', [nextNum, Number(client_id)]);

    const invoiceNumber = `${client.code}-${String(nextNum).padStart(4, '0')}`;
    const invoiceDate = date || new Date().toISOString().split('T')[0];

    let grandTotal = 0;
    const resolvedItems = [];

    for (const item of items) {
      const invItem = dbGet('SELECT * FROM inventory WHERE id = ?', [Number(item.item_id)]);
      if (!invItem) throw new Error(`Item ${item.item_id} not found`);

      const unitPrice = item.unit_price != null ? item.unit_price : invItem.price;
      const total = unitPrice * item.quantity;
      grandTotal += total;
      resolvedItems.push({
        item_id: invItem.id,
        item_name: invItem.name,
        item_code: invItem.code,
        quantity: item.quantity,
        unit_price: unitPrice,
        total
      });
    }

    // Insert invoice
    const result = dbRun(
      'INSERT INTO invoices (invoice_number, client_id, date, grand_total) VALUES (?, ?, ?, ?)',
      [invoiceNumber, Number(client_id), invoiceDate, grandTotal]
    );

    const invoiceId = result.lastInsertRowid;

    // Insert invoice items
    for (const ri of resolvedItems) {
      dbRun(
        'INSERT INTO invoice_items (invoice_id, item_id, item_name, item_code, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, ri.item_id, ri.item_name, ri.item_code, ri.quantity, ri.unit_price, ri.total]
      );
    }

    saveDb();

    res.status(201).json({
      id: invoiceId,
      invoice_number: invoiceNumber,
      client_id: Number(client_id),
      client_name: client.name,
      client_code: client.code,
      date: invoiceDate,
      grand_total: grandTotal,
      items: resolvedItems
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/invoices/:id', (req, res) => {
  // First delete invoice items (manual cascade since sql.js may not handle it)
  dbRun('DELETE FROM invoice_items WHERE invoice_id = ?', [Number(req.params.id)]);
  const result = dbRun('DELETE FROM invoices WHERE id = ?', [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Invoice not found' });
  saveDb();
  res.json({ success: true });
});

// --- PAYMENTS ---
app.get('/api/payments', (req, res) => {
  const query = `
    SELECT p.*, c.name as client_name, c.code as client_code
    FROM payments p
    JOIN clients c ON p.client_id = c.id
    ORDER BY p.id DESC
  `;
  const payments = dbAll(query);
  res.json(payments);
});

app.post('/api/payments', (req, res) => {
  const { client_id, amount, date, notes } = req.body;
  if (!client_id || !amount || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get unique receipt number
    let seq = dbGet("SELECT value FROM settings WHERE key = 'receipt_sequence'");
    if (!seq) {
      dbRun("INSERT INTO settings (key, value) VALUES ('receipt_sequence', '0')");
      seq = { value: "0" };
    }
    const nextNumber = parseInt(seq.value || "0", 10) + 1;
    dbRun("UPDATE settings SET value = ? WHERE key = 'receipt_sequence'", [nextNumber.toString()]);

    // Format receipt number REC-XXXX
    const receiptNumber = `REC-${String(nextNumber).padStart(4, '0')}`;

    const result = dbRun(
      'INSERT INTO payments (receipt_number, client_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
      [receiptNumber, Number(client_id), Number(amount), date, notes || '']
    );

    saveDb();

    // Fetch inserted payment to return full object
    const payment = dbGet(`
      SELECT p.*, c.name as client_name, c.code as client_code
      FROM payments p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- SETTINGS ---
app.get('/api/settings', (req, res) => {
  const settings = dbAll('SELECT * FROM settings');
  const obj = {};
  for (const s of settings) obj[s.key] = s.value;
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    dbRun("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
  }
  saveDb();
  res.json({ success: true });
});

// ============================================================
// START SERVER
// ============================================================
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Jannat Uniforms API running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
