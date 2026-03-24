import { axiosPrivate } from './api';

export interface InAppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const fetchNotifications = async (): Promise<InAppNotification[]> => {
  const { data } = await axiosPrivate.get<InAppNotification[]>('/notifications');
  return data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const { data } = await axiosPrivate.get<{ count: number }>('/notifications/unread-count');
  return data.count;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  await axiosPrivate.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await axiosPrivate.post('/notifications/read-all');
};
