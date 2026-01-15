/**
 * CSS FRAMEWORK LIBRARY
 * Enterprise-grade component library with theme system, responsive design, and animations
 * Provides reusable CSS for all dashboard components, forms, and UI elements
 */

/**
 * Generates complete CSS framework with all components
 * Includes theme variables, component styles, animations, responsive utilities
 * @param {string} theme - 'light' or 'dark' theme
 * @returns {string} Complete CSS stylesheet
 */
function generateCSSFramework(theme = 'light') {
  const colors = getThemeColors(theme);
  const spacing = getSpacingSystem();
  const typography = getTypographySystem();
  const shadows = getShadowSystem();
  const breakpoints = getBreakpoints();

  return `
/* ====== ENTERPRISE CSS FRAMEWORK ====== */

/* ROOT VARIABLES */
:root {
  /* Colors - ${theme.toUpperCase()} THEME */
  --primary-color: ${colors.primary};
  --secondary-color: ${colors.secondary};
  --success-color: ${colors.success};
  --warning-color: ${colors.warning};
  --danger-color: ${colors.danger};
  --info-color: ${colors.info};

  --text-primary: ${colors.textPrimary};
  --text-secondary: ${colors.textSecondary};
  --text-light: ${colors.textLight};

  --bg-primary: ${colors.bgPrimary};
  --bg-secondary: ${colors.bgSecondary};
  --bg-tertiary: ${colors.bgTertiary};

  --border-color: ${colors.borderColor};
  --border-light: ${colors.borderLight};

  /* Spacing */
  --spacing-xs: ${spacing.xs};
  --spacing-sm: ${spacing.sm};
  --spacing-md: ${spacing.md};
  --spacing-lg: ${spacing.lg};
  --spacing-xl: ${spacing.xl};
  --spacing-2xl: ${spacing['2xl']};

  /* Typography */
  --font-primary: ${typography.fontPrimary};
  --font-mono: ${typography.fontMono};
  --font-size-sm: ${typography.fontSizeSm};
  --font-size-base: ${typography.fontSizeBase};
  --font-size-lg: ${typography.fontSizeLg};
  --font-size-xl: ${typography.fontSizeXl};
  --font-size-2xl: ${typography.fontSize2xl};

  --font-weight-light: ${typography.fontWeightLight};
  --font-weight-normal: ${typography.fontWeightNormal};
  --font-weight-semibold: ${typography.fontWeightSemibold};
  --font-weight-bold: ${typography.fontWeightBold};

  /* Shadows */
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};
  --shadow-xl: ${shadows.xl};

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Z-Index */
  --z-dropdown: 1000;
  --z-modal: 2000;
  --z-tooltip: 3000;
  --z-notification: 4000;
}

/* ====== BASE STYLES ====== */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  transition: background-color var(--transition-base), color var(--transition-base);
}

/* ====== TYPOGRAPHY ====== */

h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  margin-bottom: var(--spacing-md);
}

h1 {
  font-size: var(--font-size-2xl);
}

h2 {
  font-size: var(--font-size-xl);
}

h3 {
  font-size: var(--font-size-lg);
}

h4, h5, h6 {
  font-size: var(--font-size-base);
}

p {
  margin-bottom: var(--spacing-md);
}

a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color var(--transition-fast);
}

a:hover {
  color: var(--secondary-color);
  text-decoration: underline;
}

/* ====== CONTAINER SYSTEM ====== */

.container {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

.container-fluid {
  width: 100%;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

/* ====== GRID SYSTEM ====== */

.grid {
  display: grid;
  gap: var(--spacing-lg);
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.grid-auto {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

/* Flexbox */
.flex {
  display: flex;
  gap: var(--spacing-md);
}

.flex-col {
  flex-direction: column;
}

.flex-wrap {
  flex-wrap: wrap;
}

.flex-center {
  align-items: center;
  justify-content: center;
}

.flex-between {
  align-items: center;
  justify-content: space-between;
}

.flex-start {
  align-items: flex-start;
  justify-content: flex-start;
}

.flex-end {
  align-items: flex-end;
  justify-content: flex-end;
}

.flex-1 {
  flex: 1;
}

/* ====== SPACING UTILITIES ====== */

.m-0 { margin: 0; }
.m-xs { margin: var(--spacing-xs); }
.m-sm { margin: var(--spacing-sm); }
.m-md { margin: var(--spacing-md); }
.m-lg { margin: var(--spacing-lg); }
.m-xl { margin: var(--spacing-xl); }

.mt-0 { margin-top: 0; }
.mt-xs { margin-top: var(--spacing-xs); }
.mt-sm { margin-top: var(--spacing-sm); }
.mt-md { margin-top: var(--spacing-md); }
.mt-lg { margin-top: var(--spacing-lg); }
.mt-xl { margin-top: var(--spacing-xl); }

.mb-0 { margin-bottom: 0; }
.mb-xs { margin-bottom: var(--spacing-xs); }
.mb-sm { margin-bottom: var(--spacing-sm); }
.mb-md { margin-bottom: var(--spacing-md); }
.mb-lg { margin-bottom: var(--spacing-lg); }
.mb-xl { margin-bottom: var(--spacing-xl); }

.p-0 { padding: 0; }
.p-xs { padding: var(--spacing-xs); }
.p-sm { padding: var(--spacing-sm); }
.p-md { padding: var(--spacing-md); }
.p-lg { padding: var(--spacing-lg); }
.p-xl { padding: var(--spacing-xl); }

/* ====== CARD COMPONENT ====== */

.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card.elevated {
  box-shadow: var(--shadow-lg);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
  margin-bottom: var(--spacing-md);
}

.card-body {
  padding: var(--spacing-md) 0;
}

.card-footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-light);
  margin-top: var(--spacing-md);
}

/* ====== BUTTON COMPONENT ====== */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  text-decoration: none;
}

.btn:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Button Variants */
.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: ${colors.primaryDark};
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: ${colors.secondaryDark};
}

.btn-success {
  background-color: var(--success-color);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: ${colors.successDark};
}

.btn-warning {
  background-color: var(--warning-color);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background-color: ${colors.warningDark};
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: ${colors.dangerDark};
}

.btn-outline {
  background-color: transparent;
  border: 2px solid var(--border-color);
  color: var(--text-primary);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--bg-secondary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn-ghost {
  background-color: transparent;
  color: var(--text-primary);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--bg-secondary);
}

/* Button Sizes */
.btn-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.btn-lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-lg);
}

.btn-block {
  width: 100%;
  display: flex;
}

/* ====== INPUT COMPONENT ====== */

input, textarea, select {
  width: 100%;
  padding: var(--spacing-sm);
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color var(--transition-fast);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px ${colors.primaryLight};
}

input:disabled, textarea:disabled, select:disabled {
  background-color: var(--bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.form-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-top: var(--spacing-xs);
}

.form-error {
  font-size: var(--font-size-sm);
  color: var(--danger-color);
  margin-top: var(--spacing-xs);
}

/* ====== STATUS BADGES ====== */

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.badge-primary {
  background-color: ${colors.primaryLight};
  color: var(--primary-color);
}

.badge-success {
  background-color: ${colors.successLight};
  color: var(--success-color);
}

.badge-warning {
  background-color: ${colors.warningLight};
  color: var(--warning-color);
}

.badge-danger {
  background-color: ${colors.dangerLight};
  color: var(--danger-color);
}

.badge-info {
  background-color: ${colors.infoLight};
  color: var(--info-color);
}

/* ====== ALERT COMPONENT ====== */

.alert {
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--border-color);
  margin-bottom: var(--spacing-md);
}

.alert-success {
  background-color: ${colors.successLight};
  border-left-color: var(--success-color);
  color: var(--success-color);
}

.alert-warning {
  background-color: ${colors.warningLight};
  border-left-color: var(--warning-color);
  color: var(--warning-color);
}

.alert-danger {
  background-color: ${colors.dangerLight};
  border-left-color: var(--danger-color);
  color: var(--danger-color);
}

.alert-info {
  background-color: ${colors.infoLight};
  border-left-color: var(--info-color);
  color: var(--info-color);
}

/* ====== TABLE COMPONENT ====== */

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--spacing-lg);
}

thead {
  background-color: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
}

th {
  padding: var(--spacing-md);
  text-align: left;
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

td {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
}

tbody tr:hover {
  background-color: var(--bg-secondary);
}

/* ====== PAGINATION ====== */

.pagination {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
  justify-content: center;
  margin-top: var(--spacing-lg);
}

.pagination-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-item:hover {
  background-color: var(--bg-secondary);
  border-color: var(--primary-color);
}

.pagination-item.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

/* ====== MODAL ====== */

.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal);
  align-items: center;
  justify-content: center;
  animation: fadeIn var(--transition-base);
}

.modal.active {
  display: flex;
}

.modal-content {
  background-color: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp var(--transition-base);
}

.modal-header {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-body {
  padding: var(--spacing-lg);
}

.modal-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--text-secondary);
}

/* ====== DROPDOWN ====== */

.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-dropdown);
  min-width: 200px;
  animation: slideDown var(--transition-fast);
}

.dropdown-menu.active {
  display: block;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--text-primary);
  transition: background-color var(--transition-fast);
  font-family: var(--font-primary);
}

.dropdown-item:hover {
  background-color: var(--bg-tertiary);
}

/* ====== SPINNER ====== */

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ====== ANIMATIONS ====== */

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* ====== RESPONSIVE UTILITIES ====== */

.hidden {
  display: none !important;
}

.visible {
  display: block !important;
}

.text-center {
  text-align: center;
}

.text-left {
  text-align: left;
}

.text-right {
  text-align: right;
}

.rounded {
  border-radius: var(--radius-md);
}

.rounded-sm {
  border-radius: var(--radius-sm);
}

.rounded-lg {
  border-radius: var(--radius-lg);
}

.rounded-full {
  border-radius: var(--radius-full);
}

/* Responsive */
${generateResponsiveUtilities(breakpoints)}
  `;
}

