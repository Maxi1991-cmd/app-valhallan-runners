import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Switch, ActivityIndicator, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTranslation } from '../../src/hooks/useTranslation';
import * as WebBrowser from 'expo-web-browser';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Types for subscription
interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  savings?: string;
}

interface SubscriptionStatus {
  is_premium: boolean;
  is_admin: boolean;
  plan: string;
  expires_at: string | null;
  athlete_count: number;
  athlete_limit: number | null;
  can_add_athlete: boolean;
}

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout, subscription, isSubscriptionActive, refreshSubscription, updateSubscription } = useAuthStore();
  const { t, i18n, changeLanguage } = useTranslation();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.locale);
  
  // Subscription states
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Notification settings for Coach
  const [notifyAthleteFeedback, setNotifyAthleteFeedback] = useState(true);
  const [notifyExpirations, setNotifyExpirations] = useState(true);

  // Load saved language and subscription status
  useEffect(() => {
    AsyncStorage.getItem('userLanguage').then(lang => {
      if (lang) {
        setSelectedLanguage(lang);
        changeLanguage(lang);
      }
    });
    
    // Load subscription data
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      
      // Fetch plans
      const plansRes = await axios.get(`${BASE_URL}/api/subscription/plans`);
      setSubscriptionPlans(plansRes.data.plans);
      
      // Fetch status
      const statusRes = await axios.get(`${BASE_URL}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionStatus(statusRes.data);
    } catch (error) {
      console.log('Error loading subscription data:', error);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setProcessingPayment(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Errore', 'Sessione scaduta, effettua il login');
        return;
      }
      
      // Check if we're on a native mobile platform (iOS or Android)
      const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';
      
      // Create checkout session
      const response = await axios.post(
        `${BASE_URL}/api/subscription/checkout`,
        {
          plan_id: planId,
          origin_url: BASE_URL,
          use_deep_link: isMobile  // Use deep links on mobile for app redirect
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Open Stripe checkout
      const { checkout_url } = response.data;
      if (checkout_url) {
        if (isMobile) {
          // On mobile, use WebBrowser for better deep link handling
          await WebBrowser.openBrowserAsync(checkout_url);
        } else {
          // On web, just open the URL
          await Linking.openURL(checkout_url);
        }
        setShowSubscriptionModal(false);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il pagamento');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleLanguageChange = async (langCode: string) => {
    setSelectedLanguage(langCode);
    changeLanguage(langCode);
    await AsyncStorage.setItem('userLanguage', langCode);
    setShowLanguageModal(false);
  };

  // FAQ data
  const faqData = [
    {
      question: t('faq.whoCanUse'),
      answer: t('faq.whoCanUseAnswer')
    },
    {
      question: t('faq.athleteSubscription'),
      answer: t('faq.athleteSubscriptionAnswer')
    },
    {
      question: t('faq.canManagePrograms'),
      answer: t('faq.canManageProgramsAnswer')
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
    if (subscription.plan === 'trial') return t('profile.free');  // Legacy compatibility
    if (subscription.plan === 'free') return t('profile.free');
    if (subscription.plan === 'monthly') return t('profile.active');
    if (subscription.plan === 'annual') return t('profile.active');
    return t('profile.active');
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr === 'None' || dateStr === 'null') return '--';
    try {
      const date = new Date(dateStr);
      // Check for invalid date (1970 or NaN)
      if (isNaN(date.getTime()) || date.getFullYear() < 1990) return '--';
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return '--';
    }
  };

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
                <Text style={styles.detailLabel}>{t('subscription.plan')}:</Text>
                <Text style={styles.detailValue}>
                  {subscription?.plan === 'admin' ? 'Admin (Illimitato)' :
                   subscription?.plan === 'trial' || subscription?.plan === 'free' ? t('subscription.freePlan') :
                   subscription?.plan === 'monthly' ? t('subscription.monthlyPlan') :
                   subscription?.plan === 'annual' ? t('subscription.annualPlan') : t('subscription.none')}
                </Text>
              </View>
              {subscription?.plan !== 'admin' && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('subscription.startDate')}:</Text>
                    <Text style={styles.detailValue}>{formatDate(subscription?.start_date)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('subscription.expiryDate')}:</Text>
                    <Text style={[
                      styles.detailValue,
                      !isSubscriptionActive && styles.expiredText
                    ]}>
                      {formatDate(subscription?.end_date)}
                    </Text>
                  </View>
                </>
              )}
              {subscription?.plan === 'admin' && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('subscription.expiryDate')}:</Text>
                  <Text style={[styles.detailValue, { color: '#4CAF50' }]}>Mai (Account Creator)</Text>
                </View>
              )}
            </View>

            <Button
              title={t('subscription.manage')}
              onPress={() => setShowSubscriptionModal(true)}
              variant="primary"
              style={styles.manageButton}
            />
          </Card>
        )}

        <Card title={t('profile.settings')} style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowNotificationsModal(true)}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#FF6B35" />
              <Text style={styles.settingText}>{t('navigation.notifications')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowLanguageModal(true)}>
            <View style={styles.settingInfo}>
              <Ionicons name="globe-outline" size={22} color="#FF6B35" />
              <Text style={styles.settingText}>{t('settings.language')}</Text>
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

        <Text style={styles.versionText}>StrideX v1.0.0</Text>
      </ScrollView>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{t('settings.selectLanguage')}</Text>

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
                onPress={() => handleLanguageChange(lang.code)}
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
              <Text style={styles.modalTitle}>{t('subscription.manage')}</Text>
              <TouchableOpacity onPress={() => setShowSubscriptionModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Current Status */}
            {subscriptionStatus && (
              <View style={styles.statusBanner}>
                <Ionicons 
                  name={subscriptionStatus.is_premium ? "checkmark-circle" : "information-circle"} 
                  size={24} 
                  color={subscriptionStatus.is_premium ? "#4CAF50" : "#FF9800"} 
                />
                <View style={styles.statusInfo}>
                  <Text style={styles.statusTitle}>
                    {subscriptionStatus.is_admin 
                      ? 'Admin (Illimitato)'
                      : subscriptionStatus.is_premium 
                        ? t('subscription.premiumActive') 
                        : t('subscription.freePlan')}
                  </Text>
                  <Text style={styles.statusDesc}>
                    {subscriptionStatus.is_admin
                      ? 'Nessuna scadenza - Account Creator'
                      : subscriptionStatus.is_premium 
                        ? subscriptionStatus.expires_at
                          ? `${t('subscription.expiresOn')}: ${new Date(subscriptionStatus.expires_at).toLocaleDateString('it-IT')}`
                          : 'Abbonamento attivo'
                        : `${subscriptionStatus.athlete_count}/${subscriptionStatus.athlete_limit} ${t('subscription.athletesUsed')}`
                    }
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.modalSubtitle}>{t('subscription.selectPlan')}</Text>

            {/* Monthly Plan */}
            {subscriptionPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planOption,
                  subscriptionStatus?.plan === plan.id && styles.planOptionActive
                ]}
                onPress={() => handleSubscribe(plan.id)}
                disabled={processingPayment}
              >
                <View style={styles.planInfo}>
                  <Ionicons 
                    name={plan.id === 'annual' ? "star" : "calendar-outline"} 
                    size={24} 
                    color={plan.id === 'annual' ? "#FFD700" : "#FF6B35"} 
                  />
                  <View style={styles.planDetails}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>€{plan.price}/{plan.interval === 'month' ? t('subscription.month') : t('subscription.year')}</Text>
                    <Text style={styles.planDescription}>{plan.description}</Text>
                    {plan.savings && <Text style={styles.planSaving}>{plan.savings}</Text>}
                  </View>
                </View>
                {processingPayment ? (
                  <ActivityIndicator color="#FF6B35" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                )}
              </TouchableOpacity>
            ))}

            <Text style={styles.noteText}>
              {t('subscription.stripeNote')}
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
              <Text style={styles.modalTitle}>{t('settings.notifications.title')}</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{t('settings.notifications.title')}</Text>

            <View style={styles.notificationSettingRow}>
              <View style={styles.notificationSettingInfo}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FF6B35" />
                <View style={styles.notificationSettingText}>
                  <Text style={styles.notificationSettingTitle}>{t('settings.notifications.feedbackEnabled')}</Text>
                  <Text style={styles.notificationSettingDesc}>
                    {t('settings.notifications.feedbackEnabledDesc')}
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
              title={loadingSettings ? t('common.loading') : t('common.save')}
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
                <Text style={styles.privacyQuestion}>{t('privacy.whoCanSee')}</Text>
                <Text style={styles.privacyAnswer}>
                  {t('privacy.whoCanSeeAnswer')}
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
  planOptionActive: {
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginTop: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  statusDesc: {
    fontSize: 12,
    color: '#999',
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
    backgroundColor: '#1A1A1A',
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
