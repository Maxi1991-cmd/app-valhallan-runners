import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notification } from '../../src/types';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export default function NotificationsTab() {
  const router = useRouter();
  const {
    notifications,
    warnings,
    unreadCount,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    checkExpiries,
  } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ visible: boolean; data: any }>({ visible: false, data: null });

  useEffect(() => {
    fetchNotifications();
    checkExpiries();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), checkExpiries()]);
    setRefreshing(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_due':
        return 'card';
      case 'certificate_expiry':
        return 'medical';
      case 'message':
        return 'chatbubble';
      case 'reminder':
        return 'alarm';
      case 'workout_completed':
        return 'checkmark-circle';
      case 'workout_feedback':
        return 'chatbubble-ellipses';
      case 'workout_modified':
        return 'pencil';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string, urgent: boolean = false) => {
    if (urgent) return '#DC3545';
    switch (type) {
      case 'payment_due':
        return '#FF9800';
      case 'certificate_expiry':
        return '#9C27B0';
      case 'message':
        return '#2196F3';
      case 'workout_completed':
        return '#4CAF50';
      case 'workout_feedback':
        return '#FF6B35';
      case 'workout_modified':
        return '#FF9800';
      default:
        return '#FF6B35';
    }
  };

  // Navigazione al contenuto correlato per i warning
  const handleWarningPress = (item: any) => {
    if (item.athlete_id) {
      // Naviga al profilo atleta con il tab certificato se è scadenza certificato
      if (item.type === 'certificate_expiry') {
        router.push(`/athlete/${item.athlete_id}?tab=certificate`);
      } else if (item.type === 'payment_due') {
        router.push(`/athlete/${item.athlete_id}?tab=payments`);
      } else {
        router.push(`/athlete/${item.athlete_id}`);
      }
    }
  };

  // Navigazione al contenuto correlato per le notifiche
  const handleNotificationPress = (item: Notification) => {
    // Segna come letta se non lo è
    if (!item.read) {
      markNotificationRead(item.id);
    }

    const relatedData = (item as any).related_data;
    
    // Se è un feedback, apri il modal con i dettagli
    if ((item.notification_type === 'workout_feedback' || item.notification_type === 'workout_modified') && relatedData?.athlete_feedback) {
      setFeedbackModal({
        visible: true,
        data: {
          athleteName: relatedData.athlete_name,
          workoutTitle: relatedData.workout_title,
          feedbackDate: relatedData.feedback_date,
          feedback: relatedData.athlete_feedback,
          programId: relatedData.program_id,
          workoutId: relatedData.workout_id,
        }
      });
      return;
    }
    
    // Naviga in base al tipo di notifica
    if (item.notification_type === 'workout_completed' && relatedData?.program_id) {
      router.push(`/program/${relatedData.program_id}`);
    } else if (item.notification_type === 'workout_feedback' && relatedData?.program_id) {
      router.push(`/program/${relatedData.program_id}`);
    } else if (item.notification_type === 'certificate_expiry' && relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}?tab=certificate`);
    } else if (item.notification_type === 'payment_due' && relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}?tab=payments`);
    } else if (relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}`);
    } else if (relatedData?.program_id) {
      router.push(`/program/${relatedData.program_id}`);
    }
  };

  // Vai al programma dal modal feedback
  const goToProgram = () => {
    if (feedbackModal.data?.programId) {
      setFeedbackModal({ visible: false, data: null });
      router.push(`/program/${feedbackModal.data.programId}`);
    }
  };

  // Elimina singola notifica
  const handleDeleteNotification = (id: string) => {
    Alert.alert(
      'Elimina Notifica',
      'Vuoi eliminare questa notifica?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => deleteNotification(id),
        },
      ]
    );
  };

  const renderWarning = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => handleWarningPress(item)} activeOpacity={0.8}>
      <Card style={[styles.notificationCard, item.urgent && styles.urgentCard]}>
        <View style={styles.notificationContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${getNotificationColor(item.type, item.urgent)}20` },
            ]}
          >
            <Ionicons
              name={getNotificationIcon(item.type)}
              size={20}
              color={getNotificationColor(item.type, item.urgent)}
            />
          </View>
          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle}>
              {item.type === 'payment_due'
                ? `Pagamento in sospeso - ${item.athlete_name}`
                : `Certificato in scadenza - ${item.athlete_name}`}
            </Text>
            <Text style={styles.notificationMessage}>
              {item.type === 'payment_due'
                ? `Mese: ${item.month} - €${item.amount}${item.days_overdue > 0 ? ` (${item.days_overdue} giorni di ritardo)` : ''}`
                : `Scade il ${item.expiry_date}${item.days_until <= 7 ? ` (${item.days_until} giorni)` : ''}`}
            </Text>
            <Text style={styles.tapHint}>Tocca per visualizzare</Text>
          </View>
          {item.urgent && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>Urgente</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color="#666" style={styles.chevron} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderNotification = ({ item }: { item: Notification }) => {
    const relatedData = (item as any).related_data;
    const isWorkoutCompleted = item.notification_type === 'workout_completed';
    const hasNavigation = relatedData?.program_id || relatedData?.athlete_id;

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <Card style={[styles.notificationCard, !item.read && styles.unreadCard]}>
          <View style={styles.notificationContent}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${getNotificationColor(item.notification_type)}20` },
              ]}
            >
              <Ionicons
                name={getNotificationIcon(item.notification_type)}
                size={20}
                color={getNotificationColor(item.notification_type)}
              />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {item.message}
              </Text>
              
              {isWorkoutCompleted && relatedData?.actual_data && (
                <View style={styles.workoutDetails}>
                  {relatedData.actual_data.duration_minutes && (
                    <Text style={styles.workoutDetailText}>
                      Durata: {relatedData.actual_data.duration_minutes} min
                    </Text>
                  )}
                  {relatedData.actual_data.distance_km && (
                    <Text style={styles.workoutDetailText}>
                      Distanza: {relatedData.actual_data.distance_km} km
                    </Text>
                  )}
                  {relatedData.actual_data.avg_pace && (
                    <Text style={styles.workoutDetailText}>
                      Passo: {relatedData.actual_data.avg_pace}
                    </Text>
                  )}
                  {relatedData.actual_data.avg_heart_rate && (
                    <Text style={styles.workoutDetailText}>
                      FC media: {relatedData.actual_data.avg_heart_rate} bpm
                    </Text>
                  )}
                  {relatedData.actual_data.feeling && (
                    <Text style={styles.workoutDetailText}>
                      Sensazione: {relatedData.actual_data.feeling}
                    </Text>
                  )}
                </View>
              )}
              
              <View style={styles.notificationFooter}>
                <Text style={styles.notificationTime}>
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: it,
                  })}
                </Text>
                {hasNavigation && (
                  <Text style={styles.tapHint}>Tocca per visualizzare</Text>
                )}
              </View>
            </View>
            
            <View style={styles.rightActions}>
              {!item.read && <View style={styles.unreadDot} />}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteNotification(item.id);
                }}
                style={styles.deleteButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color="#DC3545" />
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifiche</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} non lette` : 'Tutto letto'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Button
            title="Segna tutte"
            onPress={markAllNotificationsRead}
            variant="outline"
            size="small"
          />
        )}
      </View>

      <FlatList
        data={[...warnings, ...notifications]}
        keyExtractor={(item, index) => `notification-${index}`}
        renderItem={({ item, index }) =>
          index < warnings.length
            ? renderWarning({ item })
            : renderNotification({ item: item as Notification })
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
        ListHeaderComponent={
          warnings.length > 0 ? (
            <Text style={styles.sectionHeader}>Avvisi Scadenze</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
            <Text style={styles.emptySubtext}>Le tue notifiche appariranno qui</Text>
          </View>
        }
      />
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  notificationCard: {
    borderWidth: 1,
    borderColor: '#333',
  },
  unreadCard: {
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  urgentCard: {
    borderColor: '#DC3545',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  workoutDetails: {
    marginTop: 8,
    backgroundColor: '#252525',
    padding: 10,
    borderRadius: 8,
  },
  workoutDetailText: {
    fontSize: 12,
    color: '#CCC',
    marginBottom: 4,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: '#666',
  },
  tapHint: {
    fontSize: 10,
    color: '#FF6B35',
    fontStyle: 'italic',
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginLeft: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
  },
  chevron: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  urgentBadge: {
    backgroundColor: '#DC3545',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  urgentText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
});
