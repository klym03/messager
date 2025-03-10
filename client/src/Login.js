import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Auth.css'; // Імпортуємо стилі

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:4000/login', { username, password });
      localStorage.setItem('username', response.data.username);
      navigate('/chat');
    } catch (err) {
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