/**
 * Returns theme colors based on light/dark mode
 * @param {string} theme - 'light' or 'dark'
 * @returns {Object} Color palette
 */
function getThemeColors(theme) {
  if (theme === 'dark') {
    return {
      primary: '#3B82F6',
      primaryDark: '#1D4ED8',
      primaryLight: 'rgba(59, 130, 246, 0.1)',
      secondary: '#8B5CF6',
      secondaryDark: '#6D28D9',
      success: '#10B981',
      successDark: '#047857',
      successLight: 'rgba(16, 185, 129, 0.1)',
      warning: '#F59E0B',
      warningDark: '#D97706',
      warningLight: 'rgba(245, 158, 11, 0.1)',
      danger: '#EF4444',
      dangerDark: '#DC2626',
      dangerLight: 'rgba(239, 68, 68, 0.1)',
      info: '#06B6D4',
      infoLight: 'rgba(6, 182, 212, 0.1)',
      textPrimary: '#E5E7EB',
      textSecondary: '#9CA3AF',
      textLight: '#6B7280',
      bgPrimary: '#111827',
      bgSecondary: '#1F2937',
      bgTertiary: '#374151',
      borderColor: '#4B5563',
      borderLight: '#374151'
    };
  }

  // Light theme (default)
  return {
    primary: '#3B82F6',
    primaryDark: '#1D4ED8',
    primaryLight: 'rgba(59, 130, 246, 0.1)',
    secondary: '#8B5CF6',
    secondaryDark: '#6D28D9',
    success: '#10B981',
    successDark: '#047857',
    successLight: 'rgba(16, 185, 129, 0.1)',
    warning: '#F59E0B',
    warningDark: '#D97706',
    warningLight: 'rgba(245, 158, 11, 0.1)',
    danger: '#EF4444',
    dangerDark: '#DC2626',
    dangerLight: 'rgba(239, 68, 68, 0.1)',
    info: '#06B6D4',
    infoLight: 'rgba(6, 182, 212, 0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F9FAFB',
    bgTertiary: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderLight: '#F3F4F6'
  };
}

