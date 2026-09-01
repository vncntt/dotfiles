import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const cb = callbacks.get(e.target);
            if (cb) {
              cb();
              callbacks.delete(e.target);
              observer!.unobserve(e.target);
            }
          }
        }
      },
      { rootMargin: "600px 0px" }
    );
  }
  return observer;
}

/** true once the element has come within 600px of the viewport (stays true). */
export function useVisible(el: Ref<Element | null>): Ref<boolean> {
  const visible = ref(false);
  onMounted(() => {
    if (!el.value) {
      visible.value = true;
      return;
    }
    callbacks.set(el.value, () => (visible.value = true));
    getObserver().observe(el.value);
  });
  onBeforeUnmount(() => {
    if (el.value) {
      callbacks.delete(el.value);
      observer?.unobserve(el.value);
    }
  });
  return visible;
}
