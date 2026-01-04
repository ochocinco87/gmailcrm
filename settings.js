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

// ========== Automation Rules Management ==========

function loadAutomationRules() {
  chrome.storage.local.get(['automationRules'], (result) => {
    const rules = result.automationRules || getDefaultAutomationRules();
    renderAutomationRules(rules);
  });
}

function getDefaultAutomationRules() {
  return [
    {
      id: 'rule_demo_1',
      name: 'High-Value Deal Alert',
      enabled: true,
      trigger: {
        type: 'stage_changed',
        toStageId: 'proposal'
      },
      conditions: [
        {
          field: 'value',
          operator: 'greater_than',
          value: 10000
        }
      ],
      actions: [
        {
          type: 'add_comment',
          text: '🎯 High-value deal! Review proposal carefully.'
        }
      ]
    },
    {
      id: 'rule_demo_2',
      name: 'Welcome New Leads',
      enabled: true,
      trigger: {
        type: 'deal_created'
      },
      conditions: [],
      actions: [
        {
          type: 'add_comment',
          text: '👋 Welcome! Remember to reach out within 24 hours.'
        }
      ]
    }
  ];
}

function renderAutomationRules(rules) {
  const container = document.getElementById('automation-rules-list');
  if (!container) return;

  if (rules.length === 0) {
    container.innerHTML = '<p style="color: #5f6368;">No automation rules yet. Click "Add New Rule" to create one.</p>';
    return;
  }

  container.innerHTML = rules.map((rule, idx) => {
    const triggerText = rule.trigger.type === 'deal_created'
      ? 'When deal is created'
      : `When deal moves to stage: ${rule.trigger.toStageId || 'any'}`;

    const conditionText = rule.conditions.length > 0
      ? rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(', ')
      : 'No conditions';

    const actionText = rule.actions.map(a => {
      if (a.type === 'add_comment') return `Add comment: "${a.text}"`;
      if (a.type === 'send_notification') return `Send notification: "${a.message}"`;
      if (a.type === 'update_field') return `Update ${a.field} to "${a.value}"`;
      return a.type;
    }).join(', ');

    return `
      <div class="automation-rule-item" style="border: 1px solid #dadce0; border-radius: 4px; padding: 16px; margin-bottom: 12px; background: ${rule.enabled ? 'white' : '#f8f9fa'};">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
              ${rule.enabled ? '✅' : '⏸️'} ${rule.name}
            </div>
            <div style="font-size: 13px; color: #5f6368; line-height: 1.6;">
              <div><strong>Trigger:</strong> ${triggerText}</div>
              <div><strong>Conditions:</strong> ${conditionText}</div>
              <div><strong>Actions:</strong> ${actionText}</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-left: 12px;">
            <button class="btn btn-secondary btn-small toggle-rule" data-idx="${idx}">
              ${rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-secondary btn-small edit-rule" data-idx="${idx}">Edit</button>
            <button class="btn btn-secondary btn-small delete-rule" data-idx="${idx}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  container.querySelectorAll('.toggle-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      rules[idx].enabled = !rules[idx].enabled;
      chrome.storage.local.set({ automationRules: rules }, () => {
        renderAutomationRules(rules);
        showAlert('general', 'success', `Rule ${rules[idx].enabled ? 'enabled' : 'disabled'}`);
      });
    });
  });

  container.querySelectorAll('.edit-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      showRuleEditor(rules[idx], idx, rules);
    });
  });

  container.querySelectorAll('.delete-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Delete rule "${rules[idx].name}"?`)) {
        rules.splice(idx, 1);
        chrome.storage.local.set({ automationRules: rules }, () => {
          renderAutomationRules(rules);
          showAlert('general', 'success', 'Rule deleted');
        });
      }
    });
  });
}

