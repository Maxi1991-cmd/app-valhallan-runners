import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../src/components/Button';
import axios from 'axios';
import { useAuthStore } from '../src/store/authStore';
import { useTranslation } from '../src/hooks/useTranslation';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function PaymentSuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { refreshSubscription, loadUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (session_id) {
      verifyAndActivate();
    } else {
      // Se siamo su mobile senza session_id, vai alla dashboard
      if (Platform.OS !== 'web') {
        router.replace('/(tabs)');
      }
    }
  }, [session_id]);

  // Countdown per redirect
  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (status === 'success' && countdown === 0) {
      handleRedirect();
    }
  }, [status, countdown]);

  const verifyAndActivate = async () => {
    try {
      // Verifica il pagamento tramite endpoint pubblico
      const response = await axios.get(
        `${BASE_URL}/api/subscription/verify/${session_id}`
      );

      if (response.data.payment_status === 'paid') {
        // Aggiorna lo stato locale
        try {
          await refreshSubscription();
          await loadUser();
        } catch (e) {
          console.log('Refresh non critico:', e);
        }
        
        setStatus('success');
        setMessage('Abbonamento attivato con successo!');
      } else {
        setStatus('error');
        setMessage('Pagamento non completato');
      }
    } catch (error) {
      console.error('Errore verifica:', error);
      setStatus('error');
      setMessage('Errore durante la verifica');
    }
  };

  const handleRedirect = async () => {
    if (Platform.OS === 'web') {
      // Su web, redirect alla dashboard web
      window.location.href = '/';
    } else {
      // Su mobile, vai alla dashboard
      router.replace('/(tabs)');
    }
  };

  const goToDashboard = () => {
    if (Platform.OS === 'web') {
      // Su web, redirect alla home
      window.location.href = '/';
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'loading' && (
          <>
            <View style={styles.spinnerContainer}>
              <View style={styles.spinner} />
            </View>
            <Text style={styles.title}>Verifica pagamento...</Text>
            <Text style={styles.subtitle}>Attendere prego</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.checkmarkContainer}>
              <Ionicons name="checkmark-circle" size={100} color="#4CAF50" />
            </View>
            <Text style={styles.title}>Pagamento Completato!</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.subtitle}>
              Ora puoi gestire atleti illimitati
            </Text>
            
            {Platform.OS === 'web' && (
              <Text style={styles.countdown}>
                Apertura app in {countdown} secondi...
              </Text>
            )}
            
            <Button
              title="Vai alla Dashboard"
              onPress={goToDashboard}
              style={styles.button}
            />
            
            {Platform.OS === 'web' && (
              <Text style={styles.hint}>
                Se l'app non si apre, clicca il pulsante sopra
              </Text>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <View style={styles.errorContainer}>
              <Ionicons name="close-circle" size={100} color="#DC3545" />
            </View>
            <Text style={styles.title}>Errore</Text>
            <Text style={styles.errorMessage}>{message}</Text>
            <Button
              title="Riprova"
              onPress={() => router.replace('/(tabs)/profile')}
              style={styles.button}
            />
          </>
        )}
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
  spinnerContainer: {
    marginBottom: 24,
  },
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    borderTopColor: '#FF6B35',
  },
  checkmarkContainer: {
    marginBottom: 24,
  },
  errorContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 18,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
    marginBottom: 24,
  },
  countdown: {
    fontSize: 14,
    color: '#FF6B35',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  button: {
    width: '100%',
    maxWidth: 300,
    marginTop: 24,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
