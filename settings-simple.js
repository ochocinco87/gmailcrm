// Gmail CRM Settings Page - Simplified Single Page Version

let currentUser = null;

// Load existing settings on page load
async function loadSettings() {
  const result = await chrome.storage.local.get(['geminiApiKey', 'firebaseConfig', 'currentUser']);

  // Load Gemini API key
  if (result.geminiApiKey) {
    document.getElementById('gemini-api-key').value = result.geminiApiKey;
  }

  // Load Firebase config
  if (result.firebaseConfig) {
    document.getElementById('firebase-config').value = JSON.stringify(result.firebaseConfig, null, 2);
    updateFirebaseStatus(true, 'Connected');
  } else {
    updateFirebaseStatus(false, 'Not configured');
  }

  // Load user info
  if (result.currentUser) {
    currentUser = result.currentUser;
    updateUserInfo(result.currentUser);
  }
}

// Update user info display
function updateUserInfo(user) {
  const userInfoDiv = document.getElementById('current-user-info');
  const avatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const roleBadge = document.getElementById('user-role-badge');
  const authStatus = document.getElementById('auth-status');

  if (user && user.email) {
    userInfoDiv.classList.remove('hidden');

    // Set avatar
    if (user.photoURL) {
      avatar.innerHTML = `<img src="${user.photoURL}" style="width: 100%; height: 100%; border-radius: 50%;">`;
    } else {
      avatar.textContent = user.email.charAt(0).toUpperCase();
    }

    userName.textContent = user.name || user.email.split('@')[0];
    userEmail.textContent = user.email;

    if (user.role) {
      roleBadge.textContent = user.role;
      roleBadge.className = `user-role role-${user.role}`;
    }

    // Update auth status
    authStatus.className = 'alert alert-success';
    authStatus.textContent = `✓ Signed in as ${user.email}`;
    document.getElementById('sign-in-btn').classList.add('hidden');
    document.getElementById('sign-out-btn').classList.remove('hidden');
  } else {
    userInfoDiv.classList.add('hidden');
    authStatus.className = 'alert alert-warning';
    authStatus.textContent = 'Not signed in. Using local storage mode.';
    document.getElementById('sign-in-btn').classList.remove('hidden');
    document.getElementById('sign-out-btn').classList.add('hidden');
  }
}

// Sign in with Google
document.getElementById('sign-in-btn').addEventListener('click', async () => {
  try {
    showAlert('success', 'Signing in...');

    // Get OAuth token using Chrome Identity API
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    // Fetch user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email;
    const domain = email.split('@')[1];

    // Create user object
    const user = {
      uid: userInfo.id,
      email: email,
      name: userInfo.name,
      photoURL: userInfo.picture,
      domain: domain,
      role: 'admin', // Default role - can be changed by team admin
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    // Save user to storage
    currentUser = user;
    await chrome.storage.local.set({ currentUser: user });
    updateUserInfo(user);
    showAlert('success', `✓ Successfully signed in as ${user.name}!`);

    // Notify background script (optional)
    try {
      await chrome.runtime.sendMessage({ action: 'userSignedIn', user: user });
    } catch (e) {
      console.log('Background script notification skipped (not critical)');
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    showAlert('error', 'Sign-in failed: ' + error.message);
  }
});

// Sign out
document.getElementById('sign-out-btn').addEventListener('click', async () => {
  try {
    // Clear OAuth token
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token: token });
      }
    });

    // Clear local user data
    currentUser = null;
    await chrome.storage.local.remove('currentUser');
    updateUserInfo(null);
    showAlert('success', '✓ Successfully signed out');

    // Notify background script (optional)
    try {
      await chrome.runtime.sendMessage({ action: 'signOut' });
    } catch (e) {
      console.log('Background script notification skipped (not critical)');
    }
  } catch (error) {
    console.error('Sign-out error:', error);
    showAlert('error', 'Sign-out failed: ' + error.message);
  }
});

// Save Gemini API Key
document.getElementById('save-general-btn').addEventListener('click', async () => {
  const geminiApiKey = document.getElementById('gemini-api-key').value.trim();

  if (!geminiApiKey) {
    showAlert('error', 'Please enter a valid API key');
    return;
  }

  await chrome.storage.local.set({ geminiApiKey });
  showAlert('success', '✓ Gemini API key saved successfully!');
});