function showRuleEditor(rule, idx, rules) {
  const isNew = idx === -1;

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 24px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <h3 style="margin: 0 0 20px 0;">${isNew ? 'New' : 'Edit'} Automation Rule</h3>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Rule Name</label>
        <input type="text" id="rule-name-input" value="${rule?.name || ''}" placeholder="e.g., High-Value Deal Alert" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Trigger</label>
        <select id="rule-trigger-type" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
          <option value="deal_created" ${rule?.trigger?.type === 'deal_created' ? 'selected' : ''}>Deal Created</option>
          <option value="stage_changed" ${rule?.trigger?.type === 'stage_changed' ? 'selected' : ''}>Stage Changed</option>
        </select>
      </div>

      <div id="stage-selector" style="margin-bottom: 16px; ${rule?.trigger?.type === 'stage_changed' ? '' : 'display: none;'}">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">To Stage ID</label>
        <input type="text" id="rule-to-stage-id" value="${rule?.trigger?.toStageId || ''}" placeholder="e.g., proposal" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
        <small style="color: #5f6368;">Leave empty to trigger on any stage change</small>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Action Type</label>
        <select id="rule-action-type" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
          <option value="add_comment" ${rule?.actions?.[0]?.type === 'add_comment' ? 'selected' : ''}>Add Comment</option>
          <option value="send_notification" ${rule?.actions?.[0]?.type === 'send_notification' ? 'selected' : ''}>Send Notification</option>
        </select>
      </div>

      <div id="comment-field" style="margin-bottom: 16px; ${rule?.actions?.[0]?.type !== 'send_notification' ? '' : 'display: none;'}">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Comment Text</label>
        <textarea id="rule-comment-text" rows="3" placeholder="Enter comment text..." style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">${rule?.actions?.[0]?.text || ''}</textarea>
      </div>

      <div id="notification-field" style="margin-bottom: 16px; ${rule?.actions?.[0]?.type === 'send_notification' ? '' : 'display: none;'}">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Notification Message</label>
        <input type="text" id="rule-notification-message" value="${rule?.actions?.[0]?.message || ''}" placeholder="Enter notification message" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
        <button class="btn btn-secondary" id="cancel-rule">Cancel</button>
        <button class="btn btn-primary" id="save-rule">Save Rule</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Toggle stage selector visibility
  document.getElementById('rule-trigger-type').addEventListener('change', (e) => {
    document.getElementById('stage-selector').style.display =
      e.target.value === 'stage_changed' ? 'block' : 'none';
  });

  // Toggle action fields visibility
  document.getElementById('rule-action-type').addEventListener('change', (e) => {
    document.getElementById('comment-field').style.display =
      e.target.value === 'add_comment' ? 'block' : 'none';
    document.getElementById('notification-field').style.display =
      e.target.value === 'send_notification' ? 'block' : 'none';
  });

  modal.querySelector('#cancel-rule').addEventListener('click', () => modal.remove());

  modal.querySelector('#save-rule').addEventListener('click', () => {
    const name = document.getElementById('rule-name-input').value.trim();
    const triggerType = document.getElementById('rule-trigger-type').value;
    const toStageId = document.getElementById('rule-to-stage-id').value.trim();
    const actionType = document.getElementById('rule-action-type').value;

    if (!name) {
      alert('Please enter a rule name');
      return;
    }

    const trigger = {
      type: triggerType
    };

    if (triggerType === 'stage_changed' && toStageId) {
      trigger.toStageId = toStageId;
    }

    const action = {
      type: actionType
    };

    if (actionType === 'add_comment') {
      const commentText = document.getElementById('rule-comment-text').value.trim();
      if (!commentText) {
        alert('Please enter comment text');
        return;
      }
      action.text = commentText;
    } else if (actionType === 'send_notification') {
      const notificationMessage = document.getElementById('rule-notification-message').value.trim();
      if (!notificationMessage) {
        alert('Please enter notification message');
        return;
      }
      action.message = notificationMessage;
    }

    const ruleData = {
      id: rule?.id || 'rule_' + Date.now(),
      name,
      enabled: rule?.enabled !== false,
      trigger,
      conditions: rule?.conditions || [],
      actions: [action]
    };

    if (isNew) {
      rules.push(ruleData);
    } else {
      rules[idx] = ruleData;
    }

    chrome.storage.local.set({ automationRules: rules }, () => {
      renderAutomationRules(rules);
      modal.remove();
      showAlert('general', 'success', `Rule ${isNew ? 'created' : 'updated'}!`);
    });
  });
}

