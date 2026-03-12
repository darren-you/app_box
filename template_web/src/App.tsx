import { useEffect, useState } from 'react';
import { listProviders } from './api/admin';
import { clearClientGateAccess, clearLegacyAuthState, hasClientGateAccess, redirectToGate } from './gate';
import UsersPage from './pages/UsersPage';
import ConfigsPage from './pages/ConfigsPage';
import styles from './App.module.css';

type AppKey = string;
type WorkspaceTabKey = 'users' | 'configs';

interface AppDefinition {
  key: AppKey;
  label: string;
  logo: string;
  userVariant: 'stellar' | 'tinytext';
  tabs: WorkspaceTabKey[];
}

const STELLAR_LOGO = '/assets/icons/stellar_240x240.png';
const TINYTEXT_LOGO = '/assets/icons/tinytext_1024x1024.png';

const appDefinitionMap: Record<string, AppDefinition> = {
  tinytext: {
    key: 'tinytext',
    label: 'TinyText',
    logo: TINYTEXT_LOGO,
    userVariant: 'tinytext',
    tabs: ['users']
  },
  stellar: {
    key: 'stellar',
    label: '星烁',
    logo: STELLAR_LOGO,
    userVariant: 'stellar',
    tabs: ['users', 'configs']
  }
};

function resolveAvailableApps(providerKeys: string[]): AppDefinition[] {
  return providerKeys
    .map((providerKey) => appDefinitionMap[providerKey])
    .filter((item): item is AppDefinition => Boolean(item));
}

function SideIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
      <path d="M16 17l4-5-4-5" />
      <path d="M20 12H9" />
    </svg>
  );
}

export default function App(): JSX.Element | null {
  const [hasCheckedAccess, setHasCheckedAccess] = useState(false);
  const [activeMenu, setActiveMenu] = useState<AppKey>('tinytext');
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('users');
  const [availableApps, setAvailableApps] = useState<AppDefinition[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeApp = availableApps.find((item) => item.key === activeMenu) || availableApps[0] || null;

  useEffect(() => {
    clearLegacyAuthState();
    if (!hasClientGateAccess()) {
      redirectToGate();
      return;
    }
    setHasCheckedAccess(true);
  }, []);

  useEffect(() => {
    if (!activeApp) {
      return;
    }
    if (!activeApp.tabs.includes(activeTab)) {
      setActiveTab(activeApp.tabs[0]);
    }
  }, [activeApp, activeTab]);

  useEffect(() => {
    if (!hasCheckedAccess) {
      return;
    }

    let cancelled = false;

    const fetchProviders = async (): Promise<void> => {
      setLoadingWorkspace(true);
      setWorkspaceError('');
      try {
        const providerKeys = await listProviders();
        if (cancelled) {
          return;
        }

        const nextApps = resolveAvailableApps(providerKeys);

        if (nextApps.length === 0) {
          throw new Error('当前环境未启用受支持的应用 provider');
        }

        setAvailableApps(nextApps);
        setActiveMenu((current) => {
          if (nextApps.some((item) => item.key === current)) {
            return current;
          }
          return nextApps[0].key;
        });
      } catch (e) {
        if (cancelled) {
          return;
        }
        setAvailableApps([]);
        const message = e instanceof Error ? e.message : '加载工作台失败';
        setWorkspaceError(message);
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    };

    void fetchProviders();

    return () => {
      cancelled = true;
    };
  }, [hasCheckedAccess]);

  const handleLogout = async (): Promise<void> => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch('/gate/api/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch {
      // 网关登出失败时走前端兜底清理，避免卡在已失效状态。
    }

    clearClientGateAccess();
    window.sessionStorage.clear();
    setAvailableApps([]);
    setWorkspaceError('');
    setActiveMenu('tinytext');
    setActiveTab('users');
    redirectToGate('/');
    setIsLoggingOut(false);
  };

  if (!hasCheckedAccess) {
    return null;
  }

  if (loadingWorkspace) {
    return (
      <main className={styles.loading}>
        <span className={styles.iosSpinner} aria-label="正在加载" />
      </main>
    );
  }

  if (workspaceError) {
    return (
      <main className={styles.errorPage}>
        <h2>工作台加载失败</h2>
        <p>{workspaceError}</p>
        <button onClick={() => window.location.reload()}>重试</button>
      </main>
    );
  }

  if (!activeApp) {
    return (
      <main className={styles.errorPage}>
        <h2>无可用应用</h2>
        <p>当前环境没有已启用且受前端支持的 provider。</p>
        <button
          onClick={() => {
            void handleLogout();
          }}
        >
          返回登录
        </button>
      </main>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <nav className={styles.menuList}>
            {availableApps.map((item) => (
              <button
                key={item.key}
                className={activeMenu === item.key ? styles.activeMenu : ''}
                onClick={() => {
                  setActiveMenu(item.key);
                  setActiveTab(item.tabs[0]);
                }}
              >
                <span className={styles.menuLabelWithIcon}>
                  <span className={styles.menuGlyph}>
                    <img className={styles.appLogo} src={item.logo} alt={`${item.label} Logo`} />
                  </span>
                  <span className={styles.menuLabel}>{item.label}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <button
            className={styles.logout}
            disabled={isLoggingOut}
            onClick={() => {
              void handleLogout();
            }}
          >
            <span className={styles.menuLabelWithIcon}>
              <span className={styles.menuGlyph}>
                <SideIcon />
              </span>
              <span className={styles.menuLabel}>退出登录</span>
            </span>
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <section className={styles.workspace}>
          {activeApp.tabs.length > 1 ? (
            <header className={styles.workspaceHeader}>
              <div className={styles.topTabs}>
                {activeApp.tabs.map((tab) => (
                  <button
                    key={tab}
                    className={activeTab === tab ? styles.activeTopTab : ''}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'users' ? '用户管理' : '配置管理'}
                  </button>
                ))}
              </div>
            </header>
          ) : null}

          {activeTab === 'users' ? (
            <UsersPage key={`${activeApp.key}-users`} appKey={activeApp.key} variant={activeApp.userVariant} />
          ) : (
            <ConfigsPage key={`${activeApp.key}-configs`} appKey={activeApp.key} />
          )}
        </section>
      </main>
    </div>
  );
}
