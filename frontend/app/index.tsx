import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Button } from '../src/components/Button';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="fitness" size={80} color="#FF6B35" />
        </View>
        <Text style={styles.title}>RunCoach Pro</Text>
        <Text style={styles.subtitle}>Gestisci i tuoi atleti, crea programmi di allenamento e monitora i progressi</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#FF6B35" />
          <Text style={styles.featureText}>Profili Atleti</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="calendar" size={24} color="#FF6B35" />
          <Text style={styles.featureText}>Programmazione</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="analytics" size={24} color="#FF6B35" />
          <Text style={styles.featureText}>Analisi Dati</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="notifications" size={24} color="#FF6B35" />
          <Text style={styles.featureText}>Notifiche</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Accedi"
          onPress={() => router.push('/login')}
          variant="primary"
          size="large"
          style={styles.button}
        />
        <Button
          title="Registrati come Coach"
          onPress={() => router.push('/register')}
          variant="outline"
          size="large"
          style={styles.button}
        />
      </View>

      <Text style={styles.footer}>Compatibile con Garmin, Polar, Suunto, Strava, Fitbit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  featureText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  buttons: {
    gap: 12,
  },
  button: {
    width: '100%',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
  },
});
