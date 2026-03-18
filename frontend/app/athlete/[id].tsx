import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { athleteAPI, programAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AthleteProfile, WorkoutSession } from '../../src/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../../src/hooks/useTranslation';

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
  athlete_feedback?: any;
  actual_data?: any;
}

const safeFormatDate = (dateString?: string | null, format?: string, localeStr: string = 'it-IT') => {
  try {
    if (!dateString || dateString === '') return '--';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return '--';
    }
    
    if (format === 'short') {
      return date.toLocaleDateString(localeStr, { day: '2-digit', month: 'short' });
    } else if (format === 'long') {
      return date.toLocaleDateString(localeStr, { day: '2-digit', month: 'long', year: 'numeric' });
    }
    
    return date.toLocaleDateString(localeStr);
  } catch (e) {
    console.warn('Date format error:', dateString, e);
    return '--';
  }
};

// Helper function to safely check certificate dates
const safeCheckExpired = (dateString?: string | null): boolean => {
  try {
    if (!dateString || dateString === '') return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    return date < new Date();
  } catch (e) {
    return false;
  }
};

export default function AthleteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { deleteAthlete, programs, fetchPrograms, fetchAthletes } = useDataStore();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'payments' | 'certificate'>('info');
  const [allWorkouts, setAllWorkouts] = useState<(WorkoutSession & { programName: string })[]>([]);
  
  // State for standalone activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityForm, setActivityForm] = useState({
    date: '',
    activity_type: 'running',
    duration_minutes: '',
    distance_km: '',
    avg_pace: '',
    avg_heart_rate: '',
  });

  const loadActivities = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/activities?athlete_id=${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(response.data || []);
    } catch (error) {
      console.log('Errore caricamento attività:', error);
    }
  };

  const loadAthlete = async () => {
    try {
      const response = await athleteAPI.getOne(id!);
      setAthlete(response.data);
      
      // Carica i programmi e i workout dell'atleta
      await loadWorkouts();
      await loadActivities();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare atleta');
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkouts = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await programAPI.getAll(id!);
      const programsData = response.data;
      
      // Estrai tutti i workout da tutti i programmi
      const workouts: (WorkoutSession & { programName: string })[] = [];
      programsData.forEach((program: any) => {
        if (program.workouts && Array.isArray(program.workouts)) {
          program.workouts.forEach((workout: WorkoutSession) => {
            workouts.push({
              ...workout,
              programName: program.name,
            });
          });
        }
      });
      
      // Carica anche le attività standalone (fuori programma)
      try {
        const activitiesResponse = await axios.get(
          `${process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001'}/api/activities?athlete_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const activities = activitiesResponse.data || [];
        activities.forEach((activity: any) => {
          workouts.push({
            id: activity.id,
            date: activity.date,
            title: `${(activity.activity_type || 'Attività').charAt(0).toUpperCase() + (activity.activity_type || 'attività').slice(1)}`,
            description: `Durata: ${activity.duration_minutes || 0} min, Distanza: ${activity.distance_km || 0} km`,
            workout_type: activity.activity_type || 'other',
            duration_minutes: activity.duration_minutes,
            distance_km: activity.distance_km,
            completed: activity.completed || false,
            feedback_sent: activity.feedback_sent || false,
            athlete_feedback: activity.athlete_feedback,
            actual_data: activity.actual_data,
            programName: 'Fuori Programma',
          } as any);
        });
      } catch (err) {
        console.log('Errore caricamento attività:', err);
      }
      
      // Ordina per data (dal più recente al più vecchio)
      workouts.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
      
      setAllWorkouts(workouts);
    } catch (error) {
      console.log('Errore caricamento workout:', error);
    }
  };

  // Funzioni per gestire le attività
  const openEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    // Converti data da YYYY-MM-DD a DD-MM-YYYY per visualizzazione
    const dateParts = activity.date.split('-');
    const displayDate = dateParts.length === 3 && dateParts[0].length === 4
      ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
      : activity.date;
    
    setActivityForm({
      date: displayDate,
      activity_type: activity.activity_type || 'running',
      duration_minutes: activity.duration_minutes?.toString() || '',
      distance_km: activity.distance_km?.toString() || '',
      avg_pace: activity.avg_pace || '',
      avg_heart_rate: activity.avg_heart_rate?.toString() || '',
    });
    setShowActivityModal(true);
  };

  const saveActivity = async () => {
    if (!editingActivity) return;
    
    // Convert date from DD-MM-YYYY to YYYY-MM-DD
    let formattedDate = activityForm.date.trim();
    if (formattedDate.includes('-') && formattedDate.length === 10) {
      const parts = formattedDate.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/activities/${editingActivity.id}`,
        {
          date: formattedDate,
          activity_type: activityForm.activity_type,
          duration_minutes: parseInt(activityForm.duration_minutes) || 0,
          distance_km: parseFloat(activityForm.distance_km) || null,
          avg_pace: activityForm.avg_pace || null,
          avg_heart_rate: parseInt(activityForm.avg_heart_rate) || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert(t('common.success'), t('activity.activityFinalized'));
      setShowActivityModal(false);
      setEditingActivity(null);
      loadActivities();
      loadWorkouts();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.saveFailed'));
    }
  };

  const deleteActivity = (activity: Activity) => {
    Alert.alert(
      t('activity.deleteActivity'),
      `${t('activity.deleteConfirm')} ${safeFormatDate(activity.date)}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await axios.delete(`${BASE_URL}/api/activities/${activity.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              Alert.alert(t('common.success'), t('activity.activityDeleted'));
              loadActivities();
              loadWorkouts();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.deleteFailed'));
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    loadAthlete();
    fetchPrograms(id);
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAthlete();
    setRefreshing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      t('athlete.deleteAthlete'),
      t('athlete.deleteConfirm'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('athlete.yesDelete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAthlete(id!);
              // Refresh della lista atleti
              await fetchAthletes();
              Alert.alert(t('common.deleted'), t('athlete.athleteDeleted'));
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare atleta');
            }
          },
        },
      ]
    );
  };

  const handleTogglePayment = async (paymentId: string, currentPaid: boolean) => {
    try {
      await athleteAPI.updatePayment(id!, paymentId, !currentPaid);
      loadAthlete();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare pagamento');
    }
  };

  const handleDeletePayment = (paymentId: string, paymentMonth: string) => {
    Alert.alert(
      'Elimina Pagamento',
      `Sei sicuro di voler eliminare il pagamento di ${paymentMonth}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await axios.delete(
                `${BASE_URL}/api/athletes/${id}/payments/${paymentId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Successo', 'Pagamento eliminato');
              loadAthlete();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare il pagamento');
            }
          },
        },
      ]
    );
  };

  const athletePrograms = programs.filter((p) => p.athlete_id === id);

  if (loading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (!athlete) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back Button Header */}
      <View style={styles.backHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
      
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
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {athlete.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.athleteName}>{athlete.name}</Text>
          <Text style={styles.athleteEmail}>{athlete.email}</Text>
          {athlete.phone && (
            <Text style={styles.athletePhone}>
              <Ionicons name="call" size={12} color="#999" /> {athlete.phone}
            </Text>
          )}
          
          {/* Codice Accesso Atleta */}
          {(athlete as any).access_code && (
            <View style={styles.accessCodeContainer}>
              <Text style={styles.accessCodeLabel}>Codice Accesso Atleta:</Text>
              <Text style={styles.accessCode}>{(athlete as any).access_code}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Modifica"
            onPress={() => router.push(`/athlete/edit/${id}`)}
            variant="secondary"
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

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {(['info', 'history', 'payments', 'certificate'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'info' ? 'Info' : tab === 'history' ? 'Storico' : tab === 'payments' ? 'Pagamenti' : 'Certificato'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <>
            <Card title="Dati Biometrici" style={styles.card}>
              <View style={styles.biometricsGrid}>
                <View style={styles.biometricItem}>
                  <Ionicons name="heart" size={24} color="#FF6B35" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.heart_rate_max || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>FC Max (bpm)</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="heart-outline" size={24} color="#4CAF50" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.heart_rate_rest || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>FC Riposo</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="speedometer" size={24} color="#2196F3" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.vo2_max || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>VO2max</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="flash" size={24} color="#FF9800" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.lactate_threshold || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>Soglia Lattato</Text>
                </View>
              </View>
              <View style={styles.biometricsRow}>
                <View style={styles.biometricRowItem}>
                  <Text style={styles.rowLabel}>Peso:</Text>
                  <Text style={styles.rowValue}>
                    {athlete.biometrics?.weight ? `${athlete.biometrics.weight} kg` : '--'}
                  </Text>
                </View>
                <View style={styles.biometricRowItem}>
                  <Text style={styles.rowLabel}>Altezza:</Text>
                  <Text style={styles.rowValue}>
                    {athlete.biometrics?.height ? `${athlete.biometrics.height} cm` : '--'}
                  </Text>
                </View>
              </View>
            </Card>

            <Card title="Programmi Assegnati" style={styles.card}>
              {athletePrograms.length > 0 ? (
                athletePrograms.map((program) => (
                  <TouchableOpacity
                    key={program.id}
                    style={styles.programRow}
                    onPress={() => router.push(`/program/${program.id}`)}
                  >
                    <View>
                      <Text style={styles.programName}>{program.name}</Text>
                      <Text style={styles.programDates}>
                        {safeFormatDate(program.start_date, 'short')} - {safeFormatDate(program.end_date, 'long')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>Nessun programma assegnato</Text>
              )}
              <View style={styles.buttonsRow}>
                <Button
                  title="Nuovo Programma"
                  onPress={() => router.push('/program/create')}
                  variant="outline"
                  size="small"
                  style={styles.actionButtonSmall}
                />
              </View>
            </Card>

            {/* Attività Assegnate (Fuori Programma) */}
            <Card title="Attività Assegnate" style={styles.card}>
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <View key={activity.id} style={styles.activityRow}>
                    <TouchableOpacity 
                      style={styles.activityInfo}
                      onPress={() => router.push(`/activity/${activity.id}`)}
                    >
                      <View style={styles.activityDateBadge}>
                        <Text style={styles.activityDateText}>
                          {safeFormatDate(activity.date, 'short')}
                        </Text>
                      </View>
                      <View style={styles.activityDetails}>
                        <Text style={styles.activityType}>
                          {(activity.activity_type || 'Attività').charAt(0).toUpperCase() + (activity.activity_type || 'attività').slice(1)}
                        </Text>
                        <Text style={styles.activityMeta}>
                          {activity.duration_minutes ? `${activity.duration_minutes} min` : ''}
                          {activity.duration_minutes && activity.distance_km ? ' • ' : ''}
                          {activity.distance_km ? `${activity.distance_km} km` : ''}
                        </Text>
                        {activity.feedback_sent && (
                          <View style={styles.feedbackBadge}>
                            <Ionicons name="chatbubble" size={12} color="#4CAF50" />
                            <Text style={styles.feedbackBadgeText}>Feedback ricevuto</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.activityActions}>
                      <TouchableOpacity 
                        style={styles.activityActionBtn}
                        onPress={() => openEditActivity(activity)}
                      >
                        <Ionicons name="pencil" size={18} color="#FF6B35" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.activityActionBtn}
                        onPress={() => deleteActivity(activity)}
                      >
                        <Ionicons name="trash" size={18} color="#DC3545" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Nessuna attività assegnata</Text>
              )}
              <Button
                title="Nuova Attività"
                onPress={() => router.push(`/activity/upload?athleteId=${id}`)}
                variant="secondary"
                size="small"
                style={styles.actionButtonSmall}
              />
            </Card>

            {athlete.notes && (
              <Card title="Note" style={styles.card}>
                <Text style={styles.notesText}>{athlete.notes}</Text>
              </Card>
            )}
          </>
        )}

        {/* History Tab - Storico Allenamenti */}
        {activeTab === 'history' && (
          <Card title="Storico Allenamenti" style={styles.card}>
            {allWorkouts.length > 0 ? (
              allWorkouts.map((workout, index) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const workoutDate = workout.date ? new Date(workout.date) : null;
                const isPast = workoutDate ? workoutDate < today : false;
                
                return (
                  <View key={workout.id || index} style={styles.workoutRow}>
                    <View style={styles.workoutLeft}>
                      <View style={styles.workoutDateBadge}>
                        <Text style={styles.workoutDateText}>
                          {safeFormatDate(workout.date, 'short')}
                        </Text>
                      </View>
                      <View style={styles.workoutInfo}>
                        <Text style={styles.workoutTitle}>{workout.title}</Text>
                        <Text style={styles.workoutProgram}>{workout.programName}</Text>
                        <View style={styles.workoutMeta}>
                          {workout.duration_minutes && (
                            <Text style={styles.workoutMetaText}>
                              <Ionicons name="time-outline" size={12} color="#999" /> {workout.duration_minutes} min
                            </Text>
                          )}
                          {workout.distance_km && (
                            <Text style={styles.workoutMetaText}>
                              <Ionicons name="navigate-outline" size={12} color="#999" /> {workout.distance_km} km
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.workoutRight}>
                      {workout.completed ? (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                          <Text style={styles.completedText}>Fatto</Text>
                        </View>
                      ) : isPast ? (
                        <View style={styles.missedBadge}>
                          <Ionicons name="close-circle" size={20} color="#DC3545" />
                          <Text style={styles.missedText}>Saltato</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time" size={20} color="#FF9800" />
                          <Text style={styles.pendingText}>In arrivo</Text>
                        </View>
                      )}
                      {workout.actual_data?.fatigue_level && (
                        <Text style={styles.fatigueText}>
                          Fatica: {workout.actual_data.fatigue_level}/10
                        </Text>
                      )}
                      {workout.modified_by_athlete && (
                        <Text style={styles.modifiedText}>Modificato</Text>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Nessun allenamento programmato</Text>
            )}
          </Card>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <Card title="Pagamenti Mensili" style={styles.card}>
            {athlete.payments && athlete.payments.length > 0 ? (
              athlete.payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <TouchableOpacity
                    style={styles.paymentInfo}
                    onPress={() => handleTogglePayment(payment.id, payment.paid)}
                    data-testid={`toggle-payment-${payment.id}`}
                  >
                    <Ionicons
                      name={payment.paid ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={payment.paid ? '#4CAF50' : '#666'}
                    />
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentMonth}>{payment.month}</Text>
                      <Text style={styles.paymentDue}>Scadenza: {payment.due_date}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.paymentRight}>
                    <View style={styles.paymentAmount}>
                      <Text
                        style={[
                          styles.amountText,
                          payment.paid && styles.amountPaid,
                        ]}
                      >
                        €{payment.amount}
                      </Text>
                      {payment.paid && (
                        <Text style={styles.paidDate}>Pagato: {payment.paid_date}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deletePaymentBtn}
                      onPress={() => handleDeletePayment(payment.id, payment.month)}
                      data-testid={`delete-payment-${payment.id}`}
                    >
                      <Ionicons name="trash-outline" size={20} color="#DC3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
            )}
          </Card>
        )}

        {/* Certificate Tab */}
        {activeTab === 'certificate' && (
          <Card title="Certificato Medico Sportivo" style={styles.card}>
            <View style={styles.certificateInfo}>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Data Rilascio:</Text>
                <Text style={styles.certValue}>
                  {safeFormatDate(athlete.medical_certificate?.issue_date) !== '--' 
                    ? safeFormatDate(athlete.medical_certificate?.issue_date, 'long')
                    : 'Non inserito'}
                </Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Data Scadenza:</Text>
                <Text
                  style={[
                    styles.certValue,
                    safeCheckExpired(athlete.medical_certificate?.expiry_date) && styles.expiredText,
                  ]}
                >
                  {safeFormatDate(athlete.medical_certificate?.expiry_date) !== '--'
                    ? safeFormatDate(athlete.medical_certificate?.expiry_date, 'long')
                    : 'Non inserito'}
                </Text>
              </View>
              {athlete.medical_certificate?.expiry_date && safeFormatDate(athlete.medical_certificate?.expiry_date) !== '--' && (
                <View
                  style={[
                    styles.statusBadge,
                    safeCheckExpired(athlete.medical_certificate.expiry_date)
                      ? styles.expiredBadge
                      : styles.validBadge,
                  ]}
                >
                  <Ionicons
                    name={
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? 'close-circle'
                        : 'checkmark-circle'
                    }
                    size={16}
                    color={
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? '#DC3545'
                        : '#4CAF50'
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? styles.expiredStatusText
                        : styles.validStatusText,
                    ]}
                  >
                    {safeCheckExpired(athlete.medical_certificate.expiry_date)
                      ? 'Scaduto'
                      : 'Valido'}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Modal Modifica Attività */}
      <Modal visible={showActivityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifica Attività</Text>
              <TouchableOpacity onPress={() => { setShowActivityModal(false); setEditingActivity(null); }}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Data (GG-MM-AAAA)</Text>
              <TextInput
                style={styles.input}
                value={activityForm.date}
                onChangeText={(text) => setActivityForm({...activityForm, date: text})}
                placeholder="GG-MM-AAAA"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Tipo Attività</Text>
              <View style={styles.typeSelector}>
                {['running', 'cycling', 'swimming', 'strength', 'other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      activityForm.activity_type === type && styles.typeChipActive
                    ]}
                    onPress={() => setActivityForm({...activityForm, activity_type: type})}
                  >
                    <Text style={[
                      styles.typeChipText,
                      activityForm.activity_type === type && styles.typeChipTextActive
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Durata (minuti)</Text>
              <TextInput
                style={styles.input}
                value={activityForm.duration_minutes}
                onChangeText={(text) => setActivityForm({...activityForm, duration_minutes: text})}
                placeholder="Es: 45"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Distanza (km)</Text>
              <TextInput
                style={styles.input}
                value={activityForm.distance_km}
                onChangeText={(text) => setActivityForm({...activityForm, distance_km: text})}
                placeholder="Es: 10.5"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Passo Medio</Text>
              <TextInput
                style={styles.input}
                value={activityForm.avg_pace}
                onChangeText={(text) => setActivityForm({...activityForm, avg_pace: text})}
                placeholder="Es: 5:30 min/km"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>FC Media (bpm)</Text>
              <TextInput
                style={styles.input}
                value={activityForm.avg_heart_rate}
                onChangeText={(text) => setActivityForm({...activityForm, avg_heart_rate: text})}
                placeholder="Es: 145"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Button title="Salva Modifiche" onPress={saveActivity} style={styles.saveBtn} />
            </ScrollView>
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
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 10,
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  athleteName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  athleteEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  athletePhone: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    minWidth: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFF',
  },
  card: {
    marginBottom: 16,
  },
  biometricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  biometricItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  biometricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  biometricLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  biometricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  biometricRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: '#999',
    fontSize: 14,
  },
  rowValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  programRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  programName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  programDates: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButtonSmall: {
    flex: 1,
  },
  newProgramButton: {
    marginTop: 12,
  },
  notesText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 22,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentDetails: {
  },
  paymentMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  paymentDue: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paymentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deletePaymentBtn: {
    padding: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
    borderRadius: 8,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  amountPaid: {
    color: '#4CAF50',
  },
  paidDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  certificateInfo: {
    gap: 16,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  certLabel: {
    fontSize: 14,
    color: '#999',
  },
  certValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  expiredText: {
    color: '#DC3545',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  validBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  expiredBadge: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  validStatusText: {
    color: '#4CAF50',
  },
  expiredStatusText: {
    color: '#DC3545',
  },
  accessCodeContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  accessCodeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  accessCode: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 4,
  },
  // Storico Allenamenti styles
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  workoutLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  workoutDateBadge: {
    backgroundColor: '#252525',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 55,
    alignItems: 'center',
  },
  workoutDateText: {
    color: '#FF6B35',
    fontSize: 11,
    fontWeight: '600',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  workoutProgram: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  workoutMetaText: {
    fontSize: 12,
    color: '#666',
  },
  workoutRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  missedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  missedText: {
    color: '#DC3545',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: '600',
  },
  fatigueText: {
    fontSize: 11,
    color: '#999',
  },
  modifiedText: {
    fontSize: 10,
    color: '#FF6B35',
    fontStyle: 'italic',
  },
  // Stili per le attività
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  activityInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDateBadge: {
    backgroundColor: '#252525',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  activityDateText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  activityDetails: {
    flex: 1,
  },
  activityType: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityMeta: {
    color: '#999',
    fontSize: 12,
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  feedbackBadgeText: {
    color: '#4CAF50',
    fontSize: 11,
  },
  activityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activityActionBtn: {
    padding: 8,
    backgroundColor: '#252525',
    borderRadius: 8,
  },
  // Stili modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  modalScroll: {
    padding: 20,
  },
  inputLabel: {
    color: '#999',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#252525',
    borderRadius: 10,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#252525',
    borderRadius: 20,
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
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 24,
    marginBottom: 30,
  },
});
