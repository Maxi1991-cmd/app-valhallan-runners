import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
  const { loadUser, isLoading } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <>
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
        <Stack.Screen name="logout" options={{ headerShown: false }} />
        <Stack.Screen name="athlete-home" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="athlete/[id]" options={{ title: 'Atleta' }} />
        <Stack.Screen name="athlete/create" options={{ title: 'Nuovo Atleta' }} />
        <Stack.Screen name="athlete/edit/[id]" options={{ title: 'Modifica Atleta' }} />
        <Stack.Screen name="program/[id]" options={{ title: 'Programma' }} />
        <Stack.Screen name="program/create" options={{ title: 'Programma' }} />
        <Stack.Screen name="activity" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
