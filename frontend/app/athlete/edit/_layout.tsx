import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EditAthleteLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0F0F0F' },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0F0F0F' },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{ paddingRight: 16, paddingVertical: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Modifica Atleta' }} />
    </Stack>
  );
}
