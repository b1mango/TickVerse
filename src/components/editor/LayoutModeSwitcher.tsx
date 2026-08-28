import { Columns3, LayoutDashboard, LayoutPanelLeft, Rows3 } from 'lucide-react';
import type { EditorLayoutMode } from '@/types/settings';

const MODES = [
  { mode: 'vertical', label: '竖向', icon: Rows3 },
  { mode: 'horizontal', label: '横向', icon: Columns3 },
  { mode: 'split', label: '左今右分', icon: LayoutPanelLeft },
  { mode: 'custom', label: '自定义', icon: LayoutDashboard },
] as const;

interface LayoutModeSwitcherProps {
  mode: EditorLayoutMode;
  onChange: (mode: EditorLayoutMode) => void;
}

/** 记录页布局分段控件：选中态 accent 描边（沿用设置页主题切换的样式约定） */
export function LayoutModeSwitcher({ mode, onChange }: LayoutModeSwitcherProps) {
  return (
    <div className="inline-flex gap-1 rounded-ctl border border-line bg-surface p-1">
      {MODES.map(({ mode: value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
            mode === value
              ? 'border-accent text-accent'
              : 'border-transparent text-sub hover:text-ink'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
