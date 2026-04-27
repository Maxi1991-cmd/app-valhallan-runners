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
        <Image
          source={require('../assets/images/stridex-logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Role selection screen
  if (role === 'select') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.selectScrollContent}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/stridex-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.poweredBy}>Powered by Valhallan Runners</Text>
          </View>

          {/* Motivational Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>Non temere la fatica.</Text>
            <Text style={styles.quoteText}>Temi di non provarci.</Text>
          </View>

          <Text style={styles.selectTitle}>Scegli chi vuoi essere oggi</Text>

          {/* Coach Card */}
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => setRole('coach')}
            data-testid="role-coach-btn"
          >
            <View style={[styles.roleIconContainer, styles.coachIconBg]}>
              <Ionicons name="shield-checkmark" size={28} color="#FFB300" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>Coach</Text>
              <Text style={styles.roleDescription}>Guida. Programma. Fai crescere i tuoi atleti.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#7CFC00" />
          </TouchableOpacity>

          {/* Athlete Card */}
          <TouchableOpacity
            style={styles.roleCard}
            onPress={() => setRole('athlete')}
            data-testid="role-athlete-btn"
          >
            <View style={[styles.roleIconContainer, styles.athleteIconBg]}>
              <Ionicons name="accessibility" size={28} color="#7CFC00" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>Atleta</Text>
              <Text style={styles.roleDescription}>Allenati. Resisti. Migliora ogni giorno.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#7CFC00" />
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>VALHALLAN RUNNERS</Text>
          </View>
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

            <View style={styles.loginLogoContainer}>
              <Image
                source={require('../assets/images/stridex-logo.png')}
                style={styles.loginLogo}
                resizeMode="contain"
              />
              <Text style={styles.loginTitle}>Accesso Coach</Text>
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
                placeholder="--------"
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

          <View style={styles.loginLogoContainer}>
            <Image
              source={require('../assets/images/stridex-logo.png')}
              style={styles.loginLogo}
              resizeMode="contain"
            />
            <Text style={styles.loginTitle}>Accesso Atleta</Text>
            <Text style={styles.loginSubtitle}>Allenati. Resisti. Migliora ogni giorno.</Text>
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
              <Ionicons name="information-circle" size={16} color="#7CFC00" />
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
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 160,
    height: 160,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  selectScrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  // Back button
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
  // Logo section
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 200,
    height: 120,
    marginBottom: 8,
  },
  poweredBy: {
    fontSize: 13,
    color: '#888',
    letterSpacing: 0.5,
  },
  // Quote
  quoteContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 30,
  },
  // Select title
  selectTitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  // Role cards
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 252, 0, 0.15)',
  },
  roleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  coachIconBg: {
    backgroundColor: 'rgba(255, 179, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.3)',
  },
  athleteIconBg: {
    backgroundColor: 'rgba(124, 252, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 252, 0, 0.25)',
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
    color: '#AAA',
    marginTop: 3,
  },
  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 10,
  },
  footerLine: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(124, 252, 0, 0.4)',
    marginBottom: 12,
    borderRadius: 1,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 3,
    fontWeight: '600',
  },
  // Login screens
  loginLogoContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loginLogo: {
    width: 140,
    height: 80,
    marginBottom: 12,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  loginSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
  },
  formCard: {
    marginTop: 16,
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
    color: '#7CFC00',
    fontWeight: '600',
  },
  codeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
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
