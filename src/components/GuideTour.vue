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
  background: rgba(2, 4, 7, 0.54);
  backdrop-filter: blur(3px);
  animation: guideFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.guide-spotlight {
  position: fixed;
  border-radius: var(--app-radius-md, 12px);
  box-shadow:
    0 0 0 9999px rgba(2, 4, 7, 0.56),
    0 0 0 3px color-mix(in srgb, var(--app-primary, #3b82f6) 60%, transparent),
    0 0 20px color-mix(in srgb, var(--app-primary, #3b82f6) 25%, transparent);
  z-index: 10001;
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.guide-popover {
  position: fixed;
  z-index: 10002;
  width: 340px;
  background: rgba(8, 13, 22, 0.96);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 0;
  border-radius: 0;
  padding: 22px 24px 18px;
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.42);
  animation: guideSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  &__title {
    font-size: 16px;
    font-family: var(--app-font-display);
    font-weight: 950;
    color: rgba(248, 250, 252, 0.94);
    margin-bottom: 10px;
    letter-spacing: -0.01em;
  }

  &__desc {
    font-size: 13.5px;
    color: rgba(203, 213, 225, 0.84);
    line-height: 1.7;
    margin-bottom: 18px;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
  }

  &__progress {
    font-size: 12px;
    color: rgba(148, 163, 184, 0.82);
    font-family: var(--app-font-mono);
    font-weight: 800;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }
}

@keyframes guideFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes guideSlideIn {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
