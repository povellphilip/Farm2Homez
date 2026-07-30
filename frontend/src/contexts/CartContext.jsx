import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { products } from '../constants/site';

const CartContext = createContext(null);
const STORAGE_KEY = 'farm2homez_cart';

const starterCart = [
  { productId: 1, quantity: 1 },
  { productId: 2, quantity: 1 },
];

function hydrateCart() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : starterCart;
  } catch {
    return starterCart;
  }
}

function withProductData(items) {
  return items
    .map((item) => {
      const product = item.product || products.find((entry) => entry.id === item.productId);
      return product ? { ...product, quantity: item.quantity } : null;
    })
    .filter(Boolean);
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(hydrateCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const value = useMemo(() => {
    const items = withProductData(cartItems);
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    const delivery = subtotal > 0 && subtotal < 999 ? 49 : 0;
    const taxes = Math.round(subtotal * 0.05);
    const total = subtotal + delivery + taxes;
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotal,
      delivery,
      taxes,
      total,
      count,
      addItem(product, quantity = 1) {
        setCartItems((current) => {
          const existing = current.find((item) => item.productId === product.id);
          if (existing) {
            return current.map((item) =>
              item.productId === product.id ? { ...item, quantity: Math.min(item.quantity + quantity, 10) } : item,
            );
          }
          return [...current, { productId: product.id, quantity, product }];
        });
      },
      updateQuantity(productId, quantity) {
        setCartItems((current) =>
          current.map((item) => (item.productId === productId ? { ...item, quantity: Number(quantity) } : item)),
        );
      },
      removeItem(productId) {
        setCartItems((current) => current.filter((item) => item.productId !== productId));
      },
      clearCart() {
        setCartItems([]);
      },
    };
  }, [cartItems]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