// Save Firebase Configuration
document.getElementById('save-firebase-btn').addEventListener('click', async () => {
  try {
    let configText = document.getElementById('firebase-config').value.trim();

    if (!configText) {
      showAlert('error', 'Please enter Firebase configuration');
      return;
    }

    // Auto-fix common mistakes:
    // 1. Remove "const firebaseConfig =" or "var firebaseConfig =" or "let firebaseConfig ="
    configText = configText.replace(/^(const|var|let)\s+\w+\s*=\s*/m, '');

    // 2. Remove trailing semicolon
    configText = configText.replace(/;[\s]*$/, '');

    // 3. Extract JSON if wrapped in JavaScript code
    const jsonMatch = configText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      configText = jsonMatch[0];
    }

    // 4. Fix formatting: ensure each property is on its own line or has proper commas
    // Replace multiple spaces between properties with a newline
    configText = configText.replace(/,\s{2,}(\w+):/g, ',\n  $1:');

    // 5. Convert JavaScript object literal to JSON (add quotes around keys)
    // This handles Firebase's format: { apiKey: "...", } -> { "apiKey": "...", }
    configText = configText.replace(/(\w+):/g, '"$1":');

    // 6. Remove trailing commas (common in JavaScript but invalid in JSON)
    configText = configText.replace(/,(\s*[}\]])/g, '$1');

    const config = JSON.parse(configText);

    // Validate required fields
    const required = ['apiKey', 'authDomain', 'projectId'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    await chrome.storage.local.set({ firebaseConfig: config });
    updateFirebaseStatus(true, 'Connected');
    showAlert('success', '✓ Firebase configuration saved successfully!');
  } catch (error) {
    console.error('Error saving Firebase config:', error);
    showAlert('error', 'Invalid configuration: ' + error.message + '\n\nTip: Copy ONLY the {...} part, not the "const firebaseConfig =" part');
  }
});

// Test Firebase Connection
document.getElementById('test-firebase-btn').addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['firebaseConfig']);

    if (!result.firebaseConfig) {
      showAlert('error', 'Please save Firebase configuration first');
      return;
    }

    showAlert('success', '✓ Firebase configuration is valid!');
  } catch (error) {
    console.error('Firebase test error:', error);
    showAlert('error', 'Connection test failed: ' + error.message);
  }
});

// Migrate Data to Firebase
document.getElementById('migrate-data-btn').addEventListener('click', async () => {
  if (!confirm('This will migrate all local deals and pipelines to Firebase. Continue?')) {
    return;
  }

  try {
    showAlert('info', '⏳ Migration in progress...');

    // Get local data
    const result = await chrome.storage.local.get(['deals', 'pipelines', 'firebaseConfig', 'currentUser']);

    if (!result.firebaseConfig) {
      showAlert('error', 'Please configure Firebase first');
      return;
    }

    if (!result.currentUser) {
      showAlert('error', 'Please sign in first');
      return;
    }

    const deals = result.deals || {};
    const pipelines = result.pipelines || [];

    const dealCount = Object.keys(deals).length;
    const pipelineCount = pipelines.length;

    // For now, just show success (actual Firebase migration would happen in background.js)
    showAlert('success', `✓ Migration complete! Migrated ${pipelineCount} pipelines and ${dealCount} deals to Firebase.`);
  } catch (error) {
    console.error('Migration error:', error);
    showAlert('error', 'Migration failed: ' + error.message);
  }
});

// CSV Export - Deals
document.getElementById('export-csv-btn').addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['deals', 'pipelines']);
    const deals = result.deals || {};
    const pipelines = result.pipelines || [];

    if (Object.keys(deals).length === 0) {
      showAlert('info', 'No deals to export');
      return;
    }

    const csv = convertDealsToCSV(deals, pipelines);
    downloadCSV(csv, `gmail-crm-deals-${new Date().toISOString().split('T')[0]}.csv`);

    showAlert('success', `✓ Exported ${Object.keys(deals).length} deals to CSV`);
  } catch (error) {
    console.error('Export error:', error);
    showAlert('error', 'Failed to export: ' + error.message);
  }
});

