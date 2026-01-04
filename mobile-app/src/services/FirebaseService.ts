/**
 * Firebase Service
 * Handles Firestore database operations for deals, pipelines, and emails
 */

import firestore from '@react-native-firebase/firestore';
import { AuthService } from './AuthService';

export interface Deal {
  id: string;
  emailSubject: string;
  contactEmail?: string;
  contactName?: string;
  company?: string;
  value?: string;
  champion?: string;
  pipelineId: string;
  stageId: string;
  notes?: string;
  linkedEmails?: LinkedEmail[];
  attachments?: Attachment[];
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
  createdBy?: UserInfo;
  lastModifiedBy?: UserInfo;
}

export interface LinkedEmail {
  subject: string;
  from: string;
  date: string;
  threadId: string;
  url: string;
  linkedAt: string;
}

export interface Attachment {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'document';
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: UserInfo;
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
  createdAt: string;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface UserInfo {
  uid: string;
  email: string;
  displayName?: string;
}

export class FirebaseService {
  private static db: FirebaseFirestoreTypes.Module;

  /**
   * Initialize Firebase
   */
  static async initialize() {
    try {
      this.db = firestore();
      console.log('✓ Firebase initialized');
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  /**
   * Get user info for tracking
   */
  private static async getUserInfo(): Promise<UserInfo> {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error('No user signed in');

    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName,
    };
  }

  // ===== PIPELINES =====

  /**
   * Load all pipelines
   */
  static async loadPipelines(): Promise<Pipeline[]> {
    try {
      const snapshot = await this.db.collection('pipelines').orderBy('createdAt', 'desc').get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Pipeline[];
    } catch (error) {
      console.error('Error loading pipelines:', error);
      return [];
    }
  }

  /**
   * Get a single pipeline
   */
  static async getPipeline(pipelineId: string): Promise<Pipeline | null> {
    try {
      const doc = await this.db.collection('pipelines').doc(pipelineId).get();

      if (!doc.exists) return null;

      return {
        id: doc.id,
        ...doc.data(),
      } as Pipeline;
    } catch (error) {
      console.error('Error getting pipeline:', error);
      return null;
    }
  }

  /**
   * Create a new pipeline
   */
  static async createPipeline(pipeline: Omit<Pipeline, 'id' | 'createdAt'>): Promise<Pipeline> {
    try {
      const userInfo = await this.getUserInfo();

      const docRef = await this.db.collection('pipelines').add({
        ...pipeline,
        createdAt: new Date().toISOString(),
        createdBy: userInfo,
      });

      return {
        id: docRef.id,
        ...pipeline,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating pipeline:', error);
      throw error;
    }
  }

  // ===== DEALS =====

  /**
   * Load all deals
   */
  static async loadDeals(): Promise<Deal[]> {
    try {
      const snapshot = await this.db.collection('deals').orderBy('updatedAt', 'desc').get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Deal[];
    } catch (error) {
      console.error('Error loading deals:', error);
      return [];
    }
  }

  /**
   * Load deals for a specific pipeline
   */
  static async loadDealsByPipeline(pipelineId: string): Promise<Deal[]> {
    try {
      const snapshot = await this.db
        .collection('deals')
        .where('pipelineId', '==', pipelineId)
        .orderBy('updatedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Deal[];
    } catch (error) {
      console.error('Error loading deals by pipeline:', error);
      return [];
    }
  }

  /**
   * Get a single deal
   */
  static async getDeal(dealId: string): Promise<Deal | null> {
    try {
      const doc = await this.db.collection('deals').doc(dealId).get();

      if (!doc.exists) return null;

      return {
        id: doc.id,
        ...doc.data(),
      } as Deal;
    } catch (error) {
      console.error('Error getting deal:', error);
      return null;
    }
  }

  /**
   * Save a deal (create or update)
   */
  static async saveDeal(deal: Partial<Deal>): Promise<Deal> {
    try {
      const userInfo = await this.getUserInfo();
      const now = new Date().toISOString();

      const dealData = {
        ...deal,
        updatedAt: now,
        lastModifiedBy: userInfo,
      };

      if (deal.id) {
        // Update existing deal
        await this.db.collection('deals').doc(deal.id).update(dealData);

        return {
          ...dealData,
          id: deal.id,
        } as Deal;
      } else {
        // Create new deal
        const docRef = await this.db.collection('deals').add({
          ...dealData,
          createdAt: now,
          createdBy: userInfo,
        });

        return {
          ...dealData,
          id: docRef.id,
          createdAt: now,
        } as Deal;
      }
    } catch (error) {
      console.error('Error saving deal:', error);
      throw error;
    }
  }

  /**
   * Delete a deal
   */
  static async deleteDeal(dealId: string): Promise<void> {
    try {
      await this.db.collection('deals').doc(dealId).delete();
      console.log('✓ Deal deleted:', dealId);
    } catch (error) {
      console.error('Error deleting deal:', error);
      throw error;
    }
  }

  /**
   * Move deal to different stage
   */
  static async moveDealToStage(dealId: string, stageId: string): Promise<void> {
    try {
      const userInfo = await this.getUserInfo();

      await this.db.collection('deals').doc(dealId).update({
        stageId,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: userInfo,
      });

      console.log('✓ Deal moved to stage:', stageId);
    } catch (error) {
      console.error('Error moving deal:', error);
      throw error;
    }
  }

  /**
   * Add attachment to deal
   */
  static async addAttachment(dealId: string, attachment: Attachment): Promise<void> {
    try {
      const deal = await this.getDeal(dealId);
      if (!deal) throw new Error('Deal not found');

      const attachments = deal.attachments || [];
      attachments.push(attachment);

      await this.db.collection('deals').doc(dealId).update({
        attachments,
        updatedAt: new Date().toISOString(),
      });

      console.log('✓ Attachment added to deal');
    } catch (error) {
      console.error('Error adding attachment:', error);
      throw error;
    }
  }

  /**
   * Listen for real-time updates to deals
   */
  static subscribeToDealUpdates(
    pipelineId: string,
    callback: (deals: Deal[]) => void
  ): () => void {
    const unsubscribe = this.db
      .collection('deals')
      .where('pipelineId', '==', pipelineId)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        snapshot => {
          const deals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Deal[];

          callback(deals);
        },
        error => {
          console.error('Error in deal subscription:', error);
        }
      );

    return unsubscribe;
  }

  /**
   * Search deals by query
   */
  static async searchDeals(query: string): Promise<Deal[]> {
    try {
      const snapshot = await this.db.collection('deals').get();

      const queryLower = query.toLowerCase();

      const deals = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Deal[];

      return deals.filter(deal => {
        const subject = (deal.emailSubject || '').toLowerCase();
        const company = (deal.company || '').toLowerCase();
        const contact = (deal.contactName || '').toLowerCase();

        return (
          subject.includes(queryLower) ||
          company.includes(queryLower) ||
          contact.includes(queryLower)
        );
      });
    } catch (error) {
      console.error('Error searching deals:', error);
      return [];
    }
  }
}
