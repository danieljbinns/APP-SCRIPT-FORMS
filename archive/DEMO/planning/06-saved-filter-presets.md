# Saved Filter Presets

## Priority: 🟡 MEDIUM (P2)

## Overview
Allow users to save frequently used filter combinations as presets for quick access and improved workflow efficiency.

## Business Reason
- Managers check same filters daily (e.g., "My Team Overdue")
- HR runs weekly reports with specific criteria
- Reduce repetitive filter selection
- Power user feature = higher satisfaction
- Time savings compound over repeated use

## Technical Reason
- Better UX for repeated tasks
- State management practice
- Data persistence patterns
- Reusable across sessions

## Components (Modular)

### 1. Filter Preset Manager
**File:** `shared/filter-presets.js`
**Dependencies:** None (standalone)
**Size:** ~250 lines

```javascript
const FilterPresets = (function() {
  // Save filter configurations
  // Load presets
  // Delete presets
  // localStorage persistence
  // Import/export presets (JSON)
})();
```

### 2. Preset UI Component
**File:** `shared/preset-ui.js`
**Dependencies:** `filter-presets.js`
**Size:** ~200 lines

```javascript
const PresetUI = (function() {
  // Preset dropdown/menu
  // Save dialog
  // Manage presets dialog
  // Quick apply buttons
})();
```

## Features

### 1. Save Current Filters
```javascript
const preset = {
  name: 'My Team Overdue',
  filters: {
    status: 'Overdue',
    search: '',
    type: '',
    dateFrom: '2025-01-01',
    dateTo: '2025-12-31'
  },
  createdAt: '2025-12-04T10:00:00Z',
  lastUsed: '2025-12-04T10:00:00Z',
  useCount: 0
};
```

### 2. Quick Apply
- One-click to apply saved filters
- Visual indicator of active preset
- Recent presets quick access

### 3. Preset Management
- Create new preset
- Edit existing preset
- Delete preset
- Duplicate preset
- Share preset (export/import)

### 4. Default Presets
```javascript
const defaultPresets = [
  {
    name: 'Overdue This Week',
    filters: {
      status: 'Overdue',
      dateFrom: getWeekStart(),
      dateTo: getToday()
    }
  },
  {
    name: 'All Open',
    filters: {
      status: 'Open'
    }
  },
  {
    name: 'Hiring This Month',
    filters: {
      dateFrom: getMonthStart(),
      dateTo: getMonthEnd()
    }
  }
];
```

## UI Design

### Preset Dropdown (Primary)
```html
<div class="preset-selector">
  <label>Quick Filters:</label>
  <select id="preset-dropdown" onchange="applyPreset(this.value)">
    <option value="">-- Select Preset --</option>
    <optgroup label="My Presets">
      <option value="my-team-overdue">My Team Overdue ⭐</option>
      <option value="weekly-review">Weekly Review</option>
    </optgroup>
    <optgroup label="Default Presets">
      <option value="all-overdue">All Overdue</option>
      <option value="all-open">All Open</option>
    </optgroup>
  </select>
  <button class="btn-icon" onclick="managePresets()" title="Manage Presets">⚙️</button>
</div>
```

### Save Preset Dialog
```html
<div class="modal" id="save-preset-modal">
  <div class="modal-content">
    <h2>Save Filter Preset</h2>
    <div class="form-field">
      <label>Preset Name:</label>
      <input type="text" id="preset-name" placeholder="e.g., My Team Overdue">
    </div>
    <div class="preset-summary">
      <h3>Current Filters:</h3>
      <ul id="filter-summary">
        <!-- Populated dynamically -->
      </ul>
    </div>
    <div class="modal-actions">
      <button onclick="closePresetModal()">Cancel</button>
      <button class="btn-primary" onclick="savePreset()">Save Preset</button>
    </div>
  </div>
</div>
```

### Manage Presets Dialog
```html
<div class="modal" id="manage-presets-modal">
  <div class="modal-content">
    <h2>Manage Filter Presets</h2>
    <div class="preset-list">
      <div class="preset-item">
        <div class="preset-info">
          <h4>My Team Overdue</h4>
          <p>Status: Overdue</p>
          <p class="preset-meta">Used 15 times • Last used today</p>
        </div>
        <div class="preset-actions">
          <button onclick="editPreset('my-team-overdue')">✏️ Edit</button>
          <button onclick="applyPreset('my-team-overdue')">▶️ Apply</button>
          <button onclick="deletePreset('my-team-overdue')">🗑️ Delete</button>
        </div>
      </div>
      <!-- More preset items -->
    </div>
    <div class="modal-actions">
      <button onclick="importPresets()">📥 Import</button>
      <button onclick="exportPresets()">📤 Export</button>
      <button onclick="closeManagePresetsModal()">Close</button>
    </div>
  </div>
</div>
```

### Quick Access Buttons (Alternative UI)
```html
<div class="preset-quick-buttons">
  <button class="preset-btn" onclick="applyPreset('all-overdue')">
    🚨 Overdue
  </button>
  <button class="preset-btn" onclick="applyPreset('my-team')">
    👥 My Team
  </button>
  <button class="preset-btn" onclick="applyPreset('this-week')">
    📅 This Week
  </button>
  <button class="preset-btn preset-btn-add" onclick="openSavePresetModal()">
    + Save Current
  </button>
</div>
```

## Implementation Steps

### Phase 1: Core Functionality (4 hours)
1. Create `filter-presets.js` (2.5 hours)
2. Add localStorage persistence (1 hour)
3. Test save/load/delete operations (0.5 hours)

### Phase 2: UI Components (5 hours)
1. Create `preset-ui.js` (2 hours)
2. Build save preset modal (1.5 hours)
3. Build manage presets modal (1.5 hours)

