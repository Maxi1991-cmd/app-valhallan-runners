import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout, subscription, isSubscriptionActive, refreshSubscription, updateSubscription } = useAuthStore();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    refreshSubscription();
  }, []);

  const handleLogout = () => {
    Alert.alert('Esci', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // Forza il redirect alla schermata di login
          setTimeout(() => {
            router.replace('/');
          }, 100);
        },
      },
    ]);
  };

  const handleUpdateSubscription = async (plan: string, status: string) => {
    setIsUpdating(true);
    try {
      await updateSubscription(plan, status);
      setShowSubscriptionModal(false);
      Alert.alert('Successo', 'Abbonamento aggiornato con successo');
    } catch (error: any) {
      Alert.alert('Errore', error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getSubscriptionStatusColor = () => {
    if (isSubscriptionActive) return '#4CAF50';
    return '#DC3545';
  };

  const getSubscriptionStatusText = () => {
    if (!subscription || subscription.status === 'inactive') return 'Non attivo';
    if (subscription.status === 'expired') return 'Scaduto';
    if (subscription.plan === 'trial') return 'Prova Gratuita';
    if (subscription.plan === 'monthly') return 'Mensile';
    if (subscription.plan === 'annual') return 'Annuale';
    return 'Attivo';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const platformStatus = [
    { name: 'Garmin', icon: 'watch', connected: false },
    { name: 'Polar', icon: 'heart', connected: false },
    { name: 'Suunto', icon: 'compass', connected: false },
    { name: 'Strava', icon: 'bicycle', connected: false },
    { name: 'Fitbit', icon: 'fitness', connected: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'coach' ? 'Coach' : 'Atleta'}
            </Text>
          </View>
        </View>

        {/* Subscription Card - Solo per Coach */}
        {user?.role === 'coach' && (
          <Card title="Abbonamento" style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionStatus}>
                <View style={[styles.statusDot, { backgroundColor: getSubscriptionStatusColor() }]} />
                <Text style={[styles.statusLabel, { color: getSubscriptionStatusColor() }]}>
                  {getSubscriptionStatusText()}
                </Text>
              </View>
              {!isSubscriptionActive && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning" size={16} color="#DC3545" />
                  <Text style={styles.warningText}>
                    Abbonamento scaduto: non puoi modificare dati
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Piano:</Text>
                <Text style={styles.detailValue}>
                  {subscription?.plan === 'trial' ? 'Prova Gratuita (30 giorni)' :
                   subscription?.plan === 'monthly' ? 'Mensile' :
                   subscription?.plan === 'annual' ? 'Annuale' : 'Nessuno'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Inizio:</Text>
                <Text style={styles.detailValue}>{formatDate(subscription?.start_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Scadenza:</Text>
                <Text style={[
                  styles.detailValue,
                  !isSubscriptionActive && styles.expiredText
                ]}>
                  {formatDate(subscription?.end_date)}
                </Text>
              </View>
            </View>

            <Button
              title="Gestisci Abbonamento"
              onPress={() => setShowSubscriptionModal(true)}
              variant="primary"
              style={styles.manageButton}
            />
          </Card>
        )}

        <Card title="Piattaforme Connesse" style={styles.platformsCard}>
          <Text style={styles.platformNote}>
            Le integrazioni con piattaforme esterne saranno disponibili prossimamente
          </Text>
          {platformStatus.map((platform, index) => (
            <TouchableOpacity key={index} style={styles.platformRow}>
              <View style={styles.platformInfo}>
                <Ionicons name={platform.icon as any} size={22} color="#FF6B35" />
                <Text style={styles.platformName}>{platform.name}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  platform.connected ? styles.connectedBadge : styles.disconnectedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.badgeStatusText,
                    platform.connected ? styles.connectedText : styles.disconnectedText,
                  ]}
                >
                  {platform.connected ? 'Connesso' : 'Prossimamente'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        <Card title="Impostazioni" style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Notifiche</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Supporto</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </Card>

        <Button
          title="Esci"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />

        <Text style={styles.versionText}>Valhallan Runners v1.0.0</Text>
      </ScrollView>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestisci Abbonamento</Text>
              <TouchableOpacity onPress={() => setShowSubscriptionModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Seleziona un piano</Text>

            <TouchableOpacity
              style={styles.planOption}
              onPress={() => handleUpdateSubscription('monthly', 'active')}
              disabled={isUpdating}
            >
              <View style={styles.planInfo}>
                <Ionicons name="calendar-outline" size={24} color="#FF6B35" />
                <View style={styles.planDetails}>
                  <Text style={styles.planName}>Mensile</Text>
                  <Text style={styles.planDescription}>Accesso completo per 30 giorni</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.planOption}
              onPress={() => handleUpdateSubscription('annual', 'active')}
              disabled={isUpdating}
            >
              <View style={styles.planInfo}>
                <Ionicons name="star" size={24} color="#FFD700" />
                <View style={styles.planDetails}>
                  <Text style={styles.planName}>Annuale</Text>
                  <Text style={styles.planDescription}>Accesso completo per 365 giorni</Text>
                  <Text style={styles.planSaving}>Risparmia 2 mesi!</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.planOption, styles.deactivateOption]}
              onPress={() => handleUpdateSubscription(subscription?.plan || 'none', 'inactive')}
              disabled={isUpdating}
            >
              <View style={styles.planInfo}>
                <Ionicons name="pause-circle-outline" size={24} color="#DC3545" />
                <View style={styles.planDetails}>
                  <Text style={[styles.planName, { color: '#DC3545' }]}>Disattiva Abbonamento</Text>
                  <Text style={styles.planDescription}>
                    I dati degli atleti saranno conservati
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <Text style={styles.noteText}>
              Nota: Questa è una simulazione. In produzione, qui verrà integrato un sistema di pagamento reale.
            </Text>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  roleText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionCard: {
    marginBottom: 16,
    borderColor: '#FF6B35',
    borderWidth: 1,
  },
  subscriptionHeader: {
    marginBottom: 12,
  },
  subscriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  warningText: {
    color: '#DC3545',
    fontSize: 12,
    flex: 1,
  },
  subscriptionDetails: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  expiredText: {
    color: '#DC3545',
  },
  manageButton: {
    marginTop: 4,
  },
  platformsCard: {
    marginBottom: 16,
  },
  platformNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformName: {
    fontSize: 15,
    color: '#FFF',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  connectedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  disconnectedBadge: {
    backgroundColor: 'rgba(153, 153, 153, 0.15)',
  },
  badgeStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  connectedText: {
    color: '#4CAF50',
  },
  disconnectedText: {
    color: '#999',
  },
  settingsCard: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#FFF',
  },
  logoutButton: {
    marginBottom: 24,
  },
  versionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  planOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  planDetails: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  planDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  planSaving: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  deactivateOption: {
    borderColor: '#DC3545',
    borderWidth: 1,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
  },
  noteText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
