/**
 * Web stub for react-native-maps.
 * react-native-maps uses native-only modules that cannot run on web.
 * This stub renders a placeholder so the web bundle doesn't crash.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8eaed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    color: '#5f6368',
    marginTop: 8,
  },
  sub: {
    fontSize: 13,
    color: '#9aa0a6',
    marginTop: 4,
  },
});

const MapView = React.forwardRef(function MapView({ style, children }, _ref) {
  return (
    <View style={[styles.container, style]}>
      <Text style={{ fontSize: 48 }}>🗺️</Text>
      <Text style={styles.text}>Map view is not supported on web</Text>
      <Text style={styles.sub}>Use the mobile app to see nearby stores</Text>
    </View>
  );
});

export default MapView;

export const Marker = () => null;
export const Callout = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
export const Circle = () => null;
export const Polygon = () => null;
export const Polyline = () => null;
export const Overlay = () => null;
export const Heatmap = () => null;
export const LocalTile = () => null;
export const UrlTile = () => null;
export const WMSTile = () => null;
