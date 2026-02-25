import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useDataStore } from '../../src/store/dataStore';
import { analyticsAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../../src/hooks/useTranslation';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

export default function CompareTab() {
  const { athletes, fetchAthletes } = useDataStore();
  const { t } = useTranslation();
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [period1Start, setPeriod1Start] = useState('');
  const [period1End, setPeriod1End] = useState('');
  const [period2Start, setPeriod2Start] = useState('');
  const [period2End, setPeriod2End] = useState('');
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAthletes();
  }, []);

  const loadComparison = async () => {
    if (!selectedAthlete || !period1Start || !period1End || !period2Start || !period2End) {
      Alert.alert(t('common.error'), t('errors.requiredFields'));
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${BASE_URL}/api/analytics/compare/${selectedAthlete}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            period1_start: period1Start,
            period1_end: period1End,
            period2_start: period2Start,
            period2_end: period2End,
          },
        }
      );
      setComparison(response.data);
    } catch (error) {
      console.error('Error loading comparison:', error);
      Alert.alert(t('common.error'), t('errors.loadingFailed'));
    }
    setLoading(false);
  };

  const clearComparison = () => {
    setComparison(null);
    setPeriod1Start('');
    setPeriod1End('');
    setPeriod2Start('');
    setPeriod2End('');
    setSelectedAthlete(null);
  };

  const renderStatComparison = (
    label: string,
    value1: any,
    value2: any,
    unit: string,
    diffPct: number | null,
    higherIsBetter: boolean = true
  ) => {
    const improved = diffPct !== null && (higherIsBetter ? diffPct > 0 : diffPct < 0);
    const declined = diffPct !== null && (higherIsBetter ? diffPct < 0 : diffPct > 0);

    return (
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValues}>
          <View style={styles.statPeriod}>
            <Text style={styles.periodLabel}>Periodo 1</Text>
            <Text style={styles.statValue}>
              {value1 !== null ? `${value1} ${unit}` : '--'}
            </Text>
          </View>
          <View style={styles.statArrow}>
            {diffPct !== null && (
              <>
                <Ionicons
                  name={improved ? 'arrow-up' : declined ? 'arrow-down' : 'remove'}
                  size={20}
                  color={improved ? '#4CAF50' : declined ? '#F44336' : '#999'}
                />
                <Text
                  style={[
                    styles.diffText,
                    improved && styles.improvedText,
                    declined && styles.declinedText,
                  ]}
                >
                  {Math.abs(diffPct)}%
                </Text>
              </>
            )}
          </View>
          <View style={styles.statPeriod}>
            <Text style={styles.periodLabel}>Periodo 2</Text>
            <Text style={styles.statValue}>
              {value2 !== null ? `${value2} ${unit}` : '--'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Confronta Periodi</Text>
          <Text style={styles.headerSubtitle}>Analizza i progressi nel tempo</Text>
        </View>

        {/* Athlete Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona Atleta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {athletes.map((athlete) => (
              <TouchableOpacity
                key={athlete.id}
                style={[
                  styles.athleteChip,
                  selectedAthlete === athlete.id && styles.athleteChipActive,
                ]}
                onPress={() => setSelectedAthlete(athlete.id)}
              >
                <Text
                  style={[
                    styles.athleteChipText,
                    selectedAthlete === athlete.id && styles.athleteChipTextActive,
                  ]}
                >
                  {athlete.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Period 1 */}
        <Card title="Periodo 1 (Recente)" style={styles.periodCard}>
          <View style={styles.dateRow}>
            <Input
              label="Inizio"
              value={period1Start}
              onChangeText={setPeriod1Start}
              placeholder="GG/MM/AAAA"
              containerStyle={styles.dateInput}
            />
            <Input
              label="Fine"
              value={period1End}
              onChangeText={setPeriod1End}
              placeholder="GG/MM/AAAA"
              containerStyle={styles.dateInput}
            />
          </View>
        </Card>

        {/* Period 2 */}
        <Card title="Periodo 2 (Precedente)" style={styles.periodCard}>
          <View style={styles.dateRow}>
            <Input
              label="Inizio"
              value={period2Start}
              onChangeText={setPeriod2Start}
              placeholder="GG/MM/AAAA"
              containerStyle={styles.dateInput}
            />
            <Input
              label="Fine"
              value={period2End}
              onChangeText={setPeriod2End}
              placeholder="GG/MM/AAAA"
              containerStyle={styles.dateInput}
            />
          </View>
        </Card>

        <View style={styles.buttonRow}>
          <Button
            title="Confronta"
            onPress={loadComparison}
            loading={loading}
            style={styles.compareButton}
          />
          {comparison && (
            <Button
              title="Cancella"
              onPress={clearComparison}
              variant="outline"
              style={styles.clearButton}
            />
          )}
        </View>

        {/* Comparison Results */}
        {comparison && (
          <>
            {/* Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryBadge,
                    comparison.summary.improved_distance
                      ? styles.improvedBadge
                      : styles.declinedBadge,
                  ]}
                >
                  <Ionicons
                    name={comparison.summary.improved_distance ? 'trending-up' : 'trending-down'}
                    size={20}
                    color={comparison.summary.improved_distance ? '#4CAF50' : '#F44336'}
                  />
                  <Text
                    style={[
                      styles.summaryText,
                      comparison.summary.improved_distance
                        ? styles.improvedSummary
                        : styles.declinedSummary,
                    ]}
                  >
                    {comparison.summary.improved_distance
                      ? 'Distanza aumentata'
                      : 'Distanza diminuita'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryBadge,
                    comparison.summary.improved_volume
                      ? styles.improvedBadge
                      : styles.declinedBadge,
                  ]}
                >
                  <Ionicons
                    name={comparison.summary.improved_volume ? 'trending-up' : 'trending-down'}
                    size={20}
                    color={comparison.summary.improved_volume ? '#4CAF50' : '#F44336'}
                  />
                  <Text
                    style={[
                      styles.summaryText,
                      comparison.summary.improved_volume
                        ? styles.improvedSummary
                        : styles.declinedSummary,
                    ]}
                  >
                    {comparison.summary.improved_volume
                      ? 'Volume aumentato'
                      : 'Volume diminuito'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Detailed Stats */}
            <Card title="Confronto Dettagliato" style={styles.detailCard}>
              {renderStatComparison(
                'Distanza Totale',
                comparison.period1.stats.total_distance_km,
                comparison.period2.stats.total_distance_km,
                'km',
                comparison.differences.distance_change_pct
              )}
              {renderStatComparison(
                'Durata Totale',
                comparison.period1.stats.total_duration_minutes,
                comparison.period2.stats.total_duration_minutes,
                'min',
                comparison.differences.duration_change_pct
              )}
              {renderStatComparison(
                'N° Allenamenti',
                comparison.period1.stats.total_activities,
                comparison.period2.stats.total_activities,
                '',
                comparison.differences.activities_change_pct
              )}
              {renderStatComparison(
                'Media per Allenamento',
                comparison.period1.stats.avg_distance_per_activity,
                comparison.period2.stats.avg_distance_per_activity,
                'km',
                null
              )}
              {renderStatComparison(
                'Passo Medio',
                comparison.period1.stats.avg_pace,
                comparison.period2.stats.avg_pace,
                'min/km',
                null,
                false
              )}
              {renderStatComparison(
                'FC Media',
                comparison.period1.stats.avg_heart_rate,
                comparison.period2.stats.avg_heart_rate,
                'bpm',
                null,
                false
              )}
            </Card>
          </>
        )}

        {!comparison && !loading && selectedAthlete && (
          <View style={styles.emptyContainer}>
            <Ionicons name="git-compare-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Inserisci le date</Text>
            <Text style={styles.emptySubtext}>
              Per confrontare i dati tra due periodi
            </Text>
          </View>
        )}

        {!selectedAthlete && (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Seleziona un atleta</Text>
            <Text style={styles.emptySubtext}>Per iniziare il confronto</Text>
          </View>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 12,
  },
  athleteChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  athleteChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  athleteChipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  athleteChipTextActive: {
    color: '#FFF',
  },
  periodCard: {
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  compareButton: {
    flex: 1,
  },
  clearButton: {
    flex: 1,
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  improvedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  declinedBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  improvedSummary: {
    color: '#4CAF50',
  },
  declinedSummary: {
    color: '#F44336',
  },
  detailCard: {
    marginBottom: 20,
  },
  statRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statPeriod: {
    flex: 1,
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  statArrow: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  diffText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginTop: 2,
  },
  improvedText: {
    color: '#4CAF50',
  },
  declinedText: {
    color: '#F44336',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
});
