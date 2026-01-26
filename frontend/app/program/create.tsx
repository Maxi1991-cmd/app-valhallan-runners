import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutSession } from '../../src/types';

// Funzione helper per formattare data in YYYY-MM-DD
const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Calcola data default: oggi
const getDefaultStartDate = (): string => {
  return formatDateToISO(new Date());
};

// Calcola data fine default: +4 settimane
const getDefaultEndDate = (): string => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 28); // 4 settimane
  return formatDateToISO(endDate);
};

export default function CreateProgram() {
  const router = useRouter();
  const { athletes, fetchAthletes, createProgram } = useDataStore();
  const [loading, setLoading] = useState(false);

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
    day: 'Settimana 1 - Lunedì 08:00',
    date: getDefaultStartDate(), // Data reale per il calendario
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
  }, []);

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
    if (!newWorkout.day || !newWorkout.title || !newWorkout.description) {
      Alert.alert('Errore', 'Compila giorno, titolo e descrizione');
      return;
    }

    setWorkouts([...workouts, {
      ...newWorkout,
      duration_minutes: newWorkout.duration_minutes ? parseInt(newWorkout.duration_minutes) : undefined,
      distance_km: newWorkout.distance_km ? parseFloat(newWorkout.distance_km) : undefined,
      completed: false,
    }]);

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

  const handleCreate = async () => {
    if (!form.name || !form.athlete_id || !form.start_date || !form.end_date) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }

    if (workouts.length === 0) {
      Alert.alert('Errore', 'Aggiungi almeno un allenamento');
      return;
    }

    setLoading(true);
    try {
      await createProgram({
        ...form,
        workouts,
      });
      Alert.alert('Successo', 'Programma creato');
      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
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
          <Text style={styles.sectionTitle}>Dettagli Programma</Text>

          <Input
            label="Nome Programma *"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Piano Maratona 12 Settimane"
          />

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

          <View style={styles.row}>
            <Input
              label="Data Inizio *"
              value={form.start_date}
              onChangeText={(text) => setForm({ ...form, start_date: text })}
              placeholder="YYYY-MM-DD"
              containerStyle={styles.halfInput}
            />
            <Input
              label="Data Fine *"
              value={form.end_date}
              onChangeText={(text) => setForm({ ...form, end_date: text })}
              placeholder="YYYY-MM-DD"
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
            <Card key={index} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View>
                  <Text style={styles.workoutDay}>{workout.day}</Text>
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
            </Card>
          ))}

          <Card title="Nuovo Allenamento" style={styles.newWorkoutCard}>
            <Input
              label="Giorno/Data *"
              value={newWorkout.day}
              onChangeText={(text) => setNewWorkout({ ...newWorkout, day: text })}
              placeholder="Lunedì / 2024-01-15"
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
            title="Crea Programma"
            onPress={handleCreate}
            loading={loading}
            size="large"
            style={styles.createButton}
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
  newWorkoutCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  createButton: {
    marginBottom: 40,
  },
});
