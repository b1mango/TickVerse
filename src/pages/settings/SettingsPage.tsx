import { useSettingsStore } from '@/stores/settingsStore';
import type { ThemeMode, ThemeStyle } from '@/types/settings';

const STYLES: { value: ThemeStyle; label: string }[] = [
  { value: 'archive', label: '档案室' },
  { value: 'mono', label: '极简' },
];

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '明' },
  { value: 'dark', label: '暗' },
  { value: 'system', label: '跟随系统' },
];

/**
 * 设置页最小版（M1）：主题切换（风格 × 明暗），localStorage 持久化、仅本地不同步。
 * 分组列表式 + hairline 分隔（方向稿 §10）；4 张实时预览卡于后续里程碑补齐。
 */
export function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const setStyle = useSettingsStore((s) => s.setStyle);
  const setMode = useSettingsStore((s) => s.setMode);

  return (
    <div className="mx-auto max-w-2xl px-6 pb-32 pt-16">
      <h1 className="font-display text-display-2">设置</h1>

      <section className="mt-10">
        <h2 className="font-mono text-caption text-sub">主题</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">风格</span>
            <div className="flex gap-2">
              {STYLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStyle(value)}
                  className={`rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
                    theme.style === value
                      ? 'border-accent text-accent'
                      : 'border-line text-sub hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">明暗</span>
            <div className="flex gap-2">
              {MODES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
                    theme.mode === value
                      ? 'border-accent text-accent'
                      : 'border-line text-sub hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-caption text-sub">
          宣纸 / 墨室 / 白页 / 黑场 · 偏好仅存本地，不同步
        </p>
      </section>
    </div>
  );
}
