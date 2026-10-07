import { PointerSensor } from '@dnd-kit/core';
import type { PointerSensorOptions } from '@dnd-kit/core';

/**
 * 编辑安全指针传感器（2026-10-06 修订七）：按下点落在编辑输入
 * （textarea / input / contenteditable）上时不激活拖拽——编辑态鼠标拖选文字不再拖动卡片；
 * 其余位置与原生 PointerSensor 一致（isPrimary + 主键）。
 * 记录页四象限与桌面组件共用。
 */
export class EditingSafePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent }: React.PointerEvent,
        { onActivation }: PointerSensorOptions,
      ): boolean => {
        const target = nativeEvent.target as HTMLElement | null;
        if (target?.closest('button, a, textarea, input, [contenteditable="true"]')) return false;
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        onActivation?.({ event: nativeEvent });
        return true;
      },
    },
  ];
}
