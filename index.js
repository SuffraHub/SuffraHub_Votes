const express = require('express');
const app = express();
const port = 8002;

const cors = require('cors');
require('dotenv').config();
const mysql = require('mysql2/promise'); // ZMIANA: mysql2 z promisami

app.use(cors());
app.use(express.json());

// Połączenie z bazą (pool zamiast pojedynczego connection)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// === POST /submit-votes ===
// Przyjmuje token, poll_id i pakiet głosów: [{question_poll_id, option_id}]
app.post('/submit-votes', async (req, res) => {
  const { token, poll_id, votes } = req.body;

  if (!token || !poll_id || !Array.isArray(votes) || votes.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Sprawdź token
    const [rows] = await connection.query(
      'SELECT * FROM vote_tokens WHERE token = ? AND poll_id = ? AND used = 0',
      [token, poll_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid or already used token' });
    }

    // 2. Wstaw głosy
    const now = new Date();
    for (const vote of votes) {
      if (!vote.question_poll_id || !vote.option_id) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid vote object' });
      }

      await connection.query(
        'INSERT INTO votes (question_poll_id, option_id, token, vote_time) VALUES (?, ?, ?, ?)',
        [vote.question_poll_id, vote.option_id, token, now]
      );
    }

    // 3. Zaznacz token jako użyty
    await connection.query(
      'UPDATE vote_tokens SET used = 1 WHERE token = ?',
      [token]
    );

    await connection.commit();
    res.status(201).json({ message: 'Votes submitted successfully' });

  } catch (err) {
    console.error('Transaction error:', err);
    await connection.rollback();
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`Vote API listening on port ${port}`);
});
