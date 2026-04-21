import React from 'react';
import { Stack } from 'expo-router';

export default function AthleteLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F0F0F' },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0F0F0F' },
        headerBackTitle: 'Indietro',
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Dettaglio Atleta' }} />
      <Stack.Screen name="create" options={{ title: 'Nuovo Atleta' }} />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
    </Stack>
  );
}
