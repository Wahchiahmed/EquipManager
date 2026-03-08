/**
 * ThemeToggle.tsx
 *
 * Bouton compact à placer dans la Navbar / Sidebar.
 * Deux variantes :
 *   - variant="icon"     → icône seule, cycle light → dark → system au clic
 *   - variant="dropdown" → menu déroulant avec les 3 options (défaut)
 *
 * Usage :
 *   <ThemeToggle />               // dropdown
 *   <ThemeToggle variant="icon" /> // icône cycle
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

// ─── Config options ───────────────────────────────────────────────────────────
const OPTIONS: {
  key: ThemeMode;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { key: 'light',  label: 'Clair',   icon: Sun },
  { key: 'dark',   label: 'Sombre',  icon: Moon },
  { key: 'system', label: 'Système', icon: Monitor },
];

const CYCLE_ORDER: ThemeMode[] = ['light', 'dark', 'system'];

// ─── Variant: icône seule ─────────────────────────────────────────────────────
const IconToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(theme) + 1) % CYCLE_ORDER.length];
    setTheme(next);
  };

  const CurrentIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = OPTIONS.find(o => o.key === theme)?.label ?? 'Thème';

  return (
    <button
      onClick={handleClick}
      title={`Thème actuel : ${label} — cliquer pour changer`}
      className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
    >
      <CurrentIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
    </button>
  );
};

// ─── Variant: dropdown ────────────────────────────────────────────────────────
const DropdownToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer sur clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fermer sur Échap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const CurrentIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Changer le thème"
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                   bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                   transition-colors shadow-sm"
      >
        <CurrentIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">
          {OPTIONS.find(o => o.key === theme)?.label}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-200
                        dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[200]
                        animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Thème d'affichage
            </p>
          </div>
          {OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTheme(key); setOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${theme === key
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {theme === key && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              Appliqué : <span className="font-semibold">{resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'dropdown' }) =>
  variant === 'icon' ? <IconToggle /> : <DropdownToggle />;

export default ThemeToggle;