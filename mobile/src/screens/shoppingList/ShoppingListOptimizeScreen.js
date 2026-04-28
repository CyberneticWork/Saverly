import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useShoppingStore } from '../../store/shoppingStore';
import { colors, typography, shadows } from '../../theme';

export default function ShoppingListOptimizeScreen({ navigation, route }) {
  const { listId } = route.params;
  const { optimize, optimization, isLoading } = useShoppingStore();

  useEffect(() => {
    optimize(listId);
  }, [listId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding the best deals for you...</Text>
      </SafeAreaView>
    );
  }

  if (!optimization) return null;

  const { bestSingleStore, supermarketComparison, itemCheapest, totalPotentialSavings, listName } = optimization;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header summary */}
        <LinearGradient colors={['#FF6F00', '#FF8F00']} style={styles.summaryCard}>
          <Ionicons name="flash" size={32} color="#fff" />
          <Text style={styles.summaryTitle}>Best Store Found!</Text>
          {bestSingleStore && (
            <>
              <Text style={styles.bestStoreName}>{bestSingleStore.name}</Text>
              <Text style={styles.bestStoreTotal}>LKR {bestSingleStore.total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
              <Text style={styles.bestStoreSub}>
                Covers {bestSingleStore.itemCount} of {bestSingleStore.totalItems} items
              </Text>
            </>
          )}
          {totalPotentialSavings > 0 && (
            <View style={styles.savingsBanner}>
              <Text style={styles.savingsText}>Potential savings: LKR {totalPotentialSavings.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Store comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Comparison</Text>
          {supermarketComparison.map((store, idx) => (
            <View
              key={store.supermarketId}
              style={[styles.storeCard, idx === 0 && styles.cheapestStoreCard]}
            >
              {idx === 0 && (
                <View style={styles.bestBadge}>
                  <Ionicons name="trophy" size={12} color="#fff" />
                  <Text style={styles.bestBadgeText}>BEST VALUE</Text>
                </View>
              )}
              <View style={styles.storeCardContent}>
                <View style={styles.storeCardLeft}>
                  <View style={[styles.storeColorDot, { backgroundColor: store.primaryColor || colors.primary }]} />
                  <View>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeCoverage}>{store.coverage}% coverage · {store.itemCount} items</Text>
                  </View>
                </View>
                <Text style={[styles.storeTotal, idx === 0 && styles.cheapestTotal]}>
                  LKR {store.total.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              {/* Bar chart */}
              <View style={styles.storeBar}>
                <View style={[styles.storeBarFill, {
                  width: `${(store.total / supermarketComparison[supermarketComparison.length - 1].total) * 100}%`,
                  backgroundColor: idx === 0 ? colors.primary : colors.border,
                }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Per item cheapest */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cheapest Per Item</Text>
          {itemCheapest.map((item) => (
            <View key={item.product.id} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
              <View style={styles.itemPriceInfo}>
                {item.cheapestAt ? (
                  <>
                    <Text style={styles.cheapestStore}>{item.cheapestAt.name}</Text>
                    <Text style={styles.cheapestPrice}>LKR {item.cheapestAt.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
                    {item.savings > 0 && (
                      <Text style={styles.itemSavings}>Save LKR {item.savings.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.noPrice}>No price found</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { ...typography.body, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 32 },
  summaryCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24, ...shadows.md },
  summaryTitle: { ...typography.h3, color: '#fff', marginTop: 8 },
  bestStoreName: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4 },
  bestStoreTotal: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 },
  bestStoreSub: { ...typography.body, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  savingsBanner: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  savingsText: { ...typography.body, color: '#fff', fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: 12 },
  storeCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    ...shadows.sm, borderWidth: 1, borderColor: 'transparent',
  },
  cheapestStoreCard: { borderColor: colors.primary, backgroundColor: colors.primaryFaded },
  bestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  bestBadgeText: { ...typography.label, color: '#fff', fontSize: 10 },
  storeCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeColorDot: { width: 12, height: 12, borderRadius: 6 },
  storeName: { ...typography.body, fontWeight: '600', color: colors.text },
  storeCoverage: { ...typography.caption, color: colors.textSecondary },
  storeTotal: { fontSize: 20, fontWeight: '700', color: colors.text },
  cheapestTotal: { color: colors.primary },
  storeBar: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  storeBarFill: { height: 6, borderRadius: 3 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, ...shadows.sm,
  },
  itemName: { ...typography.body, fontWeight: '600', color: colors.text, flex: 1 },
  itemPriceInfo: { alignItems: 'flex-end' },
  cheapestStore: { ...typography.caption, color: colors.textSecondary },
  cheapestPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  itemSavings: { ...typography.caption, color: colors.success, fontWeight: '600' },
  noPrice: { ...typography.caption, color: colors.textLight },
});
