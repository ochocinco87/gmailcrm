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

    // Send message to background script to initialize Firebase and sign in
    const response = await chrome.runtime.sendMessage({ action: 'signInWithGoogle' });

    if (response.success) {
      currentUser = response.user;
      await chrome.storage.local.set({ currentUser: response.user });
      updateUserInfo(response.user);
      showAlert('general', 'success', 'Successfully signed in!');
    } else {
      showAlert('general', 'error', response.error || 'Sign-in failed');
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    showAlert('general', 'error', 'Sign-in failed: ' + error.message);
  }
});

// Sign out
document.getElementById('sign-out-btn').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'signOut' });
    currentUser = null;
    await chrome.storage.local.remove('currentUser');
    updateUserInfo(null);
    showAlert('general', 'success', 'Successfully signed out');
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
    const response = await chrome.runtime.sendMessage({ action: 'testFirebaseConnection' });

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

    const response = await chrome.runtime.sendMessage({ action: 'migrateDataToFirebase' });

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
    const response = await chrome.runtime.sendMessage({ action: 'getOrgUsers' });

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
            const response = await chrome.runtime.sendMessage({
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
    const response = await chrome.runtime.sendMessage({ action: 'getOrganization' });

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

    const response = await chrome.runtime.sendMessage({
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

// Initialize
loadSettings();
