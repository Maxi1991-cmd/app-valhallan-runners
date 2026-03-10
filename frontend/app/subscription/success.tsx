import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useAuthStore } from '../../src/store/authStore';
import { useTranslation } from '../../src/hooks/useTranslation';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function SubscriptionSuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { refreshSubscription, loadUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyPayment();
  }, [session_id]);

  const verifyPayment = async () => {
    if (!session_id) {
      setStatus('error');
      setMessage(t('subscription.invalidSession') || 'Sessione non valida');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${BASE_URL}/api/subscription/checkout/status/${session_id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.payment_status === 'paid') {
        // Aggiorna lo stato dell'abbonamento nello store Zustand
        await refreshSubscription();
        // Ricarica anche i dati utente per sicurezza
        await loadUser();
        
        setStatus('success');
        setMessage(t('subscription.activatedSuccess') || 'Abbonamento attivato con successo!');
      } else {
        setStatus('error');
        setMessage(t('subscription.paymentNotCompleted') || 'Pagamento non completato');
      }
    } catch (error) {
      console.error('Verify payment error:', error);
      setStatus('error');
      setMessage(t('subscription.verificationError') || 'Errore durante la verifica del pagamento');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.title}>{t('subscription.verifyingPayment') || 'Verifica pagamento in corso...'}</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            <Text style={styles.title}>{t('subscription.paymentCompleted') || 'Pagamento Completato!'}</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.subMessage}>
              {t('subscription.unlimitedAthletes') || 'Ora puoi aggiungere atleti illimitati alla tua squadra.'}
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="close-circle" size={80} color="#DC3545" />
            </View>
            <Text style={styles.title}>{t('common.error') || 'Errore'}</Text>
            <Text style={[styles.message, { color: '#DC3545' }]}>{message}</Text>
          </>
        )}

        <Button
          title={t('subscription.backToHome') || 'Torna alla Home'}
          onPress={() => router.replace('/(tabs)')}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    width: '100%',
    marginTop: 24,
  },
});
