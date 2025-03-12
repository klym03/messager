import React, { useContext, useEffect } from 'react';
import { ThemeContext } from '../ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { isDarkTheme, toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    const toggleContainer = document.querySelector('.theme-toggle-container');
    if (toggleContainer) {
      toggleContainer.classList.add('visible');
    }
  }, []);

  return (
    <div className="theme-toggle-container">
      <label className="switch">
        <input type="checkbox" checked={isDarkTheme} onChange={toggleTheme} />
        <span className="slider">
          <span className="slider-thumb">
            <span className="icon light-icon">
              <FiSun />
            </span>
            <span className="icon dark-icon">
              <FiMoon />
            </span>
          </span>
        </span>
      </label>
    </div>
  );
};

export default ThemeToggle;