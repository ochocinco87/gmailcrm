// Gmail CRM Content Script - Full Streak-like integration

class GmailCRM {
  constructor() {
    this.initialized = false;
    this.currentPipeline = null;
    this.pipelinesNav = null;
    this.pipelineView = null;
    this.deals = {};
    this.pipelines = [];
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
    return new Promise((resolve) => {
      chrome.storage.local.get(['deals', 'pipelines'], (result) => {
        this.deals = result.deals || {};
        this.pipelines = result.pipelines || this.getDefaultPipelines();

        if (!result.pipelines) {
          chrome.storage.local.set({ pipelines: this.pipelines });
        }
        resolve();
      });
    });
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

    this.pipelineView.innerHTML = `
      <div class="crm-pipeline-header">
        <div class="crm-pipeline-title">
          <h1>${pipeline.name}</h1>
          <span class="crm-deal-count">${dealsInPipeline.length} ${pipeline.type === 'customer-tracking' ? 'Customer Sites' : 'Deals'}</span>
        </div>
        <div class="crm-pipeline-actions">
          ${pipeline.type === 'customer-tracking' ? '<button class="crm-btn" id="crm-dashboard-btn">📊 Dashboard</button>' : ''}
          <button class="crm-btn" id="crm-refresh-btn">🔄 Refresh</button>
          <button class="crm-btn" id="crm-settings-btn">⚙️ Settings</button>
          <button class="crm-btn" id="crm-share-btn">🔗 Share</button>
          <button class="crm-btn-primary" id="crm-add-deal-btn">+ Add ${pipeline.type === 'customer-tracking' ? 'Customer Site' : 'Deal'}</button>
        </div>
      </div>

      <div class="crm-stages-bar">
        ${stagesHeader}
      </div>

      <div class="crm-main-layout">
        <div class="crm-deals-table-container">
          <table class="crm-deals-table">
            <thead>
              <tr>
                <th class="crm-th-checkbox"><input type="checkbox" /></th>
                <th class="crm-th-name">Name</th>
                <th class="crm-th-status">Status</th>
                <th class="crm-th-priority">Priority</th>
                <th class="crm-th-value">Deal Size</th>
                <th class="crm-th-prob">Prob</th>
                <th class="crm-th-contact">Contact</th>
                <th class="crm-th-assigned">Assigned To</th>
                <th class="crm-th-date">Date Last Updated</th>
                <th class="crm-th-notes">Notes</th>
              </tr>
            </thead>
            <tbody id="crm-deals-tbody"></tbody>
          </table>
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

    // Render deals grouped by stage
    this.renderDealsTable();

    // Add event listeners
    document.getElementById('crm-add-deal-btn')?.addEventListener('click', () => {
      this.showAddDealDialog();
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

  createDealRow(deal, stage) {
    const row = document.createElement('tr');
    row.className = 'crm-deal-row';
    row.draggable = true;
    row.dataset.dealId = deal.id;
    row.dataset.stageId = stage.id;

    const formattedValue = deal.value ? `$${Number(deal.value).toLocaleString()}` : '';
    const formattedDate = deal.lastUpdated ? new Date(deal.lastUpdated).toLocaleDateString() : '';

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

    row.innerHTML = `
      <td class="crm-td-checkbox"><input type="checkbox" /></td>
      <td class="crm-td-name">
        <span class="crm-deal-link" data-deal-id="${deal.id}">${deal.emailSubject || 'Untitled'}</span>
      </td>
      <td class="crm-td-status">${statusDropdown}</td>
      <td class="crm-td-priority">${deal.priority || 'High'}</td>
      <td class="crm-td-value">${formattedValue}</td>
      <td class="crm-td-prob">${deal.probability || '90'}%</td>
      <td class="crm-td-contact">${deal.contactEmail || ''}</td>
      <td class="crm-td-assigned">${deal.assignedTo || ''}</td>
      <td class="crm-td-date">${formattedDate}</td>
      <td class="crm-td-notes">${deal.notes || ''}</td>
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

  moveDealToStage(dealId, newStageId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    deal.stageId = newStageId;
    deal.lastUpdated = new Date().toISOString();

    chrome.storage.local.set({ deals: this.deals }, () => {
      this.renderPipelineBoard();
      this.showNotification('Deal moved successfully!');
    });
  }

  getDealsInPipeline(pipelineId) {
    return Object.entries(this.deals)
      .filter(([_, deal]) => deal.pipelineId === pipelineId)
      .map(([id, deal]) => ({ ...deal, id }))
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  getDealsInStage(pipelineId, stageId) {
    return Object.entries(this.deals)
      .filter(([_, deal]) => deal.pipelineId === pipelineId && deal.stageId === stageId)
      .map(([id, deal]) => ({ ...deal, id }))
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  showAddDealDialog() {
    const modal = document.createElement('div');
    modal.className = 'crm-modal';
    modal.innerHTML = `
      <div class="crm-modal-content">
        <h2>Add Deal</h2>
        <div class="crm-form-group">
          <label>Deal Name</label>
          <input type="text" id="crm-deal-name" class="crm-input" placeholder="Enter deal name" />
        </div>
        <div class="crm-form-group">
          <label>Stage</label>
          <select id="crm-deal-stage" class="crm-input">
            ${this.currentPipeline.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="crm-form-group">
          <label>Deal Value</label>
          <input type="number" id="crm-deal-value-input" class="crm-input" placeholder="$0" />
        </div>
        <div class="crm-form-group">
          <label>Contact Email</label>
          <input type="email" id="crm-deal-email" class="crm-input" placeholder="contact@example.com" />
        </div>
        <div class="crm-modal-actions">
          <button class="crm-btn" id="crm-cancel-deal">Cancel</button>
          <button class="crm-btn-primary" id="crm-save-deal">Save Deal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('crm-cancel-deal')?.addEventListener('click', () => modal.remove());
    document.getElementById('crm-save-deal')?.addEventListener('click', () => {
      const dealId = 'deal_' + Date.now();
      this.deals[dealId] = {
        id: dealId,
        threadId: dealId,
        pipelineId: this.currentPipeline.id,
        stageId: document.getElementById('crm-deal-stage').value,
        emailSubject: document.getElementById('crm-deal-name').value,
        value: document.getElementById('crm-deal-value-input').value,
        contactEmail: document.getElementById('crm-deal-email').value,
        priority: 'High',
        probability: 90,
        lastUpdated: new Date().toISOString()
      };

      chrome.storage.local.set({ deals: this.deals }, () => {
        modal.remove();
        this.renderPipelineBoard();
        this.showNotification('Deal added successfully!');
      });
    });
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
    // Use MutationObserver to detect when emails are opened
    const observer = new MutationObserver(() => {
      this.checkAndInjectEmailLinkUI();
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
    setTimeout(() => this.checkAndInjectEmailLinkUI(), 1000);
  }

  checkAndInjectEmailLinkUI() {
    // Find email view container - Gmail uses various selectors
    const emailView = document.querySelector('.nH.aHU') || document.querySelector('div[role="main"]');
    if (!emailView) return;

    // Check if we're viewing an email (look for email subject)
    const emailSubjectElement = emailView.querySelector('h2.hP') || emailView.querySelector('[data-legacy-message-id]');
    if (!emailSubjectElement) {
      // Not viewing an email, hide sidebar if it exists
      const existingSidebar = document.getElementById('crm-email-deals-sidebar');
      if (existingSidebar) {
        existingSidebar.style.display = 'none';
      }
      return;
    }

    // Get email metadata
    const emailMetadata = this.extractEmailMetadata(emailView);
    if (!emailMetadata) return;

    // Show the right sidebar
    this.showEmailDealsSidebar(emailMetadata);
  }

  extractEmailMetadata(emailView) {
    try {
      // Extract email subject
      const subjectEl = emailView.querySelector('h2.hP') || emailView.querySelector('.hP');
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

  linkEmailToDeal(dealId, emailMetadata) {
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

    chrome.storage.local.set({ deals: this.deals }, () => {
      this.showNotification(`Email linked to "${deal.emailSubject || 'deal'}"`);

      // Refresh the email link bar
      const existingBar = document.getElementById('crm-email-link-bar');
      if (existingBar) {
        existingBar.remove();
      }
      this.checkAndInjectEmailLinkUI();
    });
  }

  unlinkEmailFromDeal(dealId, emailMetadata) {
    const deal = this.deals[dealId];
    if (!deal || !deal.linkedEmails) return;

    deal.linkedEmails = deal.linkedEmails.filter(e => e.threadId !== emailMetadata.threadId);

    chrome.storage.local.set({ deals: this.deals }, () => {
      this.showNotification('Email unlinked from deal');
      // Refresh the sidebar
      this.checkAndInjectEmailLinkUI();
    });
  }

  showEmailDealsSidebar(emailMetadata) {
    // Check if sidebar already exists
    let sidebar = document.getElementById('crm-email-deals-sidebar');

    if (!sidebar) {
      // Create sidebar
      sidebar = document.createElement('div');
      sidebar.id = 'crm-email-deals-sidebar';
      sidebar.className = 'crm-email-deals-sidebar';
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
      dealsByPipeline[pipeline.id] = {
        pipeline,
        deals: Object.values(this.deals).filter(d => d.pipelineId === pipeline.id)
      };
    });

    sidebar.innerHTML = `
      <div class="crm-email-sidebar-header">
        <div class="crm-email-sidebar-title">
          <span class="crm-sidebar-icon">🔗</span>
          <span>Link to Deals</span>
        </div>
        <button class="crm-sidebar-close-btn" id="crm-close-email-sidebar">×</button>
      </div>

      <div class="crm-email-sidebar-content">
        <div class="crm-email-sidebar-info">
          <div class="crm-email-info-subject">${emailMetadata.subject}</div>
          <div class="crm-email-info-from">From: ${emailMetadata.from}</div>
        </div>

        <div class="crm-linked-count">
          ${linkedDealIds.size} ${linkedDealIds.size === 1 ? 'deal' : 'deals'} linked
        </div>

        <div class="crm-email-sidebar-search">
          <input type="text"
                 id="crm-email-sidebar-search"
                 class="crm-sidebar-search-input"
                 placeholder="Search deals..." />
        </div>

        <div class="crm-email-sidebar-deals">
          ${Object.values(dealsByPipeline).map(({ pipeline, deals }) => {
            if (deals.length === 0) return '';
            return `
              <div class="crm-pipeline-group">
                <div class="crm-pipeline-group-header">${pipeline.name} (${deals.length})</div>
                ${deals.map(deal => {
                  const isLinked = linkedDealIds.has(deal.id);
                  return `
                    <label class="crm-deal-checkbox-item ${isLinked ? 'linked' : ''}">
                      <input type="checkbox"
                             class="crm-deal-checkbox"
                             data-deal-id="${deal.id}"
                             ${isLinked ? 'checked' : ''} />
                      <span class="crm-deal-checkbox-label">
                        <span class="crm-deal-checkbox-name">${deal.emailSubject || 'Unnamed Deal'}</span>
                        <span class="crm-deal-checkbox-stage">${pipeline.stages.find(s => s.id === deal.stageId)?.name || ''}</span>
                      </span>
                    </label>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Close button
    document.getElementById('crm-close-email-sidebar')?.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });

    // Search functionality
    const searchInput = document.getElementById('crm-email-sidebar-search');
    searchInput?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const dealItems = sidebar.querySelectorAll('.crm-deal-checkbox-item');

      dealItems.forEach(item => {
        const dealName = item.querySelector('.crm-deal-checkbox-name').textContent.toLowerCase();
        if (dealName.includes(query) || query === '') {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });

      // Hide empty pipeline groups
      const pipelineGroups = sidebar.querySelectorAll('.crm-pipeline-group');
      pipelineGroups.forEach(group => {
        const visibleDeals = group.querySelectorAll('.crm-deal-checkbox-item:not([style*="display: none"])');
        group.style.display = visibleDeals.length > 0 ? '' : 'none';
      });
    });

    // Checkbox change listeners
    const checkboxes = sidebar.querySelectorAll('.crm-deal-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const dealId = checkbox.dataset.dealId;
        if (checkbox.checked) {
          this.linkEmailToDeal(dealId, emailMetadata);
        } else {
          this.unlinkEmailFromDeal(dealId, emailMetadata);
        }
      });
    });
  }

