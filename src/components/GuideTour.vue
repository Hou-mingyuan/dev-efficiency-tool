<template>
  <teleport to="body">
    <div v-if="visible" class="guide-overlay" @click.self="onSkip">
      <div
        ref="spotlightRef"
        class="guide-spotlight"
        :style="spotlightStyle"
      />
      <div
        ref="popoverRef"
        class="guide-popover"
        :style="popoverStyle"
      >
        <div class="guide-popover__title">{{ currentStep.title }}</div>
        <div class="guide-popover__desc">{{ currentStep.description }}</div>
        <div class="guide-popover__footer">
          <span class="guide-popover__progress">{{ stepIndex + 1 }} / {{ steps.length }}</span>
          <div class="guide-popover__actions">
            <a-button size="small" @click="onSkip">{{ t('guide.skip') }}</a-button>
            <a-button v-if="stepIndex > 0" size="small" @click="onPrev">{{ t('guide.prev') }}</a-button>
            <a-button type="primary" size="small" @click="onNext">
              {{ isLast ? t('guide.finish') : t('guide.next') }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

interface GuideStep {
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const props = defineProps<{
  visible: boolean;
  steps: GuideStep[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const stepIndex = ref(0);
const spotlightRef = ref<HTMLElement>();
const popoverRef = ref<HTMLElement>();
const spotlightStyle = ref<Record<string, string>>({});
const popoverStyle = ref<Record<string, string>>({});

const currentStep = computed(() => props.steps[stepIndex.value]);
const isLast = computed(() => stepIndex.value === props.steps.length - 1);

function getTargetRect(): DOMRect | null {
  if (!currentStep.value) return null;
  const el = document.querySelector(currentStep.value.target);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function updatePosition() {
  const rect = getTargetRect();
  if (!rect) {
    spotlightStyle.value = { display: "none" };
    popoverStyle.value = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
    return;
  }

  const pad = 6;
  spotlightStyle.value = {
    top: `${rect.top - pad}px`,
    left: `${rect.left - pad}px`,
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
    display: "block",
  };

  const placement = currentStep.value.placement || "bottom";
  const popoverWidth = 320;
  const popoverHeight = 160;

  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.bottom + 12;
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      break;
    case "top":
      top = rect.top - popoverHeight - 12;
      left = rect.left + rect.width / 2 - popoverWidth / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.right + 12;
      break;
    case "left":
      top = rect.top + rect.height / 2 - popoverHeight / 2;
      left = rect.left - popoverWidth - 12;
      break;
  }

  left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));

  popoverStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  };
}

function onNext() {
  if (isLast.value) {
    localStorage.setItem("lng-guide-done", "1");
    emit("close");
  } else {
    stepIndex.value++;
  }
}

function onPrev() {
  if (stepIndex.value > 0) stepIndex.value--;
}

function onSkip() {
  localStorage.setItem("lng-guide-done", "1");
  emit("close");
}

watch(
  () => [props.visible, stepIndex.value],
  () => {
    if (props.visible) {
      nextTick(() => setTimeout(updatePosition, 100));
    }
  },
  { immediate: true },
);

let resizeHandler: (() => void) | null = null;

onMounted(() => {
  resizeHandler = () => {
    if (props.visible) updatePosition();
  };
  window.addEventListener("resize", resizeHandler);
});

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
});
</script>

<style lang="less" scoped>
.guide-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.45);
  animation: guideFadeIn 0.3s ease;
}

.guide-spotlight {
  position: fixed;
  border-radius: 8px;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.45),
    0 0 0 2px rgba(22, 119, 255, 0.6);
  z-index: 10001;
  pointer-events: none;
  transition: all 0.3s ease;
}

.guide-popover {
  position: fixed;
  z-index: 10002;
  width: 320px;
  background: #fff;
  border-radius: 10px;
  padding: 18px 20px 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  animation: guideSlideIn 0.3s ease;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
  }

  &__desc {
    font-size: 13px;
    color: #595959;
    line-height: 1.6;
    margin-bottom: 14px;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__progress {
    font-size: 12px;
    color: #8c8c8c;
  }

  &__actions {
    display: flex;
    gap: 6px;
  }
}

[data-theme="dark"] .guide-popover {
  background: #262626;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);

  .guide-popover__title {
    color: rgba(255, 255, 255, 0.88);
  }
  .guide-popover__desc {
    color: rgba(255, 255, 255, 0.65);
  }
  .guide-popover__progress {
    color: rgba(255, 255, 255, 0.45);
  }
}

@keyframes guideFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes guideSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
