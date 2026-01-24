import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useDataStore } from '../../src/store/dataStore';
import { analyticsAPI } from '../../src/services/api';
import { Card } from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnalyticsTab() {
  const { athletes, fetchAthletes } = useDataStore();
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
    week: 'Settimana',
    month: 'Mese',
    year: 'Anno',
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
          <Text style={styles.headerTitle}>Analisi Dati</Text>
          <Text style={styles.headerSubtitle}>Monitora le performance</Text>
        </View>

        {/* Athlete Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleziona Atleta</Text>
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
                </View>

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