  updateDealStatus(dealId, newStatus) {
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

    chrome.storage.local.set({ deals: this.deals }, () => {
      this.showNotification(`Status updated: ${oldStatus} → ${newStatus}`);

      // Refresh sidebar if it's showing this deal
      const sidebar = document.getElementById('crm-deal-sidebar');
      if (sidebar && sidebar.classList.contains('active') && sidebar.dataset.dealId === dealId) {
        this.showDealSidebar(dealId);
      }
    });
  }

  showDealSidebar(dealId) {
    const deal = this.deals[dealId];
    if (!deal) return;

    const sidebar = document.getElementById('crm-deal-sidebar');
    if (!sidebar) return;

    sidebar.classList.add('active');
    sidebar.dataset.dealId = dealId;

    // Render sidebar content
    this.renderDealSidebarContent(deal);
  }

  closeDealSidebar() {
    const sidebar = document.getElementById('crm-deal-sidebar');
    if (sidebar) {
      sidebar.classList.remove('active');
      sidebar.dataset.dealId = '';
    }
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

          ${callsHTML}

          ${historyHTML}

          ${emailsHTML}

          ${this.currentPipeline?.type === 'customer-tracking' ? this.renderSurgeonsSection(deal) : ''}

          ${this.currentPipeline?.type === 'customer-tracking' ? this.renderCasesSection(deal) : ''}

          <div class="crm-sidebar-section">
            <h4>Notes</h4>
            ${this.renderNotesHistory(deal)}
            <textarea id="crm-sidebar-notes" class="crm-textarea" placeholder="Add a new note..."></textarea>
            <button class="crm-btn-small" id="crm-save-notes-btn">Add Note</button>
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

    document.getElementById('crm-save-notes-btn')?.addEventListener('click', () => {
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

        chrome.storage.local.set({ deals: this.deals }, () => {
          this.showNotification('Note added');
          this.showDealSidebar(deal.id); // Refresh sidebar to show new note
        });
      }
    });

