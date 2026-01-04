/**
 * Deal Detail Screen - Full deal information with attachments and voice commands
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FirebaseService, Deal } from '../services/FirebaseService';
import { CameraService } from '../services/CameraService';

const DealDetailScreen = ({ route, navigation }: any) => {
  const { dealId } = route.params;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeal();
  }, []);

  const loadDeal = async () => {
    try {
      const data = await FirebaseService.getDeal(dealId);
      setDeal(data);
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      await CameraService.captureAndAttach(dealId, 'camera');
      await loadDeal();
      Alert.alert('Success', 'Photo attached to deal');
    } catch (error) {
      Alert.alert('Error', 'Failed to attach photo');
    }
  };

  const handlePickImage = async () => {
    try {
      await CameraService.captureAndAttach(dealId, 'gallery');
      await loadDeal();
      Alert.alert('Success', 'Image attached to deal');
    } catch (error) {
      Alert.alert('Error', 'Failed to attach image');
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#667eea" /></View>;
  }

  if (!deal) {
    return <View style={styles.loading}><Text>Deal not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{deal.emailSubject}</Text>
        {deal.company && <Text style={styles.company}>{deal.company}</Text>}
        {deal.value && <Text style={styles.value}>${deal.value}</Text>}
      </View>

      {deal.champion && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Champion</Text>
          <Text style={styles.sectionValue}>{deal.champion}</Text>
        </View>
      )}

      {deal.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.sectionValue}>{deal.notes}</Text>
        </View>
      )}

      {deal.linkedEmails && deal.linkedEmails.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked Emails ({deal.linkedEmails.length})</Text>
          {deal.linkedEmails.map((email, index) => (
            <View key={index} style={styles.emailCard}>
              <Text style={styles.emailSubject}>{email.subject}</Text>
              <Text style={styles.emailFrom}>{email.from}</Text>
              <Text style={styles.emailDate}>{new Date(email.date).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      )}

      {deal.attachments && deal.attachments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attachments ({deal.attachments.length})</Text>
          <View style={styles.attachmentsGrid}>
            {deal.attachments.map((att) => (
              <Image key={att.id} source={{ uri: att.thumbnailUrl || att.url }} style={styles.thumbnail} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
          <Icon name="camera-alt" size={24} color="#667eea" />
          <Text style={styles.actionText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handlePickImage}>
          <Icon name="photo-library" size={24} color="#667eea" />
          <Text style={styles.actionText}>Choose Photo</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e8eaed' },
  title: { fontSize: 24, fontWeight: '700', color: '#202124' },
  company: { fontSize: 16, color: '#5f6368', marginTop: 4 },
  value: { fontSize: 28, fontWeight: '800', color: '#667eea', marginTop: 12 },
  section: { backgroundColor: '#fff', padding: 20, marginTop: 12, borderTopWidth: 1, borderTopColor: '#e8eaed' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#5f6368', textTransform: 'uppercase', marginBottom: 12 },
  sectionValue: { fontSize: 16, color: '#202124', lineHeight: 24 },
  emailCard: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 8 },
  emailSubject: { fontSize: 14, fontWeight: '600', color: '#202124' },
  emailFrom: { fontSize: 12, color: '#5f6368', marginTop: 4 },
  emailDate: { fontSize: 11, color: '#80868b', marginTop: 2 },
  attachmentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail: { width: 100, height: 100, borderRadius: 8 },
  actions: { flexDirection: 'row', padding: 20, gap: 12 },
  actionButton: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#667eea' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#667eea', marginTop: 8 },
});

export default DealDetailScreen;
