import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { usersAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ favourites: 0, lists: 0, invoices: 0, alerts: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await usersAPI.getProfile();
      const data = res.data.data;
      setStats({
        favourites: data._count?.favourites || 0,
        lists: data._count?.shoppingLists || 0,
        invoices: data._count?.invoices || 0,
        alerts: data._count?.priceAlerts || 0,
      });
    } catch {}
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const res = await usersAPI.updateProfile({ name: name.trim() });
      updateUser(res.data.data);
      setIsEditing(false);
    } catch { Alert.alert('Error', 'Could not update profile.'); }
    setIsSaving(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems = [
    { icon: 'heart-outline', label: 'Favourite Products', onPress: () => navigation.navigate('Favourites') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'pricetag-outline', label: 'Price Alerts', onPress: () => Alert.alert('Coming soon') },
    { icon: 'location-outline', label: 'Nearby Stores', onPress: () => navigation.navigate('NearbyStores') },
    { icon: 'shield-checkmark-outline', label: 'Privacy & Security', onPress: () => Alert.alert('Coming soon') },
    { icon: 'help-circle-outline', label: 'Help & Support', onPress: () => Alert.alert('Coming soon') },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={['#FF6F00', '#FF8F00']} style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
            </LinearGradient>
          </View>
          {isEditing ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.saveNameBtn} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={20} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsEditing(false); setName(user?.name || ''); }}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setIsEditing(true)}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.role === 'ADMIN' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Favourites', value: stats.favourites, icon: 'heart', color: '#EF5350' },
            { label: 'Lists', value: stats.lists, icon: 'list', color: colors.primary },
            { label: 'Receipts', value: stats.invoices, icon: 'receipt', color: '#FF6F00' },
            { label: 'Alerts', value: stats.alerts, icon: 'notifications', color: '#AB47BC' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={20} color={stat.color} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <View style={styles.menuIconBg}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Saverly v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 24, paddingBottom: 32, alignItems: 'center', paddingHorizontal: 20 },
  avatarContainer: { marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { ...typography.h3, color: '#fff' },
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nameInput: { ...typography.h4, color: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)', paddingVertical: 4, minWidth: 120 },
  saveNameBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  userEmail: { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard: { flex: 1, minWidth: '22%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, ...shadows.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  menu: { backgroundColor: '#fff', borderRadius: 16, margin: 16, overflow: 'hidden', ...shadows.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, paddingVertical: 16, ...shadows.sm },
  logoutText: { ...typography.button, color: colors.error },
  version: { textAlign: 'center', ...typography.caption, color: colors.textLight, marginTop: 16 },
});
