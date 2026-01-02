#!/bin/bash

# Gmail CRM - Firebase Setup Script
# Automates Firebase CLI installation and deployment

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Gmail CRM - Firebase Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
    echo "✓ Firebase CLI installed"
else
    echo "✓ Firebase CLI found: $(firebase --version)"
fi
echo ""

# Login to Firebase
echo "🔐 Logging into Firebase..."
echo "   (This will open your browser)"
firebase login

if [ $? -ne 0 ]; then
    echo "❌ Firebase login failed"
    exit 1
fi

echo "✓ Firebase login successful"
echo ""

# List projects
echo "📋 Available Firebase projects:"
firebase projects:list
echo ""

# Prompt for project selection
read -p "Enter your Firebase project ID (or press Enter to create new): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo ""
    echo "📝 Creating new Firebase project..."
    echo "   Please create your project manually at:"
    echo "   https://console.firebase.google.com/"
    echo ""
    echo "   Then run this script again with the project ID"
    exit 0
fi

# Use the project
echo "🎯 Using project: $PROJECT_ID"
firebase use "$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo "❌ Failed to use project: $PROJECT_ID"
    echo "   Please check the project ID and try again"
    exit 1
fi

echo "✓ Project selected"
echo ""

# Create .firebaserc
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

echo "✓ Created .firebaserc"
echo ""

# Deploy Firestore rules
echo "🚀 Deploying Firestore rules..."
firebase deploy --only firestore:rules

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore rules"
    exit 1
fi

echo "✓ Firestore rules deployed"
echo ""

# Deploy Firestore indexes
echo "🚀 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

if [ $? -ne 0 ]; then
    echo "⚠️  Firestore indexes deployment failed (this is OK if database doesn't exist yet)"
else
    echo "✓ Firestore indexes deployed"
fi
echo ""

# Get Firebase config
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Get your Firebase config:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
echo "   → Scroll to 'Your apps'"
echo "   → Add a Web app (</> icon)"
echo "   → Copy the config object"
echo ""
echo "2. Set up OAuth:"
echo "   https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "   → Create OAuth Client ID"
echo "   → Type: Chrome Extension"
echo "   → Add your extension ID from chrome://extensions/"
echo ""
echo "3. Update manifest.json:"
echo "   → Replace 'YOUR_GOOGLE_OAUTH_CLIENT_ID' with your OAuth Client ID"
echo ""
echo "4. Configure extension:"
echo "   → Load extension in Chrome"
echo "   → Go to Settings → Firebase tab"
echo "   → Paste Firebase config"
echo "   → Sign in with Google Workspace"
echo ""
echo "📖 Full instructions: DEPLOY.md"
echo ""
echo "✅ Firebase CLI setup complete!"
echo ""
