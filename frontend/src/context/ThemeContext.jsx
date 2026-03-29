import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Fetch initial theme from backend
    api.get('/settings').then((res) => {
      if (res.data.theme) {
        setTheme(res.data.theme);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Sync with backend
    api.put('/settings', { theme }).catch(() => {});
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
