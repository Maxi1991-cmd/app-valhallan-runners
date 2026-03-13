import React, { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
import * as Linking from 'expo-linking';

export default function RootLayout() {
  const { loadUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      console.log('Deep link received:', url);
      
      // Parse the deep link URL
      const parsed = Linking.parse(url);
      console.log('Parsed deep link:', parsed);
      
      if (parsed.path) {
        // Navigate to the path from the deep link
        // valhallan://subscription/success?session_id=xxx
        if (parsed.path === 'subscription/success' || parsed.path.includes('subscription/success')) {
          const sessionId = parsed.queryParams?.session_id;
          router.replace(`/subscription/success?session_id=${sessionId}`);
        } else if (parsed.path === 'subscription/cancel' || parsed.path.includes('subscription/cancel')) {
          router.replace('/subscription/cancel');
        } else if (parsed.path === 'dashboard' || parsed.path === '') {
          router.replace('/(tabs)');
        }
      }
    };

    // Listen for deep link events
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style="light" backgroundColor="#0F0F0F" />
      <Slot />
    </>
  );
}
