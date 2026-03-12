import { useEffect, useMemo, useState } from 'react';
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
  description: string;
  userVariant: 'stellar' | 'tinytext';
  tabs: WorkspaceTabKey[];
}

const APPBOX_LOGO = '/assets/icons/appbox_1024x1024.png';
const STELLAR_LOGO = '/assets/icons/stellar_240x240.png';
const TINYTEXT_LOGO = '/assets/icons/tinytext_1024x1024.png';

const appDefinitionMap: Record<string, AppDefinition> = {
  tinytext: {
    key: 'tinytext',
    label: 'TinyText',
    logo: TINYTEXT_LOGO,
    description: '面向字体订阅与微信登录用户的只读管理视图。',
    userVariant: 'tinytext',
    tabs: ['users'],
  },
  stellar: {
    key: 'stellar',
    label: '星烁',
    logo: STELLAR_LOGO,
    description: '承载用户、星球内容与运行配置的完整管理工作台。',
    userVariant: 'stellar',
    tabs: ['users', 'configs'],
  },
};

function resolveAvailableApps(providerKeys: string[]): AppDefinition[] {
  return providerKeys
    .map((providerKey) => appDefinitionMap[providerKey])
    .filter((item): item is AppDefinition => Boolean(item));
}

function resolveTabLabel(tab: WorkspaceTabKey): string {
  return tab === 'users' ? '用户管理' : '配置管理';
}

