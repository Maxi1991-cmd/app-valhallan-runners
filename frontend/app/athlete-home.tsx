import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
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
  actual_data?: any;
  modified_by_athlete?: boolean;
}

interface Program {
  id: string;
  name: string;
  workouts: Workout[];
}

interface AthleteProfile {
  id: string;
  name: string;
  email: string;
  payments: Payment[];
  medical_certificate: {
    issue_date?: string;
    expiry_date?: string;
  };
}

interface Payment {
  id: string;
  month: string;
  amount: number;
  paid: boolean;
  due_date: string;
}

export default function AthleteHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month' | 'history' | 'info'>('today');
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<{workout: Workout & {programId: string, programName: string}} | null>(null);
  
  // Form states
  const [fatigue, setFatigue] = useState(5);
  const [hasPain, setHasPain] = useState(false);
  const [painLocation, setPainLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [skipReason, setSkipReason] = useState('');
  
  // Edit form states
  const [editDuration, setEditDuration] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editFatigue, setEditFatigue] = useState(5);
  const [editNotes, setEditNotes] = useState('');

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Fetch programs
      const programsResponse = await axios.get(`${BASE_URL}/api/programs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrograms(programsResponse.data);
      
      // Fetch athlete profile (pagamenti e certificato)
      try {
        const profileResponse = await axios.get(`${BASE_URL}/api/athlete/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAthleteProfile(profileResponse.data);
      } catch (e) {
        // Profile endpoint might not exist for athlete view
        console.log('Could not fetch athlete profile');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
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

  // Date helpers
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('it-IT', { weekday: 'long' });

  // Get all workouts with program info
  const allWorkouts = programs.flatMap(p => 
    p.workouts.map(w => ({ ...w, programId: p.id, programName: p.name }))
  );

  // Filter workouts by period
  const getWeekWorkouts = () => {
    const now = new Date();
    // Calcola l'inizio della settimana (Lunedì)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Domenica = -6, altri = 1 - giorno
    
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() + diffToMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return allWorkouts.filter(w => {
      if (!w.date) return false;
      const workoutDate = new Date(w.date);
      workoutDate.setHours(12, 0, 0, 0); // Normalizza per evitare problemi di timezone
      return workoutDate >= startOfWeek && workoutDate <= endOfWeek;
    }).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  };

  const getMonthWorkouts = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return allWorkouts.filter(w => {
      if (!w.date) return false;
      const workoutDate = new Date(w.date);
      return workoutDate >= startOfMonth && workoutDate <= endOfMonth;
    }).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  };

  const getTodayWorkouts = () => {
    return allWorkouts.filter(w => w.date === today && !w.completed);
  };

  // Storico: tutti gli allenamenti passati (ordinati dal più recente)
  const getHistoryWorkouts = () => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    return allWorkouts.filter(w => {
      if (!w.date) return false;
      const workoutDate = new Date(w.date);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate < todayDate;
    }).sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  };

  // Open modals
  const openCompleteModal = (workout: any) => {
    setSelectedWorkout({ workout });
    setFatigue(5);
    setHasPain(false);
    setPainLocation('');
    setNotes('');
    setShowCompleteModal(true);
  };

  const openSkipModal = (workout: any) => {
    setSelectedWorkout({ workout });
    setSkipReason('');
    setShowSkipModal(true);
  };

  const openViewModal = (workout: any) => {
    setSelectedWorkout({ workout });
    setShowViewModal(true);
  };

  const openEditModal = (workout: any) => {
    if (workout.modified_by_athlete) {
      Alert.alert('Non modificabile', 'Hai già modificato questo allenamento. La modifica è consentita una sola volta.');
      return;
    }
    setSelectedWorkout({ workout });
    setEditDuration(workout.actual_data?.duration_minutes?.toString() || workout.duration_minutes?.toString() || '');
    setEditDistance(workout.actual_data?.distance_km?.toString() || workout.distance_km?.toString() || '');
    setEditFatigue(workout.actual_data?.fatigue_level || 5);
    setEditNotes(workout.actual_data?.notes || '');
    setShowEditModal(true);
  };

  // Submit handlers
  const submitCompleteWorkout = async () => {
    if (!selectedWorkout) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/programs/${selectedWorkout.workout.programId}/workouts/${selectedWorkout.workout.id}/complete`,
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
        `${BASE_URL}/api/programs/${selectedWorkout.workout.programId}/workouts/${selectedWorkout.workout.id}/complete`,
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

  const submitEditWorkout = async () => {
    if (!selectedWorkout) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/programs/${selectedWorkout.workout.programId}/workouts/${selectedWorkout.workout.id}/edit`,
        {
          duration_minutes: editDuration ? parseInt(editDuration) : null,
          distance_km: editDistance ? parseFloat(editDistance) : null,
          fatigue_level: editFatigue,
          notes: editNotes,
          modified_by_athlete: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      Alert.alert('Successo', 'Allenamento modificato! Il coach è stato notificato.');
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore nella modifica');
    }
  };

  // Helpers
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isDateExpired = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      return new Date(dateStr) < new Date();
    } catch {
      return false;
    }
  };

  const getDaysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const diff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diff;
    } catch {
      return null;
    }
  };

  // Render workout card
  const renderWorkoutCard = (workout: any, showActions = true) => {
    const workoutDate = workout.date ? new Date(workout.date) : null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const isPast = workoutDate ? workoutDate < todayDate : false;
    const isToday = workout.date === today;
    
    return (
      <Card key={workout.id} style={[styles.workoutCard, workout.completed && styles.completedCard]}>
        <TouchableOpacity 
          onPress={() => workout.completed ? openViewModal(workout) : null}
          disabled={!workout.completed}
        >
          <View style={styles.workoutHeader}>
            <View style={[styles.typeBadge, { backgroundColor: `${getWorkoutTypeColor(workout.workout_type)}20` }]}>
              <Text style={[styles.typeText, { color: getWorkoutTypeColor(workout.workout_type) }]}>
                {getWorkoutTypeLabel(workout.workout_type)}
              </Text>
            </View>
            <Text style={styles.workoutDate}>
              {workout.date ? new Date(workout.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : workout.day}
            </Text>
            {workout.completed && (
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            )}
          </View>
          
          <Text style={styles.workoutTitle}>{workout.title}</Text>
          <Text style={styles.workoutDescription} numberOfLines={2}>{workout.description}</Text>
          
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
          </View>
        </TouchableOpacity>

        {/* Actions for today's workouts */}
        {showActions && isToday && !workout.completed && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn]}
              onPress={() => openCompleteModal(workout)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Completato</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionBtn, styles.skipBtn]}
              onPress={() => openSkipModal(workout)}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Non eseguito</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit button for PAST workouts (both completed and not completed) that haven't been modified */}
        {isPast && !workout.modified_by_athlete && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(workout)}
          >
            <Ionicons name="pencil" size={16} color="#FF6B35" />
            <Text style={styles.editButtonText}>Modifica dati</Text>
          </TouchableOpacity>
        )}

        {workout.modified_by_athlete && (
          <View style={styles.modifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#4CAF50" />
            <Text style={styles.modifiedText}>Modificato</Text>
          </View>
        )}
      </Card>
    );
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'today':
        const todayWorkouts = getTodayWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>🏃 Allenamento di Oggi</Text>
            {todayWorkouts.length === 0 ? (
              <Card style={styles.restDayCard}>
                <Ionicons name="bed" size={48} color="#4CAF50" />
                <Text style={styles.restDayText}>Giorno di riposo</Text>
                <Text style={styles.restDaySubtext}>Nessun allenamento programmato</Text>
              </Card>
            ) : (
              todayWorkouts.map(w => renderWorkoutCard(w, true))
            )}
          </View>
        );

      case 'week':
        const weekWorkouts = getWeekWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>📅 Allenamenti Settimanali</Text>
            {weekWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>Nessun allenamento questa settimana</Text>
            ) : (
              weekWorkouts.map(w => renderWorkoutCard(w, false))
            )}
          </View>
        );

      case 'month':
        const monthWorkouts = getMonthWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>📆 Allenamenti Mensili</Text>
            {monthWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>Nessun allenamento questo mese</Text>
            ) : (
              monthWorkouts.map(w => renderWorkoutCard(w, false))
            )}
          </View>
        );

      case 'history':
        const historyWorkouts = getHistoryWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>📚 Storico Allenamenti</Text>
            {historyWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>Nessun allenamento passato</Text>
            ) : (
              historyWorkouts.map(w => (
                <Card key={w.id} style={[styles.workoutCard, w.completed && styles.completedCard]}>
                  <View style={styles.workoutHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: `${getWorkoutTypeColor(w.workout_type)}20` }]}>
                      <Text style={[styles.typeText, { color: getWorkoutTypeColor(w.workout_type) }]}>
                        {getWorkoutTypeLabel(w.workout_type)}
                      </Text>
                    </View>
                    <Text style={styles.workoutDate}>
                      {w.date ? new Date(w.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : w.day}
                    </Text>
                    {w.completed && (
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    )}
                  </View>
                  
                  <Text style={styles.workoutTitle}>{w.title}</Text>
                  <Text style={styles.workoutDescription} numberOfLines={2}>{w.description}</Text>
                  
                  <View style={styles.workoutMeta}>
                    {w.duration_minutes && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color="#999" />
                        <Text style={styles.metaText}>{w.duration_minutes} min</Text>
                      </View>
                    )}
                    {w.distance_km && (
                      <View style={styles.metaItem}>
                        <Ionicons name="navigate-outline" size={14} color="#999" />
                        <Text style={styles.metaText}>{w.distance_km} km</Text>
                      </View>
                    )}
                  </View>

                  {/* Dati registrati se completato */}
                  {w.completed && w.actual_data && (
                    <View style={styles.actualDataContainer}>
                      <Text style={styles.actualDataTitle}>Dati registrati:</Text>
                      <View style={styles.actualDataRow}>
                        {w.actual_data.duration_minutes && (
                          <Text style={styles.actualDataText}>
                            Durata: {w.actual_data.duration_minutes} min
                          </Text>
                        )}
                        {w.actual_data.fatigue_level && (
                          <Text style={styles.actualDataText}>
                            Fatica: {w.actual_data.fatigue_level}/10
                          </Text>
                        )}
                      </View>
                      {w.actual_data.notes && (
                        <Text style={styles.actualDataNotes}>"{w.actual_data.notes}"</Text>
                      )}
                    </View>
                  )}

                  {/* Stato e azione modifica */}
                  <View style={styles.historyActionRow}>
                    <View style={[
                      styles.statusPill,
                      w.completed ? styles.statusCompleted : styles.statusMissed
                    ]}>
                      <Ionicons 
                        name={w.completed ? "checkmark-circle" : "close-circle"} 
                        size={14} 
                        color={w.completed ? "#4CAF50" : "#DC3545"} 
                      />
                      <Text style={[
                        styles.statusPillText,
                        w.completed ? styles.statusCompletedText : styles.statusMissedText
                      ]}>
                        {w.completed ? "Completato" : "Non eseguito"}
                      </Text>
                    </View>

                    {/* Pulsante modifica (solo se non già modificato) */}
                    {!w.modified_by_athlete ? (
                      <TouchableOpacity
                        style={styles.historyEditBtn}
                        onPress={() => openEditModal(w)}
                      >
                        <Ionicons name="pencil" size={16} color="#FF6B35" />
                        <Text style={styles.historyEditText}>Modifica</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.alreadyModifiedBadge}>
                        <Ionicons name="checkmark" size={12} color="#4CAF50" />
                        <Text style={styles.alreadyModifiedText}>Già modificato</Text>
                      </View>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        );

      case 'info':
        return (
          <View>
            {/* Certificato Medico */}
            <Text style={styles.sectionTitle}>🏥 Certificato Medico</Text>
            <Card style={styles.infoCard}>
              {athleteProfile?.medical_certificate?.expiry_date ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Scadenza:</Text>
                    <Text style={[
                      styles.infoValue,
                      isDateExpired(athleteProfile.medical_certificate.expiry_date) && styles.expiredText
                    ]}>
                      {formatDate(athleteProfile.medical_certificate.expiry_date)}
                    </Text>
                  </View>
                  {(() => {
                    const days = getDaysUntil(athleteProfile.medical_certificate.expiry_date);
                    if (days !== null) {
                      if (days < 0) {
                        return (
                          <View style={[styles.statusBanner, styles.expiredBanner]}>
                            <Ionicons name="warning" size={18} color="#DC3545" />
                            <Text style={styles.expiredBannerText}>Scaduto da {Math.abs(days)} giorni</Text>
                          </View>
                        );
                      } else if (days <= 30) {
                        return (
                          <View style={[styles.statusBanner, styles.warningBanner]}>
                            <Ionicons name="alert-circle" size={18} color="#FF9800" />
                            <Text style={styles.warningBannerText}>Scade tra {days} giorni</Text>
                          </View>
                        );
                      } else {
                        return (
                          <View style={[styles.statusBanner, styles.validBanner]}>
                            <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                            <Text style={styles.validBannerText}>Valido</Text>
                          </View>
                        );
                      }
                    }
                    return null;
                  })()}
                </>
              ) : (
                <Text style={styles.emptyText}>Nessun certificato registrato</Text>
              )}
            </Card>

            {/* Pagamenti */}
            <Text style={styles.sectionTitle}>💳 Pagamenti</Text>
            <Card style={styles.infoCard}>
              {athleteProfile?.payments && athleteProfile.payments.length > 0 ? (
                athleteProfile.payments.map((payment) => (
                  <View key={payment.id} style={[styles.paymentRow, !payment.paid && styles.unpaidRow]}>
                    <View>
                      <Text style={styles.paymentMonth}>{payment.month}</Text>
                      <Text style={styles.paymentDue}>Scadenza: {formatDate(payment.due_date)}</Text>
                    </View>
                    <View style={styles.paymentRight}>
                      <Text style={styles.paymentAmount}>€{payment.amount}</Text>
                      <View style={[styles.paymentStatus, payment.paid ? styles.paidStatus : styles.unpaidStatus]}>
                        <Text style={[styles.paymentStatusText, payment.paid ? styles.paidText : styles.unpaidText]}>
                          {payment.paid ? 'Pagato' : 'Da pagare'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
              )}
            </Card>
          </View>
        );
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
            <Text style={styles.dateText}>
              {dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, {new Date().toLocaleDateString('it-IT')}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {[
            { key: 'today', label: 'Oggi', icon: 'today' },
            { key: 'week', label: 'Settimana', icon: 'calendar' },
            { key: 'month', label: 'Mese', icon: 'calendar-outline' },
            { key: 'history', label: 'Storico', icon: 'time' },
            { key: 'info', label: 'Info', icon: 'information-circle' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={16} 
                color={activeTab === tab.key ? '#FF6B35' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {renderTabContent()}
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
                  placeholder="Es: ginocchio destro..."
                  placeholderTextColor="#666"
                />
              </>
            )}

            <Button title="Termina" onPress={submitCompleteWorkout} style={styles.submitBtn} />
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

            <Button title="Invia" onPress={submitSkipWorkout} variant="danger" style={styles.submitBtn} />
          </View>
        </View>
      </Modal>

      {/* View Workout Modal */}
      <Modal visible={showViewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dettagli Allenamento</Text>
              <TouchableOpacity onPress={() => setShowViewModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedWorkout && (
              <>
                <Text style={styles.viewTitle}>{selectedWorkout.workout.title}</Text>
                <Text style={styles.viewDescription}>{selectedWorkout.workout.description}</Text>
                
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>Dati Registrati</Text>
                  {selectedWorkout.workout.actual_data && (
                    <>
                      {selectedWorkout.workout.actual_data.duration_minutes && (
                        <Text style={styles.viewData}>Durata: {selectedWorkout.workout.actual_data.duration_minutes} min</Text>
                      )}
                      {selectedWorkout.workout.actual_data.distance_km && (
                        <Text style={styles.viewData}>Distanza: {selectedWorkout.workout.actual_data.distance_km} km</Text>
                      )}
                      {selectedWorkout.workout.actual_data.fatigue_level && (
                        <Text style={styles.viewData}>Fatica: {selectedWorkout.workout.actual_data.fatigue_level}/10</Text>
                      )}
                      {selectedWorkout.workout.actual_data.notes && (
                        <Text style={styles.viewData}>Note: {selectedWorkout.workout.actual_data.notes}</Text>
                      )}
                    </>
                  )}
                </View>

                {!selectedWorkout.workout.modified_by_athlete && (
                  <Button 
                    title="Modifica Dati" 
                    onPress={() => {
                      setShowViewModal(false);
                      openEditModal(selectedWorkout.workout);
                    }} 
                    variant="outline"
                    style={styles.submitBtn} 
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Workout Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.editModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modifica Allenamento</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.editModalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={18} color="#FF9800" />
                  <Text style={styles.warningText}>Puoi modificare una sola volta</Text>
                </View>

                <Text style={styles.inputLabel}>Durata (minuti)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.textInput, styles.inputWithButton]}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    placeholder="45"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <TouchableOpacity 
                    style={styles.confirmInputBtn}
                    onPress={() => Keyboard.dismiss()}
                  >
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Distanza (km)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.textInput, styles.inputWithButton]}
                    value={editDistance}
                    onChangeText={setEditDistance}
                    placeholder="10.5"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <TouchableOpacity 
                    style={styles.confirmInputBtn}
                    onPress={() => Keyboard.dismiss()}
                  >
                    <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Livello di Fatica (1-10)</Text>
                <View style={styles.fatigueContainer}>
                  {[1,2,3,4,5,6,7,8,9,10].map(num => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.fatigueBtn, editFatigue === num && styles.fatigueBtnActive]}
                      onPress={() => setEditFatigue(num)}
                    >
                      <Text style={[styles.fatigueBtnText, editFatigue === num && styles.fatigueBtnTextActive]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Note</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Note aggiuntive..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />

                <Button title="Salva Modifiche" onPress={submitEditWorkout} style={styles.editSubmitBtn} />
                
                <View style={styles.bottomSpacer} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#252525',
  },
  tabText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF6B35',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  workoutCard: {
    marginBottom: 12,
  },
  completedCard: {
    borderColor: '#4CAF50',
    borderWidth: 1,
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
    fontSize: 11,
    fontWeight: '600',
  },
  workoutDate: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 13,
    color: '#CCC',
    lineHeight: 18,
    marginBottom: 8,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: 16,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
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
    fontSize: 13,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  editButtonText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '500',
  },
  modifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  modifiedText: {
    color: '#4CAF50',
    fontSize: 11,
  },
  restDayCard: {
    alignItems: 'center',
    padding: 30,
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
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#999',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  expiredText: {
    color: '#DC3545',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  expiredBanner: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
  },
  warningBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  validBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  expiredBannerText: {
    color: '#DC3545',
    fontWeight: '600',
  },
  warningBannerText: {
    color: '#FF9800',
    fontWeight: '600',
  },
  validBannerText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  unpaidRow: {
    backgroundColor: 'rgba(220, 53, 69, 0.05)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  paymentMonth: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  paymentDue: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  paidStatus: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  unpaidStatus: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paidText: {
    color: '#4CAF50',
  },
  unpaidText: {
    color: '#DC3545',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
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
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 12,
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    padding: 12,
    borderRadius: 8,
  },
  warningText: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: '500',
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  viewDescription: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginBottom: 16,
  },
  viewSection: {
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  viewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 10,
  },
  viewData: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 6,
  },
  // Edit modal specific styles
  editModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 0,
    maxHeight: '90%',
    marginTop: 'auto',
  },
  editModalScroll: {
    flexGrow: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWithButton: {
    flex: 1,
  },
  confirmInputBtn: {
    padding: 4,
  },
  editSubmitBtn: {
    marginTop: 24,
    marginBottom: 10,
  },
  bottomSpacer: {
    height: 40,
  },
  // Storico styles
  actualDataContainer: {
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  actualDataTitle: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 6,
  },
  actualDataRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actualDataText: {
    fontSize: 13,
    color: '#CCC',
  },
  actualDataNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 6,
  },
  historyActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  statusMissed: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusCompletedText: {
    color: '#4CAF50',
  },
  statusMissedText: {
    color: '#DC3545',
  },
  historyEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderRadius: 8,
  },
  historyEditText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '600',
  },
  alreadyModifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alreadyModifiedText: {
    color: '#4CAF50',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
