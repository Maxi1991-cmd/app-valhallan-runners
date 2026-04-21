import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useDataStore } from '../../src/store/dataStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function UploadActivity() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const router = useRouter();
  const { athletes, fetchAthletes } = useDataStore();
  const [selectedAthlete, setSelectedAthlete] = useState(athleteId || '');
  const [uploadMode, setUploadMode] = useState<'manual' | 'file'>('manual');
  const [loading, setLoading] = useState(false);

  // Manual entry form
  const [manualData, setManualData] = useState({
    date: '',
    activity_type: 'running',
    duration_minutes: '',
    distance_km: '',
    avg_pace: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    calories: '',
    elevation_gain: '',
  });

  useEffect(() => {
    fetchAthletes();
  }, []);

  const activityTypes = [
    { value: 'running', label: 'Corsa' },
    { value: 'cycling', label: 'Ciclismo' },
    { value: 'swimming', label: 'Nuoto' },
    { value: 'walking', label: 'Camminata' },
    { value: 'trail', label: 'Trail' },
    { value: 'other', label: 'Altro' },
  ];

  const handleFilePick = async () => {
    if (!selectedAthlete) {
      Alert.alert('Errore', 'Seleziona prima un atleta');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name.toLowerCase();

      if (!fileName.endsWith('.gpx') && !fileName.endsWith('.fit')) {
        Alert.alert('Errore', 'Seleziona un file GPX o FIT');
        return;
      }

      setLoading(true);

      const token = await AsyncStorage.getItem('token');
      const endpoint = fileName.endsWith('.gpx')
        ? '/api/activities/upload-gpx'
        : '/api/activities/upload-fit';

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: fileName.endsWith('.gpx') ? FileSystem.EncodingType.UTF8 : FileSystem.EncodingType.Base64,
      });

      // Create form data
      const formData = new FormData();
      formData.append('athlete_id', selectedAthlete);
      formData.append('activity_type', manualData.activity_type);
      formData.append('file', {
        uri: file.uri,
        type: fileName.endsWith('.gpx') ? 'application/gpx+xml' : 'application/octet-stream',
        name: file.name,
      } as any);

      const response = await axios.post(
        `${BASE_URL}${endpoint}?athlete_id=${selectedAthlete}&activity_type=${manualData.activity_type}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Alert.alert('Successo', 'Attività caricata correttamente', [
        { text: 'OK', onPress: () => router.push('/(tabs)') },
      ]);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il caricamento');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!selectedAthlete) {
      Alert.alert('Errore', 'Seleziona un atleta');
      return;
    }

    if (!manualData.date || !manualData.duration_minutes) {
      Alert.alert('Errore', 'Data e durata sono obbligatori');
      return;
    }

    // Convert date from GG-MM-AAAA or GG/MM/AAAA to YYYY-MM-DD
    let formattedDate = manualData.date.trim();
    
    // Handle DD/MM/YYYY format (with slash)
    if (formattedDate.includes('/') && formattedDate.length === 10) {
      const parts = formattedDate.split('/');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    // Handle DD-MM-YYYY format (with dash)
    else if (formattedDate.includes('-') && formattedDate.length === 10) {
      const parts = formattedDate.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const data = {
        athlete_id: selectedAthlete,
        date: formattedDate,
        activity_type: manualData.activity_type,
        duration_minutes: parseInt(manualData.duration_minutes),
        distance_km: manualData.distance_km ? parseFloat(manualData.distance_km) : null,
        avg_pace: manualData.avg_pace || null,
        avg_heart_rate: manualData.avg_heart_rate ? parseInt(manualData.avg_heart_rate) : null,
        max_heart_rate: manualData.max_heart_rate ? parseInt(manualData.max_heart_rate) : null,
        calories: manualData.calories ? parseInt(manualData.calories) : null,
        elevation_gain: manualData.elevation_gain ? parseInt(manualData.elevation_gain) : null,
        source: 'manual',
      };

      await axios.post(`${BASE_URL}/api/activities`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Successo', 'Attività aggiunta', [
        { text: 'OK', onPress: () => router.push('/(tabs)') },
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Aggiungi Attività</Text>

          {/* Athlete Selection */}
          <Text style={styles.sectionTitle}>Atleta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.athleteScroll}>
            {athletes.map((athlete) => (
              <TouchableOpacity
                key={athlete.id}
                style={[
                  styles.athleteChip,
                  selectedAthlete === athlete.id && styles.athleteChipActive,
                ]}
                onPress={() => setSelectedAthlete(athlete.id)}
              >
                <Text
                  style={[
                    styles.athleteChipText,
                    selectedAthlete === athlete.id && styles.athleteChipTextActive,
                  ]}
                >
                  {athlete.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Form Inserimento Manuale */}
          <>
            <Input
              label="Data *"
              value={manualData.date}
              onChangeText={(text) => setManualData({ ...manualData, date: text })}
              placeholder="GG-MM-AAAA"
              />

              <Text style={styles.label}>Tipo Attività</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {activityTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeChip,
                      manualData.activity_type === type.value && styles.typeChipActive,
                    ]}
                    onPress={() => setManualData({ ...manualData, activity_type: type.value })}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        manualData.activity_type === type.value && styles.typeChipTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <Input
                  label="Durata (min) *"
                  value={manualData.duration_minutes}
                  onChangeText={(text) => setManualData({ ...manualData, duration_minutes: text })}
                  placeholder="45"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Distanza (km)"
                  value={manualData.distance_km}
                  onChangeText={(text) => setManualData({ ...manualData, distance_km: text })}
                  placeholder="8.5"
                  keyboardType="decimal-pad"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Input
                label="Passo Medio"
                value={manualData.avg_pace}
                onChangeText={(text) => setManualData({ ...manualData, avg_pace: text })}
                placeholder="5:30 min/km"
              />

              <View style={styles.row}>
                <Input
                  label="FC Media (bpm)"
                  value={manualData.avg_heart_rate}
                  onChangeText={(text) => setManualData({ ...manualData, avg_heart_rate: text })}
                  placeholder="145"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="FC Max (bpm)"
                  value={manualData.max_heart_rate}
                  onChangeText={(text) => setManualData({ ...manualData, max_heart_rate: text })}
                  placeholder="175"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              <View style={styles.row}>
                <Input
                  label="Calorie"
                  value={manualData.calories}
                  onChangeText={(text) => setManualData({ ...manualData, calories: text })}
                  placeholder="450"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Dislivello (m)"
                  value={manualData.elevation_gain}
                  onChangeText={(text) => setManualData({ ...manualData, elevation_gain: text })}
                  placeholder="120"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Button
                title="Salva Attività"
                onPress={handleManualSubmit}
                loading={loading}
                size="large"
                style={styles.saveButton}
              />
          </>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  backHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 8,
  },
  athleteScroll: {
    marginBottom: 20,
  },
  athleteChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  athleteChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  athleteChipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  athleteChipTextActive: {
    color: '#FFF',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#FF6B35',
  },
  modeText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#FFF',
  },
  uploadCard: {
    marginBottom: 20,
  },
  uploadContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  activityTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginTop: 20,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  typeScroll: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#252525',
    borderRadius: 16,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: '#FF6B35',
  },
  typeChipText: {
    color: '#999',
    fontSize: 13,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  uploadButton: {
    marginTop: 16,
    minWidth: 200,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 40,
  },
});
