import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Switch, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTranslation } from '../../src/hooks/useTranslation';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout, subscription, isSubscriptionActive, refreshSubscription, updateSubscription } = useAuthStore();
  const { t } = useTranslation();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  
  // Notification settings for Coach
  const [notifyAthleteFeedback, setNotifyAthleteFeedback] = useState(true);
  const [notifyExpirations, setNotifyExpirations] = useState(true);

  // FAQ data
  const faqData = [
    {
      question: "Chi può utilizzare la piattaforma come coach?",
      answer: "Solo coach registrati con abbonamento attivo. Valhallan Runners è uno strumento professionale pensato per chi guida atleti con metodo e responsabilità."
    },
    {
      question: "Gli atleti sono soggetti ad abbonamento per utilizzare l'app?",
      answer: "No. L'abbonamento è previsto esclusivamente per il coach. L'atleta accede tramite codice personale fornito dal proprio allenatore."
    },
    {
      question: "Posso gestire e modificare i programmi dei miei atleti?",
      answer: "Sì. Il coach crea, aggiorna e adatta ogni programma in base agli obiettivi e ai feedback dell'atleta. La guida è tua. La crescita è loro."
    }
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  useEffect(() => {
    refreshSubscription();
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/users/me/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setNotifyAthleteFeedback(response.data.notify_athlete_feedback ?? true);
        setNotifyExpirations(response.data.notify_expirations ?? true);
      }
    } catch (error) {
      // If endpoint doesn't exist yet, use defaults
      console.log('Could not load notification settings, using defaults');
    }
  };

  const saveNotificationSettings = async () => {
    setLoadingSettings(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/me/notification-settings`,
        {
          notify_athlete_feedback: notifyAthleteFeedback,
          notify_expirations: notifyExpirations
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t('common.success'), t('settings.saved'));
      setShowNotificationsModal(false);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('errors.saveFailed'));
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('auth.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: () => {
          router.push('/logout');
        },
      },
    ]);
  };

  const handleUpdateSubscription = async (plan: string, status: string) => {
    setIsUpdating(true);
    try {
      await updateSubscription(plan, status);
      setShowSubscriptionModal(false);
      Alert.alert(t('common.success'), t('common.success'));
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getSubscriptionStatusColor = () => {
    if (isSubscriptionActive) return '#4CAF50';
    return '#DC3545';
  };

  const getSubscriptionStatusText = () => {
    if (!subscription || subscription.status === 'inactive') return t('profile.expired');
    if (subscription.status === 'expired') return t('profile.expired');
    if (subscription.plan === 'trial') return t('profile.trial');
    if (subscription.plan === 'monthly') return t('profile.active');
    if (subscription.plan === 'annual') return t('profile.active');
    return t('profile.active');
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
          <Card title={t('profile.subscription')} style={styles.subscriptionCard}>
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
                    {t('profile.expired')}
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

        <Card title={t('profile.settings')} style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowNotificationsModal(true)}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#FF6B35" />
              <Text style={styles.settingText}>{t('navigation.notifications')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowPrivacyModal(true)}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={22} color="#FF6B35" />
              <Text style={styles.settingText}>{t('profile.privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => { setExpandedFaq(null); setShowSupportModal(true); }}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle-outline" size={22} color="#FF6B35" />
              <Text style={styles.settingText}>{t('profile.support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </Card>

        <Button
          title={t('auth.logout')}
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

      {/* Notifications Settings Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Impostazioni Notifiche</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Gestisci le tue preferenze di notifica</Text>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>Feedback atleta</Text>
                  <Text style={styles.notificationSettingDesc}>
                    Ricevi notifica quando un atleta invia feedback sull'allenamento
                  </Text>
                </View>
              </View>
              <Switch
                value={notifyAthleteFeedback}
                onValueChange={setNotifyAthleteFeedback}
                trackColor={{ false: '#333', true: '#FF6B3550' }}
                thumbColor={notifyAthleteFeedback ? '#FF6B35' : '#666'}
              />
            </View>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="calendar-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>Scadenze certificati/pagamenti</Text>
                  <Text style={styles.notificationSettingDesc}>
                    Ricevi notifica quando scadono certificati medici o pagamenti degli atleti
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
              title={loadingSettings ? "Salvataggio..." : "Salva Impostazioni"}
              onPress={saveNotificationSettings}
              variant="primary"
              style={styles.saveSettingsBtn}
              disabled={loadingSettings}
            />
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.privacyContent}>
              <View style={styles.privacySection}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name="person-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.privacyQuestion}>Chi può vedere i dati personali?</Text>
                <Text style={styles.privacyAnswer}>
                  I dati personali sono visibili solo a te e al tuo atleta.
                </Text>
              </View>

              <View style={styles.privacyDivider} />

              <View style={styles.privacySection}>
                <View style={styles.privacyIconContainer}>
                  <Ionicons name="fitness-outline" size={28} color="#FF6B35" />
                </View>
                <Text style={styles.privacyQuestion}>Chi può vedere i dati allenamento?</Text>
                <Text style={styles.privacyAnswer}>
                  I dati sono visibili e condivisi solo tra te e i tuoi atleti.
                </Text>
              </View>

              <View style={styles.privacyFooter}>
                <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
                <Text style={styles.privacyFooterText}>
                  I tuoi dati sono protetti e non vengono condivisi con terze parti.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Support/FAQ Modal */}
      <Modal
        visible={showSupportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Supporto</Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.faqContent}>
              <Text style={styles.faqTitle}>Domande Frequenti</Text>
              
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
                  <Text style={styles.supportFooterText}>Hai altre domande o suggerimenti? Contattaci a</Text>
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
  // Notification settings styles
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
  // FAQ/Support modal styles
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
});
