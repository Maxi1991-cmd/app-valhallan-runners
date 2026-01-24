import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Esci', 'Sei sicuro di voler uscire?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Esci',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const platformStatus = [
    { name: 'Garmin', icon: 'watch', connected: false },
    { name: 'Polar', icon: 'heart', connected: false },
    { name: 'Suunto', icon: 'compass', connected: false },
    { name: 'Strava', icon: 'bicycle', connected: false },
    { name: 'Fitbit', icon: 'fitness', connected: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'coach' ? 'Coach' : 'Atleta'}
            </Text>
          </View>
        </View>

        <Card title="Piattaforme Connesse" style={styles.platformsCard}>
          <Text style={styles.platformNote}>
            Le integrazioni con piattaforme esterne saranno disponibili prossimamente
          </Text>
          {platformStatus.map((platform, index) => (
            <TouchableOpacity key={index} style={styles.platformRow}>
              <View style={styles.platformInfo}>
                <Ionicons name={platform.icon as any} size={22} color="#FF6B35" />
                <Text style={styles.platformName}>{platform.name}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  platform.connected ? styles.connectedBadge : styles.disconnectedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    platform.connected ? styles.connectedText : styles.disconnectedText,
                  ]}
                >
                  {platform.connected ? 'Connesso' : 'Prossimamente'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>

        <Card title="Impostazioni" style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Notifiche</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle-outline" size={22} color="#999" />
              <Text style={styles.settingText}>Supporto</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </Card>

        <Button
          title="Esci"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />

        <Text style={styles.versionText}>RunCoach Pro v1.0.0</Text>
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
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  roleText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  platformsCard: {
    marginBottom: 16,
  },
  platformNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformName: {
    fontSize: 15,
    color: '#FFF',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  connectedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  disconnectedBadge: {
    backgroundColor: 'rgba(153, 153, 153, 0.15)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  connectedText: {
    color: '#4CAF50',
  },
  disconnectedText: {
    color: '#999',
  },
  settingsCard: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#FFF',
  },
  logoutButton: {
    marginBottom: 24,
  },
  versionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
  },
});
