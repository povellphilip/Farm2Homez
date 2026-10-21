import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '../client';
import type { Address, AddressRequest, Cart, FavoriteProducer, FavoriteProduct, Inquiry, Order, OrderList, Page } from '../types';

function useIsConsumer() {
  const { user } = useAuth();
  return user?.role === 'CONSUMER';
}

// ---- Cart ------------------------------------------------------------------
export function useCart() {
  const enabled = useIsConsumer();
  return useQuery({
    queryKey: ['me', 'cart'],
    queryFn: async () => (await api.get<Cart>('/cart/')).data,
    enabled,
  });
}

export function useCartMutations() {
  const queryClient = useQueryClient();
  const setCart = (cart: Cart) => queryClient.setQueryData(['me', 'cart'], cart);
  return {
    add: useMutation({
      mutationFn: async (input: { product_slug: string; quantity: number }) => (await api.post<Cart>('/cart/items/', input)).data,
      onSuccess: setCart,
    }),
    update: useMutation({
      mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => (await api.patch<Cart>(`/cart/items/${id}/`, { quantity })).data,
      onSuccess: setCart,
    }),
    remove: useMutation({
      mutationFn: async (id: number) => (await api.delete<Cart>(`/cart/items/${id}/`)).data,
      onSuccess: setCart,
    }),
  };
}

// ---- Orders ----------------------------------------------------------------
export interface CheckoutInput {
  idempotencyKey: string;
  address_id?: number;
  address?: { name: string; phone: string; line1: string; line2?: string; city: string; district?: string; state: string; postal_code: string };
  save_address?: boolean;
  payment_method: 'COD' | 'MOCK_ONLINE';
  notes?: string;
  expected_total: string;
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ idempotencyKey, ...body }: CheckoutInput) =>
      (await api.post<Order>('/orders/checkout/', body, { headers: { 'Idempotency-Key': idempotencyKey } })).data,
    onSuccess: (order) => {
      queryClient.setQueryData(['me', 'order', order.number], order);
      queryClient.invalidateQueries({ queryKey: ['me', 'cart'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'addresses'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: ['me', 'orders', page],
    queryFn: async () => (await api.get<Page<OrderList>>('/orders/', { params: { page } })).data,
  });
}

export function useMyOrder(number: string | undefined) {
  return useQuery({
    queryKey: ['me', 'order', number],
    queryFn: async () => (await api.get<Order>(`/orders/${number}/`)).data,
    enabled: Boolean(number),
  });
}

export function useCancelOrder(number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => (await api.post<Order>(`/orders/${number}/cancel/`, { reason })).data,
    onSuccess: (order) => {
      queryClient.setQueryData(['me', 'order', number], order);
      queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
    },
  });
}

// ---- Addresses -------------------------------------------------------------
export function useAddresses() {
  const enabled = useIsConsumer();
  return useQuery({
    queryKey: ['me', 'addresses'],
    queryFn: async () => (await api.get<Address[]>('/consumers/me/addresses/')).data,
    enabled,
  });
}

export function useAddressMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['me', 'addresses'] });
  return {
    save: useMutation({
      mutationFn: async ({ id, ...body }: AddressRequest & { id?: number }) =>
        (id ? await api.patch<Address>(`/consumers/me/addresses/${id}/`, body) : await api.post<Address>('/consumers/me/addresses/', body)).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: number) => api.delete(`/consumers/me/addresses/${id}/`),
      onSuccess: invalidate,
    }),
    makeDefault: useMutation({
      mutationFn: async (id: number) => api.post(`/consumers/me/addresses/${id}/set-default/`),
      onSuccess: invalidate,
    }),
  };
}

// ---- Favourites ------------------------------------------------------------
export function useFavoriteProducts() {
  const enabled = useIsConsumer();
  return useQuery({
    queryKey: ['me', 'favorites', 'products'],
    queryFn: async () => (await api.get<Page<FavoriteProduct>>('/consumers/me/favorites/products/', { params: { page_size: 100 } })).data,
    enabled,
  });
}

export function useFavoriteProducers() {
  const enabled = useIsConsumer();
  return useQuery({
    queryKey: ['me', 'favorites', 'producers'],
    queryFn: async () => (await api.get<Page<FavoriteProducer>>('/consumers/me/favorites/producers/', { params: { page_size: 100 } })).data,
    enabled,
  });
}

export function useToggleFavorite(kind: 'products' | 'producers') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, saved }: { slug: string; saved: boolean }) => {
      const base = `/consumers/me/favorites/${kind}/`;
      if (saved) await api.delete(`${base}${slug}/`);
      else await api.post(base, kind === 'products' ? { product_slug: slug } : { producer_slug: slug });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'favorites', kind] }),
  });
}

// ---- Inquiries -------------------------------------------------------------
export function useMyInquiries() {
  return useQuery({
    queryKey: ['me', 'inquiries'],
    queryFn: async () => (await api.get<Page<Inquiry>>('/inquiries/mine/', { params: { page_size: 50 } })).data,
  });
}

export function useReplyToInquiry(scope: 'consumer' | 'producer' | 'admin') {
  const queryClient = useQueryClient();
  const base = { consumer: '/inquiries/mine/', producer: '/producers/me/inquiries/', admin: '/admin/inquiries/' }[scope];
  return useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => (await api.post(`${base}${id}/reply/`, { message })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scope === 'consumer' ? ['me', 'inquiries'] : [scope, 'inquiries'] }),
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { product: string; rating: number; comment: string }) => (await api.post('/reviews/', input)).data,
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', input.product] });
      queryClient.invalidateQueries({ queryKey: ['product', input.product] });
    },
  });
}
