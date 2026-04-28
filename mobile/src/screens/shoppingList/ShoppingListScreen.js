import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useShoppingStore } from '../../store/shoppingStore';
import { colors, typography, shadows } from '../../theme';

export default function ShoppingListScreen({ navigation }) {
  const { lists, isLoading, fetchLists, createList, deleteList } = useShoppingStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => { fetchLists(); }, []);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    try {
      const list = await createList(newListName.trim());
      setModalVisible(false);
      setNewListName('');
      navigation.navigate('ShoppingListDetail', { listId: list.id, listName: list.name });
    } catch {
      Alert.alert('Error', 'Could not create list.');
    }
  };

  const handleDelete = (list) => {
    Alert.alert('Delete List', `Delete "${list.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteList(list.id) },
    ]);
  };

  const renderList = ({ item }) => (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => navigation.navigate('ShoppingListDetail', { listId: item.id, listName: item.name })}
      activeOpacity={0.8}
    >
      <View style={styles.listIcon}>
        <Ionicons name="list" size={24} color={colors.primary} />
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{item.name}</Text>
        <Text style={styles.listMeta}>
          {item._count?.items || 0} item{item._count?.items !== 1 ? 's' : ''}
        </Text>
        {item.items?.length > 0 && (
          <Text style={styles.listPreview} numberOfLines={1}>
            {item.items.map(i => i.product?.name).join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.listActions}>
        <TouchableOpacity
          style={styles.optimizeBtn}
          onPress={() => navigation.navigate('ShoppingListOptimize', { listId: item.id })}
        >
          <Ionicons name="flash" size={16} color={colors.secondary} />
          <Text style={styles.optimizeBtnText}>Optimize</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Lists</Text>
        <Text style={styles.headerSub}>Manage and optimise your shopping</Text>
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={item => item.id}
          renderItem={renderList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No shopping lists yet</Text>
              <Text style={styles.emptyText}>Create a list and find the best store for your items</Text>
            </View>
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Shopping List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List name (e.g., Weekly Groceries)"
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setModalVisible(false); setNewListName(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreateBtn} onPress={handleCreate}>
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  headerTitle: { ...typography.h2, color: '#fff' },
  headerSub: { ...typography.body, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 100 },
  listCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 12, ...shadows.sm,
  },
  listIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  listInfo: { flex: 1 },
  listName: { ...typography.h4, color: colors.text },
  listMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  listPreview: { ...typography.caption, color: colors.textLight, marginTop: 4 },
  listActions: { alignItems: 'flex-end', gap: 8 },
  optimizeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.secondaryFaded, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  optimizeBtnText: { fontSize: 12, fontWeight: '600', color: colors.secondary },
  deleteBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.lg,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: 15, color: colors.text, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { ...typography.button, color: colors.textSecondary },
  modalCreateBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCreateText: { ...typography.button, color: '#fff' },
});
