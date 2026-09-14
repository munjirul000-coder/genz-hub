"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CartItem = {
  id: string;
  title: string;
  brand: string;
  vaultPrice: number;
  originalPrice: number;
  image: string;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType>({
  items: [],
  add: () => {},
  remove: () => {},
  updateQty: () => {},
  clear: () => {},
  total: 0,
  count: 0,
});

const STORAGE_KEY = "fv_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = (item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        return prev.map(p => p.id === item.id ? { ...p, quantity: Math.min(10, p.quantity + qty) } : p);
      }
      return [...prev, { ...item, quantity: Math.min(10, qty) }];
    });
  };

  const remove = (id: string) => setItems(prev => prev.filter(p => p.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return remove(id);
    setItems(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.min(10, qty) } : p));
  };
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + i.vaultPrice * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return <CartContext.Provider value={{ items, add, remove, updateQty, clear, total, count }}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
