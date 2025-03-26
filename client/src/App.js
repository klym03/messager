// src/App.js
import React, { useContext } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import { ThemeProvider, ThemeContext } from './context/ThemeContext';
import { AuthContext, AuthProvider } from './context/AuthContext';
import './App.css';

const SERVER_URL = 'http://192.168.1.69:4000';

// Компонент для рендерингу маршрутів
function AppContent() {
  const { theme } = useContext(ThemeContext);
  const { username } = useContext(AuthContext);

  return (
    <div className={`App ${theme || 'light'}`}>
      <Routes>
        <Route
          path="/login"
          element={
            <div className="auth-page">
              <Login />
            </div>
          }
        />
        <Route
          path="/register"
          element={
            <div className="auth-page">
              <Register />
            </div>
          }
        />
        <Route
          path="/chat"
          element={
            username ? (
              <div className="chat-page">
                <Chat />
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider serverUrl={SERVER_URL}>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;