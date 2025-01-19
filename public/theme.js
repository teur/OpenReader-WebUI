// Immediately apply the theme before any content loads
(function() {
  try {
    let theme = localStorage.getItem('theme') || 'system';
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // If theme is system, use the system preference
    if (theme === 'system') {
      theme = systemTheme ? 'dark' : 'light';
    }

    // Remove both classes and add the current one
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;

    // Watch for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem('theme') === 'system') {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(e.matches ? 'dark' : 'light');
        document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light';
      }
    });
  } catch (e) {
    // Fallback to light theme if localStorage is not available
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }
})();
