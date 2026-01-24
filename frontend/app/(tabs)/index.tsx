import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AthleteProfile } from '../../src/types';

export default function AthletesTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { athletes, fetchAthletes, isLoading, warnings } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAthletes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAthletes();
    setRefreshing(false);
  };

  const getAthleteWarnings = (athleteId: string) => {
    return warnings.filter(w => w.athlete_id === athleteId);
  };

  const renderAthleteCard = ({ item }: { item: AthleteProfile }) => {
    const athleteWarnings = getAthleteWarnings(item.id);
    const hasUrgentWarning = athleteWarnings.some(w => w.urgent);

    return (
      <Card
        onPress={() => router.push(`/athlete/${item.id}`)}
        style={[
          styles.athleteCard,
          hasUrgentWarning && styles.urgentCard,
        ]}
      >
        <View style={styles.athleteHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <View style={styles.athleteInfo}>
            <Text style={styles.athleteName}>{item.name}</Text>
            <Text style={styles.athleteEmail}>{item.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </View>

        {athleteWarnings.length > 0 && (
          <View style={styles.warningsContainer}>
            {athleteWarnings.slice(0, 2).map((warning, index) => (
              <View key={index} style={[styles.warningBadge, warning.urgent && styles.urgentBadge]}>
                <Ionicons
                  name={warning.type === 'payment_due' ? 'card' : 'medical'}
                  size={12}
                  color={warning.urgent ? '#FFF' : '#FFB347'}
                />
                <Text style={[styles.warningText, warning.urgent && styles.urgentText]}>
                  {warning.type === 'payment_due'
                    ? `Pagamento ${warning.month}`
                    : `Certificato scade ${warning.expiry_date}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={16} color="#FF6B35" />
            <Text style={styles.statText}>
              {item.biometrics?.heart_rate_max || '--'} bpm max
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="speedometer" size={16} color="#4CAF50" />
            <Text style={styles.statText}>
              VO2: {item.biometrics?.vo2_max || '--'}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  if (isLoading && athletes.length === 0) {
    return <LoadingScreen message="Caricamento atleti..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>I Miei Atleti</Text>
        <Text style={styles.headerSubtitle}>{athletes.length} atleti</Text>
      </View>

      {user?.role === 'coach' && (
        <Button
          title="Aggiungi Atleta"
          onPress={() => router.push('/athlete/create')}
          style={styles.addButton}
        />
      )}

      <FlatList
        data={athletes}
        keyExtractor={(item) => item.id}
        renderItem={renderAthleteCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Nessun atleta</Text>
            <Text style={styles.emptySubtext}>
              Aggiungi il tuo primo atleta per iniziare
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    padding: 20,
    paddingBottom: 8,
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
  addButton: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    padding: 20,
    paddingTop: 8,
  },
  athleteCard: {
    borderWidth: 1,
    borderColor: '#333',
  },
  urgentCard: {
    borderColor: '#DC3545',
  },
  athleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  athleteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  athleteName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  athleteEmail: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  warningsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 71, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  urgentBadge: {
    backgroundColor: '#DC3545',
  },
  warningText: {
    fontSize: 11,
    color: '#FFB347',
    fontWeight: '500',
  },
  urgentText: {
    color: '#FFF',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#999',
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
    textAlign: 'center',
  },
});
