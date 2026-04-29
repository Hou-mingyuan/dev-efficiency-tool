<template>
  <a-popover
    v-model:open="popoverOpen"
    placement="bottomRight"
    trigger="click"
    :overlay-inner-style="{
      padding: 0,
    }"
  >
    <template #content>
      <div class="nc-popover">
        <div class="nc-popover__head">
          <span class="nc-popover__title">{{ t("notification.title") }}</span>
          <a-space
            v-if="store.notifications.length"
            :size="8"
            wrap
          >
            <a-button
              type="link"
              size="small"
              :disabled="store.unreadCount === 0"
              @click.stop="onMarkAllRead"
            >
              {{ t("notification.markAllRead") }}
            </a-button>
            <a-button
              type="link"
              size="small"
              danger
              @click.stop="onClearAll"
            >
              {{ t("notification.clearAll") }}
            </a-button>
          </a-space>
        </div>
        <a-empty
          v-if="store.notifications.length === 0"
          :description="t('notification.noNotifications')"
          class="nc-popover__empty"
        />
        <div
          v-else
          class="nc-popover__list"
        >
          <div
            v-for="n in store.notifications"
            :key="n.id"
            :class="[
              'nc-item',
              'nc-item--type-' + n.type,
              { 'nc-item--unread': !n.read },
            ]"
            role="button"
            tabindex="0"
            @click="onItemClick(n.id)"
            @keydown.enter.prevent="onItemClick(n.id)"
          >
            <div class="nc-item__icon">
              <InfoCircleOutlined v-if="n.type === 'info'" />
              <CheckCircleOutlined v-else-if="n.type === 'success'" />
              <ExclamationCircleOutlined v-else-if="n.type === 'warning'" />
              <CloseCircleOutlined v-else />
            </div>
            <div class="nc-item__body">
              <div class="nc-item__title-row">
                <span class="nc-item__title">{{ n.title }}</span>
                <span class="nc-item__time">{{ formatTime(n.time) }}</span>
              </div>
              <div
                v-if="n.message"
                class="nc-item__message"
              >
                {{ n.message }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <a-badge
      :count="store.unreadCount"
      :overflow-count="99"
    >
      <a-button
        type="text"
        class="nc-trigger"
        :aria-label="t('notification.title')"
      >
        <BellOutlined />
      </a-button>
    </a-badge>
  </a-popover>
</template>

<script setup lang="ts">
import {
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons-vue";
import { useNotificationStore } from "@/store/notification";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t, locale } = useI18n();
const store = useNotificationStore();
const popoverOpen = ref(false);

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale.value === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function onItemClick(id: string) {
  store.markRead(id);
}

function onMarkAllRead() {
  store.markAllRead();
}

function onClearAll() {
  store.clearAll();
}
</script>

<style lang="less" scoped>
.nc-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.nc-popover {
  width: 380px;
  max-width: min(96vw, 400px);
}

.nc-popover__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 0;
  flex-wrap: wrap;
  background: rgba(4, 8, 14, 0.22);
}

.nc-popover__title {
  font-size: 14px;
  font-family: var(--app-font-display);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.nc-popover__empty {
  padding: 16px 12px 20px;
}

.nc-popover__list {
  max-height: 360px;
  overflow-y: auto;
}

.nc-item {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: background var(--app-transition, 0.2s ease), transform 0.15s ease;
  border-bottom: 0;
  border-radius: 0;
  margin: 2px 4px;
  &:active {
    transform: scale(0.98);
  }
}

.nc-item:last-child {
  border-bottom: none;
}

.nc-item:hover {
  background: rgba(96, 165, 250, 0.07);
}

.nc-item--unread {
  background: color-mix(in srgb, var(--app-primary) 8%, transparent);
}

.nc-item__icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1.4;
  margin-top: 2px;
  color: var(--app-primary, #3b82f6);
}

.nc-item--type-success .nc-item__icon {
  color: var(--app-success, #10b981);
}
.nc-item--type-warning .nc-item__icon {
  color: var(--app-warning, #f59e0b);
}
.nc-item--type-error .nc-item__icon {
  color: var(--app-error, #ef4444);
}

.nc-item__body {
  min-width: 0;
  flex: 1;
}

.nc-item__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.nc-item__title {
  font-size: 13px;
  font-weight: 800;
  word-break: break-word;
}

.nc-item__time {
  flex-shrink: 0;
  font-size: 12px;
  font-family: var(--app-font-mono);
  font-weight: 700;
  color: var(--app-text-tertiary, rgba(0, 0, 0, 0.45));
}

.nc-item__message {
  font-size: 12px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  margin-top: 4px;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
