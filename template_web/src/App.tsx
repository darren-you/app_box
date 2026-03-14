import { useEffect, useMemo, useState } from 'react';
import { listProviders } from './api/admin';
import { clearClientGateAccess, clearLegacyAuthState, hasClientGateAccess, redirectToGate } from './gate';
import { useViewportScale } from './hooks/useViewportScale';
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

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
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

function renderStatusCard(
  eyebrow: string,
  title: string,
  description: string,
  action?: {
    label: string;
    onClick: () => void;
  },
  showSpinner?: boolean,
): JSX.Element {
  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard}>
        <span className={styles.statusEyebrow}>{eyebrow}</span>
        {showSpinner ? <div className={styles.statusSpinner} aria-label="正在加载" /> : null}
        <h2>{title}</h2>
        <p className={styles.statusText}>{description}</p>
        {action ? (
          <button className={styles.primaryAction} type="button" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </section>
    </main>
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
  const { scaleLayerStyle, canvasAnchorStyle } = useViewportScale({
    designWidth: DESIGN_WIDTH,
    designHeight: DESIGN_HEIGHT,
  });

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
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAvailableApps([]);
        setWorkspaceError(error instanceof Error ? error.message : '加载工作台失败');
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
  const workspaceModeText = activeApp?.userVariant === 'tinytext' ? '只读视图' : '完整管理';

  if (!hasCheckedAccess) {
    return null;
  }

  if (loadingWorkspace) {
    return renderStatusCard(
      'APPBOX WORKSPACE',
      '正在同步工作台',
      '正在读取可用 provider 与访问状态，请稍候。',
      undefined,
      true,
    );
  }

  if (workspaceError) {
    return renderStatusCard(
      'APPBOX WORKSPACE',
      '工作台加载失败',
      workspaceError,
      {
        label: '重新加载',
        onClick: () => window.location.reload(),
      },
    );
  }

  if (!activeApp) {
    return renderStatusCard(
      'APPBOX WORKSPACE',
      '无可用应用',
      '当前环境没有已启用且受前端支持的 provider。',
      {
        label: '返回登录',
        onClick: () => {
          void handleLogout();
        },
      },
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.fixedHeader}>
        <div className={styles.brand}>
          <img className={styles.brandLogo} src={APPBOX_LOGO} alt="AppBox Logo" />
          <div className={styles.brandText}>
            <span className={styles.brandEyebrow}>AppBox Workspace</span>
            <p className={styles.brandTitle}>多应用后台统一入口</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.headerBadge}>Gate 已放行</span>
          <span className={`${styles.headerBadge} ${styles.headerBadgeAccent}`}>{workspaceBadgeText}</span>
          <button
            className={styles.headerButton}
            disabled={isLoggingOut}
            type="button"
            onClick={() => {
              void handleLogout();
            }}
          >
            {isLoggingOut ? '退出中...' : '退出登录'}
          </button>
        </div>
      </header>

      <div className={styles.viewport}>
        <div className={styles.scaleLayer} style={scaleLayerStyle}>
          <div className={styles.canvas} style={canvasAnchorStyle}>
            <div className={styles.headerSpacer} aria-hidden="true" />

            <section className={styles.toolbar} aria-label="工作台工具栏">
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.toolbarLabelButton}>
                  应用
                </button>
                <div className={styles.toolbarRail}>
                  {availableApps.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.toolbarChip} ${activeMenu === item.key ? styles.activeMenu : ''}`}
                      onClick={() => {
                        setActiveMenu(item.key);
                        setActiveTab(item.tabs[0]);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.toolbarSummary}>
                <div className={styles.toolbarGroup}>
                  <button type="button" className={styles.toolbarLabelButton}>
                    页面
                  </button>
                  <div className={styles.toolbarRail}>
                    {activeApp.tabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`${styles.toolbarChip} ${activeTab === tab ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {resolveTabLabel(tab)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.stage}>
              <aside className={styles.leftPanel}>
                <section className={styles.summaryCard}>
                  <div className={styles.summaryHead}>
                    <span className={styles.summaryLogoWrap}>
                      <img className={styles.summaryLogo} src={activeApp.logo} alt={`${activeApp.label} Logo`} />
                    </span>
                    <div className={styles.summaryTitleBlock}>
                      <span className={styles.panelEyebrow}>当前 Provider</span>
                      <h2 className={styles.summaryTitle}>{activeApp.label}</h2>
                    </div>
                  </div>

                  <p className={styles.summaryDescription}>{activeApp.description}</p>

                  <div className={styles.summaryMetaGrid}>
                    <article className={styles.summaryMetaItem}>
                      <span className={styles.summaryMetaLabel}>已启用 Provider</span>
                      <strong className={styles.summaryMetaValue}>{availableApps.length}</strong>
                    </article>
                    <article className={styles.summaryMetaItem}>
                      <span className={styles.summaryMetaLabel}>当前页面</span>
                      <strong className={styles.summaryMetaValue}>{activeApp.tabs.length}</strong>
                    </article>
                  </div>
                </section>

                <section className={styles.providerStack}>
                  {availableApps.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.providerCard} ${activeMenu === item.key ? styles.providerCardActive : ''}`}
                      onClick={() => {
                        setActiveMenu(item.key);
                        setActiveTab(item.tabs[0]);
                      }}
                    >
                      <div className={styles.providerCardHeader}>
                        <div className={styles.providerCardInfo}>
                          <img className={styles.providerCardLogo} src={item.logo} alt="" aria-hidden="true" />
                          <h3 className={styles.providerCardTitle}>{item.label}</h3>
                        </div>
                        <span className={styles.providerCardCount}>{String(item.tabs.length).padStart(2, '0')}</span>
                      </div>
                      <p className={styles.providerCardDescription}>{item.description}</p>
                    </button>
                  ))}
                </section>

                <section className={styles.workspaceNote}>
                  <span className={styles.panelEyebrow}>工作台说明</span>
                  <p className={styles.workspaceNoteText}>
                    当前布局遵循 TinyText 总结出的固定画布工作台语言，强调灰阶主色、黑色主动作和低饱和结构色块。
                  </p>
                  <ul className={styles.noteList}>
                    <li>顶部工具栏负责切换应用与页面。</li>
                    <li>左侧维持 provider 上下文与能力概览。</li>
                    <li>右侧集中承载当前页面的实际操作与数据。</li>
                  </ul>
                </section>
              </aside>

              <div className={styles.divider} aria-hidden="true" />

              <section className={styles.rightPanel}>
                <div className={styles.rightPanelHeader}>
                  <div>
                    <span className={styles.panelEyebrow}>当前页面</span>
                    <h1 className={styles.panelTitle}>
                      {activeApp.label} · {activeTabLabel}
                    </h1>
                    <p className={styles.panelDescription}>{activeTabDescription}</p>
                  </div>

                  <div className={styles.panelBadges}>
                    <span className={styles.headerBadge}>Provider {activeApp.key}</span>
                    <span className={`${styles.headerBadge} ${styles.headerBadgeAccent}`}>{workspaceModeText}</span>
                  </div>
                </div>

                <div className={styles.rightPanelScroll} data-appbox-page-scroll="true">
                  <div className={styles.pageSurface}>
                    {activeTab === 'users' ? (
                      <UsersPage key={`${activeApp.key}-users`} appKey={activeApp.key} variant={activeApp.userVariant} />
                    ) : (
                      <ConfigsPage key={`${activeApp.key}-configs`} appKey={activeApp.key} />
                    )}
                  </div>
                </div>
              </section>
            </section>
          </div>
        </div>
      </div>

      <footer className={styles.fixedFooter}>
        <p className={styles.footerText}>
          AppBox Workspace · 固定画布工作台布局 · {workspaceBadgeText}
        </p>
      </footer>
    </main>
  );
}
