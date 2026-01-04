// Gmail CRM Settings Page
// Handles Firebase configuration, user management, and organization settings

let currentUser = null;
let userRole = null;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.querySelector(`[data-content="${tabName}"]`).classList.add('active');

    // Load tab-specific data
    if (tabName === 'users') {
      loadUsers();
    } else if (tabName === 'organization') {
      loadOrganization();
    }
  });
});

// General Settings
document.getElementById('save-general-btn').addEventListener('click', async () => {
  const geminiApiKey = document.getElementById('gemini-api-key').value;

  await chrome.storage.local.set({ geminiApiKey });

  showAlert('general', 'success', 'Settings saved successfully!');
});

// Load existing settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['geminiApiKey', 'firebaseConfig', 'currentUser']);

  if (result.geminiApiKey) {
    document.getElementById('gemini-api-key').value = result.geminiApiKey;
  }

  if (result.firebaseConfig) {
    document.getElementById('firebase-config').value = JSON.stringify(result.firebaseConfig, null, 2);
    updateFirebaseStatus(true, 'Connected');
  } else {
    updateFirebaseStatus(false, 'Not configured');
  }

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

  if (user && user.email) {
    userInfoDiv.classList.remove('hidden');

    if (user.photoURL) {
      avatar.src = user.photoURL;
    } else {
      avatar.textContent = user.email.charAt(0).toUpperCase();
    }

    userName.textContent = user.name || user.email.split('@')[0];
    userEmail.textContent = user.email;

    if (user.role) {
      userRole = user.role;
      roleBadge.textContent = user.role;
      roleBadge.className = `user-role role-${user.role}`;

      // Show/hide admin tabs
      const usersTab = document.getElementById('users-tab');
      const orgTab = document.getElementById('org-tab');

      if (user.role === 'admin') {
        usersTab.style.display = 'block';
        orgTab.style.display = 'block';
      } else {
        usersTab.style.display = 'none';
        orgTab.style.display = 'none';
      }
    }

    // Update auth status
    document.getElementById('auth-status').className = 'alert alert-success';
    document.getElementById('auth-status').textContent = `Signed in as ${user.email}`;
    document.getElementById('sign-in-btn').classList.add('hidden');
    document.getElementById('sign-out-btn').classList.remove('hidden');
  } else {
    userInfoDiv.classList.add('hidden');
    document.getElementById('auth-status').className = 'alert alert-warning';
    document.getElementById('auth-status').textContent = 'Not signed in. Please sign in to enable multi-user features.';
    document.getElementById('sign-in-btn').classList.remove('hidden');
    document.getElementById('sign-out-btn').classList.add('hidden');
  }
}

