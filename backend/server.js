const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

// Database configuration
const isProd = process.env.NODE_ENV === 'production' || process.env.TURSO_DATABASE_URL;
let db;

async function initDatabase() {
  if (isProd) {
    // Turso / Cloud SQLite
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || '',
      authToken: process.env.TURSO_AUTH_TOKEN || '',
    });
    console.log('Using Turso Cloud Database');
  } else {
    // Local SQLite fallback using sql.js
    const initSqlJs = require('sql.js');
    const DB_PATH = path.join(__dirname, 'jannat_uniforms.db');
    
    const SQL = await initSqlJs({
      locateFile: file => path.join(__dirname, file)
    });

    let tempDb;
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      tempDb = new SQL.Database(fileBuffer);
    } else {
      tempDb = new SQL.Database();
    }

    // Adaptation layer for sql.js to match libsql client interface
    db = {
      execute: async (sql, params = []) => {
        const stmt = tempDb.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        
        // Save on every write for local dev
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
          const data = tempDb.export();
          fs.writeFileSync(DB_PATH, Buffer.from(data));
        }
        
        return { rows };
      },
      run: async (sql, params = []) => {
          tempDb.run(sql, params);
          const data = tempDb.export();
          fs.writeFileSync(DB_PATH, Buffer.from(data));
          return {
              lastInsertRowid: tempDb.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
              rowsAffected: tempDb.getRowsModified()
          };
      }
    };
    console.log('Using Local SQLite Database');
  }

  // Create tables if they don't exist
  await db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  await db.run(`
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

  await db.run(`
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

  await db.run(`
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

  await db.run(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      client_id INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.run(`
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

  // Initial seed check
  const check = await db.execute('SELECT COUNT(*) as count FROM clients');
  if (check.rows[0].count === 0) {
    await seedData();
  }
}

async function seedData() {
  console.log('Seeding database...');
  const clients = [
    ['Asia Book Depot', 'ABD'],
    ['Royal Genius Cambridge High School', 'RGCHS'],
    ['IAFAA Publishers', 'IAFAA'],
    ['Gujranwala Food Industry', 'GFI']
  ];
  for (const [name, code] of clients) {
    await db.run('INSERT INTO clients (name, code) VALUES (?, ?)', [name, code]);
  }

  await db.run("INSERT INTO categories (name) VALUES (?)", ['RILLS']);
  await db.run("INSERT INTO categories (name) VALUES (?)", ['STEP SCHOOL']);

  const rills = await db.execute("SELECT id FROM categories WHERE name = 'RILLS'");
  const step = await db.execute("SELECT id FROM categories WHERE name = 'STEP SCHOOL'");
  const rillsId = rills.rows[0].id;
  const stepId = step.rows[0].id;

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
    await db.run('INSERT INTO inventory (name, code, category_id, price) VALUES (?, ?, ?, ?)', [name, code, catId, price]);
  }

  const allClients = (await db.execute('SELECT id FROM clients')).rows;
  for (const c of allClients) {
    await db.run('INSERT INTO invoice_sequences (client_id, last_number) VALUES (?, 0)', [c.id]);
  }

  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light')");
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_sequence', '0')");

  console.log('Database seeded successfully!');
}

// API Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  if (!db) await initDatabase();
  next();
});

// --- API ROUTES ---

app.get('/api/clients', async (req, res) => {
  const result = await db.execute('SELECT * FROM clients ORDER BY name');
  res.json(result.rows);
});

