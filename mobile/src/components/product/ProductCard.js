import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, shadows } from '../../theme';

export default function ProductCard({ product, onPress, horizontal = false }) {
  if (horizontal) {
    return (
      <TouchableOpacity style={styles.horizontal} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.horizontalImage}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.imgHorizontal} resizeMode="cover" />
          ) : (
            <Text style={styles.emojiH}>🛒</Text>
          )}
        </View>
        <View style={styles.horizontalInfo}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          {product.brand && <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>}
          <Text style={styles.unit}>{product.defaultUnit}</Text>
          {product.cheapestPrice != null && (
            <Text style={styles.price}>
              LKR {Number(product.cheapestPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Image / emoji placeholder */}
      <View style={styles.imageContainer}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.img} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>🛒</Text>
        )}
        {product.isOnSale && (
          <View style={styles.saleBadge}>
            <Text style={styles.saleText}>SALE</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.category} numberOfLines={1}>{product.category?.name || ''}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        {product.brand && <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>}
        <View style={styles.footer}>
          {product.cheapestPrice != null ? (
            <Text style={styles.price}>LKR {Number(product.cheapestPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</Text>
          ) : (
            <Text style={styles.noPriceText}>No prices yet</Text>
          )}
          {product._count?.favourites > 0 && (
            <View style={styles.favBadge}>
              <Ionicons name="heart" size={10} color={colors.sale} />
              <Text style={styles.favCount}>{product._count.favourites}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    ...shadows.sm,
  },
  imageContainer: { height: 110, backgroundColor: '#F1F8E9', justifyContent: 'center', alignItems: 'center' },
  img: { width: '100%', height: '100%' },
  emoji: { fontSize: 44 },
  saleBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: colors.sale, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  saleText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  info: { padding: 10 },
  category: { fontSize: 10, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', marginBottom: 2 },
  productName: { ...typography.body, fontWeight: '700', color: colors.text, lineHeight: 18 },
  brand: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { fontSize: 13, fontWeight: '700', color: colors.cheapest },
  noPriceText: { fontSize: 11, color: colors.textLight },
  favBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  favCount: { fontSize: 10, color: colors.textLight },

  // Horizontal variant
  horizontal: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden', marginRight: 12, ...shadows.sm, width: 220,
  },
  horizontalImage: { width: 72, height: 72, backgroundColor: '#F1F8E9', justifyContent: 'center', alignItems: 'center' },
  imgHorizontal: { width: 72, height: 72 },
  emojiH: { fontSize: 32 },
  horizontalInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  unit: { ...typography.caption, color: colors.textLight, marginTop: 2 },
});
