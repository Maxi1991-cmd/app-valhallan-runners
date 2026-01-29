import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Workout {
  id: string;
  day: string;
  date?: string;
  title: string;
  description: string;
  workout_type: string;
  duration_minutes?: number;
  distance_km?: number;
  target_pace?: string;
  completed: boolean;
}

interface Program {
  id: string;
  name: string;
  workouts: Workout[];
}

export default function AthleteHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<{workout: Workout, programId: string} | null>(null);
  
  // Form states for complete workout
  const [fatigue, setFatigue] = useState(5);
  const [hasPain, setHasPain] = useState(false);
  const [painLocation, setPainLocation] = useState('');
  const [notes, setNotes] = useState('');
  
  // Form state for skip workout
  const [skipReason, setSkipReason] = useState('');

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/programs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrograms(response.data);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Esci', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('it-IT', { weekday: 'long' });

  // Filter workouts
  const allWorkouts = programs.flatMap(p => 
    p.workouts.map(w => ({ ...w, programId: p.id, programName: p.name }))
  );
  
  const todayWorkouts = allWorkouts.filter(w => w.date === today && !w.completed);
  const weekWorkouts = allWorkouts.filter(w => {
    if (!w.date) return false;
    const workoutDate = new Date(w.date);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return workoutDate >= startOfWeek && workoutDate <= endOfWeek;
  });

  const openCompleteModal = (workout: Workout, programId: string) => {
    setSelectedWorkout({ workout, programId });
    setFatigue(5);
    setHasPain(false);
    setPainLocation('');
    setNotes('');
    setShowCompleteModal(true);
  };

  const openSkipModal = (workout: Workout, programId: string) => {
    setSelectedWorkout({ workout, programId });
    setSkipReason('');
    setShowSkipModal(true);
  };

  const submitCompleteWorkout = async () => {
    if (!selectedWorkout) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/programs/${selectedWorkout.programId}/workouts/${selectedWorkout.workout.id}/complete`,
        {
          duration_minutes: selectedWorkout.workout.duration_minutes,
          distance_km: selectedWorkout.workout.distance_km,
          feeling: `Fatica: ${fatigue}/10${hasPain ? `, Dolore: ${painLocation}` : ''}`,
          notes: notes,
          fatigue_level: fatigue,
          has_pain: hasPain,
          pain_location: hasPain ? painLocation : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Successo', 'Allenamento completato! Il coach è stato notificato.');
      setShowCompleteModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
    }
  };

  const submitSkipWorkout = async () => {
    if (!selectedWorkout) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/programs/${selectedWorkout.programId}/workouts/${selectedWorkout.workout.id}/complete`,
        {
          skipped: true,
          skip_reason: skipReason,
          feeling: 'Allenamento non eseguito',
          notes: skipReason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Registrato', 'Il coach è stato notificato.');
      setShowSkipModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nel salvataggio');
    }
  };

  const getWorkoutTypeColor = (type: string) => {
    switch (type) {
      case 'easy': return '#4CAF50';
      case 'tempo': return '#FF9800';
      case 'interval': return '#F44336';
      case 'long': return '#9C27B0';
      default: return '#2196F3';
    }
  };

  const getWorkoutTypeLabel = (type: string) => {
    switch (type) {
      case 'easy': return 'Facile';
      case 'tempo': return 'Tempo';
      case 'interval': return 'Intervalli';
      case 'long': return 'Lungo';
      case 'recovery': return 'Recupero';
      default: return type;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ciao, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.dateText}>{dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, {new Date().toLocaleDateString('it-IT')}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Today's Workout */}
        <Card title="🏃 Allenamento di Oggi" style={styles.todayCard}>
          {todayWorkouts.length === 0 ? (
            <View style={styles.restDay}>
              <Ionicons name="bed" size={48} color="#4CAF50" />
              <Text style={styles.restDayText}>Giorno di riposo</Text>
              <Text style={styles.restDaySubtext}>Nessun allenamento programmato per oggi</Text>
            </View>
          ) : (
            todayWorkouts.map((workout: any) => (
              <View key={workout.id} style={styles.workoutItem}>
                <View style={styles.workoutHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: `${getWorkoutTypeColor(workout.workout_type)}20` }]}>
                    <Text style={[styles.typeText, { color: getWorkoutTypeColor(workout.workout_type) }]}>
                      {getWorkoutTypeLabel(workout.workout_type)}
                    </Text>
                  </View>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                </View>
                
                <Text style={styles.workoutDescription}>{workout.description}</Text>
                
                <View style={styles.workoutMeta}>
                  {workout.duration_minutes && (
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color="#999" />
                      <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                    </View>
                  )}
                  {workout.distance_km && (
                    <View style={styles.metaItem}>
                      <Ionicons name="navigate-outline" size={14} color="#999" />
                      <Text style={styles.metaText}>{workout.distance_km} km</Text>
                    </View>
                  )}
                  {workout.target_pace && (
                    <View style={styles.metaItem}>
                      <Ionicons name="speedometer-outline" size={14} color="#999" />
                      <Text style={styles.metaText}>{workout.target_pace}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.completeBtn]}
                    onPress={() => openCompleteModal(workout, workout.programId)}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.actionBtnText}>Fine Allenamento</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.skipBtn]}
                    onPress={() => openSkipModal(workout, workout.programId)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFF" />
                    <Text style={styles.actionBtnText}>Non Eseguito</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Week Workouts */}
        <Card title="📅 Allenamenti Settimanali" style={styles.weekCard}>
          {weekWorkouts.length === 0 ? (
            <Text style={styles.emptyText}>Nessun allenamento questa settimana</Text>
          ) : (
            weekWorkouts.map((workout: any) => (
              <View key={workout.id} style={[styles.weekWorkoutItem, workout.completed && styles.completedWorkout]}>
                <View style={styles.weekWorkoutDate}>
                  <Text style={styles.weekDay}>
                    {workout.date ? new Date(workout.date).toLocaleDateString('it-IT', { weekday: 'short' }) : '--'}
                  </Text>
                  <Text style={styles.weekDateNum}>
                    {workout.date ? new Date(workout.date).getDate() : '--'}
                  </Text>
                </View>
                <View style={styles.weekWorkoutInfo}>
                  <Text style={styles.weekWorkoutTitle}>{workout.title}</Text>
                  <Text style={styles.weekWorkoutMeta}>
                    {workout.duration_minutes && `${workout.duration_minutes}min`}
                    {workout.distance_km && ` • ${workout.distance_km}km`}
                  </Text>
                </View>
                {workout.completed ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                ) : (
                  <View style={[styles.statusDot, { backgroundColor: getWorkoutTypeColor(workout.workout_type) }]} />
                )}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Complete Workout Modal */}
      <Modal visible={showCompleteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fine Allenamento</Text>
              <TouchableOpacity onPress={() => setShowCompleteModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Livello di Fatica (1-10)</Text>
            <View style={styles.fatigueContainer}>
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[styles.fatigueBtn, fatigue === num && styles.fatigueBtnActive]}
                  onPress={() => setFatigue(num)}
                >
                  <Text style={[styles.fatigueBtnText, fatigue === num && styles.fatigueBtnTextActive]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Dolori?</Text>
            <View style={styles.painToggle}>
              <TouchableOpacity
                style={[styles.painOption, !hasPain && styles.painOptionActive]}
                onPress={() => setHasPain(false)}
              >
                <Text style={[styles.painOptionText, !hasPain && styles.painOptionTextActive]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.painOption, hasPain && styles.painOptionActive]}
                onPress={() => setHasPain(true)}
              >
                <Text style={[styles.painOptionText, hasPain && styles.painOptionTextActive]}>Sì</Text>
              </TouchableOpacity>
            </View>

            {hasPain && (
              <>
                <Text style={styles.inputLabel}>Dove?</Text>
                <TextInput
                  style={styles.textInput}
                  value={painLocation}
                  onChangeText={setPainLocation}
                  placeholder="Es: ginocchio destro, polpaccio..."
                  placeholderTextColor="#666"
                />
              </>
            )}

            <Text style={styles.inputLabel}>Note (opzionale)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Come ti sei sentito?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />

            <Button title="Invia al Coach" onPress={submitCompleteWorkout} style={styles.submitBtn} />
          </View>
        </View>
      </Modal>

      {/* Skip Workout Modal */}
      <Modal visible={showSkipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Allenamento Non Eseguito</Text>
              <TouchableOpacity onPress={() => setShowSkipModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Motivazione</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={skipReason}
              onChangeText={setSkipReason}
              placeholder="Perché non hai potuto allenarti?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />

            <Button title="Invia al Coach" onPress={submitSkipWorkout} variant="danger" style={styles.submitBtn} />
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  dateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 8,
  },
  todayCard: {
    marginBottom: 16,
    borderColor: '#FF6B35',
    borderWidth: 1,
  },
  restDay: {
    alignItems: 'center',
    padding: 20,
  },
  restDayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 12,
  },
  restDaySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  workoutItem: {
    marginBottom: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  workoutDescription: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginBottom: 12,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeBtn: {
    backgroundColor: '#4CAF50',
  },
  skipBtn: {
    backgroundColor: '#666',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  weekCard: {
    marginBottom: 20,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  weekWorkoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  completedWorkout: {
    opacity: 0.6,
  },
  weekWorkoutDate: {
    alignItems: 'center',
    width: 50,
    marginRight: 12,
  },
  weekDay: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  weekDateNum: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  weekWorkoutInfo: {
    flex: 1,
  },
  weekWorkoutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  weekWorkoutMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 8,
    marginTop: 12,
  },
  fatigueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fatigueBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fatigueBtnActive: {
    backgroundColor: '#FF6B35',
  },
  fatigueBtnText: {
    color: '#999',
    fontWeight: '600',
  },
  fatigueBtnTextActive: {
    color: '#FFF',
  },
  painToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  painOption: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  painOptionActive: {
    backgroundColor: '#FF6B35',
  },
  painOptionText: {
    color: '#999',
    fontWeight: '600',
  },
  painOptionTextActive: {
    color: '#FFF',
  },
  textInput: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 20,
    marginBottom: 20,
  },
});
