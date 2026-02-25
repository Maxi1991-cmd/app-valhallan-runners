import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateAthlete() {
  const router = useRouter();
  const { createAthlete } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    notes: '',
    password: '',
  });

  const handleCreate = async () => {
    if (!form.name || !form.email) {
      Alert.alert('Errore', 'Nome ed email sono obbligatori');
      return;
    }

    setLoading(true);
    try {
      await createAthlete(form);
      Alert.alert('Successo', 'Atleta creato con successo');
      router.back();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante la creazione');
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
          <Text style={styles.sectionTitle}>Informazioni Base</Text>
          
          <Input
            label="Nome Completo *"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Mario Rossi"
            autoCapitalize="words"
          />

          <Input
            label="Email *"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            placeholder="atleta@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Telefono"
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            placeholder="+39 123 456 7890"
            keyboardType="phone-pad"
          />

          <Input
            label="Data di Nascita"
            value={form.birth_date}
            onChangeText={(text) => setForm({ ...form, birth_date: text })}
            placeholder="GG-MM-AAAA"
          />

          <Input
            label="Note"
            value={form.notes}
            onChangeText={(text) => setForm({ ...form, notes: text })}
            placeholder="Note aggiuntive sull'atleta..."
            multiline
            numberOfLines={3}
          />

          <Button
            title="Crea Atleta"
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
  sectionNote: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  createButton: {
    marginTop: 24,
    marginBottom: 40,
  },
});
