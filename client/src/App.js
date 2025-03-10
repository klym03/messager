import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import './App.css';

const socket = io('http://localhost:4000', { transports: ['websocket'] });

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Підключено до сервера');
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
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      console.log('Надсилаю повідомлення:', input);
      socket.emit('sendMessage', { content: input });
      setInput('');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('http://localhost:4000/upload', formData);
      setFile(null);
    } catch (error) {
      console.error('Помилка завантаження:', error.message);
    }
  };

  return (
    <div className="App">
      <h1>Мій меседжер</h1>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className="message">
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
  const isAuthenticated = !!localStorage.getItem('username'); // Перевірка авторизації

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={isAuthenticated ? <Chat /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;