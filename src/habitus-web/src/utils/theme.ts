const THEME_CHANGED_EVENT = 'theme-changed';

export function getIsDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function applyTheme(theme: 'dark' | 'light') {
  const isDark = theme === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }

  localStorage.setItem('theme', theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme } }));
}

export function toggleTheme(): boolean {
  const nextTheme = getIsDarkMode() ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme === 'dark';
}

export function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;
  applyTheme(shouldUseDark ? 'dark' : 'light');
}

export function onThemeChanged(listener: () => void) {
  window.addEventListener(THEME_CHANGED_EVENT, listener);
  return () => window.removeEventListener(THEME_CHANGED_EVENT, listener);
}
