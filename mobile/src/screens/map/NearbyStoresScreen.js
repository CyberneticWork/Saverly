import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { supermarketsAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

export default function NearbyStoresScreen({ navigation }) {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [radius, setRadius] = useState(10);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is needed to find nearby stores.');
      setIsLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(loc.coords);
    fetchNearbyStores(loc.coords.latitude, loc.coords.longitude);
  };

  const fetchNearbyStores = async (lat, lng) => {
    try {
      const res = await supermarketsAPI.getNearby({ lat, lng, radius });
      setStores(res.data.data || []);
    } catch {} finally { setIsLoading(false); }
  };

  const openDirections = (store) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding nearby stores...</Text>
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="location-outline" size={56} color={colors.textLight} />
        <Text style={styles.noLocationTitle}>Location Required</Text>
        <Text style={styles.noLocationText}>Enable location to find stores near you</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={requestLocation}>
          <Text style={styles.retryText}>Enable Location</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {stores.map((store) => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            title={store.name}
            description={`${store.distance?.toFixed(1)} km away`}
            pinColor={colors.primary}
            onPress={() => setSelectedStore(store)}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker}>
                <Ionicons name="storefront" size={14} color="#fff" />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Store count badge */}
      <View style={styles.countBadge}>
        <Ionicons name="storefront-outline" size={14} color={colors.primary} />
        <Text style={styles.countText}>{stores.length} stores within {radius}km</Text>
      </View>

      {/* Selected store card */}
      {selectedStore && (
        <View style={styles.storeCard}>
          <TouchableOpacity style={styles.closeCard} onPress={() => setSelectedStore(null)}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.storeCardHeader}>
            <View style={styles.storeIconBg}>
              <Ionicons name="storefront" size={22} color={colors.primary} />
            </View>
            <View style={styles.storeCardInfo}>
              <Text style={styles.storeCardName}>{selectedStore.name}</Text>
              <Text style={styles.storeCardChain}>{selectedStore.supermarketChain || selectedStore.chain}</Text>
              {selectedStore.distance && (
                <Text style={styles.storeCardDist}>{selectedStore.distance.toFixed(1)} km away</Text>
              )}
              {selectedStore.address && (
                <Text style={styles.storeCardAddr} numberOfLines={2}>{selectedStore.address}</Text>
              )}
            </View>
          </View>
          <View style={styles.storeCardActions}>
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => openDirections(selectedStore)}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.directionsBtnText}>Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pricesBtn}
              onPress={() => navigation.navigate('Search', { supermarketId: selectedStore.supermarketId })}
            >
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <Text style={styles.pricesBtnText}>View Prices</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  loadingText: { ...typography.body, color: colors.textSecondary },
  noLocationTitle: { ...typography.h3, color: colors.text },
  noLocationText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryText: { ...typography.button, color: '#fff' },
  markerContainer: { alignItems: 'center' },
  marker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff', ...shadows.md,
  },
  countBadge: {
    position: 'absolute', top: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    ...shadows.md,
  },
  countText: { ...typography.body, color: colors.text, fontWeight: '600' },
  storeCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, ...shadows.lg,
  },
  closeCard: { position: 'absolute', top: 16, right: 16, padding: 4 },
  storeCardHeader: { flexDirection: 'row', marginBottom: 16 },
  storeIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryFaded, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  storeCardInfo: { flex: 1 },
  storeCardName: { ...typography.h4, color: colors.text },
  storeCardChain: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  storeCardDist: { ...typography.caption, color: colors.primary, marginTop: 2, fontWeight: '600' },
  storeCardAddr: { ...typography.caption, color: colors.textLight, marginTop: 4 },
  storeCardActions: { flexDirection: 'row', gap: 12 },
  directionsBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  directionsBtnText: { ...typography.button, color: '#fff' },
  pricesBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  pricesBtnText: { ...typography.button, color: colors.primary },
});
