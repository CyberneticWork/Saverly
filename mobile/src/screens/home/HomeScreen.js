import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, RefreshControl, TextInput, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { productsAPI, categoriesAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, shadows } from '../../theme';
import ProductCard from '../../components/product/ProductCard';
import BrandLogo from '../../components/BrandLogo';

const { width } = Dimensions.get('window');

const DEALS = [
  { id: '1', title: 'Best Deals', subtitle: 'Up to 40% off', gradient: [colors.secondary, colors.secondaryLight], emoji: '🏷️' },
  { id: '2', title: 'Fresh Produce', subtitle: 'Best prices today', gradient: [colors.primary, colors.primaryLight], emoji: '🥦' },
  { id: '3', title: 'Dairy & Eggs', subtitle: 'Compare now', gradient: [colors.primaryDark, colors.primary], emoji: '🥛' },
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuthStore();
  const [categories, setCategories] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [catRes, prodRes, favRes] = await Promise.all([
        categoriesAPI.list(),
        productsAPI.list({ limit: 10, sortBy: 'viewCount', order: 'desc' }),
        productsAPI.getFavourites(),
      ]);
      setCategories(catRes.data.data || []);
      setTrendingProducts(prodRes.data.data || []);
      setFavourites(favRes.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = () => {
    if (searchText.trim()) {
      navigation.navigate('Search', { screen: 'SearchMain', params: { query: searchText.trim() } });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={[colors.primaryDark, colors.primary, colors.primaryLight]} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.brandRow}>
                <BrandLogo width={104} variant="mark" withTagline={false} />
                <Text style={styles.appName}>Saverly</Text>
              </View>
              <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
              <Text style={styles.headerSub}>See Where You Save</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NearbyStores')}>
                <Ionicons name="location-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}>
            <Ionicons name="search-outline" size={20} color={colors.textLight} />
            <Text style={styles.searchPlaceholder}>Search products or scan a list…</Text>
            <View style={styles.searchScanBtn}>
              <Ionicons name="mic-outline" size={18} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* Deals Banner */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsBanner}>
          {DEALS.map(deal => (
            <TouchableOpacity key={deal.id} onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}>
              <LinearGradient colors={deal.gradient} style={styles.dealCard}>
                <Text style={styles.dealEmoji}>{deal.emoji}</Text>
                <Text style={styles.dealTitle}>{deal.title}</Text>
                <Text style={styles.dealSubtitle}>{deal.subtitle}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            {categories.slice(0, 8).map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryChip}
                onPress={() => navigation.navigate('Search', { screen: 'SearchMain', params: { category: cat.slug } })}
              >
                <Text style={styles.categoryText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Trending Products */}
        {trendingProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Trending</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
              {trendingProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  horizontal
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Favourites */}
        {favourites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>❤️ Favourites</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Favourites')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
              {favourites.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  horizontal
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { icon: 'scan', label: 'Scan Invoice', color: colors.secondary, screen: 'Invoice' },
              { icon: 'map', label: 'Nearby Stores', color: colors.info, screen: 'NearbyStores' },
              { icon: 'list', label: 'Shopping List', color: colors.primary, screen: 'Shopping' },
              { icon: 'heart', label: 'Favourites', color: colors.sale, screen: 'Favourites' },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.quickActionCard}
                onPress={() => {
                  if (action.screen === 'Invoice' || action.screen === 'Shopping') {
                    navigation.navigate(action.screen);
                  } else {
                    navigation.navigate(action.screen);
                  }
                }}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={`${action.icon}-outline`} size={26} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, marginLeft: -8 },
  appName: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.86)', letterSpacing: 0.6, marginLeft: -6 },
  greeting: { ...typography.h3, color: '#fff' },
  headerSub: { ...typography.body, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    ...shadows.sm,
  },
  searchPlaceholder: { flex: 1, color: colors.textLight, fontSize: 15, marginLeft: 10 },
  searchScanBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.primaryFaded, justifyContent: 'center', alignItems: 'center',
  },
  dealsBanner: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 12 },
  dealCard: {
    width: 160, height: 90, borderRadius: 16,
    padding: 14, justifyContent: 'center', ...shadows.sm,
  },
  dealEmoji: { fontSize: 24, marginBottom: 4 },
  dealTitle: { ...typography.h4, color: '#fff' },
  dealSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { ...typography.h4, color: colors.text },
  seeAll: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  categoriesRow: { paddingBottom: 4, gap: 8 },
  categoryChip: {
    backgroundColor: colors.primaryFaded, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.primaryLight + '40',
  },
  categoryText: { ...typography.bodySmall, color: colors.primaryMedium, fontWeight: '600' },
  productsRow: { paddingBottom: 4, gap: 12 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  quickActionCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    alignItems: 'center', ...shadows.sm,
  },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  quickActionLabel: { ...typography.bodySmall, fontWeight: '600', color: colors.text, textAlign: 'center' },
});
