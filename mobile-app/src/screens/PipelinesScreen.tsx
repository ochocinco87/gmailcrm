/**
 * Pipelines Screen
 * Shows all pipelines with deals in kanban view
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FirebaseService, Pipeline, Deal } from '../services/FirebaseService';

const PipelinesScreen = ({ navigation }: any) => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPipelines();
  }, []);

  useEffect(() => {
    if (selectedPipeline) {
      loadDeals(selectedPipeline.id);
    }
  }, [selectedPipeline]);

  const loadPipelines = async () => {
    try {
      const data = await FirebaseService.loadPipelines();
      setPipelines(data);

      if (data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
    } catch (error) {
      console.error('Error loading pipelines:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeals = async (pipelineId: string) => {
    try {
      const data = await FirebaseService.loadDealsByPipeline(pipelineId);
      setDeals(data);
    } catch (error) {
      console.error('Error loading deals:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPipelines();
    if (selectedPipeline) {
      await loadDeals(selectedPipeline.id);
    }
    setRefreshing(false);
  };

  const getDealsByStage = (stageId: string) => {
    return deals.filter(deal => deal.stageId === stageId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (pipelines.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>No pipelines yet</Text>
        <Text style={styles.emptySubtext}>Create a pipeline in the web app to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Pipeline Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pipelineSelector}
      >
        {pipelines.map(pipeline => (
          <TouchableOpacity
            key={pipeline.id}
            style={[
              styles.pipelineTab,
              selectedPipeline?.id === pipeline.id && styles.pipelineTabActive,
            ]}
            onPress={() => setSelectedPipeline(pipeline)}
          >
            <Text
              style={[
                styles.pipelineTabText,
                selectedPipeline?.id === pipeline.id && styles.pipelineTabTextActive,
              ]}
            >
              {pipeline.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Kanban Board */}
      {selectedPipeline && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kanbanContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {selectedPipeline.stages.map(stage => (
            <View key={stage.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{stage.name}</Text>
                <Text style={styles.columnCount}>{getDealsByStage(stage.id).length}</Text>
              </View>

              <ScrollView style={styles.columnContent}>
                {getDealsByStage(stage.id).map(deal => (
                  <TouchableOpacity
                    key={deal.id}
                    style={styles.dealCard}
                    onPress={() => navigation.navigate('DealDetail', { dealId: deal.id })}
                  >
                    <Text style={styles.dealTitle} numberOfLines={2}>
                      {deal.emailSubject || 'Unnamed Deal'}
                    </Text>
                    {deal.company && (
                      <Text style={styles.dealCompany}>{deal.company}</Text>
                    )}
                    {deal.value && (
                      <Text style={styles.dealValue}>${deal.value}</Text>
                    )}
                    {deal.linkedEmails && deal.linkedEmails.length > 0 && (
                      <View style={styles.dealMeta}>
                        <Icon name="email" size={14} color="#5f6368" />
                        <Text style={styles.dealMetaText}>
                          {deal.linkedEmails.length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#5f6368',
    textAlign: 'center',
  },
  pipelineSelector: {
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
    backgroundColor: '#ffffff',
  },
  pipelineTab: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pipelineTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#667eea',
  },
  pipelineTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5f6368',
  },
  pipelineTabTextActive: {
    color: '#667eea',
  },
  kanbanContainer: {
    flex: 1,
  },
  column: {
    width: 280,
    marginRight: 16,
    marginTop: 16,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202124',
  },
  columnCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5f6368',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  columnContent: {
    flex: 1,
  },
  dealCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  dealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  dealCompany: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 4,
  },
  dealValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 8,
  },
  dealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  dealMetaText: {
    fontSize: 12,
    color: '#5f6368',
    marginLeft: 4,
  },
});

export default PipelinesScreen;
