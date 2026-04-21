import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../../src/store/dataStore';
import { athleteAPI } from '../../../src/services/api';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AthleteProfile } from '../../../src/types';

export default function EditAthlete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { updateAthlete } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    notes: '',
  });

  const [biometrics, setBiometrics] = useState({
    heart_rate_max: '',
    heart_rate_rest: '',
    vo2_max: '',
    lactate_threshold: '',
    weight: '',
    height: '',
  });

  const [certificate, setCertificate] = useState({
    issue_date: '',
    expiry_date: '',
  });

  const [newPayment, setNewPayment] = useState({
    month: '',
    amount: '',
    due_date: '',
  });

  useEffect(() => {
    loadAthlete();
  }, [id]);

  const loadAthlete = async () => {
    try {
      const response = await athleteAPI.getOne(id!);
      const data = response.data;
      setAthlete(data);
      setForm({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        birth_date: data.birth_date || '',
        notes: data.notes || '',
      });
      setBiometrics({
        heart_rate_max: data.biometrics?.heart_rate_max?.toString() || '',
        heart_rate_rest: data.biometrics?.heart_rate_rest?.toString() || '',
        vo2_max: data.biometrics?.vo2_max?.toString() || '',
        lactate_threshold: data.biometrics?.lactate_threshold?.toString() || '',
        weight: data.biometrics?.weight?.toString() || '',
        height: data.biometrics?.height?.toString() || '',
      });
      setCertificate({
        issue_date: data.medical_certificate?.issue_date || '',
        expiry_date: data.medical_certificate?.expiry_date || '',
      });
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare atleta');
      router.push('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      Alert.alert('Errore', 'Nome ed email sono obbligatori');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        ...form,
        biometrics: {
          heart_rate_max: biometrics.heart_rate_max ? parseInt(biometrics.heart_rate_max) : null,
          heart_rate_rest: biometrics.heart_rate_rest ? parseInt(biometrics.heart_rate_rest) : null,
          vo2_max: biometrics.vo2_max ? parseFloat(biometrics.vo2_max) : null,
          lactate_threshold: biometrics.lactate_threshold ? parseInt(biometrics.lactate_threshold) : null,
          weight: biometrics.weight ? parseFloat(biometrics.weight) : null,
          height: biometrics.height ? parseInt(biometrics.height) : null,
        },
        medical_certificate: {
          issue_date: certificate.issue_date || null,
          expiry_date: certificate.expiry_date || null,
        },
      };

      await updateAthlete(id!, updateData);
      Alert.alert('Successo', 'Atleta aggiornato');
      router.push(`/athlete/${id}`);
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.month || !newPayment.amount || !newPayment.due_date) {
      Alert.alert('Errore', 'Compila tutti i campi del pagamento');
      return;
    }

    try {
      await athleteAPI.addPayment(id!, {
        month: newPayment.month,
        amount: parseFloat(newPayment.amount),
        due_date: newPayment.due_date,
        paid: false,
      });
      Alert.alert('Successo', 'Pagamento aggiunto');
      setNewPayment({ month: '', amount: '', due_date: '' });
      loadAthlete();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiungere pagamento');
    }
  };

  if (loading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.backHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Indietro</Text>
        </TouchableOpacity>
      </View>
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
            placeholder="Note aggiuntive..."
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Dati Biometrici</Text>

          <View style={styles.row}>
            <Input
              label="FC Max (bpm)"
              value={biometrics.heart_rate_max}
              onChangeText={(text) => setBiometrics({ ...biometrics, heart_rate_max: text })}
              placeholder="190"
              keyboardType="numeric"
              containerStyle={styles.halfInput}
            />
            <Input
              label="FC Riposo (bpm)"
              value={biometrics.heart_rate_rest}
              onChangeText={(text) => setBiometrics({ ...biometrics, heart_rate_rest: text })}
              placeholder="55"
              keyboardType="numeric"
              containerStyle={styles.halfInput}
            />
          </View>

          <View style={styles.row}>
            <Input
              label="VO2max"
              value={biometrics.vo2_max}
              onChangeText={(text) => setBiometrics({ ...biometrics, vo2_max: text })}
              placeholder="55.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
            <Input
              label="Soglia Lattato (bpm)"
              value={biometrics.lactate_threshold}
              onChangeText={(text) => setBiometrics({ ...biometrics, lactate_threshold: text })}
              placeholder="175"
              keyboardType="numeric"
              containerStyle={styles.halfInput}
            />
          </View>

          <View style={styles.row}>
            <Input
              label="Peso (kg)"
              value={biometrics.weight}
              onChangeText={(text) => setBiometrics({ ...biometrics, weight: text })}
              placeholder="70.5"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
            <Input
              label="Altezza (cm)"
              value={biometrics.height}
              onChangeText={(text) => setBiometrics({ ...biometrics, height: text })}
              placeholder="175"
              keyboardType="numeric"
              containerStyle={styles.halfInput}
            />
          </View>

          <Text style={styles.sectionTitle}>Certificato Medico</Text>

          <View style={styles.row}>
            <Input
              label="Data Rilascio"
              value={certificate.issue_date}
              onChangeText={(text) => setCertificate({ ...certificate, issue_date: text })}
              placeholder="GG-MM-AAAA"
              containerStyle={styles.halfInput}
            />
            <Input
              label="Data Scadenza"
              value={certificate.expiry_date}
              onChangeText={(text) => setCertificate({ ...certificate, expiry_date: text })}
              placeholder="GG-MM-AAAA"
              containerStyle={styles.halfInput}
            />
          </View>

          <Text style={styles.sectionTitle}>Nuovo Pagamento</Text>

          <Card style={styles.paymentCard}>
            <Input
              label="Mese (es. 2024-01)"
              value={newPayment.month}
              onChangeText={(text) => setNewPayment({ ...newPayment, month: text })}
              placeholder="YYYY-MM"
            />
            <View style={styles.row}>
              <Input
                label="Importo (€)"
                value={newPayment.amount}
                onChangeText={(text) => setNewPayment({ ...newPayment, amount: text })}
                placeholder="50"
                keyboardType="decimal-pad"
                containerStyle={styles.halfInput}
              />
              <Input
                label="Scadenza"
                value={newPayment.due_date}
                onChangeText={(text) => setNewPayment({ ...newPayment, due_date: text })}
                placeholder="GG-MM-AAAA"
                containerStyle={styles.halfInput}
              />
            </View>
            <Button
              title="Aggiungi Pagamento"
              onPress={handleAddPayment}
              variant="secondary"
              size="small"
            />
          </Card>

          <Button
            title="Salva Modifiche"
            onPress={handleSave}
            loading={saving}
            size="large"
            style={styles.saveButton}
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
  backHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  paymentCard: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 40,
  },
});
