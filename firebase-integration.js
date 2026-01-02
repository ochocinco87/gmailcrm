// Firebase Integration Layer for Gmail CRM
// Provides real-time sync between local storage and Firestore

class FirebaseCRMSync {
  constructor() {
    this.enabled = false;
    this.currentUser = null;
    this.listeners = [];
    this.syncMode = 'local'; // 'local' or 'firebase'
  }

  async initialize() {
    // Check if user is signed in and Firebase is configured
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['currentUser', 'firebaseConfig'], resolve);
    });

    if (result.currentUser && result.firebaseConfig) {
      this.currentUser = result.currentUser;
      this.enabled = true;
      this.syncMode = 'firebase';
      console.log('Firebase sync enabled for', this.currentUser.email);
      return true;
    } else {
      this.syncMode = 'local';
      console.log('Using local storage mode (not signed in)');
      return false;
    }
  }

  // Check if user can edit (admin or editor)
  canEdit() {
    if (!this.currentUser) return true; // Local mode - allow everything
    return this.currentUser.role === 'admin' || this.currentUser.role === 'editor';
  }

  // Check if user is admin
  isAdmin() {
    if (!this.currentUser) return true; // Local mode - allow everything
    return this.currentUser.role === 'admin';
  }

  // Check if user is viewer
  isViewer() {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'viewer';
  }

  // Get current user info for tracking
  getUserInfo() {
    if (!this.currentUser) {
      return {
        email: 'local@user',
        name: 'Local User',
        photoURL: null
      };
    }
    return {
      email: this.currentUser.email,
      name: this.currentUser.name,
      photoURL: this.currentUser.photoURL
    };
  }

  // Wake up service worker with ping before critical operations
  async wakeUpServiceWorker() {
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ action: 'ping' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 1000))
      ]);
      return response && response.success;
    } catch (error) {
      console.warn('Service worker ping failed:', error);
      return false;
    }
  }

  // Load deals - hybrid approach
  async loadDeals() {
    if (this.syncMode === 'firebase' && this.enabled) {
      // Load from Firebase via background script
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({ action: 'getFirebaseDeals' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 2000))
        ]);
        if (response && response.success) {
          return response.deals;
        }
      } catch (error) {
        console.warn('Error loading deals from Firebase, falling back to local:', error);
        // Fall through to local storage
      }
    }

    // Fall back to local storage
    return new Promise(resolve => {
      chrome.storage.local.get(['deals'], (result) => {
        resolve(result.deals || {});
      });
    });
  }

  // Save deal - hybrid approach
  async saveDeal(deal) {
    // Add user tracking
    const userInfo = this.getUserInfo();
    const now = new Date().toISOString();

    if (!deal.createdBy) {
      deal.createdBy = userInfo;
      deal.createdAt = now;
    }

    deal.lastModifiedBy = userInfo;
    deal.lastModifiedAt = now;

    if (this.syncMode === 'firebase' && this.enabled) {
      // Check permissions
      if (!this.canEdit()) {
        throw new Error('You do not have permission to edit deals (viewer role)');
      }

      // Save directly to Firebase REST API (bypass broken background worker)
      try {
        await this.saveToFirestoreDirectly(deal);
        // Also save to local storage for offline access
        await this.saveToLocal('deals', deal.id, deal);
        console.log('✓ Deal saved to Firebase and local storage');
        return deal;
      } catch (error) {
        console.warn('Error saving to Firebase, falling back to local:', error);
        // Fall back to local storage if Firebase fails
        await this.saveToLocal('deals', deal.id, deal);
        return deal;
      }
    } else {
      // Save to local storage
      await this.saveToLocal('deals', deal.id, deal);
      return deal;
    }
  }

  // Save directly to Firestore using REST API (bypasses background worker)
  async saveToFirestoreDirectly(deal) {
    const config = await new Promise(resolve => {
      chrome.storage.local.get(['firebaseConfig'], (result) => resolve(result.firebaseConfig));
    });

    if (!config) {
      throw new Error('Firebase not configured');
    }

    // Get OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
          reject(new Error('Not authenticated'));
        } else {
          resolve(token);
        }
      });
    });

    // Convert deal to Firestore format
    const firestoreDoc = this.convertToFirestoreFormat(deal);

    const path = `organizations/${this.currentUser.domain}/deals/${deal.id}`;
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: firestoreDoc })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firestore save failed: ${error}`);
    }

    return deal;
  }

  // Convert JavaScript object to Firestore document format
  convertToFirestoreFormat(obj) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { doubleValue: value };
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(v => {
              if (typeof v === 'object') {
                return { mapValue: { fields: this.convertToFirestoreFormat(v) } };
              }
              return { stringValue: String(v) };
            })
          }
        };
      } else if (typeof value === 'object') {
        fields[key] = { mapValue: { fields: this.convertToFirestoreFormat(value) } };
      }
    }
    return fields;
  }

  // Delete deal
  async deleteDeal(dealId) {
    if (this.syncMode === 'firebase' && this.enabled) {
      // Check permissions
      if (!this.canEdit()) {
        throw new Error('You do not have permission to delete deals (viewer role)');
      }

      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({
            action: 'deleteFirebaseDeal',
            dealId: dealId
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 2000))
        ]);

        if (response.success) {
          await this.deleteFromLocal('deals', dealId);
          return true;
        } else {
          throw new Error(response.error || 'Failed to delete from Firebase');
        }
      } catch (error) {
        console.warn('Error deleting from Firebase, falling back to local:', error);
        // Fall back to local storage if Firebase fails
        await this.deleteFromLocal('deals', dealId);
        return true;
      }
    } else {
      await this.deleteFromLocal('deals', dealId);
      return true;
    }
  }

  // Load pipelines
  async loadPipelines() {
    if (this.syncMode === 'firebase' && this.enabled) {
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({ action: 'getFirebasePipelines' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 2000))
        ]);
        if (response && response.success) {
          return response.pipelines;
        }
      } catch (error) {
        console.warn('Error loading pipelines from Firebase, falling back to local:', error);
        // Fall through to local storage
      }
    }

    return new Promise(resolve => {
      chrome.storage.local.get(['pipelines'], (result) => {
        resolve(result.pipelines || []);
      });
    });
  }

  // Save pipeline
  async savePipeline(pipeline) {
    if (this.syncMode === 'firebase' && this.enabled) {
      if (!this.canEdit()) {
        throw new Error('You do not have permission to edit pipelines (viewer role)');
      }

      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({
            action: 'saveFirebasePipeline',
            pipeline: pipeline
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Background script timeout')), 2000))
        ]);

        if (response.success) {
          await this.saveToLocal('pipelines', pipeline.id, pipeline);
          return pipeline;
        } else {
          throw new Error(response.error || 'Failed to save pipeline to Firebase');
        }
      } catch (error) {
        console.warn('Error saving pipeline to Firebase, falling back to local:', error);
        // Fall back to local storage if Firebase fails
        await this.saveToLocal('pipelines', pipeline.id, pipeline);
        return pipeline;
      }
    } else {
      await this.saveToLocal('pipelines', pipeline.id, pipeline);
      return pipeline;
    }
  }

  // Helper: Save to local storage
  async saveToLocal(collection, id, item) {
    return new Promise(resolve => {
      chrome.storage.local.get([collection], (result) => {
        const items = result[collection] || (collection === 'pipelines' ? [] : {});

        if (collection === 'pipelines') {
          // Pipelines is an array
          const index = items.findIndex(p => p.id === id);
          if (index >= 0) {
            items[index] = item;
          } else {
            items.push(item);
          }
        } else {
          // Deals is an object
          items[id] = item;
        }

        chrome.storage.local.set({ [collection]: items }, resolve);
      });
    });
  }

  // Helper: Delete from local storage
  async deleteFromLocal(collection, id) {
    return new Promise(resolve => {
      chrome.storage.local.get([collection], (result) => {
        const items = result[collection] || {};

        if (collection === 'pipelines') {
          const index = items.findIndex(p => p.id === id);
          if (index >= 0) {
            items.splice(index, 1);
          }
        } else {
          delete items[id];
        }

        chrome.storage.local.set({ [collection]: items }, resolve);
      });
    });
  }

  // Subscribe to real-time deal updates
  subscribeToDeals(callback) {
    if (this.syncMode === 'firebase' && this.enabled) {
      // Set up listener for Firebase updates via background script
      const listener = (message) => {
        if (message.action === 'firebaseDealsUpdated') {
          callback(message.deals);
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      this.listeners.push(listener);

      // Request background script to start listening
      chrome.runtime.sendMessage({ action: 'subscribeToFirebaseDeals' });
    } else {
      // Listen to local storage changes
      const listener = (changes, areaName) => {
        if (areaName === 'local' && changes.deals) {
          callback(changes.deals.newValue || {});
        }
      };

      chrome.storage.onChanged.addListener(listener);
      this.listeners.push(listener);
    }
  }

  // Subscribe to real-time pipeline updates
  subscribeToPipelines(callback) {
    if (this.syncMode === 'firebase' && this.enabled) {
      const listener = (message) => {
        if (message.action === 'firebasePipelinesUpdated') {
          callback(message.pipelines);
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      this.listeners.push(listener);

      chrome.runtime.sendMessage({ action: 'subscribeToFirebasePipelines' });
    } else {
      const listener = (changes, areaName) => {
        if (areaName === 'local' && changes.pipelines) {
          callback(changes.pipelines.newValue || []);
        }
      };

      chrome.storage.onChanged.addListener(listener);
      this.listeners.push(listener);
    }
  }

  // Cleanup listeners
  cleanup() {
    this.listeners.forEach(listener => {
      chrome.runtime.onMessage.removeListener(listener);
      chrome.storage.onChanged.removeListener(listener);
    });
    this.listeners = [];
  }

  // Show permission error to user
  showPermissionError(action = 'perform this action') {
    const message = `You do not have permission to ${action}. Your role is "${this.currentUser?.role || 'unknown'}". Please contact an admin to change your role.`;

    // Create alert
    const alert = document.createElement('div');
    alert.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #fce8e6;
      color: #c5221f;
      padding: 16px 24px;
      border-radius: 8px;
      border-left: 4px solid #d93025;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 100000;
      font-size: 14px;
      max-width: 400px;
    `;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  // Get role badge HTML
  getRoleBadgeHTML() {
    if (!this.currentUser) return '';

    const roleColors = {
      admin: '#1967d2',
      editor: '#137333',
      viewer: '#b06000'
    };

    const roleBg = {
      admin: '#e8f0fe',
      editor: '#e6f4ea',
      viewer: '#fef7e0'
    };

    const role = this.currentUser.role;

    return `
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: ${roleBg[role]}; color: ${roleColors[role]}; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
        <span>${role}</span>
      </div>
    `;
  }

  // Get user badge HTML (for showing who created/modified)
  getUserBadgeHTML(userInfo) {
    if (!userInfo) return '<span style="color: #5f6368;">Unknown</span>';

    const photoHTML = userInfo.photoURL
      ? `<img src="${userInfo.photoURL}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 6px;">`
      : `<span style="width: 20px; height: 20px; border-radius: 50%; background: #1a73e8; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; margin-right: 6px;">${userInfo.name?.charAt(0) || '?'}</span>`;

    return `
      <div style="display: inline-flex; align-items: center; font-size: 12px; color: #5f6368;">
        ${photoHTML}
        <span>${userInfo.name || userInfo.email}</span>
      </div>
    `;
  }
}

// Export singleton instance
window.firebaseCRMSync = new FirebaseCRMSync();