function resolveTabDescription(tab: WorkspaceTabKey, appLabel: string): string {
  if (tab === 'users') {
    return `${appLabel} 的用户台账、状态与分页检索。`;
  }

  return `${appLabel} 的运行配置、值类型与更新时间。`;
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
        credentials: 'same-origin',
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

  const activeTabLabel = activeApp ? resolveTabLabel(activeTab) : '工作台';
  const activeTabDescription = activeApp ? resolveTabDescription(activeTab, activeApp.label) : '';
  const workspaceBadgeText = useMemo(() => {
    if (!activeApp) {
      return '等待 provider';
    }

    return activeApp.tabs.map((tab) => resolveTabLabel(tab)).join(' / ');
  }, [activeApp]);

  if (!hasCheckedAccess) {
    return null;
  }

  if (loadingWorkspace) {
    return (
      <main className={styles.statusPage}>
        <section className={styles.statusCard}>
          <span className={styles.shellEyebrow}>APPBOX WORKSPACE</span>
          <div className={styles.statusSpinner} aria-label="正在加载" />
          <h2>正在同步工作台</h2>
          <p>正在读取可用 provider 与访问状态，请稍候。</p>
        </section>
      </main>
    );
  }

  if (workspaceError) {
    return (
      <main className={styles.statusPage}>
        <section className={styles.statusCard}>
          <span className={styles.shellEyebrow}>APPBOX WORKSPACE</span>
          <h2>工作台加载失败</h2>
          <p>{workspaceError}</p>
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </section>
      </main>
    );
  }

  if (!activeApp) {
    return (
      <main className={styles.statusPage}>
        <section className={styles.statusCard}>
          <span className={styles.shellEyebrow}>APPBOX WORKSPACE</span>
          <h2>无可用应用</h2>
          <p>当前环境没有已启用且受前端支持的 provider。</p>
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            返回登录
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <section className={styles.brandCard}>
            <div className={styles.brandRow}>
              <img className={styles.brandLogo} src={APPBOX_LOGO} alt="AppBox Logo" />
              <div className={styles.brandText}>
                <span className={styles.brandEyebrow}>APPBOX</span>
                <strong className={styles.brandTitle}>Provider Workspace</strong>
              </div>
            </div>
            <p className={styles.brandDescription}>
              用统一的后台壳层接管多应用 provider，保持轻量、清晰、可切换。
            </p>
            <div className={styles.providerStats}>
              <article className={styles.providerStat}>
                <strong className={styles.providerStatValue}>{String(availableApps.length).padStart(2, '0')}</strong>
                <span className={styles.providerStatLabel}>已启用 Provider</span>
              </article>
              <article className={styles.providerStat}>
                <strong className={styles.providerStatValue}>{String(activeApp.tabs.length).padStart(2, '0')}</strong>
                <span className={styles.providerStatLabel}>当前可用页面</span>
              </article>
            </div>
          </section>

          <section className={styles.menuSection}>
            <span className={styles.menuSectionLabel}>应用列表</span>
            <nav className={styles.menuList}>
              {availableApps.map((item) => (
                <button
                  key={item.key}
                  className={`${styles.menuButton} ${activeMenu === item.key ? styles.activeMenu : ''}`}
                  type="button"
                  onClick={() => {
                    setActiveMenu(item.key);
                    setActiveTab(item.tabs[0]);
                  }}
                >
                  <div className={styles.menuButtonHeader}>
                    <div className={styles.menuLabelGroup}>
                      <span className={styles.menuGlyph}>
                        <img className={styles.appLogo} src={item.logo} alt={`${item.label} Logo`} />
                      </span>
                      <span className={styles.menuLabel}>{item.label}</span>
                    </div>
                    <span className={styles.menuMeta}>{String(item.tabs.length).padStart(2, '0')}</span>
                  </div>
                  <p className={styles.menuDescription}>{item.description}</p>
                </button>
              ))}
            </nav>
          </section>
        </div>

        <div className={styles.sidebarBottom}>
          <button
            className={styles.logoutButton}
            disabled={isLoggingOut}
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            <span className={styles.logoutIcon}>
              <SideIcon />
            </span>
            <span>{isLoggingOut ? '退出中...' : '退出登录'}</span>
          </button>
          <p className={styles.logoutHint}>访问已通过 Gate 校验，退出后会回到 `/gate/` 入口。</p>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.shellHeader}>
          <div className={styles.shellHeaderMeta}>
            <span className={styles.shellEyebrow}>APPBOX WORKSPACE</span>
            <div className={styles.shellTitleRow}>
              <h1 className={styles.shellTitle}>多应用后台统一入口</h1>
              <div className={styles.shellBadges}>
                <span className={styles.badge}>Gate 已放行</span>
                <span className={`${styles.badge} ${styles.badgeAccent}`}>{workspaceBadgeText}</span>
              </div>
            </div>
            <p className={styles.shellDescription}>
              参考 TinyText 的灰底纸面化风格重排布局，让 provider 切换、数据操作与状态感知保持在同一层级。
            </p>
          </div>
        </header>

        <section className={styles.heroPanel}>
          <div className={styles.heroIntro}>
            <span className={styles.heroEyebrow}>当前工作区</span>
            <div className={styles.heroHead}>
              <div className={styles.heroLogoWrap}>
                <img className={styles.heroLogo} src={activeApp.logo} alt={`${activeApp.label} Logo`} />
              </div>
              <div className={styles.heroTextGroup}>
                <h2 className={styles.heroTitle}>{activeApp.label}</h2>
                <p className={styles.heroSummary}>{activeApp.description}</p>
              </div>
            </div>

            <div className={styles.tabRail}>
              {activeApp.tabs.map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tabButton} ${activeTab === tab ? styles.activeTab : ''}`}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  {resolveTabLabel(tab)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.heroCard}>
              <span className={styles.heroCardLabel}>当前页面</span>
              <strong className={styles.heroCardValue}>{activeTabLabel}</strong>
              <p className={styles.heroCardText}>{activeTabDescription}</p>
            </article>
            <article className={styles.heroCard}>
              <span className={styles.heroCardLabel}>已启用 Provider</span>
              <strong className={styles.heroCardValue}>{availableApps.length}</strong>
              <p className={styles.heroCardText}>按后端 `/admin/providers` 动态返回结果渲染。</p>
            </article>
            <article className={styles.heroCard}>
              <span className={styles.heroCardLabel}>当前能力</span>
              <strong className={styles.heroCardValue}>{workspaceBadgeText}</strong>
              <p className={styles.heroCardText}>界面只展示当前 provider 允许的页面集合。</p>
            </article>
          </div>
        </section>

        <section className={styles.pageSurface}>
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