/**
 * Returns spacing scale
 * @returns {Object} Spacing values
 */
function getSpacingSystem() {
  return {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px'
  };
}

/**
 * Returns typography system
 * @returns {Object} Typography values
 */
function getTypographySystem() {
  return {
    fontPrimary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: '"Monaco", "Courier New", monospace',
    fontSizeSm: '12px',
    fontSizeBase: '14px',
    fontSizeLg: '16px',
    fontSizeXl: '20px',
    fontSize2xl: '28px',
    fontWeightLight: 300,
    fontWeightNormal: 400,
    fontWeightSemibold: 600,
    fontWeightBold: 700
  };
}

/**
 * Returns shadow system
 * @returns {Object} Shadow values
 */
function getShadowSystem() {
  return {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  };
}

/**
 * Returns responsive breakpoints
 * @returns {Object} Breakpoint values
 */
function getBreakpoints() {
  return {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  };
}

/**
 * Generates responsive utility classes
 * @param {Object} breakpoints - Breakpoint values
 * @returns {string} Responsive CSS
 */
function generateResponsiveUtilities(breakpoints) {
  return `
/* Tablet and up (768px+) */
@media (min-width: ${breakpoints.md}) {
  .grid-md-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-md-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-md-4 { grid-template-columns: repeat(4, 1fr); }
  .hidden-md { display: none; }
  .visible-md { display: block; }
}

/* Desktop and up (1024px+) */
@media (min-width: ${breakpoints.lg}) {
  .grid-lg-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-lg-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-lg-4 { grid-template-columns: repeat(4, 1fr); }
  .hidden-lg { display: none; }
  .visible-lg { display: block; }
}

/* Large desktop (1280px+) */
@media (min-width: ${breakpoints.xl}) {
  .grid-xl-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-xl-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-xl-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-xl-6 { grid-template-columns: repeat(6, 1fr); }
}

/* Mobile first (under 640px) */
@media (max-width: ${breakpoints.sm}) {
  .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr;
  }
  .hidden-mobile { display: none; }
  .flex-mobile-col {
    flex-direction: column;
  }
  .modal-content {
    width: 95%;
    max-height: 95vh;
  }
}
  `;
}

