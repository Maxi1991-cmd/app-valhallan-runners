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
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>VALHALLAN</Text>
        <Text style={styles.titleRed}>RUNNERS</Text>
        <Text style={styles.subtitle}>Gestisci i tuoi atleti, crea programmi di allenamento e monitora i progressi</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#8B1A1A" />
          <Text style={styles.featureText}>Profili Atleti</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="calendar" size={24} color="#8B1A1A" />
          <Text style={styles.featureText}>Programmazione</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="analytics" size={24} color="#8B1A1A" />
          <Text style={styles.featureText}>Analisi Dati</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="notifications" size={24} color="#8B1A1A" />
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
    backgroundColor: '#0A0A0A',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#D4B896',
    letterSpacing: 4,
  },
  titleRed: {
    fontSize: 28,
    fontWeight: '800',
    color: '#8B1A1A',
    letterSpacing: 3,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  featureText: {
    color: '#D4B896',
    fontSize: 13,
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
