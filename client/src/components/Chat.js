// src/components/Chat.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Додаємо useNavigate
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
} from '../utils/crypto';
import {
  initializeSocket,
  emitSetPublicKey,
  emitSendPrivateMessage,
  emitSearchUser,
  emitLeave,
  isSocketConnected,
} from '../utils/socket';

function Chat() {
  const { username, sessionId, logout, serverUrl } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate(); // Додаємо navigate
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

  useEffect(() => {
    if (username) {
      const { privateKey, publicKey } = generateKeyPair();
      setPrivateKey(privateKey);
      emitSetPublicKey(username, publicKey);
    }
  }, [username]);

  useEffect(() => {
    const cleanup = initializeSocket(
      username,
      sessionId,
      () => {
        console.log('Підключено до сервера');
      },
      (history) => {
        const chats = {};
        history.forEach((msg) => {
          const otherUser = msg.sender_username === username ? msg.receiver_username : msg.sender_username;
          if (!chats[otherUser]) chats[otherUser] = [];
          const content = msg.sender_username === username ? decryptMessage(msg.content, privateKey) : decryptMessage(msg.content, privateKey);
          chats[otherUser].push({ ...msg, content });
        });
        setPrivateMessages(chats);
        if (!selectedChat && Object.keys(chats).length > 0) {
          setSelectedChat(Object.keys(chats)[0]);
        }
      },
      (message) => {
        const otherUser = message.sender_username === username ? message.receiver_username : message.sender_username;
        const content = message.sender_username === username ? (pendingMessages.current[message.tempId]?.content || decryptMessage(message.content, privateKey)) : decryptMessage(message.content, privateKey);

        setPrivateMessages((prev) => {
          const updatedChats = { ...prev };
          if (!updatedChats[otherUser]) updatedChats[otherUser] = [];

          if (message.sender_username === username) {
            const file = pendingMessages.current[message.tempId]?.file || null;
            updatedChats[otherUser] = updatedChats[otherUser].filter((msg) => msg.id !== message.tempId);
            updatedChats[otherUser] = [...updatedChats[otherUser], { ...message, content, file }];
          } else {
            updatedChats[otherUser] = [...updatedChats[otherUser], { ...message, content }];
          }

          return updatedChats;
        });

        delete pendingMessages.current[message.tempId];
      },
      (keys) => {
        const filteredKeys = Object.fromEntries(
          Object.entries(keys).filter(([key]) => typeof key === 'string' && key.trim() !== '')
        );
        setUserPublicKeys(filteredKeys);
      },
      (error) => {
        alert(error);
      },
      (results) => {
        setSearchResults(results);
      },
      (err) => {
        console.error('Помилка підключення до WebSocket:', err.message);
        console.error('Деталі помилки:', err);
        alert('Помилка підключення до сервера. Перевірте мережу або сервер.');
      },
      (attempt) => {
        console.log('Реконнект, спроба:', attempt);
        initializeSocket(username, sessionId);
      },
      (err) => {
        console.error('Помилка реконнекту:', err.message);
      },
      () => {
        console.error('Не вдалося реконнектитися після всіх спроб');
      }
    );

    return cleanup;
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
      setPrivateMessages((prev) => {
        const updatedChats = { ...prev };
        if (!updatedChats[selectedChat]) updatedChats[selectedChat] = [];
        updatedChats[selectedChat] = [...updatedChats[selectedChat], tempMessage];
        return updatedChats;
      });
      pendingMessages.current[tempId] = { content: privateInput };
      emitSendPrivateMessage(selectedChat, encryptedContent, tempId);
      setPrivateInput('');
    } else {
      if (!userPublicKeys[selectedChat]) {
        alert(`Публічний ключ для ${selectedChat} не знайдено. Переконайтеся, що користувач онлайн.`);
      }
    }
  };

  const handleFileUpload = async (e) => {
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

    if (file.size > 10 * 1024 * 1024) {
      alert("Файл занадто великий! Максимальний розмір — 10 МБ.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Дозволені лише зображення (JPEG, PNG, GIF)!");
      return;
    }

    const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const tempMessage = {
      id: tempId,
      sender_username: username,
      receiver_username: selectedChat,
      content: '',
      file: file,
      timestamp: new Date().toISOString(),
    };

    setPrivateMessages((prev) => {
      const updatedChats = { ...prev };
      if (!updatedChats[selectedChat]) updatedChats[selectedChat] = [];
      updatedChats[selectedChat] = [...updatedChats[selectedChat], tempMessage];
      return updatedChats;
    });

    pendingMessages.current[tempId] = { file };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);
    formData.append('receiver', selectedChat);
    formData.append('tempId', tempId);

    try {
      const response = await fetch(`${serverUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Server response:", data);

      if (data.success) {
        const filePath = data.filePath;
        emitSendPrivateMessage(selectedChat, filePath, tempId);
      } else {
        throw new Error(data.error || 'Помилка завантаження файлу');
      }
    } catch (error) {
      console.error('Помилка завантаження:', error.message);
      alert('Помилка завантаження файлу. Перевірте з’єднання з сервером.');
      setPrivateMessages((prev) => {
        const updatedChats = { ...prev };
        updatedChats[selectedChat] = updatedChats[selectedChat].filter((msg) => msg.id !== tempId);
        return updatedChats;
      });
    }

    e.target.value = null;
  };

  const handleLogout = () => {
    console.log('Викликано handleLogout, username:', username, 'sessionId:', sessionId);
    logout();
    console.log('Викликано logout');
    emitLeave(username, sessionId);
    console.log('Викликано emitLeave');
    navigate('/login', { replace: true }); // Додаємо перенаправлення
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      if (!isSocketConnected()) {
        alert('Помилка: немає з’єднання з сервером');
        return;
      }
      emitSearchUser(searchTerm);
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
                              src={`${serverUrl}${msg.content}`}
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
                    style={{ display: 'none' }}
                  />
                  <span
                    className="upload-btn"
                    onClick={(e) => {
                      console.log("Upload button clicked");
                      document.getElementById('file-upload').click();
                    }}
                  >
                    📎
                  </span>
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

export default Chat;