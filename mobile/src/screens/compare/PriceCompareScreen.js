import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { pricesAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

export default function PriceCompareScreen({ navigation, route }) {
  const { productId } = route.params;
  const [compareData, setCompareData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComparison();
  }, [productId]);

  const loadComparison = async () => {
    try {
      const res = await pricesAPI.compare([productId]);
      setCompareData(res.data.data);
    } catch {} finally { setIsLoading(false); }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const product = compareData?.products?.[0];
  const pricesByStore = compareData?.comparison?.[productId] || {};
  const entries = Object.entries(pricesByStore).map(([storeId, info]) => ({ storeId, ...info }));
  entries.sort((a, b) => {
    const aP = a.isOnSale ? a.salePrice : a.price;
    const bP = b.isOnSale ? b.salePrice : b.price;
    return aP - bP;
  });
  const maxPrice = entries.length > 0 ? Math.max(...entries.map(e => e.isOnSale ? e.salePrice : e.price)) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Product header */}
        {product && (
          <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.productHeader}>
            <Text style={styles.productHeaderEmoji}>🛒</Text>
            <Text style={styles.productHeaderName}>{product.name}</Text>
            {product.brand && <Text style={styles.productHeaderBrand}>{product.brand} · {product.defaultUnit}</Text>}
          </LinearGradient>
        )}

        {/* Summary */}
        {entries.length > 1 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cheapest</Text>
              <Text style={styles.summaryValue}>{entries[0].supermarketName}</Text>
              <Text style={styles.summaryPrice}>
                LKR {(entries[0].isOnSale ? entries[0].salePrice : entries[0].price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summarySeparator} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Most Expensive</Text>
              <Text style={styles.summaryValue}>{entries[entries.length - 1].supermarketName}</Text>
              <Text style={[styles.summaryPrice, { color: colors.error }]}>
                LKR {(entries[entries.length - 1].isOnSale ? entries[entries.length - 1].salePrice : entries[entries.length - 1].price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.summarySeparator} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>You Save</Text>
              <Text style={styles.summaryValue}>By choosing cheapest</Text>
              <Text style={[styles.summaryPrice, { color: colors.success }]}>
                LKR {Math.abs(
                  (entries[0].isOnSale ? entries[0].salePrice : entries[0].price) -
                  (entries[entries.length - 1].isOnSale ? entries[entries.length - 1].salePrice : entries[entries.length - 1].price)
                ).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* Bar comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Comparison</Text>
          {entries.map((entry, idx) => {
            const eff = entry.isOnSale ? entry.salePrice : entry.price;
            const isCheapest = idx === 0;
            return (
              <View key={entry.storeId} style={[styles.compareRow, isCheapest && styles.cheapestRow]}>
                {isCheapest && (
                  <View style={styles.cheapestBadge}>
                    <Ionicons name="trophy" size={10} color={colors.cheapest} />
                    <Text style={styles.cheapestBadgeText}>BEST PRICE</Text>
                  </View>
                )}
                <View style={styles.compareRowHeader}>
                  <Text style={styles.compareStoreName}>{entry.supermarketName}</Text>
                  <View style={styles.comparePriceGroup}>
                    {entry.isOnSale && (
                      <Text style={styles.compareOriginal}>LKR {entry.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
                    )}
                    <Text style={[styles.comparePrice, isCheapest && styles.comparePriceBest]}>
                      LKR {eff.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </Text>
                    {entry.isOnSale && (
                      <View style={styles.salePill}><Text style={styles.salePillText}>SALE</Text></View>
                    )}
                  </View>
                </View>
                <View style={styles.barContainer}>
                  <View style={[styles.barFill, {
                    width: `${(eff / maxPrice) * 100}%`,
                    backgroundColor: isCheapest ? colors.cheapest : '#C8E6C9',
                  }]} />
                </View>
                {entry.stockStatus && entry.stockStatus !== 'IN_STOCK' && (
                  <Text style={styles.stockWarning}>⚠ {entry.stockStatus.replace(/_/g, ' ')}</Text>
                )}
                {entry.lastUpdated && (
                  <Text style={styles.lastUpdated}>Updated {new Date(entry.lastUpdated).toLocaleDateString()}</Text>
                )}
              </View>
            );
          })}
          {entries.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No price data available for comparison</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 32 },
  productHeader: { padding: 24, alignItems: 'center' },
  productHeaderEmoji: { fontSize: 48, marginBottom: 8 },
  productHeaderName: { ...typography.h3, color: '#fff', textAlign: 'center' },
  productHeaderBrand: { ...typography.body, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  summaryRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    margin: 16, borderRadius: 16, padding: 16, ...shadows.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  summaryValue: { ...typography.caption, color: colors.text, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  summaryPrice: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 4 },
  summarySeparator: { width: 1, backgroundColor: colors.divider },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: 12 },
  compareRow: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, ...shadows.sm,
    borderWidth: 1, borderColor: 'transparent',
  },
  cheapestRow: { borderColor: colors.cheapest + '40', backgroundColor: colors.cheapestBg },
  cheapestBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  cheapestBadgeText: { fontSize: 10, fontWeight: '700', color: colors.cheapest },
  compareRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  compareStoreName: { ...typography.body, fontWeight: '600', color: colors.text },
  comparePriceGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compareOriginal: { ...typography.body, color: colors.textLight, textDecorationLine: 'line-through' },
  comparePrice: { fontSize: 18, fontWeight: '700', color: colors.text },
  comparePriceBest: { color: colors.cheapest },
  salePill: { backgroundColor: colors.saleBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  salePillText: { fontSize: 10, fontWeight: '700', color: colors.sale },
  barContainer: { height: 6, backgroundColor: colors.border, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
  stockWarning: { ...typography.caption, color: colors.secondary, marginTop: 6 },
  lastUpdated: { ...typography.caption, color: colors.textLight, marginTop: 4 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },
});
