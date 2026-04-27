import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function LogoutScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();

  useEffect(() => {
    const doLogout = async () => {
      await logout();
      router.replace('/');
    };
    doLogout();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7CFC00" />
      <Text style={styles.text}>Disconnessione...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
  },
});
