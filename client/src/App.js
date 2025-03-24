import React, { useState, useEffect, useContext, useRef } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import CryptoJS from 'crypto-js';
import Login from './Login';
import Register from './Register';
import { ThemeProvider, ThemeContext } from './ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

export const AuthContext = React.createContext();

const SERVER_IP = window.location.hostname === 'localhost' ? 'localhost' : '192.168.1.100';
const SERVER_URL = `http://${SERVER_IP}:4000`;
const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });

function Chat() {
  const { username, sessionId, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [privateMessages, setPrivateMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [privateInput, setPrivateInput] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const pendingMessages = useRef({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateKeyPair = () => {
    const passphrase = CryptoJS.lib.WordArray.random(32).toString();
    return { privateKey: passphrase, publicKey: passphrase };
  };

  const encryptMessage = (message, publicKey) => {
    return CryptoJS.AES.encrypt(message, publicKey).toString();
  };

  const decryptMessage = (ciphertext, privateKey) => {
    try {
      if (!ciphertext || !privateKey) {
        throw new Error('Відсутні ciphertext або privateKey');
      }
      const bytes = CryptoJS.AES.decrypt(ciphertext, privateKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        return ciphertext;
      }
      return decrypted;
    } catch (e) {
      console.error('Помилка дешифрування:', e.message);
      return ciphertext;
    }
  };

  useEffect(() => {
    if (username) {
      const { privateKey, publicKey } = generateKeyPair();
      setPrivateKey(privateKey);
      socket.emit('setPublicKey', { username, publicKey });
    }
  }, [username]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Підключено до сервера, socket.id:', socket.id);
      socket.emit('join', { username, sessionId });
    });

    socket.on('privateMessageHistory', (history) => {
      const chats = {};
      history.forEach(msg => {
        const otherUser = msg.sender_username === username ? msg.receiver_username : msg.sender_username;
        if (!chats[otherUser]) chats[otherUser] = [];
        const content = msg.sender_username === username ? decryptMessage(msg.content, privateKey) : decryptMessage(msg.content, privateKey);
        chats[otherUser].push({ ...msg, content });
      });
      setPrivateMessages(chats);
      if (!selectedChat && Object.keys(chats).length > 0) {
        setSelectedChat(Object.keys(chats)[0]);
      }
    });

    socket.on('newPrivateMessage', (message) => {
      const otherUser = message.sender_username === username ? message.receiver_username : message.sender_username;
      const content = message.sender_username === username ? (pendingMessages.current[message.tempId] || decryptMessage(message.content, privateKey)) : decryptMessage(message.content, privateKey);

      setPrivateMessages(prev => {
        const updatedChats = { ...prev };
        if (!updatedChats[otherUser]) updatedChats[otherUser] = [];

        if (message.sender_username === username) {
          updatedChats[otherUser] = updatedChats[otherUser].filter(msg => msg.id !== message.tempId);
        }

        updatedChats[otherUser] = [...updatedChats[otherUser], { ...message, content }];
        return updatedChats;
      });

      delete pendingMessages.current[message.tempId];
    });

    socket.on('publicKeyUpdate', (keys) => {
      const filteredKeys = Object.fromEntries(
        Object.entries(keys).filter(([key]) => typeof key === 'string' && key.trim() !== '')
      );
      setUserPublicKeys(filteredKeys);
    });

    socket.on('privateMessageError', (error) => {
      alert(error);
    });

    socket.on('searchResults', (results) => {
      setSearchResults(results);
    });

    socket.on('connect_error', (err) => {
      console.error('Помилка підключення до WebSocket:', err.message);
      alert('Помилка підключення до сервера. Перевірте мережу або сервер.');
    });

    socket.on('reconnect', (attempt) => {
      socket.emit('join', { username, sessionId });
    });

    return () => {
      socket.off('privateMessageHistory');
      socket.off('newPrivateMessage');
      socket.off('publicKeyUpdate');
      socket.off('privateMessageError');
      socket.off('searchResults');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('reconnect');
    };
  }, [username, sessionId, selectedChat, privateKey]);

  useEffect(() => {
    scrollToBottom();
  }, [privateMessages, selectedChat]);

  const sendPrivateMessage = () => {
    if (privateInput.trim() && selectedChat && userPublicKeys[selectedChat]) {
      const encryptedContent = encryptMessage(privateInput, userPublicKeys[selectedChat]);
      const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const tempMessage = {
        id: tempId,
        sender_username: username,
        receiver_username: selectedChat,
        content: privateInput,
        timestamp: new Date().toISOString(),
      };
      setPrivateMessages(prev => {
        const updatedChats = { ...prev };
        if (!updatedChats[selectedChat]) updatedChats[selectedChat] = [];
        updatedChats[selectedChat] = [...updatedChats[selectedChat], tempMessage];
        return updatedChats;
      });
      pendingMessages.current[tempId] = privateInput;
      socket.emit('sendPrivateMessage', { receiver: selectedChat, content: encryptedContent, tempId });
      setPrivateInput('');
    } else {
      if (!userPublicKeys[selectedChat]) {
        alert(`Публічний ключ для ${selectedChat} не знайдено. Переконайтеся, що користувач онлайн.`);
      }
    }
  };

  const handleFileUpload = (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    console.log("File selected:", file);

    if (!file) {
      console.log("Файл не вибрано");
      return;
    }

    if (!selectedChat) {
      alert("Виберіть чат перед відправкою файлу!");
      return;
    }

    // Перевірка розміру файлу (максимум 10 МБ)
    if (file.size > 10 * 1024 * 1024) {
      alert("Файл занадто великий! Максимальний розмір — 10 МБ.");
      return;
    }

    // Перевірка типу файлу (лише зображення)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Дозволені лише зображення (JPEG, PNG, GIF)!");
      return;
    }

    // Створюємо повідомлення з файлом
    const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const message = {
      id: tempId,
      sender_username: username,
      receiver_username: selectedChat,
      content: '', // Порожній текст, бо це файл
      file: file, // Зберігаємо файл для локального відображення
      timestamp: new Date().toISOString(),
    };

    // Додаємо повідомлення до стану
    setPrivateMessages(prev => {
      const updatedChats = { ...prev };
      if (!updatedChats[selectedChat]) updatedChats[selectedChat] = [];
      updatedChats[selectedChat] = [...updatedChats[selectedChat], message];
      return updatedChats;
    });

    // Відправляємо повідомлення через WebSocket (без сервера для тестування)
    socket.emit('sendPrivateMessage', {
      receiver: selectedChat,
      content: `Файл: ${file.name}`,
      tempId,
    });

    // Очищаємо інпут
    e.target.value = null;
  };

  const handleLogout = () => {
    logout();
    socket.emit('leave', { username, sessionId });
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      if (!socket.connected) {
        alert('Помилка: немає з’єднання з сервером');
        return;
      }
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

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`App ${theme || 'light'}`}>
      <header className="app-header">
        <div className="app-title">
          <h1>SkalMess@</h1>
        </div>
        <div className="user-info">
          <div className="user-actions">
            <ThemeToggle />
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
                        {formatTime(privateMessages[user][privateMessages[user].length - 1].timestamp)}
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
                    key={msg.id || index}
                    className={`message ${msg.sender_username === username ? 'sent' : 'received'}`}
                  >
                    <div className="message-content">
                      {msg.content && (
                        <div className="message-text">
                          {msg.content.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                            <img
                              src={`${SERVER_URL}${msg.content}`}
                              alt="uploaded"
                              className="message-image"
                            />
                          ) : (
                            msg.content
                          )}
                        </div>
                      )}
                      {msg.file && msg.file.type.startsWith('image/') && (
                        <div className="message-text">
                          <img
                            src={URL.createObjectURL(msg.file)}
                            alt="uploaded"
                            className="message-image"
                          />
                        </div>
                      )}
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="message-input">
                <form className="upload-form">
                  <input
                    type="file"
                    className="file-input"
                    id="file-upload"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="upload-btn" onClick={() => console.log("Upload button clicked")}>
                    📎
                  </label>
                </form>
                <input
                  type="text"
                  value={privateInput}
                  onChange={(e) => setPrivateInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                  placeholder="Напишіть повідомлення..."
                  className="message-input-field"
                />
                <button onClick={sendPrivateMessage} className="send-btn">
                  ➤
                </button>
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