// Add automation rule button listener
document.getElementById('add-automation-rule-btn')?.addEventListener('click', () => {
  chrome.storage.local.get(['automationRules'], (result) => {
    const rules = result.automationRules || getDefaultAutomationRules();
    showRuleEditor(null, -1, rules);
  });
});

// Load automation rules when settings page opens
loadAutomationRules();

// ========== Follow-Up Sequences Management ==========

function loadSequences() {
  chrome.storage.local.get(['followUpSequences'], (result) => {
    const sequences = result.followUpSequences || [];
    renderSequences(sequences);
  });
}

function renderSequences(sequences) {
  const container = document.getElementById('sequences-list');
  if (!container) return;

  if (sequences.length === 0) {
    container.innerHTML = '<p style="color: #5f6368;">No sequences yet. Click "Create New Sequence" to get started.</p>';
    return;
  }

  container.innerHTML = sequences.map((seq, idx) => {
    const enrollmentCount = seq.enrollments ? seq.enrollments.filter(e => e.status === 'active').length : 0;

    return `
      <div class="sequence-item" style="border: 1px solid #dadce0; border-radius: 4px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
              📧 ${seq.name}
            </div>
            <div style="font-size: 13px; color: #5f6368; margin-bottom: 8px;">
              ${seq.steps.length} steps • ${enrollmentCount} active enrollments
            </div>
            <div style="font-size: 12px; color: #5f6368;">
              ${seq.steps.map((step, i) => `Step ${i + 1}: Day ${step.delay}`).join(' → ')}
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-left: 12px;">
            <button class="btn btn-secondary btn-small view-sequence" data-idx="${idx}">View</button>
            <button class="btn btn-secondary btn-small edit-sequence" data-idx="${idx}">Edit</button>
            <button class="btn btn-secondary btn-small delete-sequence" data-idx="${idx}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  container.querySelectorAll('.view-sequence').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      showSequenceViewer(sequences[idx]);
    });
  });

  container.querySelectorAll('.edit-sequence').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      showSequenceEditor(sequences[idx], idx, sequences);
    });
  });

  container.querySelectorAll('.delete-sequence').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Delete sequence "${sequences[idx].name}"?`)) {
        sequences.splice(idx, 1);
        chrome.storage.local.set({ followUpSequences: sequences }, () => {
          renderSequences(sequences);
          showAlert('general', 'success', 'Sequence deleted');
        });
      }
    });
  });
}

