import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import { LoadingScreen } from '../src/components/LoadingScreen';
import i18n from '../src/i18n';

export default function RootLayout() {
  const { loadUser, isLoading } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return <LoadingScreen message={i18n.t('common.loading')} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F0F' },
          headerTintColor: '#FFF',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0F0F0F' },
          headerBackTitle: i18n.t('common.back'),
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="logout" options={{ headerShown: false }} />
        <Stack.Screen name="athlete-home" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="athlete/[id]" options={{ title: i18n.t('athlete.title') }} />
        <Stack.Screen name="athlete/create" options={{ title: i18n.t('athlete.createAthlete') }} />
        <Stack.Screen name="athlete/edit/[id]" options={{ title: i18n.t('athlete.editAthlete') }} />
        <Stack.Screen name="program/[id]" options={{ title: i18n.t('program.title') }} />
        <Stack.Screen name="program/create" options={{ title: i18n.t('program.createProgram') }} />
        <Stack.Screen name="activity" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
