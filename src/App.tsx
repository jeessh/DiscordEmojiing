import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppStateProvider, useAppState } from './components/AppStateProvider';
import TokenPage from './pages/1_Token/TokenPage';
import ServersPage from './pages/2_Servers/ServersPage';
import EmojisPage from './pages/3_Emojis/EmojisPage';

const VALID_PATHS = new Set(['/token', '/servers', '/dashboard']);

const normalizePath = (path: string) => (VALID_PATHS.has(path) ? path : '/token');

function AppRoutes({ pathname }: { pathname: string }) {
  const { authSession, selectedServer, selectedServers, multiServerMode, goToServers, goToToken } = useAppState();

  useEffect(() => {
    if (!authSession && pathname !== '/token') {
      goToToken();
      return;
    }

    if (pathname === '/dashboard') {
      const missingSingleServer = !multiServerMode && !selectedServer;
      const missingMultiServer = multiServerMode && selectedServers.length === 0;

      if ((missingSingleServer || missingMultiServer) && authSession) {
        goToServers();
      }
    }
  }, [authSession, goToServers, goToToken, multiServerMode, pathname, selectedServer, selectedServers.length]);

  if (pathname === '/servers') {
    return authSession ? <ServersPage /> : <TokenPage />;
  }

  if (pathname === '/dashboard') {
    return authSession ? <EmojisPage /> : <TokenPage />;
  }

  return <TokenPage />;
}

function App() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const normalized = normalizePath(window.location.pathname);
    if (normalized !== window.location.pathname) {
      window.history.replaceState({}, '', normalized);
      setPathname(normalized);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const normalized = normalizePath(nextPath);

    if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized);
    }

    setPathname(normalized);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const key = useMemo(() => pathname, [pathname]);

  return (
    <AppStateProvider navigate={navigate}>
      <main className="app-shell" key={key}>
        <AppRoutes pathname={pathname} />
      </main>
    </AppStateProvider>
  );
}

export default App;