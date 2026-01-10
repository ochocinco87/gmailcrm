// Gmail CRM Background Service Worker
// Handles Firebase authentication and data operations via REST API

// Firebase state
let firebaseConfig = null;
let currentUser = null;
let authToken = null;

// Load Firebase config on startup
chrome.storage.local.get(['firebaseConfig', 'currentUser'], (result) => {
  if (result.firebaseConfig) {
    firebaseConfig = result.firebaseConfig;
    console.log('Firebase config loaded');
  }
  if (result.currentUser) {
    currentUser = result.currentUser;
    console.log('Current user loaded:', currentUser.email);
  }
});

// Initialize default data on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    console.log('Gmail CRM ' + details.reason + '!');

    // Auto-configure Firebase for Medivis
    const defaultFirebaseConfig = {
      apiKey: "AIzaSyCJAv63NY1FY0JpvB7tLv4KqSCC1yavyVI",
      authDomain: "crm-medivis.firebaseapp.com",
      projectId: "crm-medivis",
      storageBucket: "crm-medivis.firebasestorage.app",
      messagingSenderId: "676657044030",
      appId: "1:676657044030:web:14dcb574c1d40a6be98f6f"
    };

    // Set up default pipelines
    const defaultPipelines = [
      {
        id: 'sales',
        name: 'Sales Pipeline',
        stages: [
          { id: 'lead', name: 'Lead' },
          { id: 'contacted', name: 'Contacted' },
          { id: 'qualified', name: 'Qualified' },
          { id: 'proposal', name: 'Proposal' },
          { id: 'negotiation', name: 'Negotiation' },
          { id: 'closed-won', name: 'Closed Won' },
          { id: 'closed-lost', name: 'Closed Lost' }
        ]
      },
      {
        id: 'support',
        name: 'Support Pipeline',
        stages: [
          { id: 'new', name: 'New' },
          { id: 'in-progress', name: 'In Progress' },
          { id: 'waiting', name: 'Waiting on Customer' },
          { id: 'resolved', name: 'Resolved' }
        ]
      },
      {
        id: 'hiring',
        name: 'Hiring Pipeline',
        stages: [
          { id: 'applied', name: 'Applied' },
          { id: 'phone-screen', name: 'Phone Screen' },
          { id: 'interview', name: 'Interview' },
          { id: 'offer', name: 'Offer' },
          { id: 'hired', name: 'Hired' },
          { id: 'rejected', name: 'Rejected' }
        ]
      }
    ];

    chrome.storage.local.set({
      firebaseConfig: defaultFirebaseConfig,
      pipelines: defaultPipelines,
      deals: {},
      settings: {
        autoTrackEmails: true,
        showSidebar: true
      }
    }, () => {
      console.log('✓ Firebase config and default data initialized');
      firebaseConfig = defaultFirebaseConfig;
    });
  }

  if (details.reason === 'update') {
    console.log('Gmail CRM updated!');
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping/pong to wake up and test service worker
  if (request.action === 'ping') {
    console.log('Ping received, sending pong');
    sendResponse({ success: true, message: 'pong' });
    return true;
  }

  if (request.action === 'getDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deal = result.deals?.[request.threadId];
      sendResponse({ deal });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'saveDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      deals[request.deal.threadId] = request.deal;

      chrome.storage.local.set({ deals }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'deleteDeal') {
    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      delete deals[request.threadId];

      chrome.storage.local.set({ deals }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'getPipelines') {
    chrome.storage.local.get(['pipelines'], (result) => {
      sendResponse({ pipelines: result.pipelines || [] });
    });
    return true;
  }

  if (request.action === 'getSettings') {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse({ settings: result.settings || {} });
    });
    return true;
  }

  // Firebase Authentication
  if (request.action === 'signInWithGoogle') {
    console.log('📨 Received signInWithGoogle message from content script');
    handleSignIn().then(result => {
      console.log('📤 Sending response back to content script:', result.success ? 'SUCCESS' : 'FAILED');
      sendResponse(result);
    }).catch(error => {
      console.error('❌ Caught error in message handler:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'userSignedIn') {
    // Handle sign-in from settings page
    currentUser = request.user;
    console.log('User signed in from settings:', currentUser.email);

    // Get auth token for Firebase API calls
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        authToken = token;
        console.log('Auth token retrieved for Firebase API');
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'signOut') {
    // Clear OAuth token from cache
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token: token }, () => {
          console.log('Auth token removed from cache');
        });
      }
    });

    currentUser = null;
    authToken = null;
    chrome.storage.local.remove('currentUser');
    sendResponse({ success: true });
    return true;
  }

  // Firebase operations
  if (request.action === 'testFirebaseConnection') {
    testFirebaseConnection().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'migrateDataToFirebase') {
    migrateDataToFirebase().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getOrgUsers') {
    getOrgUsers().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'updateUserRole') {
    updateUserRole(request.email, request.role).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getOrganization') {
    getOrganization().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'updateOrganization') {
    updateOrganization(request.data).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Firebase Deals CRUD
  if (request.action === 'getFirebaseDeals') {
    getFirebaseDeals().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'saveFirebaseDeal') {
    saveFirebaseDeal(request.deal).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'deleteFirebaseDeal') {
    deleteFirebaseDeal(request.dealId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Firebase Pipelines CRUD
  if (request.action === 'getFirebasePipelines') {
    getFirebasePipelines().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'saveFirebasePipeline') {
    saveFirebasePipeline(request.pipeline).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Real-time subscriptions
  if (request.action === 'subscribeToFirebaseDeals') {
    subscribeToFirebaseDeals(sender.tab.id);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'subscribeToFirebasePipelines') {
    subscribeToFirebasePipelines(sender.tab.id);
    sendResponse({ success: true });
    return true;
  }

  // HubSpot Integration
  if (request.action === 'hubspotAuth') {
    handleHubSpotAuth().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getHubSpotPipelines') {
    getHubSpotPipelines(request.accessToken).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'getHubSpotDeals') {
    getHubSpotDeals(request.accessToken, request.pipelineId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'importHubSpotData') {
    importHubSpotData(request.accessToken, request.options).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'setupScheduledImport') {
    setupScheduledImport(request.schedule).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'syncDealToHubSpot') {
    syncDealToHubSpot(request.accessToken, request.deal).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'enableTwoWaySync') {
    enableTwoWaySync(request.enable).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// Listen for storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('Storage changed:', changes);

    // Notify all Gmail tabs about the change
    chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'storageChanged',
          changes
        }).catch(() => {
          // Tab might not have content script loaded yet
        });
      });
    });
  }
});

