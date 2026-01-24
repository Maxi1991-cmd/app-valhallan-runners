import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useDataStore } from '../../src/store/dataStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notification } from '../../src/types';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export default function NotificationsTab() {
  const {
    notifications,
    warnings,
    unreadCount,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    checkExpiries,
  } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);

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
      default:
        return '#FF6B35';
    }
  };

  const renderWarning = ({ item }: { item: any }) => (
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
        </View>
        {item.urgent && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>Urgente</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      onPress={() => !item.read && markNotificationRead(item.id)}
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
            <Text style={styles.notificationTime}>
              {formatDistanceToNow(new Date(item.created_at), {
                addSuffix: true,
                locale: it,
              })}
            </Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
      </Card>
    </TouchableOpacity>
  );

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
  notificationTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
    marginLeft: 8,
  },
  urgentBadge: {
    backgroundColor: '#DC3545',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
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
