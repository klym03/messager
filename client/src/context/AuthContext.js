// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children, serverUrl }) => {
  // Ініціалізуємо username синхронно з localStorage
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('username') || null;
  });

  const login = (username) => {
    setUsername(username);
    localStorage.setItem('username', username);
  };

  const logout = () => {
    setUsername(null);
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider value={{ username, login, logout, serverUrl }}>
      {children}
    </AuthContext.Provider>
  );
};