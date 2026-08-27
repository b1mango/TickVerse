import { useEffect } from 'react';
import { BarChart3, PenLine, Ruler, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Toast } from '@/components/ui/Toast';
import { rolloverOnLaunch } from '@/services/rolloverService';
import { useTaskStore } from '@/stores/taskStore';

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
