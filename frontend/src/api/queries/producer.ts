import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '../client';
import type {
  FulfillmentStatus,
  Inquiry,
  Page,
  ProducerOrder,
  ProducerOverview,
  ProducerProduct,
  ProducerProductRequest,
  ProducerProfile,
  ProductImage,
  UploadTicket,
} from '../types';

const PRODUCTS = '/producers/me/products/';

export function useProducerOverview(days = 30) {
  return useQuery({
    queryKey: ['producer', 'overview', days],
    queryFn: async () => (await api.get<ProducerOverview>('/analytics/producer/overview/', { params: { days } })).data,
  });
}

export function useProducerProfile() {
  return useQuery({
    queryKey: ['producer', 'profile'],
    queryFn: async () => (await api.get<ProducerProfile>('/producers/me/')).data,
  });
}

export function useUpdateProducerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ProducerProfile>) => (await api.patch<ProducerProfile>('/producers/me/', body)).data,
    onSuccess: (profile) => queryClient.setQueryData(['producer', 'profile'], profile),
  });
}

export function useResubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<ProducerProfile>('/producers/me/resubmit-verification/')).data,
    onSuccess: (profile) => queryClient.setQueryData(['producer', 'profile'], profile),
  });
}

export function useMyProducts(params: { status?: string; moderation_status?: string; search?: string; page?: number }) {
  return useQuery({
    queryKey: ['producer', 'products', params],
    queryFn: async () => (await api.get<Page<ProducerProduct>>(PRODUCTS, { params: { ...params, ordering: '-updated_at' } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useMyProduct(id: number | undefined) {
  return useQuery({
    queryKey: ['producer', 'product', id],
    queryFn: async () => (await api.get<ProducerProduct>(`${PRODUCTS}${id}/`)).data,
    enabled: Boolean(id),
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const refresh = (product?: ProducerProduct) => {
    if (product) queryClient.setQueryData(['producer', 'product', product.id], product);
    queryClient.invalidateQueries({ queryKey: ['producer', 'products'] });
    queryClient.invalidateQueries({ queryKey: ['producer', 'overview'] });
  };
  return {
    save: useMutation({
      mutationFn: async ({ id, body }: { id?: number; body: Partial<ProducerProductRequest> }) =>
        (id ? await api.patch<ProducerProduct>(`${PRODUCTS}${id}/`, body) : await api.post<ProducerProduct>(PRODUCTS, body)).data,
      onSuccess: refresh,
    }),
    publish: useMutation({
      mutationFn: async ({ id, publish }: { id: number; publish: boolean }) =>
        (await api.post<ProducerProduct>(`${PRODUCTS}${id}/${publish ? 'publish' : 'unpublish'}/`)).data,
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (id: number) => api.delete(`${PRODUCTS}${id}/`),
      onSuccess: () => refresh(),
    }),
  };
}

/**
 * Upload one image, using whichever strategy the server chooses: a presigned POST straight
 * to S3 (production) or a multipart post to the API (local development).
 */
export async function uploadProductImage(productId: number, file: File, altText = ''): Promise<ProductImage> {
  const { data: ticket } = await api.post<UploadTicket>(`${PRODUCTS}${productId}/images/upload-url/`, {
    content_type: file.type,
    size: file.size,
  });
  if (ticket.strategy === 'presigned-post') {
    const form = new FormData();
    Object.entries(ticket.fields ?? {}).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    await axios.post(ticket.url, form); // S3, not our API: no cookies or auth headers
    return (await api.post<ProductImage>(`${PRODUCTS}${productId}/images/confirm/`, { upload_id: ticket.upload_id, alt_text: altText })).data;
  }
  const form = new FormData();
  form.append('image', file);
  form.append('alt_text', altText);
  return (await api.post<ProductImage>(`${PRODUCTS}${productId}/images/`, form)).data;
}

export function useImageMutations(productId: number) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['producer', 'product', productId] });
  return {
    upload: useMutation({
      mutationFn: async ({ file, altText }: { file: File; altText?: string }) => uploadProductImage(productId, file, altText),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (imageId: number) => api.delete(`${PRODUCTS}${productId}/images/${imageId}/`),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: async (imageIds: number[]) => api.post(`${PRODUCTS}${productId}/images/order/`, { image_ids: imageIds }),
      onSuccess: refresh,
    }),
  };
}

export function useProducerOrders(params: { status?: string; page?: number }) {
  return useQuery({
    queryKey: ['producer', 'orders', params],
    queryFn: async () => (await api.get<Page<ProducerOrder>>('/producers/me/orders/', { params: { ...params, ordering: '-created_at' } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useProducerOrder(id: number | undefined) {
  return useQuery({
    queryKey: ['producer', 'order', id],
    queryFn: async () => (await api.get<ProducerOrder>(`/producers/me/orders/${id}/`)).data,
    enabled: Boolean(id),
  });
}

export function useTransitionOrder(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { status: FulfillmentStatus; note?: string }) =>
      (await api.post<ProducerOrder>(`/producers/me/orders/${id}/status/`, input)).data,
    onSuccess: (order) => {
      queryClient.setQueryData(['producer', 'order', id], order);
      queryClient.invalidateQueries({ queryKey: ['producer', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['producer', 'overview'] });
    },
  });
}

export function useProducerInquiries(status?: string) {
  return useQuery({
    queryKey: ['producer', 'inquiries', status],
    queryFn: async () => (await api.get<Page<Inquiry>>('/producers/me/inquiries/', { params: { status, page_size: 50 } })).data,
  });
}

export function useCloseInquiry(scope: 'producer' | 'admin') {
  const queryClient = useQueryClient();
  const base = scope === 'producer' ? '/producers/me/inquiries/' : '/admin/inquiries/';
  return useMutation({
    mutationFn: async (id: number) => (await api.post(`${base}${id}/close/`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [scope, 'inquiries'] }),
  });
}
