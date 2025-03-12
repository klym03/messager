import React, { useState, useEffect, useRef, useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import { ThemeProvider } from './ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

// Створюємо контекст для авторизації
export const AuthContext = React.createContext();

const socket = io('http://localhost:4000', { transports: ['websocket'] });

function Chat() {
  const { username, sessionId, logout } = useContext(AuthContext); // Додаємо logout
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Підключено до сервера');
      socket.emit('join', { username, sessionId });
    });

    socket.on('messageHistory', (history) => {
      console.log('Отримано історію:', history);
      setMessages(history);
    });

    socket.on('newMessage', (message) => {
      console.log('Отримано нове повідомлення:', message);
      setMessages((prev) => [...prev, message]);
    });

    socket.on('connect_error', (err) => {
      console.error('Помилка підключення:', err.message);
    });

    return () => {
      socket.off('messageHistory');
      socket.off('newMessage');
      socket.off('connect');
      socket.off('connect_error');
    };
  }, [username, sessionId]);

  const sendMessage = () => {
    if (input.trim()) {
      console.log('Надсилаю повідомлення:', input);
      socket.emit('sendMessage', { content: input, type: 'text', username });
      setInput('');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);

    try {
      await axios.post('http://localhost:4000/upload', formData);
      setFile(null);
    } catch (error) {
      console.error('Помилка завантаження:', error.message);
    }
  };

  const handleLogout = () => {
    logout(); // Викликаємо функцію logout
    socket.emit('leave', { username, sessionId }); // Повідомляємо сервер про вихід
  };

  return (
    <div className="App">
      <h1>Мій меседжер</h1>
      <div style={{ textAlign: 'right', marginBottom: '10px' }}>
        <button onClick={handleLogout} style={{ padding: '5px 10px' }}>
          Вийти
        </button>
      </div>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.username === username ? 'message-own' : 'message-other'}`}>
            <strong>{msg.username}: </strong>
            {msg.type === 'text' ? (
              <p>{msg.content}</p>
            ) : (
              msg.content.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                <img src={`http://localhost:4000${msg.content}`} alt="uploaded" style={{ maxWidth: '200px' }} />
              ) : (
                <a href={`http://localhost:4000${msg.content}`} download>
                  Завантажити: {msg.content.split('/').pop()}
                </a>
              )
            )}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Надіслати</button>
      </div>
      <form onSubmit={handleFileUpload}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button type="submit">Завантажити</button>
      </form>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    const savedUsername = localStorage.getItem('username');
    return { username: savedUsername || null, sessionId: Date.now().toString() };
  });

  useEffect(() => {
    if (auth.username) {
      localStorage.setItem('username', auth.username);
    } else {
      localStorage.removeItem('username');
    }
  }, [auth.username]);

  const login = (username) => {
    setAuth((prev) => ({ ...prev, username }));
  };

  const logout = () => {
    setAuth((prev) => ({ ...prev, username: null }));
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      <ThemeProvider>
        <ThemeToggle />
        <Routes>
          <Route
            path="/login"
            element={auth.username ? <Navigate to="/chat" /> : <Login />}
          />
          <Route
            path="/register"
            element={auth.username ? <Navigate to="/chat" /> : <Register />}
          />
          <Route
            path="/chat"
            element={auth.username ? <Chat /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

export default App;