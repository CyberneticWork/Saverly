import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invoicesAPI } from '../../services/api';
import { colors, typography, shadows } from '../../theme';

export default function InvoiceReviewScreen({ navigation, route }) {
  const invoiceId = route?.params?.invoiceId;
  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [items, setItems] = useState([]);
  const pollRef = React.useRef(null);

  useEffect(() => {
    if (!invoiceId) {
      Alert.alert('Error', 'Could not load invoice. Missing invoice ID.');
      navigation.goBack();
      return undefined;
    }

    loadInvoice();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [invoiceId]);

  const loadInvoice = async (attempt = 0) => {
    try {
      const res = await invoicesAPI.getById(invoiceId);
      const payload = res?.data?.data || res?.data?.invoice || res?.data || {};
      const data = payload?.invoice || payload;

      if (!data || typeof data !== 'object') {
        throw new Error('Unexpected invoice response from server.');
      }

      // If still processing, poll every 3s (up to 30s)
      if (data.status === 'PROCESSING' && attempt < 10) {
        setIsProcessing(true);
        setIsLoading(false);
        pollRef.current = setTimeout(() => loadInvoice(attempt + 1), 3000);
        return;
      }
      setIsProcessing(false);
      setInvoice(data);
      setItems(data.items || []);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not load invoice.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { productName: '', unitPrice: '', totalPrice: 0, quantity: 1 }]);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // Normalise field names before sending — ensure productName and unitPrice are set
      const payload = items.map(item => ({
        ...item,
        productName: item.productName || item.rawName || '',
        unitPrice: parseFloat(item.unitPrice) || 0,
        totalPrice: parseFloat(item.totalPrice) || parseFloat(item.unitPrice) || 0,
        quantity: parseFloat(item.quantity) || 1,
      }));
      await invoicesAPI.confirm(invoiceId, { items: payload });
      Alert.alert(
        'Submitted!',
        'Your receipt has been submitted. Our team will verify the prices and update the database.',
        [{ text: 'OK', onPress: () => navigation.navigate('InvoiceList') }]
      );
    } catch {
      Alert.alert('Error', 'Could not submit receipt.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading || isProcessing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
          {isProcessing ? 'Extracting items from your receipt...\nThis may take up to 30 seconds.' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header info */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Ionicons name="storefront-outline" size={16} color={colors.primary} />
          <Text style={styles.infoText}>{invoice?.storeName || 'Store detected'}</Text>
        </View>
        {invoice?.purchaseDate && (
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>{new Date(invoice.purchaseDate).toLocaleDateString()}</Text>
          </View>
        )}
        {invoice?.total && (
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>Total: LKR {invoice.total.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <View style={styles.instructionBar}>
        <Ionicons name="information-circle-outline" size={18} color={colors.secondary} />
        <Text style={styles.instructionText}>
          Review the extracted items. Correct any errors before submitting.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={styles.itemsTitle}>{items.length} Items Extracted</Text>}
        renderItem={({ item, index }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemIndex}>Item {index + 1}</Text>
              <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.itemField}>
              <Text style={styles.fieldLabel}>Product Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={item.productName || ''}
                onChangeText={(v) => handleUpdateItem(index, 'productName', v)}
                placeholder="Product name"
              />
            </View>
            <View style={styles.itemFieldRow}>
              <View style={[styles.itemField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Unit Price (Rs.)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={item.unitPrice != null ? String(item.unitPrice) : ''}
                  onChangeText={(v) => {
                    const n = parseFloat(v) || 0;
                    const qty = parseFloat(item.quantity) || 1;
                    handleUpdateItem(index, 'unitPrice', n);
                    handleUpdateItem(index, 'totalPrice', parseFloat((n * qty).toFixed(2)));
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
              <View style={[styles.itemField, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={String(item.quantity ?? 1)}
                  onChangeText={(v) => {
                    const qty = parseFloat(v) || 1;
                    const unit = parseFloat(item.unitPrice) || 0;
                    handleUpdateItem(index, 'quantity', qty);
                    handleUpdateItem(index, 'totalPrice', parseFloat((unit * qty).toFixed(2)));
                  }}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>😕</Text>
            <Text style={styles.emptyTitle}>No items detected</Text>
            <Text style={styles.emptyText}>OCR could not read the receipt. Add items manually below.</Text>
          </View>
        )}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.itemsTitle}>{items.length} Items Extracted</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              onPress={handleAddItem}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add Item</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, isConfirming && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          )}
          <Text style={styles.confirmText}>Submit Receipt</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  instructionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF3E0', paddingHorizontal: 16, paddingVertical: 10,
  },
  instructionText: { ...typography.caption, color: colors.text, flex: 1 },
  listContent: { padding: 16 },
  itemsTitle: { ...typography.h4, color: colors.text, marginBottom: 12 },
  itemCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, ...shadows.sm },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemIndex: { ...typography.label, color: colors.primary },
  itemField: { marginBottom: 10 },
  itemFieldRow: { flexDirection: 'row' },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  fieldInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText: { ...typography.button, color: colors.textSecondary },
  confirmBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { ...typography.button, color: '#fff' },
});
