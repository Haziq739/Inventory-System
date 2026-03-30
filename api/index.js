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
let dbPromise = null;

async function initDatabase() {
  console.log('Initializing database... Mode:', isProd ? 'Production' : 'Local');
  let localDb;

  if (isProd) {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL || '',
      authToken: process.env.TURSO_AUTH_TOKEN || '',
    });

    localDb = {
      execute: async (sql, params = []) => {
        const res = await client.execute({ sql, args: params });
        return { rows: res.rows };
      },
      run: async (sql, params = []) => {
        const res = await client.execute({ sql, args: params });
        return {
          lastInsertRowid: res.lastInsertRowid,
          rowsAffected: res.rowsAffected
        };
      }
    };
  } else {
    // Local SQLite fallback
    let initSqlJs;
    try {
      initSqlJs = require('sql.js');
    } catch (e) {
      console.warn('sql.js not found');
      throw new Error('Local database driver missing');
    }

    const DB_PATH = path.join(__dirname, 'jannat_uniforms.db');
    const wasmPath = path.dirname(require.resolve('sql.js'));
    const SQL = await initSqlJs({ locateFile: file => path.join(wasmPath, file) });
    let tempDb = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

    localDb = {
      execute: async (sql, params = []) => {
        const stmt = tempDb.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
          fs.writeFileSync(DB_PATH, Buffer.from(tempDb.export()));
        }
        return { rows };
      },
      run: async (sql, params = []) => {
        tempDb.run(sql, params);
        fs.writeFileSync(DB_PATH, Buffer.from(tempDb.export()));
        return {
          lastInsertRowid: tempDb.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0],
          rowsAffected: tempDb.getRowsModified()
        };
      }
    };
  }

  // Define schema
  const schema = [
    `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`,
    `CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, category_id INTEGER NOT NULL, price REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id))`,
    `CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, date TEXT NOT NULL, grand_total REAL NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id))`,
    `CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, item_id INTEGER NOT NULL, item_name TEXT NOT NULL, item_code TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, total REAL NOT NULL, FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE, FOREIGN KEY (item_id) REFERENCES inventory(id))`,
    `CREATE TABLE IF NOT EXISTS invoice_sequences (client_id INTEGER PRIMARY KEY, last_number INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (client_id) REFERENCES clients(id))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id))`,
    `CREATE TABLE IF NOT EXISTS client_receivables (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id))`
  ];

  for (const q of schema) {
    await localDb.run(q);
  }

  // Check seeding
  const check = await localDb.execute('SELECT COUNT(*) as cnt FROM clients');
  const count = check.rows[0].cnt || check.rows[0]['COUNT(*)'] || 0;
  if (count === 0) {
    // Seed using localDb
    console.log('Seeding initial data...');
    const seedClients = [['Asia Book Depot', 'ABD'], ['Royal Genius Cambridge High School', 'RGCHS'], ['IAFAA Publishers', 'IAFAA'], ['Gujranwala Food Industry', 'GFI']];
    for (const [name, code] of seedClients) await localDb.run('INSERT INTO clients (name, code) VALUES (?, ?)', [name, code]);

    await localDb.run("INSERT INTO categories (name) VALUES (?)", ['RILLS']);
    await localDb.run("INSERT INTO categories (name) VALUES (?)", ['STEP SCHOOL']);

    const rillsRes = await localDb.execute("SELECT id FROM categories WHERE name = 'RILLS'");
    const stepRes = await localDb.execute("SELECT id FROM categories WHERE name = 'STEP SCHOOL'");
    const rillsId = rillsRes.rows[0].id;
    const stepId = stepRes.rows[0].id;

    const seedItems = [
      ['Rills Boy Shirt 18', 'RILLS-SH-18', rillsId, 760], ['Rills Boy Shirt 20', 'RILLS-SH-20', rillsId, 760], ['Rills Boy Shirt 22', 'RILLS-SH-22', rillsId, 810], ['Rills Boy Shirt 24', 'RILLS-SH-24', rillsId, 810], ['Rills Boy Shirt 26', 'RILLS-SH-26', rillsId, 880], ['Rills Boy Shirt 28', 'RILLS-SH-28', rillsId, 880], ['Rills Boy Shirt 30', 'RILLS-SH-30', rillsId, 930], ['Rills Boy Shirt 32', 'RILLS-SH-32', rillsId, 930], ['Rills Boy Shirt 34', 'RILLS-SH-34', rillsId, 1000], ['Rills Boy Shirt 36', 'RILLS-SH-36', rillsId, 1000],
      ['Rills Boys Trouser 24', 'RILLS-TR-24', rillsId, 880], ['Rills Boys Trouser 26', 'RILLS-TR-26', rillsId, 880], ['Rills Boys Trouser 28', 'RILLS-TR-28', rillsId, 930], ['Rills Boys Trouser 30', 'RILLS-TR-30', rillsId, 930], ['Rills Boys Trouser 32', 'RILLS-TR-32', rillsId, 980], ['Rills Boys Trouser 34', 'RILLS-TR-34', rillsId, 980], ['Rills Boys Trouser 36', 'RILLS-TR-36', rillsId, 1030], ['Rills Boys Trouser 38', 'RILLS-TR-38', rillsId, 1030], ['Rills Boys Trouser 40', 'RILLS-TR-40', rillsId, 1080], ['Rills Boys Trouser 42', 'RILLS-TR-42', rillsId, 1080],
      ['Rills Girls Suit 30', 'RILLS-GS-30', rillsId, 1600], ['Rills Girls Suit 32', 'RILLS-GS-32', rillsId, 1600], ['Rills Girls Suit 34', 'RILLS-GS-34', rillsId, 1700], ['Rills Girls Suit 36', 'RILLS-GS-36', rillsId, 1800], ['Rills Girls Suit 38', 'RILLS-GS-38', rillsId, 1900], ['Rills Girls Suit 40', 'RILLS-GS-40', rillsId, 2000], ['Rills Girls Suit 42', 'RILLS-GS-42', rillsId, 2100], ['Rills Girls Suit 44', 'RILLS-GS-44', rillsId, 2200], ['Rills Girls Suit 46', 'RILLS-GS-46', rillsId, 2300], ['Rills Girls Dupatta', 'RILLS-DUP-01', rillsId, 875],
      ['Step School Shirt 18', 'STEP-SH-18', stepId, 495], ['Step School Shirt 20', 'STEP-SH-20', stepId, 495], ['Step School Shirt 22', 'STEP-SH-22', stepId, 495], ['Step School Shirt 24', 'STEP-SH-24', stepId, 495], ['Step School Boys Trouser 24', 'STEP-TR-24', stepId, 575], ['Step School Boys Trouser 26', 'STEP-TR-26', stepId, 575], ['Step School Boys Trouser 28', 'STEP-TR-28', stepId, 575], ['Step School Boys Trouser 30', 'STEP-TR-30', stepId, 575],
    ];
    for (const [name, code, catId, price] of seedItems) await localDb.run('INSERT INTO inventory (name, code, category_id, price) VALUES (?, ?, ?, ?)', [name, code, catId, price]);

    const allC = (await localDb.execute('SELECT id FROM clients')).rows;
    for (const c of allC) await localDb.run('INSERT INTO invoice_sequences (client_id, last_number) VALUES (?, 0)', [c.id]);

    await localDb.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light')");
    await localDb.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_sequence', '0')");
    console.log('Seeding complete.');
  }

  // FINALLY set the global db
  db = localDb;
}

