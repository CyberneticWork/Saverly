import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { productsAPI, shoppingListsAPI } from '../../services/api';
import { colors, typography, shadows, spacing } from '../../theme';
import PriceChart from '../../components/product/PriceChart';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen({ navigation, route }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [prices, setPrices] = useState([]);
  const [isFavourite, setIsFavourite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [addingToList, setAddingToList] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const [prodRes, priceRes] = await Promise.all([
        productsAPI.getById(productId),
        productsAPI.getPrices(productId),
      ]);
      setProduct(prodRes.data.data);
      setIsFavourite(prodRes.data.data.isFavourite);
      setPrices(priceRes.data.data || []);
    } catch {
      Alert.alert('Error', 'Could not load product details.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleFavourite = async () => {
    try {
      const res = await productsAPI.toggleFavourite(productId);
      setIsFavourite(res.data.isFavourite);
    } catch {}
  };

  const handleCompare = () => {
    navigation.navigate('PriceCompare', { productId });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) return null;

  const cheapestPrice = prices.length > 0
    ? prices.reduce((min, p) => {
        const eff = p.isOnSale ? p.salePrice : p.price;
        const minEff = min.isOnSale ? min.salePrice : min.price;
        return eff < minEff ? p : min;
      }, prices[0])
    : null;

  const savings = prices.length > 1
    ? Math.abs(
        (prices[prices.length - 1].isOnSale ? prices[prices.length - 1].salePrice : prices[prices.length - 1].price) -
        (cheapestPrice.isOnSale ? cheapestPrice.salePrice : cheapestPrice.price)
      ).toLocaleString('en-LK', { minimumFractionDigits: 2 })
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <LinearGradient colors={['#E8F5E9', '#F1F8E9']} style={styles.imageBg}>
            <Text style={styles.productEmoji}>🛒</Text>
          </LinearGradient>
          <TouchableOpacity style={styles.heartBtn} onPress={handleFavourite}>
            <Ionicons name={isFavourite ? 'heart' : 'heart-outline'} size={24} color={isFavourite ? colors.sale : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category?.name}</Text>
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            {product.brand && <Text style={styles.brandText}>by {product.brand}</Text>}
            {product.description && (
              <Text style={styles.descriptionText}>{product.description}</Text>
            )}
          </View>

          {/* Price summary */}
          {cheapestPrice && (
            <View style={styles.priceSummary}>
              <View style={styles.priceLeft}>
                <Text style={styles.fromLabel}>Best price from</Text>
                <Text style={styles.cheapestStore}>{cheapestPrice.supermarketName}</Text>
                <Text style={styles.cheapestPrice}>
                  LKR {(cheapestPrice.isOnSale ? cheapestPrice.salePrice : cheapestPrice.price).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  <Text style={styles.unitText}> / {product.defaultUnit}</Text>
                </Text>
              </View>
              {savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsLabel}>Save up to</Text>
                  <Text style={styles.savingsAmount}>LKR {savings}</Text>
                  <Text style={styles.savingsVs}>vs highest</Text>
                </View>
              )}
            </View>
          )}

          {/* Compare button */}
          <TouchableOpacity style={styles.compareBtn} onPress={handleCompare}>
            <Ionicons name="stats-chart-outline" size={20} color="#fff" />
            <Text style={styles.compareBtnText}>Compare All Prices ({prices.length} stores)</Text>
          </TouchableOpacity>

          {/* Price list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prices by Store</Text>
            {prices.map((p, idx) => {
              const effectivePrice = p.isOnSale ? p.salePrice : p.price;
              const isCheapest = idx === 0;
              return (
                <View key={p.id} style={[styles.priceRow, isCheapest && styles.cheapestRow]}>
                  {isCheapest && (
                    <View style={styles.cheapestBadge}>
                      <Ionicons name="trophy" size={10} color={colors.cheapest} />
                      <Text style={styles.cheapestBadgeText}>CHEAPEST</Text>
                    </View>
                  )}
                  <View style={styles.priceRowContent}>
                    <Text style={styles.storeName}>{p.supermarketName}</Text>
                    <View style={styles.priceValues}>
                      {p.isOnSale && (
                        <Text style={styles.originalPrice}>LKR {p.price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
                      )}
                      <Text style={[styles.storePrice, isCheapest && styles.cheapestStorePrice]}>
                        LKR {effectivePrice.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </Text>
                      {p.isOnSale && (
                        <View style={styles.saleBadge}>
                          <Text style={styles.saleText}>SALE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.priceBar}>
                    <View
                      style={[
                        styles.priceBarFill,
                        {
                          width: `${(effectivePrice / prices[prices.length - 1].price) * 100}%`,
                          backgroundColor: isCheapest ? colors.cheapest : colors.border,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Price History Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price History (90 days)</Text>
            <PriceChart productId={productId} />
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { position: 'relative' },
  imageBg: { height: 240, justifyContent: 'center', alignItems: 'center' },
  productEmoji: { fontSize: 80 },
  heartBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    ...shadows.md,
  },
  content: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, padding: 24 },
  productInfo: { marginBottom: 20 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: colors.primaryFaded, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  categoryText: { ...typography.label, color: colors.primary },
  productName: { ...typography.h2, color: colors.text, marginBottom: 4 },
  brandText: { ...typography.body, color: colors.textSecondary, marginBottom: 8 },
  descriptionText: { ...typography.body, color: colors.textSecondary },
  priceSummary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.cheapestBg, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.cheapest + '30',
  },
  fromLabel: { ...typography.caption, color: colors.textSecondary },
  cheapestStore: { ...typography.h4, color: colors.text, marginTop: 2 },
  cheapestPrice: { fontSize: 26, fontWeight: '800', color: colors.cheapest, marginTop: 4 },
  unitText: { fontSize: 14, color: colors.textSecondary, fontWeight: '400' },
  savingsBadge: { alignItems: 'center', backgroundColor: colors.secondary, borderRadius: 12, padding: 12 },
  savingsLabel: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  savingsAmount: { fontSize: 20, fontWeight: '800', color: '#fff' },
  savingsVs: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  compareBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24,
  },
  compareBtnText: { ...typography.button, color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: 14 },
  priceRow: {
    backgroundColor: colors.background, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  cheapestRow: { backgroundColor: colors.cheapestBg, borderColor: colors.cheapest + '40' },
  cheapestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 6,
  },
  cheapestBadgeText: { fontSize: 10, fontWeight: '700', color: colors.cheapest, letterSpacing: 0.5 },
  priceRowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  storeName: { ...typography.body, fontWeight: '600', color: colors.text },
  priceValues: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  originalPrice: { ...typography.body, color: colors.textLight, textDecorationLine: 'line-through' },
  storePrice: { fontSize: 18, fontWeight: '700', color: colors.text },
  cheapestStorePrice: { color: colors.cheapest },
  saleBadge: { backgroundColor: colors.saleBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saleText: { fontSize: 10, fontWeight: '700', color: colors.sale },
  priceBar: { height: 4, backgroundColor: colors.border, borderRadius: 2 },
  priceBarFill: { height: 4, borderRadius: 2 },
});
