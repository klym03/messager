import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.className = theme;
    console.log('Застосовуємо тему:', theme);
  }, [theme]);

  const toggleTheme = () => {
    console.log('Перемикаємо тему з', theme);
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    console.log('Нова тема:', theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};