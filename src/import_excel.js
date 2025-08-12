import('dotenv').config();
const xlsx = require('xlsx');
const pool = require('./db');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node src/import_excel.js <file.xlsx>');
  process.exit(1);
}

async function importExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: null });

  const platforms = new Map();
  const customers = new Map();
  const invoices = new Map();

  rows.forEach(r => {
    const idnum = String(r['Número de Identificación'] || '');
    if (idnum) {
      customers.set(idnum, {
        full_name: r['Nombre del Cliente'],
        identification_number: idnum,
        address: r['Dirección'],
        phone: r['Teléfono'],
        email: r['Correo Electrónico']
      });
    }
    const p = (r['Plataforma Utilizada'] || '').toString().trim();
    if (p) platforms.set(p, { platform_name: p });

    const inv = (r['Número de Factura'] || '').toString().trim();
    if (inv) {
      invoices.set(inv, {
        invoice_number: inv,
        billing_period: r['Periodo de Facturación'],
        billed_amount: Number(r['Monto Facturado'] || 0) || 0,
        paid_amount: Number(r['Monto Pagado'] || 0) || 0,
        customer_identification: idnum
      });
    }
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const [k, plat] of platforms) {
      await conn.query('INSERT IGNORE INTO platforms (platform_name) VALUES (?)', [plat.platform_name]);
    }

    for (const [idnum, cust] of customers) {
      await conn.query(
        `INSERT IGNORE INTO customers (full_name, identification_number, address, phone, email)
         VALUES (?, ?, ?, ?, ?)`,
        [cust.full_name, cust.identification_number, cust.address, cust.phone, cust.email]
      );
    }

    for (const [invKey, inv] of invoices) {
      const [custRows] = await conn.query('SELECT customer_id FROM customers WHERE identification_number = ?', [inv.customer_identification]);
      if (!custRows.length) continue;
      const customer_id = custRows[0].customer_id;
      await conn.query(
        `INSERT IGNORE INTO invoices (invoice_number, billing_period, billed_amount, paid_amount, customer_id)
         VALUES (?, ?, ?, ?, ?)`,
        [inv.invoice_number, inv.billing_period, inv.billed_amount, inv.paid_amount, customer_id]
      );
    }

    for (const r of rows) {
      const invoice_number = r['Número de Factura'];
      const [invRows] = await conn.query('SELECT invoice_id FROM invoices WHERE invoice_number = ?', [invoice_number]);
      if (!invRows.length) continue;
      const invoice_id = invRows[0].invoice_id;

      const platformName = r['Plataforma Utilizada'];
      const [platRows] = await conn.query('SELECT platform_id FROM platforms WHERE platform_name = ?', [platformName]);
      if (!platRows.length) continue;
      const platform_id = platRows[0].platform_id;

      await conn.query(
        `INSERT IGNORE INTO transactions
         (transaction_code, transaction_datetime, transaction_amount, transaction_status, transaction_type, invoice_id, platform_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r['ID de la Transacción'],
          r['Fecha y Hora de la Transacción'],
          Number(r['Monto de la Transacción'] || 0) || 0,
          r['Estado de la Transacción'],
          r['Tipo de Transacción'],
          invoice_id,
          platform_id
        ]
      );
    }

    await conn.commit();
    console.log('Import complete');
  } catch (err) {
    await conn.rollback();
    console.error('Import failed', err);
  } finally {
    conn.release();
  }
}

importExcel(path).catch(e => { console.error(e); process.exit(1); });
