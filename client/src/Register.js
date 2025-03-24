import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './App';
import './Auth.css';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // const SERVER_IP = window.location.hostname === 'localhost' ? 'localhost' : '192.168.1.100'; // Автоматично визначаємо IP
  const SERVER_URL = 'http://192.168.1.69:4000';

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }

    if (!username || !password) {
      setError('Введіть ім’я користувача та пароль');
      return;
    }

    if (password.length < 6) {
      setError('Пароль має бути не коротшим за 6 символів');
      return;
    }

    try {
      console.log('Надсилаю запит на реєстрацію:', { username, password });
      const response = await axios.post(`${SERVER_URL}/register`, { username, password });
      console.log('Відповідь від сервера:', response.data);
      login(username);
      navigate('/chat');
    } catch (err) {
      console.error('Помилка при реєстрації:', err);
      setError(err.response?.data?.error || 'Помилка реєстрації');
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError('');
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Реєстрація</h2>
        <form onSubmit={handleRegister}>
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
              onChange={handlePasswordChange}
              placeholder="Введіть пароль"
            />
          </div>
          <div className="input-group">
            <label>Повторіть пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="Повторіть пароль"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="auth-button">Зареєструватися</button>
        </form>
        <p className="link">
          Уже є акаунт? <a href="/login">Увійти</a>
        </p>
      </div>
    </div>
  );
}

export default Register;