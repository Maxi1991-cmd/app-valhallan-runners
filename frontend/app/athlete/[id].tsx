import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { athleteAPI, programAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AthleteProfile, WorkoutSession } from '../../src/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const safeFormatDate = (dateString?: string | null, format?: string) => {
  try {
    if (!dateString || dateString === '') return '--';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return '--';
    }

    // Formattazione in italiano
    if (format === 'short') {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } else if (format === 'long') {
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    
    return date.toLocaleDateString('it-IT');
  } catch (e) {
    console.warn('Errore formattazione data:', dateString, e);
    return '--';
  }
};

// Funzione helper per verificare in modo sicuro le date del certificato
const safeCheckExpired = (dateString?: string | null): boolean => {
  try {
    if (!dateString || dateString === '') return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    return date < new Date();
  } catch (e) {
    return false;
  }
};

// Funzione rimossa - usiamo safeCheckExpired

export default function AthleteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deleteAthlete, programs, fetchPrograms, fetchAthletes } = useDataStore();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'payments' | 'certificate'>('info');

  const loadAthlete = async () => {
    try {
      const response = await athleteAPI.getOne(id!);
      setAthlete(response.data);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare atleta');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAthlete();
    fetchPrograms(id);
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAthlete();
    setRefreshing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Elimina Atleta',
      'Sei sicuro di voler eliminare questo atleta e tutti i suoi dati? Questa azione non può essere annullata.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sì, elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAthlete(id!);
              // Refresh della lista atleti
              await fetchAthletes();
              Alert.alert('Eliminato', 'Atleta eliminato con successo');
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare atleta');
            }
          },
        },
      ]
    );
  };

  const handleTogglePayment = async (paymentId: string, currentPaid: boolean) => {
    try {
      await athleteAPI.updatePayment(id!, paymentId, !currentPaid);
      loadAthlete();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare pagamento');
    }
  };

  const athletePrograms = programs.filter((p) => p.athlete_id === id);

  if (loading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (!athlete) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {athlete.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.athleteName}>{athlete.name}</Text>
          <Text style={styles.athleteEmail}>{athlete.email}</Text>
          {athlete.phone && (
            <Text style={styles.athletePhone}>
              <Ionicons name="call" size={12} color="#999" /> {athlete.phone}
            </Text>
          )}
          
          {/* Codice Accesso Atleta */}
          {(athlete as any).access_code && (
            <View style={styles.accessCodeContainer}>
              <Text style={styles.accessCodeLabel}>Codice Accesso Atleta:</Text>
              <Text style={styles.accessCode}>{(athlete as any).access_code}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Modifica"
            onPress={() => router.push(`/athlete/edit/${id}`)}
            variant="secondary"
            size="small"
            style={styles.actionButton}
          />
          <Button
            title="Elimina"
            onPress={handleDelete}
            variant="danger"
            size="small"
            style={styles.actionButton}
          />
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {(['info', 'payments', 'certificate'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'info' ? 'Info' : tab === 'payments' ? 'Pagamenti' : 'Certificato'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Tab */}
        {activeTab === 'info' && (
          <>
            <Card title="Dati Biometrici" style={styles.card}>
              <View style={styles.biometricsGrid}>
                <View style={styles.biometricItem}>
                  <Ionicons name="heart" size={24} color="#FF6B35" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.heart_rate_max || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>FC Max (bpm)</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="heart-outline" size={24} color="#4CAF50" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.heart_rate_rest || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>FC Riposo</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="speedometer" size={24} color="#2196F3" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.vo2_max || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>VO2max</Text>
                </View>
                <View style={styles.biometricItem}>
                  <Ionicons name="flash" size={24} color="#FF9800" />
                  <Text style={styles.biometricValue}>
                    {athlete.biometrics?.lactate_threshold || '--'}
                  </Text>
                  <Text style={styles.biometricLabel}>Soglia Lattato</Text>
                </View>
              </View>
              <View style={styles.biometricsRow}>
                <View style={styles.biometricRowItem}>
                  <Text style={styles.rowLabel}>Peso:</Text>
                  <Text style={styles.rowValue}>
                    {athlete.biometrics?.weight ? `${athlete.biometrics.weight} kg` : '--'}
                  </Text>
                </View>
                <View style={styles.biometricRowItem}>
                  <Text style={styles.rowLabel}>Altezza:</Text>
                  <Text style={styles.rowValue}>
                    {athlete.biometrics?.height ? `${athlete.biometrics.height} cm` : '--'}
                  </Text>
                </View>
              </View>
            </Card>

            <Card title="Programmi Assegnati" style={styles.card}>
              {athletePrograms.length > 0 ? (
                athletePrograms.map((program) => (
                  <TouchableOpacity
                    key={program.id}
                    style={styles.programRow}
                    onPress={() => router.push(`/program/${program.id}`)}
                  >
                    <View>
                      <Text style={styles.programName}>{program.name}</Text>
                      <Text style={styles.programDates}>
                        {safeFormatDate(program.start_date, 'short')} - {safeFormatDate(program.end_date, 'long')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>Nessun programma assegnato</Text>
              )}
              <View style={styles.buttonsRow}>
                <Button
                  title="Nuovo Programma"
                  onPress={() => router.push('/program/create')}
                  variant="outline"
                  size="small"
                  style={styles.actionButtonSmall}
                />
                <Button
                  title="Carica Attività"
                  onPress={() => router.push(`/activity/upload?athleteId=${id}`)}
                  variant="secondary"
                  size="small"
                  style={styles.actionButtonSmall}
                />
              </View>
            </Card>

            {athlete.notes && (
              <Card title="Note" style={styles.card}>
                <Text style={styles.notesText}>{athlete.notes}</Text>
              </Card>
            )}
          </>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <Card title="Pagamenti Mensili" style={styles.card}>
            {athlete.payments && athlete.payments.length > 0 ? (
              athlete.payments.map((payment) => (
                <TouchableOpacity
                  key={payment.id}
                  style={styles.paymentRow}
                  onPress={() => handleTogglePayment(payment.id, payment.paid)}
                >
                  <View style={styles.paymentInfo}>
                    <Ionicons
                      name={payment.paid ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={payment.paid ? '#4CAF50' : '#666'}
                    />
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentMonth}>{payment.month}</Text>
                      <Text style={styles.paymentDue}>Scadenza: {payment.due_date}</Text>
                    </View>
                  </View>
                  <View style={styles.paymentAmount}>
                    <Text
                      style={[
                        styles.amountText,
                        payment.paid && styles.amountPaid,
                      ]}
                    >
                      €{payment.amount}
                    </Text>
                    {payment.paid && (
                      <Text style={styles.paidDate}>Pagato: {payment.paid_date}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Nessun pagamento registrato</Text>
            )}
          </Card>
        )}

        {/* Certificate Tab */}
        {activeTab === 'certificate' && (
          <Card title="Certificato Medico Sportivo" style={styles.card}>
            <View style={styles.certificateInfo}>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Data Rilascio:</Text>
                <Text style={styles.certValue}>
                  {safeFormatDate(athlete.medical_certificate?.issue_date) !== '--' 
                    ? safeFormatDate(athlete.medical_certificate?.issue_date, 'long')
                    : 'Non inserito'}
                </Text>
              </View>
              <View style={styles.certRow}>
                <Text style={styles.certLabel}>Data Scadenza:</Text>
                <Text
                  style={[
                    styles.certValue,
                    safeCheckExpired(athlete.medical_certificate?.expiry_date) && styles.expiredText,
                  ]}
                >
                  {safeFormatDate(athlete.medical_certificate?.expiry_date) !== '--'
                    ? safeFormatDate(athlete.medical_certificate?.expiry_date, 'long')
                    : 'Non inserito'}
                </Text>
              </View>
              {athlete.medical_certificate?.expiry_date && safeFormatDate(athlete.medical_certificate?.expiry_date) !== '--' && (
                <View
                  style={[
                    styles.statusBadge,
                    safeCheckExpired(athlete.medical_certificate.expiry_date)
                      ? styles.expiredBadge
                      : styles.validBadge,
                  ]}
                >
                  <Ionicons
                    name={
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? 'close-circle'
                        : 'checkmark-circle'
                    }
                    size={16}
                    color={
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? '#DC3545'
                        : '#4CAF50'
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      safeCheckExpired(athlete.medical_certificate.expiry_date)
                        ? styles.expiredStatusText
                        : styles.validStatusText,
                    ]}
                  >
                    {safeCheckExpired(athlete.medical_certificate.expiry_date)
                      ? 'Scaduto'
                      : 'Valido'}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  athleteName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  athleteEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  athletePhone: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    minWidth: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFF',
  },
  card: {
    marginBottom: 16,
  },
  biometricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  biometricItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  biometricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  biometricLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  biometricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  biometricRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: '#999',
    fontSize: 14,
  },
  rowValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  programRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  programName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  programDates: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButtonSmall: {
    flex: 1,
  },
  newProgramButton: {
    marginTop: 12,
  },
  notesText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 22,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentDetails: {
  },
  paymentMonth: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  paymentDue: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  amountPaid: {
    color: '#4CAF50',
  },
  paidDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  certificateInfo: {
    gap: 16,
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  certLabel: {
    fontSize: 14,
    color: '#999',
  },
  certValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  expiredText: {
    color: '#DC3545',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  validBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  expiredBadge: {
    backgroundColor: 'rgba(220, 53, 69, 0.15)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  validStatusText: {
    color: '#4CAF50',
  },
  expiredStatusText: {
    color: '#DC3545',
  },
  accessCodeContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  accessCodeLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  accessCode: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: 4,
  },
});
