import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function RootLayout() {
  const { loadUser, isLoading } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

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
