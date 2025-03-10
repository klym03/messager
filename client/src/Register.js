import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Auth.css'; // Імпортуємо стилі

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:4000/register', { username, password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка реєстрації');
    }
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введіть пароль"
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