import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ProductProvider } from './contexts/ProductContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
