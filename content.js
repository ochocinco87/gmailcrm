// Gmail CRM Content Script - Full Streak-like integration

class GmailCRM {
  constructor() {
    this.initialized = false;
    this.currentPipeline = null;
    this.pipelinesNav = null;
    this.pipelineView = null;
    this.deals = {};
    this.pipelines = [];
    this.filters = {
      search: '',
      status: '',
      priority: '',
      sortBy: 'date'
    };
    this.automationRules = [];
    this.followUpSequences = [];
    this.contactEnrichmentEnabled = true;

    // Make gmailCRM globally accessible immediately
    window.gmailCRM = this;
  }

  async init() {
    if (this.initialized) return;
    console.log('Gmail CRM: Initializing...');

    await this.waitForGmail();
    await this.loadData();

    // Inject pipelines into left sidebar
    this.injectPipelinesNav();

    // Monitor for navigation
    this.observeNavigation();

    // Monitor for email views to inject link UI
    this.observeEmailView();

    // Inject floating voice assistant
    this.injectVoiceAssistant();

    // Inject visual execution sidebar
    this.injectVisualExecutionSidebar();

    // Inject development helper
    this.injectDevHelper();

    this.initialized = true;
    console.log('Gmail CRM: Initialized successfully');
  }

  waitForGmail() {
    return new Promise((resolve) => {
      console.log('Gmail CRM: Waiting for Gmail to load...');
      let attempts = 0;
      const checkGmail = setInterval(() => {
        attempts++;
        const leftNav = document.querySelector('div[role="navigation"]');
        console.log(`Gmail CRM: Attempt ${attempts}, found navigation:`, !!leftNav);

        if (leftNav) {
          console.log('Gmail CRM: Gmail navigation found!', leftNav);
          clearInterval(checkGmail);
          resolve();
        }

        // Timeout after 20 seconds
        if (attempts > 40) {
          console.error('Gmail CRM: Timeout waiting for Gmail navigation');
          clearInterval(checkGmail);
          resolve(); // Resolve anyway to continue
        }
      }, 500);
    });
  }

  async loadData() {
    // Initialize Firebase sync
    await window.firebaseCRMSync.initialize();

    // Load deals from Firebase or local storage
    this.deals = await window.firebaseCRMSync.loadDeals();

    // Load pipelines from Firebase or local storage
    const pipelines = await window.firebaseCRMSync.loadPipelines();
    this.pipelines = pipelines.length > 0 ? pipelines : this.getDefaultPipelines();

    // Load view mode from local storage
    const viewModeResult = await new Promise(resolve => {
      chrome.storage.local.get(['pipelineViewMode'], resolve);
    });
    this.pipelineViewMode = viewModeResult.pipelineViewMode || 'table';

    // Load automation rules from local storage
    const automationResult = await new Promise(resolve => {
      chrome.storage.local.get(['automationRules'], resolve);
    });
    this.automationRules = automationResult.automationRules || this.getDefaultAutomationRules();

    // Load follow-up sequences from local storage
    const sequencesResult = await new Promise(resolve => {
      chrome.storage.local.get(['followUpSequences'], resolve);
    });
    this.followUpSequences = sequencesResult.followUpSequences || [];

    // Save default pipelines if none exist
    if (pipelines.length === 0) {
      for (const pipeline of this.pipelines) {
        await window.firebaseCRMSync.savePipeline(pipeline);
      }
    }

      console.log('Gmail CRM: Loaded data -', Object.keys(this.deals).length, 'deals,', this.pipelines.length, 'pipelines');
    console.log('Gmail CRM: Sync mode:', window.firebaseCRMSync.syncMode);

    // Set up real-time sync listeners
    this.setupRealtimeSync();
  }

  setupRealtimeSync() {
    // Subscribe to deals updates
    window.firebaseCRMSync.subscribeToDeals((deals) => {
      console.log('Gmail CRM: Received deals update from Firebase');
      this.deals = deals;
      if (this.currentPipeline) {
        this.renderPipelineBoard();
      }
    });

    // Subscribe to pipelines updates
    window.firebaseCRMSync.subscribeToPipelines((pipelines) => {
      console.log('Gmail CRM: Received pipelines update from Firebase');
      this.pipelines = pipelines;
      if (this.currentPipeline) {
        this.renderPipelineBoard();
      }
    });
  }

  async saveDeal(deal) {
    try {
      await window.firebaseCRMSync.saveDeal(deal);
      this.deals[deal.id] = deal;
    } catch (error) {
      console.error('Error saving deal:', error);
      if (error.message.includes('permission')) {
        window.firebaseCRMSync.showPermissionError('edit deals');
      } else {
        this.showNotification('❌ Error saving deal: ' + error.message);
      }
      throw error;
    }
  }

  async deleteDeal(dealId) {
    try {
      await window.firebaseCRMSync.deleteDeal(dealId);
      delete this.deals[dealId];
    } catch (error) {
      console.error('Error deleting deal:', error);
      if (error.message.includes('permission')) {
        window.firebaseCRMSync.showPermissionError('delete deals');
      } else {
        this.showNotification('❌ Error deleting deal: ' + error.message);
      }
      throw error;
    }
  }

  getDefaultPipelines() {
    return [
      {
        id: 'surgicalAR',
        name: 'SurgicalAR',
        stages: [
          { id: 'pending-renewal', name: 'Pending Renewal', color: '#db4437' },
          { id: 'current', name: 'Current', color: '#9c27b0' },
          { id: 'upsell', name: 'Upsell', color: '#ff9800' },
          { id: 'contract-sent', name: 'Contract Sent', color: '#ff6f00' },
          { id: 'trial', name: 'Trial', color: '#8bc34a' },
          { id: 'negotiating', name: 'Negotiating', color: '#4caf50' },
          { id: 'limbo', name: 'Limbo', color: '#009688' },
          { id: 'proposal-sent', name: 'Proposal Sent', color: '#00bcd4' },
          { id: 'onsite-demo-1', name: 'Onsite Demo...', color: '#03a9f4' },
          { id: 'onsite-demo-2', name: 'Onsite Demo...', color: '#2196f3' },
          { id: 'onsite-demo-3', name: 'Onsite Demo...', color: '#7e57c2' }
        ]
      },
      {
        id: 'customer-adoption',
        name: 'Customer Adoption',
        type: 'customer-tracking',
        stages: [
          { id: 'onboarding', name: 'Onboarding', color: '#4285f4' },
          { id: 'early-adoption', name: 'Early Adoption (1-10 cases)', color: '#7baaf7' },
          { id: 'active-usage', name: 'Active Usage (11-50 cases)', color: '#34a853' },
          { id: 'power-user', name: 'Power User (50+ cases)', color: '#0f9d58' },
          { id: 'at-risk', name: 'At Risk', color: '#f4b400' },
          { id: 'churned', name: 'Churned', color: '#db4437' }
        ]
      },
      {
        id: 'sales',
        name: 'Sales Pipeline',
        stages: [
          { id: 'lead', name: 'Lead', color: '#f4b400' },
          { id: 'contacted', name: 'Contacted', color: '#4285f4' },
          { id: 'qualified', name: 'Qualified', color: '#34a853' },
          { id: 'proposal', name: 'Proposal', color: '#9c27b0' },
          { id: 'negotiation', name: 'Negotiation', color: '#ff6f00' },
          { id: 'closed-won', name: 'Closed Won', color: '#0f9d58' },
          { id: 'closed-lost', name: 'Closed Lost', color: '#db4437' }
        ]
      },
      {
        id: 'institutions',
        name: 'Institutions Directory',
        type: 'institution-directory',
        stages: [
          { id: 'all', name: 'All Institutions', color: '#4285f4' }
        ]
      }
    ];
  }

  injectPipelinesNav() {
    // Find Gmail's left navigation
    const leftNav = document.querySelector('div[role="navigation"]');
    console.log('Gmail CRM: Attempting to inject pipelines nav, found leftNav:', !!leftNav);

    if (!leftNav) {
      console.error('Gmail CRM: Cannot find left navigation div[role="navigation"]');

      // Try alternative selectors
      const altNav = document.querySelector('nav');
      console.log('Gmail CRM: Alternative nav element:', !!altNav);

      return;
    }

    console.log('Gmail CRM: Left nav element:', leftNav);

    // Create pipelines section
    this.pipelinesNav = document.createElement('div');
    this.pipelinesNav.id = 'crm-pipelines-nav';
    this.pipelinesNav.className = 'crm-pipelines-section';

    this.pipelinesNav.innerHTML = `
      <div class="crm-nav-header">
        <span class="crm-nav-title">Pipelines</span>
        <button class="crm-nav-add" title="Add Pipeline">+</button>
      </div>
      <div class="crm-nav-list" id="crm-pipelines-list"></div>
      <div class="crm-sync-section">
        <button class="crm-sync-btn" id="crm-sync-emails-btn" title="Basic email sync">
          📧 Sync Emails
        </button>
        <button class="crm-sync-btn-smart" id="crm-smart-sync-btn" title="AI-powered smart sync with Gemini">
          🤖 Smart Sync
        </button>
        <button class="crm-settings-btn" id="crm-gemini-settings-btn" title="Gemini API Settings">
          ⚙️
        </button>
      </div>
    `;

    // Insert after Labels section or at the end
    const labelsSection = leftNav.querySelector('div[data-tooltip="Labels"]')?.closest('.aAw, .Tma');
    console.log('Gmail CRM: Found labels section:', !!labelsSection);

    if (labelsSection && labelsSection.parentElement) {
      labelsSection.parentElement.insertBefore(this.pipelinesNav, labelsSection.nextSibling);
      console.log('Gmail CRM: Inserted pipelines nav after labels');
    } else {
      leftNav.appendChild(this.pipelinesNav);
      console.log('Gmail CRM: Appended pipelines nav to left nav');
    }

    console.log('Gmail CRM: Pipelines nav injected successfully!', this.pipelinesNav);

    this.renderPipelinesList();

    // Add pipeline button
    this.pipelinesNav.querySelector('.crm-nav-add')?.addEventListener('click', () => {
      this.showPipelineEditor();
    });

    // Sync emails button
    this.pipelinesNav.querySelector('#crm-sync-emails-btn')?.addEventListener('click', () => {
      this.syncEmailsToDeals();
    });

    // Smart sync with Gemini button
    this.pipelinesNav.querySelector('#crm-smart-sync-btn')?.addEventListener('click', () => {
      this.smartSyncWithGemini();
    });

    // Gemini settings button
    this.pipelinesNav.querySelector('#crm-gemini-settings-btn')?.addEventListener('click', () => {
      this.showGeminiSettings();
    });
  }

  renderPipelinesList() {
    const list = document.getElementById('crm-pipelines-list');
    if (!list) return;

    list.innerHTML = '';

    this.pipelines.forEach(pipeline => {
      const item = document.createElement('div');
      item.className = 'crm-nav-item';
      item.dataset.pipelineId = pipeline.id;

      if (this.currentPipeline?.id === pipeline.id) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <span class="crm-nav-icon">📊</span>
        <span class="crm-nav-name">${pipeline.name}</span>
      `;

      item.addEventListener('click', () => {
        this.openPipeline(pipeline);
      });

      list.appendChild(item);
    });
  }

  openPipeline(pipeline) {
    this.currentPipeline = pipeline;

    // Update active state
    document.querySelectorAll('.crm-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-pipeline-id="${pipeline.id}"]`)?.classList.add('active');

    // Hide Gmail inbox and show pipeline view
    this.showPipelineView();

    // Update URL
    window.history.pushState({}, '', `#crm/pipeline/${pipeline.id}`);
  }

  showPipelineView() {
    // Hide Gmail's main content
    const gmailMain = document.querySelector('div[role="main"]');
    if (gmailMain) {
      gmailMain.style.display = 'none';
    }

    // Remove existing pipeline view
    const existing = document.getElementById('crm-pipeline-view');
    if (existing) {
      existing.remove();
    }

    // Create pipeline view
    this.pipelineView = document.createElement('div');
    this.pipelineView.id = 'crm-pipeline-view';
    this.pipelineView.className = 'crm-pipeline-container';

    // Insert pipeline view
    const parent = gmailMain?.parentElement || document.body;
    parent.appendChild(this.pipelineView);

    this.renderPipelineBoard();
  }

  renderPipelineBoard() {
    if (!this.currentPipeline || !this.pipelineView) return;

    const pipeline = this.currentPipeline;

    // Use custom rendering for institution directory
    if (pipeline.type === 'institution-directory') {
      this.renderInstitutionsDirectory();
      return;
    }

    const dealsInPipeline = this.getDealsInPipeline(pipeline.id);

    // Calculate stage counts
    const stageCounts = {};
    pipeline.stages.forEach(stage => {
      stageCounts[stage.id] = dealsInPipeline.filter(d => d.stageId === stage.id).length;
    });

    // Create header with stage indicators
    const stagesHeader = pipeline.stages.map(stage => `
      <div class="crm-stage-header" style="background-color: ${stage.color};" data-stage-id="${stage.id}">
        <span class="crm-stage-count">${stageCounts[stage.id] || 0}</span>
        <span class="crm-stage-name">${stage.name}</span>
      </div>
    `).join('');

    // Initialize view mode if not set
    if (!this.pipelineViewMode) {
      this.pipelineViewMode = 'table'; // default to table view
    }

    this.pipelineView.innerHTML = `
      <div class="crm-pipeline-header">
        <div class="crm-pipeline-title">
          <h1>${pipeline.name}</h1>
          <span class="crm-deal-count">${dealsInPipeline.length} ${pipeline.type === 'customer-tracking' ? 'Customer Sites' : 'Deals'}</span>
        </div>
        <div class="crm-pipeline-actions">
          <div class="crm-view-toggle">
            <button class="crm-view-btn ${this.pipelineViewMode === 'table' ? 'active' : ''}" id="crm-table-view-btn" title="Table View">
              ☰
            </button>
            <button class="crm-view-btn ${this.pipelineViewMode === 'kanban' ? 'active' : ''}" id="crm-kanban-view-btn" title="Kanban View">
              ▦
            </button>
            <button class="crm-view-btn ${this.pipelineViewMode === 'map' ? 'active' : ''}" id="crm-map-view-btn" title="Map View">
              🗺️
            </button>
            <button class="crm-view-btn ${this.pipelineViewMode === 'dashboard' ? 'active' : ''}" id="crm-dashboard-view-btn" title="Analytics Dashboard">
              📊
            </button>
          </div>
          ${pipeline.type === 'customer-tracking' ? '<button class="crm-btn" id="crm-dashboard-btn">📊 Dashboard</button>' : ''}
          <button class="crm-btn" id="crm-refresh-btn">🔄 Refresh</button>
          <button class="crm-btn" id="crm-settings-btn">⚙️ Settings</button>
          <button class="crm-btn" id="crm-share-btn">🔗 Share</button>
          <button class="crm-btn-primary" id="crm-add-deal-btn">+ Add ${pipeline.type === 'customer-tracking' ? 'Customer Site' : 'Deal'}</button>
        </div>
      </div>

      <div class="crm-filters-bar">
        <div class="crm-search-box">
          <input type="text" id="crm-search-input" class="crm-search-input" placeholder="🔍 Search deals..." />
        </div>
        <div class="crm-filter-controls">
          <select id="crm-filter-status" class="crm-filter-select">
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>
          <select id="crm-filter-priority" class="crm-filter-select">
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select id="crm-sort-by" class="crm-filter-select">
            <option value="date">Sort: Last Updated</option>
            <option value="value-desc">Sort: Value (High to Low)</option>
            <option value="value-asc">Sort: Value (Low to High)</option>
            <option value="age">Sort: Deal Age</option>
            <option value="name">Sort: Name (A-Z)</option>
          </select>
          <button class="crm-btn-small" id="crm-clear-filters">Clear Filters</button>
        </div>
      </div>

      <div class="crm-stages-bar">
        ${stagesHeader}
      </div>

      <div class="crm-main-layout">
        <div class="crm-deals-table-container" id="crm-table-view" style="display: ${this.pipelineViewMode === 'table' ? 'block' : 'none'};">
          <table class="crm-deals-table">
            <thead>
              <tr>
                <th class="crm-th-checkbox"><input type="checkbox" /></th>
                <th class="crm-th-name">Name</th>
                <th class="crm-th-status">Status</th>
                <th class="crm-th-priority">Priority</th>
                <th class="crm-th-value">Deal Size</th>
                <th class="crm-th-prob">Prob</th>
                <th class="crm-th-weighted">Weighted $</th>
                <th class="crm-th-contact">Contact</th>
                <th class="crm-th-company">Company</th>
                <th class="crm-th-age">Age</th>
                <th class="crm-th-last-activity">Last Activity</th>
                <th class="crm-th-assigned">Assigned To</th>
              </tr>
            </thead>
            <tbody id="crm-deals-tbody"></tbody>
          </table>
        </div>

        <div class="crm-kanban-view" id="crm-kanban-view" style="display: ${this.pipelineViewMode === 'kanban' ? 'flex' : 'none'};">
          <!-- Kanban columns will be rendered here -->
        </div>

        <div class="crm-map-view" id="crm-map-view" style="display: ${this.pipelineViewMode === 'map' ? 'block' : 'none'};">
          <div id="crm-map-container" style="width: 100%; height: 100%;"></div>
        </div>

        <div class="crm-dashboard-view" id="crm-dashboard-view" style="display: ${this.pipelineViewMode === 'dashboard' ? 'block' : 'none'};">
          <!-- Dashboard will be rendered here -->
        </div>

        <div class="crm-deal-sidebar" id="crm-deal-sidebar">
          <div class="crm-deal-sidebar-content">
            <div class="crm-sidebar-placeholder">
              Select a deal to view details
            </div>
          </div>
        </div>
      </div>
    `;

    // Render deals based on current view mode
    if (this.pipelineViewMode === 'table') {
      this.renderDealsTable();
    } else if (this.pipelineViewMode === 'kanban') {
      this.renderKanbanView();
    } else if (this.pipelineViewMode === 'map') {
      this.renderMapView();
    } else if (this.pipelineViewMode === 'dashboard') {
      this.renderDashboard();
    }

    // Add event listeners
    document.getElementById('crm-table-view-btn')?.addEventListener('click', () => {
      this.switchViewMode('table');
    });

    document.getElementById('crm-kanban-view-btn')?.addEventListener('click', () => {
      this.switchViewMode('kanban');
    });

    document.getElementById('crm-map-view-btn')?.addEventListener('click', () => {
      this.switchViewMode('map');
    });

    document.getElementById('crm-dashboard-view-btn')?.addEventListener('click', () => {
      this.switchViewMode('dashboard');
    });

    document.getElementById('crm-add-deal-btn')?.addEventListener('click', () => {
      this.showAddDealDialog();
    });

    // Filter event listeners
    document.getElementById('crm-search-input')?.addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.applyFilters();
    });

