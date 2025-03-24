const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const os = require('os');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  },
  maxHttpBufferSize: 1e7
});

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'], credentials: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const getLocalIp = () => {
  const networkInterfaces = os.networkInterfaces();
  return Object.values(networkInterfaces)
    .flat()
    .find((iface) => iface.family === 'IPv4' && !iface.internal)?.address || 'localhost';
};

app.get('/server-ip', (req, res) => {
  const ip = getLocalIp();
  res.json({ serverIp: ip });
});

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

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const ifaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}

const ipAddress = getLocalIPAddress();

const activeUsers = new Map();
const publicKeys = {};

io.on('connection', async (socket) => {
  console.log('Користувач підключився:', socket.id);
  const sessionId = socket.handshake.query.sessionId || socket.id;
  let username = null;

  socket.on('join', async ({ username: user, sessionId }) => {
    username = user;
    if (!username) {
      console.error('Помилка: username не визначений у join', socket.id);
      return;
    }
    if (!activeUsers.has(username)) {
      activeUsers.set(username, []);
    }
    activeUsers.get(username).push(socket.id);
    console.log(`Користувач ${username} приєднався з sessionId: ${sessionId}, активні вкладки:`, activeUsers.get(username));
    console.log('Поточний стан activeUsers:', Array.from(activeUsers.entries()));

    try {
      const privateMessages = await pool.query(
        'SELECT * FROM private_messages WHERE sender_username = $1 OR receiver_username = $1 ORDER BY timestamp ASC',
        [username]
      );
      socket.emit('privateMessageHistory', privateMessages.rows);
      socket.emit('publicKeyUpdate', publicKeys);
    } catch (err) {
      console.error('Помилка при отриманні історії приватних повідомлень:', err);
      socket.emit('privateMessageHistory', []);
    }
  });

  socket.on('setPublicKey', ({ username, publicKey }) => {
    console.log(`Отримано публічний ключ від ${username}:`, publicKey);
    publicKeys[username] = publicKey;
    io.emit('publicKeyUpdate', publicKeys);
  });

  socket.on('sendPrivateMessage', async ({ receiver, content, tempId }) => {
    if (!username) {
      socket.emit('privateMessageError', 'Ви не авторизовані');
      return;
    }

    const receiverSockets = activeUsers.get(receiver);
    if (!receiverSockets || receiverSockets.length === 0) {
      socket.emit('privateMessageError', 'Користувач не знайдений або офлайн');
      return;
    }

    if (!publicKeys[receiver]) {
      socket.emit('privateMessageError', `Публічний ключ для ${receiver} не знайдено. Користувач не онлайн.`);
      return;
    }

    try {
      const result = await pool.query(
        'INSERT INTO private_messages (sender_username, receiver_username, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
        [username, receiver, content, new Date()]
      );
      const newMessage = { ...result.rows[0], tempId }; // Додаємо tempId до повідомлення

      receiverSockets.forEach(socketId => {
        io.to(socketId).emit('newPrivateMessage', newMessage);
      });

      const senderSockets = activeUsers.get(username);
      if (!senderSockets || senderSockets.length === 0) {
        console.error(`Помилка: немає активних сокетів для ${username}`);
        socket.emit('privateMessageError', 'Помилка: ваш аккаунт не активний');
        return;
      }
      senderSockets.forEach(socketId => {
        io.to(socketId).emit('newPrivateMessage', newMessage);
      });
    } catch (err) {
      console.error('Помилка при відправленні приватного повідомлення:', err);
      socket.emit('privateMessageError', 'Помилка відправлення');
    }
  });

  socket.on('searchUser', async ({ searchTerm }) => {
    console.log(`Пошук користувача від ${username} (socket.id: ${socket.id}): ${searchTerm}`);
    if (!username) {
      console.error('Помилка: username не визначений для пошуку', socket.id);
      socket.emit('searchResults', []);
      return;
    }
    try {
      console.log('Активні користувачі перед пошуком:', Array.from(activeUsers.keys()));
      const activeUsernames = Array.from(activeUsers.keys()).filter(u => u !== username);
      console.log('Активні користувачі після фільтрації (виключаючи себе):', activeUsernames);
      const filteredUsers = activeUsernames.filter(u => u.toLowerCase().includes(searchTerm.toLowerCase()));
      console.log('Результати пошуку:', filteredUsers);
      socket.emit('searchResults', filteredUsers.slice(0, 5));
      console.log('Відправлено searchResults до socket.id:', socket.id);
    } catch (err) {
      console.error('Помилка пошуку користувача:', err, 'socket.id:', socket.id);
      socket.emit('searchResults', []);
    }
  });

  socket.on('leave', ({ username: user, sessionId }) => {
    console.log(`Користувач ${user} вийшов з sessionId: ${sessionId}`);
    if (activeUsers.has(user)) {
      activeUsers.set(user, activeUsers.get(user).filter(id => id !== socket.id));
      if (activeUsers.get(user).length === 0) {
        activeUsers.delete(user);
        delete publicKeys[user];
      }
    }
    io.emit('publicKeyUpdate', publicKeys);
    console.log('Поточний стан activeUsers після leave:', Array.from(activeUsers.entries()));
  });

  socket.on('disconnect', () => {
    console.log('Користувач від’єднався:', socket.id);
    if (username && activeUsers.has(username)) {
      activeUsers.set(username, activeUsers.get(username).filter(id => id !== socket.id));
      if (activeUsers.get(username).length === 0) {
        activeUsers.delete(username);
        delete publicKeys[username];
      }
    }
    io.emit('publicKeyUpdate', publicKeys);
    console.log('Поточний стан activeUsers після disconnect:', Array.from(activeUsers.entries()));
  });
});

app.post('/register', async (req, res) => {
  console.log('Отримано запит на реєстрацію:', req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    console.log('Помилка: відсутні дані');
    return res.status(400).json({ error: 'Введіть ім’я користувача та пароль' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      console.log('Помилка: користувач уже існує');
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
  console.log('Отримано запит на вхід:', req.body);
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length === 0) {
      console.log('Помилка: неправильне ім’я користувача або пароль');
      return res.status(401).json({ error: 'Неправильне ім’я користувача або пароль' });
    }
    res.json({ message: 'Вхід успішний', username });
  } catch (err) {
    console.error('Помилка входу:', err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Отримано запит на завантаження файлу');
  if (!req.file) {
    console.log('Помилка: файл не завантажено');
    return res.status(400).send('Файл не завантажено');
  }

  const username = req.body.username || 'Анонім';
  const filePath = `/uploads/${req.file.filename}`;

  try {
    const result = await pool.query(
      'INSERT INTO private_messages (sender_username, receiver_username, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, 'system', filePath, new Date()]
    );
    const newMessage = result.rows[0];
    activeUsers.get(username)?.forEach(socketId => {
      io.to(socketId).emit('newPrivateMessage', newMessage);
    });
    res.send('Файл завантажено');
  } catch (err) {
    console.error('Помилка при збереженні файлу:', err);
    res.status(500).send('Помилка сервера');
  }
});

server.listen(4000, '0.0.0.0', () => {
  console.log(`Сервер запущено на http://${ipAddress}:4000 (доступний у мережі)`);
});
