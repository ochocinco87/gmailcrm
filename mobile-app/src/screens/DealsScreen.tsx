/**
 * Deals Screen - List of all deals across pipelines
 */
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FirebaseService, Deal } from '../services/FirebaseService';

const DealsScreen = ({ navigation }: any) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      const data = await FirebaseService.loadDeals();
      setDeals(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#667eea" /></View>;
  }

  return (
    <FlatList
      data={deals}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.dealCard}
          onPress={() => navigation.navigate('DealDetail', { dealId: item.id })}
        >
          <Text style={styles.dealTitle}>{item.emailSubject || 'Unnamed Deal'}</Text>
          {item.company && <Text style={styles.dealCompany}>{item.company}</Text>}
          {item.value && <Text style={styles.dealValue}>${item.value}</Text>}
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dealCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e8eaed' },
  dealTitle: { fontSize: 16, fontWeight: '600', color: '#202124' },
  dealCompany: { fontSize: 14, color: '#5f6368', marginTop: 4 },
  dealValue: { fontSize: 18, fontWeight: '700', color: '#667eea', marginTop: 8 },
});

export default DealsScreen;
