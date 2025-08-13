 loadData.js
const mysql = require('mysql2');
const fs = require('fs');
const csv = require('csv-parser');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pd_yourname_yourlastname_clan'

});

fs.createReadStream('data.csv')
  .pipe(csv())
  .on('data', (row) => {
    connection.query(
      'INSERT INTO clients (name, email) VALUES (?, ?)',
      [row.name, row.email],
      (err) => {
        if (err) console.error(err);
      }
    );
  })
  .on('end', () => {
    console.log('CSV data loaded.');
    connection.end();
  });