'use client';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const initial = localStorage.getItem('theme') ?? (mql.matches ? 'dark' : 'light');
    if (initial === 'dark') document.documentElement.classList.add('dark');
    setDark(initial === 'dark');
  }, []);

  if (!mounted) return null;

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
      <button onClick={toggle} className="px-3 py-2 rounded border border-border text-sm">
      {dark ? 'Dark' : 'Light'} mode
    </button>
  );
}
