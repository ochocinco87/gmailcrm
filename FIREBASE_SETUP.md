# Firebase Setup Guide for Gmail CRM

This guide will help you set up Firebase for multi-user, multi-tenant Gmail CRM deployment.

## Prerequisites

- Google Cloud account with billing enabled
- Google Workspace domain (e.g., medivis.com)
- Admin access to Google Cloud Console

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "Gmail CRM - Medivis")
4. Disable Google Analytics (optional)
5. Click "Create Project"

## Step 2: Enable Google Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click **Google** provider
3. Enable it and click **Save**

## Step 3: Configure Firestore Database

1. Go to **Firestore Database** in Firebase Console
2. Click **Create Database**
3. Start in **Production mode**
4. Choose location closest to your users (e.g., `us-central1`)
5. Click **Enable**

## Step 4: Deploy Security Rules

1. In Firestore Database, go to **Rules** tab
2. Copy contents from `firestore.rules` file in this project
3. Paste into the rules editor
4. Click **Publish**

## Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to "Your apps" section
3. Click **Web** icon (</>) to add a web app
4. Register app name (e.g., "Gmail CRM Extension")
5. Copy the Firebase configuration object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

6. Save this configuration - you'll enter it in the extension settings

## Step 6: Configure Google OAuth for Chrome Extension

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth Client ID**
5. Choose **Chrome Extension** as application type
6. Enter your extension ID (get from chrome://extensions/)
7. Copy the **Client ID**
8. Update `manifest.json` with this Client ID

## Step 7: Restrict to Your Workspace Domain

1. In Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Under "Authorized domains", add your domain (e.g., `medivis.com`)
3. Under "Scopes", ensure these are added:
   - `userinfo.email`
   - `userinfo.profile`

## Step 8: Configure Firebase in Extension

1. Install the extension in Chrome
2. Click the extension icon → **Settings**
3. Enter the Firebase configuration (from Step 5)
4. Click **Save**
5. Sign in with your Google Workspace account

## Step 9: Set Up First Admin User

When the first user from your domain signs in:
- They are automatically assigned **admin** role
- Organization document is created for your domain
- Subscription is set to **active** for medivis.com

Subsequent users are assigned **viewer** role by default.

## Step 10: Manage Users (Admin Only)

As an admin:
1. Go to extension Settings → **Users**
2. You'll see all users from your organization
3. Change roles to:
   - **Admin**: Full access + user management + billing
   - **Editor**: Can create/edit deals and pipelines
   - **Viewer**: Read-only access

## Multi-Tenant Deployment (For Other Organizations)

To deploy this for other organizations:

1. Each organization uses the **same Firebase project**
2. Domain isolation is enforced by Firestore security rules
3. Each domain gets its own organization document in Firestore
4. Users are automatically assigned to their organization based on email domain
5. Data is completely isolated between organizations

### Future Billing Integration

Structure is ready for seat-based billing:

```javascript
organizations/
  company.com/
    subscription: {
      status: 'active|trial|suspended|cancelled',
      plan: 'pro|enterprise',
      seats: 10,
      seatsUsed: 7,
      billingEmail: 'admin@company.com',
      stripeCustomerId: 'cus_...',
      currentPeriodEnd: timestamp
    }
```

### Security Rules Ensure:

- ✅ Users can only access their own organization's data
- ✅ Domain isolation (medivis.com users can't see acme.com data)
- ✅ Role-based permissions (admin/editor/viewer)
- ✅ Subscription validation (only active subscriptions have access)
- ✅ Audit trail (all changes track who made them)

## Troubleshooting

### "Permission denied" errors
- Check Firestore rules are deployed correctly
- Verify user email domain matches organization
- Check subscription status is 'active' or 'trial'

### "Authentication failed"
- Verify OAuth client ID in manifest.json
- Check domain is authorized in OAuth consent screen
- Ensure user is from authorized domain

### "No Firebase config"
- Go to Settings and enter Firebase configuration
- Verify all fields are correct
- Check browser console for errors

## Cost Estimate

Firebase free tier includes:
- 50K reads/day
- 20K writes/day
- 1 GB storage

For 10 users with moderate usage:
- Estimated: ~$5-25/month
- Scales with usage

## Support

For issues:
1. Check browser console for errors
2. Verify Firebase configuration
3. Check Firestore rules are deployed
4. Ensure subscription is active
