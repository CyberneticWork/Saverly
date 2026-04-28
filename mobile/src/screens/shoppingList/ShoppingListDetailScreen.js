import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productsAPI } from '../../services/api';
import { useShoppingStore } from '../../store/shoppingStore';
import { colors, typography, shadows } from '../../theme';

export default function ShoppingListDetailScreen({ navigation, route }) {
  const { listId, listName } = route.params;
  const { currentList, fetchList, addItem, removeItem, toggleCheck } = useShoppingStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: listName });
    loadList();
  }, [listId]);

  const loadList = async () => {
    setIsLoading(true);
    await fetchList(listId);
    setIsLoading(false);
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await productsAPI.search(q.trim(), { limit: 10 });
      setSearchResults(res.data.data || []);
    } catch {} finally { setSearching(false); }
  };

  const handleAddProduct = async (product) => {
    try {
      await addItem(listId, product.id, 1, product.defaultUnit);
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch { Alert.alert('Error', 'Could not add item.'); }
  };

  const handleRemoveItem = (item) => {
    Alert.alert('Remove Item', `Remove "${item.product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(listId, item.id) },
    ]);
  };

  const items = currentList?.items || [];
  const checkedCount = items.filter(i => i.isChecked).length;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemCard, item.isChecked && styles.itemCardChecked]}
      onPress={() => toggleCheck(listId, item.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}>
        {item.isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
          {item.product.name}
        </Text>
        <Text style={styles.itemMeta}>
          {item.quantity} {item.unit || item.product.defaultUnit}
          {item.product.category && ` · ${item.product.category.name}`}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.viewPricesBtn}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.product.id })}
      >
        <Text style={styles.viewPricesText}>Prices</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleRemoveItem(item)} style={styles.removeBtn}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Progress bar */}
      {items.length > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>{checkedCount} of {items.length} items</Text>
            {checkedCount === items.length && items.length > 0 && (
              <Text style={styles.allDoneText}>🎉 All done!</Text>
            )}
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(checkedCount / items.length) * 100}%` }]} />
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>List is empty</Text>
            <Text style={styles.emptyText}>Add products to start comparing prices</Text>
          </View>
        )}
      />

      {/* Optimize button */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.optimizeBtn}
          onPress={() => navigation.navigate('ShoppingListOptimize', { listId })}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={styles.optimizeBtnText}>Find Best Store</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Product Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={colors.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a product..."
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResult} onPress={() => handleAddProduct(item)}>
                  <View style={styles.searchResultIcon}>
                    <Ionicons name="cube-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultMeta}>{item.category?.name} · {item.defaultUnit}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={() =>
                searchQuery.length > 1 && !searching ? (
                  <Text style={styles.noResults}>No products found</Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressContainer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  allDoneText: { ...typography.body, color: colors.success, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  listContent: { padding: 16, paddingBottom: 140 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10, ...shadows.sm,
  },
  itemCardChecked: { opacity: 0.6 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.border, marginRight: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  itemInfo: { flex: 1 },
  itemName: { ...typography.body, fontWeight: '600', color: colors.text },
  itemNameChecked: { textDecorationLine: 'line-through', color: colors.textLight },
  itemMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  viewPricesBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 8 },
  viewPricesText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  removeBtn: { padding: 4 },
  optimizeBtn: {
    position: 'absolute', bottom: 88, left: 16, right: 80,
    backgroundColor: colors.secondary, borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, ...shadows.md,
  },
  optimizeBtnText: { ...typography.button, color: '#fff' },
  fab: {
    position: 'absolute', bottom: 24, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.lg,
  },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { ...typography.h3, color: colors.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  searchResult: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  searchResultIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  searchResultInfo: { flex: 1 },
  searchResultName: { ...typography.body, fontWeight: '600', color: colors.text },
  searchResultMeta: { ...typography.caption, color: colors.textSecondary },
  noResults: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 24 },
});
