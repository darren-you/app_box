import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deleteUser, listUserPlanets, listUsers, updateUser } from '../api/admin';
import type { AdminUserUpdateRequest, PlanetItem, User } from '../types/api';
import styles from './UsersPage.module.css';

type UserPageVariant = 'stellar' | 'tinytext';

interface UsersPageProps {
  appKey: string;
  variant: UserPageVariant;
}

interface EditorState {
  userId: number;
  username: string;
  avatar: string;
  status: User['status'];
  isSubscriber: boolean;
  subscriptionExpiresAt: string;
}

const PAGE_SIZE = 20;
const PLANET_PAGE_SIZE = 10;

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rawHour = date.getHours();
  const hour = rawHour % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const period = rawHour >= 12 ? 'PM' : 'AM';
  return `${year}/${month}/${day} ${hour}:${minute}:${second} ${period}`;
}

function toDateTimeLocalInput(dateString: string | null): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function toRFC3339(dateTimeLocal: string): string {
  if (!dateTimeLocal.trim()) {
    return '';
  }
  const date = new Date(dateTimeLocal);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

function resolveStatusLabel(status: User['status']): string {
  return status === 'active' ? 'active' : 'disabled';
}

export default function UsersPage({ appKey, variant }: UsersPageProps): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [subscriberTotal, setSubscriberTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [planetViewerUser, setPlanetViewerUser] = useState<User | null>(null);
  const [planetItems, setPlanetItems] = useState<PlanetItem[]>([]);
  const [planetPage, setPlanetPage] = useState(1);
  const [planetTotalPages, setPlanetTotalPages] = useState(1);
  const [planetTotal, setPlanetTotal] = useState(0);
  const [planetLoading, setPlanetLoading] = useState(false);
  const [planetError, setPlanetError] = useState('');

  const isTinyText = variant === 'tinytext';
  const supportsPlanets = !isTinyText;
  const supportsEditing = !isTinyText;
  const supportsDelete = !isTinyText;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const hasPlanetPrev = planetPage > 1;
  const hasPlanetNext = planetPage < planetTotalPages;
  const columnCount = isTinyText ? 6 : 8;
  const searchPlaceholder = isTinyText ? '检索昵称 / ID / 微信 OpenID' : '检索昵称 / ID / 手机号';

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await listUsers(page, PAGE_SIZE, keyword, appKey);
      setUsers(response.data);
      setTotalPages(response.totalPages || 1);
      setTotal(response.total);
      setSubscriberTotal(response.subscriberTotal || 0);
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载用户失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [appKey, page, keyword]);

  const runSearch = (nextKeyword: string): void => {
    const trimmed = nextKeyword.trim();
    if (page !== 1) {
      setPage(1);
    }
    if (trimmed !== keyword) {
      setKeyword(trimmed);
      return;
    }
    if (page === 1) {
      void loadUsers();
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    runSearch(searchInput);
  };

  const handleResetSearch = (): void => {
    setSearchInput('');
    runSearch('');
  };

  const loadUserPlanetItems = async (userId: number, targetPage: number): Promise<void> => {
    setPlanetLoading(true);
    setPlanetError('');
    try {
      const response = await listUserPlanets(userId, targetPage, PLANET_PAGE_SIZE, appKey);
      setPlanetItems(response.data || []);
      setPlanetPage(response.page || targetPage);
      setPlanetTotalPages(response.totalPages || 1);
      setPlanetTotal(response.total || 0);
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载星球数据失败';
      setPlanetError(message);
    } finally {
      setPlanetLoading(false);
    }
  };

  const openPlanetViewer = async (user: User): Promise<void> => {
    if (!supportsPlanets) {
      return;
    }
    setPlanetViewerUser(user);
    setPlanetItems([]);
    setPlanetPage(1);
    setPlanetTotalPages(1);
    setPlanetTotal(0);
    await loadUserPlanetItems(user.id, 1);
  };

  const closePlanetViewer = (): void => {
    setPlanetViewerUser(null);
    setPlanetItems([]);
    setPlanetError('');
  };

  const startEdit = (user: User): void => {
    if (!supportsEditing) {
      return;
    }
    setEditor({
      userId: user.id,
      username: user.username,
      avatar: user.avatar || '',
      status: user.status,
      isSubscriber: user.isSubscriber,
      subscriptionExpiresAt: toDateTimeLocalInput(user.subscriptionExpiresAt),
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!editor || !supportsEditing) {
      return;
    }

    const payload: AdminUserUpdateRequest = {
      username: editor.username.trim(),
      avatar: editor.avatar.trim(),
      status: editor.status,
      isSubscriber: editor.isSubscriber,
      subscriptionExpiresAt: toRFC3339(editor.subscriptionExpiresAt),
    };

    setSaving(true);
    setError('');
    try {
      await updateUser(editor.userId, payload, appKey);
      setEditor(null);
      await loadUsers();
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存失败';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User): Promise<void> => {
    if (!supportsDelete) {
      return;
    }
    const confirmed = window.confirm(`确认删除用户 ${user.username} (ID: ${user.id}) 吗？`);
    if (!confirmed) {
      return;
    }

    setError('');
    try {
      await deleteUser(user.id, appKey);
      if (users.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadUsers();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除失败';
      setError(message);
    }
  };

  const footerText = useMemo(() => {
    if (total === 0) {
      return '暂无用户';
    }
    return `共 ${total} 条，当前第 ${page}/${totalPages} 页`;
  }, [total, page, totalPages]);

  const planetFooterText = useMemo(() => {
    if (planetTotal === 0) {
      return '暂无星球数据';
    }
    return `共 ${planetTotal} 条，当前第 ${planetPage}/${planetTotalPages} 页`;
  }, [planetTotal, planetPage, planetTotalPages]);

  const visibleSubscriberCount = useMemo(
    () => users.filter((item) => item.isSubscriber).length,
    [users],
  );
  const activeUserCount = useMemo(
    () => users.filter((item) => item.status === 'active').length,
    [users],
  );
  const recentLoginCount = useMemo(
    () => users.filter((item) => Boolean(item.lastLoginAt)).length,
    [users],
  );

  return (
    <section className={styles.section}>
      <div className={styles.overviewGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>用户总数</span>
          <strong className={styles.metricValue}>{total}</strong>
          <p className={styles.metricFootnote}>当前 provider 下累计用户体量。</p>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>{isTinyText ? '当前页微信用户' : '订阅用户'}</span>
          <strong className={styles.metricValue}>{isTinyText ? users.length : subscriberTotal}</strong>
          <p className={styles.metricFootnote}>
            {isTinyText ? '当前页成功读取到的微信登录用户记录。' : '已订阅能力的星烁用户总数。'}
          </p>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>{isTinyText ? '最近登录' : '活跃用户'}</span>
          <strong className={styles.metricValue}>{isTinyText ? recentLoginCount : activeUserCount}</strong>
          <p className={styles.metricFootnote}>
            {isTinyText ? '当前页包含登录时间的记录数。' : '当前页状态为 active 的记录数。'}
          </p>
        </article>

        <form className={styles.searchPanel} onSubmit={handleSearchSubmit}>
          <div className={styles.searchPanelHeader}>
            <span className={styles.metricLabel}>即时检索</span>
            <h3 className={styles.searchPanelTitle}>{isTinyText ? 'TinyText 用户台账' : '星烁用户台账'}</h3>
          </div>
          <input
            className={styles.textInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
          />
          <div className={styles.searchActions}>
            <button className={styles.primaryButton} type="submit">
              搜索
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleResetSearch}>
              重置
            </button>
          </div>
          <p className={styles.metricFootnote}>
            当前页订阅用户 {visibleSubscriberCount} 人，支持按 ID、昵称和关键身份信息定位。
          </p>
        </form>
      </div>

      {error && <p className={styles.messageBar}>{error}</p>}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.metricLabel}>{isTinyText ? '微信登录用户' : '用户与订阅状态'}</span>
            <h3 className={styles.panelTitle}>用户列表</h3>
          </div>
          <span className={styles.panelMeta}>{footerText}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户</th>
                {isTinyText ? (
                  <>
                    <th>微信 OpenID</th>
                    <th>微信 UnionID</th>
                    <th>最后登录</th>
                    <th>创建时间</th>
                  </>
                ) : (
                  <>
                    <th>手机号</th>
                    <th>状态</th>
                    <th>订阅</th>
                    <th>订阅到期</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className={styles.empty}>
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className={styles.empty}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const displayName = user.username.trim() || `用户 #${user.id}`;

                  return (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        <div className={styles.userCell}>
                          {user.avatar ? (
                            <img className={styles.avatar} src={user.avatar} alt={`${displayName} avatar`} />
                          ) : (
                            <span className={styles.avatarFallback}>{displayName.charAt(0).toUpperCase() || '?'}</span>
                          )}
                          <div className={styles.userMeta}>
                            <strong>{displayName}</strong>
                            <span>{isTinyText ? '微信登录用户' : `角色 ${user.role}`}</span>
                          </div>
                        </div>
                      </td>
                      {isTinyText ? (
                        <>
                          <td>
                            <span className={styles.codeValue}>{user.wechatOpenIdMasked || '-'}</span>
                          </td>
                          <td>
                            <span className={styles.codeValue}>{user.wechatUnionIdMasked || '-'}</span>
                          </td>
                          <td>{formatDate(user.lastLoginAt)}</td>
                          <td>{formatDate(user.createdAt)}</td>
                        </>
                      ) : (
                        <>
                          <td>{user.phone || '-'}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                user.status === 'active' ? styles.statusActive : styles.statusDisabled
                              }`}
                            >
                              {resolveStatusLabel(user.status)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                user.isSubscriber ? styles.statusAccent : styles.statusMuted
                              }`}
                            >
                              {user.isSubscriber ? '已订阅' : '未订阅'}
                            </span>
                          </td>
                          <td>{formatDate(user.subscriptionExpiresAt)}</td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                className={styles.inlineButton}
                                type="button"
                                onClick={() => void openPlanetViewer(user)}
                              >
                                星球
                              </button>
                              <button className={styles.inlineButton} type="button" onClick={() => startEdit(user)}>
                                编辑
                              </button>
                              <button
                                className={`${styles.inlineButton} ${styles.dangerButton}`}
                                type="button"
                                onClick={() => void handleDelete(user)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className={styles.footer}>
        <span className={styles.footerText}>{footerText}</span>
        <div className={styles.pager}>
          <button className={styles.secondaryButton} disabled={!hasPrev} type="button" onClick={() => setPage((prev) => prev - 1)}>
            上一页
          </button>
          <button className={styles.primaryButton} disabled={!hasNext} type="button" onClick={() => setPage((prev) => prev + 1)}>
            下一页
          </button>
        </div>
      </footer>

      {supportsPlanets && planetViewerUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.planetModal}>
            <button className={styles.modalClose} type="button" aria-label="关闭弹窗" onClick={closePlanetViewer}>
              <span className={styles.modalCloseLine} />
              <span className={styles.modalCloseLine} />
            </button>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.metricLabel}>Planet Records</span>
                <h3 className={styles.panelTitle}>{planetViewerUser.username || `用户 #${planetViewerUser.id}`} 的星球数据</h3>
              </div>
              <span className={styles.panelMeta}>{planetFooterText}</span>
            </div>
            {planetError && <p className={styles.messageBar}>{planetError}</p>}

            <div className={styles.planetTableWrap}>
              <table className={styles.planetTable}>
                <thead>
                  <tr>
                    <th>编号</th>
                    <th>名称</th>
                    <th>日期</th>
                    <th>关键词</th>
                    <th>创建时间</th>
                    <th>图片</th>
                  </tr>
                </thead>
                <tbody>
                  {planetLoading ? (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        加载中...
                      </td>
                    </tr>
                  ) : planetItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.empty}>
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    planetItems.map((planet) => (
                      <tr key={planet.id}>
                        <td>{planet.planetNo || '-'}</td>
                        <td>{planet.name}</td>
                        <td>{planet.dateKey || '-'}</td>
                        <td>{planet.keywords?.join('、') || '-'}</td>
                        <td>{formatDate(planet.createdAt)}</td>
                        <td>
                          {planet.imageUrl ? (
                            <a className={styles.imageLink} href={planet.imageUrl} target="_blank" rel="noreferrer">
                              查看
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.pager}>
                <button
                  className={styles.secondaryButton}
                  disabled={!hasPlanetPrev || planetLoading}
                  type="button"
                  onClick={() => void loadUserPlanetItems(planetViewerUser.id, planetPage - 1)}
                >
                  上一页
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={!hasPlanetNext || planetLoading}
                  type="button"
                  onClick={() => void loadUserPlanetItems(planetViewerUser.id, planetPage + 1)}
                >
                  下一页
                </button>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={closePlanetViewer}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {supportsEditing && editor && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <button className={styles.modalClose} type="button" aria-label="关闭弹窗" onClick={() => setEditor(null)}>
              <span className={styles.modalCloseLine} />
              <span className={styles.modalCloseLine} />
            </button>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.metricLabel}>User Editor</span>
                <h3 className={styles.panelTitle}>编辑用户 #{editor.userId}</h3>
              </div>
            </div>
            <div className={styles.formGrid}>
              <label>
                用户名
                <input
                  className={styles.textInput}
                  value={editor.username}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, username: e.target.value } : null))}
                />
              </label>

              <label>
                头像 URL
                <input
                  className={styles.textInput}
                  value={editor.avatar}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, avatar: e.target.value } : null))}
                />
              </label>

              <label>
                状态
                <select
                  className={styles.textInput}
                  value={editor.status}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, status: e.target.value as EditorState['status'] } : null,
                    )
                  }
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>

              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={editor.isSubscriber}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev
                        ? {
                            ...prev,
                            isSubscriber: e.target.checked,
                            subscriptionExpiresAt: e.target.checked ? prev.subscriptionExpiresAt : '',
                          }
                        : null,
                    )
                  }
                />
                <span>是否订阅</span>
              </label>

              <label>
                订阅到期时间
                <input
                  className={styles.textInput}
                  type="datetime-local"
                  value={editor.subscriptionExpiresAt}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, subscriptionExpiresAt: e.target.value } : null))
                  }
                  disabled={!editor.isSubscriber}
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditor(null)}>
                取消
              </button>
              <button className={styles.primaryButton} disabled={saving} type="button" onClick={() => void handleSave()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
