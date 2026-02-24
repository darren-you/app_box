import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deleteUser, listUserPlanets, listUsers, updateUser } from '../api/admin';
import type { AdminUserUpdateRequest, PlanetItem, User } from '../types/api';
import styles from './UsersPage.module.css';

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

function formatDate(dateString: string | null): string {
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

export default function UsersPage(): JSX.Element {
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

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const hasPlanetPrev = planetPage > 1;
  const hasPlanetNext = planetPage < planetTotalPages;

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await listUsers(page, PAGE_SIZE, keyword);
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
  }, [page, keyword]);

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
      const response = await listUserPlanets(userId, targetPage, PLANET_PAGE_SIZE);
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
    setEditor({
      userId: user.id,
      username: user.username,
      avatar: user.avatar || '',
      status: user.status,
      isSubscriber: user.isSubscriber,
      subscriptionExpiresAt: toDateTimeLocalInput(user.subscriptionExpiresAt)
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!editor) {
      return;
    }

    const payload: AdminUserUpdateRequest = {
      username: editor.username.trim(),
      avatar: editor.avatar.trim(),
      status: editor.status,
      isSubscriber: editor.isSubscriber,
      subscriptionExpiresAt: toRFC3339(editor.subscriptionExpiresAt)
    };

    setSaving(true);
    setError('');
    try {
      await updateUser(editor.userId, payload);
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
    const confirmed = window.confirm(`确认删除用户 ${user.username} (ID: ${user.id}) 吗？`);
    if (!confirmed) {
      return;
    }

    setError('');
    try {
      await deleteUser(user.id);
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

  return (
    <section className={styles.section}>
      <div className={styles.topArea}>
        <div className={styles.summaryRow}>
          <p className={styles.totalInfo}>
            <span>用户总数：{total}</span>
            <span>订阅用户：{subscriberTotal}</span>
          </p>
          <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="检索昵称 / ID / 手机号"
            />
            <button type="submit">搜索</button>
            <button type="button" onClick={handleResetSearch}>
              重置
            </button>
          </form>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>手机号</th>
              <th>状态</th>
              <th>订阅</th>
              <th>订阅到期</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  暂无数据
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>
                    <div className={styles.userCell}>
                      {user.avatar ? (
                        <img className={styles.avatar} src={user.avatar} alt={`${user.username} avatar`} />
                      ) : (
                        <span className={styles.avatarFallback}>
                          {user.username.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                      <span>{user.username}</span>
                    </div>
                  </td>
                  <td>{user.phone || '-'}</td>
                  <td>{user.status}</td>
                  <td>{user.isSubscriber ? '是' : '否'}</td>
                  <td>{formatDate(user.subscriptionExpiresAt)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button onClick={() => void openPlanetViewer(user)}>星球</button>
                      <button onClick={() => startEdit(user)}>编辑</button>
                      <button className={styles.deleteButton} onClick={() => void handleDelete(user)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className={styles.footer}>
        <span>{footerText}</span>
        <div className={styles.pager}>
          <button disabled={!hasPrev} onClick={() => setPage((prev) => prev - 1)}>
            上一页
          </button>
          <button disabled={!hasNext} onClick={() => setPage((prev) => prev + 1)}>
            下一页
          </button>
        </div>
      </footer>

      {planetViewerUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.planetModal}>
            <h3>{planetViewerUser.username} 的星球数据</h3>
            {planetError && <p className={styles.error}>{planetError}</p>}

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
                            <a
                              className={styles.imageLink}
                              href={planet.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
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
              <span>{planetFooterText}</span>
              <div className={styles.pager}>
                <button
                  disabled={!hasPlanetPrev || planetLoading}
                  onClick={() => void loadUserPlanetItems(planetViewerUser.id, planetPage - 1)}
                >
                  上一页
                </button>
                <button
                  disabled={!hasPlanetNext || planetLoading}
                  onClick={() => void loadUserPlanetItems(planetViewerUser.id, planetPage + 1)}
                >
                  下一页
                </button>
              </div>
              <button className={styles.closeButton} onClick={closePlanetViewer}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3>编辑用户 #{editor.userId}</h3>
            <div className={styles.formGrid}>
              <label>
                用户名
                <input
                  value={editor.username}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, username: e.target.value } : null))}
                />
              </label>

              <label>
                头像 URL
                <input
                  value={editor.avatar}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, avatar: e.target.value } : null))}
                />
              </label>

              <label>
                状态
                <select
                  value={editor.status}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev ? { ...prev, status: e.target.value as EditorState['status'] } : null
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
                            subscriptionExpiresAt: e.target.checked ? prev.subscriptionExpiresAt : ''
                          }
                        : null
                    )
                  }
                />
                是否订阅
              </label>

              <label>
                订阅到期时间
                <input
                  type="datetime-local"
                  value={editor.subscriptionExpiresAt}
                  onChange={(e) =>
                    setEditor((prev) => (prev ? { ...prev, subscriptionExpiresAt: e.target.value } : null))
                  }
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => setEditor(null)}>取消</button>
              <button disabled={saving} onClick={() => void handleSave()}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
