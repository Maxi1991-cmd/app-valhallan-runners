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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadUser(); }, []);

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
    if (!email || !password) { Alert.alert(t('common.error'), t('auth.loginError')); return; }
    setLoading(true);
    try { await login(email, password); } catch (error: any) { Alert.alert(t('common.error'), error.message); } finally { setLoading(false); }
  };

  const handleAthleteLogin = async () => {
    if (!athleteEmail || !accessCode) { Alert.alert(t('common.error'), t('auth.loginError')); return; }
    setLoading(true);
    try { await athleteLogin(athleteEmail, accessCode); } catch (error: any) { Alert.alert(t('common.error'), error.message); } finally { setLoading(false); }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../assets/images/stridex-text-logo.png')} style={{ width: 180, height: 62 }} resizeMode="contain" />
      </View>
    );
  }

  // === ROLE SELECTION ===
  if (role === 'select') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.selectScroll} showsVerticalScrollIndicator={false}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Image source={require('../assets/images/stridex-text-logo.png')} style={styles.heroLogo} resizeMode="contain" />
              <Text style={styles.poweredBy}>Powered by Valhallan Runners</Text>
            </View>

            {/* Quote */}
            <View style={styles.quoteWrap}>
              <Text style={styles.quoteLine}>Non temere la fatica.</Text>
              <Text style={styles.quoteLine}>Temi di non provarci.</Text>
            </View>

            <Text style={styles.chooseText}>Scegli chi vuoi essere oggi</Text>

            {/* Coach Card */}
            <TouchableOpacity style={styles.glowCard} onPress={() => setRole('coach')} activeOpacity={0.8} data-testid="role-coach-btn">
              <View style={styles.glowCardInner}>
                <View style={[styles.iconRing, { borderColor: 'rgba(255,179,0,0.5)', backgroundColor: 'rgba(255,179,0,0.08)' }]}>  
                  <Ionicons name="shield-checkmark" size={26} color="#FFB300" />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Coach</Text>
                  <Text style={styles.cardDesc}>Guida. Programma. Fai crescere i tuoi atleti.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#7CFC00" />
              </View>
            </TouchableOpacity>

            {/* Athlete Card */}
            <TouchableOpacity style={styles.glowCard} onPress={() => setRole('athlete')} activeOpacity={0.8} data-testid="role-athlete-btn">
              <View style={styles.glowCardInner}>
                <View style={[styles.iconRing, { borderColor: 'rgba(124,252,0,0.4)', backgroundColor: 'rgba(124,252,0,0.06)' }]}>
                  <Ionicons name="accessibility" size={26} color="#7CFC00" />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>Atleta</Text>
                  <Text style={styles.cardDesc}>Allenati. Resisti. Migliora ogni giorno.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#7CFC00" />
              </View>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footerWrap}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerBrand}>VALHALLAN RUNNERS</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // === COACH LOGIN ===
  if (role === 'coach') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.loginScroll}>
            <TouchableOpacity style={styles.backRow} onPress={() => setRole('select')}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
              <Text style={styles.backLabel}>{t('common.back')}</Text>
            </TouchableOpacity>
            <View style={styles.loginLogoWrap}>
              <Image source={require('../assets/images/stridex-text-logo.png')} style={{ width: 150, height: 52 }} resizeMode="contain" />
              <Text style={styles.loginHeading}>Accesso Coach</Text>
            </View>
            <Card style={styles.formCard}>
              <Input label={t('auth.email')} value={email} onChangeText={setEmail} placeholder="coach@email.com" keyboardType="email-address" autoCapitalize="none" />
              <Input label={t('auth.password')} value={password} onChangeText={setPassword} placeholder="--------" secureTextEntry />
              <Button title={loading ? t('common.loading') : t('auth.login')} onPress={handleCoachLogin} disabled={loading} style={styles.loginBtn} />
              <TouchableOpacity style={styles.regLink} onPress={() => router.push('/register')}>
                <Text style={styles.regText}>{t('auth.noAccount')} <Text style={styles.regBold}>{t('auth.register')}</Text></Text>
              </TouchableOpacity>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // === ATHLETE LOGIN ===
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.loginScroll}>
          <TouchableOpacity style={styles.backRow} onPress={() => setRole('select')}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
            <Text style={styles.backLabel}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View style={styles.loginLogoWrap}>
            <Image source={require('../assets/images/stridex-text-logo.png')} style={{ width: 150, height: 52 }} resizeMode="contain" />
            <Text style={styles.loginHeading}>Accesso Atleta</Text>
            <Text style={styles.loginSub}>Allenati. Resisti. Migliora ogni giorno.</Text>
          </View>
          <Card style={styles.formCard}>
            <Input label={t('auth.email')} value={athleteEmail} onChangeText={setAthleteEmail} placeholder="atleta@email.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label={t('auth.accessCode')} value={accessCode} onChangeText={(t) => setAccessCode(t.toUpperCase())} placeholder={t('auth.accessCodePlaceholder')} autoCapitalize="characters" maxLength={6} />
            <View style={styles.hintRow}>
              <Ionicons name="information-circle" size={16} color="#7CFC00" />
              <Text style={styles.hintText}>{t('auth.athleteAccessInfo')}</Text>
            </View>
            <Button title={loading ? t('common.loading') : t('auth.login')} onPress={handleAthleteLogin} disabled={loading} style={styles.loginBtn} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' },

  // === SELECT SCREEN ===
  selectScroll: { flexGrow: 1, paddingHorizontal: 28, justifyContent: 'center', paddingVertical: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  heroLogo: { width: 220, height: 76, marginBottom: 10 },
  poweredBy: { fontSize: 13, color: '#777', letterSpacing: 0.3 },
  quoteWrap: { alignItems: 'center', marginBottom: 20 },
  quoteLine: { fontSize: 21, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', fontStyle: 'italic', lineHeight: 30 },
  chooseText: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 22, letterSpacing: 0.4 },

  // Glow cards
  glowCard: {
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124,252,0,0.18)',
    backgroundColor: 'rgba(18,18,18,0.92)',
    // shadow for glow effect
    shadowColor: '#7CFC00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  glowCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTextWrap: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  cardDesc: { fontSize: 12.5, color: '#AAA', marginTop: 3 },

  // Footer
  footerWrap: { alignItems: 'center', marginTop: 44, paddingBottom: 8 },
  footerDivider: { width: 50, height: 2, backgroundColor: 'rgba(124,252,0,0.35)', borderRadius: 1, marginBottom: 10 },
  footerBrand: { fontSize: 11, color: '#555', letterSpacing: 3.5, fontWeight: '600' },

  // === LOGIN SCREENS ===
  loginScroll: { flexGrow: 1, padding: 24 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backLabel: { color: '#FFF', fontSize: 16 },
  loginLogoWrap: { alignItems: 'center', marginVertical: 20 },
  loginHeading: { fontSize: 22, fontWeight: '700', color: '#FFF', marginTop: 12 },
  loginSub: { fontSize: 13, color: '#888', marginTop: 4 },
  formCard: { marginTop: 12 },
  loginBtn: { marginTop: 16 },
  regLink: { marginTop: 20, alignItems: 'center' },
  regText: { color: '#999', fontSize: 14 },
  regBold: { color: '#7CFC00', fontWeight: '600' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#151515', padding: 12, borderRadius: 8, marginTop: 8 },
  hintText: { color: '#999', fontSize: 12, flex: 1 },
});
