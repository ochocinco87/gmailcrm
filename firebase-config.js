// Firebase Configuration and Initialization
// Multi-tenant CRM for Google Workspace domains

class FirebaseService {
  constructor() {
    this.db = null;
    this.auth = null;
    this.currentUser = null;
    this.currentOrg = null;
    this.userRole = null;
    this.unsubscribers = [];
  }

  async initialize() {
    // Firebase will be initialized with config from settings
    // Config should be stored securely per organization
    const config = await this.getFirebaseConfig();

    if (!config) {
      console.log('Firebase: No configuration found. Please configure Firebase in settings.');
      return false;
    }

    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      this.auth = firebase.auth();
      this.db = firebase.firestore();

      // Enable offline persistence
      this.db.enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Firebase: Persistence failed - multiple tabs open');
          } else if (err.code === 'unimplemented') {
            console.warn('Firebase: Persistence not available');
          }
        });

      console.log('Firebase: Initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase: Initialization error:', error);
      return false;
    }
  }

  async getFirebaseConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['firebaseConfig'], (result) => {
        resolve(result.firebaseConfig || null);
      });
    });
  }

  async signInWithGoogle() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        hd: '*', // Allow any domain initially, we'll filter in our code
        prompt: 'select_account'
      });

      const result = await this.auth.signInWithPopup(provider);
      const user = result.user;

      if (!user || !user.email) {
        throw new Error('No user email found');
      }

      // Extract organization from email domain
      const domain = user.email.split('@')[1];

      // For now, we only support medivis.com
      // Later, this will check if the domain has an active subscription
      if (domain !== 'medivis.com') {
        await this.auth.signOut();
        throw new Error(`Domain ${domain} is not authorized. Please contact your administrator.`);
      }

      this.currentUser = user;
      this.currentOrg = domain;

      // Create or update user document in Firestore
      await this.createOrUpdateUser(user, domain);

      // Load user role
      await this.loadUserRole();

      console.log('Firebase: Signed in as', user.email, 'with role', this.userRole);
      return { user, domain, role: this.userRole };

    } catch (error) {
      console.error('Firebase: Sign-in error:', error);
      throw error;
    }
  }

  async createOrUpdateUser(user, domain) {
    const userRef = this.db.collection('organizations').doc(domain)
                           .collection('users').doc(user.email);

    const userDoc = await userRef.get();

    const userData = {
      email: user.email,
      name: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || null,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!userDoc.exists) {
      // New user - assign default role
      // First user is admin, others are viewer by default
      const orgUsers = await this.db.collection('organizations').doc(domain)
                                   .collection('users').get();

      userData.role = orgUsers.empty ? 'admin' : 'viewer';
      userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

      await userRef.set(userData);
      console.log('Firebase: Created new user with role:', userData.role);
    } else {
      // Existing user - update login time and profile
      await userRef.update(userData);
    }

    // Also ensure organization document exists
    const orgRef = this.db.collection('organizations').doc(domain);
    const orgDoc = await orgRef.get();

    if (!orgDoc.exists) {
      await orgRef.set({
        domain: domain,
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        subscription: {
          status: domain === 'medivis.com' ? 'active' : 'trial', // Medivis gets active by default
          plan: 'pro',
          seats: 10,
          seatsUsed: 0
        }
      });
    }
  }

  async loadUserRole() {
    if (!this.currentUser || !this.currentOrg) return null;

    const userDoc = await this.db.collection('organizations').doc(this.currentOrg)
                                .collection('users').doc(this.currentUser.email).get();

    if (userDoc.exists) {
      this.userRole = userDoc.data().role || 'viewer';
      return this.userRole;
    }

    return null;
  }

  async signOut() {
    // Unsubscribe from all listeners
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    await this.auth.signOut();
    this.currentUser = null;
    this.currentOrg = null;
    this.userRole = null;
    console.log('Firebase: Signed out');
  }

  // Permission checks
  canEdit() {
    return this.userRole === 'admin' || this.userRole === 'editor';
  }

  canAdmin() {
    return this.userRole === 'admin';
  }

  isViewer() {
    return this.userRole === 'viewer';
  }

  // Get organization reference
  getOrgRef() {
    if (!this.currentOrg) return null;
    return this.db.collection('organizations').doc(this.currentOrg);
  }

  // Deals CRUD with user tracking
  async createDeal(dealData) {
    if (!this.canEdit()) {
      throw new Error('Permission denied: Only admins and editors can create deals');
    }

    const dealRef = this.getOrgRef().collection('deals').doc();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    const deal = {
      ...dealData,
      id: dealRef.id,
      createdBy: {
        email: this.currentUser.email,
        name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        photoURL: this.currentUser.photoURL
      },
      createdAt: now,
      lastModifiedBy: {
        email: this.currentUser.email,
        name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        photoURL: this.currentUser.photoURL
      },
      lastModifiedAt: now
    };

    await dealRef.set(deal);
    console.log('Firebase: Created deal', dealRef.id);
    return dealRef.id;
  }

  async updateDeal(dealId, updates) {
    if (!this.canEdit()) {
      throw new Error('Permission denied: Only admins and editors can update deals');
    }

    const dealRef = this.getOrgRef().collection('deals').doc(dealId);

    const updateData = {
      ...updates,
      lastModifiedBy: {
        email: this.currentUser.email,
        name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        photoURL: this.currentUser.photoURL
      },
      lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await dealRef.update(updateData);
    console.log('Firebase: Updated deal', dealId);
  }

  async deleteDeal(dealId) {
    if (!this.canEdit()) {
      throw new Error('Permission denied: Only admins and editors can delete deals');
    }

    await this.getOrgRef().collection('deals').doc(dealId).delete();
    console.log('Firebase: Deleted deal', dealId);
  }

  // Add note with author tracking
  async addNote(dealId, noteText) {
    if (!this.canEdit()) {
      throw new Error('Permission denied: Only admins and editors can add notes');
    }

    const dealRef = this.getOrgRef().collection('deals').doc(dealId);

    const note = {
      text: noteText,
      author: {
        email: this.currentUser.email,
        name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        photoURL: this.currentUser.photoURL
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await dealRef.update({
      notesHistory: firebase.firestore.FieldValue.arrayUnion(note),
      lastModifiedBy: {
        email: this.currentUser.email,
        name: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        photoURL: this.currentUser.photoURL
      },
      lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('Firebase: Added note to deal', dealId);
  }

  // Real-time listeners
  subscribeToDeals(callback) {
    if (!this.currentOrg) return null;

    const unsubscribe = this.getOrgRef().collection('deals')
      .onSnapshot((snapshot) => {
        const deals = {};
        snapshot.forEach(doc => {
          deals[doc.id] = { id: doc.id, ...doc.data() };
        });
        callback(deals);
      }, (error) => {
        console.error('Firebase: Deals subscription error:', error);
      });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  subscribeToPipelines(callback) {
    if (!this.currentOrg) return null;

    const unsubscribe = this.getOrgRef().collection('pipelines')
      .onSnapshot((snapshot) => {
        const pipelines = {};
        snapshot.forEach(doc => {
          pipelines[doc.id] = { id: doc.id, ...doc.data() };
        });
        callback(pipelines);
      }, (error) => {
        console.error('Firebase: Pipelines subscription error:', error);
      });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  // User management (admin only)
  async updateUserRole(userEmail, newRole) {
    if (!this.canAdmin()) {
      throw new Error('Permission denied: Only admins can update user roles');
    }

    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role: must be admin, editor, or viewer');
    }

    await this.getOrgRef().collection('users').doc(userEmail).update({
      role: newRole,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('Firebase: Updated role for', userEmail, 'to', newRole);
  }

  async getOrgUsers() {
    if (!this.canAdmin()) {
      throw new Error('Permission denied: Only admins can view all users');
    }

    const snapshot = await this.getOrgRef().collection('users').get();
    const users = [];
    snapshot.forEach(doc => {
      users.push({ email: doc.id, ...doc.data() });
    });
    return users;
  }

  // Migration helper - import existing data to Firestore
  async migrateLocalData(deals, pipelines) {
    if (!this.canAdmin()) {
      throw new Error('Permission denied: Only admins can migrate data');
    }

    const batch = this.db.batch();
    let count = 0;

    // Migrate deals
    for (const dealId in deals) {
      const deal = deals[dealId];
      const dealRef = this.getOrgRef().collection('deals').doc(dealId);

      // Add user tracking to migrated data
      const migratedDeal = {
        ...deal,
        createdBy: {
          email: this.currentUser.email,
          name: this.currentUser.displayName || 'System Migration',
          photoURL: this.currentUser.photoURL
        },
        lastModifiedBy: {
          email: this.currentUser.email,
          name: this.currentUser.displayName || 'System Migration',
          photoURL: this.currentUser.photoURL
        },
        migratedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      batch.set(dealRef, migratedDeal);
      count++;

      // Firestore batch limit is 500
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`Firebase: Migrated ${count} deals...`);
      }
    }

    // Migrate pipelines
    for (const pipelineId in pipelines) {
      const pipeline = pipelines[pipelineId];
      const pipelineRef = this.getOrgRef().collection('pipelines').doc(pipelineId);
      batch.set(pipelineRef, pipeline);
      count++;

      if (count % 500 === 0) {
        await batch.commit();
        console.log(`Firebase: Migrated ${count} items...`);
      }
    }

    await batch.commit();
    console.log(`Firebase: Migration complete. Migrated ${count} items total.`);
    return count;
  }
}

// Export singleton instance
window.firebaseService = new FirebaseService();