    document.getElementById('crm-filter-status')?.addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.applyFilters();
    });

    document.getElementById('crm-filter-priority')?.addEventListener('change', (e) => {
      this.filters.priority = e.target.value;
      this.applyFilters();
    });

    document.getElementById('crm-sort-by')?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.applyFilters();
    });

    document.getElementById('crm-clear-filters')?.addEventListener('click', () => {
      this.filters = { search: '', status: '', priority: '', sortBy: 'date' };
      document.getElementById('crm-search-input').value = '';
      document.getElementById('crm-filter-status').value = '';
      document.getElementById('crm-filter-priority').value = '';
      document.getElementById('crm-sort-by').value = 'date';
      this.applyFilters();
    });

    document.getElementById('crm-settings-btn')?.addEventListener('click', () => {
      this.showPipelineEditor(pipeline);
    });

    document.getElementById('crm-refresh-btn')?.addEventListener('click', () => {
      this.loadData().then(() => this.renderPipelineBoard());
    });

    document.getElementById('crm-dashboard-btn')?.addEventListener('click', () => {
      this.showDashboard();
    });
  }

  switchViewMode(mode) {
    console.log('Gmail CRM: Switching to view mode:', mode);
    this.pipelineViewMode = mode;

    // Save preference
    chrome.storage.local.set({ pipelineViewMode: mode });

    // Update view toggle buttons
    document.querySelectorAll('.crm-view-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Hide all views
    const tableView = document.getElementById('crm-table-view');
    const kanbanView = document.getElementById('crm-kanban-view');
    const mapView = document.getElementById('crm-map-view');
    const dashboardView = document.getElementById('crm-dashboard-view');

    console.log('Gmail CRM: View elements found - table:', !!tableView, 'kanban:', !!kanbanView, 'map:', !!mapView, 'dashboard:', !!dashboardView);

    if (tableView) tableView.style.display = 'none';
    if (kanbanView) kanbanView.style.display = 'none';
    if (mapView) mapView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = 'none';

    if (mode === 'table') {
      document.getElementById('crm-table-view-btn')?.classList.add('active');
      if (tableView) tableView.style.display = 'block';
      this.renderDealsTable();
    } else if (mode === 'kanban') {
      document.getElementById('crm-kanban-view-btn')?.classList.add('active');
      if (kanbanView) kanbanView.style.display = 'flex';
      this.renderKanbanView();
    } else if (mode === 'map') {
      console.log('Gmail CRM: Activating map view');
      document.getElementById('crm-map-view-btn')?.classList.add('active');
      if (mapView) {
        mapView.style.display = 'block';
        console.log('Gmail CRM: Map view display set to block');
      }
      this.renderMapView();
    } else if (mode === 'dashboard') {
      console.log('Gmail CRM: Activating dashboard view');
      document.getElementById('crm-dashboard-view-btn')?.classList.add('active');
      if (dashboardView) {
        dashboardView.style.display = 'block';
        console.log('Gmail CRM: Dashboard view display set to block');
      }
      this.renderDashboard();
    }
  }

  renderDealsTable() {
    const tbody = document.getElementById('crm-deals-tbody');
    if (!tbody || !this.currentPipeline) return;

    tbody.innerHTML = '';

    // Group deals by stage
    this.currentPipeline.stages.forEach(stage => {
      const dealsInStage = this.getDealsInStage(this.currentPipeline.id, stage.id);

      if (dealsInStage.length > 0 || true) { // Always show stage even if empty
        // Stage group header
        const stageRow = document.createElement('tr');
        stageRow.className = 'crm-stage-row';
        stageRow.innerHTML = `
          <td colspan="10" class="crm-stage-group" style="background-color: ${stage.color}20; border-left: 4px solid ${stage.color};">
            <strong>${stage.name}</strong>
            <button class="crm-add-to-stage" data-stage-id="${stage.id}">+ Add</button>
          </td>
        `;
        tbody.appendChild(stageRow);

        // Stage deals
        dealsInStage.forEach(deal => {
          const dealRow = this.createDealRow(deal, stage);
          tbody.appendChild(dealRow);
        });
      }
    });

    // Make rows draggable
    this.enableDragAndDrop();
  }

  renderKanbanView() {
    const kanbanView = document.getElementById('crm-kanban-view');
    if (!kanbanView || !this.currentPipeline) return;

    kanbanView.innerHTML = '';

    // Create a column for each stage
    this.currentPipeline.stages.forEach(stage => {
      const dealsInStage = this.getDealsInStage(this.currentPipeline.id, stage.id);

      const column = document.createElement('div');
      column.className = 'crm-kanban-column';
      column.dataset.stageId = stage.id;

      column.innerHTML = `
        <div class="crm-kanban-column-header" style="background-color: ${stage.color};">
          <div class="crm-kanban-column-title">
            <span class="crm-kanban-stage-name">${stage.name}</span>
            <span class="crm-kanban-stage-count">${dealsInStage.length}</span>
          </div>
          <button class="crm-kanban-add-btn" data-stage-id="${stage.id}" title="Add deal to ${stage.name}">
            +
          </button>
        </div>
        <div class="crm-kanban-cards-container" data-stage-id="${stage.id}">
          ${dealsInStage.map(deal => this.createKanbanCard(deal, stage)).join('')}
        </div>
      `;

      kanbanView.appendChild(column);
    });

    // Enable drag and drop for kanban cards
    this.enableKanbanDragAndDrop();

    // Add event listeners for add buttons
    kanbanView.querySelectorAll('.crm-kanban-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stageId = e.target.dataset.stageId;
        this.showAddDealDialog(stageId);
      });
    });
  }

  createKanbanCard(deal, stage) {
    // Calculate magic columns
    const magic = this.getMagicColumns(deal);

    const value = deal.value ? `$${deal.value.toLocaleString()}` : '-';
    const weightedValue = magic.weightedValue ? `$${magic.weightedValue.toLocaleString()}` : '-';
    const priority = deal.priority || 'Medium';
    const priorityColor = {
      'High': '#ea4335',
      'Medium': '#fbbc04',
      'Low': '#34a853'
    }[priority] || '#5f6368';

    const contacts = deal.contacts && deal.contacts.length > 0
      ? deal.contacts.join(', ')
      : (deal.contactEmail || '-');

    const company = magic.companyName || deal.company || deal.institution || '-';

    // Get last note if exists
    const lastNote = deal.notesHistory && deal.notesHistory.length > 0
      ? deal.notesHistory[deal.notesHistory.length - 1].text.substring(0, 60) + '...'
      : '';

    const linkedEmailsCount = deal.linkedEmails?.length || 0;

    // Format last activity with color
    const daysAgo = magic.daysSinceLastActivity;
    let activityColor = '#34a853';
    if (daysAgo > 14) activityColor = '#ea4335';
    else if (daysAgo > 7) activityColor = '#fbbc04';

    return `
      <div class="crm-kanban-card"
           draggable="true"
           data-deal-id="${deal.id}"
           data-stage-id="${stage.id}">
        <div class="crm-kanban-card-header">
          <div class="crm-kanban-card-title" title="${deal.emailSubject || deal.title || 'Untitled'}">
            ${deal.emailSubject || deal.title || 'Untitled'}
          </div>
          <div class="crm-kanban-card-priority" style="background-color: ${priorityColor};" title="${priority} priority">
          </div>
        </div>

        <div class="crm-kanban-card-body">
          <div class="crm-kanban-card-company">
            🏢 ${company}
          </div>
          <div class="crm-kanban-card-contact">
            👤 ${contacts}
          </div>
          ${value !== '-' ? `
          <div class="crm-kanban-card-value">
            💰 ${value} <span style="color: #1a73e8; font-weight: 600;">(${weightedValue})</span>
          </div>
          ` : ''}
          <div class="crm-kanban-card-meta">
            <span title="Deal age">📅 ${magic.dealAge}d old</span>
            <span title="Days since last activity" style="color: ${activityColor};">⏱ ${daysAgo}d ago</span>
          </div>
          ${lastNote ? `
          <div class="crm-kanban-card-note">
            📝 ${lastNote}
          </div>
          ` : ''}
        </div>

        <div class="crm-kanban-card-footer">
          <span class="crm-kanban-card-status" title="Status: ${deal.status || 'Active'}">
            ${deal.status || 'Active'}
          </span>
          ${linkedEmailsCount > 0 ? `
          <span class="crm-kanban-card-emails" title="${linkedEmailsCount} linked emails">
            📧 ${linkedEmailsCount}
          </span>
          ` : ''}
          <span class="crm-kanban-card-date" title="Last updated: ${new Date(deal.lastUpdated).toLocaleString()}">
            ${this.formatDateShort(deal.lastUpdated)}
          </span>
        </div>
      </div>
    `;
  }

  formatDateShort(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  enableKanbanDragAndDrop() {
    const cards = document.querySelectorAll('.crm-kanban-card');
    const containers = document.querySelectorAll('.crm-kanban-cards-container');

    let draggedCard = null;
    let sourceStageId = null;

    // Card drag events
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        sourceStageId = card.dataset.stageId;
        card.classList.add('crm-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', card.innerHTML);
      });

      card.addEventListener('dragend', (e) => {
        card.classList.remove('crm-dragging');
        draggedCard = null;
        sourceStageId = null;
      });

      // Double-click to open sidebar
      card.addEventListener('dblclick', (e) => {
        if (!e.target.closest('.crm-kanban-card-priority')) {
          const dealId = card.dataset.dealId;
          this.showDealSidebar(dealId);
        }
      });
    });

    // Container drop events
    containers.forEach(container => {
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const afterElement = this.getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
          container.appendChild(draggedCard);
        } else {
          container.insertBefore(draggedCard, afterElement);
        }
      });

      container.addEventListener('drop', (e) => {
        e.preventDefault();

        if (draggedCard) {
          const targetStageId = container.dataset.stageId;
          const dealId = draggedCard.dataset.dealId;

          // Update deal stage
          if (targetStageId !== sourceStageId) {
            this.moveDealToStage(dealId, targetStageId);

            // Update card's stage ID
            draggedCard.dataset.stageId = targetStageId;

            // Update stage counts
            this.updateKanbanStageCounts();
          }
        }
      });

      container.addEventListener('dragenter', (e) => {
        e.preventDefault();
        container.classList.add('crm-kanban-drag-over');
      });

      container.addEventListener('dragleave', (e) => {
        if (e.target === container) {
          container.classList.remove('crm-kanban-drag-over');
        }
      });
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.crm-kanban-card:not(.crm-dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  updateKanbanStageCounts() {
    this.currentPipeline.stages.forEach(stage => {
      const dealsInStage = this.getDealsInStage(this.currentPipeline.id, stage.id);
      const countElement = document.querySelector(`.crm-kanban-column[data-stage-id="${stage.id}"] .crm-kanban-stage-count`);
      if (countElement) {
        countElement.textContent = dealsInStage.length;
      }

      // Also update the stages bar counts
      const stageHeaderCount = document.querySelector(`.crm-stage-header[data-stage-id="${stage.id}"] .crm-stage-count`);
      if (stageHeaderCount) {
        stageHeaderCount.textContent = dealsInStage.length;
      }
    });
  }

  async moveDealToStage(dealId, newStageId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const oldStageId = deal.stageId;
    deal.stageId = newStageId;
    deal.lastUpdated = new Date().toISOString();

    // Add to status history
    const stage = this.currentPipeline.stages.find(s => s.id === newStageId);
    if (stage) {
      if (!deal.statusHistory) {
        deal.statusHistory = [];
      }
      deal.statusHistory.push({
        status: stage.name,
        changedAt: new Date().toISOString()
      });
    }

    // Save using Firebase sync
    await this.saveDeal(deal);

    // Trigger automation rules
    await this.checkAutomationTriggers('stage_changed', deal, {
      fromStageId: oldStageId,
      toStageId: newStageId
    });

    console.log(`Gmail CRM: Moved deal ${dealId} from ${oldStageId} to ${newStageId}`);
  }

  renderMapView() {
    console.log('Gmail CRM: renderMapView called');
    const mapContainer = document.getElementById('crm-map-container');
    console.log('Gmail CRM: mapContainer found:', !!mapContainer);
    console.log('Gmail CRM: currentPipeline:', this.currentPipeline?.name);

    if (!mapContainer || !this.currentPipeline) {
      console.log('Gmail CRM: Exiting renderMapView - missing container or pipeline');
      return;
    }

    // Get all deals with addresses
    const dealsInPipeline = this.getDealsInPipeline(this.currentPipeline.id);
    console.log('Gmail CRM: Total deals in pipeline:', dealsInPipeline.length);
    const dealsWithAddresses = dealsInPipeline.filter(deal => deal.latitude && deal.longitude);
    console.log('Gmail CRM: Deals with coordinates:', dealsWithAddresses.length);

    if (dealsWithAddresses.length === 0) {
      console.log('Gmail CRM: Showing empty state');
      mapContainer.innerHTML = `
        <div class="crm-map-empty-state">
          <div class="crm-empty-icon">🗺️</div>
          <h3>No Locations to Display</h3>
          <p>Deals need addresses with coordinates to appear on the map.</p>
          <p>Use the "🔍 Add Address" button in the deal sidebar to add addresses.</p>
        </div>
      `;
      return;
    }

    // Leaflet is loaded via manifest.json, initialize map
    console.log('Gmail CRM: Leaflet available:', !!window.L);
    if (!window.L) {
      console.error('Gmail CRM: Leaflet library not loaded!');
      mapContainer.innerHTML = `
        <div class="crm-map-empty-state">
          <div class="crm-empty-icon">❌</div>
          <h3>Map Library Error</h3>
          <p>The mapping library failed to load. Please reload the extension.</p>
        </div>
      `;
      return;
    }

    this.initializeMap(dealsWithAddresses);
  }

  initializeMap(deals) {
    const mapContainer = document.getElementById('crm-map-container');
    if (!mapContainer) return;

    // Clear existing map if any
    mapContainer.innerHTML = '';

    // Initialize map centered on US
    const map = L.map('crm-map-container').setView([39.8283, -98.5795], 4);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(map);

    // Create custom icons based on deal priority
    const createIcon = (priority, stage) => {
      const priorityColor = {
        'High': '#ea4335',
        'Medium': '#fbbc04',
        'Low': '#34a853'
      }[priority] || '#5f6368';

      return L.divIcon({
        className: 'crm-map-marker',
        html: `<div class="crm-map-marker-icon" style="background-color: ${priorityColor}; border: 3px solid white; width: 24px; height: 24px; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    };

    // Add markers for each deal
    deals.forEach(deal => {
      const marker = L.marker([deal.latitude, deal.longitude], {
        icon: createIcon(deal.priority, deal.stageId)
      }).addTo(map);

      // Get stage info
      const stage = this.currentPipeline.stages.find(s => s.id === deal.stageId);
      const stageName = stage ? stage.name : 'Unknown';
      const stageColor = stage ? stage.color : '#5f6368';

      // Create popup content
      const popupContent = `
        <div class="crm-map-popup">
          <div class="crm-map-popup-header">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #202124;">${deal.emailSubject || deal.title || 'Untitled Deal'}</h4>
          </div>
          <div class="crm-map-popup-body">
            <div style="margin-bottom: 4px;">
              <strong>🏢 Institution:</strong> ${deal.institution || deal.company || '-'}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>📍 Location:</strong> ${deal.city}, ${deal.state}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>📊 Stage:</strong> <span style="background-color: ${stageColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${stageName}</span>
            </div>
            <div style="margin-bottom: 4px;">
              <strong>💰 Value:</strong> ${deal.value ? `$${deal.value.toLocaleString()}` : '-'}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>⚡ Priority:</strong> ${deal.priority || 'Medium'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>👤 Contact:</strong> ${deal.contactEmail || '-'}
            </div>
            <button class="crm-btn-small" onclick="window.gmailCRM.showDealSidebar('${deal.id}')">View Details</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'crm-leaflet-popup'
      });

      // Open deal sidebar on click
      marker.on('click', () => {
        this.showDealSidebar(deal.id);
      });
    });

    // Fit bounds to show all markers
    if (deals.length > 0) {
      const bounds = L.latLngBounds(deals.map(d => [d.latitude, d.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Store map instance for later use
    this.map = map;
  }

  renderDashboard() {
    const dashboardContainer = document.getElementById('crm-dashboard-view');
    if (!dashboardContainer || !this.currentPipeline) return;

    const dealsInPipeline = this.getDealsInPipeline(this.currentPipeline.id);

    // Calculate analytics
    const totalDeals = dealsInPipeline.length;
    const totalValue = dealsInPipeline.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const weightedValue = dealsInPipeline.reduce((sum, d) => {
      const magic = this.getMagicColumns(d);
      return sum + magic.weightedValue;
    }, 0);

    const activeDeals = dealsInPipeline.filter(d => d.status !== 'Closed Won' && d.status !== 'Closed Lost').length;
    const wonDeals = dealsInPipeline.filter(d => d.status === 'Closed Won').length;
    const lostDeals = dealsInPipeline.filter(d => d.status === 'Closed Lost').length;
    const winRate = totalDeals > 0 ? ((wonDeals / (wonDeals + lostDeals || 1)) * 100).toFixed(1) : 0;

    const avgDealAge = totalDeals > 0 ? Math.round(dealsInPipeline.reduce((sum, d) => sum + this.calculateDealAge(d), 0) / totalDeals) : 0;
    const avgDealValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

    // Deals by stage
    const dealsByStage = this.currentPipeline.stages.map(stage => ({
      stage,
      deals: this.getDealsInStage(this.currentPipeline.id, stage.id),
      value: this.getDealsInStage(this.currentPipeline.id, stage.id).reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)
    }));

    const maxStageDeals = Math.max(...dealsByStage.map(s => s.deals.length), 1);
    const maxStageValue = Math.max(...dealsByStage.map(s => s.value), 1);

    // Activity analysis
    const coldDeals = dealsInPipeline.filter(d => this.calculateDaysSinceLastActivity(d) > 14).length;
    const warmDeals = dealsInPipeline.filter(d => {
      const days = this.calculateDaysSinceLastActivity(d);
      return days >= 7 && days <= 14;
    }).length;
    const hotDeals = dealsInPipeline.filter(d => this.calculateDaysSinceLastActivity(d) < 7).length;

    dashboardContainer.innerHTML = `
      <div class="crm-dashboard-container">
        <h2 class="crm-dashboard-title">📊 Pipeline Analytics</h2>

        <!-- Key Metrics Cards -->
        <div class="crm-metrics-grid">
          <div class="crm-metric-card">
            <div class="crm-metric-label">Total Pipeline Value</div>
            <div class="crm-metric-value">$${totalValue.toLocaleString()}</div>
          </div>
          <div class="crm-metric-card">
            <div class="crm-metric-label">Weighted Value</div>
            <div class="crm-metric-value" style="color: #1a73e8;">$${Math.round(weightedValue).toLocaleString()}</div>
          </div>
          <div class="crm-metric-card">
            <div class="crm-metric-label">Active Deals</div>
            <div class="crm-metric-value">${activeDeals}</div>
          </div>
          <div class="crm-metric-card">
            <div class="crm-metric-label">Win Rate</div>
            <div class="crm-metric-value" style="color: ${parseFloat(winRate) > 50 ? '#34a853' : '#ea4335'};">${winRate}%</div>
          </div>
          <div class="crm-metric-card">
            <div class="crm-metric-label">Avg Deal Size</div>
            <div class="crm-metric-value">$${avgDealValue.toLocaleString()}</div>
          </div>
          <div class="crm-metric-card">
            <div class="crm-metric-label">Avg Deal Age</div>
            <div class="crm-metric-value">${avgDealAge} days</div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="crm-charts-grid">
          <!-- Deals by Stage -->
          <div class="crm-chart-card">
            <h3 class="crm-chart-title">Deals by Stage</h3>
            <div class="crm-chart-bars">
              ${dealsByStage.map(s => `
                <div class="crm-chart-bar-row">
                  <div class="crm-chart-bar-label">${s.stage.name}</div>
                  <div class="crm-chart-bar-container">
                    <div class="crm-chart-bar" style="width: ${(s.deals.length / maxStageDeals) * 100}%; background-color: ${s.stage.color};"></div>
                    <span class="crm-chart-bar-value">${s.deals.length}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Value by Stage -->
          <div class="crm-chart-card">
            <h3 class="crm-chart-title">Value by Stage</h3>
            <div class="crm-chart-bars">
              ${dealsByStage.map(s => `
                <div class="crm-chart-bar-row">
                  <div class="crm-chart-bar-label">${s.stage.name}</div>
                  <div class="crm-chart-bar-container">
                    <div class="crm-chart-bar" style="width: ${(s.value / maxStageValue) * 100}%; background-color: ${s.stage.color};"></div>
                    <span class="crm-chart-bar-value">$${Math.round(s.value / 1000)}k</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Deal Health -->
          <div class="crm-chart-card">
            <h3 class="crm-chart-title">Deal Activity Health</h3>
            <div class="crm-health-bars">
              <div class="crm-health-bar-row">
                <div class="crm-health-label" style="color: #34a853;">🔥 Hot (< 7 days)</div>
                <div class="crm-health-bar-container">
                  <div class="crm-health-bar" style="width: ${totalDeals > 0 ? (hotDeals / totalDeals) * 100 : 0}%; background-color: #34a853;"></div>
                  <span class="crm-health-value">${hotDeals}</span>
                </div>
              </div>
              <div class="crm-health-bar-row">
                <div class="crm-health-label" style="color: #fbbc04;">⚠️ Warm (7-14 days)</div>
                <div class="crm-health-bar-container">
                  <div class="crm-health-bar" style="width: ${totalDeals > 0 ? (warmDeals / totalDeals) * 100 : 0}%; background-color: #fbbc04;"></div>
                  <span class="crm-health-value">${warmDeals}</span>
                </div>
              </div>
              <div class="crm-health-bar-row">
                <div class="crm-health-label" style="color: #ea4335;">❄️ Cold (> 14 days)</div>
                <div class="crm-health-bar-container">
                  <div class="crm-health-bar" style="width: ${totalDeals > 0 ? (coldDeals / totalDeals) * 100 : 0}%; background-color: #ea4335;"></div>
                  <span class="crm-health-value">${coldDeals}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Win/Loss Analysis -->
          <div class="crm-chart-card">
            <h3 class="crm-chart-title">Win/Loss Analysis</h3>
            <div class="crm-win-loss-chart">
              <div class="crm-win-loss-bar">
                <div class="crm-win-section" style="width: ${wonDeals > 0 ? (wonDeals / (wonDeals + lostDeals || 1)) * 100 : 0}%;">
                  <span>${wonDeals} Won</span>
                </div>
                <div class="crm-loss-section" style="width: ${lostDeals > 0 ? (lostDeals / (wonDeals + lostDeals || 1)) * 100 : 0}%;">
                  <span>${lostDeals} Lost</span>
                </div>
              </div>
              <div class="crm-win-loss-stats">
                <div class="crm-win-stat">✅ ${wonDeals} Closed Won</div>
                <div class="crm-loss-stat">❌ ${lostDeals} Closed Lost</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderInstitutionsDirectory() {
    const pipeline = this.currentPipeline;

    // Get all deals with institution data
    const allDeals = Object.values(this.deals);
    const dealsWithInstitutions = allDeals.filter(d => d.institution || d.domain);

    // Group by institution
    const institutionMap = {};
    dealsWithInstitutions.forEach(deal => {
      const institutionKey = deal.institution || deal.domain || 'Unknown';
      if (!institutionMap[institutionKey]) {
        institutionMap[institutionKey] = {
          name: institutionKey,
          domain: deal.domain,
          isHospital: deal.isHospital,
          contacts: new Set(),
          emails: [],
          deals: []
        };
      }

      // Add contacts
      if (deal.contacts) {
        deal.contacts.forEach(contact => institutionMap[institutionKey].contacts.add(contact));
      }

      // Add emails
      if (deal.linkedEmails) {
        deal.linkedEmails.forEach(email => {
          institutionMap[institutionKey].emails.push({
            ...email,
            dealId: deal.id,
            dealName: deal.emailSubject
          });
        });
      }

      institutionMap[institutionKey].deals.push(deal);
    });

    // Convert to array and sort by email count
    const institutions = Object.values(institutionMap)
      .map(inst => ({
        ...inst,
        contacts: Array.from(inst.contacts),
        emails: inst.emails.sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
      }))
      .sort((a, b) => b.emails.length - a.emails.length);

    this.pipelineView.innerHTML = `
      <div class="crm-pipeline-header">
        <div class="crm-pipeline-title">
          <h1>📋 ${pipeline.name}</h1>
          <span class="crm-deal-count">${institutions.length} Institutions, ${institutions.reduce((sum, i) => sum + i.emails.length, 0)} Emails</span>
        </div>
        <div class="crm-pipeline-actions">
          <input type="text" id="crm-institution-search" placeholder="Search institutions..." class="crm-input" style="width: 250px; margin-right: 10px;" />
          <button class="crm-btn-primary" id="crm-reanalyze-btn">🔍 Re-analyze Institutions</button>
          <button class="crm-btn" id="crm-refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      <div class="crm-institutions-container" id="crm-institutions-container">
        ${institutions.map(institution => this.renderInstitutionCard(institution)).join('')}
      </div>
    `;

    // Add event listeners
    document.getElementById('crm-refresh-btn')?.addEventListener('click', () => {
      this.loadData().then(() => this.renderPipelineBoard());
    });

    document.getElementById('crm-reanalyze-btn')?.addEventListener('click', () => {
      this.reanalyzeInstitutions();
    });

    document.getElementById('crm-institution-search')?.addEventListener('input', (e) => {
      this.filterInstitutions(e.target.value);
    });
  }

  renderInstitutionCard(institution) {
    const emailsList = institution.emails.slice(0, 20).map(email => {
      const emailDate = new Date(email.date);
      const formattedDate = emailDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: emailDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="crm-institution-email-item">
          <div class="crm-email-header">
            <span class="crm-email-sender">👤 ${email.fromName || 'Unknown'}</span>
            <span class="crm-email-date">${formattedDate}</span>
          </div>
          <div class="crm-email-subject">
            <a href="${email.url}" target="_blank" class="crm-email-link">${email.subject}</a>
          </div>
          <div class="crm-email-meta">
            <span class="crm-email-from">${email.from}</span>
          </div>
        </div>
      `;
    }).join('');

    const hospitalBadge = institution.isHospital ? '<span class="crm-hospital-badge">🏥 Hospital</span>' : '';

    return `
      <div class="crm-institution-card" data-institution="${institution.name}">
        <div class="crm-institution-header">
          <div class="crm-institution-title">
            <h3>${institution.name}</h3>
            ${hospitalBadge}
          </div>
          <div class="crm-institution-stats">
            <span class="crm-stat">👥 ${institution.contacts.length} contact${institution.contacts.length !== 1 ? 's' : ''}</span>
            <span class="crm-stat">📧 ${institution.emails.length} email${institution.emails.length !== 1 ? 's' : ''}</span>
            <span class="crm-stat">💼 ${institution.deals.length} deal${institution.deals.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="crm-institution-contacts">
          <strong>Contacts:</strong> ${institution.contacts.join(', ') || 'None'}
        </div>
        <div class="crm-institution-domain">
          <strong>Domain:</strong> ${institution.domain}
        </div>
        <div class="crm-institution-emails">
          <div class="crm-emails-header">
            <strong>📬 Email Timeline</strong>
            ${institution.emails.length > 20 ? `<span class="crm-emails-showing">Showing 20 of ${institution.emails.length}</span>` : ''}
          </div>
          ${emailsList}
        </div>
      </div>
    `;
  }

  filterInstitutions(searchTerm) {
    const cards = document.querySelectorAll('.crm-institution-card');
    const normalizedSearch = searchTerm.toLowerCase();

    cards.forEach(card => {
      const institutionName = card.dataset.institution.toLowerCase();
      const matches = institutionName.includes(normalizedSearch);
      card.style.display = matches ? 'block' : 'none';
    });
  }

  async reanalyzeInstitutions() {
    console.log('Gmail CRM: Starting institution re-analysis...');
    this.showNotification('🔍 Re-analyzing institutions...');

    let updated = 0;
    let merged = 0;

    // Go through all deals and re-extract institution names
    for (const [dealId, deal] of Object.entries(this.deals)) {
      if (deal.domain) {
        // Re-extract institution name using improved detection
        const oldInstitution = deal.institution;
        const newInstitution = this.extractInstitutionName(deal.domain);

        if (newInstitution !== oldInstitution) {
          console.log(`Gmail CRM: Updating "${oldInstitution}" -> "${newInstitution}" for domain ${deal.domain}`);
          deal.institution = newInstitution;
          deal.company = newInstitution;

          // Update deal subject
          if (deal.contacts && deal.linkedEmails) {
            deal.emailSubject = `${newInstitution} - ${deal.contacts.length} contact${deal.contacts.length !== 1 ? 's' : ''}, ${deal.linkedEmails.length} email${deal.linkedEmails.length !== 1 ? 's' : ''}`;
          }

          updated++;
        }
      }

      // Also update linked emails institution names
      if (deal.linkedEmails) {
        deal.linkedEmails.forEach(email => {
          if (email.domain) {
            const newInstitution = this.extractInstitutionName(email.domain);
            if (email.institution !== newInstitution) {
              email.institution = newInstitution;
            }
          }
        });
      }
    }

    // Now merge deals that belong to the same institution
    const institutionGroups = {};

    for (const [dealId, deal] of Object.entries(this.deals)) {
      const inst = deal.institution || 'Unknown Institution';
      if (!institutionGroups[inst]) {
        institutionGroups[inst] = [];
      }
      institutionGroups[inst].push(dealId);
    }

    // Merge deals in each institution group
    for (const [institution, dealIds] of Object.entries(institutionGroups)) {
      if (dealIds.length > 1) {
        console.log(`Gmail CRM: Merging ${dealIds.length} deals for ${institution}`);

        // Keep the first deal, merge others into it
        const primaryDealId = dealIds[0];
        const primaryDeal = this.deals[primaryDealId];

        for (let i = 1; i < dealIds.length; i++) {
          const mergeDealId = dealIds[i];
          const mergeDeal = this.deals[mergeDealId];

          // Merge contacts
          if (mergeDeal.contacts) {
            if (!primaryDeal.contacts) primaryDeal.contacts = [];
            mergeDeal.contacts.forEach(contact => {
              if (!primaryDeal.contacts.includes(contact)) {
                primaryDeal.contacts.push(contact);
              }
            });
          }

          // Merge linked emails
          if (mergeDeal.linkedEmails) {
            if (!primaryDeal.linkedEmails) primaryDeal.linkedEmails = [];
            mergeDeal.linkedEmails.forEach(email => {
              const alreadyLinked = primaryDeal.linkedEmails.some(e =>
                e.threadId === email.threadId || e.subject === email.subject
              );
              if (!alreadyLinked) {
                primaryDeal.linkedEmails.push(email);
              }
            });
          }

          // Merge other fields
          if (!primaryDeal.domain && mergeDeal.domain) {
            primaryDeal.domain = mergeDeal.domain;
          }

          // Delete the merged deal
          await this.deleteDeal(mergeDealId);
          merged++;
        }

        // Update primary deal counts
        primaryDeal.contactCount = primaryDeal.contacts?.length || 0;
        primaryDeal.emailSubject = `${institution} - ${primaryDeal.contacts.length} contact${primaryDeal.contacts.length !== 1 ? 's' : ''}, ${primaryDeal.linkedEmails.length} email${primaryDeal.linkedEmails.length !== 1 ? 's' : ''}`;

        // Save the merged primary deal
        await this.saveDeal(primaryDeal);
      }
    }

    console.log(`Gmail CRM: Re-analysis complete. Updated ${updated} institutions, merged ${merged} deals`);
    this.showNotification(`✓ Re-analysis complete! Updated ${updated} institutions, merged ${merged} duplicate deals`);

    // Reload and refresh
    await this.loadData();
    this.renderPipelineBoard();
  }

  createDealRow(deal, stage) {
    const row = document.createElement('tr');
    row.className = 'crm-deal-row';
    row.draggable = true;
    row.dataset.dealId = deal.id;
    row.dataset.stageId = stage.id;

    // Calculate magic columns
    const magic = this.getMagicColumns(deal);

    const formattedValue = deal.value ? `$${Number(deal.value).toLocaleString()}` : '';
    const formattedWeightedValue = magic.weightedValue ? `$${magic.weightedValue.toLocaleString()}` : '';

    // Status options
    const statusOptions = [
      'Active', 'On Hold', 'Waiting Response', 'In Review',
      'Negotiating', 'Pending Approval', 'Closed Won', 'Closed Lost'
    ];
    const currentStatus = deal.status || 'Active';

    const statusDropdown = `
      <select class="crm-status-select" data-deal-id="${deal.id}">
        ${statusOptions.map(status =>
          `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>`
        ).join('')}
      </select>
    `;

    // Format last activity with color coding
    const daysAgo = magic.daysSinceLastActivity;
    let activityClass = '';
    if (daysAgo > 14) activityClass = 'crm-activity-cold';
    else if (daysAgo > 7) activityClass = 'crm-activity-warm';
    else activityClass = 'crm-activity-hot';

    row.innerHTML = `
      <td class="crm-td-checkbox"><input type="checkbox" /></td>
      <td class="crm-td-name">
        <span class="crm-deal-link" data-deal-id="${deal.id}">${deal.emailSubject || 'Untitled'}</span>
      </td>
      <td class="crm-td-status">${statusDropdown}</td>
      <td class="crm-td-priority">${deal.priority || 'High'}</td>
      <td class="crm-td-value">${formattedValue}</td>
      <td class="crm-td-prob">${deal.probability || '90'}%</td>
      <td class="crm-td-weighted"><strong>${formattedWeightedValue}</strong></td>
      <td class="crm-td-contact">${deal.contactEmail || ''}</td>
      <td class="crm-td-company">${magic.companyName || '-'}</td>
      <td class="crm-td-age">${magic.dealAge}d</td>
      <td class="crm-td-last-activity ${activityClass}">${daysAgo}d ago</td>
      <td class="crm-td-assigned">${deal.assignedTo || ''}</td>
    `;

    // Add click handler for deal name
    setTimeout(() => {
      const dealLink = row.querySelector('.crm-deal-link');
      if (dealLink) {
        dealLink.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showDealSidebar(deal.id);
        });
      }

      // Add status change handler
      const statusSelect = row.querySelector('.crm-status-select');
      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          e.stopPropagation();
          this.updateDealStatus(deal.id, e.target.value);
        });
        // Prevent drag when clicking dropdown
        statusSelect.addEventListener('mousedown', (e) => e.stopPropagation());
      }
    }, 0);

    return row;
  }

  enableDragAndDrop() {
    const rows = document.querySelectorAll('.crm-deal-row');
    const stageRows = document.querySelectorAll('.crm-stage-row');

    rows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.dealId);
        row.classList.add('dragging');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
      });
    });

    stageRows.forEach(stageRow => {
      stageRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        stageRow.classList.add('drag-over');
      });

      stageRow.addEventListener('dragleave', () => {
        stageRow.classList.remove('drag-over');
      });

      stageRow.addEventListener('drop', (e) => {
        e.preventDefault();
        stageRow.classList.remove('drag-over');

        const dealId = e.dataTransfer.getData('text/plain');
        const stageId = stageRow.querySelector('.crm-add-to-stage')?.dataset.stageId;

        if (dealId && stageId) {
          this.moveDealToStage(dealId, stageId);
        }
      });
    });
  }

  async moveDealToStage(dealId, newStageId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    deal.stageId = newStageId;
    deal.lastUpdated = new Date().toISOString();

    await this.saveDeal(deal);
    this.renderPipelineBoard();
    this.showNotification('Deal moved successfully!');
  }

  getDealsInPipeline(pipelineId) {
    return Object.entries(this.deals)
      .filter(([_, deal]) => deal.pipelineId === pipelineId)
      .map(([id, deal]) => ({ ...deal, id }))
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  getDealsInStage(pipelineId, stageId) {
    let deals = Object.entries(this.deals)
      .filter(([_, deal]) => deal.pipelineId === pipelineId && deal.stageId === stageId)
      .map(([id, deal]) => ({ ...deal, id }));

    // Apply filters
    deals = this.filterDeals(deals);

    // Apply sorting
    deals = this.sortDeals(deals);

    return deals;
  }

  filterDeals(deals) {
    return deals.filter(deal => {
      // Search filter
      if (this.filters.search) {
        const searchText = this.filters.search;
        const matchesSearch =
          (deal.emailSubject || '').toLowerCase().includes(searchText) ||
          (deal.contactEmail || '').toLowerCase().includes(searchText) ||
          (deal.notes || '').toLowerCase().includes(searchText) ||
          (deal.assignedTo || '').toLowerCase().includes(searchText);

        if (!matchesSearch) return false;
      }

      // Status filter
      if (this.filters.status && deal.status !== this.filters.status) {
        return false;
      }

      // Priority filter
      if (this.filters.priority && deal.priority !== this.filters.priority) {
        return false;
      }

      return true;
    });
  }

  sortDeals(deals) {
    const sortBy = this.filters.sortBy;

    return [...deals].sort((a, b) => {
      switch (sortBy) {
        case 'value-desc':
          return (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0);
        case 'value-asc':
          return (parseFloat(a.value) || 0) - (parseFloat(b.value) || 0);
        case 'age':
          return this.calculateDealAge(b) - this.calculateDealAge(a);
        case 'name':
          return (a.emailSubject || '').localeCompare(b.emailSubject || '');
        case 'date':
        default:
          return new Date(b.lastUpdated) - new Date(a.lastUpdated);
      }
    });
  }

  applyFilters() {
    // Re-render the current view with filters applied
    if (this.pipelineViewMode === 'table') {
      this.renderDealsTable();
    } else if (this.pipelineViewMode === 'kanban') {
      this.renderKanbanView();
    }
  }

  showAddDealDialog(stageId = null, voiceData = {}) {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>Add Deal</h2>
          <button class="voice-button" id="voice-dictate-btn" title="Use voice to fill form">🎤</button>
        </div>
        <div class="crm-form-group">
          <label>Deal Name <span style="color: #ea4335;">*</span></label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="crm-deal-name" class="crm-input" placeholder="Enter deal name" required value="${voiceData.dealName || ''}" style="flex: 1;" />
            <button class="voice-field-btn" data-field="crm-deal-name" title="Voice input">🎤</button>
          </div>
          <div class="crm-validation-error" id="crm-deal-name-error" style="display: none;"></div>
        </div>
        <div class="crm-form-group">
          <label>Stage <span style="color: #ea4335;">*</span></label>
          <select id="crm-deal-stage" class="crm-input" required>
            ${this.currentPipeline.stages.map(s => `<option value="${s.id}"${s.id === stageId ? ' selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="crm-form-group">
          <label>Deal Value</label>
          <div style="display: flex; gap: 8px;">
            <input type="number" id="crm-deal-value-input" class="crm-input" placeholder="$0" min="0" style="flex: 1;" />
            <button class="voice-field-btn" data-field="crm-deal-value-input" title="Voice input">🎤</button>
          </div>
          <div class="crm-validation-error" id="crm-deal-value-error" style="display: none;"></div>
        </div>
        <div class="crm-form-group">
          <label>Contact Email <span style="color: #ea4335;">*</span></label>
          <div style="display: flex; gap: 8px;">
            <input type="email" id="crm-deal-email" class="crm-input" placeholder="contact@example.com" required style="flex: 1;" />
            <button class="voice-field-btn" data-field="crm-deal-email" title="Voice input">🎤</button>
          </div>
          <div class="crm-validation-error" id="crm-deal-email-error" style="display: none;"></div>
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-deal">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-deal">Save Deal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-deal')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-deal')?.addEventListener('click', async () => {
      // Clear previous errors
      modal.querySelectorAll('.crm-validation-error').forEach(el => el.style.display = 'none');

      const dealName = document.getElementById('crm-deal-name').value.trim();
      const contactEmail = document.getElementById('crm-deal-email').value.trim();
      const dealValue = document.getElementById('crm-deal-value-input').value;

      // Validate required fields
      let hasError = false;

      if (!dealName) {
        this.showValidationError('crm-deal-name-error', 'Deal name is required');
        hasError = true;
      }

      if (!contactEmail) {
        this.showValidationError('crm-deal-email-error', 'Contact email is required');
        hasError = true;
      } else if (!this.isValidEmail(contactEmail)) {
        this.showValidationError('crm-deal-email-error', 'Please enter a valid email address');
        hasError = true;
      }

      if (dealValue && parseFloat(dealValue) < 0) {
        this.showValidationError('crm-deal-value-error', 'Deal value cannot be negative');
        hasError = true;
      }

      if (hasError) {
        return;
      }

      const dealId = 'deal_' + Date.now();
      const deal = {
        id: dealId,
        threadId: dealId,
        pipelineId: this.currentPipeline.id,
        stageId: document.getElementById('crm-deal-stage').value,
        emailSubject: dealName,
        value: dealValue,
        contactEmail: contactEmail,
        priority: 'High',
        probability: 90,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        status: 'Active'
      };

      await this.saveDeal(deal);

      // Trigger automation rules for new deal
      await this.checkAutomationTriggers('deal_created', deal);

      modal.remove();
      this.renderPipelineBoard();
      this.showNotification('✅ Deal added successfully!');
    });

    // Voice button event listeners
    document.getElementById('voice-dictate-btn')?.addEventListener('click', () => {
      if (window.voiceControl) {
        window.voiceControl.startListening({ type: 'form', formId: 'deal-form' });
      }
    });

    // Individual field voice buttons
    modal.querySelectorAll('.voice-field-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fieldId = btn.dataset.field;
        const field = document.getElementById(fieldId);

        if (field && window.voiceControl) {
          field.focus();
          window.voiceControl.startListening({ type: 'form', fieldId: fieldId });
        }
      });
    });
  }

  showValidationError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ========== CRM Automation Engine ==========

  getDefaultAutomationRules() {
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

  async checkAutomationTriggers(triggerType, deal, metadata = {}) {
    if (!this.automationRules || this.automationRules.length === 0) return;

    // Find matching rules
    const matchingRules = this.automationRules.filter(rule => {
      if (!rule.enabled) return false;
      if (rule.trigger.type !== triggerType) return false;

      // Check trigger-specific conditions
      if (triggerType === 'stage_changed') {
        const { fromStageId, toStageId } = metadata;
        if (rule.trigger.fromStageId && rule.trigger.fromStageId !== fromStageId) return false;
        if (rule.trigger.toStageId && rule.trigger.toStageId !== toStageId) return false;
      }

      // Check rule conditions
      return this.evaluateConditions(rule.conditions, deal);
    });

    // Execute actions for matching rules
    for (const rule of matchingRules) {
      console.log(`Gmail CRM: Executing automation rule: ${rule.name}`);
      for (const action of rule.actions) {
        await this.executeAutomationAction(action, deal);
      }
    }
  }

  evaluateConditions(conditions, deal) {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = deal[condition.field];

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'greater_than':
          return parseFloat(fieldValue) > parseFloat(condition.value);
        case 'less_than':
          return parseFloat(fieldValue) < parseFloat(condition.value);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        default:
          return true;
      }
    });
  }

  async executeAutomationAction(action, deal) {
    switch (action.type) {
      case 'add_comment':
        await this.addAutomationComment(deal.id, action.text);
        break;

      case 'update_field':
        deal[action.field] = action.value;
        await this.saveDeal(deal);
        break;

      case 'send_notification':
        this.showNotification(action.message);
        break;

      default:
        console.warn(`Gmail CRM: Unknown automation action type: ${action.type}`);
    }
  }

  async addAutomationComment(dealId, text) {
    const deal = this.deals[dealId];
    if (!deal) return;

    if (!deal.comments) {
      deal.comments = [];
    }

    const comment = {
      id: 'comment_' + Date.now(),
      text: text,
      author: 'Automation',
      timestamp: new Date().toISOString(),
      isAutomation: true
    };

    deal.comments.push(comment);
    await this.saveDeal(deal);
  }

  // ========== Follow-Up Sequences ==========

  async enrollDealInSequence(dealId, sequenceId) {
    const sequence = this.followUpSequences.find(s => s.id === sequenceId);
    if (!sequence) {
      this.showNotification('❌ Sequence not found');
      return;
    }

    const deal = this.deals[dealId];
    if (!deal) {
      this.showNotification('❌ Deal not found');
      return;
    }

    // Check if already enrolled
    if (!sequence.enrollments) {
      sequence.enrollments = [];
    }

    const existingEnrollment = sequence.enrollments.find(e => e.dealId === dealId);
    if (existingEnrollment && existingEnrollment.status === 'active') {
      this.showNotification('⚠️ Deal already enrolled in this sequence');
      return;
    }

    // Enroll deal
    sequence.enrollments.push({
      dealId: dealId,
      enrolledAt: new Date().toISOString(),
      currentStep: 0,
      status: 'active'
    });

    // Save sequences
    await chrome.storage.local.set({ followUpSequences: this.followUpSequences });

    this.showNotification(`✅ Enrolled in sequence: ${sequence.name}`);

    // Log enrollment in deal comments
    await this.addAutomationComment(dealId, `📧 Enrolled in follow-up sequence: ${sequence.name}`);
  }

  async unenrollDealFromSequence(dealId, sequenceId) {
    const sequence = this.followUpSequences.find(s => s.id === sequenceId);
    if (!sequence || !sequence.enrollments) return;

    const enrollment = sequence.enrollments.find(e => e.dealId === dealId);
    if (enrollment) {
      enrollment.status = 'stopped';
      await chrome.storage.local.set({ followUpSequences: this.followUpSequences });
      this.showNotification('⏹️ Stopped follow-up sequence');

      await this.addAutomationComment(dealId, `⏹️ Stopped follow-up sequence: ${sequence.name}`);
    }
  }

  getDealSequenceStatus(dealId) {
    const enrollments = [];

    for (const sequence of this.followUpSequences) {
      if (!sequence.enrollments) continue;

      const enrollment = sequence.enrollments.find(e => e.dealId === dealId && e.status === 'active');
      if (enrollment) {
        enrollments.push({
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          currentStep: enrollment.currentStep,
          totalSteps: sequence.steps.length,
          enrolledAt: enrollment.enrolledAt
        });
      }
    }

    return enrollments;
  }

  renderFollowUpSequenceWidget(dealId) {
    const enrollments = this.getDealSequenceStatus(dealId);

    if (enrollments.length === 0) {
      return `
        <div class="crm-sequence-widget">
          <div class="crm-section-title">📧 Follow-Up Sequences</div>
          <p style="color: #5f6368; font-size: 13px; margin: 8px 0;">Not enrolled in any sequences</p>
          <button class="crm-btn-small" onclick="window.gmailCRM.showSequenceEnrollmentDialog('${dealId}')">
            Enroll in Sequence
          </button>
        </div>
      `;
    }

    return `
      <div class="crm-sequence-widget">
        <div class="crm-section-title">📧 Active Follow-Up Sequences</div>
        ${enrollments.map(e => `
          <div style="padding: 8px; background: #e8f0fe; border-radius: 4px; margin: 8px 0;">
            <div style="font-weight: 500; margin-bottom: 4px;">${e.sequenceName}</div>
            <div style="font-size: 12px; color: #5f6368;">
              Step ${e.currentStep + 1} of ${e.totalSteps}
            </div>
            <button class="crm-btn-small" style="margin-top: 6px;"
                    onclick="window.gmailCRM.unenrollDealFromSequence('${dealId}', '${e.sequenceId}')">
              Stop Sequence
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  showSequenceEnrollmentDialog(dealId) {
    if (this.followUpSequences.length === 0) {
      this.showNotification('⚠️ No sequences available. Create one in Settings first.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Enroll in Follow-Up Sequence</h2>

        <div class="crm-form-group">
          <label>Select Sequence</label>
          <select id="crm-sequence-select" class="crm-input">
            ${this.followUpSequences.map(s => `
              <option value="${s.id}">${s.name} (${s.steps.length} steps)</option>
            `).join('')}
          </select>
        </div>

        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-enrollment">Cancel</button>
          <button class="crm-btn-primary" id="crm-confirm-enrollment">Enroll</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-enrollment').addEventListener('click', () => modal.remove());
    document.getElementById('crm-confirm-enrollment').addEventListener('click', async () => {
      const sequenceId = document.getElementById('crm-sequence-select').value;
      await this.enrollDealInSequence(dealId, sequenceId);
      modal.remove();
      this.renderDealDetailView(dealId);
    });
  }

  // ========== Contact Enrichment ==========

  async enrichContact(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    this.showNotification('🔍 Enriching contact information...');

    const enrichedData = {
      emailDomain: this.extractEmailDomain(deal.contactEmail),
      companyGuess: this.guessCompanyFromEmail(deal.contactEmail),
      linkedInProfile: deal.linkedInProfile || '',
      phoneNumber: deal.phoneNumber || '',
      jobTitle: deal.jobTitle || '',
      companyWebsite: this.guessWebsiteFromEmail(deal.contactEmail),
      lastEnriched: new Date().toISOString()
    };

    // Merge enriched data into deal
    Object.assign(deal, enrichedData);

    await this.saveDeal(deal);

    await this.addAutomationComment(dealId, `🔍 Contact enriched: Added company and domain information`);

    this.showNotification('✅ Contact enriched successfully!');
  }

  extractEmailDomain(email) {
    if (!email) return '';
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : '';
  }

  guessCompanyFromEmail(email) {
    const domain = this.extractEmailDomain(email);
    if (!domain) return '';

    // Remove common TLDs and special characters
    let company = domain.split('.')[0];

    // Capitalize first letter
    company = company.charAt(0).toUpperCase() + company.slice(1);

    // Skip generic domains
    const genericDomains = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'aol'];
    if (genericDomains.includes(company.toLowerCase())) {
      return '';
    }

    return company;
  }

  guessWebsiteFromEmail(email) {
    const domain = this.extractEmailDomain(email);
    if (!domain) return '';

    const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com'];
    if (genericDomains.includes(domain.toLowerCase())) {
      return '';
    }

    return `https://${domain}`;
  }

  parseEmailSignature(emailBody) {
    // Simple signature parser - looks for common patterns
    const signatures = {
      phone: '',
      title: '',
      company: ''
    };

    if (!emailBody) return signatures;

    // Look for phone numbers (US format)
    const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatch = emailBody.match(phoneRegex);
    if (phoneMatch) {
      signatures.phone = phoneMatch[0];
    }

    // Look for job titles (simple heuristic - capitalized words before @ or company)
    const titleRegex = /(Chief|Director|Manager|VP|President|CEO|CTO|CFO|Head of|Lead|Senior|Engineer|Developer|Designer|Analyst)/i;
    const titleMatch = emailBody.match(titleRegex);
    if (titleMatch) {
      signatures.title = titleMatch[0];
    }

    return signatures;
  }

  showContactEnrichmentDialog(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>🔍 Enrich Contact: ${deal.contactEmail}</h2>

        <div class="crm-form-group">
          <label>Auto-Detected</label>
          <div style="padding: 12px; background: #f8f9fa; border-radius: 4px; margin-bottom: 12px;">
            <div style="margin-bottom: 8px;">
              <strong>Email Domain:</strong> ${this.extractEmailDomain(deal.contactEmail) || 'N/A'}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>Company Guess:</strong> ${this.guessCompanyFromEmail(deal.contactEmail) || 'N/A'}
            </div>
            <div>
              <strong>Website Guess:</strong> ${this.guessWebsiteFromEmail(deal.contactEmail) || 'N/A'}
            </div>
          </div>
        </div>

        <div class="crm-form-group">
          <label>LinkedIn Profile URL</label>
          <input type="url" id="crm-linkedin-url" class="crm-input" placeholder="https://linkedin.com/in/..." value="${deal.linkedInProfile || ''}" />
        </div>

        <div class="crm-form-group">
          <label>Job Title</label>
          <input type="text" id="crm-job-title" class="crm-input" placeholder="e.g., VP of Sales" value="${deal.jobTitle || ''}" />
        </div>

        <div class="crm-form-group">
          <label>Phone Number</label>
          <input type="tel" id="crm-phone-number" class="crm-input" placeholder="e.g., (555) 123-4567" value="${deal.phoneNumber || ''}" />
        </div>

        <div class="crm-form-group">
          <label>Company Name</label>
          <input type="text" id="crm-company-name" class="crm-input" placeholder="e.g., Acme Corp" value="${deal.companyGuess || this.guessCompanyFromEmail(deal.contactEmail) || ''}" />
        </div>

        <div class="crm-form-group">
          <label>Company Website</label>
          <input type="url" id="crm-company-website" class="crm-input" placeholder="https://example.com" value="${deal.companyWebsite || this.guessWebsiteFromEmail(deal.contactEmail) || ''}" />
        </div>

        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-enrich">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-enrich">Save Enriched Data</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-enrich').addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-enrich').addEventListener('click', async () => {
      deal.linkedInProfile = document.getElementById('crm-linkedin-url').value.trim();
      deal.jobTitle = document.getElementById('crm-job-title').value.trim();
      deal.phoneNumber = document.getElementById('crm-phone-number').value.trim();
      deal.companyGuess = document.getElementById('crm-company-name').value.trim();
      deal.companyWebsite = document.getElementById('crm-company-website').value.trim();
      deal.emailDomain = this.extractEmailDomain(deal.contactEmail);
      deal.lastEnriched = new Date().toISOString();

      await this.saveDeal(deal);
      await this.addAutomationComment(dealId, `🔍 Contact manually enriched with additional information`);

      modal.remove();
      this.showNotification('✅ Contact enriched successfully!');
    });
  }

  renderContactEnrichmentWidget(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return '';

    const hasEnrichedData = deal.linkedInProfile || deal.jobTitle || deal.phoneNumber || deal.companyGuess;

    return `
      <div class="crm-enrichment-widget">
        <div class="crm-section-title">🔍 Contact Information</div>

        ${hasEnrichedData ? `
          <div style="font-size: 13px; margin: 8px 0;">
            ${deal.jobTitle ? `<div style="margin-bottom: 4px;"><strong>Title:</strong> ${deal.jobTitle}</div>` : ''}
            ${deal.companyGuess ? `<div style="margin-bottom: 4px;"><strong>Company:</strong> ${deal.companyGuess}</div>` : ''}
            ${deal.phoneNumber ? `<div style="margin-bottom: 4px;"><strong>Phone:</strong> ${deal.phoneNumber}</div>` : ''}
            ${deal.linkedInProfile ? `<div style="margin-bottom: 4px;"><strong>LinkedIn:</strong> <a href="${deal.linkedInProfile}" target="_blank" style="color: #1a73e8;">View Profile</a></div>` : ''}
            ${deal.companyWebsite ? `<div style="margin-bottom: 4px;"><strong>Website:</strong> <a href="${deal.companyWebsite}" target="_blank" style="color: #1a73e8;">${deal.companyWebsite}</a></div>` : ''}
          </div>
        ` : `
          <p style="color: #5f6368; font-size: 13px; margin: 8px 0;">No enriched data yet</p>
        `}

        <button class="crm-btn-small" onclick="window.gmailCRM.showContactEnrichmentDialog('${dealId}')">
          ${hasEnrichedData ? 'Update Info' : 'Add Contact Info'}
        </button>
      </div>
    `;
  }

  showPipelineEditor(pipeline = null) {
    const isNew = !pipeline;
    const editPipeline = pipeline || {
      id: 'pipeline_' + Date.now(),
      name: '',
      stages: [{ id: 'stage_1', name: '', color: '#4285f4' }]
    };

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content crm-pipeline-editor">
        <h2>${isNew ? 'Create Pipeline' : 'Edit Pipeline'}</h2>

        <div class="crm-form-group">
          <label>Pipeline Name</label>
          <input type="text" id="crm-pipeline-name" class="crm-input" value="${editPipeline.name}" />
        </div>

        <div class="crm-form-group">
          <label>Stages</label>
          <div id="crm-stages-editor"></div>
          <button class="crm-btn" id="crm-add-stage">+ Add Stage</button>
        </div>

        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-pipeline">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-pipeline">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const renderStages = () => {
      const container = document.getElementById('crm-stages-editor');
      container.innerHTML = editPipeline.stages.map((stage, idx) => `
        <div class="crm-stage-edit-row">
          <input type="color" value="${stage.color}" data-idx="${idx}" class="crm-stage-color" />
          <input type="text" value="${stage.name}" data-idx="${idx}" class="crm-stage-name-input" placeholder="Stage name" />
          <button class="crm-btn-icon" data-idx="${idx}" data-action="remove">×</button>
        </div>
      `).join('');

      container.querySelectorAll('.crm-stage-color').forEach(input => {
        input.addEventListener('change', (e) => {
          editPipeline.stages[e.target.dataset.idx].color = e.target.value;
        });
      });

      container.querySelectorAll('.crm-stage-name-input').forEach(input => {
        input.addEventListener('input', (e) => {
          editPipeline.stages[e.target.dataset.idx].name = e.target.value;
        });
      });

      container.querySelectorAll('[data-action="remove"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          editPipeline.stages.splice(e.target.dataset.idx, 1);
          renderStages();
        });
      });
    };

    renderStages();

    document.getElementById('crm-add-stage').addEventListener('click', () => {
      editPipeline.stages.push({
        id: 'stage_' + Date.now(),
        name: '',
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      });
      renderStages();
    });

    document.getElementById('crm-cancel-pipeline').addEventListener('click', () => modal.remove());

    document.getElementById('crm-save-pipeline').addEventListener('click', () => {
      editPipeline.name = document.getElementById('crm-pipeline-name').value;

      if (isNew) {
        this.pipelines.push(editPipeline);
      } else {
        const idx = this.pipelines.findIndex(p => p.id === editPipeline.id);
        if (idx !== -1) this.pipelines[idx] = editPipeline;
      }

      chrome.storage.local.set({ pipelines: this.pipelines }, () => {
        modal.remove();
        this.renderPipelinesList();
        if (this.currentPipeline?.id === editPipeline.id) {
          this.renderPipelineBoard();
        }
      });
    });
  }

  observeNavigation() {
    window.addEventListener('popstate', () => {
      if (!location.hash.startsWith('#crm/')) {
        this.closePipelineView();
      }
    });

    // Clicking Gmail inbox should close pipeline view
    document.addEventListener('click', (e) => {
      if (e.target.closest('a[href="#inbox"]')) {
        this.closePipelineView();
      }
    });
  }

  closePipelineView() {
    const pipelineView = document.getElementById('crm-pipeline-view');
    if (pipelineView) {
      pipelineView.remove();
    }

    const gmailMain = document.querySelector('div[role="main"]');
    if (gmailMain) {
      gmailMain.style.display = '';
    }

    this.currentPipeline = null;
    this.renderPipelinesList();
  }

  observeEmailView() {
    // Add toggle button
    this.injectSidebarToggleButton();

    // Use MutationObserver to detect when emails are opened/closed
    const observer = new MutationObserver(() => {
      this.updateToggleButtonVisibility();
    });

    // Observe the main content area
    const gmailMain = document.querySelector('div[role="main"]');
    if (gmailMain) {
      observer.observe(gmailMain, {
        childList: true,
        subtree: true
      });
    }

    // Also check immediately
    setTimeout(() => this.updateToggleButtonVisibility(), 1000);
  }

  injectSidebarToggleButton() {
    // Check if button already exists
    if (document.getElementById('crm-sidebar-toggle-btn')) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'crm-sidebar-toggle-btn';
    toggleBtn.className = 'crm-sidebar-toggle-btn';
    toggleBtn.innerHTML = '🔗';
    toggleBtn.title = 'Link Email to Deal';

    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
      const emailMetadata = this.extractEmailMetadata();
      if (emailMetadata) {
        const sidebar = document.getElementById('crm-email-deals-sidebar');
        if (sidebar && sidebar.style.display === 'flex') {
          sidebar.style.display = 'none';
          toggleBtn.classList.remove('active');
        } else {
          this.showEmailDealsSidebar(emailMetadata);
          toggleBtn.classList.add('active');
        }
      } else {
        alert('Please open an email first to link it to a deal.');
      }
    });
  }

  updateToggleButtonVisibility() {
    const toggleBtn = document.getElementById('crm-sidebar-toggle-btn');
    if (!toggleBtn) return;

    // Always show the button
    toggleBtn.style.display = 'flex';

    // Check if we're viewing an email - if not, close sidebar
    const emailMetadata = this.extractEmailMetadata();
    if (!emailMetadata) {
      // Not viewing an email, close sidebar if open
      const sidebar = document.getElementById('crm-email-deals-sidebar');
      if (sidebar) {
        sidebar.style.display = 'none';
      }
      toggleBtn.classList.remove('active');
    }
  }

  extractEmailMetadata() {
    try {
      // Find email view container
      const emailView = document.querySelector('.nH.aHU') || document.querySelector('div[role="main"]');
      if (!emailView) return null;

      // Check if we're viewing an email (look for email subject)
      const subjectEl = emailView.querySelector('h2.hP') || emailView.querySelector('.hP');
      if (!subjectEl) return null;

      const subject = subjectEl?.textContent?.trim() || 'No Subject';

      // Extract sender
      const senderEl = emailView.querySelector('.gD') || emailView.querySelector('span[email]');
      const from = senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || 'Unknown Sender';

      // Extract date
      const dateEl = emailView.querySelector('.g3') || emailView.querySelector('span[title]');
      const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || new Date().toISOString();

      // Try to get thread ID from URL
      const urlMatch = window.location.hash.match(/\/([a-f0-9]+)$/);
      const threadId = urlMatch ? urlMatch[1] : null;

      return {
        subject,
        from,
        date,
        threadId,
        url: window.location.href
      };
    } catch (e) {
      console.error('Gmail CRM: Error extracting email metadata:', e);
      return null;
    }
  }

  injectEmailLinkUI(emailView, emailMetadata) {
    // Find the email header area
    const emailHeader = emailView.querySelector('.adn.ads') || emailView.querySelector('div[role="main"]');
    if (!emailHeader) return;

    // Create link bar
    const linkBar = document.createElement('div');
    linkBar.id = 'crm-email-link-bar';
    linkBar.className = 'crm-email-link-bar';

    // Check if this email is already linked to deals
    const linkedDeals = this.getDealsLinkedToEmail(emailMetadata.threadId);

    linkBar.innerHTML = `
      <div class="crm-email-link-content">
        <span class="crm-email-link-icon">🔗</span>
        <span class="crm-email-link-label">Add to Deal:</span>
        <div class="crm-deal-search-wrapper">
          <input type="text"
                 id="crm-deal-search-input"
                 class="crm-deal-search-input"
                 placeholder="Search for a deal..."
                 autocomplete="off" />
          <div id="crm-deal-search-results" class="crm-deal-search-results" style="display: none;"></div>
        </div>
        ${linkedDeals.length > 0 ? `
          <div class="crm-linked-deals">
            ${linkedDeals.map(deal => `
              <span class="crm-linked-deal-tag" data-deal-id="${deal.id}">
                ${deal.emailSubject || 'Unnamed Deal'}
                <button class="crm-unlink-email" data-deal-id="${deal.id}" title="Unlink">×</button>
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Insert at the top of email view
    const insertTarget = emailView.querySelector('.nH.aHU') || emailView.firstChild;
    if (insertTarget) {
      insertTarget.insertBefore(linkBar, insertTarget.firstChild);
    } else {
      emailView.insertBefore(linkBar, emailView.firstChild);
    }

    // Setup search functionality
    this.setupDealSearch(emailMetadata);

    // Setup unlink buttons
    linkBar.querySelectorAll('.crm-unlink-email').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dealId = btn.dataset.dealId;
        this.unlinkEmailFromDeal(dealId, emailMetadata);
      });
    });
  }

  injectVoiceAssistant() {
    // Check if already injected
    if (document.getElementById('floating-voice-assistant')) {
      return;
    }

    // Wait for voice control to be ready
    if (!window.voiceControl) {
      console.warn('Voice control not initialized yet, retrying...');
      setTimeout(() => this.injectVoiceAssistant(), 1000);
      return;
    }

    // Create floating voice assistant container
    const assistant = document.createElement('div');
    assistant.id = 'floating-voice-assistant';

    assistant.innerHTML = `
      <div id="voice-commands-hint" style="display: none;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #667eea;">Voice Commands:</div>
        <div style="font-size: 11px; line-height: 1.6; color: #5f6368;">
          • "Create new deal for [name]"<br>
          • "Add this to [deal name] deal"<br>
          • "Make [person] the champion"<br>
          • "Set value to $[amount]"<br>
          • "Move to [stage]"<br>
          • "Add note [text]"<br>
          • "Search for [query]"<br>
          • "Show all deals"
        </div>
      </div>
      <button id="voice-assistant-button" title="Voice Assistant (Effortless)">
        🎤
      </button>
    `;

    document.body.appendChild(assistant);

    const button = document.getElementById('voice-assistant-button');
    const hint = document.getElementById('voice-commands-hint');

    // Show/hide hints on hover
    let hintTimeout;
    button.addEventListener('mouseenter', () => {
      clearTimeout(hintTimeout);
      hint.style.display = 'block';
    });

    button.addEventListener('mouseleave', () => {
      hintTimeout = setTimeout(() => {
        hint.style.display = 'none';
      }, 300);
    });

    hint.addEventListener('mouseenter', () => {
      clearTimeout(hintTimeout);
    });

    hint.addEventListener('mouseleave', () => {
      hintTimeout = setTimeout(() => {
        hint.style.display = 'none';
      }, 300);
    });

    // Main voice button click handler
    button.addEventListener('click', () => {
      if (window.voiceControl.isListening) {
        window.voiceControl.stopListening();
        button.classList.remove('listening');
        button.textContent = '🎤';
      } else {
        // Determine context based on current view
        let context = { type: 'general' };

        // Check if we're viewing an email
        const emailView = document.querySelector('div[role="main"][aria-label*="Message"]');
        if (emailView) {
          const emailMetadata = this.extractEmailMetadata(emailView);
          if (emailMetadata) {
            context = {
              type: 'email',
              emailMetadata: emailMetadata
            };
          }
        }

        // Start listening with context
        window.voiceControl.startListening(context);
        button.classList.add('listening');
        button.textContent = '🔴';
      }
    });

    // Listen for voice control state changes
    window.voiceControl.onStateChange = (isListening) => {
      if (isListening) {
        button.classList.add('listening');
        button.textContent = '🔴';
      } else {
        button.classList.remove('listening');
        button.textContent = '🎤';
      }
    };

    console.log('Voice assistant injected successfully');
  }

  injectVisualExecutionSidebar() {
    // Check if already injected
    if (document.getElementById('voice-execution-sidebar')) {
      return;
    }

    const sidebar = document.createElement('div');
    sidebar.id = 'voice-execution-sidebar';
    sidebar.className = 'voice-execution-sidebar'; // Start expanded so user can see it

    sidebar.innerHTML = `
      <div class="voice-sidebar-header">
        <h3>Voice Assistant</h3>
        <div class="voice-sidebar-controls">
          <button class="voice-sidebar-collapse" title="Collapse">◀</button>
        </div>
      </div>
      <div class="voice-sidebar-content">
        <div class="voice-content-main">
          <div class="voice-execution-steps"></div>
          <div class="voice-pipeline-visualization"></div>
        </div>
        <div class="voice-mic-container">
          <div class="voice-transcript-area">
            <div class="voice-transcript-header">
              <div class="voice-transcript-label">Listening...</div>
              <div class="voice-processing-mode"></div>
            </div>
            <div class="voice-transcript-text"></div>
            <div class="voice-parsed-command"></div>
          </div>
          <button class="voice-mic-button" title="Click to start/stop listening">🎤</button>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Setup toggle button
    const collapseBtn = sidebar.querySelector('.voice-sidebar-collapse');
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // Setup mic button
    const micBtn = sidebar.querySelector('.voice-mic-button');
    const transcriptArea = sidebar.querySelector('.voice-transcript-area');
    const transcriptLabel = sidebar.querySelector('.voice-transcript-label');
    const transcriptText = sidebar.querySelector('.voice-transcript-text');
    const parsedCommand = sidebar.querySelector('.voice-parsed-command');

    // Wait for voice control to be ready
    const setupMicButton = () => {
      if (!window.voiceControl) {
        setTimeout(setupMicButton, 500);
        return;
      }

      micBtn.addEventListener('click', () => {
        if (window.voiceControl.isListening) {
          // Stop listening
          window.voiceControl.stopListening();
          micBtn.textContent = '🎤';
          micBtn.classList.remove('listening');
          transcriptArea.style.display = 'none';
        } else {
          // Start listening
          window.voiceControl.startListening();
          micBtn.textContent = '🔴';
          micBtn.classList.add('listening');
          transcriptArea.style.display = 'block';
          transcriptText.textContent = '';
          parsedCommand.textContent = '';
          transcriptLabel.textContent = 'Listening...';

          // Expand sidebar when starting to listen
          sidebar.classList.remove('collapsed');
          collapseBtn.textContent = '◀';
        }
      });

      // Update mic button when voice control state changes
      setInterval(() => {
        if (window.voiceControl.isListening) {
          micBtn.textContent = '🔴';
          micBtn.classList.add('listening');
        } else {
          micBtn.textContent = '🎤';
          micBtn.classList.remove('listening');
        }
      }, 500);
    };

    setupMicButton();

    // Add floating toggle button
    const floatingToggle = document.createElement('div');
    floatingToggle.id = 'sidebar-toggle-bubble';
    floatingToggle.className = 'sidebar-toggle-bubble';
    floatingToggle.innerHTML = '📊';
    floatingToggle.title = 'Toggle Execution Sidebar';
    floatingToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      collapseBtn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });
    document.body.appendChild(floatingToggle);

    console.log('Visual execution sidebar injected');

    // Make it globally accessible for voice commands
    window.visualExecutionSidebar = {
      expand: () => {
        sidebar.classList.remove('collapsed');
        collapseBtn.textContent = '◀';
      },
      collapse: () => {
        sidebar.classList.add('collapsed');
        collapseBtn.textContent = '▶';
      },
      showStep: (stepText, status = 'progress') => {
        const stepsContainer = sidebar.querySelector('.voice-execution-steps');
        const statusIcons = {
          progress: '⏳',
          success: '✅',
          error: '❌'
        };

        const stepEl = document.createElement('div');
        stepEl.className = `voice-exec-step ${status}`;
        stepEl.innerHTML = `
          <span class="voice-exec-icon">${statusIcons[status]}</span>
          <span class="voice-exec-text">${stepText}</span>
        `;

        stepsContainer.appendChild(stepEl);
        stepsContainer.scrollTop = stepsContainer.scrollHeight;

        return stepEl;
      },
      clearSteps: () => {
        const stepsContainer = sidebar.querySelector('.voice-execution-steps');
        stepsContainer.innerHTML = '';
      },
      updateTranscript: (text) => {
        transcriptText.textContent = text;
        transcriptLabel.textContent = 'You said:';
      },
      updateParsedCommand: (commandInfo) => {
        parsedCommand.innerHTML = `<strong>Parsed:</strong> ${commandInfo}`;
      },
      setProcessingMode: (mode) => {
        const modeIndicator = sidebar.querySelector('.voice-processing-mode');
        if (mode === 'gemini') {
          modeIndicator.innerHTML = '<span class="mode-badge mode-gemini">🤖 Gemini AI</span>';
        } else if (mode === 'pattern') {
          modeIndicator.innerHTML = '<span class="mode-badge mode-pattern">🔧 Pattern Match</span>';
        } else {
          modeIndicator.innerHTML = '';
        }
      },
      showTranscriptArea: () => {
        transcriptArea.style.display = 'block';
      },
      hideTranscriptArea: () => {
        transcriptArea.style.display = 'none';
      },
      showPipelineView: (pipeline, highlightStageId = null) => {
        const vizContainer = sidebar.querySelector('.voice-pipeline-visualization');

        vizContainer.innerHTML = `
          <div class="voice-pipeline-header">
            <h4>${pipeline.name}</h4>
          </div>
          <div class="voice-pipeline-stages">
            ${pipeline.stages.map(stage => `
              <div class="voice-stage ${highlightStageId === stage.id ? 'highlighted' : ''}"
                   data-stage-id="${stage.id}">
                <div class="voice-stage-name">${stage.name}</div>
                <div class="voice-stage-deals" id="voice-stage-${stage.id}"></div>
              </div>
            `).join('')}
          </div>
        `;
      },
      addDealToStage: (deal, stageId, highlight = false) => {
        const stageContainer = sidebar.querySelector(`#voice-stage-${stageId}`);
        if (!stageContainer) return;

        const dealCard = document.createElement('div');
        dealCard.className = `voice-deal-card ${highlight ? 'highlight-pulse' : ''}`;
        dealCard.innerHTML = `
          <div class="voice-deal-title">${deal.emailSubject || deal.company}</div>
          <div class="voice-deal-value">$${deal.value || 0}</div>
        `;

        stageContainer.appendChild(dealCard);

        if (highlight) {
          setTimeout(() => dealCard.classList.remove('highlight-pulse'), 2000);
        }
      }
    };
  }

  injectDevHelper() {
    // Get manifest version
    const manifest = chrome.runtime.getManifest();
    const version = manifest.version;

    // Create dev badge
    const devBadge = document.createElement('div');
    devBadge.id = 'crm-dev-badge';
    devBadge.className = 'crm-dev-badge';
    devBadge.innerHTML = `
      <div class="dev-badge-content">
        <div class="dev-badge-title">DEV MODE</div>
        <div class="dev-badge-version">v${version}</div>
        <div class="dev-badge-hint">Ctrl+Shift+R to reload</div>
      </div>
    `;

    document.body.appendChild(devBadge);

    // Add keyboard shortcut listener
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+R (or Cmd+Shift+R on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.reloadExtension();
      }
    });

    // Add global console command
    window.reloadExtension = () => this.reloadExtension();

    console.log('🔧 Development Helper Loaded');
    console.log('📋 Current Version:', version);
    console.log('⌨️  Keyboard Shortcut: Ctrl+Shift+R (Cmd+Shift+R on Mac)');
    console.log('💻 Console Command: reloadExtension()');
  }

  reloadExtension() {
    console.log('🔄 Reloading page to test changes...');

    // Show reload notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      z-index: 999999;
      font-size: 14px;
      font-weight: 600;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = '🔄 Reloading Page...';
    document.body.appendChild(notification);

    // Reload the page - extension will reinitialize
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  getDealsLinkedToEmail(threadId) {
    if (!threadId) return [];

    return Object.values(this.deals).filter(deal => {
      return deal.linkedEmails?.some(email => email.threadId === threadId);
    });
  }

  setupDealSearch(emailMetadata) {
    const searchInput = document.getElementById('crm-deal-search-input');
    const resultsDiv = document.getElementById('crm-deal-search-results');
    if (!searchInput || !resultsDiv) return;

    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim().toLowerCase();

      if (query.length < 1) {
        resultsDiv.style.display = 'none';
        return;
      }

      searchTimeout = setTimeout(() => {
        this.performDealSearch(query, resultsDiv, emailMetadata);
      }, 300);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 1) {
        resultsDiv.style.display = 'block';
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.crm-deal-search-wrapper')) {
        resultsDiv.style.display = 'none';
      }
    });
  }

  performDealSearch(query, resultsDiv, emailMetadata) {
    const allDeals = Object.values(this.deals);

    // Filter deals by query
    const matches = allDeals.filter(deal => {
      const subject = (deal.emailSubject || '').toLowerCase();
      const company = (deal.company || '').toLowerCase();
      const pipeline = this.pipelines.find(p => p.id === deal.pipelineId);
      const pipelineName = (pipeline?.name || '').toLowerCase();

      return subject.includes(query) ||
             company.includes(query) ||
             pipelineName.includes(query);
    }).slice(0, 10); // Limit to 10 results

    if (matches.length === 0) {
      resultsDiv.innerHTML = '<div class="crm-deal-search-empty">No deals found</div>';
      resultsDiv.style.display = 'block';
      return;
    }

    resultsDiv.innerHTML = matches.map(deal => {
      const pipeline = this.pipelines.find(p => p.id === deal.pipelineId);
      const stage = pipeline?.stages.find(s => s.id === deal.stageId);
      const isLinked = deal.linkedEmails?.some(e => e.threadId === emailMetadata.threadId);

      return `
        <div class="crm-deal-search-result ${isLinked ? 'linked' : ''}" data-deal-id="${deal.id}">
          <div class="crm-deal-search-title">${deal.emailSubject || 'Unnamed Deal'}</div>
          <div class="crm-deal-search-meta">
            ${pipeline?.name || 'Unknown Pipeline'} • ${stage?.name || 'Unknown Stage'}
            ${isLinked ? ' • <span class="crm-linked-badge">✓ Linked</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    resultsDiv.style.display = 'block';

    // Add click handlers
    resultsDiv.querySelectorAll('.crm-deal-search-result').forEach(result => {
      result.addEventListener('click', () => {
        const dealId = result.dataset.dealId;
        this.linkEmailToDeal(dealId, emailMetadata);
        resultsDiv.style.display = 'none';
        document.getElementById('crm-deal-search-input').value = '';
      });
    });
  }

  async createDealFromEmail(pipelineId, emailMetadata) {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) {
      this.showNotification('❌ Pipeline not found');
      return;
    }

    const dealId = 'deal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const firstStage = pipeline.stages[0];

    // Create deal from email
    const deal = {
      id: dealId,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      emailSubject: emailMetadata.subject,
      company: this.extractCompanyFromEmail(emailMetadata),
      institution: this.extractCompanyFromEmail(emailMetadata),
      contactName: emailMetadata.from.split('<')[0].trim(),
      contactEmail: emailMetadata.from.match(/<(.+)>/)?.[1] || emailMetadata.from,
      linkedEmails: [{
        subject: emailMetadata.subject,
        from: emailMetadata.from,
        date: emailMetadata.date,
        threadId: emailMetadata.threadId,
        url: emailMetadata.url,
        linkedAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'Active'
    };

    await this.saveDeal(deal);
    this.showNotification(`✅ Deal created in ${pipeline.name}`);

    // Refresh view if we're looking at this pipeline
    if (this.currentPipeline && this.currentPipeline.id === pipelineId) {
      this.renderPipelineBoard();
    }
  }

  extractCompanyFromEmail(emailMetadata) {
    // Try to extract company from email domain
    const email = emailMetadata.from.match(/<(.+)>/)?.[1] || emailMetadata.from;
    const domain = email.split('@')[1];

    if (!domain) return emailMetadata.from.split('<')[0].trim();

    // Remove common email providers
    const commonProviders = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'aol'];
    const domainParts = domain.split('.');
    const mainDomain = domainParts[0];

    if (commonProviders.includes(mainDomain.toLowerCase())) {
      // Use sender name instead
      return emailMetadata.from.split('<')[0].trim();
    }

    // Capitalize first letter of domain
    return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
  }

  async linkEmailToDeal(dealId, emailMetadata) {
    const deal = this.deals[dealId];
    if (!deal) return;

    // Initialize linkedEmails array if it doesn't exist
    if (!deal.linkedEmails) {
      deal.linkedEmails = [];
    }

    // Check if already linked
    if (deal.linkedEmails.some(e => e.threadId === emailMetadata.threadId)) {
      this.showNotification('Email already linked to this deal');
      return;
    }

    // Add email to deal
    deal.linkedEmails.push({
      subject: emailMetadata.subject,
      from: emailMetadata.from,
      date: emailMetadata.date,
      threadId: emailMetadata.threadId,
      url: emailMetadata.url,
      linkedAt: new Date().toISOString()
    });

    await this.saveDeal(deal);
    this.showNotification(`Email linked to "${deal.emailSubject || 'deal'}"`);

    // Refresh the email link bar
    const existingBar = document.getElementById('crm-email-link-bar');
    if (existingBar) {
      existingBar.remove();
    }
    this.checkAndInjectEmailLinkUI();
  }

  async unlinkEmailFromDeal(dealId, emailMetadata) {
    const deal = this.deals[dealId];
    if (!deal || !deal.linkedEmails) return;

    deal.linkedEmails = deal.linkedEmails.filter(e => e.threadId !== emailMetadata.threadId);

    await this.saveDeal(deal);
    this.showNotification('Email unlinked from deal');
    // Refresh the sidebar
    this.checkAndInjectEmailLinkUI();
  }

  showEmailDealsSidebar(emailMetadata) {
    // Check if sidebar already exists
    let sidebar = document.getElementById('crm-email-deals-sidebar');

    if (!sidebar) {
      // Create sidebar
      sidebar = document.createElement('div');
      sidebar.id = 'crm-email-deals-sidebar';
      sidebar.className = 'crm-email-deals-sidebar streak-style';
      document.body.appendChild(sidebar);
    }

    sidebar.style.display = 'flex';
    this.currentEmailMetadata = emailMetadata;

    // Get linked deals for this email
    const linkedDeals = this.getDealsLinkedToEmail(emailMetadata.threadId);
    const linkedDealIds = new Set(linkedDeals.map(d => d.id));

    // Group deals by pipeline
    const dealsByPipeline = {};
    this.pipelines.forEach(pipeline => {
      const pipelineDeals = Object.values(this.deals).filter(d => d.pipelineId === pipeline.id);
      if (pipelineDeals.length > 0) {
        dealsByPipeline[pipeline.id] = {
          pipeline,
          deals: pipelineDeals
        };
      }
    });

    // Pipeline icons mapping
    const pipelineIcons = {
      'sales': '💰',
      'fundraising': '💵',
      'series': '💵',
      'investor': '💵',
      'partnerships': '🤝',
      'hiring': '👥',
      'research': '🔬',
      'surgical': '⚕️',
      'spine': '🦴',
      'cranial': '🧠',
      'leads': '📧',
      'website': '🌐',
      'renewals': '🔄',
      'manufacturer': '🏭',
      'reseller': '🏪',
      'body': '👤',
      'default': '📊'
    };

    const getPipelineIcon = (name) => {
      const lowerName = name.toLowerCase();
      for (const [key, icon] of Object.entries(pipelineIcons)) {
        if (lowerName.includes(key)) return icon;
      }
      return pipelineIcons.default;
    };

    const getStageColor = (stageName) => {
      const lower = stageName.toLowerCase();
      if (lower.includes('won') || lower.includes('closed')) return '#34a853';
      if (lower.includes('lost')) return '#ea4335';
      if (lower.includes('proposal') || lower.includes('contract')) return '#4285f4';
      if (lower.includes('qualified')) return '#fbbc04';
      return '#5f6368';
    };

    sidebar.innerHTML = `
      <div class="streak-sidebar-header">
        <div class="streak-header-title">
          <button class="streak-back-btn" id="crm-close-email-sidebar">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 14l-4-4 4-4" stroke="currentColor" fill="none" stroke-width="2"/></svg>
          </button>
          <span>Add ${emailMetadata.subject.substring(0, 30)}${emailMetadata.subject.length > 30 ? '...' : ''}</span>
        </div>
      </div>

      <div class="streak-sidebar-content">
        <div class="streak-search-container">
          <svg class="streak-search-icon" width="16" height="16" viewBox="0 0 16 16">
            <path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM15 15l-4-4" stroke="currentColor" fill="none" stroke-width="1.5"/>
          </svg>
          <input type="text"
                 id="crm-email-sidebar-search"
                 class="streak-search-input"
                 placeholder="Search for an existing box" />
        </div>

        ${Object.keys(dealsByPipeline).length > 0 ? `
          <div class="streak-section">
            <div class="streak-section-title">Select existing</div>
            ${Object.values(dealsByPipeline).map(({ pipeline, deals }) => `
              <div class="streak-pipeline-group">
                <div class="streak-pipeline-name">${pipeline.name.toUpperCase()}</div>
                ${deals.slice(0, 5).map(deal => {
                  const isLinked = linkedDealIds.has(deal.id);
                  const stage = pipeline.stages.find(s => s.id === deal.stageId);
                  return `
                    <div class="streak-deal-item ${isLinked ? 'linked' : ''}" data-deal-id="${deal.id}">
                      <div class="streak-deal-checkbox">
                        <input type="checkbox"
                               class="crm-deal-checkbox"
                               ${isLinked ? 'checked' : ''} />
                      </div>
                      <div class="streak-deal-info">
                        <div class="streak-deal-name">${deal.company || deal.institution || deal.emailSubject || 'Unnamed'}</div>
                        ${stage ? `<span class="streak-stage-badge" style="background-color: ${getStageColor(stage.name)}">${stage.name}</span>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="streak-section">
          <div class="streak-section-title">Create new box in</div>
          <div class="streak-pipeline-grid">
            ${this.pipelines.map(pipeline => `
              <button class="streak-pipeline-card" data-pipeline-id="${pipeline.id}">
                <div class="streak-pipeline-icon">${getPipelineIcon(pipeline.name)}</div>
                <div class="streak-pipeline-label">${pipeline.name}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Close button
    document.getElementById('crm-close-email-sidebar')?.addEventListener('click', () => {
      sidebar.style.display = 'none';
      const toggleBtn = document.getElementById('crm-sidebar-toggle-btn');
      if (toggleBtn) toggleBtn.classList.remove('active');
    });

    // Search functionality
    const searchInput = document.getElementById('crm-email-sidebar-search');
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const dealItems = sidebar.querySelectorAll('.streak-deal-item');

      dealItems.forEach(item => {
        const dealName = item.querySelector('.streak-deal-name').textContent.toLowerCase();
        if (dealName.includes(query) || query === '') {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });

      // Hide empty pipeline groups
      const pipelineGroups = sidebar.querySelectorAll('.streak-pipeline-group');
      pipelineGroups.forEach(group => {
        const visibleDeals = group.querySelectorAll('.streak-deal-item:not([style*="display: none"])');
        group.style.display = visibleDeals.length > 0 ? '' : 'none';
      });
    });

    // Checkbox change listeners
    const checkboxes = sidebar.querySelectorAll('.crm-deal-checkbox');
    checkboxes.forEach(checkbox => {
      const dealItem = checkbox.closest('.streak-deal-item');
      const dealId = dealItem.dataset.dealId;

      checkbox.addEventListener('change', (e) => {
        if (checkbox.checked) {
          this.linkEmailToDeal(dealId, emailMetadata);
          dealItem.classList.add('linked');
        } else {
          this.unlinkEmailFromDeal(dealId, emailMetadata);
          dealItem.classList.remove('linked');
        }
      });
    });

    // Pipeline card clicks - create new deal
    const pipelineCards = sidebar.querySelectorAll('.streak-pipeline-card');
    pipelineCards.forEach(card => {
      card.addEventListener('click', () => {
        const pipelineId = card.dataset.pipelineId;
        this.createDealFromEmail(pipelineId, emailMetadata);
        sidebar.style.display = 'none';
        const toggleBtn = document.getElementById('crm-sidebar-toggle-btn');
        if (toggleBtn) toggleBtn.classList.remove('active');
      });
    });
  }

  async updateDealStatus(dealId, newStatus) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const oldStatus = deal.status || 'Active';

    // Initialize status history if it doesn't exist
    if (!deal.statusHistory) {
      deal.statusHistory = [];
    }

    // Add to history
    deal.statusHistory.push({
      status: oldStatus,
      changedAt: new Date().toISOString(),
      changedTo: newStatus
    });

    // Update current status
    deal.status = newStatus;
    deal.lastUpdated = new Date().toISOString();

    await this.saveDeal(deal);
    this.showNotification(`Status updated: ${oldStatus} → ${newStatus}`);

    // Refresh sidebar if it's showing this deal
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (sidebar && sidebar.classList.contains('active') && sidebar.dataset.dealId === dealId) {
      this.showDealSidebar(dealId);
    }
  }

  showDealSidebar(dealId, viewMode = 'timeline') {
    const deal = this.deals[dealId];
    if (!deal) return;

    const sidebar = document.getElementById('crm-deal-sidebar');
    if (!sidebar) return;

    sidebar.classList.add('active');
    sidebar.dataset.dealId = dealId;
    sidebar.dataset.viewMode = viewMode;

    // Shift main content left
    const pipelineContainer = document.getElementById('crm-pipeline-view');
    if (pipelineContainer) {
      pipelineContainer.classList.add('sidebar-open');
    }

    // Render sidebar content based on view mode
    if (viewMode === 'timeline') {
      this.renderDealSidebarTimeline(deal);
    } else {
      this.renderDealSidebarKanban(deal);
    }
  }

  closeDealSidebar() {
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (sidebar) {
      sidebar.classList.remove('active');
      sidebar.dataset.dealId = '';
      sidebar.dataset.viewMode = '';
    }

    // Remove shift from main content
    const pipelineContainer = document.getElementById('crm-pipeline-view');
    if (pipelineContainer) {
      pipelineContainer.classList.remove('sidebar-open');
    }

    // Also close email preview if open
    this.closeEmailPreview();
  }

  showEmailPreview(email) {
    // Remove existing preview if any
    this.closeEmailPreview();

    // Create email preview panel
    const panel = document.createElement('div');
    panel.id = 'email-preview-panel';
    panel.className = 'email-preview-panel';

    panel.innerHTML = `
      <div class="email-preview-header">
        <div class="email-preview-title">${email.subject || 'No Subject'}</div>
        <button class="email-preview-close" id="email-preview-close-btn">×</button>
      </div>
      <div class="email-preview-content">
        <div class="email-preview-from"><strong>From:</strong> ${email.from || 'Unknown'}</div>
        <div class="email-preview-date"><strong>Date:</strong> ${new Date(email.date).toLocaleString()}</div>
        <div class="email-preview-body">
          ${email.body ? email.body.replace(/\n/g, '<br>') : 'Email body not available. <a href="' + (email.url || '#') + '" target="_blank">Open in Gmail</a>'}
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Show panel with animation
    setTimeout(() => {
      panel.classList.add('visible');
    }, 10);

    // Close button handler
    document.getElementById('email-preview-close-btn')?.addEventListener('click', () => {
      this.closeEmailPreview();
    });
  }

  closeEmailPreview() {
    const panel = document.getElementById('email-preview-panel');
    if (panel) {
      panel.classList.remove('visible');
      setTimeout(() => panel.remove(), 300);
    }
  }

  renderTasksSection(deal) {
    const tasks = deal.tasks || [];
    const now = new Date();

    if (tasks.length === 0) {
      return '<p class="crm-empty-state">No tasks yet</p>';
    }

    // Sort tasks: incomplete first, then by due date
    const sortedTasks = tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    return `
      <div class="crm-tasks-list">
        ${sortedTasks.map((task, idx) => {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const isOverdue = dueDate && dueDate < now && !task.completed;
          const isDueToday = dueDate && dueDate.toDateString() === now.toDateString();

          return `
            <div class="crm-task-item ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-task-idx="${idx}">
              <input type="checkbox" class="crm-task-checkbox" ${task.completed ? 'checked' : ''} data-task-idx="${idx}">
              <div class="crm-task-content">
                <div class="crm-task-title">${task.title}</div>
                ${task.description ? `<div class="crm-task-description">${task.description}</div>` : ''}
                <div class="crm-task-meta">
                  ${dueDate ? `
                    <span class="crm-task-due ${isOverdue ? 'overdue-text' : ''} ${isDueToday ? 'due-today' : ''}">
                      ${isOverdue ? '⚠️ ' : isDueToday ? '📅 ' : ''}
                      ${dueDate.toLocaleDateString()}
                    </span>
                  ` : ''}
                  ${task.assignedTo ? `<span class="crm-task-assigned">👤 ${task.assignedTo}</span>` : ''}
                  ${task.priority ? `<span class="crm-task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span>` : ''}
                </div>
              </div>
              <button class="crm-btn-icon-tiny" data-delete-task-idx="${idx}" title="Delete task">×</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderNotesHistory(deal) {
    const notes = deal.notesHistory || [];

    if (notes.length === 0) {
      return '<p class="crm-empty-state">No notes yet</p>';
    }

    return `
      <div class="crm-notes-history">
        ${notes.map((note, idx) => `
          <div class="crm-note-item">
            <div class="crm-note-header">
              <span class="crm-note-date">${new Date(note.createdAt).toLocaleString()}</span>
              <button class="crm-btn-icon-tiny" data-note-idx="${idx}" title="Delete note">×</button>
            </div>
            <div class="crm-note-text">${note.text}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderComments(deal) {
    const comments = deal.comments || [];

    if (comments.length === 0) {
      return '<p class="crm-empty-state">No comments yet. Start the conversation!</p>';
    }

    // Get current user info
    const getCurrentUser = () => {
      return new Promise(resolve => {
        chrome.storage.local.get(['currentUser'], (result) => {
          resolve(result.currentUser || null);
        });
      });
    };

    // Render a single comment and its replies
    const renderComment = (comment, depth = 0) => {
      const replies = comments.filter(c => c.parentId === comment.id);
      const indent = depth > 0 ? `margin-left: ${depth * 20}px;` : '';

      return `
        <div class="crm-comment-item" style="${indent}" data-comment-id="${comment.id}">
          <div class="crm-comment-header">
            <div class="crm-comment-author">
              <span class="crm-comment-avatar">${(comment.author || 'User')[0].toUpperCase()}</span>
              <span class="crm-comment-author-name">${comment.author || 'Unknown User'}</span>
            </div>
            <div class="crm-comment-meta">
              <span class="crm-comment-time">${this.formatCommentTime(comment.createdAt)}</span>
              <button class="crm-btn-icon-tiny" data-reply-comment-id="${comment.id}" title="Reply">💬</button>
              <button class="crm-btn-icon-tiny" data-delete-comment-id="${comment.id}" title="Delete">×</button>
            </div>
          </div>
          <div class="crm-comment-text">${comment.text}</div>
          ${replies.length > 0 ? `
            <div class="crm-comment-replies">
              ${replies.map(reply => renderComment(reply, depth + 1)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    };

    // Filter top-level comments (no parent)
    const topLevelComments = comments.filter(c => !c.parentId);

    return `
      <div class="crm-comments-list">
        ${topLevelComments.map(comment => renderComment(comment)).join('')}
      </div>
    `;
  }

  formatCommentTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async addComment(dealId, parentId = null) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const commentInput = document.getElementById('crm-comment-input');
    const commentText = commentInput?.value?.trim();

    if (!commentText) {
      alert('Please enter a comment');
      return;
    }

    // Get current user
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['currentUser'], resolve);
    });
    const currentUser = result.currentUser;

    if (!deal.comments) deal.comments = [];

    const newComment = {
      id: 'comment_' + Date.now(),
      text: commentText,
      author: currentUser?.email || currentUser?.name || 'Anonymous',
      createdAt: new Date().toISOString(),
      parentId: parentId
    };

    deal.comments.push(newComment);
    deal.lastUpdated = new Date().toISOString();

    await this.saveDeal(deal);
    this.showDealSidebar(dealId);
    this.showNotification('Comment added');
  }

  showReplyDialog(dealId, parentCommentId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const parentComment = (deal.comments || []).find(c => c.id === parentCommentId);
    if (!parentComment) return;

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content" style="max-width: 500px;">
        <h2>Reply to Comment</h2>

        <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">
            <strong>${parentComment.author}</strong> • ${this.formatCommentTime(parentComment.createdAt)}
          </div>
          <div style="font-size: 14px;">${parentComment.text}</div>
        </div>

        <div class="crm-form-group">
          <label>Your Reply</label>
          <textarea id="crm-reply-text" class="crm-textarea" rows="4" placeholder="Type your reply..."></textarea>
        </div>

        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-reply">Cancel</button>
          <button class="crm-btn-primary" id="crm-post-reply">Post Reply</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-reply')?.addEventListener('click', () => modal.remove());

    document.getElementById('crm-post-reply')?.addEventListener('click', async () => {
      const replyText = document.getElementById('crm-reply-text')?.value?.trim();

      if (!replyText) {
        alert('Please enter a reply');
        return;
      }

      // Get current user
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['currentUser'], resolve);
      });
      const currentUser = result.currentUser;

      if (!deal.comments) deal.comments = [];

      const newReply = {
        id: 'comment_' + Date.now(),
        text: replyText,
        author: currentUser?.email || currentUser?.name || 'Anonymous',
        createdAt: new Date().toISOString(),
        parentId: parentCommentId
      };

      deal.comments.push(newReply);
      deal.lastUpdated = new Date().toISOString();

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification('Reply posted');
    });

    // Focus on reply textarea
    setTimeout(() => document.getElementById('crm-reply-text')?.focus(), 100);
  }

  async deleteComment(dealId, commentId) {
    const deal = this.deals[dealId];
    if (!deal || !deal.comments) return;

    // Remove comment and all its replies
    const removeCommentAndReplies = (id) => {
      const comment = deal.comments.find(c => c.id === id);
      if (!comment) return;

      // Find and remove all replies first
      const replies = deal.comments.filter(c => c.parentId === id);
      replies.forEach(reply => removeCommentAndReplies(reply.id));

      // Remove the comment itself
      const idx = deal.comments.findIndex(c => c.id === id);
      if (idx !== -1) {
        deal.comments.splice(idx, 1);
      }
    };

    removeCommentAndReplies(commentId);
    deal.lastUpdated = new Date().toISOString();

    await this.saveDeal(deal);
    this.showDealSidebar(dealId);
    this.showNotification('Comment deleted');
  }

  renderDealSidebarTimeline(deal) {
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (!sidebar) return;

    const stageName = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.name || 'Unknown';
    const stageColor = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.color || '#4285f4';

    // Collect all timeline items
    const timelineItems = [];

    // Add emails
    (deal.linkedEmails || []).forEach(email => {
      timelineItems.push({
        type: 'email',
        date: new Date(email.date),
        title: email.subject || 'No Subject',
        content: email.from,
        icon: '📧',
        data: email
      });
    });

    // Add tasks
    (deal.tasks || []).forEach(task => {
      timelineItems.push({
        type: 'task',
        date: task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt),
        title: task.title,
        content: `${task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : ''}${task.assignedTo ? ` • Assigned to: ${task.assignedTo}` : ''}`,
        icon: task.completed ? '✓' : '○',
        completed: task.completed,
        data: task
      });
    });

    // Add calls
    (deal.calls || []).forEach(call => {
      timelineItems.push({
        type: 'call',
        date: new Date(call.date),
        title: call.title || 'Call',
        content: call.url,
        icon: '📹',
        data: call
      });
    });

    // Add files
    (deal.files || []).forEach(file => {
      timelineItems.push({
        type: 'file',
        date: new Date(file.date || file.createdAt),
        title: file.name,
        content: file.size || '',
        icon: '📎',
        data: file
      });
    });

    // Add weekly updates
    if (deal.weeklyUpdates) {
      deal.weeklyUpdates.forEach(update => {
        timelineItems.push({
          type: 'weekly-update',
          date: new Date(update.date),
          title: 'Weekly Update',
          content: update.text,
          icon: '📝',
          data: update
        });
      });
    }

    // Add Slack messages
    (deal.slackMessages || []).forEach(msg => {
      timelineItems.push({
        type: 'slack',
        date: new Date(msg.timestamp * 1000),
        title: msg.user || 'Slack Message',
        content: msg.text,
        icon: '💬',
        data: msg
      });
    });

    // Sort by date (most recent first)
    timelineItems.sort((a, b) => b.date - a.date);

    const showOnlyPriorWeeks = sidebar.dataset.showPriorWeeksOnly === 'true';
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    sidebar.innerHTML = `
      <div class="crm-timeline-view">
        <div class="crm-sidebar-header">
          <div>
            <h3>${deal.emailSubject || deal.company || 'Untitled Deal'}</h3>
            <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">
              <span style="background-color: ${stageColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${stageName}</span>
            </div>
          </div>
          <button class="crm-close-sidebar" id="crm-close-sidebar-btn">×</button>
        </div>

        <div class="crm-deal-view-toggle">
          <button class="crm-view-toggle-btn active" id="crm-timeline-view-btn">Timeline</button>
          <button class="crm-view-toggle-btn" id="crm-kanban-view-btn">Kanban</button>
        </div>

        <div class="crm-timeline-container">
          ${showOnlyPriorWeeks ? `
            <div class="crm-weekly-update-toggle">
              <input type="checkbox" id="crm-show-all-timeline" />
              <label for="crm-show-all-timeline">Show all items</label>
            </div>
          ` : `
            <div class="crm-weekly-update-toggle">
              <input type="checkbox" id="crm-show-only-prior-weeks" />
              <label for="crm-show-only-prior-weeks">Show only prior weeks' updates</label>
            </div>
          `}

          ${timelineItems.filter(item => {
            if (!showOnlyPriorWeeks) return true;
            if (item.type === 'weekly-update') return item.date < oneWeekAgo;
            return false;
          }).map(item => `
            <div class="crm-timeline-item ${item.type} ${item.completed ? 'completed' : ''}">
              <div class="crm-timeline-icon">${item.icon}</div>
              <div class="crm-timeline-header">
                <div class="crm-timeline-title">${item.title}</div>
                <div class="crm-timeline-date">${item.date.toLocaleString()}</div>
              </div>
              ${item.content ? `<div class="crm-timeline-content">${item.content}</div>` : ''}
              ${item.data && item.data.images ? item.data.images.map(img => `
                <img src="${img}" class="crm-timeline-slack-image" alt="Slack image" />
              `).join('') : ''}
            </div>
          `).join('')}

          ${timelineItems.length === 0 ? '<p style="text-align: center; color: #9aa0a6; padding: 40px;">No activity yet</p>' : ''}
        </div>

        <div class="crm-timeline-input-container">
          <div class="crm-timeline-input-header">
            <div class="crm-timeline-input-type">Add Task</div>
            <div class="crm-timeline-ai-badge">🤖 AI Auto-assign</div>
          </div>
          <textarea
            class="crm-timeline-input"
            id="crm-timeline-task-input"
            placeholder="Enter task description..."
            rows="3"
          ></textarea>
          <div class="crm-timeline-input-actions">
            <select class="crm-timeline-assign-to" id="crm-timeline-assign-to">
              <option value="">Auto-assign with AI</option>
              <option value="me">Assign to me</option>
              ${this.currentUser ? `<option value="${this.currentUser.email}">${this.currentUser.name || this.currentUser.email}</option>` : ''}
            </select>
            <button class="crm-timeline-submit-btn" id="crm-timeline-submit-task">Add Task</button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    document.getElementById('crm-close-sidebar-btn')?.addEventListener('click', () => {
      this.closeDealSidebar();
    });

    document.getElementById('crm-timeline-view-btn')?.addEventListener('click', () => {
      this.showDealSidebar(deal.id, 'timeline');
    });

    document.getElementById('crm-kanban-view-btn')?.addEventListener('click', () => {
      this.showDealSidebar(deal.id, 'kanban');
    });

    document.getElementById('crm-show-only-prior-weeks')?.addEventListener('change', (e) => {
      sidebar.dataset.showPriorWeeksOnly = e.target.checked ? 'true' : 'false';
      this.showDealSidebar(deal.id, 'timeline');
    });

    document.getElementById('crm-show-all-timeline')?.addEventListener('change', (e) => {
      sidebar.dataset.showPriorWeeksOnly = e.target.checked ? 'false' : 'true';
      this.showDealSidebar(deal.id, 'timeline');
    });

    document.getElementById('crm-timeline-submit-task')?.addEventListener('click', async () => {
      await this.addTaskFromTimeline(deal.id);
    });
  }

  async addTaskFromTimeline(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const taskInput = document.getElementById('crm-timeline-task-input');
    const assignToSelect = document.getElementById('crm-timeline-assign-to');

    const taskText = taskInput.value.trim();
    if (!taskText) return;

    let assignedTo = assignToSelect.value;

    // AI auto-assign if selected
    if (!assignedTo || assignedTo === '') {
      assignedTo = await this.aiAutoAssignTask(taskText, deal);
    } else if (assignedTo === 'me') {
      assignedTo = this.currentUser?.email || this.currentUser?.name || 'Me';
    }

    // Create task
    if (!deal.tasks) deal.tasks = [];
    deal.tasks.push({
      title: taskText,
      assignedTo: assignedTo,
      priority: 'Medium',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    });

    await this.saveDeal(deal);
    this.showNotification(`✅ Task added${assignedTo ? ` • Assigned to ${assignedTo}` : ''}`);
    this.showDealSidebar(dealId, 'timeline');
  }

  async aiAutoAssignTask(taskText, deal) {
    // Use Gemini to determine who should be assigned
    const geminiApiKey = await new Promise(resolve => {
      chrome.storage.local.get(['geminiApiKey'], result => {
        resolve(result.geminiApiKey);
      });
    });

    if (!geminiApiKey) {
      return 'Unassigned';
    }

    try {
      const prompt = `Based on this task: "${taskText}" for a deal at "${deal.company || deal.emailSubject}", who should it be assigned to? Consider the contact: ${deal.contactEmail || 'unknown'}. Return only the person's name or email, or "Unassigned" if unclear.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      const assignee = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Unassigned';
      return assignee;
    } catch (error) {
      console.error('AI auto-assign error:', error);
      return 'Unassigned';
    }
  }

  renderDealSidebarKanban(deal) {
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (!sidebar) return;

    const stageName = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.name || 'Unknown';
    const stageColor = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.color || '#4285f4';

    const linkedEmails = deal.linkedEmails || [];
    const tasks = deal.tasks || [];
    const calls = deal.calls || [];
    const files = deal.files || []; // Note: files support may need to be added

    sidebar.innerHTML = `
      <div class="deal-detail-kanban">
        <div class="crm-sidebar-header">
          <div>
            <h3>${deal.emailSubject || 'Untitled Deal'}</h3>
            <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">
              <span style="background-color: ${stageColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${stageName}</span>
              <span style="margin-left: 8px;">💰 ${deal.value ? `$${Number(deal.value).toLocaleString()}` : 'No value'}</span>
            </div>
          </div>
          <button class="crm-close-sidebar" id="crm-close-sidebar-btn">×</button>
        </div>

        <div class="crm-deal-view-toggle">
          <button class="crm-view-toggle-btn" id="crm-timeline-view-btn">Timeline</button>
          <button class="crm-view-toggle-btn active" id="crm-kanban-view-btn">Kanban</button>
        </div>

        <div class="deal-detail-header" style="padding: 12px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed;">
          <div class="deal-detail-meta">
            <span>👤 ${deal.contactEmail || 'No contact'}</span>
          </div>
        </div>

        <div class="deal-detail-kanban-grid">
          <!-- Emails Column -->
          <div class="deal-detail-column">
            <div class="deal-detail-column-header">
              <span class="deal-detail-column-icon">📧</span>
              <span class="deal-detail-column-title">Emails</span>
              <span class="deal-detail-column-count">${linkedEmails.length}</span>
            </div>
            <div class="deal-detail-items" id="kanban-emails">
              ${linkedEmails.slice().reverse().map((email, idx) => `
                <div class="deal-detail-item" data-email-idx="${idx}" data-email-url="${email.url || '#'}">
                  <div class="deal-detail-item-title">${email.subject || 'No Subject'}</div>
                  <div class="deal-detail-item-meta">${email.from || 'Unknown'} • ${new Date(email.date).toLocaleDateString()}</div>
                </div>
              `).join('')}
              ${linkedEmails.length === 0 ? '<p style="text-align: center; color: #9aa0a6; font-size: 12px; padding: 20px;">No emails</p>' : ''}
            </div>
          </div>

          <!-- Tasks Column -->
          <div class="deal-detail-column">
            <div class="deal-detail-column-header">
              <span class="deal-detail-column-icon">✓</span>
              <span class="deal-detail-column-title">Tasks</span>
              <span class="deal-detail-column-count">${tasks.length}</span>
            </div>
            <div class="deal-detail-items">
              ${tasks.map((task, idx) => `
                <div class="deal-detail-item ${task.completed ? 'completed' : ''}">
                  <div class="deal-detail-item-title">
                    <input type="checkbox" class="crm-task-checkbox" data-task-idx="${idx}" ${task.completed ? 'checked' : ''} style="margin-right: 8px;">
                    ${task.title || 'Untitled Task'}
                  </div>
                  <div class="deal-detail-item-meta">
                    ${task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                    ${task.priority ? ` • ${task.priority}` : ''}
                  </div>
                </div>
              `).join('')}
              ${tasks.length === 0 ? '<p style="text-align: center; color: #9aa0a6; font-size: 12px; padding: 20px;">No tasks</p>' : ''}
            </div>
            <button class="crm-btn-small" id="crm-add-task-btn" style="margin-top: auto;">+ Add Task</button>
          </div>

          <!-- Files Column -->
          <div class="deal-detail-column">
            <div class="deal-detail-column-header">
              <span class="deal-detail-column-icon">📎</span>
              <span class="deal-detail-column-title">Files</span>
              <span class="deal-detail-column-count">${files.length}</span>
            </div>
            <div class="deal-detail-items">
              ${files.map((file, idx) => `
                <div class="deal-detail-item">
                  <div class="deal-detail-item-title">${file.name || 'Untitled File'}</div>
                  <div class="deal-detail-item-meta">${file.size || ''} • ${file.date ? new Date(file.date).toLocaleDateString() : ''}</div>
                </div>
              `).join('')}
              ${files.length === 0 ? '<p style="text-align: center; color: #9aa0a6; font-size: 12px; padding: 20px;">No files</p>' : ''}
            </div>
          </div>

          <!-- Calls Column -->
          <div class="deal-detail-column">
            <div class="deal-detail-column-header">
              <span class="deal-detail-column-icon">📹</span>
              <span class="deal-detail-column-title">Calls</span>
              <span class="deal-detail-column-count">${calls.length}</span>
            </div>
            <div class="deal-detail-items">
              ${calls.map((call, idx) => `
                <div class="deal-detail-item">
                  <div class="deal-detail-item-title">
                    <a href="${call.url}" target="_blank" style="color: inherit; text-decoration: none;">${call.title || `Call ${idx + 1}`}</a>
                  </div>
                  <div class="deal-detail-item-meta">${call.date ? new Date(call.date).toLocaleDateString() : 'No date'}</div>
                </div>
              `).join('')}
              ${calls.length === 0 ? '<p style="text-align: center; color: #9aa0a6; font-size: 12px; padding: 20px;">No calls</p>' : ''}
            </div>
            <button class="crm-btn-small" id="crm-add-call-btn" style="margin-top: auto;">+ Add Call</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    document.getElementById('crm-close-sidebar-btn')?.addEventListener('click', () => {
      this.closeDealSidebar();
    });

    document.getElementById('crm-timeline-view-btn')?.addEventListener('click', () => {
      this.showDealSidebar(deal.id, 'timeline');
    });

    document.getElementById('crm-kanban-view-btn')?.addEventListener('click', () => {
      this.showDealSidebar(deal.id, 'kanban');
    });

    document.getElementById('crm-add-task-btn')?.addEventListener('click', () => {
      this.showAddTaskDialog(deal.id);
    });

    document.getElementById('crm-add-call-btn')?.addEventListener('click', () => {
      this.showAddCallDialog(deal.id);
    });

    // Email click handlers - show preview
    sidebar.querySelectorAll('#kanban-emails .deal-detail-item').forEach(emailItem => {
      emailItem.addEventListener('click', () => {
        const idx = parseInt(emailItem.dataset.emailIdx);
        const email = linkedEmails.slice().reverse()[idx];
        if (email) {
          this.showEmailPreview(email);
        }
      });
    });

    // Task checkbox listeners
    sidebar.querySelectorAll('.crm-task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.dataset.taskIdx);
        if (!deal.tasks) deal.tasks = [];
        deal.tasks[idx].completed = e.target.checked;
        deal.tasks[idx].completedAt = e.target.checked ? new Date().toISOString() : null;
        await this.saveDeal(deal);
        this.showDealSidebar(deal.id);
      });
    });
  }

  renderDealSidebarContent(deal) {
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (!sidebar) return;

    const stageName = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.name || 'Unknown';
    const stageColor = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.color || '#4285f4';

    // Build status history timeline
    const statusHistory = deal.statusHistory || [];
    const historyHTML = statusHistory.length > 0 ? `
      <div class="crm-sidebar-section">
        <h4>Status History</h4>
        <div class="crm-status-timeline">
          ${statusHistory.map(h => `
            <div class="crm-timeline-item">
              <div class="crm-timeline-dot"></div>
              <div class="crm-timeline-content">
                <div class="crm-timeline-status">${h.changedTo}</div>
                <div class="crm-timeline-date">${new Date(h.changedAt).toLocaleString()}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // Calls section
    const calls = deal.calls || [];
    const callsHTML = `
      <div class="crm-sidebar-section">
        <h4>Calls</h4>
        <div class="crm-calls-list" id="crm-calls-list">
          ${calls.map((call, idx) => `
            <div class="crm-call-item">
              <a href="${call.url}" target="_blank" class="crm-call-link">
                📹 ${call.title || `Call ${idx + 1}`}
              </a>
              <span class="crm-call-date">${call.date ? new Date(call.date).toLocaleDateString() : ''}</span>
              <button class="crm-btn-icon-small" data-call-idx="${idx}">×</button>
            </div>
          `).join('')}
          ${calls.length === 0 ? '<p class="crm-empty-state">No calls added yet</p>' : ''}
        </div>
        <button class="crm-btn-small" id="crm-add-call-btn">+ Add Call Link</button>
      </div>
    `;

    // Emails section (linked emails from the link bar)
    const linkedEmails = deal.linkedEmails || [];
    const emailsHTML = `
      <div class="crm-sidebar-section">
        <h4>Linked Emails (${linkedEmails.length})</h4>
        <div class="crm-emails-list">
          ${linkedEmails.slice().reverse().map((email, idx) => `
            <div class="crm-email-item crm-email-link-item" data-email-url="${email.url || '#'}">
              <div class="crm-email-subject">${email.subject || 'No Subject'}</div>
              <div class="crm-email-meta">
                <span>${email.from || 'Unknown'}</span> • <span>${new Date(email.date).toLocaleDateString()}</span>
              </div>
            </div>
          `).join('')}
          ${linkedEmails.length === 0 ? '<p class="crm-empty-state">No emails linked yet. Open an email and use the "Add to Deal" bar at the top to link it.</p>' : ''}
        </div>
      </div>
    `;

    sidebar.innerHTML = `
      <div class="crm-deal-sidebar-content">
        <div class="crm-sidebar-header">
          <h3>${deal.emailSubject || 'Untitled Deal'}</h3>
          <button class="crm-close-sidebar" id="crm-close-sidebar-btn">×</button>
        </div>

        <div class="crm-sidebar-scroll">
          <div class="crm-sidebar-section">
            <h4>Stage</h4>
            <div class="crm-stage-badge" style="background-color: ${stageColor};">
              ${stageName}
            </div>
          </div>

          <div class="crm-sidebar-section">
            <h4>Status</h4>
            <div class="crm-current-status">
              <strong>${deal.status || 'Active'}</strong>
            </div>
          </div>

          <div class="crm-sidebar-section">
            <div class="crm-ai-header">
              <h4>🤖 AI Deal Summary</h4>
              <button class="crm-btn-small" id="crm-generate-summary-btn">
                ${deal.aiSummary ? '🔄 Refresh' : '✨ Generate'} Summary
              </button>
            </div>
            <div id="crm-ai-summary-content">
              ${deal.aiSummary ? `
                <div class="crm-ai-summary">
                  <div class="crm-ai-summary-text">${deal.aiSummary.summary}</div>

                  ${deal.aiSummary.insights && deal.aiSummary.insights.length > 0 ? `
                    <div class="crm-ai-insights">
                      <h5>💡 Key Insights:</h5>
                      <ul>
                        ${deal.aiSummary.insights.map(insight => `<li>${insight}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  ${deal.aiSummary.risks && deal.aiSummary.risks.length > 0 ? `
                    <div class="crm-ai-risks">
                      <h5>⚠️ Risk Factors:</h5>
                      <ul>
                        ${deal.aiSummary.risks.map(risk => `<li>${risk}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}

                  ${deal.aiSummary.nextSteps && deal.aiSummary.nextSteps.length > 0 ? `
                    <div class="crm-ai-next-steps">
                      <h5>🎯 Suggested Next Steps:</h5>
                      <ul>
                        ${deal.aiSummary.nextSteps.map(step => `<li>${step}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                  <div class="crm-ai-timestamp">Generated ${new Date(deal.aiSummary.generatedAt).toLocaleString()}</div>
                </div>
              ` : '<p class="crm-empty-state">Click "Generate Summary" to get AI-powered insights about this deal</p>'}
            </div>
          </div>

          <div class="crm-sidebar-section">
            <h4>Deal Information</h4>
            <div class="crm-info-grid">
              <div class="crm-info-item">
                <label>Deal Size</label>
                <div>${deal.value ? `$${Number(deal.value).toLocaleString()}` : 'Not set'}</div>
              </div>
              <div class="crm-info-item">
                <label>Probability</label>
                <div>${deal.probability || '90'}%</div>
              </div>
              <div class="crm-info-item">
                <label>Priority</label>
                <div>${deal.priority || 'High'}</div>
              </div>
              <div class="crm-info-item">
                <label>Contact</label>
                <div>${deal.contactEmail || 'Not set'}</div>
              </div>
              ${deal.contactTitle ? `
              <div class="crm-info-item">
                <label>Contact Title</label>
                <div>${deal.contactTitle}</div>
              </div>
              ` : ''}
              <div class="crm-info-item">
                <label>Assigned To</label>
                <div>${deal.assignedTo || 'Unassigned'}</div>
              </div>
              <div class="crm-info-item">
                <label>Last Updated</label>
                <div>${new Date(deal.lastUpdated).toLocaleString()}</div>
              </div>
            </div>
          </div>

          ${deal.decisionMakers && deal.decisionMakers.length > 0 ? `
          <div class="crm-sidebar-section">
            <h4>Decision Makers</h4>
            <div class="crm-decision-makers-list">
              ${deal.decisionMakers.map(dm => `
                <div class="crm-decision-maker-item">
                  <span class="crm-decision-maker-icon">👤</span>
                  <span>${dm}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div class="crm-sidebar-section">
            <h4>Institution Address</h4>
            ${deal.address ? `
              <div class="crm-address-display ${deal.addressConfirmed ? 'confirmed' : 'unconfirmed'}">
                <div>${deal.address}</div>
                <div>${deal.city}, ${deal.state} ${deal.zip}</div>
                ${!deal.addressConfirmed ? '<div class="crm-address-status">⚠️ Unconfirmed</div>' : '<div class="crm-address-status">✓ Confirmed</div>'}
              </div>
            ` : '<p class="crm-empty-state">No address set</p>'}
            <button class="crm-btn-small" id="crm-lookup-address-btn">🔍 ${deal.address ? 'Update' : 'Add'} Address</button>
          </div>

          ${callsHTML}

          ${historyHTML}

          ${emailsHTML}

          ${this.currentPipeline?.type === 'customer-tracking' ? this.renderSurgeonsSection(deal) : ''}

          ${this.currentPipeline?.type === 'customer-tracking' ? this.renderCasesSection(deal) : ''}

          <div class="crm-sidebar-section">
            <div class="crm-section-header">
              <h4>📧 Send Email</h4>
            </div>
            <p class="crm-section-hint">Compose a personalized email to this contact using templates</p>
            <div style="display: flex; gap: 8px;">
              <button class="crm-btn-small" id="crm-compose-email-btn" style="flex: 1;">
                ✉️ Compose Email
              </button>
              <button class="crm-btn-small" id="crm-manage-templates-btn">
                ⚙️ Templates
              </button>
            </div>
          </div>

          <div class="crm-sidebar-section">
            <h4>Tasks & Follow-ups</h4>
            ${this.renderTasksSection(deal)}
            <button class="crm-btn-small" id="crm-add-task-btn">+ Add Task</button>
          </div>

          <div class="crm-sidebar-section">
            <h4>Notes</h4>
            ${this.renderNotesHistory(deal)}
            <textarea id="crm-sidebar-notes" class="crm-textarea" placeholder="Add a new note..."></textarea>
            <button class="crm-btn-small" id="crm-save-notes-btn">Add Note</button>
          </div>

          <div class="crm-sidebar-section">
            <h4>💬 Discussion</h4>
            <div id="crm-comments-container">
              ${this.renderComments(deal)}
            </div>
            <div class="crm-comment-input-wrapper">
              <textarea id="crm-comment-input" class="crm-textarea" placeholder="Add a comment..." rows="3"></textarea>
              <button class="crm-btn-small" id="crm-add-comment-btn">Post Comment</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    document.getElementById('crm-close-sidebar-btn')?.addEventListener('click', () => {
      this.closeDealSidebar();
    });

    document.getElementById('crm-add-call-btn')?.addEventListener('click', () => {
      this.showAddCallDialog(deal.id);
    });

    document.getElementById('crm-lookup-address-btn')?.addEventListener('click', () => {
      this.lookupInstitutionAddress(deal.id);
    });

    document.getElementById('crm-add-task-btn')?.addEventListener('click', () => {
      this.showAddTaskDialog(deal.id);
    });

    document.getElementById('crm-generate-summary-btn')?.addEventListener('click', async () => {
      await this.generateAISummary(deal.id);
    });

    document.getElementById('crm-compose-email-btn')?.addEventListener('click', () => {
      this.showComposeEmailDialog(deal.id);
    });

    document.getElementById('crm-manage-templates-btn')?.addEventListener('click', () => {
      this.showTemplateManager();
    });

    // Task checkbox listeners (mark complete/incomplete)
    sidebar.querySelectorAll('.crm-task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const idx = parseInt(e.target.dataset.taskIdx);
        if (!deal.tasks) deal.tasks = [];
        deal.tasks[idx].completed = e.target.checked;
        deal.tasks[idx].completedAt = e.target.checked ? new Date().toISOString() : null;
        await this.saveDeal(deal);
        this.showDealSidebar(deal.id);
      });
    });

    // Delete task listeners
    sidebar.querySelectorAll('[data-delete-task-idx]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.deleteTaskIdx);
        if (idx !== undefined && confirm('Delete this task?')) {
          if (!deal.tasks) deal.tasks = [];
          deal.tasks.splice(idx, 1);
          await this.saveDeal(deal);
          this.showDealSidebar(deal.id);
          this.showNotification('Task deleted');
        }
      });
    });

    document.getElementById('crm-save-notes-btn')?.addEventListener('click', async () => {
      const noteText = document.getElementById('crm-sidebar-notes')?.value;
      if (noteText && noteText.trim()) {
        // Initialize notes array if it doesn't exist
        if (!deal.notesHistory) {
          deal.notesHistory = [];
        }

        // Add new note to history
        deal.notesHistory.push({
          text: noteText.trim(),
          createdAt: new Date().toISOString()
        });

        // Keep legacy 'notes' field for backwards compatibility
        deal.notes = noteText.trim();
        deal.lastUpdated = new Date().toISOString();

        await this.saveDeal(deal);
        this.showNotification('Note added');
        this.showDealSidebar(deal.id); // Refresh sidebar to show new note
      }
    });

    // Remove call listeners
    sidebar.querySelectorAll('.crm-btn-icon-small').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.callIdx);
        if (!deal.calls) deal.calls = [];
        deal.calls.splice(idx, 1);
        await this.saveDeal(deal);
        this.showDealSidebar(deal.id);
      });
    });

    // Delete note listeners
    sidebar.querySelectorAll('.crm-btn-icon-tiny').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.noteIdx);
        if (idx !== undefined && confirm('Delete this note?')) {
          if (!deal.notesHistory) deal.notesHistory = [];
          deal.notesHistory.splice(idx, 1);
          await this.saveDeal(deal);
          this.showDealSidebar(deal.id);
          this.showNotification('Note deleted');
        }
      });
    });

    // Linked email click listeners - open email in Gmail
    sidebar.querySelectorAll('.crm-email-link-item').forEach(emailItem => {
      emailItem.addEventListener('click', () => {
        const url = emailItem.dataset.emailUrl;
        if (url && url !== '#') {
          window.location.href = url;
        }
      });
    });

    // Add surgeon button
    document.getElementById('crm-add-surgeon-btn')?.addEventListener('click', () => {
      this.showAddSurgeonDialog(deal.id);
    });

    // Remove surgeon listeners
    sidebar.querySelectorAll('[data-surgeon-idx]').forEach(btn => {
      if (btn.classList.contains('crm-btn-icon-small')) {
        btn.addEventListener('click', async (e) => {
          const idx = parseInt(e.target.dataset.surgeonIdx);
          if (confirm('Remove this surgeon?')) {
            if (!deal.surgeons) deal.surgeons = [];
            deal.surgeons.splice(idx, 1);
            await this.saveDeal(deal);
            this.showDealSidebar(deal.id);
          }
        });
      }
    });

    // Add case button
    document.getElementById('crm-add-case-btn')?.addEventListener('click', () => {
      this.showAddCaseDialog(deal.id);
    });

    // Delete case listeners
    sidebar.querySelectorAll('[data-case-idx]').forEach(btn => {
      if (btn.classList.contains('crm-btn-icon-tiny')) {
        btn.addEventListener('click', async (e) => {
          const idx = parseInt(e.target.dataset.caseIdx);
          if (idx !== undefined && confirm('Delete this case?')) {
            if (!deal.cases) deal.cases = [];
            deal.cases.splice(idx, 1);
            await this.saveDeal(deal);
            this.showDealSidebar(deal.id);
            this.showNotification('Case deleted');
          }
        });
      }
    });

    // Add comment button
    document.getElementById('crm-add-comment-btn')?.addEventListener('click', async () => {
      await this.addComment(deal.id);
    });

    // Reply to comment buttons
    sidebar.querySelectorAll('[data-reply-comment-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const commentId = btn.dataset.replyCommentId;
        this.showReplyDialog(deal.id, commentId);
      });
    });

    // Delete comment buttons
    sidebar.querySelectorAll('[data-delete-comment-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const commentId = btn.dataset.deleteCommentId;
        if (confirm('Delete this comment?')) {
          await this.deleteComment(deal.id, commentId);
        }
      });
    });
  }

  renderSurgeonsSection(deal) {
    const surgeons = deal.surgeons || [];
    const totalCases = surgeons.reduce((sum, s) => sum + (s.caseCount || 0), 0);

    return `
      <div class="crm-sidebar-section">
        <h4>Surgeons (${surgeons.length})</h4>
        <div class="crm-surgeons-list">
          ${surgeons.map((surgeon, idx) => `
            <div class="crm-surgeon-item">
              <div class="crm-surgeon-header">
                <div>
                  <div class="crm-surgeon-name">${surgeon.name}</div>
                  <div class="crm-surgeon-specialty">${surgeon.specialty || 'General Surgery'}</div>
                </div>
                <button class="crm-btn-icon-small" data-surgeon-idx="${idx}" title="Remove surgeon">×</button>
              </div>
              <div class="crm-surgeon-stats">
                <span class="crm-stat-badge">${surgeon.caseCount || 0} cases</span>
                ${surgeon.lastCaseDate ? `<span class="crm-stat-date">Last: ${new Date(surgeon.lastCaseDate).toLocaleDateString()}</span>` : ''}
              </div>
            </div>
          `).join('')}
          ${surgeons.length === 0 ? '<p class="crm-empty-state">No surgeons added yet</p>' : ''}
        </div>
        <div class="crm-surgeons-summary">
          <strong>Total Cases: ${totalCases}</strong>
        </div>
        <button class="crm-btn-small" id="crm-add-surgeon-btn">+ Add Surgeon</button>
      </div>
    `;
  }

  renderCasesSection(deal) {
    const cases = deal.cases || [];

    // Group cases by week for analytics
    const casesByWeek = this.groupCasesByWeek(cases);

    return `
      <div class="crm-sidebar-section">
        <h4>Cases (${cases.length})</h4>
        <div class="crm-cases-list">
          ${cases.slice(-10).reverse().map((caseItem, idx) => `
            <div class="crm-case-card ${caseItem.hasIssues ? 'has-issues' : ''}">
              <div class="crm-case-header">
                <div class="crm-case-name">${caseItem.name || 'Unnamed Case'}</div>
                <button class="crm-btn-icon-tiny" data-case-idx="${cases.length - 1 - idx}" title="Delete case">×</button>
              </div>
              <div class="crm-case-meta">
                <span>👨‍⚕️ ${caseItem.surgeonName || 'Unknown'}</span>
                <span>📅 ${new Date(caseItem.date).toLocaleDateString()}</span>
              </div>
              ${caseItem.hasIssues ? `<div class="crm-case-issues">⚠️ ${caseItem.issues}</div>` : '<div class="crm-case-success">✓ No issues reported</div>'}
            </div>
          `).join('')}
          ${cases.length === 0 ? '<p class="crm-empty-state">No cases logged yet</p>' : ''}
          ${cases.length > 10 ? `<p class="crm-more-info">Showing last 10 of ${cases.length} cases</p>` : ''}
        </div>
        <button class="crm-btn-small" id="crm-add-case-btn">+ Add Case</button>
      </div>
    `;
  }

  groupCasesByWeek(cases) {
    const weeks = {};
    cases.forEach(c => {
      const date = new Date(c.date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    });
    return weeks;
  }

  showDashboard() {
    // Get all customer tracking deals
    const customerDeals = Object.values(this.deals).filter(d =>
      d.pipelineId === 'customer-adoption'
    );

    // Calculate KPIs
    const totalSites = customerDeals.length;
    const totalSurgeons = customerDeals.reduce((sum, d) =>
      sum + (d.surgeons ? d.surgeons.length : 0), 0
    );
    const allCases = customerDeals.flatMap(d => d.cases || []);
    const totalCases = allCases.length;
    const casesWithIssues = allCases.filter(c => c.hasIssues).length;
    const successRate = totalCases > 0 ? ((totalCases - casesWithIssues) / totalCases * 100).toFixed(1) : 0;

    // Cases per week (last 12 weeks)
    const weeks = this.getLast12Weeks();
    const casesByWeek = weeks.map(week => ({
      week,
      count: allCases.filter(c => {
        const caseDate = new Date(c.date);
        return caseDate >= week.start && caseDate <= week.end;
      }).length
    }));

    // Top surgeons
    const surgeonMap = {};
    customerDeals.forEach(deal => {
      (deal.surgeons || []).forEach(surgeon => {
        if (!surgeonMap[surgeon.name]) {
          surgeonMap[surgeon.name] = { ...surgeon, siteName: deal.emailSubject };
        } else {
          surgeonMap[surgeon.name].caseCount += (surgeon.caseCount || 0);
        }
      });
    });
    const topSurgeons = Object.values(surgeonMap)
      .sort((a, b) => (b.caseCount || 0) - (a.caseCount || 0))
      .slice(0, 10);

    // Create dashboard modal
    const modal = document.createElement('div');
    modal.className = 'crm-modal crm-dashboard-modal';
    modal.innerHTML = `
      <div class="crm-modal-content crm-dashboard-content">
        <div class="crm-dashboard-header">
          <h2>📊 Customer Adoption Dashboard</h2>
          <button class="crm-close-sidebar" id="crm-close-dashboard">×</button>
        </div>

        <div class="crm-dashboard-scroll">
          <div class="crm-kpi-grid">
            <div class="crm-kpi-card">
              <div class="crm-kpi-value">${totalSites}</div>
              <div class="crm-kpi-label">Customer Sites</div>
            </div>
            <div class="crm-kpi-card">
              <div class="crm-kpi-value">${totalSurgeons}</div>
              <div class="crm-kpi-label">Active Surgeons</div>
            </div>
            <div class="crm-kpi-card">
              <div class="crm-kpi-value">${totalCases}</div>
              <div class="crm-kpi-label">Total Cases</div>
            </div>
            <div class="crm-kpi-card">
              <div class="crm-kpi-value">${successRate}%</div>
              <div class="crm-kpi-label">Success Rate</div>
            </div>
          </div>

          <div class="crm-dashboard-section">
            <h3>Cases per Week (Last 12 Weeks)</h3>
            <div class="crm-chart-container">
              ${this.renderWeeklyChart(casesByWeek)}
            </div>
          </div>

          <div class="crm-dashboard-section">
            <h3>Top 10 Surgeons by Case Volume</h3>
            <div class="crm-surgeons-ranking">
              ${topSurgeons.map((surgeon, idx) => `
                <div class="crm-rank-item">
                  <span class="crm-rank-number">#${idx + 1}</span>
                  <div class="crm-rank-info">
                    <div class="crm-rank-name">${surgeon.name}</div>
                    <div class="crm-rank-meta">${surgeon.siteName} • ${surgeon.specialty || 'General Surgery'}</div>
                  </div>
                  <span class="crm-rank-value">${surgeon.caseCount || 0} cases</span>
                </div>
              `).join('')}
              ${topSurgeons.length === 0 ? '<p class="crm-empty-state">No surgeon data available</p>' : ''}
            </div>
          </div>

          <div class="crm-dashboard-section">
            <h3>Customer Site Breakdown</h3>
            <div class="crm-sites-table">
              ${customerDeals.map(deal => {
                const siteCases = (deal.cases || []).length;
                const siteSurgeons = (deal.surgeons || []).length;
                return `
                  <div class="crm-site-row">
                    <div class="crm-site-name">${deal.emailSubject || 'Unnamed Site'}</div>
                    <div class="crm-site-stats">
                      <span>${siteSurgeons} surgeons</span>
                      <span>${siteCases} cases</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-close-dashboard')?.addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  renderWeeklyChart(casesByWeek) {
    const maxCases = Math.max(...casesByWeek.map(w => w.count), 1);

    return `
      <div class="crm-bar-chart">
        ${casesByWeek.map(weekData => {
          const height = (weekData.count / maxCases) * 100;
          return `
            <div class="crm-bar-wrapper">
              <div class="crm-bar-value">${weekData.count}</div>
              <div class="crm-bar" style="height: ${height}%"></div>
              <div class="crm-bar-label">${weekData.week.label}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  getLast12Weeks() {
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date();
      end.setDate(end.getDate() - (i * 7));
      const start = new Date(end);
      start.setDate(start.getDate() - 6);

      weeks.push({
        start,
        end,
        label: `${start.getMonth() + 1}/${start.getDate()}`
      });
    }
    return weeks;
  }

  showAddTaskDialog(dealId) {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Add Task</h2>
        <div class="crm-form-group">
          <label>Task Title *</label>
          <input type="text" id="crm-task-title" class="crm-input" placeholder="e.g., Follow up with client" required />
        </div>
        <div class="crm-form-group">
          <label>Description</label>
          <textarea id="crm-task-description" class="crm-textarea" placeholder="Task details..." rows="3"></textarea>
        </div>
        <div class="crm-form-group">
          <label>Due Date</label>
          <input type="datetime-local" id="crm-task-due-date" class="crm-input" />
        </div>
        <div class="crm-form-group">
          <label>Priority</label>
          <select id="crm-task-priority" class="crm-input">
            <option value="Low">Low</option>
            <option value="Medium" selected>Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
        <div class="crm-form-group">
          <label>Assign To (optional)</label>
          <input type="text" id="crm-task-assigned-to" class="crm-input" placeholder="Team member name" />
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-task">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-task">Add Task</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('crm-task-due-date').value = tomorrow.toISOString().slice(0, 16);

    document.getElementById('crm-cancel-task')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-task')?.addEventListener('click', async () => {
      const title = document.getElementById('crm-task-title').value;
      if (!title || !title.trim()) {
        alert('Please enter a task title');
        return;
      }

      const deal = this.deals[dealId];
      if (!deal) return;

      if (!deal.tasks) deal.tasks = [];

      deal.tasks.push({
        id: 'task_' + Date.now(),
        title: title.trim(),
        description: document.getElementById('crm-task-description').value.trim(),
        dueDate: document.getElementById('crm-task-due-date').value,
        priority: document.getElementById('crm-task-priority').value,
        assignedTo: document.getElementById('crm-task-assigned-to').value.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null
      });

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification('Task added successfully!');
    });

    // Focus on title input
    setTimeout(() => document.getElementById('crm-task-title')?.focus(), 100);
  }

  showAddCallDialog(dealId) {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Add Call Link</h2>
        <div class="crm-form-group">
          <label>Call Title</label>
          <input type="text" id="crm-call-title" class="crm-input" placeholder="e.g., Discovery Call" />
        </div>
        <div class="crm-form-group">
          <label>tldv.io Link (or any URL)</label>
          <input type="url" id="crm-call-url" class="crm-input" placeholder="https://tldv.io/..." />
        </div>
        <div class="crm-form-group">
          <label>Call Date</label>
          <input type="date" id="crm-call-date" class="crm-input" />
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-call">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-call">Add Call</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-call')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-call')?.addEventListener('click', async () => {
      const deal = this.deals[dealId];
      if (!deal) return;

      if (!deal.calls) deal.calls = [];

      deal.calls.push({
        title: document.getElementById('crm-call-title').value,
        url: document.getElementById('crm-call-url').value,
        date: document.getElementById('crm-call-date').value
      });

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification('Call added successfully!');
    });
  }

  showAddSurgeonDialog(dealId) {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Add Surgeon</h2>
        <div class="crm-form-group">
          <label>Surgeon Name *</label>
          <input type="text" id="crm-surgeon-name" class="crm-input" placeholder="Dr. Jane Smith" required />
        </div>
        <div class="crm-form-group">
          <label>Specialty</label>
          <select id="crm-surgeon-specialty" class="crm-input">
            <option value="General Surgery">General Surgery</option>
            <option value="Orthopedic Surgery">Orthopedic Surgery</option>
            <option value="Neurosurgery">Neurosurgery</option>
            <option value="Cardiothoracic Surgery">Cardiothoracic Surgery</option>
            <option value="Vascular Surgery">Vascular Surgery</option>
            <option value="Plastic Surgery">Plastic Surgery</option>
            <option value="Pediatric Surgery">Pediatric Surgery</option>
            <option value="Trauma Surgery">Trauma Surgery</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="crm-form-group">
          <label>Initial Case Count</label>
          <input type="number" id="crm-surgeon-cases" class="crm-input" value="0" min="0" />
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-surgeon">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-surgeon">Add Surgeon</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-surgeon')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-surgeon')?.addEventListener('click', async () => {
      const deal = this.deals[dealId];
      if (!deal) return;

      const name = document.getElementById('crm-surgeon-name').value.trim();
      if (!name) {
        alert('Please enter a surgeon name');
        return;
      }

      if (!deal.surgeons) deal.surgeons = [];

      deal.surgeons.push({
        name: name,
        specialty: document.getElementById('crm-surgeon-specialty').value,
        caseCount: parseInt(document.getElementById('crm-surgeon-cases').value) || 0,
        addedAt: new Date().toISOString()
      });

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification(`Surgeon ${name} added successfully!`);
    });

    // Focus on name input
    setTimeout(() => document.getElementById('crm-surgeon-name')?.focus(), 100);
  }

  showAddCaseDialog(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const surgeons = deal.surgeons || [];
    const today = new Date().toISOString().split('T')[0];

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Add Case</h2>
        <div class="crm-form-group">
          <label>Case Name *</label>
          <input type="text" id="crm-case-name" class="crm-input" placeholder="e.g., Hip Replacement #123" required />
        </div>
        <div class="crm-form-group">
          <label>Date Completed *</label>
          <input type="date" id="crm-case-date" class="crm-input" value="${today}" required />
        </div>
        <div class="crm-form-group">
          <label>Surgeon *</label>
          <select id="crm-case-surgeon" class="crm-input" required>
            ${surgeons.length === 0 ? '<option value="">No surgeons added yet</option>' : ''}
            ${surgeons.map(s => `<option value="${s.name}">${s.name} - ${s.specialty || 'General Surgery'}</option>`).join('')}
          </select>
          ${surgeons.length === 0 ? '<p class="crm-help-text">Please add a surgeon first</p>' : ''}
        </div>
        <div class="crm-form-group">
          <label class="crm-checkbox-label">
            <input type="checkbox" id="crm-case-has-issues" />
            <span>Case had issues</span>
          </label>
        </div>
        <div class="crm-form-group" id="crm-issues-group" style="display: none;">
          <label>Issue Description</label>
          <textarea id="crm-case-issues" class="crm-input" rows="3" placeholder="Describe the issues encountered..."></textarea>
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-case">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-case" ${surgeons.length === 0 ? 'disabled' : ''}>Add Case</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Toggle issues textarea
    document.getElementById('crm-case-has-issues')?.addEventListener('change', (e) => {
      const issuesGroup = document.getElementById('crm-issues-group');
      if (issuesGroup) {
        issuesGroup.style.display = e.target.checked ? 'block' : 'none';
      }
    });

    document.getElementById('crm-cancel-case')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-case')?.addEventListener('click', async () => {
      const caseName = document.getElementById('crm-case-name').value.trim();
      const caseDate = document.getElementById('crm-case-date').value;
      const surgeonName = document.getElementById('crm-case-surgeon').value;
      const hasIssues = document.getElementById('crm-case-has-issues').checked;
      const issues = document.getElementById('crm-case-issues').value.trim();

      if (!caseName || !caseDate || !surgeonName) {
        alert('Please fill in all required fields');
        return;
      }

      if (!deal.cases) deal.cases = [];

      deal.cases.push({
        name: caseName,
        date: caseDate,
        surgeonName: surgeonName,
        hasIssues: hasIssues,
        issues: hasIssues ? issues : '',
        createdAt: new Date().toISOString()
      });

      // Update surgeon case count
      const surgeon = deal.surgeons?.find(s => s.name === surgeonName);
      if (surgeon) {
        surgeon.caseCount = (surgeon.caseCount || 0) + 1;
        surgeon.lastCaseDate = caseDate;
      }

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification('Case added successfully!');
    });

    // Focus on case name input
    setTimeout(() => document.getElementById('crm-case-name')?.focus(), 100);
  }

  async lookupInstitutionAddress(dealId) {
    const deal = this.deals[dealId];
    if (!deal) {
      this.showNotification('Deal not found');
      return;
    }

    // Get institution or company name
    const institutionName = deal.institution || deal.company || deal.emailSubject || 'this deal';

    // Show address dialog immediately with existing data if available
    this.showAddressConfirmationDialog(dealId, {
      institution: institutionName,
      address: deal.address || '',
      city: deal.city || '',
      state: deal.state || '',
      zip: deal.zip || '',
      country: deal.country || 'USA'
    });
  }

  showAddressConfirmationDialog(dealId, addressData) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Confirm Institution Address</h2>
        <p style="font-size: 13px; color: #5f6368; margin-bottom: 16px;">
          ${deal.institution}
        </p>
        <div class="crm-form-group">
          <label>Street Address *</label>
          <input type="text" id="crm-address-street" class="crm-input" placeholder="123 Main Street" value="${addressData.address || ''}" />
        </div>
        <div class="crm-form-group">
          <label>City *</label>
          <input type="text" id="crm-address-city" class="crm-input" placeholder="Boston" value="${addressData.city || ''}" />
        </div>
        <div class="crm-form-row">
          <div class="crm-form-group">
            <label>State *</label>
            <select id="crm-address-state" class="crm-input">
              <option value="">Select State</option>
              ${this.getUSStates().map(state => `<option value="${state.code}" ${addressData.state === state.code ? 'selected' : ''}>${state.name}</option>`).join('')}
            </select>
          </div>
          <div class="crm-form-group">
            <label>ZIP Code *</label>
            <input type="text" id="crm-address-zip" class="crm-input" placeholder="02114" value="${addressData.zip || ''}" maxlength="10" />
          </div>
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-address">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-address">Save Address</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-address')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-address')?.addEventListener('click', async () => {
      const address = document.getElementById('crm-address-street').value.trim();
      const city = document.getElementById('crm-address-city').value.trim();
      const state = document.getElementById('crm-address-state').value;
      const zip = document.getElementById('crm-address-zip').value.trim();

      if (!address || !city || !state || !zip) {
        alert('Please fill in all address fields');
        return;
      }

      // Update deal with address
      deal.address = address;
      deal.city = city;
      deal.state = state;
      deal.zip = zip;
      deal.country = 'USA';
      deal.addressConfirmed = true;

      // Geocode the address to get lat/lng
      const fullAddress = `${address}, ${city}, ${state} ${zip}, USA`;
      try {
        const coords = await this.geocodeAddress(fullAddress);
        if (coords) {
          deal.latitude = coords.lat;
          deal.longitude = coords.lng;
        }
      } catch (error) {
        console.error('Gmail CRM: Geocoding error:', error);
      }

      await this.saveDeal(deal);
      modal.remove();
      this.showDealSidebar(dealId);
      this.showNotification('✓ Address saved successfully!');
    });

    // Focus on address input
    setTimeout(() => document.getElementById('crm-address-street')?.focus(), 100);
  }

  getUSStates() {
    return [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
      { code: 'DC', name: 'Washington D.C.' }
    ];
  }

  async geocodeAddress(address) {
    // Use Nominatim (OpenStreetMap) geocoding service - free and no API key required
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=us&limit=1`, {
        headers: {
          'User-Agent': 'GmailCRM/1.5.0'
        }
      });

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }

      return null;
    } catch (error) {
      console.error('Gmail CRM: Geocoding error:', error);
      return null;
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'crm-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  async syncEmailsToDeals() {
    // Show date picker dialog first
    this.showSyncDateDialog();
  }

  showSyncDateDialog() {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';

    const defaultDaysBack = 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - defaultDaysBack);
    const toDate = new Date();

    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Sync Emails to CRM</h2>
        <p style="font-size: 13px; color: #5f6368; margin-bottom: 16px;">
          Scan Gmail emails and automatically create deals. Emails from the same person/company will be grouped into one deal.
        </p>
        <div class="crm-form-group">
          <label>From Date</label>
          <input type="date" id="crm-sync-from-date" class="crm-input" value="${fromDate.toISOString().split('T')[0]}" />
        </div>
        <div class="crm-form-group">
          <label>To Date</label>
          <input type="date" id="crm-sync-to-date" class="crm-input" value="${toDate.toISOString().split('T')[0]}" />
        </div>
        <div class="crm-form-group">
          <label class="crm-checkbox-label">
            <input type="checkbox" id="crm-sync-hospitals-only" checked />
            <span>Prioritize hospitals/health systems</span>
          </label>
          <p class="crm-help-text" style="color: #5f6368; margin-top: 4px;">
            Focus on emails from medical facilities and health organizations
          </p>
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-sync">Cancel</button>
          <button class="crm-btn-primary" id="crm-start-sync">Start Sync</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-sync')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-start-sync')?.addEventListener('click', () => {
      const fromDate = document.getElementById('crm-sync-from-date').value;
      const toDate = document.getElementById('crm-sync-to-date').value;
      const hospitalsOnly = document.getElementById('crm-sync-hospitals-only').checked;

      modal.remove();
      this.performEmailSync(fromDate, toDate, hospitalsOnly);
    });
  }

  async performEmailSync(fromDate, toDate, hospitalsOnly) {
    const syncBtn = document.getElementById('crm-sync-emails-btn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '⏳ Syncing...';
    }

    try {
      console.log('Gmail CRM: Starting sync from', fromDate, 'to', toDate);

      // Convert string dates to Date objects
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);

      // Scan Gmail emails with auto-scroll and date range
      const emailRows = await this.scanGmailEmails(fromDateObj, toDateObj);
      console.log('Gmail CRM: Found', emailRows.length, 'emails');

      if (emailRows.length === 0) {
        this.showNotification('No emails found. Make sure you\'re viewing your inbox.');
        if (syncBtn) {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '📧 Sync Emails';
        }
        return;
      }

      // Group emails by institution and track contacts
      const groupedByInstitution = {};

      for (const emailData of emailRows) {
        // Filter by date range
        const emailDate = new Date(emailData.date);
        if (emailDate < fromDate || emailDate > toDate) {
          continue;
        }

        const isHospital = this.isHospitalOrHealthSystem(emailData.from, emailData.subject);

        // Skip if hospitals-only mode and this isn't a hospital
        if (hospitalsOnly && !isHospital) continue;

        // Use institution as the grouping key
        const institutionKey = emailData.institution || 'Unknown Institution';

        if (!groupedByInstitution[institutionKey]) {
          groupedByInstitution[institutionKey] = {
            institution: institutionKey,
            domain: emailData.domain,
            emails: [],
            contacts: new Set(), // Track unique contacts
            isHospital: isHospital
          };
        }

        // Add email and track contact
        groupedByInstitution[institutionKey].emails.push(emailData);
        groupedByInstitution[institutionKey].contacts.add(emailData.fromName);
      }

      console.log('Gmail CRM: Grouped into', Object.keys(groupedByInstitution).length, 'institutions');
      console.log('Gmail CRM: Total unique contacts:',
        Array.from(Object.values(groupedByInstitution))
          .reduce((sum, inst) => sum + inst.contacts.size, 0));

      let created = 0;
      let linked = 0;

      // Create deals from grouped emails by institution
      for (const [institutionKey, data] of Object.entries(groupedByInstitution)) {
        // Check if deal already exists for this institution
        let deal = Object.values(this.deals).find(d =>
          d.institution === data.institution ||
          d.domain === data.domain ||
          d.company === data.institution
        );

        if (!deal) {
          // Create new deal for this institution
          const firstEmail = data.emails[0];
          const dealId = 'deal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

          // Get the first stage of the sales pipeline
          const salesPipeline = this.pipelines['sales'];
          const firstStage = salesPipeline?.stages?.[0];
          const firstStageId = firstStage?.id || 'lead';

          // Convert Set to Array for contacts
          const contactsArray = Array.from(data.contacts);

          deal = {
            id: dealId,
            pipelineId: 'sales',
            stageId: firstStageId,
            emailSubject: `${data.institution} - ${contactsArray.length} contact${contactsArray.length > 1 ? 's' : ''}, ${data.emails.length} email${data.emails.length > 1 ? 's' : ''}`,
            emailFrom: firstEmail.from,
            company: data.institution,
            institution: data.institution,
            domain: data.domain,
            contacts: contactsArray,
            contactCount: contactsArray.length,
            status: 'Active',
            isHospital: data.isHospital,
            createdAt: firstEmail.date || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            linkedEmails: [],
            notesHistory: [],
            calls: []
          };

          this.deals[dealId] = deal;
          created++;
          console.log('Gmail CRM: Created deal for', data.institution, `(${contactsArray.length} contacts, ${data.emails.length} emails) in stage:`, firstStageId);
        }

        // Link all emails from this institution to the deal
        if (!deal.linkedEmails) deal.linkedEmails = [];
        if (!deal.contacts) deal.contacts = [];

        // Update contacts list if new contacts are found
        for (const contact of data.contacts) {
          if (!deal.contacts.includes(contact)) {
            deal.contacts.push(contact);
          }
        }
        deal.contactCount = deal.contacts.length;

        for (const email of data.emails) {
          const alreadyLinked = deal.linkedEmails.some(e =>
            e.threadId === email.threadId || e.subject === email.subject
          );

          if (!alreadyLinked) {
            deal.linkedEmails.push({
              subject: email.subject,
              from: email.from,
              fromName: email.fromName,
              institution: email.institution,
              domain: email.domain,
              date: email.date || new Date().toISOString(),
              threadId: email.threadId,
              url: email.url,
              linkedAt: new Date().toISOString()
            });
            linked++;
          }
        }

        // Update deal subject with current contact/email counts
        deal.emailSubject = `${deal.institution} - ${deal.contacts.length} contact${deal.contacts.length > 1 ? 's' : ''}, ${deal.linkedEmails.length} email${deal.linkedEmails.length > 1 ? 's' : ''}`;
      }

      // Save all modified deals
      const modifiedDeals = Object.values(this.deals).filter(d =>
        groupedByInstitution[d.institution] !== undefined
      );
      for (const deal of modifiedDeals) {
        await this.saveDeal(deal);
      }

      console.log('Gmail CRM: Sync complete. Created:', created, 'Linked:', linked);
      console.log('Gmail CRM: Total deals in storage:', Object.keys(this.deals).length);

      // Reload data and refresh pipeline view
      await this.loadData();
      console.log('Gmail CRM: Data reloaded, current pipeline:', this.currentPipeline?.name);

      // If Sales pipeline is currently open, refresh it
      if (this.currentPipeline && this.currentPipeline.id === 'sales') {
        console.log('Gmail CRM: Refreshing Sales pipeline view...');
        this.renderPipelineBoard();
        this.showNotification(`✓ Synced! Created ${created} deals, linked ${linked} emails`);
      } else {
        // Otherwise, switch to Sales pipeline to show the new deals
        console.log('Gmail CRM: Switching to Sales pipeline to show new deals...');
        const salesPipeline = this.pipelines['sales'];
        if (salesPipeline) {
          this.openPipeline(salesPipeline);
        }
        this.showNotification(`✓ Synced! Created ${created} deals, linked ${linked} emails. Check Sales pipeline.`);
      }

    } catch (error) {
      console.error('Gmail CRM: Error syncing emails:', error);
      this.showNotification('Error syncing emails. Check console for details.');
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '📧 Sync Emails';
      }
    }
  }

  analyzeDomainType(domain) {
    if (!domain) return 'unknown';

    const lowerDomain = domain.toLowerCase();

    // Check for educational institutions
    if (lowerDomain.endsWith('.edu') || lowerDomain.includes('.edu.')) {
      return 'edu';
    }

    // Check for organizations (often non-profits, hospitals, medical centers)
    if (lowerDomain.endsWith('.org') || lowerDomain.includes('.org.')) {
      return 'org';
    }

    // Check for government
    if (lowerDomain.endsWith('.gov') || lowerDomain.includes('.gov.')) {
      return 'gov';
    }

    // Check for healthcare-specific domains
    if (lowerDomain.includes('hospital') || lowerDomain.includes('medical') ||
        lowerDomain.includes('health') || lowerDomain.includes('clinic')) {
      return 'healthcare';
    }

    // Commercial domains
    if (lowerDomain.endsWith('.com') || lowerDomain.endsWith('.co')) {
      return 'com';
    }

    return 'other';
  }

  async scanGmailEmails(fromDate, toDate) {
    const emails = [];

    console.log('Gmail CRM: Starting comprehensive email scan...');
    console.log('Gmail CRM: Date range:', fromDate?.toISOString?.(), 'to', toDate?.toISOString?.());

    // First, try to use Gmail search to load emails in date range
    if (fromDate && toDate) {
      await this.loadEmailsUsingSearch(fromDate, toDate);
    }

    // Now scan all visible email rows
    const emailRows = document.querySelectorAll('tr.zA, table.F tr');
    console.log(`Gmail CRM: Found ${emailRows.length} email rows in current view`);

    // If we have very few emails, try scrolling to load more
    if (emailRows.length < 100) {
      console.log('Gmail CRM: Few emails loaded, attempting to scroll and load more...');
      await this.scrollToLoadMoreEmails();
    }

    // Re-query after scrolling
    const allEmailRows = document.querySelectorAll('tr.zA, table.F tr');
    console.log(`Gmail CRM: Total email rows after scroll: ${allEmailRows.length}`);

    allEmailRows.forEach((row, index) => {
      try {
        // Extract subject
        const subjectEl = row.querySelector('.bog span[data-thread-id], .y6 span, span.bqe');
        const subject = subjectEl?.textContent?.trim() || 'No Subject';

        // Extract email body snippet/preview
        const snippetEl = row.querySelector('.y2, span.y2, .Zt');
        const bodySnippet = snippetEl?.textContent?.trim() || '';

        // Extract sender email and name
        const senderEl = row.querySelector('.yW span[email], .yX span, span.zF');
        const senderNameEl = row.querySelector('.yW span[name], .yX span, span.zF');

        const fromEmail = senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || 'Unknown';
        const fromName = senderNameEl?.getAttribute('name') ||
                        senderNameEl?.getAttribute('title') ||
                        this.extractNameFromEmail(fromEmail);

        // Extract thread ID from data attribute or URL
        const threadId = subjectEl?.getAttribute('data-thread-id') ||
                        row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id') ||
                        null;

        // Extract date
        const dateEl = row.querySelector('.xW.xY span, span.g3');
        const dateText = dateEl?.textContent?.trim() || '';

        // Create URL for this thread
        const url = threadId ? `https://mail.google.com/mail/u/0/#inbox/${threadId}` : '';

        // Extract domain/institution with enhanced analysis
        const domain = this.extractDomainFromEmail(fromEmail);
        const institution = this.extractInstitutionName(domain);

        // Analyze domain type for deal potential
        const domainType = this.analyzeDomainType(domain);
        const isEducational = domainType === 'edu';
        const isOrganization = domainType === 'org';
        const isHospital = domain.includes('hospital') || domain.includes('medical') ||
                          domain.includes('health') || institution.toLowerCase().includes('hospital');

        // Only add if we have basic data
        if (subject && fromEmail && subject !== 'No Subject') {
          emails.push({
            subject,
            bodySnippet,
            from: fromEmail,
            fromName,
            domain,
            domainType,
            isEducational,
            isOrganization,
            isHospital,
            institution,
            threadId,
            date: this.parseGmailDate(dateText),
            url
          });
        }
      } catch (e) {
        console.error('Gmail CRM: Error parsing email row:', e);
      }
    });

    console.log(`Gmail CRM: Successfully extracted ${emails.length} emails with contact/institution data`);
    return emails;
  }

  async loadEmailsUsingSearch(fromDate, toDate) {
    try {
      // Format dates for Gmail search (YYYY/MM/DD)
      const formatDateForSearch = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
      };

      const afterDate = formatDateForSearch(fromDate);
      const beforeDate = formatDateForSearch(toDate);

      // Construct Gmail search query
      const searchQuery = `after:${afterDate} before:${beforeDate}`;
      console.log('Gmail CRM: Using Gmail search:', searchQuery);

      // Navigate to search results
      const searchUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`;
      console.log('Gmail CRM: Would navigate to:', searchUrl);
      console.log('Gmail CRM: Note: Automatic navigation disabled to prevent disruption. Emails will be scanned from current view.');

      // Note: We don't actually navigate because it would disrupt the user
      // Instead, we'll rely on scrolling to load more emails
      return true;
    } catch (error) {
      console.error('Gmail CRM: Error in search setup:', error);
      return false;
    }
  }

  async scrollToLoadMoreEmails() {
    return new Promise((resolve) => {
      try {
        console.log('Gmail CRM: Starting auto-scroll to load more emails...');

        // Find the scrollable container (Gmail's email list)
        const scrollContainer = document.querySelector('div[role="main"]') ||
                               document.querySelector('.AO') ||
                               document.querySelector('.Tm.aeJ');

        if (!scrollContainer) {
          console.log('Gmail CRM: Could not find scroll container');
          resolve();
          return;
        }

        let scrollCount = 0;
        const maxScrolls = 10; // Limit scrolling to prevent infinite loops
        let previousHeight = 0;

        const scrollInterval = setInterval(() => {
          const currentHeight = scrollContainer.scrollHeight;

          // Scroll to bottom
          scrollContainer.scrollTop = scrollContainer.scrollHeight;

          scrollCount++;
          console.log(`Gmail CRM: Scroll ${scrollCount}/${maxScrolls}, height: ${currentHeight}`);

          // Stop if we've reached max scrolls or height hasn't changed (no more content)
          if (scrollCount >= maxScrolls || currentHeight === previousHeight) {
            clearInterval(scrollInterval);
            console.log(`Gmail CRM: Scroll complete. Total scrolls: ${scrollCount}`);

            // Wait a bit for final emails to load
            setTimeout(() => resolve(), 1000);
          }

          previousHeight = currentHeight;
        }, 1500); // Wait 1.5 seconds between scrolls to allow emails to load

      } catch (error) {
        console.error('Gmail CRM: Error during scrolling:', error);
        resolve();
      }
    });
  }

  parseGmailDate(dateText) {
    // Gmail shows dates like "Dec 31", "3:45 PM", "Yesterday"
    const now = new Date();

    if (dateText.includes(':')) {
      // Today (shows time)
      return new Date().toISOString();
    } else if (dateText.toLowerCase().includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString();
    } else {
      // Try to parse date like "Dec 31"
      try {
        const date = new Date(dateText + ' ' + now.getFullYear());
        return date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
  }

  extractCompanyFromEmail(email) {
    // Extract domain from email and use as company name
    const match = email.match(/@([^>]+)/);
    if (match) {
      const domain = match[1].replace(/[<>]/g, '');
      // Capitalize first letter
      return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
    return 'Unknown Company';
  }

  isHospitalOrHealthSystem(emailFrom, emailSubject) {
    // Keywords that indicate a hospital or health system
    const hospitalKeywords = [
      'hospital', 'medical center', 'health system', 'healthcare',
      'clinic', 'medical group', 'physicians', 'surgery center',
      'regional medical', 'community hospital', 'health network',
      'health partners', 'memorial', 'university hospital',
      'children\'s hospital', 'veterans hospital', 'va hospital',
      'urgent care', 'primary care', 'specialty clinic',
      'medical', 'medicine', 'doctor', 'surgeon',
      'health care', 'patient', 'clinical'
    ];

    // Combine email and subject for checking
    const textToCheck = `${emailFrom} ${emailSubject}`.toLowerCase();

    // Check if any hospital keyword appears in the text
    return hospitalKeywords.some(keyword => textToCheck.includes(keyword));
  }

  extractNameFromEmail(email) {
    // Extract name from email address (before @)
    const match = email.match(/^([^@<]+)/);
    if (match) {
      let name = match[1].trim();

      // Handle formats like "firstname.lastname" or "firstname_lastname"
      name = name.replace(/[._-]/g, ' ');

      // Capitalize each word
      name = name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return name;
    }
    return 'Unknown';
  }

  extractDomainFromEmail(email) {
    // Extract full domain from email
    const match = email.match(/@([^>]+)/);
    if (match) {
      return match[1].replace(/[<>]/g, '').trim();
    }
    return '';
  }

  getInstitutionMappings() {
    // Multi-domain institution mappings
    // All domains for an institution map to the same name
    return {
      // Stanford - all domains grouped together
      'stanford': {
        name: 'Stanford University & Health',
        domains: ['stanford.edu', 'stanfordhealthcare.org', 'stanfordhealth.org', 'stanfordchildrens.org', 'stanfordmedicine.org', 'lpch.org']
      },

      // Harvard
      'harvard': {
        name: 'Harvard University & Medical',
        domains: ['harvard.edu', 'hms.harvard.edu', 'mgh.harvard.edu', 'bidmc.harvard.edu', 'childrens.harvard.edu', 'massgeneral.org', 'brighamandwomens.org']
      },

      // MIT
      'mit': {
        name: 'MIT',
        domains: ['mit.edu', 'csail.mit.edu', 'media.mit.edu']
      },

      // Yale
      'yale': {
        name: 'Yale University & Medicine',
        domains: ['yale.edu', 'ynhh.org', 'yalemedicine.org']
      },

      // UCSF
      'ucsf': {
        name: 'UCSF',
        domains: ['ucsf.edu', 'ucsfhealth.org', 'ucsfbenioffchildrens.org']
      },

      // UCLA
      'ucla': {
        name: 'UCLA',
        domains: ['ucla.edu', 'uclahealth.org', 'mednet.ucla.edu']
      },

      // USC
      'usc': {
        name: 'USC',
        domains: ['usc.edu', 'med.usc.edu', 'keck.usc.edu']
      },

      // UC Berkeley
      'berkeley': {
        name: 'UC Berkeley',
        domains: ['berkeley.edu', 'lbl.gov']
      },

      // Mayo Clinic
      'mayo': {
        name: 'Mayo Clinic',
        domains: ['mayo.edu', 'mayoclinic.org', 'mayoclinic.com']
      },

      // Cleveland Clinic
      'cleveland-clinic': {
        name: 'Cleveland Clinic',
        domains: ['ccf.org', 'clevelandclinic.org', 'clevelandclinic.com']
      },

      // Johns Hopkins
      'hopkins': {
        name: 'Johns Hopkins',
        domains: ['jhu.edu', 'jhmi.edu', 'hopkinsmedicine.org', 'jhsph.edu']
      },

      // Kaiser Permanente
      'kaiser': {
        name: 'Kaiser Permanente',
        domains: ['kp.org', 'kaiserpermanente.org', 'kpihp.org']
      },

      // Cedars-Sinai
      'cedars': {
        name: 'Cedars-Sinai Medical Center',
        domains: ['cshs.org', 'cedars-sinai.org', 'cedars-sinai.edu']
      },

      // NYU
      'nyu': {
        name: 'NYU Langone Health',
        domains: ['nyu.edu', 'nyulangone.org', 'nyumc.org', 'med.nyu.edu']
      },

      // Columbia
      'columbia': {
        name: 'Columbia University Medical Center',
        domains: ['columbia.edu', 'cumc.columbia.edu', 'nyp.org']
      },

      // Duke
      'duke': {
        name: 'Duke University & Health',
        domains: ['duke.edu', 'dukehealth.org', 'dm.duke.edu']
      },

      // UPENN
      'upenn': {
        name: 'University of Pennsylvania',
        domains: ['upenn.edu', 'pennmedicine.org', 'chop.edu']
      },

      // Northwestern
      'northwestern': {
        name: 'Northwestern Medicine',
        domains: ['northwestern.edu', 'nm.org', 'nmh.org', 'feinberg.northwestern.edu']
      },

      // UW Medicine
      'uw-medicine': {
        name: 'University of Washington Medicine',
        domains: ['uw.edu', 'uwmedicine.org', 'seattlechildrens.org']
      },

      // Tech Companies
      'google': {
        name: 'Google',
        domains: ['google.com', 'alphabet.com', 'verily.com', 'x.company']
      },

      'apple': {
        name: 'Apple',
        domains: ['apple.com', 'icloud.com']
      },

      'microsoft': {
        name: 'Microsoft',
        domains: ['microsoft.com', 'outlook.com', 'live.com', 'hotmail.com']
      },

      'meta': {
        name: 'Meta',
        domains: ['meta.com', 'facebook.com', 'fb.com', 'instagram.com', 'whatsapp.com']
      }
    };
  }

  extractInstitutionName(domain) {
    // Convert domain to readable institution name
    // Supports multiple domains mapping to same institution
    if (!domain) return 'Unknown Institution';

    const lowerDomain = domain.toLowerCase();
    const institutionMappings = this.getInstitutionMappings();

    // Check each institution's domains for a match
    for (const [institutionId, institutionData] of Object.entries(institutionMappings)) {
      for (const institutionDomain of institutionData.domains) {
        // Check for exact match or subdomain match
        if (lowerDomain === institutionDomain || lowerDomain.endsWith('.' + institutionDomain)) {
          console.log(`Gmail CRM: Matched domain "${domain}" to institution "${institutionData.name}"`);
          return institutionData.name;
        }
      }
    }

    // Try smart pattern recognition for hospitals
    const predictedName = this.predictHospitalName(domain);
    if (predictedName) {
      console.log(`Gmail CRM: Predicted institution name "${predictedName}" from domain "${domain}"`);
      return predictedName;
    }

    // If no mapping found, use intelligent parsing
    return this.parseInstitutionFromDomain(domain);
  }

  predictHospitalName(domain) {
    // Smart pattern recognition for hospital/health system names
    const lowerDomain = domain.toLowerCase();

    // Common hospital name patterns
    const patterns = [
      // St. / Saint patterns
      { regex: /st[.-]?lukes?/i, name: "St. Luke's Hospital" },
      { regex: /st[.-]?marys?/i, name: "St. Mary's Hospital" },
      { regex: /st[.-]?josephs?/i, name: "St. Joseph's Hospital" },
      { regex: /st[.-]?vincent/i, name: "St. Vincent's Hospital" },
      { regex: /st[.-]?francis/i, name: "St. Francis Hospital" },
      { regex: /saint[.-]?lukes?/i, name: "Saint Luke's Hospital" },

      // Regional/City hospitals
      { regex: /cityhospital/i, name: "City Hospital" },
      { regex: /countyhospital/i, name: "County Hospital" },
      { regex: /regionalmedical/i, name: "Regional Medical Center" },
      { regex: /communityhealth/i, name: "Community Health" },

      // University hospitals
      { regex: /uhhospital/i, name: "University Hospitals" },
      { regex: /uchealth/i, name: "UCHealth" },
      { regex: /umhealth/i, name: "University of Michigan Health" },
      { regex: /pennhealth/i, name: "Penn Health" },

      // Major systems
      { regex: /adventhealth/i, name: "AdventHealth" },
      { regex: /ascension/i, name: "Ascension Health" },
      { regex: /baptist[.-]?health/i, name: "Baptist Health" },
      { regex: /bon[.-]?secours/i, name: "Bon Secours Health" },
      { regex: /hcahealthcare/i, name: "HCA Healthcare" },
      { regex: /intermountain/i, name: "Intermountain Healthcare" },
      { regex: /memorial[.-]?health/i, name: "Memorial Health" },
      { regex: /methodist[.-]?health/i, name: "Methodist Health" },
      { regex: /tenet[.-]?health/i, name: "Tenet Healthcare" },
      { regex: /trinity[.-]?health/i, name: "Trinity Health" },

      // Veterans/Military
      { regex: /va[.-]?gov|veteranshealth/i, name: "Veterans Affairs Health" },
      { regex: /military[.-]?health/i, name: "Military Health System" },

      // Children's hospitals
      { regex: /childrens?[.-]?hospital/i, name: "Children's Hospital" },
      { regex: /pediatric/i, name: "Pediatric Hospital" },

      // Specialty
      { regex: /cancer[.-]?center/i, name: "Cancer Center" },
      { regex: /cardiac[.-]?center/i, name: "Cardiac Center" },
      { regex: /eyecare|ophthalmology/i, name: "Eye Care Center" }
    ];

    // Check each pattern
    for (const pattern of patterns) {
      if (pattern.regex.test(lowerDomain)) {
        // Try to extract city/region name from domain
        const cityMatch = lowerDomain.match(/^([a-z]+)[.-]/);
        if (cityMatch && cityMatch[1].length > 2 && !['www', 'mail', 'email'].includes(cityMatch[1])) {
          const city = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1);
          return `${city} ${pattern.name}`;
        }
        return pattern.name;
      }
    }

    // Try to extract hospital/health system name from common formats
    const hospitalFormats = [
      // Format: cityhealth.org -> "City Health"
      /^([a-z]+)(health|medical|hospital)/i,
      // Format: health-city.org -> "Health City"
      /(health|medical|hospital)-([a-z]+)/i,
      // Format: citymemorial.org -> "City Memorial"
      /^([a-z]+)(memorial|general|regional)/i
    ];

    for (const format of hospitalFormats) {
      const match = lowerDomain.match(format);
      if (match) {
        const parts = match.slice(1).filter(p => p);
        const name = parts.map(p =>
          p.charAt(0).toUpperCase() + p.slice(1)
        ).join(' ');

        if (name.length > 3) {
          return name;
        }
      }
    }

    return null;
  }

  parseInstitutionFromDomain(domain) {
    // Fallback parser for unknown domains
    const parts = domain.split('.');
    const lowerDomain = domain.toLowerCase();

    // Skip common email service domains
    const emailServices = ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'protonmail', 'mail', 'email'];

    // Filter out email service subdomains
    const filteredParts = parts.filter(part => !emailServices.includes(part.toLowerCase()));

    // Get the main part (usually second-to-last before TLD)
    let mainPart;
    if (filteredParts.length >= 2) {
      mainPart = filteredParts[filteredParts.length - 2];
    } else if (filteredParts.length === 1) {
      mainPart = filteredParts[0];
    } else {
      mainPart = parts[parts.length - 2] || parts[0];
    }

    // Handle common patterns
    const patterns = {
      'health': ' Health',
      'medical': ' Medical Center',
      'hospital': ' Hospital',
      'clinic': ' Clinic',
      'university': ' University',
      'college': ' College',
      'institute': ' Institute',
      'labs': ' Labs',
      'pharma': ' Pharmaceuticals',
      'bio': ' Biosciences'
    };

    // Clean up the name
    let institutionName = mainPart
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Add suffix if pattern matches
    for (const [pattern, suffix] of Object.entries(patterns)) {
      if (lowerDomain.includes(pattern) && !institutionName.toLowerCase().includes(pattern)) {
        institutionName += suffix;
        break;
      }
    }

    // Handle common abbreviations
    institutionName = institutionName
      .replace(/\bUc\b/g, 'UC')
      .replace(/\bMit\b/g, 'MIT')
      .replace(/\bNyu\b/g, 'NYU')
      .replace(/\bUcla\b/g, 'UCLA')
      .replace(/\bUsc\b/g, 'USC')
      .replace(/\bUcsf\b/g, 'UCSF')
      .replace(/\bUcsd\b/g, 'UCSD')
      .replace(/\bMgh\b/g, 'MGH')
      .replace(/\bNih\b/g, 'NIH')
      .replace(/\bCdc\b/g, 'CDC')
      .replace(/\bFda\b/g, 'FDA');

    return institutionName;
  }

  // ========== Gemini AI Integration ==========

  showGeminiSettings() {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';

    // Get existing API key
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      const existingKey = result.geminiApiKey || '';

      modal.innerHTML = `
        <div class="crm-modal-content">
          <h2>🤖 Gemini AI Settings</h2>
          <p style="font-size: 13px; color: #5f6368; margin-bottom: 16px;">
            Enable AI-powered email analysis to automatically identify deals, extract information, and populate your pipeline.
          </p>
          <div class="crm-form-group">
            <label><strong>Gemini API Key</strong></label>
            <input type="password" id="crm-gemini-api-key" class="crm-input"
                   value="${existingKey}"
                   placeholder="Enter your Gemini API key" />
            <p class="crm-help-text" style="color: #5f6368; margin-top: 4px;">
              Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a>
            </p>
          </div>
          <div class="crm-form-group">
            <label class="crm-checkbox-label">
              <input type="checkbox" id="crm-gemini-enabled" ${existingKey ? 'checked' : ''} />
              <span>Enable Smart Sync</span>
            </label>
          </div>
          <div class="crm-modal-actions">
            <button class="crm-btn" id="crm-cancel-settings">Cancel</button>
            <button class="crm-btn-primary" id="crm-save-settings">Save</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById('crm-cancel-settings')?.addEventListener('click', () => modal.remove());
      document.getElementById('crm-save-settings')?.addEventListener('click', () => {
        const apiKey = document.getElementById('crm-gemini-api-key').value.trim();
        const enabled = document.getElementById('crm-gemini-enabled').checked;

        if (enabled && !apiKey) {
          alert('Please enter a Gemini API key');
          return;
        }

        chrome.storage.local.set({
          geminiApiKey: apiKey,
          geminiEnabled: enabled
        }, () => {
          modal.remove();
          this.showNotification('✓ Gemini settings saved!');
        });
      });
    });
  }

  async smartSyncWithGemini() {
    // Check if API key is set
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['geminiApiKey', 'geminiEnabled'], resolve);
    });

    if (!settings.geminiEnabled || !settings.geminiApiKey) {
      this.showNotification('⚠️ Please configure Gemini API key in settings first');
      this.showGeminiSettings();
      return;
    }

    // Show date picker first
    this.showSmartSyncDialog();
  }

  showSmartSyncDialog() {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';

    const defaultDaysBack = 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - defaultDaysBack);
    const toDate = new Date();

    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>🤖 Smart Sync with Gemini AI</h2>
        <p style="font-size: 13px; color: #5f6368; margin-bottom: 16px;">
          AI will analyze <strong>all emails</strong> within the date range to identify deals and populate your pipeline.
        </p>
        <div class="crm-form-group">
          <label>From Date</label>
          <input type="date" id="crm-smart-sync-from" class="crm-input" value="${fromDate.toISOString().split('T')[0]}" />
        </div>
        <div class="crm-form-group">
          <label>To Date</label>
          <input type="date" id="crm-smart-sync-to" class="crm-input" value="${toDate.toISOString().split('T')[0]}" />
        </div>
        <p class="crm-help-text" style="color: #5f6368; font-size: 12px; margin-top: -8px;">
          ⚠️ Analyzing many emails will take longer and use more API credits
        </p>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-smart-sync">Cancel</button>
          <button class="crm-btn-primary" id="crm-start-smart-sync">🤖 Start Smart Sync</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-smart-sync')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-start-smart-sync')?.addEventListener('click', () => {
      const fromDate = document.getElementById('crm-smart-sync-from').value;
      const toDate = document.getElementById('crm-smart-sync-to').value;

      modal.remove();
      this.performSmartSync(fromDate, toDate);
    });
  }

  showSmartSyncProgress(title, message, progress = 0) {
    let modal = document.getElementById('crm-smart-sync-progress');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'crm-smart-sync-progress';
      modal.className = 'crm-modal';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="crm-modal-content crm-progress-modal">
        <div class="crm-progress-header">
          <h2>🤖 ${title}</h2>
          <button class="crm-close-sidebar" id="crm-close-progress-btn" title="Close">
            ×
          </button>
        </div>
        <div class="crm-progress-body">
          <div class="crm-progress-bar-container">
            <div class="crm-progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="crm-progress-status">${message}</div>
          <div class="crm-progress-log" id="crm-progress-log"></div>
        </div>
      </div>
    `;

    // Add close button event listener
    const closeBtn = document.getElementById('crm-close-progress-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }
  }

  updateSmartSyncProgress(message, progress) {
    const modal = document.getElementById('crm-smart-sync-progress');
    if (!modal) return;

    const statusEl = modal.querySelector('.crm-progress-status');
    const progressBar = modal.querySelector('.crm-progress-bar');
    const log = document.getElementById('crm-progress-log');

    if (statusEl) statusEl.textContent = message;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (log) {
      const logEntry = document.createElement('div');
      logEntry.className = 'crm-progress-log-entry';
      logEntry.innerHTML = `<span class="crm-log-time">${new Date().toLocaleTimeString()}</span> ${message}`;
      log.appendChild(logEntry);
      log.scrollTop = log.scrollHeight;
    }
  }

  closeSmartSyncProgress() {
    // No longer auto-closes - user must click X button to close
    // Modal remains open so user can review the full log
  }

  async performSmartSync(fromDate, toDate) {
    console.log('Gmail CRM: Starting Smart Sync with Gemini...');

    // Show progress modal
    this.showSmartSyncProgress('AI Email Analysis', 'Initializing...', 0);

    const syncBtn = document.getElementById('crm-smart-sync-btn');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '⏳ Analyzing...';
    }

    try {
      // Get API key
      this.updateSmartSyncProgress('🔑 Retrieving Gemini API key...', 5);
      const settings = await new Promise(resolve => {
        chrome.storage.local.get(['geminiApiKey'], resolve);
      });

      if (!settings.geminiApiKey) {
        this.updateSmartSyncProgress('❌ No API key found. Please configure in settings.', 0);
        this.showNotification('❌ Please configure Gemini API key first');
        return;
      }

      this.updateSmartSyncProgress(`✓ API key configured`, 8);

      // Scan emails
      this.updateSmartSyncProgress('📧 Scanning Gmail inbox...', 10);
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);

      this.updateSmartSyncProgress(`📧 Date range: ${fromDateObj.toDateString()} to ${toDateObj.toDateString()}`, 12);

      const emailRows = await this.scanGmailEmails(fromDateObj, toDateObj);

      console.log(`Gmail CRM: Found ${emailRows.length} emails to analyze`);

      if (emailRows.length === 0) {
        this.updateSmartSyncProgress('⚠️ No emails found in date range. Try expanding the date range.', 20);
        this.showNotification('⚠️ No emails found to analyze');
        return;
      }

      // Pre-filter emails to reduce unnecessary API calls
      this.updateSmartSyncProgress('🔍 Pre-filtering emails to reduce API usage...', 15);

      const filteredEmails = emailRows.filter(email => {
        const fromEmail = email.from.toLowerCase();
        const subject = (email.subject || '').toLowerCase();

        // Filter out automated/notification emails
        if (fromEmail.includes('noreply') ||
            fromEmail.includes('no-reply') ||
            fromEmail.includes('donotreply') ||
            fromEmail.includes('notifications@') ||
            fromEmail.includes('automated@') ||
            fromEmail.includes('digest@') ||
            fromEmail.includes('mailer-daemon')) {
          return false;
        }

        // Filter out obvious personal email domains (unless .edu/.org)
        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
        const isPersonalDomain = personalDomains.some(domain => fromEmail.endsWith(domain));
        if (isPersonalDomain && !email.isEducational && !email.isOrganization) {
          return false;
        }

        // Filter out newsletters/marketing
        if (subject.includes('unsubscribe') ||
            subject.includes('newsletter') ||
            subject.startsWith('re: your order') ||
            subject.includes('shipping confirmation') ||
            subject.includes('receipt for') ||
            subject.includes('invoice #')) {
          return false;
        }

        // Keep high-priority domains
        if (email.isEducational || email.isOrganization || email.isHospital) {
          return true;
        }

        // Keep emails with deal-related keywords
        const dealKeywords = ['demo', 'meeting', 'interested', 'pricing', 'proposal', 'trial', 'partnership', 'quote', 'presentation', 'call', 'discuss'];
        if (dealKeywords.some(keyword => subject.includes(keyword))) {
          return true;
        }

        // Keep professional domain emails
        return !isPersonalDomain;
      });

      const emailsToAnalyze = filteredEmails;
      const filtered = emailRows.length - filteredEmails.length;

      this.updateSmartSyncProgress(
        `✓ Pre-filtered ${emailRows.length} emails → ${emailsToAnalyze.length} potential deals (saved ${filtered} API calls)`,
        20
      );

      // Show first few email subjects as preview
      const previewEmails = emailsToAnalyze.slice(0, 5);
      previewEmails.forEach((email, idx) => {
        this.updateSmartSyncProgress(`  Preview ${idx + 1}: "${email.subject}"`, 20);
      });
      if (emailsToAnalyze.length > 5) {
        this.updateSmartSyncProgress(`  ... and ${emailsToAnalyze.length - 5} more emails`, 20);
      }

      // Analyze emails in batches with Gemini (optimized batch size)
      const batchSize = 25; // Increased from 10 to reduce API calls
      let totalDeals = 0;
      const totalBatches = Math.ceil(emailsToAnalyze.length / batchSize);

      for (let i = 0; i < emailsToAnalyze.length; i += batchSize) {
        const batch = emailsToAnalyze.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        const batchProgress = 20 + ((currentBatch / totalBatches) * 60);

        this.updateSmartSyncProgress(
          `🤖 Analyzing batch ${currentBatch}/${totalBatches} (${batch.length} emails)...`,
          batchProgress
        );

        // Show email subjects being analyzed (first 5 only to save space)
        batch.slice(0, 5).forEach((email, idx) => {
          this.updateSmartSyncProgress(`  📨 ${idx + 1}. ${email.subject || '(no subject)'}`, batchProgress);
        });
        if (batch.length > 5) {
          this.updateSmartSyncProgress(`  ... and ${batch.length - 5} more`, batchProgress);
        }

        try {
          const deals = await this.analyzeEmailBatchWithGemini(batch, settings.geminiApiKey);

          if (deals && deals.length > 0) {
            this.updateSmartSyncProgress(`✓ AI identified ${deals.length} potential deals in this batch`, batchProgress);

            // Create deals from Gemini's analysis
            for (const dealData of deals) {
              await this.createDealFromGeminiAnalysis(dealData, batch);
              totalDeals++;
              this.updateSmartSyncProgress(
                `  ✨ Created deal: "${dealData.dealTitle}" (${dealData.institution || 'Unknown'})`,
                batchProgress
              );
            }
          } else {
            this.updateSmartSyncProgress(`  ℹ️ No deals identified in this batch`, batchProgress);
          }

          // Rate limiting: Wait 2 seconds between batches to avoid quota issues
          if (i + batchSize < emailsToAnalyze.length) {
            this.updateSmartSyncProgress(`  ⏳ Waiting 2s before next batch (rate limiting)...`, batchProgress);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (batchError) {
          this.updateSmartSyncProgress(`  ❌ Error analyzing batch: ${batchError.message}`, batchProgress);
          console.error('Gmail CRM: Batch analysis error:', batchError);
          // Continue to next batch instead of failing completely
        }
      }

      // Refresh
      this.updateSmartSyncProgress('🔄 Refreshing pipeline view...', 95);
      await this.loadData();
      if (this.currentPipeline) {
        this.renderPipelineBoard();
      }

      console.log(`Gmail CRM: Smart Sync complete. Created ${totalDeals} deals`);
      this.updateSmartSyncProgress(`✅ Smart Sync Complete! Created ${totalDeals} deals`, 100);
      this.showNotification(`✓ Smart Sync complete! Created ${totalDeals} deals`);

      this.closeSmartSyncProgress();

    } catch (error) {
      console.error('Gmail CRM: Error in Smart Sync:', error);
      this.updateSmartSyncProgress(`❌ Error: ${error.message}`, 0);
      this.showNotification('❌ Smart Sync failed. Check progress window for details.');
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '🤖 Smart Sync';
      }
    }
  }

  async analyzeEmailBatchWithGemini(emails, apiKey) {
    // Send only essential fields to reduce tokens
    const emailContext = emails.map(e => ({
      subj: e.subject,
      body: e.bodySnippet || '',
      from: e.fromName,
      email: e.from,
      domain: e.domainType, // edu/org/healthcare/other
      inst: e.institution
    }));

    // Concise prompt to save tokens
    const prompt = `CRM analyst for surgical AR company. Find sales deals/opportunities from these emails.

Priority: .edu/.org/healthcare domains = HIGH. Look for: demo, meeting, pricing, proposal, trial keywords.

Extract deals as JSON:
- dealTitle: brief title
- institution: hospital/org name
- institutionAddress: full address if mentioned (street, city, state, zip)
- contact: person name
- contactEmail: email
- contactTitle: job title/role if mentioned
- decisionMakers: array of names/titles of other stakeholders mentioned (e.g., ["Dr. Smith - Dept Head", "Jane Doe - VP"])
- stage: lead|contacted|qualified|proposal|negotiation|closed-won|closed-lost
- dealValue: exact USD amount if mentioned (look for $, budget, price, quote), else 0
- priority: High|Medium|Low
- summary: 1-2 sentences
- isHospital: true/false

Emails:
${JSON.stringify(emailContext)}

Return JSON array: [{"dealTitle":"...","institution":"...","institutionAddress":"","contact":"...","contactEmail":"...","contactTitle":"","decisionMakers":[],"stage":"...","dealValue":0,"priority":"...","summary":"...","isHospital":true}]`;

    try {
      console.log('Gmail CRM: Calling Gemini API with', emails.length, 'emails');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gmail CRM: Gemini API error response:', errorText);
        throw new Error(`Gemini API error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Gmail CRM: Gemini API response data:', data);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      console.log('Gmail CRM: Gemini response text:', text);

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const deals = JSON.parse(jsonMatch[0]);
        console.log('Gmail CRM: Parsed', deals.length, 'deals from Gemini response');
        return deals;
      }

      console.log('Gmail CRM: No JSON array found in Gemini response');
      return [];
    } catch (error) {
      console.error('Gmail CRM: Error calling Gemini API:', error);
      throw error; // Re-throw so we can show the error in the UI
    }
  }

  parseAddress(addressString) {
    if (!addressString || addressString.trim() === '') {
      return { street: null, city: null, state: null, zip: null };
    }

    // Try to parse a standard US address format
    // Example: "123 Main St, Boston, MA 02114"
    const parts = addressString.split(',').map(p => p.trim());

    if (parts.length >= 3) {
      const street = parts[0];
      const city = parts[1];
      const stateZip = parts[2].match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)/);

      if (stateZip) {
        return {
          street,
          city,
          state: stateZip[1],
          zip: stateZip[2]
        };
      }
    }

    // If parsing fails, return the whole string as street address
    return { street: addressString, city: null, state: null, zip: null };
  }

  async createDealFromGeminiAnalysis(dealData, sourceEmails = []) {
    const dealId = 'deal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Map Gemini's stage to our stage IDs
    const stageMapping = {
      'lead': 'lead',
      'contacted': 'contacted',
      'qualified': 'qualified',
      'proposal': 'proposal',
      'negotiation': 'negotiation',
      'closed-won': 'closed-won',
      'closed-lost': 'closed-lost'
    };

    const stageId = stageMapping[dealData.stage?.toLowerCase()] || 'lead';

    // Parse institution address if provided
    let parsedAddress = this.parseAddress(dealData.institutionAddress);

    // Find source email(s) that match this deal's contact email or institution
    const linkedEmails = [];
    for (const email of sourceEmails) {
      // Match by contact email or institution/domain
      const emailMatches = email.from.toLowerCase() === dealData.contactEmail?.toLowerCase() ||
                          email.domain === this.extractDomainFromEmail(dealData.contactEmail || '') ||
                          email.institution?.toLowerCase() === dealData.institution?.toLowerCase();

      if (emailMatches && email.threadId) {
        linkedEmails.push({
          threadId: email.threadId,
          subject: email.subject,
          from: email.from,
          date: email.date,
          url: email.url,
          snippet: email.bodySnippet
        });
      }
    }

    const deal = {
      id: dealId,
      pipelineId: 'sales',
      stageId: stageId,
      emailSubject: dealData.dealTitle || 'AI-Identified Deal',
      company: dealData.institution,
      institution: dealData.institution,
      contactEmail: dealData.contactEmail,
      contactTitle: dealData.contactTitle || null,
      decisionMakers: dealData.decisionMakers || [],
      status: 'Active',
      priority: dealData.priority || 'Medium',
      value: dealData.dealValue || 0,
      isHospital: dealData.isHospital || false,
      // Address fields (from Gemini or null)
      address: parsedAddress.street || null,
      city: parsedAddress.city || null,
      state: parsedAddress.state || null,
      zip: parsedAddress.zip || null,
      country: 'USA',
      latitude: null,
      longitude: null,
      addressConfirmed: parsedAddress.street ? false : null,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      linkedEmails: linkedEmails,
      notesHistory: [{
        text: `AI Analysis: ${dealData.summary}`,
        createdAt: new Date().toISOString()
      }],
      calls: [],
      contacts: dealData.contact ? [dealData.contact] : [],
      aiGenerated: true
    };

    this.deals[dealId] = deal;
    await this.saveDeal(deal);
    console.log('Gmail CRM: Created deal from AI analysis:', dealData.dealTitle, 'with', linkedEmails.length, 'linked emails');
  }

  async generateAISummary(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    // Get Gemini API key
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['geminiApiKey'], resolve);
    });

    if (!result.geminiApiKey) {
      this.showNotification('❌ Please set up Gemini API key in Settings first');
      return;
    }

    // Show loading state
    const summaryContent = document.getElementById('crm-ai-summary-content');
    if (summaryContent) {
      summaryContent.innerHTML = '<div class="crm-ai-loading">🤖 Analyzing deal... This may take a moment.</div>';
    }

    try {
      // Gather all deal context
      const context = this.buildDealContext(deal);

      // Call Gemini API
      const prompt = `You are an expert CRM analyst. Analyze this sales deal and provide:

1. A comprehensive summary of the deal status and history (2-3 paragraphs)
2. Key insights about the deal's progress
3. Risk factors or concerns
4. 3-5 specific, actionable next steps to move this deal forward

Deal Context:
${context}

Respond in JSON format:
{
  "summary": "comprehensive summary here",
  "insights": ["insight 1", "insight 2", ...],
  "risks": ["risk 1", "risk 2", ...],
  "nextSteps": ["step 1", "step 2", ...]
}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${result.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;

      // Extract JSON from markdown code blocks if present
      let aiResponse;
      try {
        const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/) || aiText.match(/\{[\s\S]*\}/);
        aiResponse = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiText);
      } catch (e) {
        // Fallback if JSON parsing fails
        aiResponse = {
          summary: aiText,
          insights: [],
          risks: [],
          nextSteps: []
        };
      }

      // Save AI summary to deal
      deal.aiSummary = {
        summary: aiResponse.summary,
        insights: aiResponse.insights || [],
        risks: aiResponse.risks || [],
        nextSteps: aiResponse.nextSteps || [],
        generatedAt: new Date().toISOString()
      };

      await this.saveDeal(deal);
      this.showDealSidebar(dealId); // Refresh to show summary
      this.showNotification('✅ AI Summary generated successfully!');

    } catch (error) {
      console.error('Error generating AI summary:', error);
      if (summaryContent) {
        summaryContent.innerHTML = '<p class="crm-error-state">❌ Failed to generate summary. Please check your Gemini API key in Settings.</p>';
      }
      this.showNotification('❌ Failed to generate AI summary');
    }
  }

  buildDealContext(deal) {
    const parts = [];

    // Basic info
    parts.push(`Deal Name: ${deal.emailSubject || 'Untitled'}`);
    parts.push(`Stage: ${this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.name || 'Unknown'}`);
    parts.push(`Status: ${deal.status || 'Active'}`);
    parts.push(`Deal Value: $${deal.value || 0}`);
    parts.push(`Probability: ${deal.probability || 90}%`);
    parts.push(`Priority: ${deal.priority || 'High'}`);
    parts.push(`Contact: ${deal.contactEmail || 'Not set'}`);
    parts.push(`Assigned To: ${deal.assignedTo || 'Unassigned'}`);
    parts.push(`Created: ${new Date(deal.createdAt || deal.lastUpdated).toLocaleDateString()}`);

    // Tasks
    if (deal.tasks && deal.tasks.length > 0) {
      parts.push(`\nTasks (${deal.tasks.length}):`);
      deal.tasks.forEach(task => {
        const status = task.completed ? '✓' : '○';
        const due = task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString()})` : '';
        parts.push(`${status} ${task.title}${due} - ${task.priority || 'Medium'} priority`);
      });
    }

    // Notes
    if (deal.notesHistory && deal.notesHistory.length > 0) {
      parts.push(`\nNotes (${deal.notesHistory.length}):`);
      deal.notesHistory.slice(-3).forEach(note => {
        parts.push(`- ${note.text} (${new Date(note.createdAt).toLocaleDateString()})`);
      });
    }

    // Linked emails
    if (deal.linkedEmails && deal.linkedEmails.length > 0) {
      parts.push(`\nEmail Activity (${deal.linkedEmails.length} emails):`);
      deal.linkedEmails.slice(-3).forEach(email => {
        parts.push(`- ${email.subject || 'No subject'} from ${email.from || 'Unknown'} (${new Date(email.date).toLocaleDateString()})`);
      });
    }

    // Calls
    if (deal.calls && deal.calls.length > 0) {
      parts.push(`\nCalls (${deal.calls.length}):`);
      deal.calls.forEach(call => {
        parts.push(`- ${call.title || 'Untitled call'} (${call.date ? new Date(call.date).toLocaleDateString() : 'No date'})`);
      });
    }

    // Status history
    if (deal.statusHistory && deal.statusHistory.length > 0) {
      parts.push(`\nStatus History:`);
      deal.statusHistory.slice(-3).forEach(h => {
        parts.push(`- Changed to "${h.changedTo}" on ${new Date(h.changedAt).toLocaleDateString()}`);
      });
    }

    return parts.join('\n');
  }

  // Magic Columns - Auto-calculated fields

  getMagicColumns(deal) {
    return {
      dealAge: this.calculateDealAge(deal),
      daysSinceLastActivity: this.calculateDaysSinceLastActivity(deal),
      emailDomain: this.extractEmailDomain(deal.contactEmail),
      companyName: this.extractCompanyFromEmail(deal.contactEmail),
      weightedValue: this.calculateWeightedValue(deal),
      expectedCloseDate: this.estimateCloseDate(deal),
      stageVelocity: this.calculateStageVelocity(deal)
    };
  }

  calculateDealAge(deal) {
    const createdDate = new Date(deal.createdAt || deal.lastUpdated);
    const now = new Date();
    const diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  calculateDaysSinceLastActivity(deal) {
    const activities = [];

    // Check last email
    if (deal.linkedEmails && deal.linkedEmails.length > 0) {
      const lastEmail = deal.linkedEmails[deal.linkedEmails.length - 1];
      if (lastEmail.date) activities.push(new Date(lastEmail.date));
    }

    // Check last note
    if (deal.notesHistory && deal.notesHistory.length > 0) {
      const lastNote = deal.notesHistory[deal.notesHistory.length - 1];
      if (lastNote.createdAt) activities.push(new Date(lastNote.createdAt));
    }

    // Check last comment
    if (deal.comments && deal.comments.length > 0) {
      const lastComment = deal.comments[deal.comments.length - 1];
      if (lastComment.createdAt) activities.push(new Date(lastComment.createdAt));
    }

    // Check last task completion
    if (deal.tasks && deal.tasks.length > 0) {
      deal.tasks.forEach(task => {
        if (task.completedAt) activities.push(new Date(task.completedAt));
      });
    }

    // Check last status change
    if (deal.statusHistory && deal.statusHistory.length > 0) {
      const lastStatusChange = deal.statusHistory[deal.statusHistory.length - 1];
      if (lastStatusChange.changedAt) activities.push(new Date(lastStatusChange.changedAt));
    }

    if (activities.length === 0) {
      return this.calculateDealAge(deal); // Fall back to deal age
    }

    // Get most recent activity
    const lastActivity = new Date(Math.max(...activities));
    const now = new Date();
    const diffDays = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  extractEmailDomain(email) {
    if (!email || !email.includes('@')) return '';
    return email.split('@')[1].toLowerCase();
  }

  calculateWeightedValue(deal) {
    const value = parseFloat(deal.value) || 0;
    const probability = parseFloat(deal.probability) || 90;
    return Math.round(value * (probability / 100));
  }

  estimateCloseDate(deal) {
    // Estimate based on average deal cycle for stage
    const stageIndex = this.currentPipeline?.stages.findIndex(s => s.id === deal.stageId) || 0;
    const totalStages = this.currentPipeline?.stages.length || 4;
    const remainingStages = totalStages - stageIndex;

    // Assume 7 days per stage on average
    const daysToClose = remainingStages * 7;

    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + daysToClose);

    return closeDate.toLocaleDateString();
  }

  calculateStageVelocity(deal) {
    // Calculate how many days deal has been in current stage
    const stageHistory = deal.stageHistory || [];
    if (stageHistory.length === 0) {
      return this.calculateDealAge(deal);
    }

    const lastStageChange = stageHistory[stageHistory.length - 1];
    const stageEntryDate = new Date(lastStageChange.changedAt || deal.lastUpdated);
    const now = new Date();
    const daysInStage = Math.floor((now - stageEntryDate) / (1000 * 60 * 60 * 24));

    return daysInStage;
  }

  // Mail Merge Methods

  showComposeEmailDialog(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    // Load templates from storage
    chrome.storage.local.get(['emailTemplates'], (result) => {
      const templates = result.emailTemplates || this.getDefaultEmailTemplates();

      const modal = document.createElement('div');
      modal.className = 'crm-modal';
      modal.innerHTML = `
        <div class="crm-modal-content" style="max-width: 700px;">
          <h2>📧 Compose Email</h2>

          <div class="crm-form-group">
            <label>Select Template</label>
            <select id="crm-email-template-select" class="crm-input">
              <option value="">-- Select a template --</option>
              ${templates.map((t, idx) => `<option value="${idx}">${t.name}</option>`).join('')}
            </select>
          </div>

          <div class="crm-form-group">
            <label>To</label>
            <input type="email" id="crm-email-to" class="crm-input" value="${deal.contactEmail || ''}" />
          </div>

          <div class="crm-form-group">
            <label>Subject</label>
            <input type="text" id="crm-email-subject" class="crm-input" placeholder="Email subject..." />
          </div>

          <div class="crm-form-group">
            <label>Body</label>
            <textarea id="crm-email-body" class="crm-textarea" rows="12" placeholder="Type your email here...

Available variables:
{{firstName}} - Contact's first name
{{lastName}} - Contact's last name
{{email}} - Contact's email
{{dealName}} - Deal/email subject
{{company}} - Company name
{{value}} - Deal value
{{stage}} - Current stage
{{contactTitle}} - Contact's title"></textarea>
          </div>

          <div class="crm-form-group">
            <div style="background: #f0f4ff; padding: 12px; border-radius: 4px; border-left: 3px solid #1a73e8;">
              <strong>💡 Preview:</strong>
              <div id="crm-email-preview" style="margin-top: 8px; white-space: pre-wrap; font-family: monospace; font-size: 13px;"></div>
            </div>
          </div>

          <div class="crm-modal-actions">
            <button class="crm-btn" id="crm-cancel-email">Cancel</button>
            <button class="crm-btn-primary" id="crm-open-gmail-compose">Open in Gmail</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const templateSelect = document.getElementById('crm-email-template-select');
      const subjectInput = document.getElementById('crm-email-subject');
      const bodyTextarea = document.getElementById('crm-email-body');
      const previewDiv = document.getElementById('crm-email-preview');

      // Update preview when body changes
      const updatePreview = () => {
        const subject = subjectInput.value;
        const body = bodyTextarea.value;
        const previewSubject = this.replaceTemplateVariables(subject, deal);
        const previewBody = this.replaceTemplateVariables(body, deal);
        previewDiv.innerHTML = `<strong>Subject:</strong> ${previewSubject || '(empty)'}<br><br>${previewBody || '(empty)'}`;
      };

      // Load template when selected
      templateSelect.addEventListener('change', (e) => {
        const templateIdx = parseInt(e.target.value);
        if (!isNaN(templateIdx) && templates[templateIdx]) {
          const template = templates[templateIdx];
          subjectInput.value = template.subject;
          bodyTextarea.value = template.body;
          updatePreview();
        }
      });

      subjectInput.addEventListener('input', updatePreview);
      bodyTextarea.addEventListener('input', updatePreview);

      document.getElementById('crm-cancel-email')?.addEventListener('click', () => modal.remove());

      document.getElementById('crm-open-gmail-compose')?.addEventListener('click', () => {
        const to = document.getElementById('crm-email-to').value;
        const subject = this.replaceTemplateVariables(subjectInput.value, deal);
        const body = this.replaceTemplateVariables(bodyTextarea.value, deal);

        if (!to || !to.trim()) {
          alert('Please enter a recipient email address');
          return;
        }

        this.openGmailCompose(to, subject, body);
        modal.remove();
        this.showNotification('Opening Gmail compose...');
      });

      // Initial preview update
      updatePreview();
    });
  }

  showTemplateManager() {
    chrome.storage.local.get(['emailTemplates'], (result) => {
      let templates = result.emailTemplates || this.getDefaultEmailTemplates();

      const renderTemplatesList = () => {
        return templates.map((t, idx) => `
          <div class="crm-template-item" style="padding: 12px; border: 1px solid #dadce0; border-radius: 4px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <strong>${t.name}</strong>
                <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">
                  Subject: ${t.subject}
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="crm-btn-small crm-edit-template" data-idx="${idx}">Edit</button>
                <button class="crm-btn-small crm-delete-template" data-idx="${idx}">Delete</button>
              </div>
            </div>
          </div>
        `).join('');
      };

      const modal = document.createElement('div');
      modal.className = 'crm-modal';
      modal.innerHTML = `
        <div class="crm-modal-content" style="max-width: 700px;">
          <h2>📝 Email Templates</h2>

          <div id="crm-templates-list" style="margin-bottom: 16px; max-height: 400px; overflow-y: auto;">
            ${renderTemplatesList()}
          </div>

          <button class="crm-btn-primary" id="crm-add-template">+ Add New Template</button>

          <div class="crm-modal-actions" style="margin-top: 16px;">
            <button class="crm-btn" id="crm-close-templates">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const refreshList = () => {
        document.getElementById('crm-templates-list').innerHTML = renderTemplatesList();
        attachListeners();
      };

      const attachListeners = () => {
        modal.querySelectorAll('.crm-edit-template').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            this.showTemplateEditor(templates[idx], idx, templates, refreshList);
          });
        });

        modal.querySelectorAll('.crm-delete-template').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (confirm(`Delete template "${templates[idx].name}"?`)) {
              templates.splice(idx, 1);
              chrome.storage.local.set({ emailTemplates: templates }, () => {
                refreshList();
                this.showNotification('Template deleted');
              });
            }
          });
        });
      };

      attachListeners();

      document.getElementById('crm-add-template')?.addEventListener('click', () => {
        this.showTemplateEditor(null, -1, templates, refreshList);
      });

      document.getElementById('crm-close-templates')?.addEventListener('click', () => modal.remove());
    });
  }

  showTemplateEditor(template, idx, templates, refreshCallback) {
    const isNew = idx === -1;

    const editorModal = document.createElement('div');
    editorModal.className = 'crm-modal';
    editorModal.innerHTML = `
      <div class="crm-modal-content" style="max-width: 700px;">
        <h2>${isNew ? 'New' : 'Edit'} Email Template</h2>

        <div class="crm-form-group">
          <label>Template Name</label>
          <input type="text" id="crm-template-name" class="crm-input" value="${template?.name || ''}" placeholder="e.g., Follow-up Email" />
        </div>

        <div class="crm-form-group">
          <label>Subject</label>
          <input type="text" id="crm-template-subject" class="crm-input" value="${template?.subject || ''}" placeholder="Use {{variables}} for personalization" />
        </div>

        <div class="crm-form-group">
          <label>Body</label>
          <textarea id="crm-template-body" class="crm-textarea" rows="10" placeholder="Available variables:
{{firstName}}, {{lastName}}, {{email}}, {{dealName}}, {{company}}, {{value}}, {{stage}}, {{contactTitle}}">${template?.body || ''}</textarea>
        </div>

        <div style="background: #f0f4ff; padding: 12px; border-radius: 4px; font-size: 13px;">
          <strong>💡 Variables:</strong> {{firstName}}, {{lastName}}, {{email}}, {{dealName}}, {{company}}, {{value}}, {{stage}}, {{contactTitle}}
        </div>

        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-template-edit">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-template-edit">Save Template</button>
        </div>
      </div>
    `;

    document.body.appendChild(editorModal);

    document.getElementById('crm-cancel-template-edit')?.addEventListener('click', () => editorModal.remove());

    document.getElementById('crm-save-template-edit')?.addEventListener('click', () => {
      const name = document.getElementById('crm-template-name').value.trim();
      const subject = document.getElementById('crm-template-subject').value.trim();
      const body = document.getElementById('crm-template-body').value.trim();

      if (!name || !subject || !body) {
        alert('Please fill in all fields');
        return;
      }

      const templateData = { name, subject, body };

      if (isNew) {
        templates.push(templateData);
      } else {
        templates[idx] = templateData;
      }

      chrome.storage.local.set({ emailTemplates: templates }, () => {
        editorModal.remove();
        refreshCallback();
        this.showNotification(`Template ${isNew ? 'created' : 'updated'}!`);
      });
    });
  }

  replaceTemplateVariables(template, deal) {
    if (!template || !deal) return template;

    const contactName = deal.contactEmail ? this.extractNameFromEmail(deal.contactEmail) : '';
    const nameParts = contactName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const company = deal.contactEmail ? this.extractCompanyFromEmail(deal.contactEmail) : '';
    const stageName = this.currentPipeline?.stages.find(s => s.id === deal.stageId)?.name || '';

    const variables = {
      firstName: firstName,
      lastName: lastName,
      email: deal.contactEmail || '',
      dealName: deal.emailSubject || 'Untitled Deal',
      company: company,
      value: deal.value ? `$${Number(deal.value).toLocaleString()}` : '',
      stage: stageName,
      contactTitle: deal.contactTitle || ''
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  openGmailCompose(to, subject, body) {
    // Construct Gmail compose URL
    const params = new URLSearchParams();
    if (to) params.append('to', to);
    if (subject) params.append('su', subject);
    if (body) params.append('body', body);

    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
    window.open(composeUrl, '_blank');
  }

  getDefaultEmailTemplates() {
    return [
      {
        name: 'Introduction Email',
        subject: 'Introduction - {{company}}',
        body: `Hi {{firstName}},\n\nI wanted to reach out to introduce myself and our company. We specialize in [your service/product].\n\nI noticed that {{company}} might benefit from our solutions. Would you be open to a brief call to discuss how we can help?\n\nBest regards,\n[Your name]`
      },
      {
        name: 'Follow-up Email',
        subject: 'Following up - {{dealName}}',
        body: `Hi {{firstName}},\n\nI wanted to follow up on our previous conversation regarding {{dealName}}.\n\nDo you have any questions or would you like to schedule a call to discuss next steps?\n\nLooking forward to hearing from you.\n\nBest,\n[Your name]`
      },
      {
        name: 'Proposal Email',
        subject: 'Proposal for {{company}}',
        body: `Hi {{firstName}},\n\nThank you for your interest in working with us. I've prepared a proposal for {{dealName}} with an estimated value of {{value}}.\n\nPlease review the attached proposal and let me know if you have any questions.\n\nI'm excited about the opportunity to work with {{company}}!\n\nBest regards,\n[Your name]`
      },
      {
        name: 'Check-in Email',
        subject: 'Checking in',
        body: `Hi {{firstName}},\n\nI hope this email finds you well. I wanted to check in and see how things are progressing with {{dealName}}.\n\nIs there anything I can help with or any questions I can answer?\n\nBest,\n[Your name]`
      }
    ];
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const crm = new GmailCRM();
    crm.init();
  });
} else {
  const crm = new GmailCRM();
  crm.init();
}
