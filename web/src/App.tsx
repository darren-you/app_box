import { useEffect, useState } from 'react';
import { getAdminMe, login } from './api/admin';
import { clearToken, getToken, setToken } from './api/client';
import type { AdminProfile } from './types/api';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import ConfigsPage from './pages/ConfigsPage';
import styles from './App.module.css';

type LeftMenuKey = 'stellar';
type StellarTabKey = 'users' | 'configs';
const STELLAR_LOGO = 'https://xdarren.com/res/images/stellar/stellar-logo-black.png';

const menuItems: Array<{ key: LeftMenuKey; label: string }> = [
  { key: 'stellar', label: '星烁' }
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
  const [activeMenu, setActiveMenu] = useState<LeftMenuKey>('stellar');
  const [stellarTab, setStellarTab] = useState<StellarTabKey>('users');
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const authenticated = Boolean(token);

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
    setActiveMenu('stellar');
    setStellarTab('users');
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
            {menuItems.map((item) => (
              <button
                key={item.key}
                className={activeMenu === item.key ? styles.activeMenu : ''}
                onClick={() => setActiveMenu(item.key)}
              >
                {item.key === 'stellar' ? (
                  <span className={styles.menuLabelWithIcon}>
                    <span className={styles.menuGlyph}>
                      <img className={styles.appLogo} src={STELLAR_LOGO} alt="星烁 Logo" />
                    </span>
                    <span className={styles.menuLabel}>{item.label}</span>
                  </span>
                ) : (
                  <span className={styles.menuLabelWithIcon}>
                    <span className={styles.menuGlyph}>
                      <SideIcon type={item.key} />
                    </span>
                    <span className={styles.menuLabel}>{item.label}</span>
                  </span>
                )}
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
        {activeMenu === 'stellar' ? (
          <section className={styles.workspace}>
            <header className={styles.workspaceHeader}>
              <div className={styles.topTabs}>
                <button
                  className={stellarTab === 'users' ? styles.activeTopTab : ''}
                  onClick={() => setStellarTab('users')}
                >
                  用户管理
                </button>
                <button
                  className={stellarTab === 'configs' ? styles.activeTopTab : ''}
                  onClick={() => setStellarTab('configs')}
                >
                  配置管理
                </button>
              </div>
            </header>
            {stellarTab === 'users' ? <UsersPage /> : <ConfigsPage />}
          </section>
        ) : (
          <section className={styles.workspace}>
            <div className={styles.placeholderPanel}>
              <p>该功能正在建设中。</p>
              <p>后续可在该区域集成常用运维工具与流程。</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
