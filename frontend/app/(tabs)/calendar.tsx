import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { Calendar, CalendarList } from 'react-native-calendars';
import { useDataStore } from '../../src/store/dataStore';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface CalendarWorkout {
  id: string;
  program_id: string;
  program_name: string;
  athlete_id: string;
  athlete_name: string;
  date: string;
  title: string;
  description: string;
  workout_type: string;
  duration_minutes?: number;
  distance_km?: number;
  target_pace?: string;
  heart_rate_zone?: string;
  completed: boolean;
  completed_date?: string;
  actual_data?: any;
}

export default function CalendarTab() {
  const { user } = useAuthStore();
  const { athletes, fetchAthletes } = useDataStore();
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [workouts, setWorkouts] = useState<CalendarWorkout[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<CalendarWorkout | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchAthletes();
  }, []);

  useEffect(() => {
    loadWorkouts();
  }, [selectedAthlete]);

  const loadWorkouts = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const params: any = {};
      if (selectedAthlete) {
        params.athlete_id = selectedAthlete;
      }
      
      const response = await axios.get(`${BASE_URL}/api/calendar/workouts`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setWorkouts(response.data.workouts || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts();
    setRefreshing(false);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    
    workouts.forEach((workout) => {
      if (workout.date) {
        const existing = marked[workout.date];
        const dotColor = workout.completed ? '#4CAF50' : '#FF6B35';
        
        if (existing) {
          existing.dots.push({ color: dotColor });
        } else {
          marked[workout.date] = {
            dots: [{ color: dotColor }],
            marked: true,
          };
        }
      }
    });
    
    // Mark selected date
    if (marked[selectedDate]) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#FF6B35',
      };
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#FF6B35',
      };
    }
    
    return marked;
  };

  const getWorkoutsForDate = (date: string) => {
    return workouts.filter((w) => w.date === date);
  };

  const getWeekDays = () => {
    const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      return format(day, 'yyyy-MM-dd');
    });
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

  const openWorkoutDetail = (workout: CalendarWorkout) => {
    setSelectedWorkout(workout);
    setModalVisible(true);
  };

  const renderDayWorkouts = (date: string) => {
    const dayWorkouts = getWorkoutsForDate(date);
    if (dayWorkouts.length === 0) return null;

    return dayWorkouts.map((workout, index) => (
      <TouchableOpacity
        key={workout.id || index}
        style={[
          styles.workoutItem,
          { borderLeftColor: getWorkoutTypeColor(workout.workout_type) },
        ]}
        onPress={() => openWorkoutDetail(workout)}
      >
        <View style={styles.workoutItemHeader}>
          <Text style={styles.workoutTitle} numberOfLines={1}>
            {workout.title}
          </Text>
          {workout.completed && (
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          )}
        </View>
        <Text style={styles.workoutAthlete}>{workout.athlete_name}</Text>
        <View style={styles.workoutMeta}>
          {workout.duration_minutes && (
            <Text style={styles.metaText}>{workout.duration_minutes}min</Text>
          )}
          {workout.distance_km && (
            <Text style={styles.metaText}>{workout.distance_km}km</Text>
          )}
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendario</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'month' && styles.toggleActive]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>
              Mese
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'week' && styles.toggleActive]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
              Settimana
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Athlete Filter */}
      {user?.role === 'coach' && athletes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.athleteFilter}>
          <TouchableOpacity
            style={[
              styles.athleteChip,
              !selectedAthlete && styles.athleteChipActive,
            ]}
            onPress={() => setSelectedAthlete(null)}
          >
            <Text style={[styles.athleteChipText, !selectedAthlete && styles.athleteChipTextActive]}>
              Tutti
            </Text>
          </TouchableOpacity>
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
      )}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
        }
      >
        {viewMode === 'month' ? (
          <>
            <Calendar
              current={selectedDate}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              markingType="multi-dot"
              markedDates={getMarkedDates()}
              theme={{
                backgroundColor: '#0F0F0F',
                calendarBackground: '#0F0F0F',
                textSectionTitleColor: '#999',
                selectedDayBackgroundColor: '#FF6B35',
                selectedDayTextColor: '#FFF',
                todayTextColor: '#FF6B35',
                dayTextColor: '#FFF',
                textDisabledColor: '#444',
                dotColor: '#FF6B35',
                monthTextColor: '#FFF',
                arrowColor: '#FF6B35',
              }}
              style={styles.calendar}
            />

            <View style={styles.selectedDateSection}>
              <Text style={styles.selectedDateTitle}>
                {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it })}
              </Text>
              {getWorkoutsForDate(selectedDate).length === 0 ? (
                <Text style={styles.noWorkouts}>Nessun allenamento programmato</Text>
              ) : (
                renderDayWorkouts(selectedDate)
              )}
            </View>
          </>
        ) : (
          <View style={styles.weekView}>
            {getWeekDays().map((date) => (
              <View key={date} style={styles.weekDay}>
                <TouchableOpacity
                  style={[
                    styles.weekDayHeader,
                    date === selectedDate && styles.weekDayHeaderActive,
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={styles.weekDayName}>
                    {format(parseISO(date), 'EEE', { locale: it })}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNumber,
                      date === selectedDate && styles.weekDayNumberActive,
                    ]}
                  >
                    {format(parseISO(date), 'd')}
                  </Text>
                </TouchableOpacity>
                <View style={styles.weekDayWorkouts}>
                  {renderDayWorkouts(date)}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF6B35' }]} />
            <Text style={styles.legendText}>Programmato</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Completato</Text>
          </View>
        </View>
      </ScrollView>

      {/* Workout Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedWorkout?.title}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedWorkout && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Atleta</Text>
                  <Text style={styles.modalValue}>{selectedWorkout.athlete_name}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Programma</Text>
                  <Text style={styles.modalValue}>{selectedWorkout.program_name}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Data</Text>
                  <Text style={styles.modalValue}>{selectedWorkout.date}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Stato</Text>
                  <Text style={[styles.modalValue, { color: selectedWorkout.completed ? '#4CAF50' : '#FF6B35' }]}>
                    {selectedWorkout.completed ? 'Completato' : 'Da fare'}
                  </Text>
                </View>

                <Text style={styles.modalSectionTitle}>Descrizione</Text>
                <Text style={styles.modalDescription}>{selectedWorkout.description}</Text>

                {(selectedWorkout.duration_minutes || selectedWorkout.distance_km || selectedWorkout.target_pace) && (
                  <>
                    <Text style={styles.modalSectionTitle}>Obiettivi</Text>
                    <View style={styles.modalStats}>
                      {selectedWorkout.duration_minutes && (
                        <View style={styles.modalStat}>
                          <Ionicons name="time" size={20} color="#FF6B35" />
                          <Text style={styles.modalStatValue}>{selectedWorkout.duration_minutes} min</Text>
                        </View>
                      )}
                      {selectedWorkout.distance_km && (
                        <View style={styles.modalStat}>
                          <Ionicons name="footsteps" size={20} color="#4CAF50" />
                          <Text style={styles.modalStatValue}>{selectedWorkout.distance_km} km</Text>
                        </View>
                      )}
                      {selectedWorkout.target_pace && (
                        <View style={styles.modalStat}>
                          <Ionicons name="speedometer" size={20} color="#2196F3" />
                          <Text style={styles.modalStatValue}>{selectedWorkout.target_pace}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {selectedWorkout.completed && selectedWorkout.actual_data && (
                  <>
                    <Text style={styles.modalSectionTitle}>Dati Effettivi</Text>
                    <View style={styles.actualData}>
                      {selectedWorkout.actual_data.duration_minutes && (
                        <Text style={styles.actualDataText}>
                          Durata: {selectedWorkout.actual_data.duration_minutes} min
                        </Text>
                      )}
                      {selectedWorkout.actual_data.distance_km && (
                        <Text style={styles.actualDataText}>
                          Distanza: {selectedWorkout.actual_data.distance_km} km
                        </Text>
                      )}
                      {selectedWorkout.actual_data.avg_pace && (
                        <Text style={styles.actualDataText}>
                          Passo medio: {selectedWorkout.actual_data.avg_pace}
                        </Text>
                      )}
                      {selectedWorkout.actual_data.avg_heart_rate && (
                        <Text style={styles.actualDataText}>
                          FC media: {selectedWorkout.actual_data.avg_heart_rate} bpm
                        </Text>
                      )}
                      {selectedWorkout.actual_data.feeling && (
                        <Text style={styles.actualDataText}>
                          Sensazione: {selectedWorkout.actual_data.feeling}
                        </Text>
                      )}
                      {selectedWorkout.actual_data.notes && (
                        <Text style={styles.actualDataText}>
                          Note: {selectedWorkout.actual_data.notes}
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#FF6B35',
  },
  toggleText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFF',
  },
  athleteFilter: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  athleteChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  athleteChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  athleteChipText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  athleteChipTextActive: {
    color: '#FFF',
  },
  calendar: {
    marginHorizontal: 10,
  },
  selectedDateSection: {
    padding: 20,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  noWorkouts: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  workoutItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  workoutItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  workoutAthlete: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  weekView: {
    flexDirection: 'row',
    padding: 10,
  },
  weekDay: {
    flex: 1,
    marginHorizontal: 2,
  },
  weekDayHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  weekDayHeaderActive: {
    backgroundColor: '#FF6B35',
  },
  weekDayName: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 4,
  },
  weekDayNumberActive: {
    color: '#FFF',
  },
  weekDayWorkouts: {
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#999',
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
    maxHeight: '80%',
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
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalLabel: {
    fontSize: 14,
    color: '#999',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 22,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 20,
  },
  modalStat: {
    alignItems: 'center',
    backgroundColor: '#252525',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 4,
  },
  actualData: {
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 12,
  },
  actualDataText: {
    fontSize: 13,
    color: '#CCC',
    marginBottom: 6,
  },
});