function showSequenceViewer(sequence) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <h3 style="margin: 0 0 20px 0;">📧 ${sequence.name}</h3>

      <div style="margin-bottom: 20px;">
        ${sequence.steps.map((step, i) => `
          <div style="border-left: 3px solid #1a73e8; padding: 12px; margin-bottom: 16px; background: #f8f9fa;">
            <div style="font-weight: 600; margin-bottom: 8px;">
              Step ${i + 1}: Day ${step.delay}
            </div>
            <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">
              <strong>Subject:</strong> ${step.subject}
            </div>
            <div style="font-size: 13px; color: #5f6368; white-space: pre-wrap; background: white; padding: 8px; border-radius: 4px;">
              ${step.body}
            </div>
          </div>
        `).join('')}
      </div>

      <button class="btn btn-primary" onclick="this.closest('div[style*=fixed]').remove()">Close</button>
    </div>
  `;

  document.body.appendChild(modal);
}

function showSequenceEditor(sequence, idx, sequences) {
  const isNew = idx === -1;
  const editSequence = sequence || {
    id: 'seq_' + Date.now(),
    name: '',
    steps: [
      { id: 'step_1', delay: 0, subject: '', body: '' }
    ],
    enrollments: []
  };

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto; padding: 20px;';

  const renderEditor = () => {
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <h3 style="margin: 0 0 20px 0;">${isNew ? 'Create' : 'Edit'} Follow-Up Sequence</h3>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Sequence Name</label>
          <input type="text" id="sequence-name" value="${editSequence.name}" placeholder="e.g., New Lead Nurture" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Email Steps</label>
          <div id="sequence-steps">
            ${editSequence.steps.map((step, i) => `
              <div class="sequence-step" data-idx="${i}" style="border: 1px solid #dadce0; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong>Step ${i + 1}</strong>
                  ${editSequence.steps.length > 1 ? `<button class="btn btn-secondary btn-small remove-step" data-idx="${i}">Remove</button>` : ''}
                </div>

                <div style="margin-bottom: 8px;">
                  <label style="display: block; font-size: 12px; margin-bottom: 4px;">Delay (days after enrollment)</label>
                  <input type="number" class="step-delay" data-idx="${i}" value="${step.delay}" min="0" style="width: 100px; padding: 6px; border: 1px solid #dadce0; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 8px;">
                  <label style="display: block; font-size: 12px; margin-bottom: 4px;">Subject</label>
                  <input type="text" class="step-subject" data-idx="${i}" value="${step.subject}" placeholder="Email subject" style="width: 100%; padding: 6px; border: 1px solid #dadce0; border-radius: 4px;">
                </div>

                <div>
                  <label style="display: block; font-size: 12px; margin-bottom: 4px;">Body</label>
                  <textarea class="step-body" data-idx="${i}" rows="4" placeholder="Email body (use {{name}}, {{company}}, {{email}} for personalization)" style="width: 100%; padding: 6px; border: 1px solid #dadce0; border-radius: 4px; font-family: monospace;">${step.body}</textarea>
                </div>
              </div>
            `).join('')}
          </div>

          <button class="btn btn-secondary" id="add-step">+ Add Step</button>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
          <button class="btn btn-secondary" id="cancel-sequence">Cancel</button>
          <button class="btn btn-primary" id="save-sequence">Save Sequence</button>
        </div>
      </div>
    `;

    // Add step button
    modal.querySelector('#add-step').addEventListener('click', () => {
      editSequence.steps.push({
        id: 'step_' + (editSequence.steps.length + 1),
        delay: editSequence.steps.length,
        subject: '',
        body: ''
      });
      renderEditor();
    });

    // Remove step buttons
    modal.querySelectorAll('.remove-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        editSequence.steps.splice(idx, 1);
        renderEditor();
      });
    });

    // Cancel button
    modal.querySelector('#cancel-sequence').addEventListener('click', () => modal.remove());

    // Save button
    modal.querySelector('#save-sequence').addEventListener('click', () => {
      const name = document.getElementById('sequence-name').value.trim();

      if (!name) {
        alert('Please enter a sequence name');
        return;
      }

      // Collect step data
      const steps = [];
      modal.querySelectorAll('.sequence-step').forEach((stepEl, i) => {
        const delay = parseInt(stepEl.querySelector('.step-delay').value) || 0;
        const subject = stepEl.querySelector('.step-subject').value.trim();
        const body = stepEl.querySelector('.step-body').value.trim();

        if (!subject || !body) {
          alert(`Please fill in subject and body for Step ${i + 1}`);
          return;
        }

        steps.push({
          id: editSequence.steps[i].id,
          delay,
          subject,
          body
        });
      });

      if (steps.length !== editSequence.steps.length) {
        return; // Validation failed
      }

      const sequenceData = {
        id: editSequence.id,
        name,
        steps,
        enrollments: editSequence.enrollments || []
      };

      if (isNew) {
        sequences.push(sequenceData);
      } else {
        sequences[idx] = sequenceData;
      }

      chrome.storage.local.set({ followUpSequences: sequences }, () => {
        renderSequences(sequences);
        modal.remove();
        showAlert('general', 'success', `Sequence ${isNew ? 'created' : 'updated'}!`);
      });
    });
  };

  renderEditor();
  document.body.appendChild(modal);
}

// Add sequence button listener
document.getElementById('add-sequence-btn')?.addEventListener('click', () => {
  chrome.storage.local.get(['followUpSequences'], (result) => {
    const sequences = result.followUpSequences || [];
    showSequenceEditor(null, -1, sequences);
  });
});

// Load sequences when settings page opens
loadSequences();

// ========== Scheduled Exports Management ==========

function loadScheduledExports() {
  chrome.storage.local.get(['scheduledExports', 'exportHistory'], (result) => {
    const schedules = result.scheduledExports || [];
    const history = result.exportHistory || [];
    renderScheduledExports(schedules);
    renderExportHistory(history);
  });
}

