import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

const NOTIF_ICONS = {
  PRICE_DROP: { icon: 'trending-down', color: '#4CAF50' },
  PRICE_ALERT: { icon: 'notifications', color: '#FF6F00' },
  INVOICE_VERIFIED: { icon: 'checkmark-circle', color: '#2196F3' },
  INVOICE_REJECTED: { icon: 'close-circle', color: '#F44336' },
  SYSTEM: { icon: 'information-circle', color: '#9E9E9E' },
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await usersAPI.getNotifications();
      setNotifications(res.data.data || []);
    } catch {} finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, []);

  const markRead = async (id) => {
    try {
      await usersAPI.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await usersAPI.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderNotification = ({ item }) => {
    const config = NOTIF_ICONS[item.type] || NOTIF_ICONS.SYSTEM;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
        onPress={() => !item.isRead && markRead(item.id)}
        activeOpacity={0.8}
      >
        {!item.isRead && <View style={styles.unreadDot} />}
        <View style={[styles.notifIcon, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadNotifications(); }} tintColor={colors.primary} />}
        ListHeaderComponent={() =>
          unreadCount > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>{unreadCount} unread</Text>
              <TouchableOpacity onPress={markAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>You'll be notified when prices drop or receipts are verified</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 32 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listHeaderText: { ...typography.body, color: colors.textSecondary },
  markAllText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    ...shadows.sm, position: 'relative',
  },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary,
  },
  notifIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTitle: { ...typography.body, fontWeight: '700', color: colors.text, marginBottom: 3 },
  notifMessage: { ...typography.body, color: colors.textSecondary },
  notifTime: { ...typography.caption, color: colors.textLight, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
