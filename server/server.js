const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'pd_john_doe_alpha'
});

// CREATE
app.post('/clients', (req, res) => {
  const { name, email } = req.body;
  db.query('INSERT INTO clients (name, email) VALUES (?, ?)', [name, email], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Client added');
  });
});

// READ
app.get('/clients', (req, res) => {
  db.query('SELECT * FROM clients', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// UPDATE
app.put('/clients/:id', (req, res) => {
  const { name, email } = req.body;
  db.query('UPDATE clients SET name = ?, email = ? WHERE client_id = ?', [name, email, req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Client updated');
  });
});

// DELETE
app.delete('/clients/:id', (req, res) => {
  db.query('DELETE FROM clients WHERE client_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Client deleted');
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));