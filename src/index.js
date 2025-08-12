require('dotenv').config();
const express = require('express');
const pool = require('./db');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

/* CRUD for customers */
app.get('/api/customers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY customer_id ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/customers', async (req, res) => {
  const { full_name, identification_number, address, phone, email } = req.body;
  if (!full_name || !identification_number) return res.status(400).json({ error: 'name and id required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO customers (full_name, identification_number, address, phone, email)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, identification_number, address || null, phone || null, email || null]
    );
    const [row] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'identification or email duplicate' });
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const { full_name, identification_number, address, phone, email } = req.body;
  const id = req.params.id;
  if (!full_name || !identification_number) return res.status(400).json({ error: 'name and id required' });

  try {
    const [result] = await pool.query(
      `UPDATE customers SET full_name=?, identification_number=?, address=?, phone=?, email=? WHERE customer_id=?`,
      [full_name, identification_number, address || null, phone || null, email || null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found' });
    const [row] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [id]);
    res.json(row[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'identification or email duplicate' });
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/* Import endpoint */
app.post('/api/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const path = req.file.path;
  const original = req.file.originalname.toLowerCase();

  try {
    const importRows = [];

    if (original.endsWith('.xlsx') || original.endsWith('.xls')) {
      const wb = xlsx.readFile(path);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = xlsx.utils.sheet_to_json(ws, { defval: null });
      arr.forEach(r => importRows.push(r));
    } else {
      await new Promise((resolve, reject) => {
        fs.createReadStream(path)
          .pipe(csv())
          .on('data', (data) => importRows.push(data))
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const platformsSeen = new Map();
      for (const r of importRows) {
        const platformName = (r['Plataforma Utilizada'] || r['platform'] || r['Platform'] || '').toString().trim();
        if (!platformName) continue;
        if (!platformsSeen.has(platformName)) {
          const [pRes] = await conn.query('INSERT IGNORE INTO platforms (platform_name) VALUES (?)', [platformName]);
          let pid = pRes.insertId;
          if (!pid) {
            const [rows] = await conn.query('SELECT platform_id FROM platforms WHERE platform_name = ?', [platformName]);
            pid = rows[0].platform_id;
          }
          platformsSeen.set(platformName, pid);
        }
      }

      for (const r of importRows) {
        const idnum = String(r['Número de Identificación'] || r['identification_number'] || r['id_number'] || '');
        if (!idnum) continue;
        const fullname = r['Nombre del Cliente'] || r['full_name'] || '';
        const address = r['Dirección'] || r['address'] || null;
        const phone = r['Teléfono'] || r['phone'] || null;
        const email = r['Correo Electrónico'] || r['email'] || null;

        await conn.query(
          `INSERT IGNORE INTO customers (full_name, identification_number, address, phone, email)
           VALUES (?, ?, ?, ?, ?)`,
          [fullname, idnum, address, phone, email]
        );
      }

      for (const r of importRows) {
        const invoice_number = r['Número de Factura'] || r['invoice_number'] || '';
        if (!invoice_number) continue;
        const billing_period = r['Periodo de Facturación'] || r['billing_period'] || '';
        const billed_amount = Number(r['Monto Facturado'] || r['billed_amount'] || 0) || 0;
        const paid_amount = Number(r['Monto Pagado'] || r['paid_amount'] || 0) || 0;
        const idnum = String(r['Número de Identificación'] || r['identification_number'] || '');

        const [custRows] = await conn.query('SELECT customer_id FROM customers WHERE identification_number = ?', [idnum]);
        if (!custRows.length) continue;
        const customer_id = custRows[0].customer_id;

        await conn.query(
          `INSERT IGNORE INTO invoices (invoice_number, billing_period, billed_amount, paid_amount, customer_id)
           VALUES (?, ?, ?, ?, ?)`,
          [invoice_number, billing_period, billed_amount, paid_amount, customer_id]
        );
      }

      for (const r of importRows) {
        const transaction_code = r['ID de la Transacción'] || r['transaction_code'] || '';
        if (!transaction_code) continue;
        const transaction_datetime = r['Fecha y Hora de la Transacción'] || r['transaction_datetime'] || null;
        const transaction_amount = Number(r['Monto de la Transacción'] || r['transaction_amount'] || 0) || 0;
        const transaction_status = r['Estado de la Transacción'] || r['transaction_status'] || '';
        const transaction_type = r['Tipo de Transacción'] || r['transaction_type'] || '';
        const invoice_number = r['Número de Factura'] || r['invoice_number'] || '';
        const platformName = r['Plataforma Utilizada'] || r['platform'] || '';

        const [invRows] = await conn.query('SELECT invoice_id FROM invoices WHERE invoice_number = ?', [invoice_number]);
        if (!invRows.length) continue;
        const invoice_id = invRows[0].invoice_id;

        const [platRows] = await conn.query('SELECT platform_id FROM platforms WHERE platform_name = ?', [platformName]);
        if (!platRows.length) continue;
        const platform_id = platRows[0].platform_id;

        await conn.query(
          `INSERT IGNORE INTO transactions
           (transaction_code, transaction_datetime, transaction_amount, transaction_status, transaction_type, invoice_id, platform_id)
           VALUES (?)`,
          [transaction_code, transaction_datetime, transaction_amount, transaction_status, transaction_type, invoice_id, platform_id]
        );
      }

      await conn.commit();
    } catch (innerErr) {
      await conn.rollback();
      throw innerErr;
    } finally {
      conn.release();
    }

    fs.unlinkSync(path);
    res.json({ success: true, rows: importRows.length });
  } catch (err) {
    console.error(err);
    try: 
    
  }
});
