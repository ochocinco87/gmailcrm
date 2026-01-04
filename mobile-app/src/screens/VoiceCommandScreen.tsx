/**
 * Voice Command Screen - Voice control interface
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { VoiceService } from '../services/VoiceService';

const VoiceCommandScreen = ({ navigation }: any) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');

  useEffect(() => {
    VoiceService.initialize();
    return () => { VoiceService.destroy(); };
  }, []);

  const handleVoicePress = async () => {
    if (isListening) {
      await VoiceService.stopListening();
      setIsListening(false);
    } else {
      try {
        await VoiceService.startListening((result: string) => {
          setTranscript(result);
          setLastCommand(result);
          setIsListening(false);
        });
        setIsListening(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to start voice recognition');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Commands</Text>
        <Text style={styles.subtitle}>Tap the microphone and speak</Text>
      </View>

      <TouchableOpacity style={styles.micContainer} onPress={handleVoicePress}>
        <LinearGradient
          colors={isListening ? ['#ff4444', '#cc0000'] : ['#667eea', '#764ba2']}
          style={[styles.micButton, isListening && styles.micButtonActive]}
        >
          <Text style={styles.micIcon}>{isListening ? '🔴' : '🎤'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {transcript && (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcriptText}>"{transcript}"</Text>
        </View>
      )}

      <View style={styles.examplesBox}>
        <Text style={styles.examplesTitle}>Try saying:</Text>
        <Text style={styles.exampleText}>• "Show all deals"</Text>
        <Text style={styles.exampleText}>• "Open [deal name] deal"</Text>
        <Text style={styles.exampleText}>• "Create new deal for [company]"</Text>
        <Text style={styles.exampleText}>• "Set value to $50,000"</Text>
        <Text style={styles.exampleText}>• "Move to proposal stage"</Text>
        <Text style={styles.exampleText}>• "Add note [your note]"</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 60 },
  title: { fontSize: 32, fontWeight: '800', color: '#202124' },
  subtitle: { fontSize: 16, color: '#5f6368', marginTop: 8 },
  micContainer: { alignItems: 'center', marginBottom: 40 },
  micButton: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  micButtonActive: { transform: [{ scale: 1.1 }] },
  micIcon: { fontSize: 48 },
  transcriptBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20 },
  transcriptLabel: { fontSize: 12, fontWeight: '700', color: '#5f6368', textTransform: 'uppercase', marginBottom: 8 },
  transcriptText: { fontSize: 16, color: '#202124', fontStyle: 'italic' },
  examplesBox: { backgroundColor: '#fff', padding: 20, borderRadius: 12 },
  examplesTitle: { fontSize: 14, fontWeight: '700', color: '#667eea', marginBottom: 16 },
  exampleText: { fontSize: 14, color: '#5f6368', lineHeight: 24 },
});

export default VoiceCommandScreen;
