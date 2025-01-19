// This will be loaded as a module
export function initializeTheme() {
  try {
    const savedTheme = localStorage.getItem('theme') || 'system';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = savedTheme === 'system' ? systemTheme : savedTheme;
    
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    // Fallback to light theme if localStorage is not available
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }
}
