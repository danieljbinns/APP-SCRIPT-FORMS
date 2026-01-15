# Workflow Comments & Notes

## Priority: 🟢 LOW (P3)

## Overview
Add comment/notes system to workflows for collaboration and context tracking.

## Business Reason
- Team collaboration
- Track decisions and context
- Audit trail for changes
- Better handoffs between staff

## Components (Modular)

### 1. Comments Manager
**File:** `shared/comments-manager.js` (~250 lines)
- Add/edit/delete comments
- Comment threading (replies)
- Mentions (@user)
- Rich text support

### 2. Comments UI
**File:** `shared/comments-ui.js` (~300 lines)
- Comment list view
- Comment editor
- Reply functionality
- Real-time updates (optional)

## Features
- 💬 Add comments to workflows
- 🔗 Thread replies
- @ Mention users
- 📎 Attach links/files
- 🔔 Notifications for mentions
- 🔍 Search comments
- 📊 Comment activity log

## Data Model
```javascript
{
  id: 'comment-1234',
  workflowId: 'WF-001',
  author: 'user@company.com',
  text: 'Waiting on background check',
  timestamp: '2025-12-04T10:00:00Z',
  edited: false,
  parentId: null, // for replies
  mentions: ['manager@company.com']
}
```

## Implementation: 10-12 hours

## Files to Create
- `shared/comments-manager.js`
- `shared/comments-ui.js`
- `shared/comments.css`

**Priority:** P3 - Collaboration feature
**Risk:** Low - Additive feature