// Sign in
document.getElementById('sign-in-btn').addEventListener('click', async () => {
  try {
    // Check if Firebase is configured
    const result = await chrome.storage.local.get(['firebaseConfig']);
    if (!result.firebaseConfig) {
      showAlert('general', 'error', 'Please configure Firebase first in the Firebase tab');
      return;
    }

    showAlert('general', 'info', 'Signing in...');

    // Get OAuth token directly (doesn't require background service worker)
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

    // Check if domain is authorized (medivis.com only)
    if (domain !== 'medivis.com') {
      throw new Error(`Domain ${domain} is not authorized. Only medivis.com accounts are allowed.`);
    }

    // Create user object
    const user = {
      uid: userInfo.id,
      email: email,
      name: userInfo.name,
      photoURL: userInfo.picture,
      domain: domain,
      role: 'admin', // First user is always admin; backend will adjust if needed
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    // Save user to storage
    currentUser = user;
    await chrome.storage.local.set({ currentUser: user });
    updateUserInfo(user);
    showAlert('general', 'success', 'Successfully signed in!');

    // Try to notify background script (optional, with timeout)
    try {
      await Promise.race([
        chrome.runtime.sendMessage({ action: 'userSignedIn', user: user }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
    } catch (bgError) {
      console.warn('Could not notify background script (may be inactive):', bgError);
      // This is OK - user is still signed in locally
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    showAlert('general', 'error', 'Sign-in failed: ' + error.message);
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
    showAlert('general', 'success', 'Successfully signed out');

    // Try to notify background script (optional, with timeout)
    try {
      await Promise.race([
        chrome.runtime.sendMessage({ action: 'signOut' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
    } catch (bgError) {
      console.warn('Could not notify background script (may be inactive):', bgError);
      // This is OK - user is still signed out locally
    }
  } catch (error) {
    console.error('Sign-out error:', error);
    showAlert('general', 'error', 'Sign-out failed: ' + error.message);
  }
});

// Firebase Configuration
document.getElementById('save-firebase-btn').addEventListener('click', async () => {
  try {
    const configText = document.getElementById('firebase-config').value;
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
    showAlert('firebase', 'success', 'Firebase configuration saved successfully!');
  } catch (error) {
    console.error('Error saving Firebase config:', error);
    showAlert('firebase', 'error', 'Invalid configuration: ' + error.message);
  }
});

// Test Firebase connection
document.getElementById('test-firebase-btn').addEventListener('click', async () => {
  try {
    const response = await sendMessageWithTimeout({ action: 'testFirebaseConnection' });

    if (response.success) {
      showAlert('firebase', 'success', 'Firebase connection successful!');
    } else {
      showAlert('firebase', 'error', 'Connection failed: ' + response.error);
    }
  } catch (error) {
    console.error('Firebase test error:', error);
    showAlert('firebase', 'error', 'Connection test failed: ' + error.message);
  }
});

// Migrate data
document.getElementById('migrate-data-btn').addEventListener('click', async () => {
  if (!confirm('This will migrate all local deals and pipelines to Firebase. This action cannot be undone. Continue?')) {
    return;
  }

  try {
    showAlert('firebase', 'info', 'Migration in progress...');

    const response = await sendMessageWithTimeout({ action: 'migrateDataToFirebase' }, 10000); // Longer timeout for migration

    if (response.success) {
      showAlert('firebase', 'success', `Migration complete! Migrated ${response.count} items.`);
    } else {
      showAlert('firebase', 'error', 'Migration failed: ' + response.error);
    }
  } catch (error) {
    console.error('Migration error:', error);
    showAlert('firebase', 'error', 'Migration failed: ' + error.message);
  }
});

// Load users (admin only)
async function loadUsers() {
  if (userRole !== 'admin') {
    document.getElementById('users-content').innerHTML = '<div class="alert alert-warning">You must be an admin to view users</div>';
    return;
  }

  try {
    const response = await sendMessageWithTimeout({ action: 'getOrgUsers' });

    document.getElementById('users-loading').classList.add('hidden');

    if (response.success) {
      const users = response.users || [];
      const tbody = document.getElementById('users-table-body');
      tbody.innerHTML = '';

      users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.name || user.email.split('@')[0]}</td>
          <td>${user.email}</td>
          <td>
            <select class="user-role-select" data-email="${user.email}">
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
              <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            </select>
          </td>
          <td>${user.lastLoginAt ? new Date(user.lastLoginAt.seconds * 1000).toLocaleDateString() : 'Never'}</td>
          <td>
            <button class="btn btn-sm update-role-btn" data-email="${user.email}">Update</button>
          </td>
        `;
        tbody.appendChild(row);
      });

      // Add event listeners for role updates
      document.querySelectorAll('.update-role-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const email = e.target.dataset.email;
          const select = document.querySelector(`select[data-email="${email}"]`);
          const newRole = select.value;

          try {
            const response = await sendMessageWithTimeout({
              action: 'updateUserRole',
              email,
              role: newRole
            });

            if (response.success) {
              showAlert('users', 'success', `Updated ${email} to ${newRole}`);
            } else {
              showAlert('users', 'error', 'Failed to update role: ' + response.error);
            }
          } catch (error) {
            showAlert('users', 'error', 'Error updating role: ' + error.message);
          }
        });
      });

      document.getElementById('users-content').classList.remove('hidden');
    } else {
      showAlert('users', 'error', 'Failed to load users: ' + response.error);
    }
  } catch (error) {
    console.error('Error loading users:', error);
    showAlert('users', 'error', 'Error loading users: ' + error.message);
  }
}

// Load organization (admin only)
async function loadOrganization() {
  if (userRole !== 'admin') {
    return;
  }

  try {
    const response = await sendMessageWithTimeout({ action: 'getOrganization' });

    if (response.success && response.org) {
      const org = response.org;

      document.getElementById('org-name').value = org.name || '';
      document.getElementById('org-domain').value = org.domain || '';
      document.getElementById('org-subscription-status').value = org.subscription?.status || 'N/A';
      document.getElementById('org-plan').value = org.subscription?.plan || 'N/A';
      document.getElementById('org-seats').value = `${org.subscription?.seatsUsed || 0} / ${org.subscription?.seats || 0}`;
    }
  } catch (error) {
    console.error('Error loading organization:', error);
    showAlert('organization', 'error', 'Error loading organization: ' + error.message);
  }
}

// Save organization
document.getElementById('save-org-btn').addEventListener('click', async () => {
  if (userRole !== 'admin') {
    showAlert('organization', 'error', 'Only admins can update organization settings');
    return;
  }

  try {
    const orgName = document.getElementById('org-name').value;

    const response = await sendMessageWithTimeout({
      action: 'updateOrganization',
      data: { name: orgName }
    });

    if (response.success) {
      showAlert('organization', 'success', 'Organization settings updated!');
    } else {
      showAlert('organization', 'error', 'Failed to update: ' + response.error);
    }
  } catch (error) {
    showAlert('organization', 'error', 'Error updating organization: ' + error.message);
  }
});

// Helper functions
async function sendMessageWithTimeout(message, timeoutMs = 3000) {
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage(message),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), timeoutMs))
    ]);
    return response;
  } catch (error) {
    if (error.message === 'Background script timeout') {
      throw new Error('Background service worker is not responding. Try refreshing Gmail to activate it.');
    }
    throw error;
  }
}

function updateFirebaseStatus(connected, text) {
  const dot = document.getElementById('firebase-status-dot');
  const statusText = document.getElementById('firebase-status-text');

  dot.className = `status-dot ${connected ? 'status-connected' : 'status-disconnected'}`;
  statusText.textContent = text;
}

function showAlert(tab, type, message) {
  const tabContent = document.querySelector(`[data-content="${tab}"]`);
  const existingAlert = tabContent.querySelector('.alert:not([id])');

  if (existingAlert) {
    existingAlert.remove();
  }

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  tabContent.insertBefore(alert, tabContent.firstChild);

  setTimeout(() => {
    if (alert.parentNode) {
      alert.remove();
    }
  }, 5000);
}

// CSV Import/Export
document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['deals', 'pipelines']);
    const deals = result.deals || {};
    const pipelines = result.pipelines || [];

    // Convert deals to CSV
    const csv = convertDealsToCSV(deals, pipelines);

    // Download CSV
    downloadCSV(csv, `gmail-crm-deals-${new Date().toISOString().split('T')[0]}.csv`);

    showAlert('firebase', 'success', `Exported ${Object.keys(deals).length} deals to CSV`);
  } catch (error) {
    console.error('Export error:', error);
    showAlert('firebase', 'error', 'Failed to export CSV: ' + error.message);
  }
});

document.getElementById('export-pipelines-csv-btn')?.addEventListener('click', async () => {
  try {
    const result = await chrome.storage.local.get(['pipelines']);
    const pipelines = result.pipelines || [];

    // Convert pipelines to CSV
    const csv = convertPipelinesToCSV(pipelines);

    // Download CSV
    downloadCSV(csv, `gmail-crm-pipelines-${new Date().toISOString().split('T')[0]}.csv`);

    showAlert('firebase', 'success', `Exported ${pipelines.length} pipelines to CSV`);
  } catch (error) {
    console.error('Export error:', error);
    showAlert('firebase', 'error', 'Failed to export CSV: ' + error.message);
  }
});

document.getElementById('import-csv-btn')?.addEventListener('click', () => {
  document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const deals = parseDealsCSV(text);

    if (deals.length === 0) {
      showAlert('firebase', 'error', 'No valid deals found in CSV');
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

    showAlert('firebase', 'success', `Successfully imported ${importCount} deals from CSV`);

    // Clear file input
    e.target.value = '';
  } catch (error) {
    console.error('Import error:', error);
    showAlert('firebase', 'error', 'Failed to import CSV: ' + error.message);
  }
});

function convertDealsToCSV(deals, pipelines) {
  const headers = [
    'ID',
    'Deal Name',
    'Pipeline',
    'Stage',
    'Status',
    'Contact Email',
    'Contact Title',
    'Deal Value',
    'Priority',
    'Probability',
    'Assigned To',
    'Created At',
    'Last Updated',
    'Notes',
    'Tasks',
    'Calls'
  ];

  const rows = [headers];

  Object.values(deals).forEach(deal => {
    const pipeline = pipelines.find(p => p.id === deal.pipelineId);
    const stage = pipeline?.stages.find(s => s.id === deal.stageId);

    const notes = (deal.notesHistory || []).map(n => n.text).join(' | ');
    const tasks = (deal.tasks || []).map(t => `${t.title} (${t.completed ? 'Done' : 'Pending'})`).join(' | ');
    const calls = (deal.calls || []).map(c => c.title || c.url).join(' | ');

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
      notes,
      tasks,
      calls
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

    const deal = {};
    headers.forEach((header, idx) => {
      const value = values[idx] || '';

      switch(header.toLowerCase().trim()) {
        case 'id':
          deal.id = value || `deal_${Date.now()}_${i}`;
          break;
        case 'deal name':
          deal.emailSubject = value;
          break;
        case 'contact email':
          deal.contactEmail = value;
          break;
        case 'contact title':
          deal.contactTitle = value;
          break;
        case 'deal value':
          deal.value = value;
          break;
        case 'priority':
          deal.priority = value || 'Medium';
          break;
        case 'probability':
          deal.probability = value || '90';
          break;
        case 'status':
          deal.status = value || 'Active';
          break;
        case 'assigned to':
          deal.assignedTo = value;
          break;
        case 'notes':
          if (value) {
            deal.notesHistory = value.split(' | ').map(text => ({
              text,
              createdAt: new Date().toISOString()
            }));
          }
          break;
      }
    });

    // Set defaults
    deal.pipelineId = deal.pipelineId || 'sales';
    deal.stageId = deal.stageId || 'lead';
    deal.lastUpdated = new Date().toISOString();
    deal.createdAt = deal.createdAt || deal.lastUpdated;

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

// ========== Email Snippets Management ==========

function loadSnippets() {
  chrome.storage.local.get(['emailSnippets'], (result) => {
    const snippets = result.emailSnippets || getDefaultSnippets();
    renderSnippets(snippets);
  });
}

function renderSnippets(snippets) {
  const container = document.getElementById('snippets-list');
  if (!container) return;

  if (snippets.length === 0) {
    container.innerHTML = '<p style="color: #5f6368;">No snippets yet. Click "Add New Snippet" to create one.</p>';
    return;
  }

  container.innerHTML = snippets.map((snippet, idx) => `
    <div class="snippet-item" style="border: 1px solid #dadce0; border-radius: 4px; padding: 12px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">${snippet.name}</div>
          <div style="font-size: 13px; color: #5f6368; background: #f8f9fa; padding: 8px; border-radius: 4px; font-family: monospace; white-space: pre-wrap;">${snippet.text}</div>
        </div>
        <div style="display: flex; gap: 8px; margin-left: 12px;">
          <button class="btn btn-secondary btn-small edit-snippet" data-idx="${idx}">Edit</button>
          <button class="btn btn-secondary btn-small delete-snippet" data-idx="${idx}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners
  container.querySelectorAll('.edit-snippet').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      showSnippetEditor(snippets[idx], idx, snippets);
    });
  });

  container.querySelectorAll('.delete-snippet').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Delete snippet "${snippets[idx].name}"?`)) {
        snippets.splice(idx, 1);
        chrome.storage.local.set({ emailSnippets: snippets }, () => {
          renderSnippets(snippets);
          showAlert('general', 'success', 'Snippet deleted');
        });
      }
    });
  });
}

function showSnippetEditor(snippet, idx, snippets) {
  const isNew = idx === -1;

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin: 0 0 16px 0;">${isNew ? 'New' : 'Edit'} Email Snippet</h3>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Snippet Name</label>
        <input type="text" id="snippet-name-input" value="${snippet?.name || ''}" placeholder="e.g., Pricing Info" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Snippet Text</label>
        <textarea id="snippet-text-input" rows="6" placeholder="Type your reusable text here..." style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-family: monospace;">${snippet?.text || ''}</textarea>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" id="cancel-snippet">Cancel</button>
        <button class="btn btn-primary" id="save-snippet">Save Snippet</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cancel-snippet').addEventListener('click', () => modal.remove());

  modal.querySelector('#save-snippet').addEventListener('click', () => {
    const name = document.getElementById('snippet-name-input').value.trim();
    const text = document.getElementById('snippet-text-input').value.trim();

    if (!name || !text) {
      alert('Please fill in both name and text');
      return;
    }

    const snippetData = { name, text };

    if (isNew) {
      snippets.push(snippetData);
    } else {
      snippets[idx] = snippetData;
    }

    chrome.storage.local.set({ emailSnippets: snippets }, () => {
      renderSnippets(snippets);
      modal.remove();
      showAlert('general', 'success', `Snippet ${isNew ? 'created' : 'updated'}!`);
    });
  });
}

function getDefaultSnippets() {
  return [
    {
      name: 'Pricing Request Response',
      text: 'Thank you for your interest! I\'d be happy to provide pricing information. Our standard package starts at $X per month. Would you like to schedule a call to discuss your specific needs?'
    },
    {
      name: 'Follow-up After No Response',
      text: 'I wanted to follow up on my previous email. I understand you\'re busy, so I\'ll keep this brief. Are you still interested in learning more about our solution?'
    },
    {
      name: 'Meeting Confirmation',
      text: 'Looking forward to our meeting! I\'ve sent a calendar invite. Please let me know if you need to reschedule.'
    }
  ];
}

// Add snippet button listener
document.getElementById('add-snippet-btn')?.addEventListener('click', () => {
  chrome.storage.local.get(['emailSnippets'], (result) => {
    const snippets = result.emailSnippets || getDefaultSnippets();
    showSnippetEditor(null, -1, snippets);
  });
});

// Load snippets when settings page opens
loadSnippets();

// Initialize
loadSettings();