function renderScheduledExports(schedules) {
  const container = document.getElementById('scheduled-exports-list');
  if (!container) return;

  if (schedules.length === 0) {
    container.innerHTML = '<p style="color: #5f6368;">No scheduled exports yet. Click "Create Export Schedule" to set one up.</p>';
    return;
  }

  container.innerHTML = schedules.map((schedule, idx) => {
    const nextRun = calculateNextRun(schedule);

    return `
      <div class="export-schedule-item" style="border: 1px solid #dadce0; border-radius: 4px; padding: 16px; margin-bottom: 12px; background: ${schedule.enabled ? 'white' : '#f8f9fa'};">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">
              ${schedule.enabled ? '✅' : '⏸️'} ${schedule.name}
            </div>
            <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">
              <strong>Frequency:</strong> ${schedule.frequency}
            </div>
            <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">
              <strong>Pipeline:</strong> ${schedule.pipelineName || 'All Pipelines'}
            </div>
            <div style="font-size: 13px; color: #5f6368;">
              <strong>Next Run:</strong> ${schedule.enabled ? nextRun : 'Disabled'}
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-left: 12px;">
            <button class="btn btn-secondary btn-small toggle-export" data-idx="${idx}">
              ${schedule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-secondary btn-small run-now-export" data-idx="${idx}">Run Now</button>
            <button class="btn btn-secondary btn-small delete-export" data-idx="${idx}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  container.querySelectorAll('.toggle-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      schedules[idx].enabled = !schedules[idx].enabled;
      chrome.storage.local.set({ scheduledExports: schedules }, () => {
        renderScheduledExports(schedules);
        showAlert('general', 'success', `Export ${schedules[idx].enabled ? 'enabled' : 'disabled'}`);
      });
    });
  });

  container.querySelectorAll('.run-now-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      runExportNow(schedules[idx]);
    });
  });

  container.querySelectorAll('.delete-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (confirm(`Delete export schedule "${schedules[idx].name}"?`)) {
        schedules.splice(idx, 1);
        chrome.storage.local.set({ scheduledExports: schedules }, () => {
          renderScheduledExports(schedules);
          showAlert('general', 'success', 'Export schedule deleted');
        });
      }
    });
  });
}

function calculateNextRun(schedule) {
  const now = new Date();
  const lastRun = schedule.lastRun ? new Date(schedule.lastRun) : new Date(schedule.createdAt);

  let nextRun = new Date(lastRun);

  switch (schedule.frequency) {
    case 'Daily':
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'Weekly':
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case 'Monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
  }

  if (nextRun < now) {
    return 'Overdue';
  }

  const diff = nextRun - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `In ${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `In ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return 'Soon';
  }
}

async function runExportNow(schedule) {
  showAlert('general', 'info', '⏳ Exporting data...');

  // Get deals data from background or content script
  chrome.runtime.sendMessage({ action: 'exportDeals', pipelineId: schedule.pipelineId }, (response) => {
    if (response && response.success) {
      // Create export history entry
      const historyEntry = {
        id: 'export_' + Date.now(),
        scheduleName: schedule.name,
        timestamp: new Date().toISOString(),
        recordCount: response.recordCount || 0,
        csvData: response.csvData
      };

      chrome.storage.local.get(['exportHistory'], (result) => {
        const history = result.exportHistory || [];
        history.unshift(historyEntry);

        // Keep only last 20 exports
        if (history.length > 20) {
          history.splice(20);
        }

        chrome.storage.local.set({ exportHistory: history }, () => {
          renderExportHistory(history);
          downloadCSV(response.csvData, `crm-export-${schedule.name}-${new Date().toISOString().split('T')[0]}.csv`);
          showAlert('general', 'success', `✅ Exported ${response.recordCount} records!`);

          // Update last run time
          chrome.storage.local.get(['scheduledExports'], (result) => {
            const schedules = result.scheduledExports || [];
            const idx = schedules.findIndex(s => s.id === schedule.id);
            if (idx !== -1) {
              schedules[idx].lastRun = new Date().toISOString();
              chrome.storage.local.set({ scheduledExports: schedules }, () => {
                renderScheduledExports(schedules);
              });
            }
          });
        });
      });
    } else {
      showAlert('general', 'error', '❌ Export failed. Make sure you\'re on Gmail.');
    }
  });
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderExportHistory(history) {
  const container = document.getElementById('export-history-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<p>No exports yet.</p>';
    return;
  }

  container.innerHTML = history.slice(0, 10).map(entry => {
    const date = new Date(entry.timestamp).toLocaleString();

    return `
      <div style="padding: 12px; border-bottom: 1px solid #e8eaed; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 500; margin-bottom: 4px;">${entry.scheduleName}</div>
          <div style="font-size: 12px; color: #5f6368;">${date} • ${entry.recordCount} records</div>
        </div>
        <button class="btn btn-secondary btn-small download-export" data-entry='${JSON.stringify(entry).replace(/'/g, "&apos;")}'>
          Download
        </button>
      </div>
    `;
  }).join('');

  // Add download listeners
  container.querySelectorAll('.download-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = JSON.parse(btn.dataset.entry);
      downloadCSV(entry.csvData, `crm-export-${entry.scheduleName}-${entry.timestamp.split('T')[0]}.csv`);
    });
  });
}

function showExportScheduleEditor(schedule, idx, schedules) {
  const isNew = idx === -1;

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%;">
      <h3 style="margin: 0 0 20px 0;">${isNew ? 'Create' : 'Edit'} Export Schedule</h3>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Schedule Name</label>
        <input type="text" id="export-schedule-name" value="${schedule?.name || ''}" placeholder="e.g., Weekly Deals Export" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Frequency</label>
        <select id="export-frequency" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
          <option value="Daily" ${schedule?.frequency === 'Daily' ? 'selected' : ''}>Daily</option>
          <option value="Weekly" ${schedule?.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
          <option value="Monthly" ${schedule?.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
        </select>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Pipeline</label>
        <select id="export-pipeline" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px;">
          <option value="">All Pipelines</option>
          <!-- Pipelines will be loaded dynamically -->
        </select>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" id="cancel-export-schedule">Cancel</button>
        <button class="btn btn-primary" id="save-export-schedule">Save Schedule</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Load pipelines (simplified - in real implementation would fetch from CRM)
  const pipelineSelect = document.getElementById('export-pipeline');
  chrome.runtime.sendMessage({ action: 'getPipelines' }, (response) => {
    if (response && response.pipelines) {
      response.pipelines.forEach(pipeline => {
        const option = document.createElement('option');
        option.value = pipeline.id;
        option.textContent = pipeline.name;
        if (schedule?.pipelineId === pipeline.id) {
          option.selected = true;
        }
        pipelineSelect.appendChild(option);
      });
    }
  });

  modal.querySelector('#cancel-export-schedule').addEventListener('click', () => modal.remove());

  modal.querySelector('#save-export-schedule').addEventListener('click', () => {
    const name = document.getElementById('export-schedule-name').value.trim();
    const frequency = document.getElementById('export-frequency').value;
    const pipelineId = document.getElementById('export-pipeline').value;
    const pipelineName = document.getElementById('export-pipeline').selectedOptions[0].text;

    if (!name) {
      alert('Please enter a schedule name');
      return;
    }

    const scheduleData = {
      id: schedule?.id || 'schedule_' + Date.now(),
      name,
      frequency,
      pipelineId: pipelineId || null,
      pipelineName: pipelineId ? pipelineName : 'All Pipelines',
      enabled: schedule?.enabled !== false,
      createdAt: schedule?.createdAt || new Date().toISOString(),
      lastRun: schedule?.lastRun || null
    };

    if (isNew) {
      schedules.push(scheduleData);
    } else {
      schedules[idx] = scheduleData;
    }

    chrome.storage.local.set({ scheduledExports: schedules }, () => {
      renderScheduledExports(schedules);
      modal.remove();
      showAlert('general', 'success', `Schedule ${isNew ? 'created' : 'updated'}!`);
    });
  });
}

// Add export schedule button listener
document.getElementById('add-export-schedule-btn')?.addEventListener('click', () => {
  chrome.storage.local.get(['scheduledExports'], (result) => {
    const schedules = result.scheduledExports || [];
    showExportScheduleEditor(null, -1, schedules);
  });
});

// Load scheduled exports when settings page opens
loadScheduledExports();

// Initialize
loadSettings();
