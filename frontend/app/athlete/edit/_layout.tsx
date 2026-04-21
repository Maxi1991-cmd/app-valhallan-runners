import React from 'react';
import { Stack } from 'expo-router';

export default function EditAthleteLayout() {
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
      <Stack.Screen name="[id]" options={{ title: 'Modifica Atleta' }} />
    </Stack>
  );
}
