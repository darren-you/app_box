import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deleteConfig, listConfigs, upsertConfig } from '../api/admin';
import type { AppConfig, AppConfigUpsertRequest } from '../types/api';
import styles from './ConfigsPage.module.css';

interface ConfigsPageProps {
  appKey: string;
}

interface ConfigFormState {
  key: string;
  alias: string;
  configValue: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  description: string;
}

function formatDate(dateString: string): string {
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

const defaultForm: ConfigFormState = {
  key: '',
  alias: '',
  configValue: '',
  valueType: 'string',
  description: '',
};

export default function ConfigsPage({ appKey }: ConfigsPageProps): JSX.Element {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ConfigFormState>(defaultForm);

  const helperText = useMemo(() => {
    switch (form.valueType) {
      case 'boolean':
        return 'boolean 类型示例: true / false';
      case 'number':
        return 'number 类型示例: 3 或 3.14';
      case 'json':
        return 'json 类型示例: {"a":1} 或 [1,2,3]';
      default:
        return 'string 类型将按原样字符串保存';
    }
  }, [form.valueType]);

  const typeSummary = useMemo(() => {
    return configs.reduce(
      (summary, item) => {
        summary[item.valueType] += 1;
        return summary;
      },
      {
        string: 0,
        number: 0,
        boolean: 0,
        json: 0,
      } as Record<ConfigFormState['valueType'], number>,
    );
  }, [configs]);

  const loadConfigs = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const response = await listConfigs(appKey);
      setConfigs(response);
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载配置失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfigs();
  }, [appKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const key = form.key.trim();
    if (!key) {
      setError('配置 key 不能为空');
      return;
    }

    const payload: AppConfigUpsertRequest = {
      alias: form.alias.trim(),
      configValue: form.configValue.trim(),
      valueType: form.valueType,
      description: form.description.trim(),
    };

    setSaving(true);
    setError('');
    try {
      await upsertConfig(key, payload, appKey);
      setForm(defaultForm);
      await loadConfigs();
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存配置失败';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (config: AppConfig): Promise<void> => {
    const confirmed = window.confirm(`确认删除配置 ${config.configKey} 吗？`);
    if (!confirmed) {
      return;
    }
    setError('');
    try {
      await deleteConfig(config.configKey, appKey);
      await loadConfigs();
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除配置失败';
      setError(message);
    }
  };

  const handleEdit = (config: AppConfig): void => {
    setForm({
      key: config.configKey,
      alias: config.alias || '',
      configValue: config.configValue,
      valueType: config.valueType,
      description: config.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = (): void => {
    setForm(defaultForm);
    setError('');
  };

  return (
    <section className={styles.section}>
      <div className={styles.overviewGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>配置总数</span>
          <strong className={styles.metricValue}>{configs.length}</strong>
          <p className={styles.metricFootnote}>当前 provider 已登记的运行配置项。</p>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>复杂类型</span>
          <strong className={styles.metricValue}>{typeSummary.boolean + typeSummary.json}</strong>
          <p className={styles.metricFootnote}>布尔与 JSON 类型合计，更适合规则开关与结构化配置。</p>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>当前模式</span>
          <strong className={styles.metricValue}>{form.key.trim() ? '编辑中' : '新增中'}</strong>
          <p className={styles.metricFootnote}>填写 `key` 后保存即可执行新增或覆盖更新。</p>
        </article>
      </div>

      {error && <p className={styles.messageBar}>{error}</p>}

      <div className={styles.editorPanel}>
        <div className={styles.editorIntro}>
          <span className={styles.metricLabel}>Config Console</span>
          <h3 className={styles.panelTitle}>新增 / 更新配置</h3>
          <p className={styles.metricFootnote}>
            表单遵循 TinyText 风格的平面纸卡布局，把配置录入、类型提示和列表浏览放到同一工作流里。
          </p>
          <div className={styles.typeChips}>
            <span className={styles.typeChip}>string {typeSummary.string}</span>
            <span className={styles.typeChip}>number {typeSummary.number}</span>
            <span className={styles.typeChip}>boolean {typeSummary.boolean}</span>
            <span className={styles.typeChip}>json {typeSummary.json}</span>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label>
              key
              <input
                className={styles.textInput}
                value={form.key}
                onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                placeholder="show_fireworks"
                required
              />
            </label>

            <label>
              alias
              <input
                className={styles.textInput}
                value={form.alias}
                onChange={(e) => setForm((prev) => ({ ...prev, alias: e.target.value }))}
                placeholder="sf"
              />
            </label>

            <label>
              valueType
              <select
                className={styles.textInput}
                value={form.valueType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    valueType: e.target.value as ConfigFormState['valueType'],
                  }))
                }
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="json">json</option>
              </select>
            </label>

            <label className={styles.valueField}>
              configValue
              <textarea
                className={styles.textArea}
                value={form.configValue}
                onChange={(e) => setForm((prev) => ({ ...prev, configValue: e.target.value }))}
                placeholder="true"
                required
              />
            </label>

            <label className={styles.valueField}>
              description
              <textarea
                className={styles.textArea}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="是否在客户端显示烟花效果"
              />
            </label>
          </div>

          <p className={styles.helper}>{helperText}</p>
          <div className={styles.formActions}>
            <button className={styles.secondaryButton} type="button" onClick={handleReset}>
              清空
            </button>
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? '保存中...' : form.key.trim() ? '保存更新' : '保存配置'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.metricLabel}>Config Registry</span>
            <h3 className={styles.panelTitle}>配置列表</h3>
          </div>
          <span className={styles.panelMeta}>{loading ? '加载中...' : `共 ${configs.length} 条配置`}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Alias</th>
                <th>Type</th>
                <th>Value</th>
                <th>Description</th>
                <th>UpdatedAt</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    加载中...
                  </td>
                </tr>
              ) : configs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    暂无配置
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.configKey}>
                    <td>{config.configKey}</td>
                    <td>{config.alias || '-'}</td>
                    <td>
                      <span className={styles.typeChip}>{config.valueType}</span>
                    </td>
                    <td className={styles.valueCell}>
                      <code className={styles.codeValue}>{config.configValue}</code>
                    </td>
                    <td>{config.description || '-'}</td>
                    <td>{formatDate(config.updatedAt)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.secondaryButton} type="button" onClick={() => handleEdit(config)}>
                          编辑
                        </button>
                        <button className={styles.dangerButton} type="button" onClick={() => void handleDelete(config)}>
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
      </div>
    </section>
  );
}
