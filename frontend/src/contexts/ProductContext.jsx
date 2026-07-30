import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { products as seedProducts } from '../constants/site';

const ProductContext = createContext(null);
const STORAGE_KEY = 'farm2homez_seller_products';

function loadSellerProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function ProductProvider({ children }) {
  const [sellerProducts, setSellerProducts] = useState(loadSellerProducts);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sellerProducts));
  }, [sellerProducts]);

  const value = useMemo(
    () => ({
      products: [...sellerProducts, ...seedProducts],
      sellerProducts,
      addProduct(product) {
        const nextProduct = {
          id: Date.now(),
          rating: 4.5,
          reviews: 0,
          stock: product.stock || 'In stock',
          badge: 'Seller item',
          sellerManaged: true,
          ...product,
          price: Number(product.price),
        };
        setSellerProducts((current) => [nextProduct, ...current]);
      },
      removeSellerProduct(productId) {
        setSellerProducts((current) => current.filter((product) => product.id !== productId));
      },
    }),
    [sellerProducts],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (!context) throw new Error('useProducts must be used within ProductProvider');
  return context;
}
