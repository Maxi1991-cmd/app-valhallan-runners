import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { programAPI } from '../../src/services/api';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutSession } from '../../src/types';
import { useTranslation } from '../../src/hooks/useTranslation';

// Helper function to format date in YYYY-MM-DD
const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calculate default date: today
const getDefaultStartDate = (): string => {
  return formatDateToISO(new Date());
};

// Calculate default end date: +4 weeks
const getDefaultEndDate = (): string => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 28); // 4 weeks
  return formatDateToISO(endDate);
};

export default function CreateOrEditProgram() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const isEditMode = !!id;
  
  const { athletes, fetchAthletes, createProgram, updateProgram } = useDataStore();
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: getDefaultStartDate(),
    end_date: getDefaultEndDate(),
    goal: '',
    athlete_id: '',
  });

  const [workouts, setWorkouts] = useState<Partial<WorkoutSession>[]>([]);

  const [newWorkout, setNewWorkout] = useState({
    day: 'Week 1 - Monday 08:00',
    date: getDefaultStartDate(),
    title: '',
    description: '',
    workout_type: 'easy',
    duration_minutes: '',
    distance_km: '',
    target_pace: '',
    heart_rate_zone: '',
    notes: '',
  });

  useEffect(() => {
    fetchAthletes();
    if (isEditMode) {
      loadProgram();
    }
  }, [id]);

  const loadProgram = async () => {
    try {
      const response = await programAPI.getOne(id!);
      const data = response.data;
      setForm({
        name: data.name,
        description: data.description || '',
        start_date: data.start_date,
        end_date: data.end_date,
        goal: data.goal || '',
        athlete_id: data.athlete_id || '',
      });
      setWorkouts(data.workouts || []);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare programma');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const workoutTypes = [
    { value: 'easy', label: 'Facile' },
    { value: 'tempo', label: 'Tempo Run' },
    { value: 'interval', label: 'Ripetute' },
    { value: 'long_run', label: 'Lungo' },
    { value: 'recovery', label: 'Recupero' },
    { value: 'fartlek', label: 'Fartlek' },
    { value: 'hill', label: 'Salite' },
    { value: 'race', label: 'Gara' },
  ];

  const addWorkout = () => {
    if (!newWorkout.date || !newWorkout.title || !newWorkout.description) {
      Alert.alert('Errore', 'Compila data, titolo e descrizione');
      return;
    }

    const workout: Partial<WorkoutSession> = {
      id: `temp-${Date.now()}`,
      day: newWorkout.day,
      date: newWorkout.date,
      title: newWorkout.title,
      description: newWorkout.description,
      workout_type: newWorkout.workout_type,
      duration_minutes: newWorkout.duration_minutes ? parseInt(newWorkout.duration_minutes) : undefined,
      distance_km: newWorkout.distance_km ? parseFloat(newWorkout.distance_km) : undefined,
      target_pace: newWorkout.target_pace || undefined,
      heart_rate_zone: newWorkout.heart_rate_zone || undefined,
      notes: newWorkout.notes || undefined,
      completed: false,
    };

    setWorkouts([...workouts, workout]);
    
    // Reset form per nuovo allenamento
    setNewWorkout({
      day: 'Settimana 1 - Lunedì 08:00',
      date: getDefaultStartDate(),
      title: '',
      description: '',
      workout_type: 'easy',
      duration_minutes: '',
      distance_km: '',
      target_pace: '',
      heart_rate_zone: '',
      notes: '',
    });
  };

  const removeWorkout = (index: number) => {
    setWorkouts(workouts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validazione
    if (!form.name || !form.start_date || !form.end_date) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    if (!isEditMode && !form.athlete_id) {
      Alert.alert('Errore', 'Seleziona un atleta');
      return;
    }

    if (workouts.length === 0) {
      Alert.alert('Errore', 'Aggiungi almeno un allenamento');
      return;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await updateProgram(id!, {
          ...form,
          workouts,
        });
        Alert.alert('Successo', 'Programma aggiornato');
      } else {
        await createProgram({
          ...form,
          workouts,
        });
        Alert.alert('Successo', 'Programma creato');
      }
      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Dettagli Programma</Text>

          <Input
            label="Nome Programma *"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Piano Maratona 12 Settimane"
          />

          {/* Mostra selezione atleta solo in modalità creazione */}
          {!isEditMode && (
            <>
              <Text style={styles.label}>Atleta *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.athleteScroll}>
                {athletes.map((athlete) => (
                  <TouchableOpacity
                    key={athlete.id}
                    style={[
                      styles.athleteChip,
                      form.athlete_id === athlete.id && styles.athleteChipActive,
                    ]}
                    onPress={() => setForm({ ...form, athlete_id: athlete.id })}
                  >
                    <Text
                      style={[
                        styles.athleteChipText,
                        form.athlete_id === athlete.id && styles.athleteChipTextActive,
                      ]}
                    >
                      {athlete.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <View style={styles.row}>
            <Input
              label="Data Inizio *"
              value={form.start_date}
              onChangeText={(text) => setForm({ ...form, start_date: text })}
              placeholder="GG-MM-AAAA"
              containerStyle={styles.halfInput}
            />
            <Input
              label="Data Fine *"
              value={form.end_date}
              onChangeText={(text) => setForm({ ...form, end_date: text })}
              placeholder="GG-MM-AAAA"
              containerStyle={styles.halfInput}
            />
          </View>

          <Input
            label="Obiettivo"
            value={form.goal}
            onChangeText={(text) => setForm({ ...form, goal: text })}
            placeholder="Completare maratona sotto le 4 ore"
          />

          <Input
            label="Descrizione"
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            placeholder="Descrizione del programma..."
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Allenamenti ({workouts.length})</Text>

          {workouts.map((workout, index) => (
            <Card key={workout.id || index} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View>
                  <Text style={styles.workoutDay}>{workout.date || workout.day}</Text>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                </View>
                <TouchableOpacity onPress={() => removeWorkout(index)}>
                  <Ionicons name="trash" size={20} color="#DC3545" />
                </TouchableOpacity>
              </View>
              <Text style={styles.workoutDesc}>{workout.description}</Text>
              <View style={styles.workoutMeta}>
                {workout.duration_minutes && (
                  <Text style={styles.metaText}>
                    <Ionicons name="time" size={12} color="#666" /> {workout.duration_minutes}min
                  </Text>
                )}
                {workout.distance_km && (
                  <Text style={styles.metaText}>
                    <Ionicons name="footsteps" size={12} color="#666" /> {workout.distance_km}km
                  </Text>
                )}
              </View>
              {workout.completed && (
                <Text style={styles.completedBadge}>✓ Completato</Text>
              )}
            </Card>
          ))}

          <Card title="Nuovo Allenamento" style={styles.newWorkoutCard}>
            <Input
              label="Data Allenamento (GG-MM-AAAA) *"
              value={newWorkout.date}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, date: text })}
              placeholder="27-01-2025"
            />

            <Input
              label="Settimana / Giorno / Ora"
              value={newWorkout.day}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, day: text })}
              placeholder="Settimana 1 - Lunedì 08:00"
            />

            <Input
              label="Titolo *"
              value={newWorkout.title}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, title: text })}
              placeholder="Corsa Facile"
            />

            <Text style={styles.label}>Tipo Allenamento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {workoutTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeChip,
                    newWorkout.workout_type === type.value && styles.typeChipActive,
                  ]}
                  onPress={() => setNewWorkout({ ...newWorkout, workout_type: type.value })}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      newWorkout.workout_type === type.value && styles.typeChipTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Descrizione *"
              value={newWorkout.description}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, description: text })}
              placeholder="30 min corsa facile zona 2..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.row}>
              <Input
                label="Durata (min)"
                value={newWorkout.duration_minutes}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, duration_minutes: text })}
                placeholder="45"
                keyboardType="numeric"
                containerStyle={styles.halfInput}
              />
              <Input
                label="Distanza (km)"
                value={newWorkout.distance_km}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, distance_km: text })}
                placeholder="8.0"
                keyboardType="decimal-pad"
                containerStyle={styles.halfInput}
              />
            </View>

            <Input
              label="Passo Target"
              value={newWorkout.target_pace}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, target_pace: text })}
              placeholder="5:30-6:00 min/km"
            />

            <Input
              label="Zona Cardiaca"
              value={newWorkout.heart_rate_zone}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, heart_rate_zone: text })}
              placeholder="Zona 2 (130-145 bpm)"
            />

            <Input
              label="Note"
              value={newWorkout.notes}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, notes: text })}
              placeholder="Note aggiuntive..."
            />

            <Button
              title="Aggiungi Allenamento"
              onPress={addWorkout}
              variant="secondary"
            />
          </Card>

          <Button
            title={isEditMode ? "Salva Modifiche" : "Crea Programma"}
            onPress={handleSubmit}
            loading={saving}
            size="large"
            style={styles.submitButton}
          />
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  athleteScroll: {
    marginBottom: 16,
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
  typeScroll: {
    marginBottom: 16,
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
  workoutCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  workoutDesc: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  completedBadge: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '600',
  },
  newWorkoutCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  submitButton: {
    marginBottom: 40,
  },
});
