import { axiosPrivate, axiosPublic } from './api';
import type { Monitor } from './monitors';

export interface StatusPage {
  id: string;
  name: string;
  slug: string;
  userId: string;
  createdAt: string;
  monitors: { monitor: Monitor }[];
}

export interface PublicStatusPage {
  id: string;
  name: string;
  overallStatus: 'UP' | 'DOWN' | 'DEGRADED';
  monitors: Partial<Monitor>[];
  incidents: any[];
  updatedAt: string;
}

export const fetchStatusPages = async () => {
  const { data } = await axiosPrivate.get<StatusPage[]>('/status-pages');
  return data;
};

export const createStatusPage = async (payload: { name: string; slug: string; monitorIds?: string[] }) => {
  const { data } = await axiosPrivate.post<StatusPage>('/status-pages', payload);
  return data;
};

export const deleteStatusPage = async (id: string) => {
  await axiosPrivate.delete(`/status-pages/${id}`);
};

export const updateStatusPage = async ({ id, ...payload }: { id: string; name?: string; slug?: string; monitorIds?: string[] }) => {
   const { data } = await axiosPrivate.patch<StatusPage>(`/status-pages/${id}`, payload);
   return data;
};

export const fetchPublicStatusPage = async (slug: string) => {
  const { data } = await axiosPublic.get<PublicStatusPage>(`/status-pages/public/${slug}`);
  return data;
};
