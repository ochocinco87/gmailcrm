// Gmail CRM Content Script - Injects CRM functionality into Gmail

class GmailCRM {
  constructor() {
    this.initialized = false;
    this.currentThreadId = null;
    this.sidebar = null;
    this.observerActive = false;
  }

  // Initialize the CRM
  async init() {
    if (this.initialized) return;

    console.log('Gmail CRM: Initializing...');

    // Wait for Gmail to load
    await this.waitForGmail();

    // Inject sidebar
    this.injectSidebar();

    // Monitor for email thread changes
    this.observeEmailChanges();

    this.initialized = true;
    console.log('Gmail CRM: Initialized successfully');
  }

  // Wait for Gmail's UI to be ready
  waitForGmail() {
    return new Promise((resolve) => {
      const checkGmail = setInterval(() => {
        // Check if Gmail's main view is loaded
        const gmailView = document.querySelector('div[role="main"]');
        if (gmailView) {
          clearInterval(checkGmail);
          resolve();
        }
      }, 500);
    });
  }

  // Inject the CRM sidebar into Gmail
  injectSidebar() {
    // Find Gmail's right sidebar area or create our own
    const gmailBody = document.body;

    // Create sidebar container
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'gmail-crm-sidebar';
    this.sidebar.className = 'gmail-crm-sidebar';

    // Initial content
    this.sidebar.innerHTML = `
      <div class="crm-sidebar-header">
        <h3>Gmail CRM</h3>
        <button id="crm-close-btn" title="Toggle CRM">−</button>
      </div>
      <div class="crm-sidebar-content">
        <div class="crm-loading">
          <p>Select an email to view details</p>
        </div>
      </div>
    `;

    gmailBody.appendChild(this.sidebar);

    // Add toggle functionality
    document.getElementById('crm-close-btn')?.addEventListener('click', () => {
      this.sidebar.classList.toggle('collapsed');
    });

    // Add floating action button to create deals quickly
    this.injectFloatingButton();
  }

  // Add a floating action button
  injectFloatingButton() {
    const fab = document.createElement('div');
    fab.id = 'gmail-crm-fab';
    fab.className = 'gmail-crm-fab';
    fab.innerHTML = `
      <button id="crm-add-deal-btn" title="Add to Pipeline">
        <span>+</span>
      </button>
    `;

    document.body.appendChild(fab);

    document.getElementById('crm-add-deal-btn')?.addEventListener('click', () => {
      this.showAddDealModal();
    });
  }

  // Observe changes in Gmail to detect when user opens different emails
  observeEmailChanges() {
    if (this.observerActive) return;

    // Use MutationObserver to detect URL changes (Gmail is a SPA)
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onUrlChange();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for popstate events
    window.addEventListener('popstate', () => this.onUrlChange());

    this.observerActive = true;
  }

  // Handle URL changes (email thread changes)
  onUrlChange() {
    const threadId = this.extractThreadId();

    if (threadId && threadId !== this.currentThreadId) {
      this.currentThreadId = threadId;
      this.loadThreadData(threadId);
    } else if (!threadId) {
      this.currentThreadId = null;
      this.showDefaultView();
    }
  }

