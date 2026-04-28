import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { productsAPI } from '../../services/api';
import { colors, typography } from '../../theme';

const { width } = Dimensions.get('window');

export default function PriceChart({ productId }) {
  const [historyData, setHistoryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [productId]);

  const loadHistory = async () => {
    try {
      const res = await productsAPI.getPriceHistory(productId);
      const raw = res.data.data || [];

      // Group by supermarket
      const byStore = {};
      raw.forEach(record => {
        const name = record.supermarket?.name || record.supermarketName || 'Unknown';
        if (!byStore[name]) byStore[name] = [];
        byStore[name].push({ date: record.recordedAt, price: record.price });
      });

      // Take up to 3 stores, and align labels to last 7 data points
      const storeNames = Object.keys(byStore).slice(0, 3);
      if (storeNames.length === 0) { setIsLoading(false); return; }

      const maxPoints = 7;
      // Build unified label set (dates)
      const allDates = [...new Set(raw.map(r => r.recordedAt?.split('T')[0]))].sort().slice(-maxPoints);

      const datasets = storeNames.map((store, i) => {
        const storeRecords = byStore[store];
        const data = allDates.map(date => {
          const found = storeRecords.find(r => r.date?.startsWith(date));
          return found ? Number(found.price) : null;
        });
        // Fill nulls with last known value
        let lastVal = data.find(v => v !== null) || 0;
        const filled = data.map(v => { if (v !== null) { lastVal = v; return v; } return lastVal; });
        return {
          data: filled,
          color: (opacity = 1) => CHART_COLORS[i](opacity),
          strokeWidth: 2,
        };
      });

      setHistoryData({
        labels: allDates.map(d => d.slice(5)), // MM-DD
        datasets,
        legend: storeNames,
      });
    } catch {} finally { setIsLoading(false); }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="small" color={colors.primary} /></View>;
  }

  if (!historyData || historyData.datasets.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No price history available yet</Text>
      </View>
    );
  }

  return (
    <View>
      <LineChart
        data={historyData}
        width={width - 48}
        height={200}
        chartConfig={{
          backgroundColor: '#fff',
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(27, 94, 32, ${opacity})`,
          labelColor: () => colors.textSecondary,
          style: { borderRadius: 12 },
          propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
        }}
        bezier
        style={styles.chart}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLines={false}
      />
      {/* Legend */}
      <View style={styles.legend}>
        {historyData.legend.map((store, i) => (
          <View key={store} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: CHART_COLORS_HEX[i] }]} />
            <Text style={styles.legendText}>{store}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const CHART_COLORS = [
  (opacity) => `rgba(27, 94, 32, ${opacity})`,
  (opacity) => `rgba(255, 111, 0, ${opacity})`,
  (opacity) => `rgba(2, 119, 189, ${opacity})`,
];
const CHART_COLORS_HEX = ['#1B5E20', '#FF6F00', '#0277BD'];

const styles = StyleSheet.create({
  center: { paddingVertical: 32, alignItems: 'center' },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { ...typography.caption, color: colors.textSecondary },
  chart: { borderRadius: 12, paddingRight: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.caption, color: colors.textSecondary },
});
