import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useDataStore } from '../../src/store/dataStore';
import { analyticsAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/hooks/useTranslation';

export default function AnalyticsTab() {
  const { athletes, fetchAthletes } = useDataStore();
  const { t } = useTranslation();
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAthletes();
  }, []);

  useEffect(() => {
    if (selectedAthlete) {
      loadAnalytics();
    }
  }, [selectedAthlete, period]);

  const loadAnalytics = async () => {
    if (!selectedAthlete) return;
    setLoading(true);
    try {
      const response = await analyticsAPI.getAthleteAnalytics(selectedAthlete, period);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const periodLabels = {
    week: t('analytics.week'),
    month: t('analytics.month'),
    year: t('analytics.year'),
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('analytics.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('analytics.subtitle')}</Text>
        </View>

        {/* Athlete Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('program.selectAthlete')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.athleteScroll}>
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

        {selectedAthlete && (
          <>
            {/* Period Selector */}
            <View style={styles.periodContainer}>
              {(['week', 'month', 'year'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.periodButton,
                    period === p && styles.periodButtonActive,
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      period === p && styles.periodButtonTextActive,
                    ]}
                  >
                    {periodLabels[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Caricamento...</Text>
              </View>
            ) : analytics ? (
              <>
                {/* Summary Cards */}
                <View style={styles.statsGrid}>
                  <Card style={styles.statCard}>
                    <Ionicons name="footsteps" size={28} color="#FF6B35" />
                    <Text style={styles.statValue}>{analytics.total_distance_km} km</Text>
                    <Text style={styles.statLabel}>Distanza Totale</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <Ionicons name="time" size={28} color="#4CAF50" />
                    <Text style={styles.statValue}>
                      {Math.floor(analytics.total_duration_minutes / 60)}h{' '}
                      {analytics.total_duration_minutes % 60}m
                    </Text>
                    <Text style={styles.statLabel}>Tempo Totale</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <Ionicons name="fitness" size={28} color="#2196F3" />
                    <Text style={styles.statValue}>{analytics.total_activities}</Text>
                    <Text style={styles.statLabel}>Allenamenti</Text>
                  </Card>
                  <Card style={styles.statCard}>
                    <Ionicons name="trending-up" size={28} color="#9C27B0" />
                    <Text style={styles.statValue}>{analytics.avg_distance_per_activity} km</Text>
                    <Text style={styles.statLabel}>Media/Allenamento</Text>
                  </Card>
                  {analytics.total_calories > 0 && (
                    <Card style={styles.statCard}>
                      <Ionicons name="flame" size={28} color="#FF5722" />
                      <Text style={styles.statValue}>{analytics.total_calories}</Text>
                      <Text style={styles.statLabel}>Calorie Totali</Text>
                    </Card>
                  )}
                  {analytics.avg_heart_rate && (
                    <Card style={styles.statCard}>
                      <Ionicons name="heart" size={28} color="#E91E63" />
                      <Text style={styles.statValue}>{analytics.avg_heart_rate} bpm</Text>
                      <Text style={styles.statLabel}>FC Media</Text>
                    </Card>
                  )}
                </View>

                {/* Program Progress */}
                {analytics.program_progress?.length > 0 && (
                  <Card title="Progresso Programmi" style={styles.progressCard}>
                    {analytics.program_progress.map((prog: any, idx: number) => (
                      <View key={idx} style={styles.programRow}>
                        <View style={styles.programInfo}>
                          <Text style={styles.programName} numberOfLines={1}>{prog.name}</Text>
                          <Text style={styles.programCount}>
                            {prog.completed_workouts}/{prog.total_workouts}
                          </Text>
                        </View>
                        <View style={styles.programBarContainer}>
                          <View style={[styles.programBar, { width: `${prog.progress_pct}%` }]} />
                        </View>
                        <Text style={styles.programPct}>{prog.progress_pct}%</Text>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Activity Type Distribution */}
                {analytics.type_distribution && Object.keys(analytics.type_distribution).length > 0 && (
                  <Card title="Tipo Allenamento" style={styles.typeCard}>
                    <View style={styles.typeList}>
                      {Object.entries(analytics.type_distribution).map(([type, count]: [string, any]) => {
                        const typeLabels: Record<string, string> = {
                          running: 'Corsa', easy: 'Facile', tempo: 'Tempo',
                          interval: 'Ripetute', long_run: 'Lungo', recovery: 'Recupero',
                          fartlek: 'Fartlek', hill: 'Salite', race: 'Gara',
                          cycling: 'Ciclismo', swimming: 'Nuoto', walking: 'Camminata',
                          trail: 'Trail', other: 'Altro',
                        };
                        const typeColors: Record<string, string> = {
                          running: '#FF6B35', easy: '#4CAF50', tempo: '#FF9800',
                          interval: '#F44336', long_run: '#2196F3', recovery: '#9C27B0',
                          fartlek: '#FF5722', hill: '#795548', race: '#E91E63',
                          cycling: '#00BCD4', swimming: '#3F51B5', walking: '#8BC34A',
                          trail: '#795548', other: '#607D8B',
                        };
                        const total = Object.values(analytics.type_distribution).reduce(
                          (a: number, b: any) => a + (b as number), 0
                        ) as number;
                        const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                        return (
                          <View key={type} style={styles.typeRow}>
                            <View style={styles.typeInfo}>
                              <View style={[styles.typeDot, { backgroundColor: typeColors[type] || '#666' }]} />
                              <Text style={styles.typeName}>{typeLabels[type] || type}</Text>
                            </View>
                            <View style={styles.typeBarContainer}>
                              <View style={[styles.typeBar, { width: `${pct}%`, backgroundColor: typeColors[type] || '#666' }]} />
                            </View>
                            <Text style={styles.typeCount}>{count as number}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Card>
                )}

                {/* Weekly Distance Trend */}
                {analytics.weekly_trend?.length > 0 && (
                  <Card title="Distanza Settimanale" style={styles.weeklyCard}>
                    {analytics.weekly_trend.slice(-8).map((item: any, index: number) => {
                      const maxDist = Math.max(...analytics.weekly_trend.map((w: any) => w.distance_km));
                      const barPct = maxDist > 0 ? (item.distance_km / maxDist) * 100 : 0;
                      return (
                        <View key={index} style={styles.weeklyRow}>
                          <Text style={styles.weeklyDate}>{item.week.slice(5)}</Text>
                          <View style={styles.weeklyBarContainer}>
                            <View style={[styles.weeklyBar, { width: `${barPct}%` }]} />
                          </View>
                          <Text style={styles.weeklyValue}>{item.distance_km} km</Text>
                        </View>
                      );
                    })}
                  </Card>
                )}

                {/* Biometrics */}
                {analytics.biometrics && (
                  <Card title="Dati Biometrici" style={styles.biometricsCard}>
                    <View style={styles.biometricsGrid}>
                      <View style={styles.biometricItem}>
                        <Ionicons name="heart" size={20} color="#FF6B35" />
                        <Text style={styles.biometricValue}>
                          {analytics.biometrics.heart_rate_max || '--'}
                        </Text>
                        <Text style={styles.biometricLabel}>FC Max</Text>
                      </View>
                      <View style={styles.biometricItem}>
                        <Ionicons name="heart-outline" size={20} color="#4CAF50" />
                        <Text style={styles.biometricValue}>
                          {analytics.biometrics.heart_rate_rest || '--'}
                        </Text>
                        <Text style={styles.biometricLabel}>FC Riposo</Text>
                      </View>
                      <View style={styles.biometricItem}>
                        <Ionicons name="speedometer" size={20} color="#2196F3" />
                        <Text style={styles.biometricValue}>
                          {analytics.biometrics.vo2_max || '--'}
                        </Text>
                        <Text style={styles.biometricLabel}>VO2max</Text>
                      </View>
                      <View style={styles.biometricItem}>
                        <Ionicons name="flash" size={20} color="#FF9800" />
                        <Text style={styles.biometricValue}>
                          {analytics.biometrics.lactate_threshold || '--'}
                        </Text>
                        <Text style={styles.biometricLabel}>Soglia</Text>
                      </View>
                    </View>
                  </Card>
                )}

                {/* Heart Rate Zones */}
                <Card title="Zone Cardiache" style={styles.zonesCard}>
                  <View style={styles.zonesList}>
                    {Object.entries(analytics.heart_rate_zones).map(([zone, count], index) => {
                      const zoneColors = ['#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800', '#F44336'];
                      const zoneNames = ['Recupero', 'Aerobica', 'Tempo', 'Soglia', 'VO2max'];
                      const total = Object.values(analytics.heart_rate_zones).reduce(
                        (a: number, b: any) => a + (b as number),
                        0
                      ) as number;
                      const percentage = total > 0 ? ((count as number) / total) * 100 : 0;

                      return (
                        <View key={zone} style={styles.zoneRow}>
                          <View style={styles.zoneInfo}>
                            <View
                              style={[
                                styles.zoneColor,
                                { backgroundColor: zoneColors[index] },
                              ]}
                            />
                            <Text style={styles.zoneName}>{zoneNames[index]}</Text>
                          </View>
                          <View style={styles.zoneBarContainer}>
                            <View
                              style={[
                                styles.zoneBar,
                                {
                                  width: `${percentage}%`,
                                  backgroundColor: zoneColors[index],
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.zoneCount}>{count as number}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Card>

                {/* Pace Trend */}
                {analytics.pace_trend?.length > 0 && (
                  <Card title="Andamento Ritmo" style={styles.trendCard}>
                    {analytics.pace_trend.map((item: any, index: number) => (
                      <View key={index} style={styles.trendRow}>
                        <Text style={styles.trendDate}>{item.date}</Text>
                        <Text style={styles.trendPace}>{item.pace}</Text>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            ) : null}
          </>
        )}

        {!selectedAthlete && athletes.length > 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Seleziona un atleta</Text>
            <Text style={styles.emptySubtext}>Per visualizzare le statistiche</Text>
          </View>
        )}

        {athletes.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Nessun atleta</Text>
            <Text style={styles.emptySubtext}>Aggiungi atleti per vedere le analisi</Text>
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
  athleteScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
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
  periodContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#FF6B35',
  },
  periodButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  biometricsCard: {
    marginBottom: 12,
  },
  biometricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  biometricItem: {
    alignItems: 'center',
    flex: 1,
  },
  biometricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 6,
  },
  biometricLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  zonesCard: {
    marginBottom: 12,
  },
  zonesList: {
    gap: 10,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
  },
  zoneColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  zoneName: {
    fontSize: 12,
    color: '#CCC',
  },
  zoneBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  zoneBar: {
    height: '100%',
    borderRadius: 4,
  },
  zoneCount: {
    width: 30,
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
  },
  trendCard: {
    marginBottom: 12,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  trendDate: {
    fontSize: 14,
    color: '#999',
  },
  trendPace: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  // Program Progress
  progressCard: {
    marginBottom: 12,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  programInfo: {
    width: 100,
  },
  programName: {
    fontSize: 13,
    color: '#CCC',
    fontWeight: '500',
  },
  programCount: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  programBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  programBar: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  programPct: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },
  // Type Distribution
  typeCard: {
    marginBottom: 12,
  },
  typeList: {
    gap: 10,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  typeName: {
    fontSize: 12,
    color: '#CCC',
  },
  typeBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  typeBar: {
    height: '100%',
    borderRadius: 4,
  },
  typeCount: {
    width: 30,
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
  },
  // Weekly Trend
  weeklyCard: {
    marginBottom: 12,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyDate: {
    width: 50,
    fontSize: 12,
    color: '#999',
  },
  weeklyBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#333',
    borderRadius: 5,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  weeklyBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 5,
  },
  weeklyValue: {
    width: 60,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
