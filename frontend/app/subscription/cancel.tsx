import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { useTranslation } from '../../src/hooks/useTranslation';

export default function SubscriptionCancelScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="close-circle-outline" size={80} color="#FF9800" />
        </View>
        <Text style={styles.title}>{t('subscription.paymentCanceled') || 'Pagamento Annullato'}</Text>
        <Text style={styles.message}>
          {t('subscription.paymentCanceledDesc') || 'Hai annullato il processo di pagamento.'}
        </Text>
        <Text style={styles.subMessage}>
          {t('subscription.retryFromProfile') || 'Puoi riprovare in qualsiasi momento dalla pagina del profilo.'}
        </Text>

        <Button
          title={t('subscription.backToHome') || 'Torna alla Home'}
          onPress={() => router.replace('/(tabs)')}
          style={styles.button}
        />
        
        <Button
          title={t('subscription.retry') || 'Riprova'}
          variant="outline"
          onPress={() => router.replace('/(tabs)/profile')}
          style={styles.retryButton}
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
    color: '#FF9800',
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
  retryButton: {
    width: '100%',
    marginTop: 12,
  },
});
