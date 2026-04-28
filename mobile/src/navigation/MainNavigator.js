import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

// Screens
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/search/SearchScreen';
import PriceCompareScreen from '../screens/compare/PriceCompareScreen';
import ShoppingListScreen from '../screens/shoppingList/ShoppingListScreen';
import ShoppingListDetailScreen from '../screens/shoppingList/ShoppingListDetailScreen';
import ShoppingListOptimizeScreen from '../screens/shoppingList/ShoppingListOptimizeScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import InvoiceScanScreen from '../screens/invoice/InvoiceScanScreen';
import InvoiceReviewScreen from '../screens/invoice/InvoiceReviewScreen';
import InvoiceListScreen from '../screens/invoice/InvoiceListScreen';
import ShoppingListScanScreen from '../screens/invoice/ShoppingListScanScreen';
import NearbyStoresScreen from '../screens/map/NearbyStoresScreen';
import FavouritesScreen from '../screens/favourites/FavouritesScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProductDetailScreen from '../screens/search/ProductDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const tabBarIcon = (name, focused) => ({ color }) => (
  <Ionicons name={focused ? name : `${name}-outline`} size={24} color={color} />
);

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen name="PriceCompare" component={PriceCompareScreen} options={{ title: 'Price Comparison' }} />
      <Stack.Screen name="NearbyStores" component={NearbyStoresScreen} options={{ title: 'Nearby Stores' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} options={{ title: 'My Favourites' }} />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="SearchMain" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen name="PriceCompare" component={PriceCompareScreen} options={{ title: 'Price Comparison' }} />
      <Stack.Screen name="ShoppingListScan" component={ShoppingListScanScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function ShoppingStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ShoppingListMain" component={ShoppingListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ShoppingListDetail" component={ShoppingListDetailScreen} options={{ title: 'Shopping List' }} />
      <Stack.Screen name="ShoppingListOptimize" component={ShoppingListOptimizeScreen} options={{ title: 'Best Store Finder' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Product Details' }} />
    </Stack.Navigator>
  );
}

function InvoiceStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="InvoiceScan" component={InvoiceScanScreen} options={{ title: 'Scan Invoice', headerTransparent: true, headerTintColor: '#fff' }} />
      <Stack.Screen name="InvoiceReview" component={InvoiceReviewScreen} options={{ title: 'Review Invoice' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Favourites" component={FavouritesScreen} options={{ title: 'My Favourites' }} />
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ title: 'My Invoices' }} />
    </Stack.Navigator>
  );
}

const stackOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { ...typography.h4, color: '#fff' },
  headerBackTitleVisible: false,
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarIcon: tabBarIcon('home') }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{ tabBarIcon: tabBarIcon('search') }}
      />
      <Tab.Screen
        name="Shopping"
        component={ShoppingStack}
        options={{
          tabBarLabel: 'Lists',
          tabBarIcon: tabBarIcon('list'),
        }}
      />
      <Tab.Screen
        name="Invoice"
        component={InvoiceStack}
        options={{
          tabBarLabel: 'Invoices',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.scanActive : styles.scanBtn}>
              <Ionicons name="scan" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarIcon: tabBarIcon('person') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  scanBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanActive: {
    width: 40,
    height: 40,
    backgroundColor: colors.primaryFaded,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
