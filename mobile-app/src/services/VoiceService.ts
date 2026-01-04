/**
 * Voice Recognition Service
 * Handles voice commands for hands-free CRM management on mobile
 */

import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { Platform } from 'react-native';
import { FirebaseService, Deal } from './FirebaseService';

export interface VoiceCommand {
  action: string;
  params: Record<string, any>;
  originalCommand: string;
}

export class VoiceService {
  private static isListening = false;
  private static listeners: Array<(result: string) => void> = [];
  private static initialized = false;

  /**
   * Initialize voice recognition
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);

      this.initialized = true;
      console.log('✓ Voice recognition initialized');
    } catch (error) {
      console.error('Error initializing voice:', error);
      throw error;
    }
  }

  /**
   * Start listening for voice commands
   */
  static async startListening(callback?: (result: string) => void) {
    try {
      await this.initialize();

      if (callback) {
        this.listeners.push(callback);
      }

      this.isListening = true;
      await Voice.start(Platform.OS === 'ios' ? 'en-US' : 'en_US');

      console.log('🎤 Listening for voice commands...');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Stop listening
   */
  static async stopListening() {
    try {
      this.isListening = false;
      await Voice.stop();
      this.listeners = [];
      console.log('⏹️ Stopped listening');
    } catch (error) {
      console.error('Error stopping voice:', error);
    }
  }

  /**
   * Cancel voice recognition
   */
  static async cancel() {
    try {
      await Voice.cancel();
      this.isListening = false;
      this.listeners = [];
    } catch (error) {
      console.error('Error canceling voice:', error);
    }
  }

  /**
   * Voice started
   */
  private static onSpeechStart() {
    console.log('🎤 Speech started');
  }

  /**
   * Voice ended
   */
  private static onSpeechEnd() {
    console.log('⏹️ Speech ended');
    this.isListening = false;
  }

  /**
   * Voice results received
   */
  private static onSpeechResults(event: SpeechResultsEvent) {
    const results = event.value;
    if (results && results.length > 0) {
      const transcript = results[0];
      console.log('📝 Transcript:', transcript);

      // Notify all listeners
      this.listeners.forEach(listener => listener(transcript));

      // Process the command
      this.processCommand(transcript);
    }
  }

  /**
   * Voice error
   */
  private static onSpeechError(event: SpeechErrorEvent) {
    console.error('Voice error:', event.error);
    this.isListening = false;
  }

  /**
   * Parse natural language command
   */
  static parseCommand(command: string): VoiceCommand | null {
    const commandLower = command.toLowerCase().trim();

    // Command patterns (same as Chrome extension)
    const patterns = [
      // Create new deal
      {
        pattern: /create (?:a )?new deal (?:for |with )?(.+)/i,
        action: 'create_deal',
        extract: (match: RegExpMatchArray) => ({ dealName: match[1] }),
      },
      {
        pattern: /new deal (?:for |with )?(.+)/i,
        action: 'create_deal',
        extract: (match: RegExpMatchArray) => ({ dealName: match[1] }),
      },

      // Open deal
      {
        pattern: /(?:open|show|find) (?:the )?(.+?) deal/i,
        action: 'open_deal',
        extract: (match: RegExpMatchArray) => ({ dealName: match[1] }),
      },

      // Set champion
      {
        pattern: /make (.+?) (?:the )?champion/i,
        action: 'set_champion',
        extract: (match: RegExpMatchArray) => ({ championName: match[1] }),
      },
      {
        pattern: /set champion (?:to )?(.+)/i,
        action: 'set_champion',
        extract: (match: RegExpMatchArray) => ({ championName: match[1] }),
      },

      // Set deal value
      {
        pattern: /(?:set |deal )?value (?:is |to |at )?(?:\$)?([0-9,]+)/i,
        action: 'set_value',
        extract: (match: RegExpMatchArray) => ({ value: match[1].replace(/,/g, '') }),
      },
      {
        pattern: /worth (?:\$)?([0-9,]+)/i,
        action: 'set_value',
        extract: (match: RegExpMatchArray) => ({ value: match[1].replace(/,/g, '') }),
      },

      // Move to stage
      {
        pattern: /move (?:to |to stage )?(.+)/i,
        action: 'move_stage',
        extract: (match: RegExpMatchArray) => ({ stageName: match[1] }),
      },
      {
        pattern: /(?:set stage|change stage) (?:to )?(.+)/i,
        action: 'move_stage',
        extract: (match: RegExpMatchArray) => ({ stageName: match[1] }),
      },

      // Add note
      {
        pattern: /(?:add |take )?(?:a )?note[s]?[:\s]+(.+)/i,
        action: 'add_note',
        extract: (match: RegExpMatchArray) => ({ note: match[1] }),
      },
      {
        pattern: /note that (.+)/i,
        action: 'add_note',
        extract: (match: RegExpMatchArray) => ({ note: match[1] }),
      },

      // Add task
      {
        pattern: /(?:add |create )?(?:a )?task[:\s]+(.+)/i,
        action: 'add_task',
        extract: (match: RegExpMatchArray) => ({ task: match[1] }),
      },
      {
        pattern: /remind me to (.+)/i,
        action: 'add_task',
        extract: (match: RegExpMatchArray) => ({ task: match[1] }),
      },

      // Set priority
      {
        pattern: /(?:set )?priority (?:to )?(high|medium|low)/i,
        action: 'set_priority',
        extract: (match: RegExpMatchArray) => ({ priority: match[1] }),
      },

      // Search
      {
        pattern: /search (?:for )?(.+)/i,
        action: 'search',
        extract: (match: RegExpMatchArray) => ({ query: match[1] }),
      },
      {
        pattern: /find (.+)/i,
        action: 'search',
        extract: (match: RegExpMatchArray) => ({ query: match[1] }),
      },

      // Show all deals
      {
        pattern: /show (?:all )?(?:my )?deals/i,
        action: 'show_deals',
        extract: () => ({}),
      },

      // Show pipeline
      {
        pattern: /show (?:the )?(.+?) pipeline/i,
        action: 'show_pipeline',
        extract: (match: RegExpMatchArray) => ({ pipelineName: match[1] }),
      },
    ];

    // Try to match command against patterns
    for (const { pattern, action, extract } of patterns) {
      const match = commandLower.match(pattern);
      if (match) {
        return {
          action,
          params: extract(match),
          originalCommand: command,
        };
      }
    }

    return null;
  }

  /**
   * Process voice command
   */
  private static async processCommand(transcript: string) {
    const parsed = this.parseCommand(transcript);

    if (!parsed) {
      console.log('❓ Command not recognized');
      return;
    }

    console.log('✓ Command parsed:', parsed.action, parsed.params);

    // Execute command
    try {
      await this.executeCommand(parsed);
    } catch (error) {
      console.error('Error executing command:', error);
    }
  }

  /**
   * Execute parsed command
   */
  static async executeCommand(command: VoiceCommand): Promise<any> {
    switch (command.action) {
      case 'create_deal':
        return this.createDealVoice(command.params);

      case 'open_deal':
        return this.openDealVoice(command.params);

      case 'set_champion':
        return this.setChampionVoice(command.params);

      case 'set_value':
        return this.setValueVoice(command.params);

      case 'move_stage':
        return this.moveStageVoice(command.params);

      case 'add_note':
        return this.addNoteVoice(command.params);

      case 'add_task':
        return this.addTaskVoice(command.params);

      case 'set_priority':
        return this.setPriorityVoice(command.params);

      case 'search':
        return this.searchVoice(command.params);

      case 'show_deals':
        return { action: 'navigate', screen: 'Deals' };

      case 'show_pipeline':
        return this.showPipelineVoice(command.params);

      default:
        console.log('❓ Unknown command action');
        return null;
    }
  }

  // ===== Command Implementations =====

  private static async createDealVoice(params: any) {
    console.log('✓ Creating deal:', params.dealName);
    return {
      action: 'create_deal',
      dealName: params.dealName,
    };
  }

  private static async openDealVoice(params: any) {
    console.log('✓ Opening deal:', params.dealName);

    // Find deal by name
    const deals = await FirebaseService.loadDeals();
    const deal = this.findDealByName(deals, params.dealName);

    if (!deal) {
      console.log('❌ Deal not found:', params.dealName);
      return { action: 'error', message: 'Deal not found' };
    }

    return {
      action: 'navigate',
      screen: 'DealDetail',
      params: { dealId: deal.id },
    };
  }

  private static async setChampionVoice(params: any) {
    console.log('✓ Setting champion:', params.championName);
    return {
      action: 'set_field',
      field: 'champion',
      value: params.championName,
    };
  }

  private static async setValueVoice(params: any) {
    console.log('✓ Setting value:', params.value);
    return {
      action: 'set_field',
      field: 'value',
      value: params.value,
    };
  }

  private static async moveStageVoice(params: any) {
    console.log('✓ Moving to stage:', params.stageName);
    return {
      action: 'move_stage',
      stageName: params.stageName,
    };
  }

  private static async addNoteVoice(params: any) {
    console.log('✓ Adding note:', params.note);
    return {
      action: 'add_note',
      note: params.note,
    };
  }

  private static async addTaskVoice(params: any) {
    console.log('✓ Adding task:', params.task);
    return {
      action: 'add_task',
      task: params.task,
    };
  }

  private static async setPriorityVoice(params: any) {
    console.log('✓ Setting priority:', params.priority);
    return {
      action: 'set_field',
      field: 'priority',
      value: params.priority,
    };
  }

  private static async searchVoice(params: any) {
    console.log('✓ Searching for:', params.query);

    const deals = await FirebaseService.searchDeals(params.query);

    return {
      action: 'search_results',
      query: params.query,
      results: deals,
    };
  }

  private static async showPipelineVoice(params: any) {
    console.log('✓ Showing pipeline:', params.pipelineName);

    const pipelines = await FirebaseService.loadPipelines();
    const pipeline = pipelines.find(p =>
      p.name.toLowerCase().includes(params.pipelineName.toLowerCase())
    );

    if (!pipeline) {
      return { action: 'error', message: 'Pipeline not found' };
    }

    return {
      action: 'navigate',
      screen: 'Pipeline',
      params: { pipelineId: pipeline.id },
    };
  }

  /**
   * Find deal by name (fuzzy match)
   */
  private static findDealByName(deals: Deal[], name: string): Deal | null {
    const nameLower = name.toLowerCase();

    for (const deal of deals) {
      const subject = (deal.emailSubject || '').toLowerCase();
      const company = (deal.company || '').toLowerCase();
      const contact = (deal.contactName || '').toLowerCase();

      if (
        subject.includes(nameLower) ||
        company.includes(nameLower) ||
        contact.includes(nameLower)
      ) {
        return deal;
      }
    }

    return null;
  }

  /**
   * Check if voice is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await Voice.isAvailable();
    } catch (error) {
      return false;
    }
  }

  /**
   * Destroy voice service
   */
  static async destroy() {
    try {
      await Voice.destroy();
      this.initialized = false;
      this.listeners = [];
    } catch (error) {
      console.error('Error destroying voice:', error);
    }
  }
}
