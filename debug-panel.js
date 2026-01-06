// Debug Panel for Gmail CRM - Voice Feedback + Screenshots
// Allows rapid iteration by capturing voice feedback and screenshots

class DebugPanel {
  constructor() {
    this.feedbackItems = [];
    this.isRecording = false;
    this.recognition = null;
    this.currentTranscript = '';
    this.geminiApiKey = null;
    this.init();
  }

  async init() {
    // Get Gemini API key from storage
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['geminiApiKey'], resolve);
    });

    this.geminiApiKey = result.geminiApiKey || 'AIzaSyBjxGVLxVh5gKZQ8N9kH0PmW3fZ7RKnXyI';

    // Add keyboard shortcut: Ctrl+Shift+D
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });

    console.log('🐛 Debug Panel initialized. Press Ctrl+Shift+D to open');
  }

  toggle() {
    const panel = document.getElementById('crm-debug-panel');
    if (panel) {
      panel.remove();
    } else {
      this.show();
    }
  }

  show() {
    const panel = document.createElement('div');
    panel.id = 'crm-debug-panel';
    panel.className = 'crm-debug-panel';

    panel.innerHTML = `
      <div class="debug-panel-header">
        <div class="debug-panel-title">
          🐛 Debug & Feedback
          <span class="debug-panel-subtitle">Ctrl+Shift+D</span>
        </div>
        <button class="debug-close-btn" id="debug-close">×</button>
      </div>

      <div class="debug-panel-content">
        <div class="debug-controls">
          <button class="debug-btn debug-btn-primary" id="debug-voice-btn">
            🎤 <span>Record Feedback</span>
          </button>
          <button class="debug-btn debug-btn-secondary" id="debug-screenshot-btn">
            📸 <span>Screenshot</span>
          </button>
        </div>

        <div class="debug-recording-status" id="debug-recording-status" style="display: none;">
          <div class="debug-recording-pulse"></div>
          <span>Listening... (speak your feedback)</span>
        </div>

        <div class="debug-feedback-list" id="debug-feedback-list">
          <div class="debug-empty-state">
            <div class="debug-empty-icon">🎯</div>
            <div class="debug-empty-text">No feedback captured yet</div>
            <div class="debug-empty-hint">Click "Record Feedback" to start</div>
          </div>
        </div>

        <div class="debug-actions">
          <button class="debug-btn debug-btn-success" id="debug-generate-report">
            📋 Generate Report
          </button>
          <button class="debug-btn debug-btn-danger" id="debug-clear">
            🗑️ Clear All
          </button>
        </div>
      </div>

      <div class="debug-report-modal" id="debug-report-modal" style="display: none;">
        <div class="debug-report-content">
          <div class="debug-report-header">
            <h3>📋 Feedback Report</h3>
            <button class="debug-close-btn" id="debug-modal-close">×</button>
          </div>
          <div class="debug-report-body">
            <textarea id="debug-report-text" readonly></textarea>
          </div>
          <div class="debug-report-footer">
            <button class="debug-btn debug-btn-primary" id="debug-copy-report">
              📋 Copy to Clipboard
            </button>
            <button class="debug-btn debug-btn-secondary" id="debug-download-report">
              💾 Download
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Event listeners
    document.getElementById('debug-close').addEventListener('click', () => this.toggle());
    document.getElementById('debug-voice-btn').addEventListener('click', () => this.startVoiceFeedback());
    document.getElementById('debug-screenshot-btn').addEventListener('click', () => this.captureScreenshot());
    document.getElementById('debug-generate-report').addEventListener('click', () => this.generateReport());
    document.getElementById('debug-clear').addEventListener('click', () => this.clearAll());
    document.getElementById('debug-modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('debug-copy-report').addEventListener('click', () => this.copyReport());
    document.getElementById('debug-download-report').addEventListener('click', () => this.downloadReport());

    this.renderFeedbackList();
  }

  async startVoiceFeedback() {
    if (this.isRecording) {
      this.stopVoiceFeedback();
      return;
    }

    const btn = document.getElementById('debug-voice-btn');
    const status = document.getElementById('debug-recording-status');

    btn.classList.add('recording');
    btn.innerHTML = '🔴 <span>Stop Recording</span>';
    status.style.display = 'flex';
    this.isRecording = true;
    this.currentTranscript = '';

    // Use Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported');
      this.stopVoiceFeedback();
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this.currentTranscript = transcript;
      status.innerHTML = `
        <div class="debug-recording-pulse"></div>
        <span>${transcript || 'Listening...'}</span>
      `;
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.stopVoiceFeedback();
    };

    this.recognition.start();
  }

  async stopVoiceFeedback() {
    if (!this.isRecording) return;

    const btn = document.getElementById('debug-voice-btn');
    const status = document.getElementById('debug-recording-status');

    this.isRecording = false;
    if (this.recognition) {
      this.recognition.stop();
    }

    btn.classList.remove('recording');
    btn.innerHTML = '🎤 <span>Record Feedback</span>';
    status.style.display = 'none';

    if (this.currentTranscript.trim()) {
      // Process with Gemini to clean up transcript
      const processedFeedback = await this.processWithGemini(this.currentTranscript);

      // Capture screenshot automatically
      const screenshot = await this.captureScreenshotData();

      // Add feedback item
      this.addFeedbackItem({
        type: 'voice',
        timestamp: new Date().toISOString(),
        transcript: this.currentTranscript,
        processedFeedback: processedFeedback,
        screenshot: screenshot,
        context: this.getContext()
      });

      this.currentTranscript = '';
    }
  }

  async processWithGemini(transcript) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are helping process voice feedback for a Gmail CRM extension.

The user said: "${transcript}"

Clean up this feedback and format it as clear, actionable improvement requests.
Be concise and specific. If it's about a bug, describe the issue. If it's a feature request, describe what they want.

Return ONLY the cleaned up feedback, no preamble.`
            }]
          }]
        })
      });

      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text.trim();
      }
      return transcript;
    } catch (error) {
      console.error('Gemini processing error:', error);
      return transcript;
    }
  }

  async captureScreenshot() {
    const screenshot = await this.captureScreenshotData();

    this.addFeedbackItem({
      type: 'screenshot',
      timestamp: new Date().toISOString(),
      screenshot: screenshot,
      context: this.getContext()
    });
  }

  async captureScreenshotData() {
    return new Promise((resolve) => {
      // Use html2canvas if available, otherwise use a placeholder
      if (typeof html2canvas !== 'undefined') {
        html2canvas(document.body, {
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY
        }).then(canvas => {
          resolve(canvas.toDataURL('image/png'));
        });
      } else {
        // Fallback: Use Chrome's built-in screenshot API
        chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
          resolve(dataUrl || 'Screenshot capture failed');
        });
      }
    });
  }

  getContext() {
    // Capture current state
    const context = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version
    };

    // Check if we're in a specific view
    if (window.gmailCRM) {
      context.currentPipeline = window.gmailCRM.currentPipeline?.name || 'None';
      context.totalDeals = Object.keys(window.gmailCRM.deals || {}).length;
      context.totalPipelines = (window.gmailCRM.pipelines || []).length;
    }

    // Check which panels are open
    const panels = {
      voiceSidebar: !!document.getElementById('voice-execution-sidebar'),
      emailSidebar: !!document.getElementById('crm-email-deals-sidebar'),
      devBadge: !!document.getElementById('crm-dev-badge')
    };
    context.openPanels = Object.entries(panels).filter(([k, v]) => v).map(([k]) => k);

    return context;
  }

  addFeedbackItem(item) {
    this.feedbackItems.push(item);
    this.renderFeedbackList();
  }

  renderFeedbackList() {
    const list = document.getElementById('debug-feedback-list');
    if (!list) return;

    if (this.feedbackItems.length === 0) {
      list.innerHTML = `
        <div class="debug-empty-state">
          <div class="debug-empty-icon">🎯</div>
          <div class="debug-empty-text">No feedback captured yet</div>
          <div class="debug-empty-hint">Click "Record Feedback" to start</div>
        </div>
      `;
      return;
    }

    list.innerHTML = this.feedbackItems.map((item, index) => {
      const time = new Date(item.timestamp).toLocaleTimeString();
      return `
        <div class="debug-feedback-item">
          <div class="debug-feedback-header">
            <span class="debug-feedback-type">${item.type === 'voice' ? '🎤 Voice' : '📸 Screenshot'}</span>
            <span class="debug-feedback-time">${time}</span>
            <button class="debug-remove-item" data-index="${index}">×</button>
          </div>
          ${item.processedFeedback ? `
            <div class="debug-feedback-text">${item.processedFeedback}</div>
          ` : ''}
          ${item.screenshot ? `
            <div class="debug-feedback-screenshot">
              <img src="${item.screenshot}" alt="Screenshot" />
            </div>
          ` : ''}
          <div class="debug-feedback-context">
            ${item.context.currentPipeline ? `Pipeline: ${item.context.currentPipeline}` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add remove listeners
    list.querySelectorAll('.debug-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.feedbackItems.splice(index, 1);
        this.renderFeedbackList();
      });
    });
  }

  generateReport() {
    const modal = document.getElementById('debug-report-modal');
    const textarea = document.getElementById('debug-report-text');

    const report = this.buildMarkdownReport();
    textarea.value = report;
    modal.style.display = 'flex';
  }

  buildMarkdownReport() {
    const now = new Date();
    let markdown = `# Gmail CRM Feedback Report\n\n`;
    markdown += `**Date:** ${now.toLocaleString()}\n`;
    markdown += `**Extension Version:** ${chrome.runtime.getManifest().version}\n`;
    markdown += `**Total Items:** ${this.feedbackItems.length}\n\n`;
    markdown += `---\n\n`;

    this.feedbackItems.forEach((item, index) => {
      markdown += `## Feedback ${index + 1} - ${item.type === 'voice' ? 'Voice' : 'Screenshot'}\n\n`;
      markdown += `**Time:** ${new Date(item.timestamp).toLocaleString()}\n\n`;

      if (item.processedFeedback) {
        markdown += `### User Feedback:\n${item.processedFeedback}\n\n`;
      }

      if (item.transcript && item.transcript !== item.processedFeedback) {
        markdown += `### Raw Transcript:\n> ${item.transcript}\n\n`;
      }

      markdown += `### Context:\n`;
      markdown += `- URL: ${item.context.url}\n`;
      if (item.context.currentPipeline) {
        markdown += `- Current Pipeline: ${item.context.currentPipeline}\n`;
      }
      if (item.context.openPanels?.length) {
        markdown += `- Open Panels: ${item.context.openPanels.join(', ')}\n`;
      }
      markdown += `\n`;

      if (item.screenshot) {
        markdown += `### Screenshot:\n`;
        markdown += `![Screenshot ${index + 1}](${item.screenshot})\n\n`;
      }

      markdown += `---\n\n`;
    });

    return markdown;
  }

  copyReport() {
    const textarea = document.getElementById('debug-report-text');
    textarea.select();
    document.execCommand('copy');

    const btn = document.getElementById('debug-copy-report');
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  }

  downloadReport() {
    const report = document.getElementById('debug-report-text').value;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gmail-crm-feedback-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeModal() {
    document.getElementById('debug-report-modal').style.display = 'none';
  }

  clearAll() {
    if (confirm('Clear all feedback items?')) {
      this.feedbackItems = [];
      this.renderFeedbackList();
    }
  }
}

// Initialize debug panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.debugPanel = new DebugPanel();
  });
} else {
  window.debugPanel = new DebugPanel();
}
