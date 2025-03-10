const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST'] }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Підключення до PostgreSQL
const pool = new Pool({
  user: 'patrick',
  host: 'localhost',
  database: 'postgres',
  password: 'Getting Started',
  port: 5432,
});

pool.connect((err) => {
  if (err) {
    console.error('Помилка підключення до PostgreSQL:', err.stack);
  } else {
    console.log('Підключено до PostgreSQL');
  }
});

let messages = [];

io.on('connection', (socket) => {
  console.log('Користувач підключився:', socket.id);
  socket.emit('messageHistory', messages);

  socket.on('sendMessage', (data) => {
    console.log('Отримано повідомлення від клієнта:', data);
    const message = { id: socket.id, type: 'text', content: data.content, timestamp: new Date() };
    messages.push(message);
    io.emit('newMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('Користувач від’єднався:', socket.id);
  });
});

// Реєстрація
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Введіть ім’я користувача та пароль' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      return res.status(400).json({ error: 'Користувач уже існує' });
    }

    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    console.log('Зареєстровано користувача:', { username });
    res.json({ message: 'Реєстрація успішна' });
  } catch (err) {
    console.error('Помилка реєстрації:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Вхід
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неправильне ім’я користувача або пароль' });
    }
    console.log('Увійшов користувач:', { username });
    res.json({ message: 'Вхід успішний', username });
  } catch (err) {
    console.error('Помилка входу:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('Файл не завантажено');
  const message = {
    id: req.body.userId || 'unknown',
    type: 'file',
    content: `/uploads/${req.file.filename}`,
    timestamp: new Date(),
  };
  messages.push(message);
  io.emit('newMessage', message);
  res.send('Файл завантажено');
});

server.listen(4000, () => {
  console.log('Сервер запущено на http://localhost:4000');
});