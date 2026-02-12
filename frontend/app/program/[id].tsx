import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { programAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrainingProgram, WorkoutSession } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Funzione safe per formattare date con date-fns
const safeFormatDate = (dateString?: string | null, formatStr: string = 'd MMM yyyy'): string => {
  try {
    if (!dateString || dateString === '') return '--';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--';
    return format(date, formatStr, { locale: it });
  } catch (e) {
    console.warn('Errore formattazione data:', dateString, e);
    return '--';
  }
};

export default function ProgramDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { athletes, deleteProgram, fetchNotifications } = useDataStore();
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [editWorkoutModalVisible, setEditWorkoutModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSession | null>(null);
  const [completionData, setCompletionData] = useState({
    duration_minutes: '',
    distance_km: '',
    avg_pace: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    calories: '',
    feeling: 'good',
    notes: '',
  });
  const [editWorkoutData, setEditWorkoutData] = useState({
    title: '',
    description: '',
    workout_type: 'easy',
    duration_minutes: '',
    distance_km: '',
    target_pace: '',
    notes: '',
  });

  const loadProgram = async () => {
    try {
      const response = await programAPI.getOne(id!);
      setProgram(response.data);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare programma');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgram();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProgram();
    setRefreshing(false);
  };

  const getAthleteName = () => {
    const athlete = athletes.find((a) => a.id === program?.athlete_id);
    return athlete?.name || 'Atleta';
  };

  const handleDelete = () => {
    Alert.alert(
      'Elimina Programma',
      'Sei sicuro di voler eliminare questo programma?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProgram(id!);
              router.back();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare programma');
            }
          },
        },
      ]
    );
  };

  const openCompleteModal = (workout: WorkoutSession) => {
    setSelectedWorkout(workout);
    setCompletionData({
      duration_minutes: workout.duration_minutes?.toString() || '',
      distance_km: workout.distance_km?.toString() || '',
      avg_pace: workout.target_pace || '',
      avg_heart_rate: '',
      max_heart_rate: '',
      calories: '',
      feeling: 'good',
      notes: '',
    });
    setCompleteModalVisible(true);
  };

  const openEditWorkoutModal = (workout: WorkoutSession) => {
    setSelectedWorkout(workout);
    setEditWorkoutData({
      title: workout.title || '',
      description: workout.description || '',
      workout_type: workout.workout_type || 'easy',
      duration_minutes: workout.duration_minutes?.toString() || '',
      distance_km: workout.distance_km?.toString() || '',
      target_pace: workout.target_pace || '',
      notes: workout.notes || '',
    });
    setEditWorkoutModalVisible(true);
  };

  const handleEditWorkout = async () => {
    if (!selectedWorkout || !program) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Aggiorna il workout nel programma
      const updatedWorkouts = program.workouts.map((w) => {
        if (w.id === selectedWorkout.id) {
          return {
            ...w,
            title: editWorkoutData.title,
            description: editWorkoutData.description,
            workout_type: editWorkoutData.workout_type,
            duration_minutes: editWorkoutData.duration_minutes ? parseInt(editWorkoutData.duration_minutes) : undefined,
            distance_km: editWorkoutData.distance_km ? parseFloat(editWorkoutData.distance_km) : undefined,
            target_pace: editWorkoutData.target_pace || undefined,
            notes: editWorkoutData.notes || undefined,
          };
        }
        return w;
      });
      
      await axios.put(
        `${BASE_URL}/api/programs/${id}`,
        { ...program, workouts: updatedWorkouts },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Successo', 'Allenamento modificato');
      setEditWorkoutModalVisible(false);
      setSelectedWorkout(null);
      loadProgram();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nella modifica');
    }
  };

  const handleDeleteWorkout = (workout: WorkoutSession) => {
    Alert.alert(
      'Elimina Allenamento',
      `Sei sicuro di voler eliminare "${workout.title}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              
              // Rimuovi il workout dal programma
              const updatedWorkouts = program!.workouts.filter((w) => w.id !== workout.id);
              
              await axios.put(
                `${BASE_URL}/api/programs/${id}`,
                { ...program, workouts: updatedWorkouts },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              Alert.alert('Successo', 'Allenamento eliminato');
              loadProgram();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Errore nell\'eliminazione');
            }
          },
        },
      ]
    );
  };

  const handleCompleteWorkout = async () => {
    if (!selectedWorkout) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const data = {
        duration_minutes: completionData.duration_minutes ? parseInt(completionData.duration_minutes) : null,
        distance_km: completionData.distance_km ? parseFloat(completionData.distance_km) : null,
        avg_pace: completionData.avg_pace || null,
        avg_heart_rate: completionData.avg_heart_rate ? parseInt(completionData.avg_heart_rate) : null,
        max_heart_rate: completionData.max_heart_rate ? parseInt(completionData.max_heart_rate) : null,
        calories: completionData.calories ? parseInt(completionData.calories) : null,
        notes: completionData.notes || null,
      };

      // Use /finalize endpoint - no notification, updates analytics
      await axios.put(
        `${BASE_URL}/api/programs/${id}/workouts/${selectedWorkout.id}/finalize`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCompleteModalVisible(false);
      loadProgram();
      Alert.alert('Successo', 'Allenamento terminato! Analisi dati aggiornate.');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile terminare allenamento');
    }
  };

  const generatePDF = async () => {
    if (!program) return;

    const workoutsHtml = program.workouts
      .map(
        (w) => `
        <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
          <div style="color: #FF6B35; font-weight: bold;">${w.day}</div>
          <div style="font-size: 18px; font-weight: bold; margin: 4px 0;">${w.title}</div>
          <div style="color: #666;">${w.description}</div>
          <div style="margin-top: 8px; font-size: 12px; color: #999;">
            ${w.duration_minutes ? `Durata: ${w.duration_minutes}min` : ''}
            ${w.distance_km ? ` | Distanza: ${w.distance_km}km` : ''}
            ${w.target_pace ? ` | Passo: ${w.target_pace}` : ''}
            ${w.heart_rate_zone ? ` | Zona: ${w.heart_rate_zone}` : ''}
          </div>
          ${w.notes ? `<div style="margin-top: 8px; font-style: italic; color: #666;">Note: ${w.notes}</div>` : ''}
        </div>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
            h1 { color: #FF6B35; }
            .header { margin-bottom: 24px; }
            .meta { color: #666; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${program.name}</h1>
            <div class="meta"><strong>Atleta:</strong> ${getAthleteName()}</div>
            <div class="meta"><strong>Periodo:</strong> ${program.start_date} - ${program.end_date}</div>
            ${program.goal ? `<div class="meta"><strong>Obiettivo:</strong> ${program.goal}</div>` : ''}
            ${program.description ? `<div class="meta">${program.description}</div>` : ''}
          </div>
          <h2>Allenamenti</h2>
          ${workoutsHtml}
          <div style="margin-top: 32px; text-align: center; color: #999; font-size: 12px;">
            Generato da RunCoach Pro
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Errore', 'Impossibile generare PDF');
    }
  };

  const getWorkoutTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      easy: '#4CAF50',
      tempo: '#FF9800',
      interval: '#F44336',
      long_run: '#2196F3',
      recovery: '#9C27B0',
      fartlek: '#FF5722',
      hill: '#795548',
      race: '#E91E63',
    };
    return colors[type] || '#666';
  };

  const getWorkoutTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      easy: 'Facile',
      tempo: 'Tempo',
      interval: 'Ripetute',
      long_run: 'Lungo',
      recovery: 'Recupero',
      fartlek: 'Fartlek',
      hill: 'Salite',
      race: 'Gara',
    };
    return labels[type] || type;
  };

  if (loading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (!program) return null;

  const completedCount = program.workouts.filter((w) => w.completed).length;
  const progress = program.workouts.length > 0 ? (completedCount / program.workouts.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.programName}>{program.name}</Text>
          <Text style={styles.athleteName}>
            <Ionicons name="person" size={14} color="#999" /> {getAthleteName()}
          </Text>
          <Text style={styles.dates}>
            <Ionicons name="calendar" size={14} color="#999" />{' '}
            {safeFormatDate(program.start_date, 'd MMM')} -{' '}
            {safeFormatDate(program.end_date, 'd MMM yyyy')}
          </Text>
          {program.goal && (
            <View style={styles.goalContainer}>
              <Ionicons name="flag" size={14} color="#FF6B35" />
              <Text style={styles.goalText}>{program.goal}</Text>
            </View>
          )}
        </View>

        {/* Progress */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progresso</Text>
            <Text style={styles.progressCount}>
              {completedCount}/{program.workouts.length}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actionButtons}>
          <Button
            title="Modifica"
            onPress={() => router.push(`/program/create?id=${id}`)}
            variant="outline"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Elimina"
            onPress={handleDelete}
            variant="danger"
            size="small"
            style={styles.actionButton}
          />
        </View>

        {/* Workouts */}
        <Text style={styles.sectionTitle}>Allenamenti</Text>

        {program.workouts.map((workout, index) => (
          <Card key={workout.id || index} style={styles.workoutCard}>
            <TouchableOpacity
              style={styles.workoutHeader}
              onPress={() => !workout.completed && openCompleteModal(workout)}
            >
              <View style={styles.checkboxContainer}>
                <Ionicons
                  name={workout.completed ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={workout.completed ? '#4CAF50' : '#666'}
                />
              </View>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutDay}>{workout.day}</Text>
                <Text
                  style={[
                    styles.workoutTitle,
                    workout.completed && styles.completedTitle,
                  ]}
                >
                  {workout.title}
                </Text>
              </View>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: `${getWorkoutTypeColor(workout.workout_type)}20` },
                ]}
              >
                <Text
                  style={[
                    styles.typeText,
                    { color: getWorkoutTypeColor(workout.workout_type) },
                  ]}
                >
                  {getWorkoutTypeLabel(workout.workout_type)}
                </Text>
              </View>
              {/* Action buttons */}
              <View style={styles.workoutActions}>
                <TouchableOpacity
                  style={styles.workoutActionBtn}
                  onPress={() => openEditWorkoutModal(workout)}
                >
                  <Ionicons name="pencil" size={18} color="#FF6B35" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.workoutActionBtn}
                  onPress={() => handleDeleteWorkout(workout)}
                >
                  <Ionicons name="trash" size={18} color="#DC3545" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            <Text style={styles.workoutDesc}>{workout.description}</Text>

            <View style={styles.workoutMeta}>
              {workout.duration_minutes && (
                <View style={styles.metaItem}>
                  <Ionicons name="time" size={14} color="#666" />
                  <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                </View>
              )}
              {workout.distance_km && (
                <View style={styles.metaItem}>
                  <Ionicons name="footsteps" size={14} color="#666" />
                  <Text style={styles.metaText}>{workout.distance_km} km</Text>
                </View>
              )}
              {workout.target_pace && (
                <View style={styles.metaItem}>
                  <Ionicons name="speedometer" size={14} color="#666" />
                  <Text style={styles.metaText}>{workout.target_pace}</Text>
                </View>
              )}
              {workout.heart_rate_zone && (
                <View style={styles.metaItem}>
                  <Ionicons name="heart" size={14} color="#666" />
                  <Text style={styles.metaText}>{workout.heart_rate_zone}</Text>
                </View>
              )}
            </View>

            {workout.notes && (
              <Text style={styles.workoutNotes}>
                <Ionicons name="document-text" size={12} color="#666" /> {workout.notes}
              </Text>
            )}

            {/* Feedback dell'atleta */}
            {workout.feedback_sent && workout.athlete_feedback && (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackTitle}>
                  <Ionicons name="chatbubble-ellipses" size={14} color="#FF6B35" /> Feedback Atleta
                </Text>
                {workout.athlete_feedback.fatigue_level && (
                  <Text style={styles.feedbackText}>
                    Fatica: {workout.athlete_feedback.fatigue_level}/10
                  </Text>
                )}
                {workout.athlete_feedback.has_pain && (
                  <Text style={styles.feedbackText}>
                    Dolori: {workout.athlete_feedback.pain_location || 'Sì'}
                  </Text>
                )}
                {workout.athlete_feedback.notes && (
                  <Text style={styles.feedbackText}>
                    Note: {workout.athlete_feedback.notes}
                  </Text>
                )}
                <Text style={styles.feedbackDate}>
                  Inviato il {workout.feedback_date}
                </Text>
              </View>
            )}

            {workout.completed && workout.completed_date && (
              <View style={styles.completedSection}>
                <Text style={styles.completedDate}>
                  Completato il {workout.completed_date}
                </Text>
                {workout.actual_data && (
                  <View style={styles.actualDataContainer}>
                    {workout.actual_data.duration_minutes && (
                      <Text style={styles.actualDataText}>
                        Durata: {workout.actual_data.duration_minutes} min
                      </Text>
                    )}
                    {workout.actual_data.distance_km && (
                      <Text style={styles.actualDataText}>
                        Distanza: {workout.actual_data.distance_km} km
                      </Text>
                    )}
                    {workout.actual_data.avg_pace && (
                      <Text style={styles.actualDataText}>
                        Passo: {workout.actual_data.avg_pace}
                      </Text>
                    )}
                    {workout.actual_data.avg_heart_rate && (
                      <Text style={styles.actualDataText}>
                        FC media: {workout.actual_data.avg_heart_rate} bpm
                      </Text>
                    )}
                    {workout.actual_data.feeling && (
                      <Text style={styles.actualDataText}>
                        Sensazione: {workout.actual_data.feeling}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {!workout.completed && (
              <Button
                title="Segna come completato"
                onPress={() => openCompleteModal(workout)}
                variant="outline"
                size="small"
                style={styles.completeButton}
              />
            )}
          </Card>
        ))}
      </ScrollView>

      {/* Complete Workout Modal */}
      <Modal
        visible={completeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Completa Allenamento</Text>
              <TouchableOpacity onPress={() => setCompleteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                {selectedWorkout?.title}
              </Text>

              <View style={styles.modalRow}>
                <Input
                  label="Durata (min)"
                  value={completionData.duration_minutes}
                  onChangeText={(text) =>
                    setCompletionData({ ...completionData, duration_minutes: text })
                  }
                  placeholder="45"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Distanza (km)"
                  value={completionData.distance_km}
                  onChangeText={(text) =>
                    setCompletionData({ ...completionData, distance_km: text })
                  }
                  placeholder="8.5"
                  keyboardType="decimal-pad"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Input
                label="Passo Medio"
                value={completionData.avg_pace}
                onChangeText={(text) =>
                  setCompletionData({ ...completionData, avg_pace: text })
                }
                placeholder="5:30 min/km"
              />

              <View style={styles.modalRow}>
                <Input
                  label="FC Media (bpm)"
                  value={completionData.avg_heart_rate}
                  onChangeText={(text) =>
                    setCompletionData({ ...completionData, avg_heart_rate: text })
                  }
                  placeholder="145"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="FC Max (bpm)"
                  value={completionData.max_heart_rate}
                  onChangeText={(text) =>
                    setCompletionData({ ...completionData, max_heart_rate: text })
                  }
                  placeholder="175"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              <Input
                label="Calorie"
                value={completionData.calories}
                onChangeText={(text) =>
                  setCompletionData({ ...completionData, calories: text })
                }
                placeholder="450"
                keyboardType="numeric"
              />

              <Input
                label="Note"
                value={completionData.notes}
                onChangeText={(text) =>
                  setCompletionData({ ...completionData, notes: text })
                }
                placeholder="Come è andato l'allenamento..."
                multiline
                numberOfLines={3}
              />

              <Button
                title="Termina"
                onPress={handleCompleteWorkout}
                size="large"
                style={styles.submitButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Workout Modal */}
      <Modal visible={editWorkoutModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Allenamento</Text>
              <TouchableOpacity onPress={() => { setEditWorkoutModalVisible(false); setSelectedWorkout(null); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <Input
                label="Titolo"
                value={editWorkoutData.title}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, title: text })}
                placeholder="Es: Corsa Lenta"
              />
              <Input
                label="Descrizione"
                value={editWorkoutData.description}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, description: text })}
                placeholder="Descrizione allenamento"
                multiline
              />
              
              <Text style={styles.inputLabel}>Tipo Allenamento</Text>
              <View style={styles.typeSelector}>
                {['easy', 'tempo', 'intervals', 'long', 'recovery', 'race'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      editWorkoutData.workout_type === type && styles.typeChipActive
                    ]}
                    onPress={() => setEditWorkoutData({ ...editWorkoutData, workout_type: type })}
                  >
                    <Text style={[
                      styles.typeChipText,
                      editWorkoutData.workout_type === type && styles.typeChipTextActive
                    ]}>
                      {type === 'easy' ? 'Facile' : 
                       type === 'tempo' ? 'Tempo' :
                       type === 'intervals' ? 'Intervalli' :
                       type === 'long' ? 'Lungo' :
                       type === 'recovery' ? 'Recupero' : 'Gara'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Durata (minuti)"
                value={editWorkoutData.duration_minutes}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, duration_minutes: text })}
                placeholder="Es: 45"
                keyboardType="numeric"
              />
              <Input
                label="Distanza (km)"
                value={editWorkoutData.distance_km}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, distance_km: text })}
                placeholder="Es: 10"
                keyboardType="decimal-pad"
              />
              <Input
                label="Passo Target"
                value={editWorkoutData.target_pace}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, target_pace: text })}
                placeholder="Es: 5:30 min/km"
              />
              <Input
                label="Note"
                value={editWorkoutData.notes}
                onChangeText={(text) => setEditWorkoutData({ ...editWorkoutData, notes: text })}
                placeholder="Note aggiuntive"
                multiline
              />

              <Button
                title="Salva Modifiche"
                onPress={handleEditWorkout}
                style={styles.submitButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  programName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  athleteName: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  dates: {
    fontSize: 14,
    color: '#999',
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  goalText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  progressCard: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  progressCount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  workoutCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutDay: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 2,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  typeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  workoutDesc: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 12,
    lineHeight: 20,
  },
  workoutMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  workoutNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
  },
  feedbackSection: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#CCC',
    marginBottom: 4,
  },
  feedbackDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
    fontStyle: 'italic',
  },
  completedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  completedDate: {
    fontSize: 11,
    color: '#4CAF50',
  },
  actualDataContainer: {
    backgroundColor: '#252525',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  actualDataText: {
    fontSize: 12,
    color: '#CCC',
    marginBottom: 4,
  },
  completeButton: {
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalBody: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  feelingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 12,
  },
  feelingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  feelingButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#252525',
  },
  feelingButtonActive: {
    backgroundColor: '#FF6B35',
  },
  feelingText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  feelingTextActive: {
    color: '#FFF',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 40,
  },
});
