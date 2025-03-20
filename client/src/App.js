import React, { useState, useEffect, useContext, useRef } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
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
  const [file, setFile] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [userPublicKeys, setUserPublicKeys] = useState({});
  const pendingMessages = useRef({}); // Замінили useState на useRef

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateKeyPair = () => {
    const passphrase = CryptoJS.lib.WordArray.random(32).toString();
    return { privateKey: passphrase, publicKey: passphrase };
  };

  const encryptMessage = (message, publicKey) => {
    console.log('Шифрування повідомлення:', { message, publicKey });
    return CryptoJS.AES.encrypt(message, publicKey).toString();
  };

  const decryptMessage = (ciphertext, privateKey) => {
    console.log('Спроба дешифрування:', { ciphertext, privateKey });
    try {
      if (!ciphertext || !privateKey) {
        throw new Error('Відсутні ciphertext або privateKey');
      }
      const bytes = CryptoJS.AES.decrypt(ciphertext, privateKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      console.log('Результат дешифрування:', { decrypted });
      if (!decrypted) {
        console.warn('Дешифрування повернуло порожній рядок, повертаємо ciphertext:', ciphertext);
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
      console.log(`Генерація ключів для ${username}:`, { privateKey, publicKey });
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
      console.log('Отримано історію приватних повідомлень:', history);
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
      console.log('Отримано нове приватне повідомлення:', message);
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
      console.log('Оновлено публічні ключі:', keys);
      const filteredKeys = Object.fromEntries(
        Object.entries(keys).filter(([key]) => typeof key === 'string' && key.trim() !== '')
      );
      setUserPublicKeys(filteredKeys);
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
      alert('Помилка підключення до сервера. Перевірте мережу або сервер.');
    });

    socket.on('reconnect', (attempt) => {
      console.log('Повторне підключення успішне, спроба:', attempt, 'socket.id:', socket.id);
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
  }, [username, sessionId, selectedChat, privateKey]); // pendingMessages більше не потрібен у залежностях

  useEffect(() => {
    scrollToBottom();
  }, [privateMessages, selectedChat]);

  const sendPrivateMessage = () => {
    if (privateInput.trim() && selectedChat && userPublicKeys[selectedChat]) {
      console.log(`Відправка повідомлення від ${username} до ${selectedChat}:`, privateInput);
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
      console.error('Помилка відправлення: відсутній текст, обраний чат або публічний ключ', {
        privateInput,
        selectedChat,
        userPublicKeys: { ...userPublicKeys },
      });
      if (!userPublicKeys[selectedChat]) {
        alert(`Публічний ключ для ${selectedChat} не знайдено. Переконайтеся, що користувач онлайн.`);
      }
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);

    try {
      const response = await axios.post(`${SERVER_URL}/upload`, formData);
      if (response.data === 'Файл завантажено') {
        const filePath = `/uploads/${file.name}`;
        const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const tempMessage = {
          id: tempId,
          sender_username: username,
          receiver_username: selectedChat,
          content: filePath,
          timestamp: new Date().toISOString(),
        };
        setPrivateMessages(prev => {
          const updatedChats = { ...prev };
          if (!updatedChats[selectedChat]) updatedChats[selectedChat] = [];
          updatedChats[selectedChat] = [...updatedChats[selectedChat], tempMessage];
          return updatedChats;
        });
        pendingMessages.current[tempId] = filePath;
        socket.emit('sendPrivateMessage', { receiver: selectedChat, content: filePath, tempId });
      }
      setFile(null);
    } catch (error) {
      console.error('Помилка завантаження:', error.message);
      alert('Помилка завантаження файлу. Перевірте з’єднання з сервером.');
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

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`App ${theme || 'light'}`}>
      <header className="app-header">
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
                      <div className="message-text">
                        {msg.content && msg.content.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                          <img src={`${SERVER_URL}${msg.content}`} alt="uploaded" className="message-image" />
                        ) : (
                          msg.content || 'Помилка: повідомлення не завантажено'
                        )}
                      </div>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
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