import { ref, computed, type ComputedRef } from "vue";
import { defineStore } from "pinia";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

let idSeq = 0;

function newId(): string {
  return `n-${Date.now()}-${++idSeq}`;
}

export const useNotificationStore = defineStore("notification", () => {
  const notifications = ref<AppNotification[]>([]);

  const unreadCount: ComputedRef<number> = computed(
    () => notifications.value.filter((n) => !n.read).length
  );

  function addNotification(
    payload: Omit<AppNotification, "id" | "time" | "read"> & {
      id?: string;
      time?: string;
      read?: boolean;
    }
  ): string {
    const id = payload.id ?? newId();
    const n: AppNotification = {
      id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      time: payload.time ?? new Date().toISOString(),
      read: payload.read ?? false,
    };
    notifications.value = [n, ...notifications.value];
    return id;
  }

  function markRead(id: string): void {
    const i = notifications.value.findIndex((x) => x.id === id);
    if (i === -1) return;
    notifications.value[i] = { ...notifications.value[i], read: true };
  }

  function markAllRead(): void {
    notifications.value = notifications.value.map((n) => ({ ...n, read: true }));
  }

  function clearAll(): void {
    notifications.value = [];
  }

  return {
    notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
  };
});