async function getDb() {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  await dbPromise;
  return db;
}

// API Middleware
app.use(async (req, res, next) => {
  try {
    await getDb();
    next();
  } catch (err) {
    console.error('Initialization error:', err);
    res.status(500).json({ error: 'System initialization failed', details: err.message });
  }
});

// Routes
app.get('/api/health', async (req, res) => {
  try {
    const clients = await db.execute('SELECT COUNT(*) as cnt FROM clients');
    const inventory = await db.execute('SELECT COUNT(*) as cnt FROM inventory');
    res.json({
      status: 'ok',
      database: !!db,
      counts: {
        clients: clients.rows[0].cnt,
        inventory: inventory.rows[0].cnt
      }
    });
  } catch (err) {
    res.json({ status: 'error', database: !!db, error: err.message });
  }
});

app.get('/api/clients', async (req, res) => {
  const result = await db.execute('SELECT * FROM clients ORDER BY name');
  res.json(result.rows);
});

app.get('/api/clients/:id', async (req, res) => {
  const result = await db.execute('SELECT * FROM clients WHERE id = ?', [Number(req.params.id)]);
  res.json(result.rows[0] || { error: 'Not found' });
});

app.get('/api/categories', async (req, res) => {
  const result = await db.execute('SELECT * FROM categories ORDER BY name');
  res.json(result.rows);
});