/**
 * Generates theme switcher JavaScript
 * @returns {string} JavaScript code for theme switching
 */
function generateThemeSwitcher() {
  return `
<script>
function setTheme(theme) {
  const root = document.documentElement;
  const style = document.createElement('style');

  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('preferred-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('preferred-theme', 'light');
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('preferred-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('preferred-theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', initTheme);
</script>
  `;
}

/**
 * Generates component documentation
 * @returns {string} HTML documentation of all components
 */
function generateComponentDocs() {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>CSS Framework Documentation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .component {
      background: white;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .component h2 {
      margin-top: 0;
      border-bottom: 3px solid #3B82F6;
      padding-bottom: 10px;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .example {
      margin: 15px 0;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #3B82F6;
    }
  </style>
</head>
<body>
  <h1>Enterprise CSS Framework Documentation</h1>

  <div class="component">
    <h2>Buttons</h2>
    <p>Reusable button component with multiple variants and sizes.</p>
    <div class="example">
      <code>.btn</code> - Base button style<br>
      <code>.btn-primary</code> - Primary action<br>
      <code>.btn-secondary</code> - Secondary action<br>
      <code>.btn-success</code>, <code>.btn-warning</code>, <code>.btn-danger</code> - Status buttons<br>
      <code>.btn-outline</code> - Outlined style<br>
      <code>.btn-ghost</code> - Transparent background<br>
      <code>.btn-sm</code>, <code>.btn-lg</code>, <code>.btn-block</code> - Sizing
    </div>
  </div>

  <div class="component">
    <h2>Cards</h2>
    <p>Container component for grouping related content.</p>
    <div class="example">
      <code>.card</code> - Base card<br>
      <code>.card.elevated</code> - Elevated shadow<br>
      <code>.card-header</code> - Header section<br>
      <code>.card-body</code> - Body section<br>
      <code>.card-footer</code> - Footer section
    </div>
  </div>

  <div class="component">
    <h2>Forms</h2>
    <p>Form elements with consistent styling.</p>
    <div class="example">
      <code>.form-group</code> - Form field wrapper<br>
      <code>label</code> - Form labels<br>
      <code>.form-text</code> - Helper text<br>
      <code>.form-error</code> - Error messages
    </div>
  </div>

  <div class="component">
    <h2>Grid & Flexbox</h2>
    <p>Responsive layout utilities.</p>
    <div class="example">
      <code>.grid, .grid-2, .grid-3, .grid-4, .grid-auto</code><br>
      <code>.flex, .flex-col, .flex-wrap, .flex-center, .flex-between</code>
    </div>
  </div>

  <div class="component">
    <h2>Badges & Status</h2>
    <p>Status indicators and badges.</p>
    <div class="example">
      <code>.badge-primary</code>, <code>.badge-success</code>, <code>.badge-warning</code>, <code>.badge-danger</code>, <code>.badge-info</code>
    </div>
  </div>

  <div class="component">
    <h2>Alerts</h2>
    <p>Alert messages for user feedback.</p>
    <div class="example">
      <code>.alert-success</code>, <code>.alert-warning</code>, <code>.alert-danger</code>, <code>.alert-info</code>
    </div>
  </div>

  <div class="component">
    <h2>Modals</h2>
    <p>Dialog overlay component.</p>
    <div class="example">
      <code>.modal</code> - Modal container<br>
      <code>.modal.active</code> - Show modal<br>
      <code>.modal-content</code> - Modal content<br>
      <code>.modal-header, .modal-body, .modal-footer</code> - Modal sections
    </div>
  </div>

  <div class="component">
    <h2>Spacing & Utilities</h2>
    <p>Margin and padding utilities.</p>
    <div class="example">
      <code>.m-xs, .m-sm, .m-md, .m-lg, .m-xl</code> - Margins<br>
      <code>.mt-*, .mb-*</code> - Margin top/bottom<br>
      <code>.p-xs, .p-sm, .p-md, .p-lg, .p-xl</code> - Padding
    </div>
  </div>

  <div class="component">
    <h2>Theme Variables</h2>
    <p>CSS custom properties for theming.</p>
    <div class="example">
      Colors: <code>--primary-color</code>, <code>--success-color</code>, <code>--danger-color</code><br>
      Text: <code>--text-primary</code>, <code>--text-secondary</code><br>
      Background: <code>--bg-primary</code>, <code>--bg-secondary</code>
    </div>
  </div>
</body>
</html>
  `;
}
