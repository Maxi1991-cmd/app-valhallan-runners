import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/hooks/useTranslation';

export default function CreateAthlete() {
  const router = useRouter();
  const { createAthlete } = useDataStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    notes: '',
  });

  const handleCreate = async () => {
    if (!form.name || !form.email) {
      Alert.alert(t('common.error'), t('errors.requiredFields'));
      return;
    }

    setLoading(true);
    try {
      await createAthlete(form);
      Alert.alert(t('common.success'), t('athlete.athleteCreated'));
      router.back();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || t('errors.generic');
      const isSubscriptionError = error.response?.status === 403;
      
      if (isSubscriptionError) {
        // Errore limite atleti - offri opzione di tornare indietro o andare all'abbonamento
        Alert.alert(
          t('common.error'),
          errorMessage,
          [
            {
              text: t('common.back'),
              onPress: () => router.back(),
              style: 'cancel'
            },
            {
              text: t('subscription.manage'),
              onPress: () => router.replace('/(tabs)/profile')
            }
          ]
        );
      } else {
        Alert.alert(
          t('common.error'),
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>{t('athlete.basicInfo')}</Text>
          
          <Input
            label={`${t('auth.fullName')} *`}
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Mario Rossi"
            autoCapitalize="words"
          />

          <Input
            label={`${t('auth.email')} *`}
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            placeholder="atleta@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label={t('athlete.phone')}
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            placeholder="+39 123 456 7890"
            keyboardType="phone-pad"
          />

          <Input
            label={t('athlete.birthDate')}
            value={form.birth_date}
            onChangeText={(text) => setForm({ ...form, birth_date: text })}
            placeholder="DD-MM-YYYY"
          />

          <Input
            label={t('athlete.notes')}
            value={form.notes}
            onChangeText={(text) => setForm({ ...form, notes: text })}
            placeholder={t('athlete.notesPlaceholder')}
            multiline
            numberOfLines={3}
          />

          <Button
            title={t('athlete.createAthlete')}
            onPress={handleCreate}
            loading={loading}
            size="large"
            style={styles.createButton}
          />
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
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
    marginBottom: 16,
  },
  createButton: {
    marginTop: 24,
    marginBottom: 40,
  },
});
