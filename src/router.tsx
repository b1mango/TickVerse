import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from '@/App';
import { EditorPage } from '@/pages/editor/EditorPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StatsPage } from '@/pages/stats/StatsPage';
import { TimelinePage } from '@/pages/timeline/TimelinePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <EditorPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
