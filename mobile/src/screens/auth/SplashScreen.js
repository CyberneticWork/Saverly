import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import BrandLogo from '../../components/BrandLogo';

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={['#0F6A51', colors.primary, '#35B38C']} style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.logoCard}>
          <BrandLogo width={220} />
        </View>
        <Animated.Text style={[styles.subtitle, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
          Smarter grocery decisions in one clean app.
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.features, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {[
          { icon: '●', text: 'Compare prices instantly' },
          { icon: '●', text: 'Track price history' },
          { icon: '●', text: 'Scan and save invoices' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </Animated.View>

      <View style={styles.loadingDots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, { opacity: 0.6 + i * 0.2 }]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#0B3B30',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 10,
  },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.88)', marginTop: 20, letterSpacing: 0.2, textAlign: 'center' },
  features: { alignItems: 'flex-start', gap: 16, marginBottom: 60 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 20, color: colors.secondary },
  featureText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  loadingDots: { flexDirection: 'row', gap: 8, position: 'absolute', bottom: 60 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
});
