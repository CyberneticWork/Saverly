import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, Camera } from 'expo-camera';
import { invoicesAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

// ── On-device OCR via Gemini Vision (avoids large image uploads) ──────────────
async function extractTextWithGemini(base64Image) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash-lite';
  if (!apiKey) throw new Error('OCR service not configured. Contact support.');

  const prompt = `Extract ALL text from this grocery receipt image exactly as it appears.
Include every line: store name, date, product names, quantities, prices, totals, and all other visible text.
Output plain text only, preserving the layout as closely as possible.
Do NOT summarise or interpret — just extract the raw text.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        ]}],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OCR failed (${response.status})`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('No text could be extracted from the receipt.');
  return text;
}

export default function InvoiceScanScreen({ navigation }) {
  const [mode, setMode] = useState('picker'); // 'picker' | 'camera'
  const [hasPermission, setHasPermission] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const cameraRef = useRef(null);

  const requestCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') setMode('camera');
    else Alert.alert('Permission denied', 'Camera access is needed to scan receipts.');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    setSelectedImage(photo.uri);
    setMode('picker');
  };

  const handleUpload = async () => {
    if (!selectedImage) return;
    setIsUploading(true);
    setUploadStatus('Preparing image…');
    try {
      // Step 1: Compress image on device → reduces to ~200-400 KB
      const compressed = await ImageManipulator.manipulateAsync(
        selectedImage,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Step 2: Run OCR on device via Gemini Vision — sends compressed image to Gemini,
      //         returns raw receipt text (NOT uploaded to our server)
      setUploadStatus('Reading receipt…');
      const ocrText = await extractTextWithGemini(compressed.base64);

      // Step 3: Send only the extracted TEXT to our server (tiny JSON payload, no image)
      setUploadStatus('Saving invoice…');
      const res = await invoicesAPI.scanText({ ocrText });
      const payload = res?.data?.data || res?.data || {};
      const invoiceId = payload.invoiceId || payload.id || payload?.invoice?.id;

      if (!invoiceId) throw new Error('Unexpected response from server.');
      navigation.replace('InvoiceReview', { invoiceId });
    } catch (err) {
      Alert.alert('Scan failed', err?.response?.data?.message || err?.message || 'Please try again.');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  if (mode === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraCornerTL} />
            <View style={styles.cameraCornerTR} />
            <View style={styles.cameraCornerBL} />
            <View style={styles.cameraCornerBR} />
          </View>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraBtn} onPress={() => setMode('picker')}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={{ width: 52 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.hero}>
          <Text style={styles.heroIcon}>📄</Text>
          <Text style={styles.heroTitle}>Scan Receipt</Text>
          <Text style={styles.heroSub}>Scan a grocery receipt and we'll automatically extract product prices to help you compare</Text>
        </LinearGradient>

        {selectedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setSelectedImage(null)}>
              <Ionicons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.retakeText}>Choose different image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.options}>
            <TouchableOpacity style={styles.optionCard} onPress={requestCamera} activeOpacity={0.8}>
              <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.optionIcon}>
                <Ionicons name="camera" size={32} color="#fff" />
              </LinearGradient>
              <Text style={styles.optionTitle}>Take a Photo</Text>
              <Text style={styles.optionSub}>Use camera to photograph your receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={pickImage} activeOpacity={0.8}>
              <LinearGradient colors={['#0277BD', '#0288D1']} style={styles.optionIcon}>
                <Ionicons name="image" size={32} color="#fff" />
              </LinearGradient>
              <Text style={styles.optionTitle}>Choose from Gallery</Text>
              <Text style={styles.optionSub}>Select a receipt photo from your library</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>For best results:</Text>
          {[
            'Ensure receipt is flat and well-lit',
            'Capture the entire receipt',
            'Avoid shadows and glare',
            'Hold camera steady',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.viewHistoryBtn}
          onPress={() => navigation.navigate('InvoiceList')}
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.viewHistoryText}>View Scan History</Text>
        </TouchableOpacity>
      </ScrollView>

      {selectedImage && (
        <View style={styles.uploadBar}>
          <TouchableOpacity
            style={[styles.uploadBtn, isUploading && styles.uploadBtnDisabled]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.uploadBtnText}>{uploadStatus || 'Scanning…'}</Text>
              </>
            ) : (
              <>
                <Ionicons name="scan" size={20} color="#fff" />
                <Text style={styles.uploadBtnText}>Scan & Extract Prices</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  cameraContainer: { flex: 1 },
  camera: { flex: 1, justifyContent: 'flex-end' },
  cameraOverlay: { position: 'absolute', top: '20%', left: '10%', right: '10%', bottom: '30%' },
  cameraCornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderRadius: 2 },
  cameraCornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderRadius: 2 },
  cameraCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderRadius: 2 },
  cameraCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderRadius: 2 },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  cameraBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary },
  content: { paddingBottom: 100 },
  hero: { padding: 32, alignItems: 'center' },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  heroTitle: { ...typography.h2, color: '#fff', textAlign: 'center' },
  heroSub: { ...typography.body, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8 },
  previewContainer: { padding: 20, alignItems: 'center' },
  previewImage: { width: '100%', height: 300, borderRadius: 16 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  retakeText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  options: { padding: 20, gap: 16 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, ...shadows.sm, gap: 16 },
  optionIcon: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { ...typography.h4, color: colors.text },
  optionSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tipsCard: { margin: 20, backgroundColor: '#E8F5E9', borderRadius: 16, padding: 16, gap: 8 },
  tipsTitle: { ...typography.body, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { ...typography.body, color: colors.text },
  viewHistoryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  viewHistoryText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  uploadBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border },
  uploadBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadBtnDisabled: { opacity: 0.7 },
  uploadBtnText: { ...typography.button, color: '#fff' },
});
