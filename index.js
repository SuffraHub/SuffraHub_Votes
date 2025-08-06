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
  console.log('--- /submit-votes endpoint called ---');
  console.log('Request body:', req.body);

  const { token, poll_id, votes } = req.body;

  if (!token || !poll_id || !Array.isArray(votes) || votes.length === 0) {
    console.log('Validation failed: Missing or invalid fields');
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  console.log(`Token: ${token}, Poll ID: ${poll_id}, Votes count: ${votes.length}`);

  const connection = await pool.getConnection();
  try {
    console.log('Starting transaction...');
    await connection.beginTransaction();

    console.log('Checking token validity...');
    const [rows] = await connection.query(
      'SELECT * FROM vote_tokens WHERE token = ? AND poll_id = ? AND used = 0',
      [token, poll_id]
    );

    console.log('Token query result:', rows);

    if (rows.length === 0) {
      console.log('Invalid or already used token');
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid or already used token' });
    }

    const now = new Date();
    console.log('Current timestamp:', now);

    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      console.log(`Processing vote ${i}:`, vote);

      if (
        vote.question_poll_id == null ||
        vote.option_id == null
      ) {
        console.log('Invalid vote object detected:', vote);
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid vote object', vote });
      }

      console.log('Inserting vote into DB...');
      await connection.query(
        'INSERT INTO votes (question_poll_id, option_id, token, vote_time) VALUES (?, ?, ?, ?)',
        [vote.question_poll_id, vote.option_id, token, now]
      );
      console.log(`Vote ${i} inserted successfully`);
    }

    console.log('Marking token as used...');
    await connection.query(
      'UPDATE vote_tokens SET used = 1 WHERE token = ?',
      [token]
    );
    console.log('Token marked as used');

    await connection.commit();
    console.log('Transaction committed successfully');

    res.status(201).json({ message: 'Votes submitted successfully' });

  } catch (err) {
    console.error('Transaction error:', err);
    await connection.rollback();
    console.log('Transaction rolled back');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
    console.log('Connection released');
  }
});


app.listen(port, () => {
  console.log(`Vote API listening on port ${port}`);
});
