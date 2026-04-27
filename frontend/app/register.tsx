import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../src/hooks/useTranslation';

export default function Register() {
  const router = useRouter();
  const { register } = useAuthStore();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert(t('common.error'), t('auth.registerError'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, 'coach');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="fitness" size={60} color="#7CFC00" />
            <Text style={styles.title}>{t('auth.register')}</Text>
            <Text style={styles.subtitle}>{t('auth.coachDesc')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.fullName')}
              value={name}
              onChangeText={setName}
              placeholder="Mario Rossi"
              autoCapitalize="words"
            />

            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="coach@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.passwordContainer}>
              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordTooShort')}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <Input
              label={t('auth.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.confirmPassword')}
              secureTextEntry={!showPassword}
            />

            <Button
              title={t('auth.register')}
              onPress={handleRegister}
              loading={loading}
              size="large"
              style={styles.registerButton}
            />

            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>
                {t('auth.haveAccount')} <Text style={styles.loginLinkBold}>{t('auth.login')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  form: {
    flex: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 42,
    padding: 4,
  },
  registerButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  loginLink: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  loginLinkBold: {
    color: '#7CFC00',
    fontWeight: '600',
  },
});
