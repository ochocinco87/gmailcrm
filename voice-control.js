// Gmail CRM Voice Control System
// Natural language voice commands for hands-free CRM management

class VoiceControlService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentContext = null; // email, deal, pipeline
    this.listeners = [];
    this.commands = [];
    this.useGemini = false;
    this.geminiApiKey = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.initializeRecognition();
    this.checkGeminiConfig();
  }

  async checkGeminiConfig() {
    // Check if Gemini API key is configured
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['geminiApiKey'], resolve);
    });

    if (result.geminiApiKey) {
      this.geminiApiKey = result.geminiApiKey;
      this.useGemini = true;
      console.log('✓ Gemini Flash enabled for voice recognition');
    } else {
      console.log('Gemini API key not configured, using Web Speech API');
    }
  }

  initializeRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Voice recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');

      const isFinal = event.results[event.results.length - 1].isFinal;

      if (isFinal) {
        console.log('Voice command:', transcript);
        this.processCommand(transcript);
      } else {
        // Show interim results
        this.showInterimTranscript(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      this.stopListening();

      if (event.error === 'no-speech') {
        this.showNotification('⚠️ No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        this.showNotification('⚠️ Microphone access denied. Please enable it in settings.');
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicrophoneUI(false);
    };

    console.log('✓ Voice recognition initialized');
  }

  async startListening(context = null) {
    this.currentContext = context;
    this.isListening = true;
    this.updateMicrophoneUI(true);
    this.showVoiceOverlay('Listening...');

    if (this.useGemini && this.geminiApiKey) {
      // Use Gemini Flash for speech recognition
      await this.startGeminiListening();
    } else if (this.recognition) {
      // Fallback to Web Speech API
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        this.isListening = false;
        this.updateMicrophoneUI(false);
      }
    } else {
      this.showNotification('⚠️ Voice recognition not available');
      this.isListening = false;
      this.updateMicrophoneUI(false);
    }
  }

  async startGeminiListening() {
    try {
      // Show speech bubble
      this.showSpeechBubble();

      // Use Web Speech API for real-time transcription display
      // Then use Gemini for final command processing
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update speech bubble with real-time transcription
        this.updateSpeechBubble(interimTranscript || finalTranscript);

        // If we have a final transcript, process it with Gemini
        if (finalTranscript) {
          this.processWithGemini(finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.updateSpeechBubble('❌ Error: ' + event.error, true);
        setTimeout(() => this.hideSpeechBubble(), 2000);
      };

      recognition.onend = () => {
        if (this.isListening) {
          // Restart if still supposed to be listening
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }
      };

      recognition.start();
      this.activeRecognition = recognition;

    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.showNotification('⚠️ Microphone access denied');
      this.stopListening();
    }
  }

  async processWithGemini(transcript) {
    try {
      if (!this.geminiApiKey) {
        // Fallback to local processing
        await this.processCommand(transcript);
        return;
      }

      // Show that we're analyzing with AI
      this.updateSpeechBubble(`"${transcript}"\n\n🤖 Analyzing command...`);

      // Use Gemini Flash 3.0 to understand the intent and break down the command
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a CRM voice command parser. Analyze this voice command and break it down into actionable steps.

User said: "${transcript}"

Parse this into:
1. The main intent/action
2. Key parameters extracted
3. Step-by-step execution plan

Format your response as:
INTENT: [main action]
PARAMETERS: [extracted data]
STEPS:
1. [first step]
2. [second step]
...

Common CRM actions:
- Create deal
- Update deal (set value, champion, stage)
- Add to existing deal
- Move deal to stage
- Add note/task
- Search/find deals

Be concise and clear.`
            }]
          }]
        })
      });

      const result = await response.json();

      if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        const breakdown = result.candidates[0].content.parts[0].text.trim();
        console.log('Gemini command breakdown:', breakdown);

        // Show the breakdown in the speech bubble
        this.updateSpeechBubble(`"${transcript}"\n\n${breakdown}\n\n✨ Executing...`);

        // Wait a moment so user can see the breakdown
        await this.delay(1500);

        // Now process the original command
        await this.processCommand(transcript);
      } else {
        // Fallback to direct processing
        await this.processCommand(transcript);
      }

    } catch (error) {
      console.error('Gemini processing error:', error);
      // Fallback to direct processing
      await this.processCommand(transcript);
    }
  }

  stopListening() {
    this.isListening = false;

    // Stop active recognition
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
      this.activeRecognition = null;
    }

    // Stop media recorder if active
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // Stop fallback recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.log('Fallback recognition already stopped');
      }
    }

    this.updateMicrophoneUI(false);
    this.hideVoiceOverlay();

    // Hide speech bubble after a delay
    setTimeout(() => {
      if (!this.isListening) {
        this.hideSpeechBubble();
      }
    }, 3000);
  }

  async processCommand(transcript) {
    const command = transcript.toLowerCase().trim();
    console.log('Processing command:', command);

    // Check for compound commands (connected with "and", "then", etc.)
    const compoundSeparators = /\s+and\s+|\s+then\s+|\s*,\s*(?=make|set|add|create|move)/i;
    const parts = command.split(compoundSeparators).filter(p => p.trim());

    if (parts.length > 1) {
      // Handle compound command
      console.log('Compound command detected:', parts);
      this.showVoiceOverlay('Processing multi-step command...');

      for (let i = 0; i < parts.length; i++) {
        const partCommand = parts[i].trim();
        const parsed = this.parseNaturalLanguage(partCommand);

        if (parsed) {
          await this.executeCommand(parsed);
          await this.delay(500); // Brief pause between commands
        }
      }

      // Don't hide overlay immediately - let final command control that
      return;
    }

    // Parse single command
    const parsed = this.parseNaturalLanguage(command);

    if (parsed) {
      await this.executeCommand(parsed);
    } else {
      // If no pattern match, treat as dictation for active field
      if (this.currentContext?.type === 'form') {
        this.fillActiveField(transcript);
      } else {
        this.showNotification('❓ Command not recognized. Try: "Add this to [deal name]" or "Create new deal"');
      }
      this.hideVoiceOverlay();
    }
  }

  parseNaturalLanguage(command) {
    // Command patterns with natural language understanding
    const patterns = [
      // Create new deal
      {
        pattern: /create (?:a )?new deal (?:for |with )?(.+)/i,
        action: 'create_deal',
        extract: (match) => ({ dealName: match[1] })
      },
      {
        pattern: /new deal (?:for |with )?(.+)/i,
        action: 'create_deal',
        extract: (match) => ({ dealName: match[1] })
      },

      // Add to existing deal
      {
        pattern: /add (?:this |these )?(?:to |to the )?(.+?) deal/i,
        action: 'add_to_deal',
        extract: (match) => ({ dealName: match[1] })
      },
      {
        pattern: /update (?:the )?(.+?) deal/i,
        action: 'update_deal',
        extract: (match) => ({ dealName: match[1] })
      },

      // Set champion/contact
      {
        pattern: /make (.+?) (?:the )?champion/i,
        action: 'set_champion',
        extract: (match) => ({ championName: match[1] })
      },
      {
        pattern: /set champion (?:to )?(.+)/i,
        action: 'set_champion',
        extract: (match) => ({ championName: match[1] })
      },
      {
        pattern: /(?:add )?contact (?:is )?(.+)/i,
        action: 'set_contact',
        extract: (match) => ({ contactName: match[1] })
      },

      // Set deal value
      {
        pattern: /(?:set |deal )?value (?:is |to |at )?(?:\$)?([0-9,]+)/i,
        action: 'set_value',
        extract: (match) => ({ value: match[1].replace(/,/g, '') })
      },
      {
        pattern: /worth (?:\$)?([0-9,]+)/i,
        action: 'set_value',
        extract: (match) => ({ value: match[1].replace(/,/g, '') })
      },

      // Move deal to stage
      {
        pattern: /move (?:to |to stage )?(.+)/i,
        action: 'move_stage',
        extract: (match) => ({ stageName: match[1] })
      },
      {
        pattern: /(?:set stage|change stage) (?:to )?(.+)/i,
        action: 'move_stage',
        extract: (match) => ({ stageName: match[1] })
      },

      // Add notes
      {
        pattern: /(?:add |take )?(?:a )?note[s]?[:\s]+(.+)/i,
        action: 'add_note',
        extract: (match) => ({ note: match[1] })
      },
      {
        pattern: /note that (.+)/i,
        action: 'add_note',
        extract: (match) => ({ note: match[1] })
      },

      // Add task
      {
        pattern: /(?:add |create )?(?:a )?task[:\s]+(.+)/i,
        action: 'add_task',
        extract: (match) => ({ task: match[1] })
      },
      {
        pattern: /remind me to (.+)/i,
        action: 'add_task',
        extract: (match) => ({ task: match[1] })
      },

      // Set priority
      {
        pattern: /(?:set )?priority (?:to )?(high|medium|low)/i,
        action: 'set_priority',
        extract: (match) => ({ priority: match[1] })
      },
      {
        pattern: /(high|medium|low) priority/i,
        action: 'set_priority',
        extract: (match) => ({ priority: match[1] })
      },

      // Open/show deal
      {
        pattern: /(?:open|show|find) (?:the )?(.+?) deal/i,
        action: 'open_deal',
        extract: (match) => ({ dealName: match[1] })
      },

      // Search
      {
        pattern: /search (?:for )?(.+)/i,
        action: 'search',
        extract: (match) => ({ query: match[1] })
      },
      {
        pattern: /find (.+)/i,
        action: 'search',
        extract: (match) => ({ query: match[1] })
      }
    ];

    // Try to match command against patterns
    for (const { pattern, action, extract } of patterns) {
      const match = command.match(pattern);
      if (match) {
        return {
          action,
          params: extract(match),
          originalCommand: command
        };
      }
    }

    return null;
  }

  async executeCommand(parsed) {
    console.log('Executing command:', parsed);

    try {
      switch (parsed.action) {
        case 'create_deal':
          await this.createDealVoice(parsed.params);
          break;

        case 'add_to_deal':
        case 'update_deal':
          await this.addToDealVoice(parsed.params);
          break;

        case 'set_champion':
          await this.setChampionVoice(parsed.params);
          break;

        case 'set_contact':
          await this.setContactVoice(parsed.params);
          break;

        case 'set_value':
          await this.setValueVoice(parsed.params);
          break;

        case 'move_stage':
          await this.moveStageVoice(parsed.params);
          break;

        case 'add_note':
          await this.addNoteVoice(parsed.params);
          break;

        case 'add_task':
          await this.addTaskVoice(parsed.params);
          break;

        case 'set_priority':
          await this.setPriorityVoice(parsed.params);
          break;

        case 'open_deal':
          await this.openDealVoice(parsed.params);
          break;

        case 'search':
          await this.searchVoice(parsed.params);
          break;

        default:
          this.showNotification('❓ Unknown command action');
      }
    } catch (error) {
      console.error('Error executing command:', error);
      this.showNotification(`❌ Error: ${error.message}`);
    }
  }

  // Command implementations
  async createDealVoice(params) {
    this.showNotification(`✓ Creating deal: ${params.dealName}`);

    // Trigger deal creation with voice-provided name
    if (window.gmailCRM) {
      window.gmailCRM.showAddDealDialog(null, { dealName: params.dealName });
    }
  }

  async addToDealVoice(params) {
    const dealName = params.dealName;

    // Show execution overlay
    this.showVoiceOverlay('Executing command...');

    // Step 1: Find the deal
    let stepEl = this.showExecutionStep(`Searching for "${dealName}" deal...`, 'progress');
    await this.delay(300);

    const deal = this.findDealByName(dealName);

    if (!deal) {
      stepEl.innerHTML = `<span>❌</span><span>Deal not found: ${dealName}</span>`;
      await this.delay(2000);
      this.hideVoiceOverlay();
      return;
    }

    stepEl.innerHTML = `<span>✅</span><span>Found "${deal.emailSubject || dealName}"</span>`;
    await this.delay(300);

    // Step 2: Navigate to the deal's pipeline
    stepEl = this.showExecutionStep('Opening pipeline...', 'progress');
    await this.delay(300);

    // Open the pipeline view
    const pipeline = window.gmailCRM.pipelines.find(p => p.id === deal.pipelineId);
    if (pipeline) {
      window.gmailCRM.currentPipeline = pipeline;
      window.gmailCRM.showPipelineView();
      stepEl.innerHTML = `<span>✅</span><span>Opened ${pipeline.name}</span>`;
      await this.delay(500);

      // Step 3: Scroll to and highlight the deal
      stepEl = this.showExecutionStep('Locating deal...', 'progress');
      await this.delay(300);

      const dealCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
      if (dealCard) {
        dealCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dealCard.style.animation = 'highlightField 2s ease';
        stepEl.innerHTML = `<span>✅</span><span>Deal located</span>`;
        await this.delay(800);
      }
    }

    // Step 4: Add content to deal
    if (this.currentContext?.type === 'email') {
      stepEl = this.showExecutionStep('Adding email to deal...', 'progress');
      await this.delay(300);

      const emailContent = this.extractEmailContent();
      if (!deal.notes) deal.notes = '';
      deal.notes += `\n\n[Added via voice ${new Date().toLocaleString()}]\n${emailContent}`;

      await window.gmailCRM.saveDeal(deal);
      stepEl.innerHTML = `<span>✅</span><span>Email added to deal</span>`;
      await this.delay(500);
    }

    // Store deal in context for follow-up commands
    this.currentContext = { ...this.currentContext, dealId: deal.id };

    // Keep overlay open for follow-up commands
    setTimeout(() => {
      if (!this.isListening) {
        this.hideVoiceOverlay();
      }
    }, 3000);
  }

  async setChampionVoice(params) {
    const championName = params.championName;

    // Get current deal context
    const deal = this.getCurrentDeal();

    if (!deal) {
      // Try to use voice overlay if it exists
      const overlay = document.getElementById('voice-overlay');
      if (overlay) {
        this.showExecutionStep('No active deal. Please specify deal first', 'error');
        await this.delay(2000);
      } else {
        this.showNotification('❌ No active deal. Say "add to [deal name]" first');
      }
      return;
    }

    // Show execution step
    let stepEl = this.showExecutionStep(`Setting champion to ${championName}...`, 'progress');
    await this.delay(300);

    // Open the deal edit dialog to show the change visually
    const dealCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
    if (dealCard) {
      // Click the deal to open edit dialog
      const editBtn = dealCard.querySelector('.crm-edit-deal');
      if (editBtn) {
        editBtn.click();
        await this.delay(500);

        // Find and update the champion field
        const championField = document.getElementById('crm-deal-champion');
        if (championField) {
          championField.value = championName;
          championField.style.animation = 'highlightField 2s ease';
          championField.dispatchEvent(new Event('input', { bubbles: true }));

          stepEl.innerHTML = `<span>✅</span><span>Champion field updated to "${championName}"</span>`;
          await this.delay(500);

          // Save the deal
          stepEl = this.showExecutionStep('Saving changes...', 'progress');
          await this.delay(300);

          deal.champion = championName;
          await window.gmailCRM.saveDeal(deal);

          stepEl.innerHTML = `<span>✅</span><span>Changes saved</span>`;
          await this.delay(500);

          // Auto-close the dialog
          const saveBtn = document.querySelector('.crm-modal button[style*="background: #1a73e8"]');
          if (saveBtn) {
            saveBtn.click();
          }
        }
      }
    } else {
      // Fallback: just update the data
      deal.champion = championName;
      await window.gmailCRM.saveDeal(deal);
      stepEl.innerHTML = `<span>✅</span><span>Champion set to "${championName}"</span>`;
    }

    await this.delay(500);
  }

  async setContactVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      this.showNotification('❌ No active deal');
      return;
    }

    deal.contactName = params.contactName;
    await window.gmailCRM.saveDeal(deal);
    this.showNotification(`✓ Contact set to ${params.contactName}`);
  }

  async setValueVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      const overlay = document.getElementById('voice-overlay');
      if (overlay) {
        this.showExecutionStep('No active deal. Please specify deal first', 'error');
        await this.delay(2000);
      } else {
        this.showNotification('❌ No active deal');
      }
      return;
    }

    let stepEl = this.showExecutionStep(`Setting value to $${params.value}...`, 'progress');
    await this.delay(300);

    deal.value = params.value;
    await window.gmailCRM.saveDeal(deal);

    stepEl.innerHTML = `<span>✅</span><span>Value updated to $${params.value}</span>`;

    // Update UI if deal card is visible
    const dealCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
    if (dealCard) {
      const valueEl = dealCard.querySelector('.crm-deal-value');
      if (valueEl) {
        valueEl.textContent = `$${params.value}`;
        valueEl.style.animation = 'highlightField 2s ease';
      }
    }

    await this.delay(500);
  }

  async moveStageVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      const overlay = document.getElementById('voice-overlay');
      if (overlay) {
        this.showExecutionStep('No active deal. Please specify deal first', 'error');
        await this.delay(2000);
      } else {
        this.showNotification('❌ No active deal');
      }
      return;
    }

    let stepEl = this.showExecutionStep(`Finding stage "${params.stageName}"...`, 'progress');
    await this.delay(300);

    // Find stage by name
    const stage = this.findStageByName(params.stageName);

    if (!stage) {
      stepEl.innerHTML = `<span>❌</span><span>Stage not found: ${params.stageName}</span>`;
      await this.delay(2000);
      return;
    }

    stepEl.innerHTML = `<span>✅</span><span>Found stage: ${stage.name}</span>`;
    await this.delay(300);

    stepEl = this.showExecutionStep(`Moving deal to ${stage.name}...`, 'progress');
    await this.delay(300);

    // Visually move the deal card
    const dealCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
    if (dealCard) {
      // Animate the card moving
      dealCard.style.transition = 'all 0.5s ease';
      dealCard.style.transform = 'scale(0.95)';
      dealCard.style.opacity = '0.5';

      await this.delay(500);
    }

    // Move the deal
    await window.gmailCRM.moveDealToStage(deal.id, stage.id);

    // Refresh the pipeline view to show the move
    if (window.gmailCRM.currentPipeline) {
      window.gmailCRM.showPipelineView();
      await this.delay(500);

      // Highlight the moved card in new location
      const newDealCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
      if (newDealCard) {
        newDealCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        newDealCard.style.animation = 'highlightField 2s ease';
      }
    }

    stepEl.innerHTML = `<span>✅</span><span>Deal moved to ${stage.name}</span>`;
    await this.delay(500);
  }

  async addNoteVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      this.showNotification('❌ No active deal');
      return;
    }

    if (!deal.notes) deal.notes = '';
    deal.notes += `\n\n[Voice note - ${new Date().toLocaleString()}]\n${params.note}`;

    await window.gmailCRM.saveDeal(deal);
    this.showNotification('✓ Note added');
  }

  async addTaskVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      this.showNotification('❌ No active deal');
      return;
    }

    if (!deal.tasks) deal.tasks = [];
    deal.tasks.push({
      id: 'task_' + Date.now(),
      description: params.task,
      completed: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Voice Command'
    });

    await window.gmailCRM.saveDeal(deal);
    this.showNotification(`✓ Task added: ${params.task}`);
  }

  async setPriorityVoice(params) {
    const deal = this.getCurrentDeal();

    if (!deal) {
      this.showNotification('❌ No active deal');
      return;
    }

    const priority = params.priority.charAt(0).toUpperCase() + params.priority.slice(1);
    deal.priority = priority;

    await window.gmailCRM.saveDeal(deal);
    this.showNotification(`✓ Priority set to ${priority}`);
  }

  async openDealVoice(params) {
    const deal = this.findDealByName(params.dealName);

    if (!deal) {
      this.showNotification(`❌ Deal not found: ${params.dealName}`);
      return;
    }

    // Open deal in CRM
    this.showNotification(`✓ Opening: ${deal.emailSubject || params.dealName}`);
    // TODO: Implement deal detail view
  }

  async searchVoice(params) {
    if (window.gmailCRM && window.gmailCRM.filters) {
      window.gmailCRM.filters.search = params.query;
      window.gmailCRM.applyFilters();
      this.showNotification(`🔍 Searching for: ${params.query}`);
    }
  }

  // Helper methods
  findDealByName(name) {
    if (!window.gmailCRM || !window.gmailCRM.deals) return null;

    const nameLower = name.toLowerCase();

    // Find exact or fuzzy match
    for (const dealId in window.gmailCRM.deals) {
      const deal = window.gmailCRM.deals[dealId];
      const subject = (deal.emailSubject || '').toLowerCase();
      const contactEmail = (deal.contactEmail || '').toLowerCase();

      if (subject.includes(nameLower) || contactEmail.includes(nameLower)) {
        return deal;
      }
    }

    return null;
  }

  findStageByName(name) {
    if (!window.gmailCRM || !window.gmailCRM.currentPipeline) return null;

    const nameLower = name.toLowerCase();

    for (const stage of window.gmailCRM.currentPipeline.stages) {
      if (stage.name.toLowerCase().includes(nameLower)) {
        return stage;
      }
    }

    return null;
  }

  getCurrentDeal() {
    // Get deal from current context
    if (this.currentContext?.dealId) {
      return window.gmailCRM.deals[this.currentContext.dealId];
    }
    return null;
  }

  extractEmailContent() {
    // Extract email body from Gmail
    const emailBody = document.querySelector('.ii.gt')?.innerText || '';
    return emailBody.substring(0, 500); // Limit to 500 chars
  }

  fillActiveField(text) {
    const activeElement = document.activeElement;

    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      activeElement.value = text;
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      this.showNotification('✓ Text entered');
    }
  }

  // UI methods
  showVoiceOverlay(message) {
    let overlay = document.getElementById('voice-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'voice-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 150px;
        left: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 100000;
        font-size: 16px;
        font-weight: 500;
        min-width: 300px;
        max-width: 400px;
        animation: slideInLeft 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="pulse-animation" style="width: 12px; height: 12px; background: #ff4444; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <span>${message}</span>
      </div>
      <div id="voice-execution-steps" style="margin-top: 10px; font-size: 13px; opacity: 0.9;"></div>
    `;

    // Add animation
    if (!document.getElementById('voice-animations')) {
      const style = document.createElement('style');
      style.id = 'voice-animations';
      style.textContent = `
        @keyframes slideInLeft {
          from { transform: translateX(-400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        @keyframes highlightField {
          0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7); }
          50% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
          100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  showExecutionStep(step, status = 'progress') {
    const stepsContainer = document.getElementById('voice-execution-steps');
    if (!stepsContainer) return;

    const statusIcons = {
      progress: '⏳',
      success: '✅',
      error: '❌'
    };

    const stepEl = document.createElement('div');
    stepEl.style.cssText = 'padding: 4px 0; display: flex; align-items: center; gap: 8px;';
    stepEl.innerHTML = `
      <span>${statusIcons[status]}</span>
      <span>${step}</span>
    `;

    stepsContainer.appendChild(stepEl);

    // Auto-scroll to bottom
    stepsContainer.scrollTop = stepsContainer.scrollHeight;

    return stepEl;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  hideVoiceOverlay() {
    const overlay = document.getElementById('voice-overlay');
    if (overlay) {
      overlay.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  showInterimTranscript(transcript) {
    const overlay = document.getElementById('voice-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div class="pulse-animation" style="width: 12px; height: 12px; background: #ff4444; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <div>
          <div style="font-size: 12px; opacity: 0.8;">You said:</div>
          <div style="font-size: 14px; font-style: italic;">"${transcript}"</div>
        </div>
      `;
    }
  }

  updateMicrophoneUI(isActive) {
    const buttons = document.querySelectorAll('.voice-button');
    buttons.forEach(btn => {
      if (isActive) {
        btn.classList.add('listening');
        btn.innerHTML = '⏹️';
        btn.title = 'Stop listening';
      } else {
        btn.classList.remove('listening');
        btn.innerHTML = '🎤';
        btn.title = 'Start voice command';
      }
    });
  }

  // Speech Bubble UI Methods
  showSpeechBubble() {
    // Remove existing bubble if any
    this.hideSpeechBubble();

    // Create speech bubble
    const bubble = document.createElement('div');
    bubble.id = 'voice-speech-bubble';
    bubble.className = 'voice-speech-bubble';
    bubble.innerHTML = `
      <div class="speech-bubble-content">
        <div class="speech-bubble-text">Listening...</div>
      </div>
      <div class="speech-bubble-tail"></div>
    `;

    document.body.appendChild(bubble);

    // Position it near the voice assistant button
    setTimeout(() => {
      bubble.classList.add('visible');
    }, 10);
  }

  updateSpeechBubble(text, isError = false) {
    const bubble = document.getElementById('voice-speech-bubble');
    if (!bubble) return;

    const textEl = bubble.querySelector('.speech-bubble-text');
    if (textEl) {
      textEl.textContent = text;
      if (isError) {
        bubble.classList.add('error');
      } else {
        bubble.classList.remove('error');
      }
    }
  }

  hideSpeechBubble() {
    const bubble = document.getElementById('voice-speech-bubble');
    if (bubble) {
      bubble.classList.remove('visible');
      setTimeout(() => bubble.remove(), 300);
    }
  }

  showNotification(message) {
    if (window.gmailCRM && window.gmailCRM.showNotification) {
      window.gmailCRM.showNotification(message);
    } else {
      console.log('Voice:', message);
    }
  }
}

// Export singleton instance
window.voiceControl = new VoiceControlService();
