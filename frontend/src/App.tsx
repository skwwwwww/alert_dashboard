import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './Layout';

import { ComponentDetail } from './pages/ComponentDetail';
import { GlobalOverview } from './pages/GlobalOverview';
import { CategoryDetail } from './pages/CategoryDetail';

const queryClient = new QueryClient();

function App() {
  // Simple routing for prototype to demonstrate the Sidebar works
  // In real app, use react-router-dom
  const path = window.location.pathname;

  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        {path === '/' && (
          <GlobalOverview />
        )}
        {path === '/oncall' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Oncall Dashboard</h1>
                <p className="text-gray-500 mt-1 text-sm">Real-time oncall status and schedule</p>
              </div>
            </div>
            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl bg-white/50">
              Oncall Dashboard interface is under construction.
            </div>
          </div>
        )}
        {path.startsWith('/category/') && (
          <CategoryDetail categoryName={decodeURIComponent(path.split('/')[2])} />
        )}
        {path.startsWith('/components/') && (
          <ComponentDetail componentName={path.split('/')[2]} />
        )}
      </Layout>
    </QueryClientProvider>
  );
}

export default App;
