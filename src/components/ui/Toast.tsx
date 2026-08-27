import { useEffect, useRef } from 'react';
import { useUiStore } from '@/stores/uiStore';

/** 底部居中胶囊 toast：mono 小字；有动作 5s，无动作 3s 自动消（方向稿 §11 / §15-6） */
export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismissToast, toast.actionLabel ? 5000 : 3000);
    return () => clearTimeout(timerRef.current);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const handleAction = () => {
    toast.onAction?.();
    dismissToast();
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="flex items-center gap-3 rounded-full bg-ink px-5 py-2 font-mono text-caption text-bg shadow-[var(--shadow-float)]">
        <span>{toast.message}</span>
        {toast.actionLabel && (
          <button
            className="text-accent underline underline-offset-2 transition-opacity hover:opacity-70"
            onClick={handleAction}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
