# Firebase Deployment Guide for Gmail CRM

## 🚀 Quick Setup (30 minutes)

This guide will walk you through deploying Gmail CRM with Firebase multi-user support.

---

## Prerequisites

- Google account (preferably @medivis.com)
- Node.js installed (for Firebase CLI)
- Chrome browser (for testing)

---

## Part 1: Firebase Project Setup (Manual - 10 minutes)

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `gmail-crm-medivis` (or your choice)
4. **Disable** Google Analytics (not needed for CRM)
5. Click **"Create project"**
6. Wait for project creation (~30 seconds)

### Step 2: Enable Google Authentication

1. In Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Click **"Sign-in method"** tab
4. Click **"Google"** provider
5. Toggle **"Enable"**
6. Enter project support email (your email)
7. Click **"Save"**

### Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database** (left sidebar)
2. Click **"Create database"**
3. **IMPORTANT**: Select **"Start in production mode"** (we have custom rules)
4. Choose location: `us-central1` (or closest to your team)
5. Click **"Enable"**
6. Wait for database creation (~1 minute)

### Step 4: Get Firebase Configuration

1. In Firebase Console, click **gear icon** → **"Project settings"**
2. Scroll to **"Your apps"** section
3. Click **Web icon** `</>` to add a web app
4. App nickname: `Gmail CRM Extension`
5. **Do NOT** check "Firebase Hosting"
6. Click **"Register app"**
7. **Copy the config object** (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "gmail-crm-medivis.firebaseapp.com",
  projectId: "gmail-crm-medivis",
  storageBucket: "gmail-crm-medivis.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

8. **Save this config** - you'll need it later!

---

## Part 2: Install Firebase CLI (5 minutes)

### Install Firebase Tools

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase (opens browser)
firebase login

# Verify installation
firebase --version
```

### Initialize Firebase in Project

```bash
# Navigate to project directory
cd /home/user/gmailcrm

# Initialize Firebase (interactive)
firebase init

# Select options:
#   [x] Firestore (use arrow keys + space to select)
#   [ ] Everything else (unselected)

# Use existing project:
#   Select: gmail-crm-medivis (the one you created)

# Firestore rules file:
#   Press Enter (uses firestore.rules - already exists)

# Firestore indexes file:
#   Press Enter (uses firestore.indexes.json - already exists)

# That's it! Firebase is configured.
```

---

## Part 3: Deploy Firestore Rules (Automated - 1 minute)

### Deploy Security Rules

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# You should see:
# ✓ Deploy complete!
# Firestore rules deployed successfully
```

### Verify Rules Deployed

1. Go to Firebase Console → **Firestore Database**
2. Click **"Rules"** tab
3. You should see your custom rules (organizations, users, deals, etc.)

---

## Part 4: Google Cloud OAuth Setup (10 minutes)

### Step 1: Get Chrome Extension ID

```bash
# Load extension in Chrome first
# 1. Open Chrome
# 2. Go to chrome://extensions/
# 3. Enable "Developer mode"
# 4. Click "Load unpacked"
# 5. Select: /home/user/gmailcrm

# 6. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyz)
```

### Step 2: Create OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **IMPORTANT**: Select your Firebase project (gmail-crm-medivis)
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. If prompted, configure OAuth consent screen:
   - User Type: **Internal** (for Workspace) or **External**
   - App name: `Gmail CRM`
   - User support email: your email
   - Developer contact: your email
   - Click **Save and Continue** through all steps

6. Back to Create OAuth Client ID:
   - Application type: **Chrome Extension**
   - Name: `Gmail CRM Extension`
   - Item ID: `<paste your extension ID from chrome://extensions>`
   - Click **"Create"**

7. **Copy the Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)

### Step 3: Update manifest.json

1. Open `/home/user/gmailcrm/manifest.json`
2. Find the line:
   ```json
   "client_id": "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com"
   ```
3. Replace with your actual Client ID:
   ```json
   "client_id": "123456789-abc.apps.googleusercontent.com"
   ```
4. Save the file

### Step 4: Restrict to Workspace Domain (Optional but Recommended)

1. In Google Cloud Console → **APIs & Services** → **OAuth consent screen**
2. Under **"Authorized domains"**, add: `medivis.com`
3. Click **Save**

This ensures only @medivis.com users can sign in.

---

## Part 5: Extension Configuration (5 minutes)

### Step 1: Reload Extension

```bash
# In Chrome:
# 1. Go to chrome://extensions/
# 2. Find "Gmail CRM"
# 3. Click the refresh icon 🔄
```

### Step 2: Configure Firebase in Extension

```bash
# 1. Click the extension icon (top-right in Chrome)
# 2. Click "Settings" (or right-click icon → Options)
# 3. Go to "Firebase" tab
# 4. Paste your Firebase config (from Part 1, Step 4)
# 5. Click "Save Firebase Config"
# 6. You should see "✓ Connected"
```

### Step 3: Test Firebase Connection

```bash
# In extension Settings → Firebase tab:
# 1. Click "Test Connection"
# 2. Should show: "Firebase connection successful!"
```

---

## Part 6: First Sign-In & Testing (5 minutes)

### Step 1: Sign In as First User (Admin)

```bash
# 1. In extension Settings → General tab
# 2. Click "Sign in with Google Workspace"
# 3. Select your @medivis.com account
# 4. Accept permissions
# 5. You should see: "Successfully signed in!"
# 6. Role badge should show: "ADMIN"
```

### Step 2: Verify in Firebase

