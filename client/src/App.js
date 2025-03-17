import React, { useState, useEffect, useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import { ThemeProvider, ThemeContext } from './ThemeContext'; // Залишаємо для Chat
import ThemeToggle from './components/ThemeToggle';
import './App.css';

export const AuthContext = React.createContext();

const SERVER_IP = window.location.hostname === 'localhost' ? 'localhost' : '192.168.1.100';
const SERVER_URL = `http://${SERVER_IP}:4000`;
const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });

function Chat() {
  const { username, sessionId, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext); // Використовуємо тему для Chat
  const [privateMessages, setPrivateMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [privateInput, setPrivateInput] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Підключено до сервера, socket.id:', socket.id);
      socket.emit('join', { username, sessionId });
    });

    socket.on('privateMessageHistory', (history) => {
      console.log('Отримано історію приватних повідомлень:', history);
      const chats = {};
      history.forEach(msg => {
        const otherUser = msg.sender_username === username ? msg.receiver_username : msg.sender_username;
        if (!chats[otherUser]) chats[otherUser] = [];
        chats[otherUser].push(msg);
      });
      setPrivateMessages(chats);
      if (!selectedChat && Object.keys(chats).length > 0) {
        setSelectedChat(Object.keys(chats)[0]);
      }
    });

    socket.on('newPrivateMessage', (message) => {
      console.log('Отримано нове приватне повідомлення:', message);
      const otherUser = message.sender_username === username ? message.receiver_username : message.sender_username;
      setPrivateMessages(prev => {
        const updatedChats = { ...prev };
        if (!updatedChats[otherUser]) updatedChats[otherUser] = [];
        updatedChats[otherUser] = [...updatedChats[otherUser], message];
        return updatedChats;
      });
    });

    socket.on('privateMessageError', (error) => {
      console.log('Помилка приватного повідомлення:', error);
      alert(error);
    });

    socket.on('searchResults', (results) => {
      console.log('Результати пошуку отримані для socket.id:', socket.id, 'результати:', results);
      setSearchResults(results);
    });

    socket.on('connect_error', (err) => {
      console.error('Помилка підключення до WebSocket:', err.message);
    });

    socket.on('reconnect', (attempt) => {
      console.log('Повторне підключення успішне, спроба:', attempt, 'socket.id:', socket.id);
      socket.emit('join', { username, sessionId });
    });

    return () => {
      socket.off('privateMessageHistory');
      socket.off('newPrivateMessage');
      socket.off('privateMessageError');
      socket.off('searchResults');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('reconnect');
    };
  }, [username, sessionId, selectedChat]);

  const sendPrivateMessage = () => {
    if (privateInput.trim() && selectedChat) {
      socket.emit('sendPrivateMessage', { receiver: selectedChat, content: privateInput });
      setPrivateInput('');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);

    try {
      await axios.post(`${SERVER_URL}/upload`, formData);
      setFile(null);
    } catch (error) {
      console.error('Помилка завантаження:', error.message);
    }
  };

  const handleLogout = () => {
    logout();
    socket.emit('leave', { username, sessionId });
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      if (!socket.connected) {
        console.error('WebSocket не підключений, socket.id:', socket.id);
        alert('Помилка: немає з’єднання з сервером');
        return;
      }
      console.log('Надсилаю запит на пошук:', searchTerm, 'із socket.id:', socket.id);
      socket.emit('searchUser', { searchTerm });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedChat(user);
    setSearchTerm('');
    setSearchResults([]);
  };

  const chatList = Object.keys(privateMessages).sort((a, b) => {
    const lastMsgA = privateMessages[a][privateMessages[a].length - 1]?.timestamp || 0;
    const lastMsgB = privateMessages[b][privateMessages[b].length - 1]?.timestamp || 0;
    return new Date(lastMsgB) - new Date(lastMsgA);
  });

  return (
    <div className={`App ${theme || 'light'}`}>
      <header className="app-header">
        <div className="user-info">
          <div className="user-actions">
            <ThemeToggle /> {/* Залишаємо для Chat */}
            <span className="username">{username}</span>
            <button onClick={handleLogout} className="logout-btn">
              Вийти
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="chat-sidebar">
          <div className="search-bar">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Пошук користувача..."
              className="search-input"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((user, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectUser(user)}
                    className="search-result-item"
                  >
                    {user}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="chat-list">
            {chatList.map((user) => (
              <div
                key={user}
                onClick={() => setSelectedChat(user)}
                className={`chat-item ${selectedChat === user ? 'active' : ''}`}
              >
                <div className="chat-item-content">
                  <span className="chat-item-avatar">{user[0].toUpperCase()}</span>
                  <div className="chat-item-info">
                    <span className="chat-item-name">{user}</span>
                    {privateMessages[user]?.length > 0 && (
                      <span className="last-message-time">
                        {new Date(privateMessages[user][privateMessages[user].length - 1].timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chat-area">
          {selectedChat ? (
            <div className="chat-box">
              <div className="chat-header">
                <h3>{selectedChat}</h3>
              </div>
              <div className="messages-container">
                {privateMessages[selectedChat]?.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.sender_username === username ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      <strong>{msg.sender_username}</strong>: {msg.content.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                        <img src={`${SERVER_URL}${msg.content}`} alt="uploaded" className="message-image" />
                      ) : (
                        msg.content
                      )}
                      <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="message-input">
                <form onSubmit={handleFileUpload} className="upload-form">
                  <input type="file" onChange={(e) => setFile(e.target.files[0])} className="file-input" id="file-upload" />
                  <label htmlFor="file-upload" className="upload-btn">📎</label>
                </form>
                <input
                  type="text"
                  value={privateInput}
                  onChange={(e) => setPrivateInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                  placeholder="Напишіть повідомлення..."
                  className="message-input-field"
                />
                <button onClick={sendPrivateMessage} className="send-btn">➤</button>
              </div>
            </div>
          ) : (
            <p className="no-chat">Виберіть чат або знайдіть нового користувача</p>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    const savedUsername = sessionStorage.getItem('username');
    return {
      username: savedUsername || null,
      sessionId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
  });

  useEffect(() => {
    if (auth.username) {
      sessionStorage.setItem('username', auth.username);
    } else {
      sessionStorage.removeItem('username');
    }
  }, [auth.username]);

  const login = (username) => {
    setAuth((prev) => ({ ...prev, username }));
  };

  const logout = () => {
    setAuth((prev) => ({ ...prev, username: null }));
    sessionStorage.removeItem('username');
  };

  return (
    <ThemeProvider>
      <AuthContext.Provider value={{ ...auth, login, logout }}>
        <div className="App">
          <Routes>
            <Route
              path="/login"
              element={
                auth.username ? (
                  <Navigate to="/chat" />
                ) : (
                  <div className="auth-page">
                    <Login />
                  </div>
                )
              }
            />
            <Route
              path="/register"
              element={
                auth.username ? (
                  <Navigate to="/chat" />
                ) : (
                  <div className="auth-page">
                    <Register />
                  </div>
                )
              }
            />
            <Route
              path="/chat"
              element={auth.username ? <Chat /> : <Navigate to="/login" />}
            />
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;