  // Extract thread ID from Gmail URL
  extractThreadId() {
    const match = location.href.match(/\/mail\/u\/\d+\/#inbox\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  // Load CRM data for a specific thread
  async loadThreadData(threadId) {
    const sidebarContent = this.sidebar.querySelector('.crm-sidebar-content');

    sidebarContent.innerHTML = `
      <div class="crm-thread-info">
        <h4>Email Thread</h4>
        <p class="thread-id">ID: ${threadId}</p>

        <div class="crm-section">
          <h5>Pipeline</h5>
          <select id="crm-pipeline-select" class="crm-select">
            <option value="">Select pipeline...</option>
          </select>
        </div>

        <div class="crm-section">
          <h5>Stage</h5>
          <select id="crm-stage-select" class="crm-select">
            <option value="">Select stage...</option>
          </select>
        </div>

        <div class="crm-section">
          <h5>Contact Info</h5>
          <div id="crm-contact-info">
            <p class="crm-subtitle">Loading contact...</p>
          </div>
        </div>

        <div class="crm-section">
          <h5>Notes</h5>
          <textarea id="crm-notes" class="crm-textarea" placeholder="Add notes about this conversation..."></textarea>
          <button id="crm-save-notes" class="crm-btn">Save Notes</button>
        </div>

        <div class="crm-section">
          <h5>Deal Value</h5>
          <input type="number" id="crm-deal-value" class="crm-input" placeholder="$0" />
        </div>

        <div class="crm-section">
          <button id="crm-create-deal" class="crm-btn crm-btn-primary">Create Deal</button>
        </div>
      </div>
    `;

    // Load data from storage
    await this.populatePipelines();
    await this.loadDealData(threadId);

    // Add event listeners
    this.attachEventListeners(threadId);
  }

  // Show default view when no email is selected
  showDefaultView() {
    const sidebarContent = this.sidebar.querySelector('.crm-sidebar-content');
    sidebarContent.innerHTML = `
      <div class="crm-loading">
        <p>Select an email to view CRM details</p>
        <button id="crm-manage-pipelines" class="crm-btn crm-btn-primary">Manage Pipelines</button>
      </div>
    `;

    document.getElementById('crm-manage-pipelines')?.addEventListener('click', () => {
      this.showPipelineManager();
    });
  }

  // Populate pipeline dropdown
  async populatePipelines() {
    const pipelines = await this.getPipelines();
    const pipelineSelect = document.getElementById('crm-pipeline-select');

    if (pipelineSelect) {
      pipelines.forEach(pipeline => {
        const option = document.createElement('option');
        option.value = pipeline.id;
        option.textContent = pipeline.name;
        pipelineSelect.appendChild(option);
      });

      // Listen for pipeline changes to update stages
      pipelineSelect.addEventListener('change', (e) => {
        this.updateStages(e.target.value);
      });
    }
  }

  // Update stage dropdown based on selected pipeline
  async updateStages(pipelineId) {
    const pipelines = await this.getPipelines();
    const pipeline = pipelines.find(p => p.id === pipelineId);
    const stageSelect = document.getElementById('crm-stage-select');

    if (stageSelect && pipeline) {
      stageSelect.innerHTML = '<option value="">Select stage...</option>';

      pipeline.stages.forEach(stage => {
        const option = document.createElement('option');
        option.value = stage.id;
        option.textContent = stage.name;
        stageSelect.appendChild(option);
      });
    }
  }

  // Get pipelines from storage
  async getPipelines() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['pipelines'], (result) => {
        const pipelines = result.pipelines || this.getDefaultPipelines();
        resolve(pipelines);
      });
    });
  }

  // Default pipelines
  getDefaultPipelines() {
    return [
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
      }
    ];
  }

  // Load existing deal data for thread
  async loadDealData(threadId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['deals'], (result) => {
        const deals = result.deals || {};
        const dealData = deals[threadId];

        if (dealData) {
          // Populate form with existing data
          const pipelineSelect = document.getElementById('crm-pipeline-select');
          const stageSelect = document.getElementById('crm-stage-select');
          const notesTextarea = document.getElementById('crm-notes');
          const dealValueInput = document.getElementById('crm-deal-value');

          if (pipelineSelect) pipelineSelect.value = dealData.pipelineId || '';
          if (dealData.pipelineId) this.updateStages(dealData.pipelineId);
          setTimeout(() => {
            if (stageSelect) stageSelect.value = dealData.stageId || '';
          }, 100);
          if (notesTextarea) notesTextarea.value = dealData.notes || '';
          if (dealValueInput) dealValueInput.value = dealData.value || '';
        }

        resolve();
      });
    });
  }

  // Attach event listeners for the sidebar
  attachEventListeners(threadId) {
    const saveNotesBtn = document.getElementById('crm-save-notes');
    const createDealBtn = document.getElementById('crm-create-deal');

    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', () => this.saveNotes(threadId));
    }

    if (createDealBtn) {
      createDealBtn.addEventListener('click', () => this.saveDeal(threadId));
    }
  }

  // Save notes for a thread
  async saveNotes(threadId) {
    const notesTextarea = document.getElementById('crm-notes');
    const notes = notesTextarea?.value || '';

    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      deals[threadId] = deals[threadId] || {};
      deals[threadId].notes = notes;
      deals[threadId].lastUpdated = new Date().toISOString();

      chrome.storage.local.set({ deals }, () => {
        this.showNotification('Notes saved successfully!');
      });
    });
  }

  // Save deal information
  async saveDeal(threadId) {
    const pipelineSelect = document.getElementById('crm-pipeline-select');
    const stageSelect = document.getElementById('crm-stage-select');
    const notesTextarea = document.getElementById('crm-notes');
    const dealValueInput = document.getElementById('crm-deal-value');

    const dealData = {
      threadId,
      pipelineId: pipelineSelect?.value,
      stageId: stageSelect?.value,
      notes: notesTextarea?.value || '',
      value: dealValueInput?.value || 0,
      lastUpdated: new Date().toISOString(),
      emailSubject: this.extractEmailSubject(),
      contactEmail: this.extractContactEmail()
    };

    chrome.storage.local.get(['deals'], (result) => {
      const deals = result.deals || {};
      deals[threadId] = dealData;

      chrome.storage.local.set({ deals }, () => {
        this.showNotification('Deal saved successfully!');
      });
    });
  }

  // Extract email subject from Gmail UI
  extractEmailSubject() {
    const subjectElement = document.querySelector('h2.hP');
    return subjectElement?.textContent || 'Unknown Subject';
  }

  // Extract contact email from Gmail UI
  extractContactEmail() {
    const emailElement = document.querySelector('span.gD');
    return emailElement?.getAttribute('email') || 'unknown@email.com';
  }

  // Show notification
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'crm-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Show add deal modal
  showAddDealModal() {
    // Quick modal for adding current email to a pipeline
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h3>Add to Pipeline</h3>
        <p>Add current email thread to a pipeline</p>
        <button id="crm-modal-add" class="crm-btn crm-btn-primary">Add to Pipeline</button>
        <button id="crm-modal-cancel" class="crm-btn">Cancel</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-modal-add')?.addEventListener('click', () => {
      if (this.currentThreadId) {
        this.saveDeal(this.currentThreadId);
      }
      modal.remove();
    });

    document.getElementById('crm-modal-cancel')?.addEventListener('click', () => {
      modal.remove();
    });
  }

  // Show pipeline manager
  showPipelineManager() {
    alert('Pipeline manager coming soon! Use the popup to manage pipelines.');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const crm = new GmailCRM();
    crm.init();
  });
} else {
  const crm = new GmailCRM();
  crm.init();
}
