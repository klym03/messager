import React, { useState, useEffect, useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import Login from './Login';
import Register from './Register';
import { ThemeProvider } from './ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

export const AuthContext = React.createContext();

const SERVER_IP = window.location.hostname === 'localhost' ? 'localhost' : '192.168.1.100';
const SERVER_URL = `http://${SERVER_IP}:4000`;
const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });

function Chat() {
  const { username, sessionId, logout } = useContext(AuthContext);
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
  }, [username, sessionId]);

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
    <div className="App">
      <h1>Мій месенджер</h1>
      <div style={{ textAlign: 'right', marginBottom: '10px' }}>
        <button onClick={handleLogout} style={{ padding: '5px 10px', marginRight: '10px' }}>
          Вийти
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Пошук активного користувача..."
          style={{ padding: '5px', width: '200px' }}
        />
        <button onClick={handleSearch} style={{ padding: '5px 10px' }}>
          Шукати
        </button>
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((user, index) => (
              <div
                key={index}
                onClick={() => handleSelectUser(user)}
                style={{ padding: '5px', cursor: 'pointer' }}
              >
                {user}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ width: '200px', border: '1px solid var(--input-border)', padding: '10px' }}>
          <h3>Чати</h3>
          {chatList.map((user) => (
            <div
              key={user}
              onClick={() => setSelectedChat(user)}
              style={{
                padding: '5px',
                cursor: 'pointer',
                background: selectedChat === user ? '#d0d0d0' : 'transparent'
              }}
            >
              {user} {privateMessages[user]?.length > 0 && (
                <small>({new Date(privateMessages[user][privateMessages[user].length - 1].timestamp).toLocaleTimeString()})</small>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {selectedChat ? (
            <div className="private-messages">
              <h3>Переписка з {selectedChat}</h3>
              <div style={{ border: '1px solid var(--input-border)', padding: '10px', height: '300px', overflowY: 'auto', marginBottom: '10px' }}>
                {privateMessages[selectedChat]?.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      margin: '5px 0',
                      textAlign: msg.sender_username === username ? 'right' : 'left'
                    }}
                  >
                    <strong>{msg.sender_username}</strong>: {msg.content.match(/\.(jpeg|jpg|png|gif)$/i) ? (
                      <img src={`${SERVER_URL}${msg.content}`} alt="uploaded" style={{ maxWidth: '200px' }} />
                    ) : (
                      msg.content
                    )} <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                  </div>
                ))}
              </div>
              <input
                type="text"
                value={privateInput}
                onChange={(e) => setPrivateInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendPrivateMessage()}
                placeholder="Напишіть повідомлення..."
                style={{ padding: '5px', width: '70%' }}
              />
              <button onClick={sendPrivateMessage} style={{ padding: '5px 10px' }}>
                Надіслати
              </button>
              <form onSubmit={handleFileUpload} style={{ marginTop: '10px' }}>
                <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                <button type="submit">Завантажити</button>
              </form>
            </div>
          ) : (
            <p>Виберіть чат або знайдіть нового користувача</p>
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