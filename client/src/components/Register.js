// src/components/Register.js
import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../Auth.css';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, serverUrl } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Надсилаємо запит на сервер:', { username, password, serverUrl });
      const response = await axios.post(`${serverUrl}/register`, {
        username,
        password,
      });
      console.log('Відповідь від сервера:', response.data);
      if (response.data.message === 'Реєстрація успішна') {
        console.log('Реєстрація успішна, викликаємо login і перенаправлення');
        login(username);
        navigate('/chat', { replace: true });
      } else {
        console.log('Реєстрація неуспішна:', response.data.message);
        setError(response.data.message || 'Помилка реєстрації');
      }
    } catch (err) {
      console.error('Помилка запиту до сервера:', err);
      setError('Помилка сервера. Спробуйте ще раз.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Реєстрація</h2>
      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <div className="form-group">
              <label>Ім'я користувача:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Пароль:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit">Зареєструватися</button>
        </form>
        <p>
          Вже є акаунт? <a href="/login">Увійти</a>
        </p>
      </div>
    </div>
  );
}

export default Register;