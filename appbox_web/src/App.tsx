import { useEffect, useState } from 'react';
import { getAdminMe, login } from './api/admin';
import { clearToken, getToken, setToken } from './api/client';
import type { AdminProfile } from './types/api';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import ConfigsPage from './pages/ConfigsPage';
import styles from './App.module.css';

type AppKey = 'stellar' | 'tinytext';
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

const appDefinitions: AppDefinition[] = [
  {
    key: 'tinytext',
    label: 'TinyText',
    logo: TINYTEXT_LOGO,
    userVariant: 'tinytext',
    tabs: ['users']
  },
  {
    key: 'stellar',
    label: '星烁',
    logo: STELLAR_LOGO,
    userVariant: 'stellar',
    tabs: ['users', 'configs']
  }
];

function SideIcon({ type }: { type: 'logout' }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" />
      <path d="M16 17l4-5-4-5" />
      <path d="M20 12H9" />
    </svg>
  );
}

export default function App(): JSX.Element {
  const [token, setTokenState] = useState(getToken());
  const [activeMenu, setActiveMenu] = useState<AppKey>('tinytext');
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('users');
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const authenticated = Boolean(token);
  const activeApp = appDefinitions.find((item) => item.key === activeMenu) || appDefinitions[0];

  useEffect(() => {
    if (!activeApp.tabs.includes(activeTab)) {
      setActiveTab(activeApp.tabs[0]);
    }
  }, [activeApp, activeTab]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const fetchProfile = async (): Promise<void> => {
      setLoadingProfile(true);
      setProfileError('');
      try {
        const profile = await getAdminMe();
        setCurrentAdmin(profile);
      } catch (e) {
        const message = e instanceof Error ? e.message : '获取管理员信息失败';
        setProfileError(message);
      } finally {
        setLoadingProfile(false);
      }
    };

    void fetchProfile();
  }, [authenticated]);

  const handleLogin = async (password: string): Promise<void> => {
    const response = await login({ password });
    const accessToken = response.accessToken || response.token;
    if (!accessToken) {
      throw new Error('后端未返回 access token');
    }
    setToken(accessToken);
    setTokenState(accessToken);
  };

  const handleLogout = (): void => {
    clearToken();
    setTokenState('');
    setCurrentAdmin(null);
    setProfileError('');
    setActiveMenu('tinytext');
    setActiveTab('users');
  };

  if (!authenticated) {
    return <LoginPage onSubmit={handleLogin} />;
  }

  if (loadingProfile) {
    return (
      <main className={styles.loading}>
        <span className={styles.iosSpinner} aria-label="正在加载" />
      </main>
    );
  }

  if (profileError) {
    return (
      <main className={styles.errorPage}>
        <h2>认证失败</h2>
        <p>{profileError}</p>
        <button onClick={handleLogout}>返回登录</button>
      </main>
    );
  }

  if (currentAdmin && currentAdmin.role !== 'admin') {
    return (
      <main className={styles.errorPage}>
        <h2>权限不足</h2>
        <p>当前账号角色为 {currentAdmin.role}，需要 admin 才能访问后台。</p>
        <button onClick={handleLogout}>退出</button>
      </main>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <nav className={styles.menuList}>
            {appDefinitions.map((item) => (
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
          <button className={styles.logout} onClick={handleLogout}>
            <span className={styles.menuLabelWithIcon}>
              <span className={styles.menuGlyph}>
                <SideIcon type="logout" />
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
