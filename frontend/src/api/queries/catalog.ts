import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Category, Page, PaymentMethod, ProducerPublic, ProductDetail, ProductList, Review } from '../types';

export interface ProductQuery {
  search?: string;
  category?: string;
  producer?: string;
  state?: string;
  min_price?: string;
  max_price?: string;
  in_stock?: string;
  organic?: string;
  seasonal?: string;
  ordering?: string;
  page?: string;
  page_size?: string;
}

function clean(params: object) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<Category[]>('/categories/')).data,
    staleTime: 5 * 60_000,
  });
}

export function useProducts(params: ProductQuery) {
  return useQuery({
    queryKey: ['products', clean(params)],
    queryFn: async () => (await api.get<Page<ProductList>>('/products/', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await api.get<ProductDetail>(`/products/${slug}/`)).data,
    enabled: Boolean(slug),
  });
}

export function useProducers(params: { search?: string; state?: string; page?: string }) {
  return useQuery({
    queryKey: ['producers', clean(params)],
    queryFn: async () => (await api.get<Page<ProducerPublic>>('/producers/', { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });
}

export function useProducer(slug: string | undefined) {
  return useQuery({
    queryKey: ['producer', slug],
    queryFn: async () => (await api.get<ProducerPublic>(`/producers/${slug}/`)).data,
    enabled: Boolean(slug),
  });
}

export function useProductReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ['reviews', slug],
    queryFn: async () => (await api.get<Page<Review>>('/reviews/', { params: { product: slug } })).data,
    enabled: Boolean(slug),
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => (await api.get<PaymentMethod[]>('/orders/payment-methods/')).data,
    staleTime: 10 * 60_000,
  });
}

export function useRecordView() {
  return useMutation({
    mutationFn: async (slug: string) => {
      await api.post('/analytics/product-views/', { product: slug });
    },
  });
}

export interface InquiryInput {
  producer_slug?: string;
  product_slug?: string;
  name?: string;
  email?: string;
  phone?: string;
  subject: string;
  message: string;
}

export function useSendInquiry() {
  return useMutation({
    mutationFn: async (input: InquiryInput) => (await api.post('/inquiries/', input)).data,
  });
}
