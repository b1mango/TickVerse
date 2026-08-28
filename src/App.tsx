import { useEffect } from 'react';
import { BarChart3, PenLine, Ruler, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Toast } from '@/components/ui/Toast';
import { rolloverOnLaunch } from '@/services/rolloverService';
import { initSync } from '@/services/syncService';
import { useTaskStore } from '@/stores/taskStore';
import { useUiStore } from '@/stores/uiStore';

const NAV = [
  { to: '/', label: '编辑', icon: PenLine },
  { to: '/timeline', label: '时间轴', icon: Ruler },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
] as const;

/** 应用壳：启动滚存检测 + 四页路由出口 + 底部导航（Lucide 图标 + mono 小字，当前项朱砂） */
function App() {
  const setRolledOverIds = useTaskStore((s) => s.setRolledOverIds);

  useEffect(() => {
    void rolloverOnLaunch().then(setRolledOverIds);
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
  }, [setRolledOverIds]);

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
