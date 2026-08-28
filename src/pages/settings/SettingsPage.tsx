import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { listModels, testConnection } from '@/adapters/llm';
import { testWebdav } from '@/adapters/webdav';
import { exportBackup, parseBackup, restoreBackup } from '@/services/backupService';
import { clearDemoTasks, seedDemoTasks } from '@/services/demoService';
import { pullNow, pushNow, initSync } from '@/services/syncService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import type { ThemeMode, ThemeStyle } from '@/types/settings';
import { WEBDAV_PRESETS } from '@/types/settings';

const STYLES: { value: ThemeStyle; label: string }[] = [
  { value: 'archive', label: '档案室' },
  { value: 'mono', label: '极简' },
];

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '明' },
  { value: 'dark', label: '暗' },
  { value: 'system', label: '跟随系统' },
];

/**
 * 设置页（§11 页面 4 / 方向稿 §10：分组列表式 + hairline 分隔）。
 * 主题 / LLM 配置（OpenAI 兼容，Key 只存本地）/ 数据（导出·导入 JSON）/ 演示数据。
 */
export function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const llm = useSettingsStore((s) => s.llm);
  const webdav = useSettingsStore((s) => s.webdav);
  const setStyle = useSettingsStore((s) => s.setStyle);
  const setMode = useSettingsStore((s) => s.setMode);
  const setLlm = useSettingsStore((s) => s.setLlm);
  const setWebdav = useSettingsStore((s) => s.setWebdav);
  const syncing = useSyncStore((s) => s.syncing);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const lastSyncError = useSyncStore((s) => s.lastError);
  const showToast = useUiStore((s) => s.showToast);

  const [llmDraft, setLlmDraft] = useState(llm);
  const [davDraft, setDavDraft] = useState(webdav);
  const [davTestResult, setDavTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testingDav, setTestingDav] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busyDemo, setBusyDemo] = useState(false);
  const [confirmImport, setConfirmImport] = useState<{ text: string; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await testConnection(llmDraft);
      setTestResult('连接成功');
    } catch (e) {
      setTestResult(`失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setTestResult(null);
    try {
      const models = await listModels(llmDraft);
      setLlmDraft({
        ...llmDraft,
        models,
        // 保留仍在列表中的勾选；之前没选过就默认全不选，由用户勾选
        selectedModels: llmDraft.selectedModels.filter((m) => models.includes(m)),
        activeModel: models.includes(llmDraft.activeModel) ? llmDraft.activeModel : '',
      });
      setTestResult(`获取到 ${models.length} 个模型`);
    } catch (e) {
      setTestResult(`获取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestDav = async () => {
    setTestingDav(true);
    setDavTestResult(null);
    try {
      await testWebdav(davDraft);
      setDavTestResult('连接成功');
    } catch (e) {
      setDavTestResult(`失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTestingDav(false);
    }
  };

  const handleSyncNow = async () => {
    setWebdav(davDraft);
    initSync(); // 本次会话内首次启用时立即生效（已初始化则空转）
    await pullNow();
    await pushNow();
    const err = useSyncStore.getState().lastError;
    showToast({ message: err ? `同步失败：${err}` : '同步完成' });
  };

  const handleSeed = async () => {
    setBusyDemo(true);
    try {
      const n = await seedDemoTasks();
      showToast({ message: `已填充 ${n} 条演示数据` });
    } finally {
      setBusyDemo(false);
    }
  };
  const handleClearDemo = async () => {
    setBusyDemo(true);
    try {
      const n = await clearDemoTasks();
      showToast({ message: `已清除 ${n} 条演示数据` });
    } finally {
      setBusyDemo(false);
    }
  };

  const handleExport = () => {
    void exportBackup().then((n) => showToast({ message: `已导出 ${n} 条记录` }));
  };
  const handleImportFile = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      setConfirmImport({ text: JSON.stringify(backup), count: backup.tasks.length });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : String(e) });
    }
  };
  const handleConfirmImport = async () => {
    if (!confirmImport) return;
    await restoreBackup(parseBackup(confirmImport.text));
    setConfirmImport(null);
    showToast({ message: '已完整还原备份' });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 pb-32 pt-16">
      <h1 className="font-display text-display-2">设置</h1>

      {/* 主题 */}
      <section className="mt-10">
        <h2 className="font-mono text-caption text-sub">主题</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">风格</span>
            <div className="flex gap-2">
              {STYLES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStyle(value)}
                  className={`rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
                    theme.style === value ? 'border-accent text-accent' : 'border-line text-sub hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">明暗</span>
            <div className="flex gap-2">
              {MODES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-ctl border px-3 py-1 font-mono text-caption transition-colors ${
                    theme.mode === value ? 'border-accent text-accent' : 'border-line text-sub hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-caption text-sub">宣纸 / 墨室 / 白页 / 黑场 · 偏好仅存本地，不同步</p>
      </section>

      {/* LLM 配置（2026-08-28 改版，参考 ccswitch 类主流接入：名称 + Base URL + Key + 获取模型多选） */}
      <section className="mt-12">
        <h2 className="font-mono text-caption text-sub">AI 总结（OpenAI 兼容接口）</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">名称</span>
            <input
              value={llmDraft.name}
              onChange={(e) => setLlmDraft({ ...llmDraft, name: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
              placeholder="DeepSeek"
            />
          </label>
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">Base URL</span>
            <input
              value={llmDraft.baseUrl}
              onChange={(e) => setLlmDraft({ ...llmDraft, baseUrl: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
              placeholder="https://api.deepseek.com/v1"
            />
          </label>
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">API Key</span>
            <input
              type="password"
              value={llmDraft.apiKey}
              onChange={(e) => setLlmDraft({ ...llmDraft, apiKey: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
              placeholder="sk-…"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => {
              setLlm(llmDraft);
              showToast({ message: '已保存' });
            }}
            className="rounded-full border border-accent px-4 py-1.5 font-mono text-caption text-accent transition-opacity hover:opacity-70"
          >
            保存
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={handleFetchModels}
            disabled={fetchingModels}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
          >
            {fetchingModels ? '获取中…' : '获取模型'}
          </button>
          {testResult && <span className="font-mono text-caption text-sub">{testResult}</span>}
        </div>

        {/* 模型多选列表：勾选可用模型；单选"总结用"标记决定 AI 总结实际调用哪个 */}
        {llmDraft.models.length > 0 && (
          <div className="mt-3 max-h-56 overflow-y-auto rounded-ctl border border-line">
            {llmDraft.models.map((m) => {
              const selected = llmDraft.selectedModels.includes(m);
              const active = llmDraft.activeModel === m;
              return (
                <div key={m} className="flex h-10 items-center gap-3 border-b border-line px-3 last:border-b-0">
                  <button
                    onClick={() =>
                      setLlmDraft({
                        ...llmDraft,
                        selectedModels: selected
                          ? llmDraft.selectedModels.filter((x) => x !== m)
                          : [...llmDraft.selectedModels, m],
                        // 取消勾选总结用模型时回退到剩余首个；勾选时若总结模型为空则自动顶上
                        ...(selected && active
                          ? { activeModel: llmDraft.selectedModels.filter((x) => x !== m)[0] ?? '' }
                          : !selected && !llmDraft.activeModel
                            ? { activeModel: m }
                            : {}),
                      })
                    }
                    aria-label={`选择模型 ${m}`}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                      selected ? 'border-accent bg-accent text-surface' : 'border-line hover:border-sub'
                    }`}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                  </button>
                  <button
                    onClick={() => selected && setLlmDraft({ ...llmDraft, activeModel: m })}
                    className={`flex-1 truncate text-left font-mono text-caption transition-colors ${
                      selected ? 'text-ink' : 'text-sub'
                    } ${selected ? 'hover:text-accent' : ''}`}
                    title={selected ? '点击设为总结模型' : '先勾选再设为总结模型'}
                  >
                    {m}
                  </button>
                  {active && (
                    <span className="shrink-0 rounded-full border border-accent px-2 py-0.5 font-mono text-[10px] text-accent">
                      总结用
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {llmDraft.models.length > 0 && (
          <p className="mt-2 font-mono text-caption text-sub">
            已勾选 {llmDraft.selectedModels.length} 个模型 · 总结模型：{llmDraft.activeModel || '未选'}（点名称切换）
          </p>
        )}
        <p className="mt-3 font-mono text-caption leading-5 text-sub">
          隐私提示：生成 AI 总结时，所选周期内的完成记录（标题、完成时间、模块来源）会发送给上述第三方模型服务；
          API Key 只存在本机，不上传、不进导出文件。
        </p>
      </section>

      {/* 数据 */}
      <section className="mt-12">
        <h2 className="font-mono text-caption text-sub">数据</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">导出 JSON 备份</span>
            <button
              onClick={handleExport}
              className="rounded-full border border-line px-4 py-1 font-mono text-caption text-sub transition-colors hover:text-ink"
            >
              导出
            </button>
          </div>
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">从备份还原</span>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-line px-4 py-1 font-mono text-caption text-sub transition-colors hover:text-ink"
            >
              选择文件…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </section>

      {/* WebDAV 同步（清单 M5-4）：单 JSON 快照，打开时拉取合并、变更后防抖 5s 推送 */}
      <section className="mt-12">
        <h2 className="font-mono text-caption text-sub">WebDAV 同步</h2>
        <div className="mt-2 flex gap-2">
          {WEBDAV_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDavDraft({ ...davDraft, endpoint: p.endpoint })}
              className="rounded-full border border-line px-3 py-1 font-mono text-caption text-sub transition-colors hover:text-ink"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">服务地址</span>
            <input
              value={davDraft.endpoint}
              onChange={(e) => setDavDraft({ ...davDraft, endpoint: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
              placeholder="https://dav.jianguoyun.com/dav/"
            />
          </label>
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">账号</span>
            <input
              value={davDraft.username}
              onChange={(e) => setDavDraft({ ...davDraft, username: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
            />
          </label>
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">密码 / 应用密码</span>
            <input
              type="password"
              value={davDraft.password}
              onChange={(e) => setDavDraft({ ...davDraft, password: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
            />
          </label>
          <label className="flex h-12 items-center justify-between gap-4">
            <span className="shrink-0 text-body">远端路径</span>
            <input
              value={davDraft.remotePath}
              onChange={(e) => setDavDraft({ ...davDraft, remotePath: e.target.value })}
              className="w-full bg-transparent text-right font-mono text-caption focus:outline-none"
            />
          </label>
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">启用自动同步</span>
            <button
              onClick={() => setDavDraft({ ...davDraft, enabled: !davDraft.enabled })}
              className={`rounded-full border px-4 py-1 font-mono text-caption transition-colors ${
                davDraft.enabled ? 'border-accent text-accent' : 'border-line text-sub hover:text-ink'
              }`}
            >
              {davDraft.enabled ? '已启用' : '未启用'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => {
              setWebdav(davDraft);
              showToast({ message: '已保存' });
            }}
            className="rounded-full border border-accent px-4 py-1.5 font-mono text-caption text-accent transition-opacity hover:opacity-70"
          >
            保存
          </button>
          <button
            onClick={handleTestDav}
            disabled={testingDav}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
          >
            {testingDav ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={() => void handleSyncNow()}
            disabled={syncing || !davDraft.enabled}
            className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
          >
            {syncing ? '同步中…' : '立即同步'}
          </button>
          {davTestResult && <span className="font-mono text-caption text-sub">{davTestResult}</span>}
        </div>
        <p className="mt-3 font-mono text-caption leading-5 text-sub">
          {lastSyncAt
            ? `上次同步 ${new Date(lastSyncAt).toLocaleString('zh-CN')}`
            : lastSyncError
              ? `上次同步失败：${lastSyncError}`
              : '快照为单 JSON 文件，按记录更新时间逐条取新合并；删除操作不会同步到远端。凭据只存本机。'}
        </p>
      </section>

      {/* 演示数据 */}
      <section className="mt-12">
        <h2 className="font-mono text-caption text-sub">演示数据</h2>
        <div className="mt-2 divide-y divide-line border-y border-line">
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">填充 2025-08 至今的演示记录</span>
            <button
              onClick={handleSeed}
              disabled={busyDemo}
              className="rounded-full border border-line px-4 py-1 font-mono text-caption text-sub transition-colors hover:text-ink disabled:opacity-40"
            >
              填充
            </button>
          </div>
          <div className="flex h-12 items-center justify-between">
            <span className="text-body">清除全部演示记录</span>
            <button
              onClick={handleClearDemo}
              disabled={busyDemo}
              className="rounded-full border border-accent px-4 py-1 font-mono text-caption text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
            >
              清除
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-caption text-sub">演示记录带 demo 标签，清除不影响真实数据</p>
      </section>

      {/* 导入还原：危险操作二次确认（方向稿 §10） */}
      {confirmImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-6">
          <div className="max-w-md rounded-card border border-line bg-surface p-6 shadow-[var(--shadow-float)]">
            <h4 className="font-display text-title">确认还原？</h4>
            <p className="mt-3 text-body leading-7">
              备份包含 {confirmImport.count} 条记录。还原会<strong>清空当前全部数据</strong>再写回，此操作不可撤销。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmImport(null)}
                className="rounded-full border border-line px-4 py-1.5 font-mono text-caption text-sub transition-colors hover:text-ink"
              >
                取消
              </button>
              <button
                onClick={() => void handleConfirmImport()}
                className="rounded-full border border-accent px-4 py-1.5 font-mono text-caption text-accent transition-opacity hover:opacity-70"
              >
                确认还原
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
