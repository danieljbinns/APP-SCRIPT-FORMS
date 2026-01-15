/**
 * Theme Toggle System for Accessibility
 * Provides light/dark mode switching with localStorage persistence
 * Can be used across any workflow or form page
 */

const ThemeToggle = (function() {
  'use strict';

  // Theme configurations
  const themes = {
    dark: {
      '--bg-color': '#000000',
      '--card-bg': '#1a1a1a',
      '--text-main': '#ffffff',
      '--text-muted': '#b0b0b0',
      '--brand-red': '#EB1C2D',
      '--brand-red-hover': '#c41522',
      '--input-bg': '#2a2a2a',
      '--input-border': '#444',
      '--border-color': '#333',
      '--status-complete': '#0f9d58',
      '--status-open': '#f4b400',
      '--status-progress': '#4285f4'
    },
    light: {
      '--bg-color': '#ffffff',
      '--card-bg': '#f5f5f5',
      '--text-main': '#000000',
      '--text-muted': '#666666',
      '--brand-red': '#EB1C2D',
      '--brand-red-hover': '#c41522',
      '--input-bg': '#ffffff',
      '--input-border': '#cccccc',
      '--border-color': '#e0e0e0',
      '--status-complete': '#0f9d58',
      '--status-open': '#f4b400',
      '--status-progress': '#4285f4'
    }
  };

  // Get current theme from localStorage or default to dark
  function getCurrentTheme() {
    return localStorage.getItem('theme') || 'dark';
  }

  // Apply theme to document
  function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) return;

    const root = document.documentElement;
    Object.keys(theme).forEach(property => {
      root.style.setProperty(property, theme[property]);
    });

    // Store in localStorage
    localStorage.setItem('theme', themeName);

    // Update toggle button if it exists
    updateToggleButton(themeName);
  }

  // Update toggle button appearance
  function updateToggleButton(themeName) {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    const icon = toggleBtn.querySelector('.theme-icon');
    const label = toggleBtn.querySelector('.theme-label');

    if (themeName === 'dark') {
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Light Mode';
      toggleBtn.setAttribute('aria-label', 'Switch to light mode');
    } else {
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark Mode';
      toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    }
  }

  // Toggle between themes
  function toggle() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }

  // Initialize theme on page load
  function init() {
    const currentTheme = getCurrentTheme();
    applyTheme(currentTheme);

    // Add toggle button to page if container exists
    const container = document.getElementById('theme-toggle-container');
    if (container) {
      createToggleButton(container);
    }
  }

  // Create toggle button HTML
  function createToggleButton(container) {
    const currentTheme = getCurrentTheme();
    const icon = currentTheme === 'dark' ? '☀️' : '🌙';
    const label = currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode';

    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle-btn';
    button.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    button.innerHTML = `
      <span class="theme-icon">${icon}</span>
      <span class="theme-label">${label}</span>
    `;
    button.onclick = toggle;

    container.appendChild(button);
  }

  // Public API
  return {
    init: init,
    toggle: toggle,
    getCurrentTheme: getCurrentTheme,
    applyTheme: applyTheme
  };
})();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ThemeToggle.init);
} else {
  ThemeToggle.init();
}
