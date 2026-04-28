import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Animated, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { productsAPI, categoriesAPI, invoicesAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';
import ProductCard from '../../components/product/ProductCard';

export default function SearchScreen({ navigation, route }) {
  const [query, setQuery] = useState(route.params?.query || '');
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category || '');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Voice recognition
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [voiceHint, setVoiceHint] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.data.data || [])).catch(() => {});
    if (query || selectedCategory) doSearch(true);
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const doSearch = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    if (isLoading || (!hasMore && !reset)) return;
    setIsLoading(true);
    try {
      const params = { page: currentPage, limit: 20 };
      if (selectedCategory) params.category = selectedCategory;
      const res = query.trim()
        ? await productsAPI.search(query.trim(), params)
        : await productsAPI.list({ ...params, sortBy: 'viewCount', order: 'desc' });
      const newProducts = res.data.data || [];
      setProducts(reset ? newProducts : [...products, ...newProducts]);
      setHasMore(newProducts.length === 20);
      setPage(currentPage + 1);
      setHasSearched(true);
    } catch {
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    setPage(1);
    setHasMore(true);
    doSearch(true);
  }, [query, selectedCategory]);

  const handleCategorySelect = (slug) => {
    const newCat = selectedCategory === slug ? '' : slug;
    setSelectedCategory(newCat);
    setPage(1);
    setHasMore(true);
    setTimeout(() => doSearch(true), 100);
  };

  // ── Voice Recognition ──────────────────────────────────────────────────────
  const startVoiceRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required for voice search.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setVoiceHint('Listening… speak now');
    } catch (err) {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setVoiceHint('Processing…');
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Send audio to backend for transcription
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
        name: 'voice_search.m4a',
      });
      try {
        const res = await invoicesAPI.transcribeVoice(formData);
        const transcript = res.data?.text || '';
        if (transcript) {
          setQuery(transcript);
          setVoiceHint(`"${transcript}"`);
          setTimeout(() => {
            setPage(1); setHasMore(true); doSearch(true);
            setTimeout(() => setVoiceHint(''), 2000);
          }, 300);
        } else {
          setVoiceHint('Could not understand. Try again.');
          setTimeout(() => setVoiceHint(''), 2500);
        }
      } catch {
        setVoiceHint('Voice search unavailable. Type your query.');
        setTimeout(() => setVoiceHint(''), 2500);
      }
    } catch (err) {
      setVoiceHint('');
      setRecording(null);
    }
  };

  const handleVoicePress = () => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  // ── Shopping List Paper Scan ───────────────────────────────────────────────
  const handleListScan = () => {
    navigation.navigate('ShoppingListScan');
  };

  const renderProduct = ({ item }) => (
    <ProductCard
      product={item}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Gradient Header */}
      <LinearGradient colors={[colors.primary, colors.primaryMedium]} style={styles.header}>
        <Text style={styles.headerTitle}>Smart Shopping</Text>
        <Text style={styles.headerSub}>Find the best prices</Text>

        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, isRecording && styles.searchBarRecording]}>
            <Ionicons name="search-outline" size={18} color={colors.textLight} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search products, brands..."
              placeholderTextColor={colors.textLight}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Voice Button */}
          <TouchableOpacity
            style={[styles.iconActionBtn, isRecording && styles.iconActionBtnActive]}
            onPress={handleVoicePress}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={22}
                color={isRecording ? '#fff' : colors.primary}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Scan List Button */}
          <TouchableOpacity style={styles.iconActionBtn} onPress={handleListScan} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Voice hint */}
        {voiceHint ? (
          <View style={styles.voiceHint}>
            <Ionicons name="mic" size={13} color="#fff" />
            <Text style={styles.voiceHintText}>{voiceHint}</Text>
          </View>
        ) : (
          <View style={styles.scanHint}>
            <Ionicons name="document-text-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.scanHintText}>Tap 📄 to scan a paper shopping list</Text>
          </View>
        )}
      </LinearGradient>

      {/* Category filters */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          data={[{ id: '', name: 'All', slug: '' }, ...categories]}
          keyExtractor={item => item.id || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === item.slug && styles.categoryChipActive]}
              onPress={() => handleCategorySelect(item.slug)}
            >
              <Text style={[styles.categoryText, selectedCategory === item.slug && styles.categoryTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Results */}
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={() => doSearch(false)}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={() =>
          hasSearched && products.length > 0 ? (
            <Text style={styles.resultCount}>{products.length}+ results for "{query}"</Text>
          ) : null
        }
        ListEmptyComponent={() =>
          !isLoading && hasSearched ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyText}>Try different keywords or browse categories</Text>
              <TouchableOpacity style={styles.scanListBtn} onPress={handleListScan}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.scanListBtnText}>Scan Shopping List</Text>
              </TouchableOpacity>
            </View>
          ) : !hasSearched ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛍️</Text>
              <Text style={styles.emptyTitle}>Discover Best Prices</Text>
              <Text style={styles.emptyText}>Search by name, brand or scan your paper shopping list to find the best deals</Text>
              <View style={styles.tipsRow}>
                <View style={styles.tipCard}>
                  <Ionicons name="mic-outline" size={22} color={colors.primary} />
                  <Text style={styles.tipText}>Voice{'\n'}Search</Text>
                </View>
                <View style={styles.tipCard}>
                  <Ionicons name="document-text-outline" size={22} color={colors.secondary} />
                  <Text style={styles.tipText}>Scan{'\n'}List</Text>
                </View>
                <View style={styles.tipCard}>
                  <Ionicons name="pricetag-outline" size={22} color={colors.info} />
                  <Text style={styles.tipText}>Compare{'\n'}Prices</Text>
                </View>
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={() =>
          isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ margin: 24 }} /> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchBarRecording: { borderWidth: 2, borderColor: colors.secondary },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  iconActionBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconActionBtnActive: { backgroundColor: colors.secondary },
  voiceHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  voiceHintText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  scanHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
  },
  scanHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  categoriesWrapper: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  categoriesRow: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  categoryTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  resultCount: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: 8, textAlign: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  scanListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryFaded, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary,
  },
  scanListBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  tipsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  tipCard: {
    alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    ...shadows.sm,
  },
  tipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
});