    // Remove call listeners
    sidebar.querySelectorAll('.crm-btn-icon-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.callIdx);
        if (!deal.calls) deal.calls = [];
        deal.calls.splice(idx, 1);
        chrome.storage.local.set({ deals: this.deals }, () => {
          this.showDealSidebar(deal.id);
        });
      });
    });

    // Delete note listeners
    sidebar.querySelectorAll('.crm-btn-icon-tiny').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.noteIdx);
        if (idx !== undefined && confirm('Delete this note?')) {
          if (!deal.notesHistory) deal.notesHistory = [];
          deal.notesHistory.splice(idx, 1);
          chrome.storage.local.set({ deals: this.deals }, () => {
            this.showDealSidebar(deal.id);
            this.showNotification('Note deleted');
          });
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
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.surgeonIdx);
          if (confirm('Remove this surgeon?')) {
            if (!deal.surgeons) deal.surgeons = [];
            deal.surgeons.splice(idx, 1);
            chrome.storage.local.set({ deals: this.deals }, () => {
              this.showDealSidebar(deal.id);
            });
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
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.caseIdx);
          if (idx !== undefined && confirm('Delete this case?')) {
            if (!deal.cases) deal.cases = [];
            deal.cases.splice(idx, 1);
            chrome.storage.local.set({ deals: this.deals }, () => {
              this.showDealSidebar(deal.id);
              this.showNotification('Case deleted');
            });
          }
        });
      }
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
    document.getElementById('crm-save-call')?.addEventListener('click', () => {
      const deal = this.deals[dealId];
      if (!deal) return;

      if (!deal.calls) deal.calls = [];

      deal.calls.push({
        title: document.getElementById('crm-call-title').value,
        url: document.getElementById('crm-call-url').value,
        date: document.getElementById('crm-call-date').value
      });

      chrome.storage.local.set({ deals: this.deals }, () => {
        modal.remove();
        this.showDealSidebar(dealId);
        this.showNotification('Call added successfully!');
      });
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
    document.getElementById('crm-save-surgeon')?.addEventListener('click', () => {
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

      chrome.storage.local.set({ deals: this.deals }, () => {
        modal.remove();
        this.showDealSidebar(dealId);
        this.showNotification(`Surgeon ${name} added successfully!`);
      });
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
    document.getElementById('crm-save-case')?.addEventListener('click', () => {
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

      chrome.storage.local.set({ deals: this.deals }, () => {
        modal.remove();
        this.showDealSidebar(dealId);
        this.showNotification('Case added successfully!');
      });
    });

    // Focus on case name input
    setTimeout(() => document.getElementById('crm-case-name')?.focus(), 100);
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
