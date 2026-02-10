import React from 'react';
import { Stack } from 'expo-router';

export default function ActivityLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F0F0F' },
      }}
    >
      <Stack.Screen name="upload" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
