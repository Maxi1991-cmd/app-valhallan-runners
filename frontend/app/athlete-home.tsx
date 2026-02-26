import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Switch, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../src/hooks/useTranslation';

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
  const { t, i18n, changeLanguage } = useTranslation();
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<{workout: Workout & {programId: string, programName: string}} | null>(null);
  
  // Form states
  const [fatigue, setFatigue] = useState(5);
  const [hasPain, setHasPain] = useState(false);
  const [painLocation, setPainLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.locale);
  
  // Edit form states
  const [editDuration, setEditDuration] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editFatigue, setEditFatigue] = useState(5);
  const [editNotes, setEditNotes] = useState('');

  // Notification settings for athlete
  const [notifyAssignedWorkouts, setNotifyAssignedWorkouts] = useState(true);
  const [notifyDailyReminder, setNotifyDailyReminder] = useState(true);
  const [notifyExpirations, setNotifyExpirations] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // FAQ data for athlete
  const faqData = [
    {
      question: t('athleteHome.faq.q1'),
      answer: t('athleteHome.faq.a1')
    },
    {
      question: t('athleteHome.faq.q2'),
      answer: t('athleteHome.faq.a2')
    },
    {
      question: t('athleteHome.faq.q3'),
      answer: t('athleteHome.faq.a3')
    }
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

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
        
        // Fetch standalone activities for athlete's history
        if (profileResponse.data?.id) {
          try {
            const activitiesResponse = await axios.get(
              `${BASE_URL}/api/activities?athlete_id=${profileResponse.data.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            // Activities will be merged in allWorkouts via the programs
            // Store them to be added to the workouts list
            const activities = activitiesResponse.data || [];
            // Update programs to include standalone activities as "workouts"
            const standaloneProgram = {
              id: 'standalone-activities',
              name: t('athleteHome.outOfProgram'),
              workouts: activities.map((activity: any) => ({
                id: activity.id,
                date: activity.date,
                title: `${(activity.activity_type || t('workout.activity')).charAt(0).toUpperCase() + (activity.activity_type || t('workout.activity')).slice(1)}`,
                description: `${t('athleteHome.duration')}: ${activity.duration_minutes || 0} min, ${t('workout.distance')}: ${activity.distance_km || 0} km`,
                workout_type: activity.activity_type || 'other',
                duration_minutes: activity.duration_minutes,
                distance_km: activity.distance_km,
                completed: activity.completed || false,
                feedback_sent: activity.feedback_sent || false,
                athlete_feedback: activity.athlete_feedback,
                actual_data: activity.actual_data,
                is_standalone: true,
                activity_id: activity.id,
              }))
            };
            setPrograms([...programsResponse.data, standaloneProgram]);
          } catch (e) {
            console.log('Could not fetch standalone activities');
          }
        }
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

  const loadNotificationSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/users/me/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setNotifyAssignedWorkouts(response.data.notify_assigned_workouts ?? true);
        setNotifyDailyReminder(response.data.notify_daily_reminder ?? true);
        setNotifyExpirations(response.data.notify_expirations ?? true);
      }
    } catch (error) {
      console.log('Could not load notification settings, using defaults');
    }
  };

  const saveNotificationSettings = async () => {
    setSavingSettings(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/me/notification-settings`,
        {
          notify_assigned_workouts: notifyAssignedWorkouts,
          notify_daily_reminder: notifyDailyReminder,
          notify_expirations: notifyExpirations
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t('common.success'), t('settings.saved'));
      setShowSettingsModal(false);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.saveFailed'));
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchData();
    loadNotificationSettings();
    // Load saved language preference
    AsyncStorage.getItem('userLanguage').then(lang => {
      if (lang) {
        setSelectedLanguage(lang);
        changeLanguage(lang);
      }
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
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
  const getLocaleStr = () => {
    const loc = i18n.locale;
    if (loc.startsWith('it')) return 'it-IT';
    if (loc === 'en-US') return 'en-US';
    if (loc.startsWith('en')) return 'en-GB';
    if (loc.startsWith('fr')) return 'fr-FR';
    if (loc.startsWith('es')) return 'es-ES';
    if (loc.startsWith('de')) return 'de-DE';
    return 'en-GB';
  };
  const dayOfWeek = new Date().toLocaleDateString(getLocaleStr(), { weekday: 'long' });

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
    // Mostra tutti gli allenamenti di oggi (anche quelli con feedback inviato)
    return allWorkouts.filter(w => w.date === today);
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
      const workout = selectedWorkout.workout;
      
      const feedbackData = {
        duration_minutes: workout.duration_minutes,
        distance_km: workout.distance_km,
        feeling: `Fatica: ${fatigue}/10${hasPain ? `, Dolore: ${painLocation}` : ''}`,
        notes: notes,
        fatigue_level: fatigue,
        has_pain: hasPain,
        pain_location: hasPain ? painLocation : null
      };
      
      // Check if it's a standalone activity
      if (workout.is_standalone || workout.activity_id) {
        // Use the activities feedback endpoint
        await axios.put(
          `${BASE_URL}/api/activities/${workout.activity_id || workout.id}/feedback`,
          feedbackData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Use the programs endpoint for regular workouts
        await axios.put(
          `${BASE_URL}/api/programs/${workout.programId}/workouts/${workout.id}/complete`,
          feedbackData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      Alert.alert(t('common.success'), t('feedback.feedbackSent'));
      setShowCompleteModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.saveFailed'));
    }
  };

  const submitSkipWorkout = async () => {
    if (!selectedWorkout) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      const workout = selectedWorkout.workout;
      
      const skipData = {
        skipped: true,
        skip_reason: skipReason,
        feeling: t('workout.skipped'),
        notes: skipReason
      };
      
      // Check if it's a standalone activity
      if (workout.is_standalone || workout.activity_id) {
        await axios.put(
          `${BASE_URL}/api/activities/${workout.activity_id || workout.id}/feedback`,
          { ...skipData, skipped: true },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.put(
          `${BASE_URL}/api/programs/${workout.programId}/workouts/${workout.id}/complete`,
          skipData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      Alert.alert(t('common.saved'), t('workout.coachNotified'));
      setShowSkipModal(false);
      fetchData();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.saveFailed'));
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
      
      Alert.alert(t('common.success'), t('workout.editedNotified'));
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
      case 'easy': return t('athleteHome.workoutTypes.easy');
      case 'tempo': return t('athleteHome.workoutTypes.tempo');
      case 'interval': return t('athleteHome.workoutTypes.interval');
      case 'long': return t('athleteHome.workoutTypes.long');
      case 'recovery': return t('athleteHome.workoutTypes.recovery');
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
    // Controlla se feedback è stato inviato (feedback_sent, completed, o athlete_feedback presente)
    const hasFeedback = workout.feedback_sent === true || workout.completed === true || (workout.athlete_feedback && Object.keys(workout.athlete_feedback).length > 0);
    
    return (
      <Card key={workout.id} style={[styles.workoutCard, hasFeedback && styles.completedCard]}>
        <TouchableOpacity 
          onPress={() => openViewModal(workout)}
          activeOpacity={0.7}
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
            {hasFeedback && (
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

        {/* Mostra feedback inviato se presente */}
        {hasFeedback && !workout.completed && (
          <View style={styles.feedbackSentBadge}>
            <Ionicons name="send" size={12} color="#4CAF50" />
            <Text style={styles.feedbackSentText}>{t('athleteHome.actions.feedbackSent')}</Text>
          </View>
        )}

        {/* Actions for today's workouts - solo se NON ha già inviato feedback */}
        {showActions && isToday && !hasFeedback && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn]}
              onPress={() => openCompleteModal(workout)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>{t('athleteHome.actions.completed')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionBtn, styles.skipBtn]}
              onPress={() => openSkipModal(workout)}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>{t('athleteHome.actions.notDoneBtn')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Modifica (una sola volta) - dopo feedback inviato O per allenamenti passati */}
        {(hasFeedback || isPast) && !workout.modified_by_athlete && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(workout)}
          >
            <Ionicons name="pencil" size={16} color="#FF6B35" />
            <Text style={styles.editButtonText}>{t('athleteHome.actions.editOnce')}</Text>
          </TouchableOpacity>
        )}

        {workout.modified_by_athlete && (
          <View style={styles.modifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#4CAF50" />
            <Text style={styles.modifiedText}>{t('athleteHome.alreadyModified')}</Text>
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
            <Text style={styles.sectionTitle}>🏃 {t('athleteHome.sections.todayWorkout')}</Text>
            {todayWorkouts.length === 0 ? (
              <Card style={styles.restDayCard}>
                <Ionicons name="bed" size={48} color="#4CAF50" />
                <Text style={styles.restDayText}>{t('athleteHome.empty.restDay')}</Text>
                <Text style={styles.restDaySubtext}>{t('athleteHome.empty.noWorkoutScheduled')}</Text>
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
            <Text style={styles.sectionTitle}>📅 {t('athleteHome.sections.weeklyWorkouts')}</Text>
            {weekWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>{t('athleteHome.empty.noWorkoutThisWeek')}</Text>
            ) : (
              weekWorkouts.map(w => renderWorkoutCard(w, false))
            )}
          </View>
        );

      case 'month':
        const monthWorkouts = getMonthWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>📆 {t('athleteHome.sections.monthlyWorkouts')}</Text>
            {monthWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>{t('athleteHome.empty.noWorkoutThisMonth')}</Text>
            ) : (
              monthWorkouts.map(w => renderWorkoutCard(w, false))
            )}
          </View>
        );

      case 'history':
        const historyWorkouts = getHistoryWorkouts();
        return (
          <View>
            <Text style={styles.sectionTitle}>📚 {t('athleteHome.sections.workoutHistory')}</Text>
            {historyWorkouts.length === 0 ? (
              <Text style={styles.emptyText}>{t('athleteHome.empty.noWorkoutHistory')}</Text>
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
                      <Text style={styles.actualDataTitle}>{t('athleteHome.recordedData')}:</Text>
                      <View style={styles.actualDataRow}>
                        {w.actual_data.duration_minutes && (
                          <Text style={styles.actualDataText}>
                            {t('athleteHome.duration')}: {w.actual_data.duration_minutes} min
                          </Text>
                        )}
                        {w.actual_data.fatigue_level && (
                          <Text style={styles.actualDataText}>
                            {t('athleteHome.fatigue')}: {w.actual_data.fatigue_level}/10
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
                        {w.completed ? t('athleteHome.completed') : t('athleteHome.notDone')}
                      </Text>
                    </View>

                    {/* Pulsante modifica (solo se non già modificato) */}
                    {!w.modified_by_athlete ? (
                      <TouchableOpacity
                        style={styles.historyEditBtn}
                        onPress={() => openEditModal(w)}
                      >
                        <Ionicons name="pencil" size={16} color="#FF6B35" />
                        <Text style={styles.historyEditText}>{t('athleteHome.modify')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.alreadyModifiedBadge}>
                        <Ionicons name="checkmark" size={12} color="#4CAF50" />
                        <Text style={styles.alreadyModifiedText}>{t('athleteHome.alreadyModified')}</Text>
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
            {/* Impostazioni */}
            <Text style={styles.sectionTitle}>⚙️ {t('profile.settings')}</Text>
            <Card style={styles.infoCard}>
              <TouchableOpacity 
                style={styles.settingsRow}
                onPress={() => setShowSettingsModal(true)}
              >
                <View style={styles.settingsInfo}>
                  <Ionicons name="notifications-outline" size={22} color="#FF6B35" />
                  <Text style={styles.settingsText}>{t('navigation.notifications')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: '#333' }]}
                onPress={() => setShowLanguageModal(true)}
              >
                <View style={styles.settingsInfo}>
                  <Ionicons name="globe-outline" size={22} color="#FF6B35" />
                  <Text style={styles.settingsText}>{t('settings.language')}</Text>
                </View>
                <View style={styles.languageCurrentRow}>
                  <Text style={styles.languageCurrent}>
                    {selectedLanguage.startsWith('it') ? '🇮🇹' : 
                     selectedLanguage === 'en-US' ? '🇺🇸' :
                     selectedLanguage.startsWith('en') ? '🇬🇧' :
                     selectedLanguage.startsWith('fr') ? '🇫🇷' :
                     selectedLanguage.startsWith('es') ? '🇪🇸' :
                     selectedLanguage.startsWith('de') ? '🇩🇪' : '🌐'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: '#333' }]}
                onPress={() => setShowPrivacyModal(true)}
              >
                <View style={styles.settingsInfo}>
                  <Ionicons name="lock-closed-outline" size={22} color="#FF6B35" />
                  <Text style={styles.settingsText}>{t('profile.privacy')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: '#333' }]}
                onPress={() => { setExpandedFaq(null); setShowSupportModal(true); }}
              >
                <View style={styles.settingsInfo}>
                  <Ionicons name="help-circle-outline" size={22} color="#FF6B35" />
                  <Text style={styles.settingsText}>{t('profile.support')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            </Card>

            {/* Certificato Medico */}
            <Text style={styles.sectionTitle}>🏥 {t('athlete.certificate')}</Text>
            <Card style={styles.infoCard}>
              {athleteProfile?.medical_certificate?.expiry_date ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.expiresOn')}:</Text>
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
                            <Text style={styles.expiredBannerText}>{t('athleteHome.expiredDays', { days: Math.abs(days) })}</Text>
                          </View>
                        );
                      } else if (days <= 30) {
                        return (
                          <View style={[styles.statusBanner, styles.warningBanner]}>
                            <Ionicons name="alert-circle" size={18} color="#FF9800" />
                            <Text style={styles.warningBannerText}>{t('athleteHome.expiresInDays', { days })}</Text>
                          </View>
                        );
                      } else {
                        return (
                          <View style={[styles.statusBanner, styles.validBanner]}>
                            <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                            <Text style={styles.validBannerText}>{t('athleteHome.valid')}</Text>
                          </View>
                        );
                      }
                    }
                    return null;
                  })()}
                </>
              ) : (
                <Text style={styles.emptyText}>{t('athleteHome.noCertificate')}</Text>
              )}
            </Card>

            {/* Pagamenti */}
            <Text style={styles.sectionTitle}>💳 {t('athleteHome.payments')}</Text>
            <Card style={styles.infoCard}>
              {athleteProfile?.payments && athleteProfile.payments.length > 0 ? (
                athleteProfile.payments.map((payment) => (
                  <View key={payment.id} style={[styles.paymentRow, !payment.paid && styles.unpaidRow]}>
                    <View>
                      <Text style={styles.paymentMonth}>{payment.month}</Text>
                      <Text style={styles.paymentDue}>{t('athleteHome.dueDate')}: {formatDate(payment.due_date)}</Text>
                    </View>
                    <View style={styles.paymentRight}>
                      <Text style={styles.paymentAmount}>€{payment.amount}</Text>
                      <View style={[styles.paymentStatus, payment.paid ? styles.paidStatus : styles.unpaidStatus]}>
                        <Text style={[styles.paymentStatusText, payment.paid ? styles.paidText : styles.unpaidText]}>
                          {payment.paid ? t('athleteHome.paid') : t('athleteHome.toPay')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>{t('athleteHome.noPayments')}</Text>
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
          <View style={styles.headerRight}>
            <View>
              <Text style={styles.greeting}>{t('athleteHome.greeting')}, {user?.name?.split(' ')[0]}!</Text>
              <Text style={styles.dateText}>
                {dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, {new Date().toLocaleDateString('it-IT')}
              </Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={24} color="#FF6B35" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {[
            { key: 'today', label: t('athleteHome.tabs.today'), icon: 'today' },
            { key: 'week', label: t('athleteHome.tabs.week'), icon: 'calendar' },
            { key: 'month', label: t('athleteHome.tabs.month'), icon: 'calendar-outline' },
            { key: 'history', label: t('athleteHome.tabs.history'), icon: 'time' },
            { key: 'info', label: t('athleteHome.tabs.info'), icon: 'information-circle' },
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
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('athleteHome.endWorkout')}</Text>
                <TouchableOpacity onPress={() => setShowCompleteModal(false)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>{t('athleteHome.fatigueLevel')}</Text>
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

                <Text style={styles.inputLabel}>{t('athleteHome.pain')}</Text>
                <View style={styles.painToggle}>
                  <TouchableOpacity
                    style={[styles.painOption, !hasPain && styles.painOptionActive]}
                    onPress={() => setHasPain(false)}
                  >
                    <Text style={[styles.painOptionText, !hasPain && styles.painOptionTextActive]}>{t('common.no')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.painOption, hasPain && styles.painOptionActive]}
                    onPress={() => setHasPain(true)}
                  >
                    <Text style={[styles.painOptionText, hasPain && styles.painOptionTextActive]}>{t('common.yes')}</Text>
                  </TouchableOpacity>
                </View>

                {hasPain && (
                  <>
                    <Text style={styles.inputLabel}>{t('athleteHome.where')}</Text>
                    <TextInput
                      style={styles.textInput}
                      value={painLocation}
                      onChangeText={setPainLocation}
                      placeholder={t('athleteHome.painPlaceholder')}
                      placeholderTextColor="#666"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                  </>
                )}

                <Text style={styles.inputLabel}>{t('athleteHome.notesOptional')}</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('athleteHome.howDidYouFeel')}
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  blurOnSubmit={true}
                  returnKeyType="done"
                />

                <Button title={t('athleteHome.sendToCoach')} onPress={submitCompleteWorkout} style={styles.submitBtn} />
                
                <View style={styles.modalBottomSpacer} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Skip Workout Modal */}
      <Modal visible={showSkipModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('athleteHome.workoutNotDone')}</Text>
              <TouchableOpacity onPress={() => setShowSkipModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{t('athleteHome.motivation')}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={skipReason}
              onChangeText={setSkipReason}
              placeholder={t('athleteHome.whyNotTrain')}
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />

            <Button title={t('athleteHome.sendToCoach')} onPress={submitSkipWorkout} variant="danger" style={styles.submitBtn} />
          </View>
        </View>
      </Modal>

      {/* View Workout Modal */}
      <Modal visible={showViewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('athleteHome.workoutDetails')}</Text>
              <TouchableOpacity onPress={() => setShowViewModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedWorkout && (
              <>
                <Text style={styles.viewTitle}>{selectedWorkout.workout.title}</Text>
                <Text style={styles.viewDescription}>{selectedWorkout.workout.description}</Text>
                
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>{t('athleteHome.recordedData')}</Text>
                  {selectedWorkout.workout.actual_data && (
                    <>
                      {selectedWorkout.workout.actual_data.duration_minutes && (
                        <Text style={styles.viewData}>{t('athleteHome.duration')}: {selectedWorkout.workout.actual_data.duration_minutes} min</Text>
                      )}
                      {selectedWorkout.workout.actual_data.distance_km && (
                        <Text style={styles.viewData}>{t('workout.distance')}: {selectedWorkout.workout.actual_data.distance_km} km</Text>
                      )}
                      {selectedWorkout.workout.actual_data.fatigue_level && (
                        <Text style={styles.viewData}>{t('athleteHome.fatigue')}: {selectedWorkout.workout.actual_data.fatigue_level}/10</Text>
                      )}
                      {selectedWorkout.workout.actual_data.notes && (
                        <Text style={styles.viewData}>{t('athleteHome.notes')}: {selectedWorkout.workout.actual_data.notes}</Text>
                      )}
                    </>
                  )}
                </View>

                {!selectedWorkout.workout.modified_by_athlete && (
                  <Button 
                    title={t('athleteHome.editData')} 
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
                <Text style={styles.modalTitle}>{t('athleteHome.editWorkout')}</Text>
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
                  <Text style={styles.warningText}>{t('athleteHome.editOnceWarning')}</Text>
                </View>

                <Text style={styles.inputLabel}>{t('athleteHome.durationMinutes')}</Text>
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

                <Text style={styles.inputLabel}>{t('athleteHome.distanceKm')}</Text>
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

                <Text style={styles.inputLabel}>{t('athleteHome.notes')}</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder={t('athleteHome.additionalNotes')}
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />

                <Button title={t('athleteHome.saveChanges')} onPress={submitEditWorkout} style={styles.editSubmitBtn} />
                
                <View style={styles.bottomSpacer} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal for Athlete */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.settings')}</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.settingsSubtitle}>{t('settings.notifications.title')}</Text>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="fitness-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>{t('settings.notifications.assignedWorkoutEnabled')}</Text>
                  <Text style={styles.notificationSettingDesc}>
                    {t('settings.notifications.assignedWorkoutEnabledDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifyAssignedWorkouts}
                onValueChange={setNotifyAssignedWorkouts}
                trackColor={{ false: '#333', true: '#FF6B3550' }}
                thumbColor={notifyAssignedWorkouts ? '#FF6B35' : '#666'}
              />
            </View>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="alarm-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>{t('settings.notifications.reminderEnabled')}</Text>
                  <Text style={styles.notificationSettingDesc}>
                    {t('settings.notifications.reminderEnabledDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifyDailyReminder}
                onValueChange={setNotifyDailyReminder}
                trackColor={{ false: '#333', true: '#FF6B3550' }}
                thumbColor={notifyDailyReminder ? '#FF6B35' : '#666'}
              />
            </View>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="calendar-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>{t('settings.notifications.expiryEnabled')}</Text>
                  <Text style={styles.notificationSettingDesc}>
                    {t('settings.notifications.expiryEnabledDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifyExpirations}
                onValueChange={setNotifyExpirations}
                trackColor={{ false: '#333', true: '#FF6B3550' }}
                thumbColor={notifyExpirations ? '#FF6B35' : '#666'}
              />
            </View>

            <Button
              title={savingSettings ? t('common.loading') : t('common.save')}
              onPress={saveNotificationSettings}
              variant="primary"
              style={styles.saveSettingsBtn}
              disabled={savingSettings}
            />
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal visible={showLanguageModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.settingsSubtitle}>{t('settings.selectLanguage')}</Text>

            {[
              { code: 'it', name: 'Italiano', flag: '🇮🇹' },
              { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
              { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
              { code: 'fr', name: 'Français', flag: '🇫🇷' },
              { code: 'es', name: 'Español', flag: '🇪🇸' },
              { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            ].map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  selectedLanguage === lang.code && styles.languageOptionActive
                ]}
                onPress={() => {
                  setSelectedLanguage(lang.code);
                  changeLanguage(lang.code);
                  AsyncStorage.setItem('userLanguage', lang.code);
                  setShowLanguageModal(false);
                }}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.languageName,
                  selectedLanguage === lang.code && styles.languageNameActive
                ]}>
                  {lang.name}
                </Text>
                {selectedLanguage === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Privacy Modal for Athlete */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.privacy')}</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.privacyContent}>
              <View style={styles.privacySection}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name="person-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.privacyQuestion}>{t('athleteHome.privacyPersonal')}</Text>
                <Text style={styles.privacyAnswer}>
                  {t('athleteHome.privacyPersonalAnswer')}
                </Text>
              </View>

              <View style={styles.privacyDivider} />

              <View style={styles.privacySection}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name="fitness-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.privacyQuestion}>{t('athleteHome.privacyWorkout')}</Text>
                <Text style={styles.privacyAnswer}>
                  {t('athleteHome.privacyWorkoutAnswer')}
                </Text>
              </View>

              <View style={styles.privacyFooter}>
                <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
                <Text style={styles.privacyFooterText}>
                  {t('athleteHome.privacyFooter')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Support/FAQ Modal for Athlete */}
      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.support')}</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.faqContent}>
              <Text style={styles.faqTitle}>{t('athleteHome.faq.title')}</Text>
              
              {faqData.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestionRow}
                    onPress={() => toggleFaq(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons 
                      name={expandedFaq === index ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#FF6B35" 
                    />
                  </TouchableOpacity>
                  {expandedFaq === index && (
                    <View style={styles.faqAnswerContainer}>
                      <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity 
                style={styles.supportFooter}
                onPress={() => Linking.openURL('mailto:valhallanrunners@gmail.com')}
                activeOpacity={0.7}
              >
                <Ionicons name="mail-outline" size={20} color="#FF6B35" />
                <View style={styles.supportFooterTextContainer}>
                  <Text style={styles.supportFooterText}>{t('athleteHome.contactSupport')}</Text>
                  <Text style={styles.supportEmail}>valhallanrunners@gmail.com</Text>
                </View>
              </TouchableOpacity>
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
  headerRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
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
  feedbackSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
  },
  feedbackSentText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  modalScrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  modalBottomSpacer: {
    height: 40,
  },
  // Settings styles
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  settingsSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  notificationSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  notificationSettingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  notificationSettingText: {
    flex: 1,
  },
  notificationSettingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  notificationSettingDesc: {
    fontSize: 12,
    color: '#999',
    lineHeight: 16,
  },
  saveSettingsBtn: {
    marginTop: 16,
  },
  // Privacy modal styles
  privacyContent: {
    padding: 20,
  },
  privacySection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  privacyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  privacyAnswer: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2E1A',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 10,
  },
  privacyFooterText: {
    fontSize: 13,
    color: '#4CAF50',
    flex: 1,
    lineHeight: 18,
  },
  // FAQ/Support styles
  faqContent: {
    padding: 20,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },
  faqItem: {
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
    paddingRight: 12,
  },
  faqAnswerContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 22,
  },
  supportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
  },
  supportFooterTextContainer: {
    flex: 1,
  },
  supportFooterText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  supportEmail: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  // Language selector styles
  languageCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageCurrent: {
    fontSize: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  languageOptionActive: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  languageFlag: {
    fontSize: 28,
  },
  languageName: {
    fontSize: 16,
    color: '#FFF',
    flex: 1,
  },
  languageNameActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
});
