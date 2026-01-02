// Gmail CRM Popup - Pipeline Board with Drag & Drop

class PipelineBoard {
  constructor() {
    this.currentPipeline = null;
    this.deals = {};
    this.pipelines = [];
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.renderPipelineSelector();

    // Load first pipeline by default
    if (this.pipelines.length > 0) {
      this.currentPipeline = this.pipelines[0];
      document.getElementById('pipeline-selector').value = this.currentPipeline.id;
      this.renderPipeline();
    } else {
      this.showEmptyState();
    }

    this.updateStats();
  }

  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['deals', 'pipelines'], (result) => {
        this.deals = result.deals || {};
        this.pipelines = result.pipelines || this.getDefaultPipelines();

        // Save default pipelines if none exist
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

  setupEventListeners() {
    // Pipeline selector
    document.getElementById('pipeline-selector').addEventListener('change', (e) => {
      const pipelineId = e.target.value;
      this.currentPipeline = this.pipelines.find(p => p.id === pipelineId);
      this.renderPipeline();
      this.updateStats();
    });

    // Manage pipelines button
    document.getElementById('manage-pipelines-btn').addEventListener('click', () => {
      this.showPipelineManager();
    });
  }

  renderPipelineSelector() {
    const selector = document.getElementById('pipeline-selector');
    selector.innerHTML = '<option value="">Select Pipeline</option>';

    this.pipelines.forEach(pipeline => {
      const option = document.createElement('option');
      option.value = pipeline.id;
      option.textContent = pipeline.name;
      selector.appendChild(option);
    });
  }

  renderPipeline() {
    const board = document.getElementById('pipeline-board');
    board.innerHTML = '';

    if (!this.currentPipeline) {
      this.showEmptyState();
      return;
    }

    this.currentPipeline.stages.forEach(stage => {
      const column = this.createStageColumn(stage);
      board.appendChild(column);
    });
  }

  createStageColumn(stage) {
    const column = document.createElement('div');
    column.className = 'stage-column';
    column.dataset.stageId = stage.id;

    const dealsInStage = this.getDealsInStage(stage.id);

    column.innerHTML = `
      <div class="stage-header">
        <span class="stage-title">${stage.name}</span>
        <span class="stage-count">${dealsInStage.length}</span>
      </div>
      <div class="stage-deals" data-stage-id="${stage.id}">
        ${dealsInStage.length === 0 ? '<p style="text-align: center; color: #5f6368; font-size: 12px; padding: 20px;">No deals</p>' : ''}
      </div>
    `;

    const dealsContainer = column.querySelector('.stage-deals');

    // Add deals to this stage
    dealsInStage.forEach(deal => {
      const dealCard = this.createDealCard(deal);
      dealsContainer.appendChild(dealCard);
    });

    // Make stage droppable
    this.makeStageDroppable(dealsContainer);

    return column;
  }

  getDealsInStage(stageId) {
    return Object.entries(this.deals)
      .filter(([_, deal]) =>
        deal.pipelineId === this.currentPipeline?.id &&
        deal.stageId === stageId
      )
      .map(([threadId, deal]) => ({ ...deal, threadId }))
      .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }

  createDealCard(deal) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.draggable = true;
    card.dataset.threadId = deal.threadId;

    const formattedValue = deal.value ? `$${Number(deal.value).toLocaleString()}` : '$0';
    const formattedDate = deal.lastUpdated ? new Date(deal.lastUpdated).toLocaleDateString() : 'Unknown';

    card.innerHTML = `
      <div class="deal-subject">${deal.emailSubject || 'No Subject'}</div>
      <div class="deal-email">${deal.contactEmail || 'unknown@email.com'}</div>
      ${deal.value ? `<div class="deal-value">${formattedValue}</div>` : ''}
      <div class="deal-footer">
        <span class="deal-date">${formattedDate}</span>
        <div class="deal-actions">
          <button class="deal-action-btn" data-action="view" title="View in Gmail">👁️</button>
          <button class="deal-action-btn" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `;

    // Make card draggable
    this.makeDealDraggable(card);

    // Add action listeners
    card.querySelector('[data-action="view"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openInGmail(deal.threadId);
    });

    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteDeal(deal.threadId);
    });

    return card;
  }

  makeDealDraggable(card) {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.threadId);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  makeStageDroppable(stageElement) {
    stageElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      stageElement.classList.add('drag-over');
    });

    stageElement.addEventListener('dragleave', () => {
      stageElement.classList.remove('drag-over');
    });

    stageElement.addEventListener('drop', (e) => {
      e.preventDefault();
      stageElement.classList.remove('drag-over');

      const threadId = e.dataTransfer.getData('text/plain');
      const newStageId = stageElement.dataset.stageId;

      this.moveDeal(threadId, newStageId);
    });
  }

  moveDeal(threadId, newStageId) {
    const deal = this.deals[threadId];
    if (!deal) return;

    // Update deal stage
    deal.stageId = newStageId;
    deal.lastUpdated = new Date().toISOString();

    // Save to storage
    chrome.storage.local.set({ deals: this.deals }, () => {
      // Re-render the pipeline
      this.renderPipeline();
      this.updateStats();
    });
  }

  deleteDeal(threadId) {
    if (confirm('Are you sure you want to delete this deal?')) {
      delete this.deals[threadId];

      chrome.storage.local.set({ deals: this.deals }, () => {
        this.renderPipeline();
        this.updateStats();
      });
    }
  }

  openInGmail(threadId) {
    // Open Gmail with the specific thread
    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    chrome.tabs.create({ url: gmailUrl });
  }

  updateStats() {
    const totalDeals = Object.values(this.deals).filter(deal =>
      deal.pipelineId === this.currentPipeline?.id
    ).length;

    const totalValue = Object.values(this.deals)
      .filter(deal => deal.pipelineId === this.currentPipeline?.id)
      .reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);

    document.getElementById('total-deals').textContent = totalDeals;
    document.getElementById('total-value').textContent = `$${totalValue.toLocaleString()}`;
  }

  showEmptyState() {
    const board = document.getElementById('pipeline-board');
    board.innerHTML = `
      <div class="empty-pipeline">
        <p>No pipeline selected or no pipelines available.</p>
        <button id="create-first-pipeline" class="btn btn-primary">Create Your First Pipeline</button>
      </div>
    `;

    document.getElementById('create-first-pipeline')?.addEventListener('click', () => {
      this.showPipelineManager();
    });
  }

  showPipelineManager() {
    const manager = document.getElementById('pipeline-manager');
    manager.classList.remove('hidden');

    this.renderPipelinesList();

    // Setup manager event listeners
    document.getElementById('close-manager-btn').addEventListener('click', () => {
      manager.classList.add('hidden');
    });

    document.getElementById('add-pipeline-btn').addEventListener('click', () => {
      this.showPipelineEditor();
    });
  }

  renderPipelinesList() {
    const list = document.getElementById('pipelines-list');
    list.innerHTML = '';

    this.pipelines.forEach(pipeline => {
      const item = document.createElement('div');
      item.className = 'pipeline-item';
      item.innerHTML = `
        <div>
          <div class="pipeline-item-name">${pipeline.name}</div>
          <div class="pipeline-item-stages">${pipeline.stages.length} stages</div>
        </div>
        <button class="icon-btn" style="background: transparent; border: none; color: #1a73e8;">✏️</button>
      `;

      item.querySelector('.icon-btn').addEventListener('click', () => {
        this.showPipelineEditor(pipeline);
      });

      list.appendChild(item);
    });
  }

  showPipelineEditor(pipeline = null) {
    const editor = document.getElementById('pipeline-editor');
    editor.classList.remove('hidden');

    const isNew = !pipeline;
    const editingPipeline = pipeline || {
      id: this.generateId(),
      name: '',
      stages: [
        { id: this.generateId(), name: '' }
      ]
    };

    document.getElementById('pipeline-name').value = editingPipeline.name;

    this.renderStagesList(editingPipeline.stages);

    // Add stage button
    document.getElementById('add-stage-btn').onclick = () => {
      editingPipeline.stages.push({ id: this.generateId(), name: '' });
      this.renderStagesList(editingPipeline.stages);
    };

    // Save button
    document.getElementById('save-pipeline-btn').onclick = () => {
      this.savePipeline(editingPipeline, isNew);
    };

    // Cancel button
    document.getElementById('cancel-pipeline-btn').onclick = () => {
      editor.classList.add('hidden');
    };
  }

  renderStagesList(stages) {
    const list = document.getElementById('stages-list');
    list.innerHTML = '';

    stages.forEach((stage, index) => {
      const item = document.createElement('div');
      item.className = 'stage-item';
      item.innerHTML = `
        <input type="text" value="${stage.name}" placeholder="Stage name" data-stage-index="${index}">
        <button class="remove-stage-btn" data-stage-index="${index}">✕</button>
      `;

      item.querySelector('input').addEventListener('input', (e) => {
        stages[index].name = e.target.value;
      });

      item.querySelector('.remove-stage-btn').addEventListener('click', () => {
        stages.splice(index, 1);
        this.renderStagesList(stages);
      });

      list.appendChild(item);
    });
  }

  savePipeline(pipeline, isNew) {
    pipeline.name = document.getElementById('pipeline-name').value;

    if (!pipeline.name) {
      alert('Please enter a pipeline name');
      return;
    }

    if (pipeline.stages.some(s => !s.name)) {
      alert('Please name all stages');
      return;
    }

    if (isNew) {
      this.pipelines.push(pipeline);
    } else {
      const index = this.pipelines.findIndex(p => p.id === pipeline.id);
      if (index !== -1) {
        this.pipelines[index] = pipeline;
      }
    }

    chrome.storage.local.set({ pipelines: this.pipelines }, () => {
      this.renderPipelineSelector();
      document.getElementById('pipeline-editor').classList.add('hidden');
      document.getElementById('pipeline-manager').classList.add('hidden');

      // Reload current pipeline if it was edited
      if (!isNew && this.currentPipeline?.id === pipeline.id) {
        this.currentPipeline = pipeline;
        this.renderPipeline();
      }
    });
  }

  generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize the pipeline board when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new PipelineBoard();
});