```bash
# 1. Go to Firebase Console → Firestore Database
# 2. Click "Data" tab
# 3. You should see:
#    organizations/
#      medivis.com/
#        (organization document)
#        users/
#          your@medivis.com (with role: "admin")
```

### Step 3: Migrate Existing Data (Optional)

If you have existing local deals:

```bash
# 1. In extension Settings → Firebase tab
# 2. Click "Migrate Local Data to Firebase"
# 3. Confirm migration
# 4. Wait for: "Migration complete! Migrated X items"
```

### Step 4: Test Multi-User (Optional)

```bash
# Open Chrome in Incognito or another profile:
# 1. Load the extension
# 2. Configure Firebase (same config)
# 3. Sign in with different @medivis.com account
# 4. Should get role: "VIEWER"

# As admin (first user):
# 5. Go to Settings → Users tab
# 6. Change second user's role to "EDITOR"
# 7. Second user refreshes and can now edit!
```

---

## Part 7: Verification Checklist

### ✅ Firebase Setup
- [ ] Project created
- [ ] Google Auth enabled
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Firebase config copied

### ✅ OAuth Setup
- [ ] Extension ID obtained
- [ ] OAuth client ID created
- [ ] manifest.json updated with client ID
- [ ] Domain restriction added (optional)

### ✅ Extension Setup
- [ ] Extension loaded in Chrome
- [ ] Firebase config pasted in settings
- [ ] Connection tested successfully
- [ ] Signed in as first user
- [ ] Admin role confirmed

### ✅ Firestore Data
- [ ] Organization document exists
- [ ] User document created with admin role
- [ ] Data structure looks correct

---

## 🎉 Success!

You now have:
- ✅ Multi-user Gmail CRM
- ✅ Real-time collaboration (5s sync)
- ✅ Role-based permissions
- ✅ Secure data isolation
- ✅ Production-ready deployment

---

## Next Steps

### Add More Users
1. Share extension with team (share the folder)
2. Each user loads extension
3. Each user configures same Firebase config
4. Each user signs in with @medivis.com
5. Admin assigns roles in Settings → Users

### Monitor Usage
- Firebase Console → Firestore Database → Usage tab
- Check reads/writes per day
- Free tier: 50K reads/day, 20K writes/day

### Costs
- Expected: $1-3/month for 10 users
- Monitor in Firebase Console → Usage

---

## Troubleshooting

### "Permission denied" error
**Problem:** User can't access data
**Solution:**
1. Check Firestore rules are deployed
2. Verify user email domain matches organization
3. Sign out and sign back in

### "Firebase not configured" error
**Problem:** Extension can't connect to Firebase
**Solution:**
1. Go to Settings → Firebase tab
2. Re-paste Firebase config
3. Click Save
4. Test connection

### "OAuth client ID" error
**Problem:** Extension can't sign in
**Solution:**
1. Verify OAuth client ID in manifest.json
2. Check extension ID matches OAuth config
3. Reload extension after changing manifest.json

### "Not authorized" domain error
**Problem:** Non-medivis.com user trying to sign in
**Solution:**
1. This is expected - only medivis.com allowed
2. To add other domains, update background.js line 207-209

### Changes not syncing
**Problem:** User A makes change, User B doesn't see it
**Solution:**
1. Wait 5 seconds (polling interval)
2. Refresh the Gmail page
3. Check internet connection
4. Check browser console for errors

---

## Advanced Configuration

### Change Allowed Domains

Edit `background.js` line 207-209:

```javascript
// OLD:
if (domain !== 'medivis.com') {
  throw new Error(`Domain ${domain} is not authorized.`);
}

// NEW (allow multiple domains):
const allowedDomains = ['medivis.com', 'acme.com', 'hospital.org'];
if (!allowedDomains.includes(domain)) {
  throw new Error(`Domain ${domain} is not authorized.`);
}
```

### Adjust Sync Interval

Edit `background.js` line 738:

```javascript
// OLD: 5 seconds
}, 5000);

// NEW: 10 seconds (reduces API calls)
}, 10000);
```

### Add More Admins

```javascript
// Option 1: Via Settings UI (recommended)
// - Sign in as admin
// - Go to Settings → Users
// - Change user role to "admin"

// Option 2: Via Firestore Console
// - Go to Firestore Database
// - Find: organizations/medivis.com/users/user@medivis.com
// - Edit field: role → "admin"
```

---

## Support & Resources

**Documentation:**
- `FIREBASE_SETUP.md` - Detailed setup guide
- `README_FIREBASE.md` - Architecture overview
- `INTEGRATION_STATUS.md` - Development status

**Firebase Console:**
- Project: https://console.firebase.google.com/
- Firestore: Check data and usage
- Authentication: View signed-in users

**Google Cloud Console:**
- OAuth: https://console.cloud.google.com/apis/credentials
- Manage client IDs and domains

**Costs:**
- Firebase Pricing: https://firebase.google.com/pricing
- Firestore Pricing: https://cloud.google.com/firestore/pricing

---

## Quick Reference

### Firebase Config Location
Extension Settings → Firebase tab

### OAuth Client ID Location
`manifest.json` line 12

### Firestore Rules
`firestore.rules` (deploy with: `firebase deploy --only firestore`)

### User Roles
- **Admin**: Full access + user management
- **Editor**: Can edit deals/pipelines
- **Viewer**: Read-only

### Data Sync
- **Interval**: 5 seconds
- **Method**: Polling (background.js)
- **Offline**: Uses local cache

---

**Deployment Time:** ~30 minutes
**Status:** Production Ready
**Last Updated:** 2026-01-02
