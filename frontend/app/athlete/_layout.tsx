import React from 'react';
import { Stack } from 'expo-router';

export default function AthleteLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F0F0F' },
      }}
    />
  );
}
