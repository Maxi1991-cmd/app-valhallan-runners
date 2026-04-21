import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Activity {
  id: string;
  athlete_id: string;
  date: string;
  activity_type: string;
  duration_minutes?: number;
  distance_km?: number;
  avg_pace?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  calories?: number;
  elevation_gain?: number;
  source: string;
  completed: boolean;
  feedback_sent: boolean;
  athlete_feedback?: {
    fatigue_level?: number;
    has_pain?: boolean;
    pain_location?: string;
    notes?: string;
  };
  actual_data?: {
    duration_minutes?: number;
    distance_km?: number;
    avg_pace?: string;
    avg_heart_rate?: number;
    max_heart_rate?: number;
    calories?: number;
  };
}

interface Athlete {
  id: string;
  name: string;
  email: string;
}

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [actualData, setActualData] = useState({
    duration_minutes: '',
    distance_km: '',
    avg_pace: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    calories: '',
  });

  useEffect(() => {
    loadActivity();
  }, [id]);

  const loadActivity = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Get single activity by ID
      const response = await axios.get(`${BASE_URL}/api/activities/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const found = response.data;
      
      if (!found) {
        Alert.alert('Errore', 'Attività non trovata');
        router.push('/(tabs)');
        return;
      }
      
      setActivity(found);
      
      // Pre-fill actual data if exists
      if (found.actual_data) {
        setActualData({
          duration_minutes: found.actual_data.duration_minutes?.toString() || found.duration_minutes?.toString() || '',
          distance_km: found.actual_data.distance_km?.toString() || found.distance_km?.toString() || '',
          avg_pace: found.actual_data.avg_pace || found.avg_pace || '',
          avg_heart_rate: found.actual_data.avg_heart_rate?.toString() || found.avg_heart_rate?.toString() || '',
          max_heart_rate: found.actual_data.max_heart_rate?.toString() || found.max_heart_rate?.toString() || '',
          calories: found.actual_data.calories?.toString() || found.calories?.toString() || '',
        });
      } else {
        // Pre-fill from activity data
        setActualData({
          duration_minutes: found.duration_minutes?.toString() || '',
          distance_km: found.distance_km?.toString() || '',
          avg_pace: found.avg_pace || '',
          avg_heart_rate: found.avg_heart_rate?.toString() || '',
          max_heart_rate: found.max_heart_rate?.toString() || '',
          calories: found.calories?.toString() || '',
        });
      }
      
      // Load athlete info
      const athleteResponse = await axios.get(`${BASE_URL}/api/athletes/${found.athlete_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAthlete(athleteResponse.data);
      
    } catch (error) {
      console.error('Error loading activity:', error);
      Alert.alert('Errore', 'Impossibile caricare attività');
      router.push('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!activity) return;
    
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      const data = {
        duration_minutes: actualData.duration_minutes ? parseInt(actualData.duration_minutes) : null,
        distance_km: actualData.distance_km ? parseFloat(actualData.distance_km) : null,
        avg_pace: actualData.avg_pace || null,
        avg_heart_rate: actualData.avg_heart_rate ? parseInt(actualData.avg_heart_rate) : null,
        max_heart_rate: actualData.max_heart_rate ? parseInt(actualData.max_heart_rate) : null,
        calories: actualData.calories ? parseInt(actualData.calories) : null,
      };
      
      await axios.put(
        `${BASE_URL}/api/activities/${id}/finalize`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Successo', 'Attività terminata! Analisi dati aggiornate.');
      router.push('/(tabs)');
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile terminare attività');
    } finally {
      setSaving(false);
    }
  };

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      running: 'Corsa',
      cycling: 'Ciclismo',
      swimming: 'Nuoto',
      walking: 'Camminata',
      hiking: 'Escursione',
      other: 'Altro',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <LoadingScreen message="Caricamento attività..." />;
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Attività non trovata</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.backHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Indietro</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Info */}
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.typeBadge}>
                <Ionicons 
                  name={activity.activity_type === 'running' ? 'walk' : activity.activity_type === 'cycling' ? 'bicycle' : 'fitness'} 
                  size={20} 
                  color="#FF6B35" 
                />
                <Text style={styles.typeText}>{getActivityTypeLabel(activity.activity_type)}</Text>
              </View>
              <View style={[styles.statusBadge, activity.completed ? styles.statusCompleted : styles.statusPending]}>
                <Ionicons 
                  name={activity.completed ? 'checkmark-circle' : 'time'} 
                  size={16} 
                  color={activity.completed ? '#4CAF50' : '#FF9800'} 
                />
                <Text style={[styles.statusText, { color: activity.completed ? '#4CAF50' : '#FF9800' }]}>
                  {activity.completed ? 'Completata' : 'Da completare'}
                </Text>
              </View>
            </View>
            
            <View style={styles.dateRow}>
              <Ionicons name="calendar" size={14} color="#999" />
              <Text style={styles.dateText}>{activity.date}</Text>
            </View>
            
            {athlete && (
              <View style={styles.dateRow}>
                <Ionicons name="person" size={14} color="#999" />
                <Text style={styles.athleteText}>{athlete.name}</Text>
              </View>
            )}
            
            <Text style={styles.sourceText}>
              Fonte: {activity.source === 'manual' ? 'Manuale' : activity.source?.toUpperCase() || 'N/A'}
            </Text>
          </Card>

          {/* Feedback Atleta */}
          {activity.feedback_sent && activity.athlete_feedback && (
            <Card title="Feedback Atleta" style={styles.feedbackCard}>
              <View style={styles.feedbackContent}>
                {activity.athlete_feedback.fatigue_level && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="fitness" size={18} color="#FF6B35" />
                    <Text style={styles.feedbackLabel}>Fatica:</Text>
                    <Text style={styles.feedbackValue}>{activity.athlete_feedback.fatigue_level}/10</Text>
                  </View>
                )}
                <View style={styles.feedbackRow}>
                  <Ionicons name="medkit" size={18} color={activity.athlete_feedback.has_pain ? '#DC3545' : '#4CAF50'} />
                  <Text style={styles.feedbackLabel}>Dolori:</Text>
                  <Text style={[styles.feedbackValue, activity.athlete_feedback.has_pain && { color: '#DC3545' }]}>
                    {activity.athlete_feedback.has_pain 
                      ? activity.athlete_feedback.pain_location || 'Sì' 
                      : 'Nessuno'}
                  </Text>
                </View>
                {activity.athlete_feedback.notes && (
                  <View style={styles.feedbackNotes}>
                    <Text style={styles.feedbackNotesLabel}>Note:</Text>
                    <Text style={styles.feedbackNotesText}>"{activity.athlete_feedback.notes}"</Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Dati Attività (Pre-caricati) */}
          <Card title="Dati Originali" style={styles.dataCard}>
            <View style={styles.dataGrid}>
              {activity.duration_minutes && (
                <View style={styles.dataItem}>
                  <Ionicons name="time" size={20} color="#666" />
                  <Text style={styles.dataValue}>{activity.duration_minutes} min</Text>
                  <Text style={styles.dataLabel}>Durata</Text>
                </View>
              )}
              {activity.distance_km && (
                <View style={styles.dataItem}>
                  <Ionicons name="navigate" size={20} color="#666" />
                  <Text style={styles.dataValue}>{activity.distance_km} km</Text>
                  <Text style={styles.dataLabel}>Distanza</Text>
                </View>
              )}
              {activity.avg_pace && (
                <View style={styles.dataItem}>
                  <Ionicons name="speedometer" size={20} color="#666" />
                  <Text style={styles.dataValue}>{activity.avg_pace}</Text>
                  <Text style={styles.dataLabel}>Passo</Text>
                </View>
              )}
              {activity.calories && (
                <View style={styles.dataItem}>
                  <Ionicons name="flame" size={20} color="#666" />
                  <Text style={styles.dataValue}>{activity.calories}</Text>
                  <Text style={styles.dataLabel}>Calorie</Text>
                </View>
              )}
            </View>
          </Card>

          {/* Form Dati Effettivi (Coach) */}
          {!activity.completed && (
            <Card title="Dati Effettivi (Coach)" style={styles.formCard}>
              <View style={styles.formRow}>
                <Input
                  label="Durata (min)"
                  value={actualData.duration_minutes}
                  onChangeText={(text) => setActualData({ ...actualData, duration_minutes: text })}
                  placeholder="45"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Distanza (km)"
                  value={actualData.distance_km}
                  onChangeText={(text) => setActualData({ ...actualData, distance_km: text })}
                  placeholder="10.5"
                  keyboardType="decimal-pad"
                  containerStyle={styles.halfInput}
                />
              </View>
              
              <Input
                label="Passo Medio"
                value={actualData.avg_pace}
                onChangeText={(text) => setActualData({ ...actualData, avg_pace: text })}
                placeholder="5:30 min/km"
              />
              
              <View style={styles.formRow}>
                <Input
                  label="FC Media (bpm)"
                  value={actualData.avg_heart_rate}
                  onChangeText={(text) => setActualData({ ...actualData, avg_heart_rate: text })}
                  placeholder="145"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="FC Max (bpm)"
                  value={actualData.max_heart_rate}
                  onChangeText={(text) => setActualData({ ...actualData, max_heart_rate: text })}
                  placeholder="175"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>
              
              <Input
                label="Calorie"
                value={actualData.calories}
                onChangeText={(text) => setActualData({ ...actualData, calories: text })}
                placeholder="450"
                keyboardType="numeric"
              />

              <Button
                title="Termina"
                onPress={handleFinalize}
                loading={saving}
                size="large"
                style={styles.finalizeBtn}
              />
            </Card>
          )}

          {/* Se già completata, mostra i dati */}
          {activity.completed && activity.actual_data && (
            <Card title="Dati Registrati" style={styles.completedCard}>
              <View style={styles.dataGrid}>
                {activity.actual_data.duration_minutes && (
                  <View style={styles.dataItem}>
                    <Ionicons name="time" size={20} color="#4CAF50" />
                    <Text style={styles.dataValue}>{activity.actual_data.duration_minutes} min</Text>
                    <Text style={styles.dataLabel}>Durata</Text>
                  </View>
                )}
                {activity.actual_data.distance_km && (
                  <View style={styles.dataItem}>
                    <Ionicons name="navigate" size={20} color="#4CAF50" />
                    <Text style={styles.dataValue}>{activity.actual_data.distance_km} km</Text>
                    <Text style={styles.dataLabel}>Distanza</Text>
                  </View>
                )}
                {activity.actual_data.avg_pace && (
                  <View style={styles.dataItem}>
                    <Ionicons name="speedometer" size={20} color="#4CAF50" />
                    <Text style={styles.dataValue}>{activity.actual_data.avg_pace}</Text>
                    <Text style={styles.dataLabel}>Passo</Text>
                  </View>
                )}
                {activity.actual_data.avg_heart_rate && (
                  <View style={styles.dataItem}>
                    <Ionicons name="heart" size={20} color="#4CAF50" />
                    <Text style={styles.dataValue}>{activity.actual_data.avg_heart_rate} bpm</Text>
                    <Text style={styles.dataLabel}>FC Media</Text>
                  </View>
                )}
              </View>
            </Card>
          )}
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
    padding: 16,
  },
  errorText: {
    color: '#DC3545',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  headerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateText: {
    color: '#CCC',
    fontSize: 14,
  },
  athleteText: {
    color: '#CCC',
    fontSize: 14,
  },
  sourceText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  feedbackCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  feedbackContent: {
    gap: 12,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackLabel: {
    color: '#999',
    fontSize: 14,
  },
  feedbackValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackNotes: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  feedbackNotesLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  feedbackNotesText: {
    color: '#CCC',
    fontSize: 14,
    fontStyle: 'italic',
  },
  dataCard: {
    marginBottom: 16,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dataItem: {
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
    flex: 1,
  },
  dataValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  dataLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  formCard: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  finalizeBtn: {
    marginTop: 16,
  },
  completedCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
});
