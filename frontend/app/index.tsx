import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../src/hooks/useTranslation';

type RoleType = 'select' | 'coach' | 'athlete';

export default function LoginScreen() {
  const router = useRouter();
  const { login, athleteLogin, isAuthenticated, isLoading, loadUser, user } = useAuthStore();
  const { t } = useTranslation();
  const [role, setRole] = useState<RoleType>('select');
  
  // Coach login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Athlete login
  const [athleteEmail, setAthleteEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'athlete') {
        router.replace('/athlete-home');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, user, isLoading]);

  const handleCoachLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.loginError'));
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAthleteLogin = async () => {
    if (!athleteEmail || !accessCode) {
      Alert.alert(t('common.error'), t('auth.loginError'));
      return;
    }
    setLoading(true);
    try {
      await athleteLogin(athleteEmail, accessCode);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  // Role selection screen
  if (role === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="fitness" size={48} color="#FF6B35" />
            </View>
            <Text style={styles.appName}>{t('app.name')}</Text>
            <Text style={styles.subtitle}>{t('app.tagline')}</Text>
          </View>

          <Text style={styles.selectTitle}>{t('auth.whoAreYou')}</Text>

          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => setRole('coach')}
          >
            <View style={styles.roleIconContainer}>
              <Ionicons name="clipboard" size={32} color="#FF6B35" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{t('auth.coach')}</Text>
              <Text style={styles.roleDescription}>{t('auth.coachDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => setRole('athlete')}
          >
            <View style={styles.roleIconContainer}>
              <Ionicons name="body" size={32} color="#4CAF50" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{t('auth.athlete')}</Text>
              <Text style={styles.roleDescription}>{t('auth.athleteDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Coach Login
  if (role === 'coach') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => setRole('select')}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
              <Text style={styles.backText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
                <Ionicons name="clipboard" size={40} color="#FF6B35" />
              </View>
              <Text style={styles.appName}>{t('auth.coachLogin')}</Text>
            </View>

            <Card style={styles.formCard}>
              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                placeholder="coach@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />

              <Button
                title={loading ? t('common.loading') : t('auth.login')}
                onPress={handleCoachLogin}
                disabled={loading}
                style={styles.loginButton}
              />

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.registerText}>
                  {t('auth.noAccount')} <Text style={styles.registerTextBold}>{t('auth.register')}</Text>
                </Text>
              </TouchableOpacity>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Athlete Login
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => setRole('select')}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
              <Ionicons name="body" size={40} color="#4CAF50" />
            </View>
            <Text style={styles.appName}>{t('auth.athleteLogin')}</Text>
            <Text style={styles.subtitle}>{t('auth.athleteDesc')}</Text>
          </View>

          <Card style={styles.formCard}>
            <Input
              label={t('auth.email')}
              value={athleteEmail}
              onChangeText={setAthleteEmail}
              placeholder="atleta@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label={t('auth.accessCode')}
              value={accessCode}
              onChangeText={(text) => setAccessCode(text.toUpperCase())}
              placeholder={t('auth.accessCodePlaceholder')}
              autoCapitalize="characters"
              maxLength={6}
            />

            <View style={styles.codeHint}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.codeHintText}>
                {t('auth.athleteAccessInfo')}
              </Text>
            </View>

            <Button
              title={loading ? t('common.loading') : t('auth.login')}
              onPress={handleAthleteLogin}
              disabled={loading}
              style={styles.loginButton}
            />
          </Card>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    color: '#FFF',
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  selectTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  roleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  roleDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  formCard: {
    marginTop: 20,
  },
  loginButton: {
    marginTop: 16,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#999',
    fontSize: 14,
  },
  registerTextBold: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  codeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeHintText: {
    color: '#999',
    fontSize: 12,
    flex: 1,
  },
});
