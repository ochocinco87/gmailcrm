# Gmail CRM - Multi-Tenant Firebase Integration

## Overview

Gmail CRM v2.0 now supports multi-user collaboration through Firebase/Firestore. This enables teams within a Google Workspace organization to share pipelines, deals, and collaborate in real-time.

## Key Features

### ✅ Multi-Tenant Architecture
- Each organization (workspace domain) has isolated data
- Domain-based access control
- Supports unlimited organizations on a single Firebase project

### ✅ Role-Based Permissions
- **Admin**: Full access + user management + organization settings + billing
- **Editor**: Create and edit deals, pipelines, add notes
- **Viewer**: Read-only access to all deals and pipelines

### ✅ User Tracking
- All changes track who made them and when
- Notes display author name and photo
- Audit trail for all modifications

### ✅ Real-Time Sync
- Changes appear instantly for all users
- Multi-tab support
- Offline persistence with sync when back online

### ✅ Workspace Integration
- Google Workspace OAuth authentication
- Domain restriction (@medivis.com only for now)
- First user becomes admin automatically

### ✅ Billing-Ready Structure
- Seat-based subscription tracking
- Trial vs Active status
- Future Stripe integration prepared

## Architecture

```
Firestore Structure:
organizations/
  medivis.com/
    settings/
      name: "Medivis"
      domain: "medivis.com"
      subscription: { status, seats, plan }
    users/
      user@medivis.com/
        email, name, photoURL, role, lastLoginAt
    deals/
      [deal_id]/
        ...deal data
        createdBy: { email, name, photoURL }
        lastModifiedBy: { email, name, photoURL }
        notesHistory: [{ text, author, createdAt }]
    pipelines/
      [pipeline_id]/
        ...pipeline data
```

## Setup Instructions

### Step 1: Firebase Project Setup

See detailed instructions in `FIREBASE_SETUP.md`

### Step 2: Configure Extension

1. Install extension in Chrome
2. Right-click extension icon → **Options** (or go to settings.html)
3. Go to **Firebase** tab
4. Paste your Firebase configuration JSON
5. Click **Save Firebase Config**

### Step 3: Sign In

1. Go to **General** tab
2. Click **Sign in with Google Workspace**
3. Select your @medivis.com account
4. First user is automatically assigned Admin role

### Step 4: Migrate Existing Data (Optional)

If you have existing local data:
1. Go to **Firebase** tab
2. Click **Migrate Local Data to Firebase**
3. Confirm migration

⚠️ This copies local data to Firebase. Local data is not deleted.

### Step 5: Manage Users (Admin Only)

1. Go to **Users** tab
2. See all users from your organization
3. Change roles as needed
4. Click **Update** to save

## Permission Matrix

| Action | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| View deals & pipelines | ✅ | ✅ | ✅ |
| Create/edit deals | ✅ | ✅ | ❌ |
| Delete deals | ✅ | ✅ | ❌ |
| Add notes | ✅ | ✅ | ❌ |
| Create/edit pipelines | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| Organization settings | ✅ | ❌ | ❌ |
| Billing (future) | ✅ | ❌ | ❌ |

## Security

### Firestore Security Rules

- ✅ Users can only access their own organization's data
- ✅ Domain verification (email domain must match organization)
- ✅ Subscription validation (only active/trial subscriptions)
- ✅ Role-based write permissions
- ✅ Audit trail immutability

### OAuth Security

- ✅ Google Workspace authentication required
- ✅ Domain restriction in OAuth consent screen
- ✅ Token-based authentication
- ✅ Automatic session refresh

## Multi-Organization Deployment

### For Medivis (Current)
- Domain: `medivis.com`
- Subscription: Active (default)
- Users: Managed by admins

### For Other Organizations (Future)
1. Same Firebase project handles all organizations
2. New domain signs in → auto-creates organization
3. First user becomes admin
4. Subscription starts as "trial"
5. Billing integration determines "active" status

### Data Isolation
- Each organization's data is completely isolated
- Firestore rules prevent cross-organization access
- Even Firebase admins need proper domain auth to access data

## Cost Considerations

### Firebase Free Tier
- 50K reads/day
- 20K writes/day
- 1 GB storage

### Estimated Costs (10 users, moderate usage)
- Firestore: ~$5-10/month
- Authentication: Free
- Storage: ~$1/month

Total: **~$10-15/month** for 10 active users

### Scaling
- Costs scale linearly with usage
- Monitor in Firebase Console
- Set budget alerts

## Implementation Files

### Core Files
- `firebase-config.js` - Firebase service wrapper with authentication
- `firestore.rules` - Security rules for data isolation
- `settings.html` - Configuration UI
- `settings.js` - Settings page logic
- `FIREBASE_SETUP.md` - Detailed setup guide

### Integration Points
- `background.js` - Firebase initialization in service worker
- `content.js` - Will be updated to use Firebase for data operations
- `manifest.json` - Permissions and OAuth config

## Current Status

### ✅ Complete
- Multi-tenant data structure
- Security rules with domain isolation
- Role-based permissions (admin/editor/viewer)
- Firebase configuration UI
- User management UI (admin only)
- Organization settings UI
- Setup documentation
- Billing structure prepared

### 🚧 In Progress
- Firebase SDK integration in background.js
- Real-time sync in content.js
- Migration from chrome.storage.local to Firestore
- UI permission checks (hide edit buttons for viewers)

### 📋 Planned
- Stripe billing integration
- Seat management
- Trial expiration handling
- Usage analytics
- Bulk user import
- SSO/SAML support

## Troubleshooting

### "Permission denied" errors
1. Check Firestore rules are deployed
2. Verify user email domain matches organization
3. Check subscription status is active/trial
4. Sign out and sign back in

### "Firebase not configured"
1. Go to Settings → Firebase tab
2. Enter Firebase configuration JSON
3. Click Save
4. Test connection

### Can't see Users/Organization tabs
- These tabs are admin-only
- Sign in as an admin user
- First user is auto-assigned admin role

### Changes not syncing
1. Check internet connection
2. Verify Firebase is configured correctly
3. Check browser console for errors
4. Try refreshing the page

## Support

For issues or questions:
1. Check `FIREBASE_SETUP.md` for setup help
2. Review Firestore rules in Firebase Console
3. Check browser console for errors
4. Verify subscription status in Organization tab

## Next Steps

After Firebase is configured:
1. All users should sign in with Google Workspace
2. Admin assigns appropriate roles
3. Migrate existing data if needed
4. Start collaborating in real-time!

## License

Same as main Gmail CRM project
