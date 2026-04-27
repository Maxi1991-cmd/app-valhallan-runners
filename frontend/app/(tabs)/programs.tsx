import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useDataStore } from '../../src/store/dataStore';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrainingProgram } from '../../src/types';
import { format } from 'date-fns';
import { it, enGB, enUS, fr, es, de } from 'date-fns/locale';
import { useTranslation } from '../../src/hooks/useTranslation';
import i18n from '../../src/i18n';

// Get date-fns locale based on i18n
const getDateFnsLocale = () => {
  const locale = i18n.locale;
  if (locale.startsWith('it')) return it;
  if (locale === 'en-US') return enUS;
  if (locale.startsWith('en')) return enGB;
  if (locale.startsWith('fr')) return fr;
  if (locale.startsWith('es')) return es;
  if (locale.startsWith('de')) return de;
  return enGB;
};

// Safe date format function
const safeFormatDate = (dateString?: string | null, formatStr: string = 'd MMM yyyy'): string => {
  try {
    if (!dateString || dateString === '') return '--';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--';
    return format(date, formatStr, { locale: getDateFnsLocale() });
  } catch (e) {
    console.warn('Date format error:', dateString, e);
    return '--';
  }
};

export default function ProgramsTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { programs, athletes, fetchPrograms, fetchAthletes, isLoading } = useDataStore();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPrograms();
    fetchAthletes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPrograms();
    setRefreshing(false);
  };

  const getAthleteName = (athleteId: string) => {
    const athlete = athletes.find(a => a.id === athleteId);
    return athlete?.name || t('athlete.title');
  };

  const getCompletedWorkouts = (program: TrainingProgram) => {
    return program.workouts.filter(w => w.completed).length;
  };

  const renderProgramCard = ({ item }: { item: TrainingProgram }) => {
    const completedCount = getCompletedWorkouts(item);
    const totalWorkouts = item.workouts.length;
    const progress = totalWorkouts > 0 ? (completedCount / totalWorkouts) * 100 : 0;

    return (
      <Card
        onPress={() => router.push(`/program/${item.id}`)}
        style={styles.programCard}
      >
        <View style={styles.programHeader}>
          <View style={styles.programInfo}>
            <Text style={styles.programName}>{item.name}</Text>
            <Text style={styles.athleteName}>
              <Ionicons name="person" size={12} color="#999" />{' '}
              {getAthleteName(item.athlete_id)}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{totalWorkouts} {t('program.workouts')}</Text>
          </View>
        </View>

        {item.goal && (
          <Text style={styles.goalText} numberOfLines={2}>
            <Ionicons name="flag" size={12} color="#7CFC00" /> {item.goal}
          </Text>
        )}

        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.dateText}>
              {safeFormatDate(item.start_date, 'd MMM')} -{' '}
              {safeFormatDate(item.end_date, 'd MMM yyyy')}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{totalWorkouts} {t('program.completed')}
          </Text>
        </View>
      </Card>
    );
  };

  if (isLoading && programs.length === 0) {
    return <LoadingScreen message={t('program.loading')} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('navigation.programs')}</Text>
        <Text style={styles.headerSubtitle}>{programs.length} {t('program.activePrograms')}</Text>
      </View>

      {user?.role === 'coach' && athletes.length > 0 && (
        <Button
          title={t('program.newProgram')}
          onPress={() => router.push('/program/create')}
          style={styles.addButton}
        />
      )}

      <FlatList
        data={programs}
        keyExtractor={(item) => item.id}
        renderItem={renderProgramCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7CFC00"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>{t('program.noPrograms')}</Text>
            <Text style={styles.emptySubtext}>
              {athletes.length === 0
                ? t('program.addAthleteFirst')
                : t('program.createFirst')}
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
  programCard: {
    borderWidth: 1,
    borderColor: '#333',
  },
  programHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  athleteName: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(124, 252, 0, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#7CFC00',
    fontWeight: '500',
  },
  goalText: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: '#999',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    textAlign: 'right',
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