app.get('/api/clients/:id', async (req, res) => {
  const result = await db.execute('SELECT * FROM clients WHERE id = ?', [Number(req.params.id)]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
  res.json(result.rows[0]);
});

app.get('/api/categories', async (req, res) => {
  const result = await db.execute('SELECT * FROM categories ORDER BY name');
  res.json(result.rows);
});

app.get('/api/inventory', async (req, res) => {
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

  const result = await db.execute(query, params);
  res.json(result.rows);
});

app.put('/api/inventory/:id/price', async (req, res) => {
  const { price } = req.body;
  if (price == null || price < 0) return res.status(400).json({ error: 'Invalid price' });
  
  await db.run('UPDATE inventory SET price = ? WHERE id = ?', [price, Number(req.params.id)]);
  const item = await db.execute('SELECT i.*, c.name as category_name FROM inventory i JOIN categories c ON i.category_id = c.id WHERE i.id = ?', [Number(req.params.id)]);
  res.json(item.rows[0]);
});

app.get('/api/invoices', async (req, res) => {
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
  const result = await db.execute(query, params);
  res.json(result.rows);
});

app.get('/api/invoices/:id', async (req, res) => {
  const invRes = await db.execute(`
    SELECT inv.*, cl.name as client_name, cl.code as client_code
    FROM invoices inv
    JOIN clients cl ON inv.client_id = cl.id
    WHERE inv.id = ?
  `, [Number(req.params.id)]);

  if (invRes.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
  const invoice = invRes.rows[0];
  const items = await db.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [Number(req.params.id)]);
  invoice.items = items.rows;
  res.json(invoice);
});

app.post('/api/invoices', async (req, res) => {
  const { client_id, items, date } = req.body;
  if (!client_id || !items || items.length === 0) return res.status(400).json({ error: 'Client and items required' });

  const clientRes = await db.execute('SELECT * FROM clients WHERE id = ?', [Number(client_id)]);
  if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
  const client = clientRes.rows[0];

  try {
    const seqRes = await db.execute('SELECT last_number FROM invoice_sequences WHERE client_id = ?', [Number(client_id)]);
    const nextNum = (seqRes.rows[0] ? seqRes.rows[0].last_number : 0) + 1;
    await db.run('UPDATE invoice_sequences SET last_number = ? WHERE client_id = ?', [nextNum, Number(client_id)]);

    const invoiceNumber = `${client.code}-${String(nextNum).padStart(4, '0')}`;
    const invoiceDate = date || new Date().toISOString().split('T')[0];

    let grandTotal = 0;
    const resolvedItems = [];

    for (const item of items) {
      const invItemRes = await db.execute('SELECT * FROM inventory WHERE id = ?', [Number(item.item_id)]);
      const invItem = invItemRes.rows[0];
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

    const result = await db.run(
      'INSERT INTO invoices (invoice_number, client_id, date, grand_total) VALUES (?, ?, ?, ?)',
      [invoiceNumber, Number(client_id), invoiceDate, grandTotal]
    );

    const invoiceId = result.lastInsertRowid;
    for (const ri of resolvedItems) {
      await db.run(
        'INSERT INTO invoice_items (invoice_id, item_id, item_name, item_code, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, ri.item_id, ri.item_name, ri.item_code, ri.quantity, ri.unit_price, ri.total]
      );
    }

    res.status(201).json({
      id: Number(invoiceId),
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

app.delete('/api/invoices/:id', async (req, res) => {
  await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [Number(req.params.id)]);
  await db.run('DELETE FROM invoices WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/payments', async (req, res) => {
  const result = await db.execute(`
    SELECT p.*, c.name as client_name, c.code as client_code
    FROM payments p
    JOIN clients c ON p.client_id = c.id
    ORDER BY p.id DESC
  `);
  res.json(result.rows);
});

app.post('/api/payments', async (req, res) => {
  const { client_id, amount, date, notes } = req.body;
  if (!client_id || !amount || !date) return res.status(400).json({ error: 'Missing fields' });

  try {
    let seqRes = await db.execute("SELECT value FROM settings WHERE key = 'receipt_sequence'");
    const nextNumber = parseInt(seqRes.rows[0]?.value || "0", 10) + 1;
    await db.run("UPDATE settings SET value = ? WHERE key = 'receipt_sequence'", [nextNumber.toString()]);

    const receiptNumber = `REC-${String(nextNumber).padStart(4, '0')}`;
    const result = await db.run(
      'INSERT INTO payments (receipt_number, client_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
      [receiptNumber, Number(client_id), Number(amount), date, notes || '']
    );

    const payment = await db.execute(`
      SELECT p.*, c.name as client_name, c.code as client_code
      FROM payments p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json(payment.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  const result = await db.execute('SELECT * FROM settings');
  const obj = {};
  for (const s of result.rows) obj[s.key] = s.value;
  res.json(obj);
});

app.put('/api/settings', async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
  }
  res.json({ success: true });
});

// For local running
if (!process.env.VERCEL) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Jannat Uniforms API running on http://localhost:${PORT}`);
    });
  });
}

// Export for Vercel
module.exports = app;
