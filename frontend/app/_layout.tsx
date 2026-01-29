import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function RootLayout() {
  const { loadUser, isLoading, isAuthenticated, user } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  // Determina se siamo in un'area protetta
  const inProtectedArea = segments[0] === '(tabs)' || 
                          segments[0] === 'athlete-home' ||
                          segments[0] === 'athlete' ||
                          segments[0] === 'program';

  // Se non autenticato e in area protetta, redirect immediato
  if (!isAuthenticated && inProtectedArea) {
    return <Redirect href="/" />;
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
