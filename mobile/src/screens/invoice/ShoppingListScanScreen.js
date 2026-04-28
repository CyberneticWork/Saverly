/**
 * ShoppingListScanScreen
 * ──────────────────────
 * Allows the user to photograph or upload a handwritten / printed shopping
 * list.  The image is sent to the OCR backend which extracts item names; each
 * name is then searched in the product database so the user can see current
 * best prices and navigate to the compare screen.
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, ScrollView, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { invoicesAPI, productsAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

const { width } = Dimensions.get('window');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Given raw OCR text from a shopping list, split it into candidate item names.
 * Shopping lists use one item per line, sometimes with qty prefix like "2x Milk".
 */
function extractListItems(rawText) {
  if (!rawText) return [];
  return rawText
    .split('\n')
    .map(line => line.trim())
    // Strip leading qty patterns: "2x ", "3 x ", "2.", "- "
    .map(line => line.replace(/^[\d]+\s*[xX×*.\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length >= 2 && /[a-zA-Z]{2,}/.test(line))
    .slice(0, 30); // cap at 30 items
}

// ── Screen Component ──────────────────────────────────────────────────────────

export default function ShoppingListScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('options'); // 'options' | 'camera' | 'processing' | 'results'
  const [capturedImage, setCapturedImage] = useState(null);
  const [rawItems, setRawItems] = useState([]);        // names from OCR
  const [matchedItems, setMatchedItems] = useState([]); // { name, product, loading }
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef(null);

  // ── Image Capture ─────────────────────────────────────────────────────────

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera access needed', 'Please allow camera access in Settings.');
        return;
      }
    }
    setMode('camera');
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload a shopping list.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      processImage(photo.uri);
    } catch {
      Alert.alert('Error', 'Could not capture photo.');
    }
  };

  // ── OCR + Item Matching ───────────────────────────────────────────────────

  const processImage = async (uri) => {
    setCapturedImage(uri);
    setMode('processing');
    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append('invoice', { uri, type: 'image/jpeg', name: 'shopping_list.jpg' });
      const res = await invoicesAPI.scanShoppingList(formData);
      const rawText = res.data?.rawText || '';
      const items = extractListItems(rawText);

      if (items.length === 0) {
        Alert.alert('No items found', "We couldn't read items from this image. Try a clearer photo.", [
          { text: 'Retry', onPress: () => setMode('options') },
          { text: 'Back', onPress: () => navigation.goBack() },
        ]);
        setIsScanning(false);
        return;
      }

      setRawItems(items);
      // Kick off product matching concurrently
      const placeholders = items.map(name => ({ name, product: null, loading: true, products: [] }));
      setMatchedItems(placeholders);
      setMode('results');
      setIsScanning(false);

      // Fetch each item in parallel
      const fetchItem = async (name, index) => {
        try {
          const r = await productsAPI.search(name, { limit: 3, page: 1 });
          const hits = r.data.data || [];
          setMatchedItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], products: hits, loading: false };
            return updated;
          });
        } catch {
          setMatchedItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], loading: false };
            return updated;
          });
        }
      };

      items.forEach((name, i) => fetchItem(name, i));
    } catch (err) {
      setIsScanning(false);
      Alert.alert('Scan failed', 'Could not process the image. Please try again.');
      setMode('options');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (mode === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back">
          <SafeAreaView style={styles.cameraUI} edges={['top', 'bottom']}>
            <TouchableOpacity style={styles.cameraBack} onPress={() => setMode('options')}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.cameraFrame}>
              <View style={styles.corner} />
            </View>
            <Text style={styles.cameraHint}>Position your shopping list within the frame</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  if (mode === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={StyleSheet.absoluteFill} />
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.processingImg} resizeMode="cover" />
        )}
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingTitle}>Reading your list…</Text>
          <Text style={styles.processingSubtitle}>
            Our AI is extracting items and finding{'\n'}the best prices across all stores
          </Text>
        </View>
      </View>
    );
  }

  if (mode === 'results') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <LinearGradient colors={[colors.primary, colors.primaryMedium]} style={styles.resultsHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.resultsHeaderText}>
            <Text style={styles.resultsTitle}>Your Shopping List</Text>
            <Text style={styles.resultsSub}>{rawItems.length} items found · tap to compare prices</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setMode('options')}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        <FlatList
          data={matchedItems}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              {/* OCR item name */}
              <View style={styles.itemNameRow}>
                <View style={styles.itemDot} />
                <Text style={styles.itemName}>{item.name}</Text>
                {item.loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
              </View>

              {/* Matched products */}
              {!item.loading && item.products.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsScroll}>
                  {item.products.map(product => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.matchCard}
                      onPress={() => navigation.navigate('Search', {
                        screen: 'ProductDetail',
                        params: { productId: product.id },
                      })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.matchName} numberOfLines={2}>{product.name}</Text>
                      {product.cheapestPrice != null && (
                        <Text style={styles.matchPrice}>
                          LKR {Number(product.cheapestPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                        </Text>
                      )}
                      <View style={styles.matchArrow}>
                        <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                        <Text style={styles.matchArrowText}>Compare</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : !item.loading && (
                <Text style={styles.noMatch}>No matching products found</Text>
              )}
            </View>
          )}
          ListFooterComponent={() => (
            <View style={styles.footerAction}>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => navigation.navigate('Search', { screen: 'SearchMain' })}
              >
                <Ionicons name="search-outline" size={18} color="#fff" />
                <Text style={styles.footerBtnText}>Search More Products</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  // ── Options Screen ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.optionsHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.optionsTitle}>Scan Shopping List</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.optionsBody}>
        <View style={styles.illustrationBox}>
          <Text style={styles.illustrationEmoji}>📋</Text>
          <Text style={styles.illustrationTitle}>Smart List Scanner</Text>
          <Text style={styles.illustrationText}>
            Take a photo of your handwritten or printed shopping list.{'\n'}
            We'll find the best prices for every item across all stores.
          </Text>
        </View>

        <View style={styles.optionsCards}>
          <TouchableOpacity style={styles.optionCard} onPress={openCamera} activeOpacity={0.85}>
            <View style={[styles.optionIcon, { backgroundColor: colors.primaryFaded }]}>
              <Ionicons name="camera" size={28} color={colors.primary} />
            </View>
            <Text style={styles.optionLabel}>Use Camera</Text>
            <Text style={styles.optionDesc}>Take a photo of your list</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={pickFromGallery} activeOpacity={0.85}>
            <View style={[styles.optionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="images" size={28} color={colors.secondary} />
            </View>
            <Text style={styles.optionLabel}>Upload Photo</Text>
            <Text style={styles.optionDesc}>Choose from your gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={18} color={colors.secondary} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Tip:</Text> For best results, place the list on a flat surface with good lighting. Works with handwritten and printed lists!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraUI: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  cameraBack: { alignSelf: 'flex-start', padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraFrame: {
    width: width - 60, height: 300, borderRadius: 16,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  corner: { width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', position: 'absolute', top: 10, left: 10 },
  cameraHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center' },
  captureBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },

  // Processing
  processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  processingImg: { ...StyleSheet.absoluteFillObject, opacity: 0.15 },
  processingOverlay: { alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  processingTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  processingSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },

  // Results
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10,
  },
  backBtn: { padding: 6 },
  resultsHeaderText: { flex: 1 },
  resultsTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  resultsSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  retryBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  resultsList: { padding: 16, gap: 12 },
  itemCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    ...shadows.sm,
  },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  productsScroll: { marginHorizontal: -2 },
  matchCard: {
    backgroundColor: colors.primaryFaded, borderRadius: 12,
    padding: 10, marginRight: 8, minWidth: 140,
    borderWidth: 1, borderColor: 'rgba(27,94,32,0.15)',
  },
  matchName: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4, lineHeight: 17 },
  matchPrice: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  matchArrow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  matchArrowText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  noMatch: { fontSize: 12, color: colors.textLight, fontStyle: 'italic', marginTop: 4 },
  footerAction: { paddingTop: 8, paddingBottom: 24 },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14,
  },
  footerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Options
  optionsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20,
  },
  optionsTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  optionsBody: { flex: 1, padding: 20, gap: 24 },
  illustrationBox: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  illustrationEmoji: { fontSize: 64, marginBottom: 4 },
  illustrationTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  illustrationText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  optionsCards: { flexDirection: 'row', gap: 14 },
  optionCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18,
    padding: 18, alignItems: 'center', gap: 8,
    ...shadows.md,
  },
  optionIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionDesc: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  tipBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FFE082',
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