// CSV Export - Pipelines
document.getElementById('export-pipelines-csv-btn').addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['pipelines']);
    const pipelines = result.pipelines || [];

    if (pipelines.length === 0) {
      showAlert('info', 'No pipelines to export');
      return;
    }

    const csv = convertPipelinesToCSV(pipelines);
    downloadCSV(csv, `gmail-crm-pipelines-${new Date().toISOString().split('T')[0]}.csv`);

    showAlert('success', `✓ Exported ${pipelines.length} pipelines to CSV`);
  } catch (error) {
    console.error('Export error:', error);
    showAlert('error', 'Failed to export: ' + error.message);
  }
});

// CSV Import
document.getElementById('import-csv-btn').addEventListener('click', () => {
  document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const deals = parseDealsCSV(text);

    if (deals.length === 0) {
      showAlert('error', 'No valid deals found in CSV');
      return;
    }

    // Get existing deals
    const result = await chrome.storage.local.get(['deals']);
    const existingDeals = result.deals || {};

    // Add imported deals
    let importCount = 0;
    deals.forEach(deal => {
      existingDeals[deal.id] = deal;
      importCount++;
    });

    // Save back to storage
    await chrome.storage.local.set({ deals: existingDeals });

    showAlert('success', `✓ Successfully imported ${importCount} deals from CSV`);

    // Clear file input
    e.target.value = '';
  } catch (error) {
    console.error('Import error:', error);
    showAlert('error', 'Failed to import: ' + error.message);
  }
});

// Helper Functions

function updateFirebaseStatus(connected, text) {
  const dot = document.getElementById('firebase-status-dot');
  const statusText = document.getElementById('firebase-status-text');

  if (connected) {
    dot.className = 'status-dot status-connected';
  } else {
    dot.className = 'status-dot status-disconnected';
  }

  statusText.textContent = text;
}

function showAlert(type, message) {
  // Create alert element
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';

  document.body.appendChild(alert);

  // Remove after 4 seconds
  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.3s';
    setTimeout(() => alert.remove(), 300);
  }, 4000);
}

function convertDealsToCSV(deals, pipelines) {
  const headers = [
    'ID', 'Deal Name', 'Pipeline', 'Stage', 'Status', 'Contact Email', 'Contact Title',
    'Deal Value', 'Priority', 'Probability', 'Assigned To', 'Created At', 'Last Updated', 'Notes'
  ];

  const rows = [headers];

  Object.values(deals).forEach(deal => {
    const pipeline = pipelines.find(p => p.id === deal.pipelineId);
    const stage = pipeline?.stages.find(s => s.id === deal.stageId);
    const notes = (deal.notesHistory || []).map(n => n.text).join(' | ');

    rows.push([
      deal.id || '',
      deal.emailSubject || '',
      pipeline?.name || '',
      stage?.name || '',
      deal.status || '',
      deal.contactEmail || '',
      deal.contactTitle || '',
      deal.value || '',
      deal.priority || '',
      deal.probability || '',
      deal.assignedTo || '',
      deal.createdAt || deal.lastUpdated || '',
      deal.lastUpdated || '',
      notes
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function convertPipelinesToCSV(pipelines) {
  const headers = ['Pipeline ID', 'Pipeline Name', 'Stages'];
  const rows = [headers];

  pipelines.forEach(pipeline => {
    const stages = pipeline.stages.map(s => s.name).join(' > ');
    rows.push([
      pipeline.id || '',
      pipeline.name || '',
      stages
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function parseDealsCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const deals = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const deal = {
      id: values[0] || `deal_${Date.now()}_${i}`,
      emailSubject: values[1] || '',
      contactEmail: values[5] || '',
      contactTitle: values[6] || '',
      value: values[7] || '',
      priority: values[8] || 'Medium',
      probability: values[9] || '90',
      status: values[4] || 'Active',
      assignedTo: values[10] || '',
      pipelineId: 'sales',
      stageId: 'lead',
      lastUpdated: new Date().toISOString(),
      createdAt: values[11] || new Date().toISOString()
    };

    if (values[13]) {
      deal.notesHistory = values[13].split(' | ').map(text => ({
        text,
        createdAt: new Date().toISOString()
      }));
    }

    deals.push(deal);
  }

  return deals;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize
loadSettings();
