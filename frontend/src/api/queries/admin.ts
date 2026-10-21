import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  AdminCategory,
  AdminOrder,
  AdminProducer,
  AdminProduct,
  AdminUser,
  AuditLog,
  FulfillmentStatus,
  Inquiry,
  OrderList,
  Page,
  PlatformOverview,
} from '../types';

type Params = Record<string, string | number | undefined>;

function clean(params: Params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
}

function useAdminList<T>(resource: string, params: Params) {
  return useQuery({
    queryKey: ['admin', resource, clean(params)],
    queryFn: async () => (await api.get<Page<T>>(`/admin/${resource}/`, { params: clean(params) })).data,
    placeholderData: keepPreviousData,
  });
}

export const useAdminUsers = (params: Params) => useAdminList<AdminUser>('users', params);
export const useAdminProducers = (params: Params) => useAdminList<AdminProducer>('producers', params);
export const useAdminProducts = (params: Params) => useAdminList<AdminProduct>('products', params);
export const useAdminOrders = (params: Params) => useAdminList<OrderList>('orders', params);
export const useAdminInquiries = (params: Params) => useAdminList<Inquiry>('inquiries', params);
export const useAuditLogs = (params: Params) => useAdminList<AuditLog>('audit-logs', params);

export function usePlatformOverview(days = 30) {
  return useQuery({
    queryKey: ['admin', 'overview', days],
    queryFn: async () => (await api.get<PlatformOverview>('/admin/reports/overview/', { params: { days } })).data,
  });
}

export function useAdminOrder(number: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'order', number],
    queryFn: async () => (await api.get<AdminOrder>(`/admin/orders/${number}/`)).data,
    enabled: Boolean(number),
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await api.get<AdminCategory[]>('/admin/categories/')).data,
  });
}

export function useAdminActions() {
  const queryClient = useQueryClient();
  const invalidate = (...resources: string[]) => () =>
    Promise.all([...resources, 'overview', 'audit-logs'].map((resource) => queryClient.invalidateQueries({ queryKey: ['admin', resource] })));
  return {
    verifyProducer: useMutation({
      mutationFn: async ({ id, decision, note }: { id: number; decision: 'VERIFIED' | 'REJECTED'; note?: string }) =>
        (await api.post<AdminProducer>(`/admin/producers/${id}/verification/`, { decision, note })).data,
      onSuccess: invalidate('producers', 'users'),
    }),
    suspendUser: useMutation({
      mutationFn: async ({ id, reason }: { id: number; reason: string }) => (await api.post<AdminUser>(`/admin/users/${id}/suspend/`, { reason })).data,
      onSuccess: invalidate('users', 'producers'),
    }),
    reactivateUser: useMutation({
      mutationFn: async (id: number) => (await api.post<AdminUser>(`/admin/users/${id}/reactivate/`)).data,
      onSuccess: invalidate('users', 'producers'),
    }),
    moderateProduct: useMutation({
      mutationFn: async ({ id, decision, note }: { id: number; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
        (await api.post<AdminProduct>(`/admin/products/${id}/moderate/`, { decision, note })).data,
      onSuccess: invalidate('products'),
    }),
    transitionFulfilment: useMutation({
      mutationFn: async ({ number, fulfilmentId, status, note }: { number: string; fulfilmentId: number; status: FulfillmentStatus; note?: string }) =>
        (await api.post<AdminOrder>(`/admin/orders/${number}/fulfillments/${fulfilmentId}/status/`, { status, note })).data,
      onSuccess: (order) => {
        queryClient.setQueryData(['admin', 'order', order.number], order);
        return invalidate('orders')();
      },
    }),
    saveCategory: useMutation({
      mutationFn: async ({ id, ...body }: Partial<AdminCategory> & { id?: number }) =>
        (id ? await api.patch<AdminCategory>(`/admin/categories/${id}/`, body) : await api.post<AdminCategory>('/admin/categories/', body)).data,
      onSuccess: async () => {
        await invalidate('categories')();
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
      },
    }),
    deleteCategory: useMutation({
      mutationFn: async (id: number) => api.delete(`/admin/categories/${id}/`),
      onSuccess: invalidate('categories'),
    }),
  };
}