### Phase 3: Integration (3 hours)
1. Add preset dropdown to admin dashboard (1 hour)
2. Integrate with existing filter system (1.5 hours)
3. Add default presets (0.5 hours)

### Phase 4: Advanced Features (3 hours)
1. Add import/export functionality (1.5 hours)
2. Add usage tracking (last used, use count) (1 hour)
3. Add preset sharing (0.5 hours)

**Total Effort:** ~15 hours

## Data Model

### Preset Object Structure
```javascript
{
  id: 'preset-1234',                    // Unique ID
  name: 'My Team Overdue',              // User-defined name
  description: 'Team workflows overdue', // Optional description
  filters: {                             // Filter configuration
    search: 'project manager',
    status: 'Overdue',
    type: 'HR',
    dateFrom: '2025-12-01',
    dateTo: '2025-12-31'
  },
  metadata: {                            // Tracking info
    createdAt: '2025-12-04T10:00:00Z',
    updatedAt: '2025-12-04T10:00:00Z',
    lastUsed: '2025-12-04T14:30:00Z',
    useCount: 15,
    createdBy: 'user@company.com'       // Optional
  },
  isDefault: false,                      // System vs user preset
  isFavorite: true,                      // Star for quick access
  tags: ['team', 'urgent']               // Optional categorization
}
```

### Storage Structure
```javascript
localStorage.setItem('filterPresets', JSON.stringify({
  version: '1.0',
  presets: [
    { id: 'preset-1', ... },
    { id: 'preset-2', ... }
  ],
  settings: {
    autoApplyLast: false,              // Auto-apply last used preset
    showQuickButtons: true,            // Show quick access buttons
    defaultPreset: null                // Preset to load on page load
  }
}));
```

## Filter Preset API

### Core Methods
```javascript
// Create preset
const presetId = FilterPresets.save('My Team Overdue', currentFilters);

// Load preset
const preset = FilterPresets.load('preset-1234');

// Apply preset to filters
FilterPresets.apply('preset-1234', applyFiltersCallback);

// Update preset
FilterPresets.update('preset-1234', { name: 'New Name' });

// Delete preset
FilterPresets.delete('preset-1234');

// Get all presets
const allPresets = FilterPresets.getAll();

// Get favorites
const favorites = FilterPresets.getFavorites();

// Get most used
const mostUsed = FilterPresets.getMostUsed(5);
```

### Import/Export
```javascript
// Export all presets to JSON
const json = FilterPresets.export();

// Import presets from JSON
FilterPresets.import(json);

// Export single preset
const presetJson = FilterPresets.exportOne('preset-1234');

// Share via URL (encode in URL params)
const shareUrl = FilterPresets.getShareUrl('preset-1234');
```

## Integration with Admin Dashboard

### Update Filter Section
```html
<div class="filters-section">
  <!-- ADD: Preset selector at top -->
  <div class="preset-selector-container">
    <div class="preset-selector">
      <label>Quick Filters:</label>
      <select id="preset-dropdown"></select>
      <button onclick="saveCurrentAsPreset()">💾 Save Current</button>
      <button onclick="managePresets()">⚙️ Manage</button>
    </div>
  </div>

  <!-- Existing filter fields -->
  <div class="filters-grid">
    <!-- ... existing filters ... -->
  </div>

  <!-- Existing filter actions -->
  <div class="filter-actions">
    <button onclick="applyFilters()">Apply Filters</button>
    <button onclick="clearFilters()">Clear</button>
  </div>
</div>
```

### Update Filter Apply Logic
```javascript
function applyFilters() {
  // Existing filter logic...

  // Track if a preset is active
  const activePreset = FilterPresets.findMatchingPreset(currentFilters);
  if (activePreset) {
    document.getElementById('preset-dropdown').value = activePreset.id;
    FilterPresets.trackUsage(activePreset.id);
  } else {
    document.getElementById('preset-dropdown').value = '';
  }
}
```

## CSS Requirements
**File:** `shared/presets.css`
```css
.preset-selector {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: var(--input-bg);
  border-radius: 6px;
}

.preset-quick-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.preset-btn {
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: var(--brand-red);
  color: white;
  border-color: var(--brand-red);
}

.preset-btn.active {
  background: var(--brand-red);
  color: white;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 10px;
}

.preset-meta {
  font-size: 0.85rem;
  color: var(--text-muted);
}
```

## Testing Requirements
- Presets save correctly to localStorage
- Presets load and apply filters correctly
- Edit preset updates correctly
- Delete preset removes from list
- Import/export works with valid JSON
- Usage tracking increments
- Favorite presets show first
- Default presets can't be deleted

## Success Metrics
- Users create and use presets
- Reduced time to apply common filters (50%+ reduction)
- Increased user satisfaction
- Power users create 5+ presets
- Presets are shared between team members

## Files to Create
- `shared/filter-presets.js`
- `shared/preset-ui.js`
- `shared/presets.css`

## Files to Modify
- `admin-dashboard.html` (add preset UI)
- Add preset save/load logic to filter functions

## Dependencies
None - fully standalone

## Risk Assessment
**Low Risk** - Feature is additive, no impact on existing functionality

## Accessibility
- Keyboard navigation in preset dropdown
- ARIA labels for screen readers
- Focus management in modals

## Mobile Considerations
- Preset dropdown works on mobile
- Touch-friendly buttons
- Preset management modal responsive

## Future Enhancements
- Team presets (shared across organization)
- Preset permissions (admin-only presets)
- Preset versioning (rollback changes)
- Scheduled preset application
- Preset templates marketplace
