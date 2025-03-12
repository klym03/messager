const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const os = require('os'); // Додаємо модуль os для визначення IP

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Дозволяємо всім джерелам (для тестування)
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

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

// Функція для визначення IP-адреси
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address; // Повертаємо першу знайдену IPv4-адресу
      }
    }
  }
  return '0.0.0.0'; // За замовчуванням, якщо не знайдено
}

const ipAddress = getLocalIPAddress();

io.on('connection', async (socket) => {
  console.log('Користувач підключився:', socket.id);
  const sessionId = socket.handshake.query.sessionId || socket.id;

  socket.on('join', async ({ username, sessionId }) => {
    console.log(`Користувач ${username} приєднався з sessionId: ${sessionId}`);
    try {
      const result = await pool.query('SELECT * FROM messages ORDER BY timestamp ASC');
      socket.emit('messageHistory', result.rows);
    } catch (err) {
      console.error('Помилка при отриманні історії:', err);
      socket.emit('messageHistory', []);
    }
  });

  socket.on('sendMessage', async (data) => {
    const { content, type, username } = data;
    try {
      const result = await pool.query(
        'INSERT INTO messages (username, type, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
        [username || 'Анонім', type || 'text', content, new Date()]
      );
      const newMessage = result.rows[0];
      io.emit('newMessage', newMessage);
    } catch (err) {
      console.error('Помилка при збереженні:', err);
    }
  });

  socket.on('leave', ({ username, sessionId }) => {
    console.log(`Користувач ${username} вийшов з sessionId: ${sessionId}`);
  });

  socket.on('clearChat', async ({ username, clearForAll }) => {
    console.log('Отримано запит на очищення чату:', { username, clearForAll });
    try {
      if (clearForAll) {
        await pool.query('DELETE FROM messages');
        io.emit('chatCleared', { message: 'Чат очищено для всіх' });
      } else {
        await pool.query('DELETE FROM messages WHERE username = $1', [username]);
        socket.emit('chatCleared', { message: 'Ваш чат очищено' });
      }
      const result = await pool.query('SELECT * FROM messages ORDER BY timestamp ASC');
      io.emit('messageHistory', result.rows);
    } catch (err) {
      console.error('Помилка при очищенні чату:', err);
      socket.emit('chatCleared', { error: 'Помилка при очищенні чату' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Користувач від’єднався:', socket.id);
  });
});

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
    res.json({ message: 'Реєстрація успішна' });
  } catch (err) {
    console.error('Помилка реєстрації:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неправильне ім’я користувача або пароль' });
    }
    res.json({ message: 'Вхід успішний', username });
  } catch (err) {
    console.error('Помилка входу:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Файл не завантажено');
  }

  const username = req.body.username || 'Анонім';
  const filePath = `/uploads/${req.file.filename}`;

  try {
    const result = await pool.query(
      'INSERT INTO messages (username, type, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, 'file', filePath, new Date()]
    );
    const newMessage = result.rows[0];
    io.emit('newMessage', newMessage);
    res.send('Файл завантажено');
  } catch (err) {
    console.error('Помилка при збереженні файлу:', err);
    res.status(500).send('Помилка сервера');
  }
});

// Запускаємо сервер на всіх інтерфейсах
server.listen(4000, '0.0.0.0', () => {
  console.log(`Сервер запущено на http://${ipAddress}:4000 (доступний у мережі)`);
});