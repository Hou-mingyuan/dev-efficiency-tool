<template>
  <div
    v-if="hasError"
    class="error-boundary"
  >
    <a-result
      status="error"
      :title="$t('error.boundary')"
      :sub-title="errorMsg"
    >
      <template #extra>
        <a-button
          type="primary"
          @click="retry"
        >
          {{ $t("error.retry") }}
        </a-button>
      </template>
    </a-result>
  </div>
  <div
    v-else
    :key="slotKey"
    class="error-boundary-slot"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";

const hasError = ref(false);
const errorMsg = ref("");
const slotKey = ref(0);

onErrorCaptured((err) => {
  hasError.value = true;
  errorMsg.value = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  console.error("[ErrorBoundary]", err);
  return false;
});

function retry() {
  hasError.value = false;
  slotKey.value += 1;
}
</script>

<style lang="less" scoped>
.error-boundary {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.error-boundary-slot {
  min-height: 100%;
  height: 100%;
}
</style>
