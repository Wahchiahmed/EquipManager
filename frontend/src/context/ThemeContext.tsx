/**
 * ThemeContext.tsx
 *
 * Gestion globale du thème : light | dark | system
 * - Persiste dans localStorage ('app-theme')
 * - En mode 'system', écoute prefers-color-scheme
 * - Ajoute / retire la classe `dark` sur <html> (Tailwind darkMode: 'class')
 */

import React, {
  createContext, useContext, useEffect,
  useState, useCallback, useMemo,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:         'system',
  resolvedTheme: 'light',
  setTheme:      () => {},
});

const STORAGE_KEY = 'app-theme';

const getSystemPreference = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const resolve = (mode: ThemeMode): 'light' | 'dark' =>
  mode === 'system' ? getSystemPreference() : mode;

const applyToDom = (resolved: 'light' | 'dark') => {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  // Meta theme-color for mobile status bar
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = resolved === 'dark' ? '#111827' : '#ffffff';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch { /* SSR / private browsing */ }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolve(theme));

  // Apply to DOM when theme changes
  useEffect(() => {
    const resolved = resolve(theme);
    setResolvedTheme(resolved);
    applyToDom(resolved);
  }, [theme]);

  // Listen to OS changes when mode === 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onOsChange = () => {
      if (theme === 'system') {
        const resolved = getSystemPreference();
        setResolvedTheme(resolved);
        applyToDom(resolved);
      }
    };
    mq.addEventListener('change', onOsChange);
    return () => mq.removeEventListener('change', onOsChange);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
    setThemeState(mode);
    // Apply immediately without waiting for next render
    const resolved = resolve(mode);
    setResolvedTheme(resolved);
    applyToDom(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);