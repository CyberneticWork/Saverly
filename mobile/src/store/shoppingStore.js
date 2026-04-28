import { create } from 'zustand';
import { shoppingListsAPI } from '../services/api';

export const useShoppingStore = create((set, get) => ({
  lists: [],
  currentList: null,
  optimization: null,
  isLoading: false,

  fetchLists: async () => {
    set({ isLoading: true });
    try {
      const { data } = await shoppingListsAPI.list();
      set({ lists: data.data });
    } finally {
      set({ isLoading: false });
    }
  },

  createList: async (name, description) => {
    const { data } = await shoppingListsAPI.create({ name, description });
    set(state => ({ lists: [data.data, ...state.lists] }));
    return data.data;
  },

  fetchList: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await shoppingListsAPI.getById(id);
      set({ currentList: data.data });
      return data.data;
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (listId, productId, quantity, unit) => {
    const { data } = await shoppingListsAPI.addItem(listId, { productId, quantity, unit });
    set(state => ({
      currentList: state.currentList
        ? {
            ...state.currentList,
            items: [...(state.currentList.items || []).filter(i => i.product.id !== productId), data.data],
          }
        : null,
    }));
    return data.data;
  },

  removeItem: async (listId, itemId) => {
    await shoppingListsAPI.removeItem(listId, itemId);
    set(state => ({
      currentList: state.currentList
        ? { ...state.currentList, items: state.currentList.items.filter(i => i.id !== itemId) }
        : null,
    }));
  },

  toggleCheck: async (listId, itemId) => {
    const { data } = await shoppingListsAPI.toggleCheck(listId, itemId);
    set(state => ({
      currentList: state.currentList
        ? {
            ...state.currentList,
            items: state.currentList.items.map(i =>
              i.id === itemId ? { ...i, isChecked: data.data.isChecked } : i
            ),
          }
        : null,
    }));
  },

  optimize: async (listId) => {
    set({ isLoading: true });
    try {
      const { data } = await shoppingListsAPI.optimize(listId);
      set({ optimization: data.data });
      return data.data;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteList: async (id) => {
    await shoppingListsAPI.remove(id);
    set(state => ({ lists: state.lists.filter(l => l.id !== id) }));
  },
}));
