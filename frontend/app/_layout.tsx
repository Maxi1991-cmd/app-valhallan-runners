import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function RootLayout() {
  const { loadUser, isLoading, isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadUser();
  }, []);

  // Gestione navigazione basata su autenticazione
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'athlete-home';
    const inLoginScreen = segments[0] === 'index' || segments[0] === 'login' || segments[0] === 'register';

    if (!isAuthenticated && inAuthGroup) {
      // Non autenticato ma in area protetta -> vai a login
      router.replace('/');
    } else if (isAuthenticated && inLoginScreen) {
      // Autenticato ma in login -> vai alla home appropriata
      if (user?.role === 'athlete') {
        router.replace('/athlete-home');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, segments, isLoading, user]);

  if (isLoading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F0F' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0F0F0F' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="athlete-home" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="athlete/[id]" options={{ title: 'Profilo Atleta' }} />
        <Stack.Screen name="athlete/create" options={{ title: 'Nuovo Atleta' }} />
        <Stack.Screen name="athlete/edit/[id]" options={{ title: 'Modifica Atleta' }} />
        <Stack.Screen name="program/[id]" options={{ title: 'Programma' }} />
        <Stack.Screen name="program/create" options={{ title: 'Nuovo Programma' }} />
        <Stack.Screen name="program/edit/[id]" options={{ title: 'Modifica Programma' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
});
