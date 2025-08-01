const express = require('express');
const app = express();
const port = 8002;

const cors = require('cors');
require('dotenv').config();
const mysql = require('mysql');

app.use(cors());
app.use(express.json());

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

connection.connect(err => {
  if (err) {
    console.error('DB connection error:', err.stack);
    return;
  }
  console.log('Connected to MySQL');
});

// === POST /submit-vote ===
// Przyjmuje: question_poll_id, option_id, token, vote_time (opcjonalnie)
app.post('/submit-vote', (req, res) => {
  const { question_poll_id, option_id, token, vote_time } = req.body;

  if (!question_poll_id || !option_id || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = `
    INSERT INTO votes (question_poll_id, option_id, token, vote_time)
    VALUES (?, ?, ?, ?)
  `;

  const time = vote_time || new Date(); // Ustaw aktualny czas, jeśli nie podano

  connection.query(query, [question_poll_id, option_id, token, time], (err, result) => {
    if (err) {
      console.error('Insert vote error:', err);
      return res.status(500).json({ error: 'Failed to submit vote' });
    }

    res.status(201).json({ message: 'Vote submitted successfully', voteId: result.insertId });
  });
});

app.listen(port, () => {
  console.log(`Vote API listening on port ${port}`);
});
