import { useEffect } from 'react';
import { BarChart3, PenLine, Ruler, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { isTauri, setWidgetOpacity, setWidgetSize, setWidgetVisible } from '@/adapters/desktopWidget';
import { Toast } from '@/components/ui/Toast';
import { initSync } from '@/services/syncService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';

const NAV = [
  { to: '/', label: '待办', icon: PenLine },
  { to: '/timeline', label: '时间轴', icon: Ruler },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
] as const;

/** 应用壳：启动种子检测 + 四页路由出口 + 底部导航（Lucide 图标 + mono 小字，当前项朱砂） */
function App() {
  useEffect(() => {
    // WebDAV 快照同步（清单 M5-4）：启用时打开拉取一次，本地变更防抖推送
    initSync();
    // 浏览器数据防清理（清单 M5-3）：申请持久存储，被拒则提示定期导出备份
    void navigator.storage
      ?.persisted()
      .then((persisted) => persisted || navigator.storage.persist())
      .then((granted) => {
        if (!granted) {
          useUiStore.getState().showToast({
            message: '浏览器未授予持久存储，数据可能被清理，建议定期导出 JSON 备份',
          });
        }
      })
      .catch(() => {});
  }, []);

  // 桌面组件（M7）：恢复上次的显隐 / 拖拽尺寸 / 透明度。
  // 尺寸恢复带自愈钳位（2026-10-07 修订十三）：异常时代（拖拽失效期）曾被放大到近全屏，
  // 超高/超宽会把"垂直移动自由度"与"避让空间"都锁死——越界一律回默认 640×480
  useEffect(() => {
    if (!isTauri) return;
    const { widget, setWidget } = useSettingsStore.getState();
    void setWidgetVisible(widget.visible);
    let { width, height } = widget;
    const tooWide = (width ?? 0) > 900;
    const tooTall = (height ?? 0) > Math.round(window.screen.height * 0.72);
    if (tooWide || tooTall) {
      width = 640;
      height = 480;
      setWidget({ width, height });
    }
    if (width && height) void setWidgetSize(width, height);
    void setWidgetOpacity(widget.opacity);
  }, []);

  return (
    <div className="min-h-screen">
      <Outlet />

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-bg">
        <div className="mx-auto flex max-w-2xl items-center justify-around py-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-1 font-mono text-caption transition-colors ${
                  isActive ? 'text-accent' : 'text-sub hover:text-ink'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Toast />
    </div>
  );
}

export default App;
