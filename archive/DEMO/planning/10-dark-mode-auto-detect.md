# Dark Mode Auto-Detection

## Priority: 🟢 LOW (P3)

## Overview
Automatically detect system dark mode preference and apply matching theme.

## Business Reason
- Better default experience
- Respects user preferences
- Modern UX expectation
- Accessibility improvement

## Components (Modular)

### 1. Theme Auto-Detector
**File:** Update `shared/theme-toggle.js` (~50 lines added)
- Detect `prefers-color-scheme`
- Listen for system changes
- Only auto-apply if no saved preference
- Smooth transitions

## Implementation

### Add to theme-toggle.js
```javascript
function initTheme() {
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Auto-detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}
```

## Implementation: 1-2 hours

## Files to Modify
- `shared/theme-toggle.js` (add auto-detection)

**Priority:** P3 - Nice UX improvement
**Risk:** Very Low - Simple enhancement
**Browser Support:** Modern browsers (95%+)
