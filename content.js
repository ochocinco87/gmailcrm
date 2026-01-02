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
          <span class="crm-deal-count">${dealsInPipeline.length} Count</span>
        </div>
        <div class="crm-pipeline-actions">
          <button class="crm-btn" id="crm-refresh-btn">🔄 Refresh</button>
          <button class="crm-btn" id="crm-settings-btn">⚙️ Settings</button>
          <button class="crm-btn" id="crm-share-btn">🔗 Share</button>
          <button class="crm-btn-primary" id="crm-add-deal-btn">+ Add Deal</button>
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

    // Emails section (grouped)
    const emails = deal.emails || [];
    const emailsHTML = `
      <div class="crm-sidebar-section">
        <h4>Related Emails (${emails.length})</h4>
        <div class="crm-emails-list">
          ${emails.map(email => `
            <div class="crm-email-item">
              <div class="crm-email-subject">${email.subject}</div>
              <div class="crm-email-meta">
                <span>${email.from}</span> • <span>${new Date(email.date).toLocaleDateString()}</span>
              </div>
            </div>
          `).join('')}
          ${emails.length === 0 ? '<p class="crm-empty-state">No emails linked yet</p>' : ''}
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
        if (confirm('Delete this note?')) {
          if (!deal.notesHistory) deal.notesHistory = [];
          deal.notesHistory.splice(idx, 1);
          chrome.storage.local.set({ deals: this.deals }, () => {
            this.showDealSidebar(deal.id);
            this.showNotification('Note deleted');
          });
        }
      });
    });
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
