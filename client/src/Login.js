import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './App';
import './Auth.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const SERVER_IP = window.location.hostname === 'localhost' ? 'localhost' : '192.168.1.100'; // Автоматично визначаємо IP
  const SERVER_URL = `http://${SERVER_IP}:4000`;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      console.log('Надсилаю запит на вхід:', { username, password });
      const response = await axios.post(`${SERVER_URL}/login`, { username, password });
      console.log('Відповідь від сервера:', response.data);
      login(response.data.username);
      navigate('/chat');
    } catch (err) {
      console.error('Помилка входу:', err);
      setError(err.response?.data?.error || 'Помилка входу');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Вхід</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Ім’я користувача</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введіть ім’я користувача"
            />
          </div>
          <div className="input-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введіть пароль"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="auth-button">Увійти</button>
        </form>
        <p className="link">
          Немає акаунта? <a href="/register">Зареєструватися</a>
        </p>
      </div>
    </div>
  );
}

export default Login;