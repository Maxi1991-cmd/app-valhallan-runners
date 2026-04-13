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
import { it, enGB, enUS, fr, es, de } from 'date-fns/locale';
import { useTranslation } from '../../src/hooks/useTranslation';
import i18n from '../../src/i18n';

// Get date-fns locale based on i18n
const getDateFnsLocale = () => {
  const locale = i18n.locale;
  if (locale.startsWith('it')) return it;
  if (locale === 'en-US') return enUS;
  if (locale.startsWith('en')) return enGB;
  if (locale.startsWith('fr')) return fr;
  if (locale.startsWith('es')) return es;
  if (locale.startsWith('de')) return de;
  return enGB;
};

export default function NotificationsTab() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const handleNotificationPress = async (item: Notification) => {
    // Mark as read when clicked (do NOT auto-delete)
    if (!item.read) {
      await markNotificationRead(item.id);
    }

    const relatedData = (item as any).related_data;
    
    // Se è un feedback di attività standalone (ha activity_id ma NON program_id), apri il modal
    if (item.notification_type === 'workout_feedback' && relatedData?.activity_id && !relatedData?.program_id) {
      setFeedbackModal({
        visible: true,
        data: {
          athleteName: relatedData.athlete_name,
          workoutTitle: relatedData.activity_type || 'Attività',
          feedbackDate: relatedData.feedback_date,
          feedback: relatedData.athlete_feedback,
          activityId: relatedData.activity_id,
          isStandalone: true,
        }
      });
      return;
    }
    
    // Se è un feedback di workout normale (ha program_id), apri il modal con i dettagli
    if ((item.notification_type === 'workout_feedback' || item.notification_type === 'workout_modified') && relatedData?.program_id) {
      setFeedbackModal({
        visible: true,
        data: {
          athleteName: relatedData.athlete_name,
          workoutTitle: relatedData.workout_title,
          feedbackDate: relatedData.feedback_date,
          feedback: relatedData.athlete_feedback,
          programId: relatedData.program_id,
          workoutId: relatedData.workout_id,
          isStandalone: false,
        }
      });
      return;
    }
    
    // Naviga in base al tipo di notifica
    if (item.notification_type === 'workout_completed' && relatedData?.program_id) {
      router.push(`/program/${relatedData.program_id}`);
    } else if (item.notification_type === 'activity_assigned' && relatedData?.activity_id) {
      router.push(`/activity/${relatedData.activity_id}`);
    } else if (item.notification_type === 'certificate_expiry' && relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}?tab=certificate`);
    } else if (item.notification_type === 'payment_due' && relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}?tab=payments`);
    } else if (relatedData?.activity_id) {
      router.push(`/activity/${relatedData.activity_id}`);
    } else if (relatedData?.athlete_id) {
      router.push(`/athlete/${relatedData.athlete_id}`);
    } else if (relatedData?.program_id) {
      router.push(`/program/${relatedData.program_id}`);
    }
  };

  // Vai al programma o attività dal modal feedback
  const goToTarget = () => {
    if (feedbackModal.data?.isStandalone && feedbackModal.data?.activityId) {
      setFeedbackModal({ visible: false, data: null });
      router.push(`/activity/${feedbackModal.data.activityId}`);
    } else if (feedbackModal.data?.programId) {
      setFeedbackModal({ visible: false, data: null });
      router.push(`/program/${feedbackModal.data.programId}`);
    }
  };

  // Elimina singola notifica
  const handleDeleteNotification = (id: string) => {
    Alert.alert(
      t('notifications.deleteTitle'),
      t('notifications.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
                ? `${t('notifications.paymentPending')} - ${item.athlete_name}`
                : `${t('notifications.certificateExpiring')} - ${item.athlete_name}`}
            </Text>
            <Text style={styles.notificationMessage}>
              {item.type === 'payment_due'
                ? `${t('notifications.month')}: ${item.month} - €${item.amount}${item.days_overdue > 0 ? ` (${item.days_overdue} ${t('notifications.daysOverdue')})` : ''}`
                : `${t('notifications.expiresOn')} ${item.expiry_date}${item.days_until <= 7 ? ` (${item.days_until} ${t('time.days')})` : ''}`}
            </Text>
            <Text style={styles.tapHint}>{t('notifications.tapToView')}</Text>
          </View>
          {item.urgent && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>{t('notifications.urgent')}</Text>
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
                  {item.created_at ? formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: getDateFnsLocale(),
                  }) : t('time.now')}
                </Text>
                {hasNavigation && (
                  <Text style={styles.tapHint}>{t('notifications.tapToView')}</Text>
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
          <Text style={styles.headerTitle}>{t('navigation.notifications')}</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} ${t('notifications.unread')}` : t('notifications.allRead')}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Button
            title={t('notifications.clearAll')}
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
            <Text style={styles.sectionHeader}>{t('notifications.expiryWarnings')}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>{t('notifications.noNotifications')}</Text>
            <Text style={styles.emptySubtext}>{t('notifications.willAppearHere')}</Text>
          </View>
        }
      />

      {/* Modal Feedback Atleta */}
      <Modal visible={feedbackModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Feedback Atleta</Text>
              <TouchableOpacity onPress={() => setFeedbackModal({ visible: false, data: null })}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {feedbackModal.data && (
              <View style={styles.feedbackContent}>
                <View style={styles.feedbackHeader}>
                  <Ionicons name="person-circle" size={40} color="#FF6B35" />
                  <View style={styles.feedbackHeaderText}>
                    <Text style={styles.feedbackAthleteName}>{feedbackModal.data.athleteName}</Text>
                    <Text style={styles.feedbackWorkoutTitle}>{feedbackModal.data.workoutTitle}</Text>
                    <Text style={styles.feedbackDate}>{feedbackModal.data.feedbackDate}</Text>
                  </View>
                </View>

                <View style={styles.feedbackDetails}>
                  {feedbackModal.data.feedback?.fatigue_level && (
                    <View style={styles.feedbackRow}>
                      <View style={styles.feedbackIconContainer}>
                        <Ionicons name="fitness" size={20} color="#FF6B35" />
                      </View>
                      <View>
                        <Text style={styles.feedbackLabel}>Livello Fatica</Text>
                        <Text style={styles.feedbackValue}>{feedbackModal.data.feedback.fatigue_level}/10</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.feedbackRow}>
                    <View style={styles.feedbackIconContainer}>
                      <Ionicons name="medkit" size={20} color={feedbackModal.data.feedback?.has_pain ? '#DC3545' : '#4CAF50'} />
                    </View>
                    <View>
                      <Text style={styles.feedbackLabel}>Dolori</Text>
                      <Text style={[styles.feedbackValue, feedbackModal.data.feedback?.has_pain && { color: '#DC3545' }]}>
                        {feedbackModal.data.feedback?.has_pain 
                          ? feedbackModal.data.feedback?.pain_location || 'Sì' 
                          : 'Nessun dolore'}
                      </Text>
                    </View>
                  </View>

                  {feedbackModal.data.feedback?.notes && (
                    <View style={styles.feedbackNotesSection}>
                      <Text style={styles.feedbackLabel}>Note</Text>
                      <Text style={styles.feedbackNotes}>"{feedbackModal.data.feedback.notes}"</Text>
                    </View>
                  )}
                </View>

                <Button 
                  title={feedbackModal.data?.isStandalone ? "Vai all'Attività" : "Vai al Programma"}
                  onPress={goToTarget} 
                  style={styles.goToProgramBtn}
                />
              </View>
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
  // Modal Feedback styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
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
  feedbackContent: {
    gap: 16,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedbackHeaderText: {
    flex: 1,
  },
  feedbackAthleteName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  feedbackWorkoutTitle: {
    fontSize: 14,
    color: '#FF6B35',
    marginTop: 2,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  feedbackDetails: {
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedbackIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackLabel: {
    fontSize: 12,
    color: '#999',
  },
  feedbackValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  feedbackNotesSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  feedbackNotes: {
    fontSize: 14,
    color: '#CCC',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 20,
  },
  goToProgramBtn: {
    marginTop: 16,
  },
});