// Badge updates based on deals count
async function updateBadge() {
  chrome.storage.local.get(['deals'], (result) => {
    const dealsCount = Object.keys(result.deals || {}).length;

    if (dealsCount > 0) {
      chrome.action.setBadgeText({ text: dealsCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  });
}

// Update badge on storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.deals) {
    updateBadge();
  }
});

// Update badge on startup
updateBadge();

// Context menu for quick actions (right-click in Gmail)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToPipeline',
    title: 'Add to CRM Pipeline',
    contexts: ['page'],
    documentUrlPatterns: ['https://mail.google.com/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToPipeline') {
    // Send message to content script to add current email to pipeline
    chrome.tabs.sendMessage(tab.id, {
      action: 'quickAddToPipeline'
    });
  }
});

// Firebase Helper Functions

async function handleSignIn() {
  try {
    console.log('🔐 Starting Google sign-in process...');

    // Use chrome.identity to get OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('❌ OAuth token error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('✓ OAuth token retrieved');
          resolve(token);
        }
      });
    });

    authToken = token;
    console.log('✓ Token stored');

    // Get user info from Google API
    console.log('📡 Fetching user info from Google API...');
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch user info:', response.status, response.statusText);
      throw new Error('Failed to get user info');
    }

    const userInfo = await response.json();
    console.log('✓ User info retrieved:', userInfo.email);

    // Extract domain
    const domain = userInfo.email.split('@')[1];
    console.log('✓ Domain extracted:', domain);

    // Note: Removed domain restriction - all Google Workspace domains are now allowed

    // Try to create or update user in Firestore (if Firebase is configured)
    let role = 'admin'; // Default role
    try {
      if (firebaseConfig) {
        console.log('🔥 Updating user in Firestore...');
        await createOrUpdateUser(userInfo, domain);
        // Load user role from Firestore
        role = await getUserRole(userInfo.email, domain);
        console.log('✓ User role from Firestore:', role);
      } else {
        console.log('⚠️ Firebase not configured, using local-only mode');
      }
    } catch (error) {
      console.warn('⚠️ Firestore operation skipped:', error.message);
      // Continue with local-only mode
    }

    currentUser = {
      email: userInfo.email,
      name: userInfo.name,
      photoURL: userInfo.picture,
      domain: domain,
      role: role
    };

    console.log('💾 Saving user to storage...');
    await chrome.storage.local.set({ currentUser });

    console.log('✅ Sign-in completed successfully!');
    return {
      success: true,
      user: currentUser
    };
  } catch (error) {
    console.error('❌ Sign-in error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function createOrUpdateUser(userInfo, domain) {
  if (!firebaseConfig) {
    throw new Error('Firebase not configured');
  }

  const userDoc = await getFirestoreDocument(`organizations/${domain}/users/${userInfo.email}`);

  const userData = {
    email: userInfo.email,
    name: userInfo.name,
    photoURL: userInfo.picture,
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!userDoc) {
    // New user - assign default role
    // Check if this is the first user (admin) or subsequent user (viewer)
    const usersSnapshot = await getFirestoreCollection(`organizations/${domain}/users`);
    const users = usersSnapshot ? Object.keys(usersSnapshot).length : 0;

    userData.role = users === 0 ? 'admin' : 'viewer';
    userData.createdAt = new Date().toISOString();

    console.log('Creating new user with role:', userData.role);
  } else {
    // Existing user - preserve role
    userData.role = userDoc.role;
  }

  await setFirestoreDocument(`organizations/${domain}/users/${userInfo.email}`, userData);

  // Ensure organization document exists
  const orgDoc = await getFirestoreDocument(`organizations/${domain}`);
  if (!orgDoc) {
    await setFirestoreDocument(`organizations/${domain}`, {
      domain: domain,
      name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
      createdAt: new Date().toISOString(),
      subscription: {
        status: domain === 'medivis.com' ? 'active' : 'trial',
        plan: 'pro',
        seats: 10,
        seatsUsed: 0
      }
    });
  }
}

async function getUserRole(email, domain) {
  const userDoc = await getFirestoreDocument(`organizations/${domain}/users/${email}`);
  return userDoc?.role || 'viewer';
}

async function testFirebaseConnection() {
  try {
    if (!firebaseConfig) {
      throw new Error('Firebase not configured');
    }

    if (!currentUser) {
      throw new Error('Not signed in');
    }

    // Try to read organization document
    const orgDoc = await getFirestoreDocument(`organizations/${currentUser.domain}`);

    if (orgDoc) {
      return { success: true };
    } else {
      throw new Error('Organization not found');
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function migrateDataToFirebase() {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can migrate data');
    }

    // Get local data
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['deals', 'pipelines'], resolve);
    });

    const deals = result.deals || {};
    const pipelines = result.pipelines || [];

    let count = 0;

    // Migrate deals
    for (const dealId in deals) {
      const deal = deals[dealId];
      const migratedDeal = {
        ...deal,
        createdBy: {
          email: currentUser.email,
          name: currentUser.name,
          photoURL: currentUser.photoURL
        },
        lastModifiedBy: {
          email: currentUser.email,
          name: currentUser.name,
          photoURL: currentUser.photoURL
        },
        migratedAt: new Date().toISOString()
      };

      await setFirestoreDocument(
        `organizations/${currentUser.domain}/deals/${dealId}`,
        migratedDeal
      );
      count++;
    }

    // Migrate pipelines
    for (const pipeline of pipelines) {
      await setFirestoreDocument(
        `organizations/${currentUser.domain}/pipelines/${pipeline.id}`,
        pipeline
      );
      count++;
    }

    return { success: true, count };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getOrgUsers() {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can view users');
    }

    const usersSnapshot = await getFirestoreCollection(`organizations/${currentUser.domain}/users`);

    const users = [];
    for (const email in usersSnapshot) {
      users.push({
        email,
        ...usersSnapshot[email]
      });
    }

    return { success: true, users };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateUserRole(email, role) {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can update user roles');
    }

    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    const userDoc = await getFirestoreDocument(`organizations/${currentUser.domain}/users/${email}`);
    if (!userDoc) {
      throw new Error('User not found');
    }

    userDoc.role = role;
    userDoc.updatedAt = new Date().toISOString();

    await setFirestoreDocument(`organizations/${currentUser.domain}/users/${email}`, userDoc);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getOrganization() {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can view organization');
    }

    const org = await getFirestoreDocument(`organizations/${currentUser.domain}`);

    return { success: true, org };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateOrganization(data) {
  try {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only admins can update organization');
    }

    const org = await getFirestoreDocument(`organizations/${currentUser.domain}`);
    const updatedOrg = {
      ...org,
      ...data,
      updatedAt: new Date().toISOString()
    };

    await setFirestoreDocument(`organizations/${currentUser.domain}`, updatedOrg);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Firestore REST API helpers
async function getFirestoreDocument(path) {
  if (!firebaseConfig || !authToken) return null;

  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Firestore error: ${response.statusText}`);
    }

    const data = await response.json();
    return convertFirestoreDocument(data);
  } catch (error) {
    console.error('Error reading Firestore document:', error);
    return null;
  }
}

async function setFirestoreDocument(path, data) {
  if (!firebaseConfig || !authToken) {
    throw new Error('Firebase not configured or not signed in');
  }

  const firestoreData = convertToFirestoreFormat(data);

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: firestoreData })
    }
  );

  if (!response.ok) {
    throw new Error(`Firestore write error: ${response.statusText}`);
  }

  return await response.json();
}

async function getFirestoreCollection(path) {
  if (!firebaseConfig || !authToken) return null;

  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) return {};
      throw new Error(`Firestore error: ${response.statusText}`);
    }

    const data = await response.json();
    const documents = {};

    if (data.documents) {
      for (const doc of data.documents) {
        const id = doc.name.split('/').pop();
        documents[id] = convertFirestoreDocument(doc);
      }
    }

    return documents;
  } catch (error) {
    console.error('Error reading Firestore collection:', error);
    return {};
  }
}

// Convert Firestore document format to plain JavaScript object
function convertFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;

  const result = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = extractFirestoreValue(value);
  }
  return result;
}

function extractFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values?.map(v => extractFirestoreValue(v)) || [];
  }
  if (value.mapValue !== undefined) {
    const obj = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      obj[k] = extractFirestoreValue(v);
    }
    return obj;
  }
  if (value.nullValue !== undefined) return null;
  return null;
}

// Convert plain JavaScript object to Firestore format
function convertToFirestoreFormat(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = toFirestoreValue(value);
  }
  return result;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(v => toFirestoreValue(v))
      }
    };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

// Firebase Deals CRUD Operations
async function getFirebaseDeals() {
  try {
    if (!currentUser) {
      throw new Error('Not signed in');
    }

    const dealsSnapshot = await getFirestoreCollection(`organizations/${currentUser.domain}/deals`);
    return { success: true, deals: dealsSnapshot || {} };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveFirebaseDeal(deal) {
  try {
    if (!currentUser) {
      throw new Error('Not signed in');
    }

    if (currentUser.role === 'viewer') {
      throw new Error('Viewers cannot edit deals');
    }

    await setFirestoreDocument(
      `organizations/${currentUser.domain}/deals/${deal.id}`,
      deal
    );

    return { success: true, deal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFirebaseDeal(dealId) {
  try {
    if (!currentUser) {
      throw new Error('Not signed in');
    }

    if (currentUser.role === 'viewer') {
      throw new Error('Viewers cannot delete deals');
    }

    await deleteFirestoreDocument(`organizations/${currentUser.domain}/deals/${dealId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Firebase Pipelines CRUD Operations
async function getFirebasePipelines() {
  try {
    if (!currentUser) {
      throw new Error('Not signed in');
    }

    const pipelinesSnapshot = await getFirestoreCollection(`organizations/${currentUser.domain}/pipelines`);

    // Convert object to array
    const pipelines = [];
    for (const id in pipelinesSnapshot) {
      pipelines.push({ id, ...pipelinesSnapshot[id] });
    }

    return { success: true, pipelines };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveFirebasePipeline(pipeline) {
  try {
    if (!currentUser) {
      throw new Error('Not signed in');
    }

    if (currentUser.role === 'viewer') {
      throw new Error('Viewers cannot edit pipelines');
    }

    await setFirestoreDocument(
      `organizations/${currentUser.domain}/pipelines/${pipeline.id}`,
      pipeline
    );

    return { success: true, pipeline };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Real-time subscriptions
const activeSubscriptions = new Map();

async function subscribeToFirebaseDeals(tabId) {
  if (!currentUser) return;

  // Avoid duplicate subscriptions
  if (activeSubscriptions.has(`deals-${tabId}`)) return;

  // Poll for changes every 5 seconds (Firestore REST API doesn't support real-time listeners)
  const intervalId = setInterval(async () => {
    try {
      const result = await getFirebaseDeals();
      if (result.success) {
        // Notify the tab
        chrome.tabs.sendMessage(tabId, {
          action: 'firebaseDealsUpdated',
          deals: result.deals
        }).catch(() => {
          // Tab might be closed, clear subscription
          clearInterval(intervalId);
          activeSubscriptions.delete(`deals-${tabId}`);
        });
      }
    } catch (error) {
      console.error('Error polling Firebase deals:', error);
    }
  }, 5000);

  activeSubscriptions.set(`deals-${tabId}`, intervalId);
}

async function subscribeToFirebasePipelines(tabId) {
  if (!currentUser) return;

  if (activeSubscriptions.has(`pipelines-${tabId}`)) return;

  const intervalId = setInterval(async () => {
    try {
      const result = await getFirebasePipelines();
      if (result.success) {
        chrome.tabs.sendMessage(tabId, {
          action: 'firebasePipelinesUpdated',
          pipelines: result.pipelines
        }).catch(() => {
          clearInterval(intervalId);
          activeSubscriptions.delete(`pipelines-${tabId}`);
        });
      }
    } catch (error) {
      console.error('Error polling Firebase pipelines:', error);
    }
  }, 5000);

  activeSubscriptions.set(`pipelines-${tabId}`, intervalId);
}

// Delete Firestore document
async function deleteFirestoreDocument(path) {
  if (!firebaseConfig || !authToken) {
    throw new Error('Firebase not configured or not signed in');
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Firestore delete error: ${response.statusText}`);
  }

  return true;
}

// ========== HUBSPOT INTEGRATION ==========

async function handleHubSpotAuth() {
  // HubSpot OAuth flow
  // For now, we'll use a private app access token approach for simplicity
  // Production would use full OAuth2 flow

  return new Promise((resolve) => {
    chrome.storage.local.get(['hubspotAccessToken'], (result) => {
      if (result.hubspotAccessToken) {
        resolve({ success: true, accessToken: result.hubspotAccessToken });
      } else {
        resolve({ success: false, error: 'No HubSpot access token found. Please configure in settings.' });
      }
    });
  });
}

async function getHubSpotPipelines(accessToken) {
  try {
    // Fetch all deal pipelines from HubSpot
    const response = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Map HubSpot pipelines to our format
    const pipelines = data.results.map(pipeline => ({
      id: `hubspot_${pipeline.id}`,
      hubspotId: pipeline.id,
      name: pipeline.label,
      stages: pipeline.stages.map(stage => ({
        id: `stage_${stage.id}`,
        hubspotId: stage.id,
        name: stage.label,
        color: getStageColor(stage.displayOrder),
        probability: stage.metadata?.probability || 50
      })),
      source: 'hubspot',
      importedAt: new Date().toISOString()
    }));

    return { success: true, pipelines };
  } catch (error) {
    console.error('Error fetching HubSpot pipelines:', error);
    return { success: false, error: error.message };
  }
}

function getStageColor(displayOrder) {
  // Assign colors based on stage order
  const colors = ['#ea4335', '#fbbc04', '#34a853', '#4285f4', '#9c27b0', '#ff6d00'];
  return colors[displayOrder % colors.length];
}

async function getHubSpotDeals(accessToken, pipelineId = null) {
  try {
    let allDeals = [];
    let after = null;
    let hasMore = true;

    // Fetch all deals with pagination
    while (hasMore) {
      let url = 'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,closedate,dealstage,pipeline,hubspot_owner_id,createdate,notes_last_updated,hs_lastmodifieddate,description';

      if (after) {
        url += `&after=${after}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HubSpot API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      allDeals = allDeals.concat(data.results);

      if (data.paging && data.paging.next) {
        after = data.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    // Filter by pipeline if specified
    if (pipelineId) {
      allDeals = allDeals.filter(deal => deal.properties.pipeline === pipelineId.replace('hubspot_', ''));
    }

    return { success: true, deals: allDeals, count: allDeals.length };
  } catch (error) {
    console.error('Error fetching HubSpot deals:', error);
    return { success: false, error: error.message };
  }
}

async function getHubSpotDealProperties(accessToken) {
  // Fetch all custom deal properties
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/properties/deals', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deal properties: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, properties: data.results };
  } catch (error) {
    console.error('Error fetching HubSpot deal properties:', error);
    return { success: false, error: error.message };
  }
}

async function getHubSpotContacts(accessToken, dealId) {
  // Fetch contacts associated with a specific deal
  try {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) return { success: true, contacts: [] };
      throw new Error(`Failed to fetch contacts: ${response.status}`);
    }

    const data = await response.json();
    const contactIds = data.results.map(r => r.id);

    // Fetch contact details if we have IDs
    if (contactIds.length === 0) {
      return { success: true, contacts: [] };
    }

    // Batch fetch contact details
    const contactsResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/batch/read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: ['firstname', 'lastname', 'email', 'phone', 'jobtitle', 'company'],
          inputs: contactIds.map(id => ({ id }))
        })
      }
    );

    if (!contactsResponse.ok) {
      throw new Error(`Failed to fetch contact details: ${contactsResponse.status}`);
    }

    const contactsData = await contactsResponse.json();
    return { success: true, contacts: contactsData.results || [] };
  } catch (error) {
    console.warn('Error fetching contacts for deal:', dealId, error);
    return { success: true, contacts: [] }; // Don't fail import if contacts fail
  }
}

async function getHubSpotOwners(accessToken) {
  // Fetch all owners (users) from HubSpot
  try {
    const response = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch owners: ${response.status}`);
    }

    const data = await response.json();

    // Create owner lookup map
    const ownerMap = {};
    data.results.forEach(owner => {
      ownerMap[owner.id] = {
        id: owner.id,
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName,
        fullName: `${owner.firstName} ${owner.lastName}`
      };
    });

    return { success: true, owners: ownerMap };
  } catch (error) {
    console.error('Error fetching HubSpot owners:', error);
    return { success: true, owners: {} }; // Don't fail import
  }
}

async function getHubSpotEngagements(accessToken, dealId) {
  // Fetch activities (emails, notes, tasks, calls) for a deal
  try {
    const engagements = {
      emails: [],
      notes: [],
      tasks: [],
      calls: []
    };

    // Fetch notes
    const notesResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/notes`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (notesResponse.ok) {
      const notesData = await notesResponse.json();
      const noteIds = notesData.results?.map(r => r.id) || [];

      if (noteIds.length > 0) {
        const notesDetailsResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/notes/batch/read`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: ['hs_note_body', 'hs_timestamp', 'hs_created_by'],
              inputs: noteIds.map(id => ({ id }))
            })
          }
        );

        if (notesDetailsResponse.ok) {
          const notesDetails = await notesDetailsResponse.json();
          engagements.notes = notesDetails.results || [];
        }
      }
    }

    // Fetch emails
    const emailsResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/emails`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json();
      const emailIds = emailsData.results?.map(r => r.id) || [];

      if (emailIds.length > 0) {
        const emailsDetailsResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/emails/batch/read`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: ['hs_email_subject', 'hs_email_text', 'hs_timestamp', 'hs_email_from', 'hs_email_to'],
              inputs: emailIds.map(id => ({ id }))
            })
          }
        );

        if (emailsDetailsResponse.ok) {
          const emailsDetails = await emailsDetailsResponse.json();
          engagements.emails = emailsDetails.results || [];
        }
      }
    }

    // Fetch tasks
    const tasksResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/tasks`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (tasksResponse.ok) {
      const tasksData = await tasksResponse.json();
      const taskIds = tasksData.results?.map(r => r.id) || [];

      if (taskIds.length > 0) {
        const tasksDetailsResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/tasks/batch/read`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: ['hs_task_subject', 'hs_task_body', 'hs_task_status', 'hs_timestamp', 'hs_task_priority'],
              inputs: taskIds.map(id => ({ id }))
            })
          }
        );

        if (tasksDetailsResponse.ok) {
          const tasksDetails = await tasksDetailsResponse.json();
          engagements.tasks = tasksDetails.results || [];
        }
      }
    }

    // Fetch calls
    const callsResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/calls`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (callsResponse.ok) {
      const callsData = await callsResponse.json();
      const callIds = callsData.results?.map(r => r.id) || [];

      if (callIds.length > 0) {
        const callsDetailsResponse = await fetch(
          `https://api.hubapi.com/crm/v3/objects/calls/batch/read`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              properties: ['hs_call_title', 'hs_call_body', 'hs_call_duration', 'hs_timestamp', 'hs_call_status'],
              inputs: callIds.map(id => ({ id }))
            })
          }
        );

        if (callsDetailsResponse.ok) {
          const callsDetails = await callsDetailsResponse.json();
          engagements.calls = callsDetails.results || [];
        }
      }
    }

    return { success: true, engagements };
  } catch (error) {
    console.warn('Error fetching engagements for deal:', dealId, error);
    return { success: true, engagements: { emails: [], notes: [], tasks: [], calls: [] } };
  }
}

async function importHubSpotData(accessToken, options) {
  try {
    console.log('Starting enhanced HubSpot import with options:', options);

    // Step 1: Get HubSpot pipelines
    const pipelinesResult = await getHubSpotPipelines(accessToken);
    if (!pipelinesResult.success) {
      throw new Error('Failed to fetch HubSpot pipelines');
    }

    // Step 2: Get owners if requested
    let ownersMap = {};
    if (options.importOwners) {
      const ownersResult = await getHubSpotOwners(accessToken);
      if (ownersResult.success) {
        ownersMap = ownersResult.owners;
      }
    }

    // Step 3: Get custom properties if requested
    let customProperties = {};
    if (options.importCustomFields) {
      const propertiesResult = await getHubSpotDealProperties(accessToken);
      if (propertiesResult.success) {
        // Create a map of custom properties (excluding standard ones)
        const standardProps = ['dealname', 'amount', 'closedate', 'dealstage', 'pipeline', 'hubspot_owner_id', 'createdate', 'notes_last_updated', 'hs_lastmodifieddate', 'description'];
        propertiesResult.properties.forEach(prop => {
          if (!standardProps.includes(prop.name) && !prop.name.startsWith('hs_')) {
            customProperties[prop.name] = prop.label;
          }
        });
      }
    }

    const importedPipelines = [];
    const importedDeals = [];
    let totalDealsProcessed = 0;

    // Step 4: For each selected pipeline, import deals
    for (const pipelineMapping of options.pipelineMappings) {
      if (!pipelineMapping.import) continue;

      const hubspotPipeline = pipelinesResult.pipelines.find(p => p.hubspotId === pipelineMapping.hubspotId);
      if (!hubspotPipeline) continue;

      // Get deals for this pipeline
      const dealsResult = await getHubSpotDeals(accessToken, hubspotPipeline.id);
      if (!dealsResult.success) {
        console.warn(`Failed to fetch deals for pipeline ${hubspotPipeline.name}`);
        continue;
      }

      // Map pipeline to our format
      const mappedPipeline = {
        ...hubspotPipeline,
        id: pipelineMapping.targetId || hubspotPipeline.id,
        type: 'sales' // Default type
      };

      importedPipelines.push(mappedPipeline);

      // Map deals to our format (with enhanced data)
      for (const hubspotDeal of dealsResult.deals) {
        const properties = hubspotDeal.properties;
        const dealId = hubspotDeal.id;

        // Find corresponding stage
        const stage = mappedPipeline.stages.find(s => s.hubspotId === properties.dealstage);

        // Fetch contacts if requested
        let contactsData = [];
        if (options.importContacts) {
          const contactsResult = await getHubSpotContacts(accessToken, dealId);
          if (contactsResult.success) {
            contactsData = contactsResult.contacts;
          }
        }

        // Fetch engagements if requested
        let engagementsData = { emails: [], notes: [], tasks: [], calls: [] };
        if (options.importActivities) {
          const engagementsResult = await getHubSpotEngagements(accessToken, dealId);
          if (engagementsResult.success) {
            engagementsData = engagementsResult.engagements;
          }
        }

        // Map contacts
        const contacts = contactsData.map(contact => {
          const props = contact.properties;
          return `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email;
        }).filter(Boolean);

        const primaryContact = contactsData[0]?.properties;
        const contactEmail = primaryContact?.email || '';
        const contactName = primaryContact ? `${primaryContact.firstname || ''} ${primaryContact.lastname || ''}`.trim() : '';

        // Map owner
        const ownerId = properties.hubspot_owner_id;
        const owner = ownersMap[ownerId];
        const assignedTo = owner ? owner.fullName : null;

        // Map custom properties
        const customFields = {};
        if (options.importCustomFields) {
          Object.keys(customProperties).forEach(propName => {
            if (properties[propName]) {
              customFields[propName] = properties[propName];
            }
          });
        }

        // Map notes from engagements
        const notesHistory = properties.description ? [{
          text: properties.description,
          createdAt: properties.notes_last_updated || properties.createdate || new Date().toISOString(),
          author: 'HubSpot Import'
        }] : [];

        engagementsData.notes.forEach(note => {
          const props = note.properties;
          notesHistory.push({
            text: props.hs_note_body || '',
            createdAt: props.hs_timestamp || new Date().toISOString(),
            author: props.hs_created_by || 'HubSpot'
          });
        });

        // Map emails from engagements
        const linkedEmails = engagementsData.emails.map(email => {
          const props = email.properties;
          return {
            subject: props.hs_email_subject || 'No Subject',
            from: props.hs_email_from || '',
            to: props.hs_email_to ? [props.hs_email_to] : [],
            body: props.hs_email_text || '',
            date: props.hs_timestamp || new Date().toISOString(),
            threadId: `hubspot_email_${email.id}`,
            source: 'hubspot'
          };
        });

        // Map tasks from engagements
        const tasks = engagementsData.tasks.map(task => {
          const props = task.properties;
          return {
            title: props.hs_task_subject || 'Untitled Task',
            description: props.hs_task_body || '',
            completed: props.hs_task_status === 'COMPLETED',
            dueDate: props.hs_timestamp || null,
            priority: props.hs_task_priority || 'MEDIUM',
            createdAt: props.hs_timestamp || new Date().toISOString()
          };
        });

        // Map calls from engagements
        const calls = engagementsData.calls.map(call => {
          const props = call.properties;
          return {
            title: props.hs_call_title || 'Call',
            notes: props.hs_call_body || '',
            duration: props.hs_call_duration ? parseInt(props.hs_call_duration) : 0,
            callDate: props.hs_timestamp || new Date().toISOString(),
            status: props.hs_call_status || 'COMPLETED'
          };
        });

        const mappedDeal = {
          id: `deal_hubspot_${dealId}`,
          hubspotId: dealId,
          threadId: `hubspot_${dealId}`,
          pipelineId: mappedPipeline.id,
          stageId: stage ? stage.id : mappedPipeline.stages[0].id,
          emailSubject: properties.dealname || 'Untitled Deal',
          value: parseFloat(properties.amount) || 0,
          company: properties.dealname?.split('-')[0]?.trim() || primaryContact?.company || 'Unknown Company',
          contactEmail: contactEmail,
          contactName: contactName,
          contacts: contacts,
          priority: 'Medium',
          probability: stage ? stage.probability : 50,
          status: 'Active',
          notes: properties.description || '',
          assignedTo: assignedTo,
          createdAt: properties.createdate || new Date().toISOString(),
          lastUpdated: properties.hs_lastmodifieddate || new Date().toISOString(),
          closeDate: properties.closedate || null,
          source: 'hubspot',
          importedAt: new Date().toISOString(),
          linkedEmails: linkedEmails,
          notesHistory: notesHistory,
          calls: calls,
          tasks: tasks,
          customFields: customFields,
          hubspotData: {
            ownerId: ownerId,
            ownerName: owner?.fullName || null,
            ownerEmail: owner?.email || null
          }
        };

        importedDeals.push(mappedDeal);
        totalDealsProcessed++;

        // Progress callback if provided
        if (options.onProgress) {
          options.onProgress({
            current: totalDealsProcessed,
            total: dealsResult.count,
            dealName: mappedDeal.emailSubject
          });
        }
      }
    }

    // Step 3: Save to local storage
    chrome.storage.local.get(['pipelines', 'deals'], (result) => {
      const existingPipelines = result.pipelines || [];
      const existingDeals = result.deals || {};

      // Merge or replace pipelines based on options
      let newPipelines = existingPipelines;
      if (options.replacePipelines) {
        // Remove old HubSpot pipelines and add new ones
        newPipelines = existingPipelines.filter(p => p.source !== 'hubspot').concat(importedPipelines);
      } else {
        // Add only new pipelines
        for (const pipeline of importedPipelines) {
          if (!existingPipelines.find(p => p.id === pipeline.id)) {
            newPipelines.push(pipeline);
          }
        }
      }

      // Add deals
      const newDeals = { ...existingDeals };
      for (const deal of importedDeals) {
        if (options.skipExisting && newDeals[deal.id]) {
          continue; // Skip if already exists
        }
        newDeals[deal.id] = deal;
      }

      // Save to storage
      chrome.storage.local.set({
        pipelines: newPipelines,
        deals: newDeals
      }, () => {
        console.log('HubSpot import complete!');
      });
    });

    return {
      success: true,
      imported: {
        pipelines: importedPipelines.length,
        deals: importedDeals.length
      }
    };

  } catch (error) {
    console.error('Error importing HubSpot data:', error);
    return { success: false, error: error.message };
  }
}

// Scheduled HubSpot Import
async function setupScheduledImport(schedule) {
  // schedule: 'daily', 'weekly', 'never'
  chrome.storage.local.set({ hubspotImportSchedule: schedule });

  // Clear existing alarms
  chrome.alarms.clear('hubspotScheduledImport');

  if (schedule === 'daily') {
    // Run daily at 6 AM
    chrome.alarms.create('hubspotScheduledImport', { periodInMinutes: 1440, when: getNext6AM() });
  } else if (schedule === 'weekly') {
    // Run weekly on Monday at 6 AM
    chrome.alarms.create('hubspotScheduledImport', { periodInMinutes: 10080, when: getNextMonday6AM() });
  }

  return { success: true };
}

function getNext6AM() {
  const now = new Date();
  const next6AM = new Date(now);
  next6AM.setHours(6, 0, 0, 0);

  if (next6AM <= now) {
    next6AM.setDate(next6AM.getDate() + 1);
  }

  return next6AM.getTime();
}

function getNextMonday6AM() {
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(6, 0, 0, 0);

  return nextMonday.getTime();
}

async function runScheduledImport() {
  console.log('Running scheduled HubSpot import...');

  const result = await new Promise(resolve => {
    chrome.storage.local.get(['hubspotAccessToken', 'hubspotScheduledPipelines'], resolve);
  });

  if (!result.hubspotAccessToken || !result.hubspotScheduledPipelines) {
    console.log('Scheduled import skipped - not configured');
    return;
  }

  try {
    await importHubSpotData(result.hubspotAccessToken, {
      pipelineMappings: result.hubspotScheduledPipelines,
      replacePipelines: false, // Merge mode for scheduled imports
      skipExisting: true, // Don't create duplicates
      importContacts: true,
      importActivities: true,
      importOwners: true,
      importCustomFields: true
    });

    console.log('Scheduled import completed successfully');

    // Notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'HubSpot Import Complete',
      message: 'Your scheduled HubSpot data has been imported successfully.'
    });
  } catch (error) {
    console.error('Scheduled import failed:', error);
  }
}

// Two-Way Sync: Push changes back to HubSpot
async function syncDealToHubSpot(accessToken, deal) {
  if (!deal.hubspotId) {
    return { success: false, error: 'Deal not from HubSpot' };
  }

  try {
    // Map our deal back to HubSpot format
    const hubspotProperties = {
      dealname: deal.emailSubject,
      amount: deal.value.toString(),
      dealstage: deal.stageId.replace('stage_', ''),
      closedate: deal.closeDate,
      description: deal.notes
    };

    // Add custom fields if they exist
    if (deal.customFields) {
      Object.assign(hubspotProperties, deal.customFields);
    }

    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${deal.hubspotId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties: hubspotProperties })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to sync to HubSpot: ${error}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing deal to HubSpot:', error);
    return { success: false, error: error.message };
  }
}

async function enableTwoWaySync(enable) {
  chrome.storage.local.set({ hubspotTwoWaySync: enable });
  return { success: true };
}

// ========== END HUBSPOT INTEGRATION ==========

console.log('Gmail CRM background service worker loaded');

// Use Chrome alarms API to keep service worker responsive (Manifest V3 best practice)
// This is better than setInterval which can cause issues with service worker lifecycle
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Service worker keepAlive ping');
  } else if (alarm.name === 'hubspotScheduledImport') {
    console.log('Triggering scheduled HubSpot import');
    runScheduledImport();
  }
});