app.get('/api/inventory', async (req, res) => {
  const result = await db.execute('SELECT i.*, c.name as category_name FROM inventory i JOIN categories c ON i.category_id = c.id ORDER BY c.name, i.name');
  res.json(result.rows);
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invRes = await db.execute(`
      SELECT inv.*, cl.name as client_name 
      FROM invoices inv 
      JOIN clients cl ON inv.client_id = cl.id 
      ORDER BY inv.created_at DESC
    `);

    const invoices = invRes.rows;

    // Fetch items for each invoice
    for (let inv of invoices) {
      const itemsRes = await db.execute('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
      inv.items = itemsRes.rows;
    }

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  const result = await db.execute('SELECT p.*, c.name as client_name, c.code as client_code FROM payments p JOIN clients c ON p.client_id = c.id ORDER BY p.id DESC');
  res.json(result.rows);
});

app.post('/api/invoices', async (req, res) => {
  const { client_id, items, date } = req.body;
  console.log('Creating invoice for client:', client_id, 'with', items?.length, 'items');

  if (!client_id || !items || !items.length) {
    return res.status(400).json({ error: 'Client and items are required' });
  }

  try {
    // 1. Get client info
    const clientRes = await db.execute('SELECT * FROM clients WHERE id = ?', [Number(client_id)]);
    const client = clientRes.rows[0];
    if (!client) throw new Error('Client not found');

    // 2. Handle Invoice Sequence safely
    const seqRes = await db.execute('SELECT last_number FROM invoice_sequences WHERE client_id = ?', [Number(client_id)]);
    let nextNum = (seqRes.rows[0] ? (Number(seqRes.rows[0].last_number) || 0) : 0) + 1;

    if (!seqRes.rows[0]) {
      await db.run('INSERT INTO invoice_sequences (client_id, last_number) VALUES (?, ?)', [Number(client_id), nextNum]);
    } else {
      await db.run('UPDATE invoice_sequences SET last_number = ? WHERE client_id = ?', [nextNum, Number(client_id)]);
    }

    const invoiceNumber = `${client.code}-${String(nextNum).padStart(4, '0')}`;
    const grandTotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

    // 3. Create Invoice
    const result = await db.run('INSERT INTO invoices (invoice_number, client_id, date, grand_total) VALUES (?, ?, ?, ?)',
      [invoiceNumber, Number(client_id), date, grandTotal]);

    // Handle Turso BigInt ID
    const invoiceId = result.lastInsertRowid.toString();

    // 4. Insert Items
    for (const item of items) {
      const itemTotal = Number(item.quantity) * Number(item.unit_price);
      await db.run('INSERT INTO invoice_items (invoice_id, item_id, item_name, item_code, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, Number(item.item_id), item.item_name, item.item_code, Number(item.quantity), Number(item.unit_price), itemTotal]);
    }

    console.log('Invoice created successfully:', invoiceNumber, 'ID:', invoiceId);
    res.status(201).json({
      id: invoiceId,
      invoice_number: invoiceNumber,
      client_name: client.name,
      date,
      grand_total: grandTotal,
      items: items.map(i => ({ ...i, total: Number(i.quantity) * Number(i.unit_price) }))
    });
  } catch (err) {
    console.error('Invoice Creation Error:', err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM invoices WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments', async (req, res) => {
  const { client_id, amount, date, notes } = req.body;
  try {
    const clientRes = await db.execute('SELECT * FROM clients WHERE id = ?', [Number(client_id)]);
    const client = clientRes.rows[0];
    if (!client) throw new Error('Client not found');

    let seqRes = await db.execute("SELECT value FROM settings WHERE key = 'receipt_sequence'");
    const nextNumber = parseInt(seqRes.rows[0]?.value || "0", 10) + 1;
    await db.run("UPDATE settings SET value = ? WHERE key = 'receipt_sequence'", [nextNumber.toString()]);

    const receiptNumber = `REC-${String(nextNumber).padStart(4, '0')}`;
    const result = await db.run('INSERT INTO payments (receipt_number, client_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)',
      [receiptNumber, Number(client_id), Number(amount), date, notes]);

    const paymentId = result.lastInsertRowid.toString();

    res.status(201).json({
      id: paymentId,
      receipt_number: receiptNumber,
      client_id: Number(client_id),
      client_name: client.name,
      client_code: client.code,
      amount: Number(amount),
      date,
      notes
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM payments WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BALANCES ENDPOINTS ---

app.get('/api/balances/:client_id', async (req, res) => {
  const clientId = Number(req.params.client_id);
  try {
    // 1. Get Invoices
    const invoicesRes = await db.execute("SELECT id, invoice_number as ref, date, grand_total as amount, 'INVOICE' as type FROM invoices WHERE client_id = ?", [clientId]);
    
    // 2. Get Manual Receivables
    const receivablesRes = await db.execute("SELECT id, 'MANUAL' as ref, date, amount, 'RECEIVABLE' as type, notes FROM client_receivables WHERE client_id = ?", [clientId]);
    
    // 3. Get Payments
    const paymentsRes = await db.execute("SELECT id, receipt_number as ref, date, amount, 'PAYMENT' as type, notes FROM payments WHERE client_id = ?", [clientId]);

    // Combine and Sort
    const ledger = [
      ...invoicesRes.rows.map(r => ({ id: r.id, ref: r.ref, date: r.date, amount: Number(r.amount), type: 'INVOICE' })),
      ...receivablesRes.rows.map(r => ({ id: r.id, ref: 'MANUAL', date: r.date, amount: Number(r.amount), type: 'RECEIVABLE', notes: r.notes })),
      ...paymentsRes.rows.map(r => ({ id: r.id, ref: r.ref, date: r.date, amount: -Number(r.amount), type: 'PAYMENT', notes: r.notes }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Totals directly from the ledger for perfect sync
    const totalReceivable = ledger
      .filter(item => item.type === 'INVOICE' || item.type === 'RECEIVABLE')
      .reduce((sum, item) => sum + item.amount, 0);
    
    const totalPaid = ledger
      .filter(item => item.type === 'PAYMENT')
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    
    res.json({
      ledger,
      summary: {
        total_receivable: totalReceivable,
        total_paid: totalPaid,
        balance: totalReceivable - totalPaid
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/receivables', async (req, res) => {
  const { client_id, amount, date, notes } = req.body;
  try {
    await db.run('INSERT INTO client_receivables (client_id, amount, date, notes) VALUES (?, ?, ?, ?)', 
      [Number(client_id), Number(amount), date, notes]);
    res.status(201).json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/receivables/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM client_receivables WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (!process.env.VERCEL) {
  getDb().then(() => app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`)));
}

module.exports = app;
