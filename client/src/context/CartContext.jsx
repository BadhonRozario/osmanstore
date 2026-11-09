import { createContext, useContext, useMemo, useState } from 'react';
const CartContext = createContext(null);
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('osman-cart') || '[]'); } catch { return []; } });
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('osman-favorites') || '[]'); } catch { return []; } });
  const commit = (next) => { setItems(next); localStorage.setItem('osman-cart', JSON.stringify(next)); };
  const add = (product) => { const found = items.find((i) => i._id === product._id); commit(found ? items.map((i) => i._id === product._id ? { ...i, quantity: i.quantity + 1 } : i) : [...items, { ...product, quantity: 1 }]); };
  const setQuantity = (id, quantity) => quantity <= 0 ? remove(id) : commit(items.map((i) => i._id === id ? { ...i, quantity } : i));
  const remove = (id) => commit(items.filter((i) => i._id !== id));
  const clear = () => commit([]);
  const toggleFavorite = (product) => {
    const next = favorites.some((item) => item._id === product._id)
      ? favorites.filter((item) => item._id !== product._id)
      : [...favorites, { _id: product._id, name: product.name, nameBn: product.nameBn, price: product.price, effectivePrice: product.effectivePrice, unit: product.unit, imageUrl: product.imageUrl, category: product.category, available: product.available }];
    setFavorites(next);
    localStorage.setItem('osman-favorites', JSON.stringify(next));
  };
  const isFavorite = (id) => favorites.some((item) => item._id === id);
  const total = useMemo(() => items.reduce((s, i) => s + (i.effectivePrice ?? i.price) * i.quantity, 0), [items]);
  return <CartContext.Provider value={{ items, add, setQuantity, remove, clear, total, favorites, toggleFavorite, isFavorite, totalItems: items.length, count: items.reduce((n, i) => n + i.quantity, 0) }}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);
