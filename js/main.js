
import { BookmarkManager } from './BookmarkManager.js';
import { SettingsManager } from './SettingsManager.js';
import { StatsManager } from './StatsManager.js';
import { UIManager } from './UIManager.js';
import { WebDAVSyncManager, AutoSyncManager } from './sync/index.js';
import { BackupManager } from './BackupManager.js';
import { StickyNoteManager } from './StickyNoteManager.js';
import { iconCache } from './IconCache.js';

class App {
  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.settingsManager = new SettingsManager();
    this.statsManager = new StatsManager();
    this.webdavSyncManager = new WebDAVSyncManager();
    this.autoSyncManager = new AutoSyncManager(this.webdavSyncManager);
    this.backupManager = new BackupManager(this.bookmarkManager, this.settingsManager);
    this.stickyNoteManager = new StickyNoteManager();

    // UI Manager orchestrates the view
    this.uiManager = new UIManager(
      this.bookmarkManager,
      this.settingsManager,
      this.statsManager,
      this.webdavSyncManager,
      this.backupManager,
      this.stickyNoteManager
    );
  }

  async init() {
    // 阶段1：只加载渲染卡片必需的数据，不包含图标缓存/同步配置
    await Promise.all([
      this.bookmarkManager.loadBookmarks(),
      this.settingsManager.init(),
    ]);

    // 阶段2：立即渲染首屏，用户尽快看到网站卡片
    this.settingsManager.setupUI();
    this.uiManager.init();
    this.uiManager.renderBookmarks();

    // 阶段3：非关键路径后台执行，完成后按需刷新
    this._deferredInit();
  }

  /** 首屏之后再补齐图标缓存、同步配置与后台任务 */
  async _deferredInit() {
    try {
      await Promise.all([
        this.webdavSyncManager.loadConfig(),
        this.autoSyncManager.loadConfig(),
        iconCache.init(),
      ]);
      this.setupSyncUI();

      // 等图标缓存进内存后刷新一次，让已缓存的 data URI 立即显示
      await iconCache.populateCache(this._getIconUrls());
      this.uiManager.bookmarkRenderer._lastRenderKey = '';
      this.uiManager.renderBookmarks();
    } catch (e) {
      console.warn('[App] 延迟初始化失败', e);
    }

    try {
      await this.stickyNoteManager.init();
    } catch (e) { /* 忽略 */ }
    try {
      await this.backupManager.init();
    } catch (e) { /* 忽略 */ }
    try {
      this.startAutoSync();
    } catch (e) { /* 忽略 */ }

    // 后台预加载未缓存的图标，完成后刷新渲染显示新缓存的图标
    setTimeout(() => this._preloadIcons(), 200);
  }

  /** 收集当前书签的图标 URL 列表 */
  _getIconUrls() {
    return (this.bookmarkManager.bookmarks || [])
      .map(b => b.icon)
      .filter(u => u && !u.startsWith('data:'));
  }

  /** 后台批量预加载未缓存的图标，完成后触发重渲染 */
  async _preloadIcons() {
    try {
      const items = (this.bookmarkManager.bookmarks || [])
        .map(b => ({ icon: b.icon, url: b.url }))
        .filter(i => i.icon && !i.icon.startsWith('data:'));
      const changed = await iconCache.preloadBatch(items);
      if (changed) {
        // 有新图标被缓存，触发重渲染以显示缓存图标
        this.uiManager.bookmarkRenderer._lastRenderKey = '';
        this.uiManager.renderBookmarks();
      }
    } catch (e) { /* 忽略 */ }
  }

  setupSyncUI() {
    // We need to wire up the Sync UI buttons which are in the settings dialog
    // This logic was in UIManager/newtab.js but it couples UI with Sync logic heavily.
    // Let's keep it here or in UIManager. UIManager has reference to syncManager,
    // but maybe we should add a method 'setupSyncUI' to UIManager.

    // For now, let's wire it manually here or delegate to UIManager if we added it there?
    // In the previous step I didn't add setupSyncUI to UIManager. Let's add it here.

    const configBtn = document.getElementById('webdavConfigBtn');
    const uploadBtn = document.getElementById('webdavUploadBtn');
    const downloadBtn = document.getElementById('webdavDownloadBtn');
    const disconnectBtn = document.getElementById('webdavDisconnectBtn');
    const configDialog = document.getElementById('webdavConfigDialog');
    const configForm = document.getElementById('webdavConfigForm');
    const testBtn = document.getElementById('testWebdavBtn');
    const autoSyncSection = document.getElementById('autoSyncSection');
    const saveAutoSyncBtn = document.getElementById('saveAutoSyncBtn');

    // Initial Status Update
    this.updateWebDAVStatus();

    // Listeners
    if (configBtn) {
      configBtn.addEventListener('click', () => {
        this.loadWebDAVConfigToForm();
        configDialog.classList.add('active');
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', () => this.testWebDAVConnection());
    }

    if (configForm) {
      configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveWebDAVConfig();
      });
    }

    document.getElementById('cancelWebdavConfigBtn')?.addEventListener('click', () => {
       configDialog.classList.remove('active');
       document.getElementById('webdavTestResult').textContent = '';
    });

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.syncToWebDAV());
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.syncFromWebDAV());
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', async () => {
        if(confirm('确定断开连接？')) {
            await this.webdavSyncManager.clearConfig();
            this.updateWebDAVStatus();
        }
      });
    }

    if (saveAutoSyncBtn) {
        saveAutoSyncBtn.addEventListener('click', async () => {
            const enabled = document.getElementById('autoSyncEnabled').checked;
            const interval = parseInt(document.getElementById('autoSyncInterval').value) || 30;
            const syncOnStart = document.getElementById('autoSyncOnStart').checked;

            if (interval < 5) { alert('最小间隔5分钟'); return; }

            const result = await this.autoSyncManager.saveConfig({ enabled, interval, syncOnStart });
            if (result && result.success) {
                this.updateWebDAVStatus(); // 刷新 UI（saveConfig 内部已根据 enabled 调用 start/stop）
                alert('自动同步设置已保存');
            } else {
                const err = (result && result.error) || '未知错误';
                console.error('[AutoSync] 保存失败:', err);
                alert('保存失败：' + err + '\n\n请打开控制台(F12)查看 [AutoSync] 日志，并反馈详细信息。');
            }
        });
    }

    // 监听 storage 变更，捕捉任何对 autoSyncConfig 的意外覆盖（辅助定位“刷新后丢失”类问题）
    if (!chrome.storage._autoSyncChangeMonitored) {
      chrome.storage._autoSyncChangeMonitored = true;
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;

        if (changes.autoSyncConfig) {
          console.log('[AutoSync] storage.onChanged 检测到 autoSyncConfig 被修改',
            { 旧值: changes.autoSyncConfig.oldValue, 新值: changes.autoSyncConfig.newValue });
        }

        // 当 customBookmarks 被外部修改（如 popup 添加书签、WebDAV 同步下载/合并）时，
        // 重新加载内存数据并刷新 UI。必须比较名称/图标，不能只比 URL 列表——
        // 换 logo 时 URL 不变，否则跨端同步后卡片不会更新。
        if (changes.customBookmarks && !this._reloading) {
          const oldArr = changes.customBookmarks.oldValue || [];
          const newArr = changes.customBookmarks.newValue || [];
          const sig = (arr) => (arr || [])
            .map(b => `${b.url}|${b.name || ''}|${b.icon || ''}|${b.index || 0}`)
            .sort()
            .join('\n');
          if (sig(oldArr) !== sig(newArr)) {
            console.log('[Bookmark] 检测到外部修改 customBookmarks（含名称/图标），重新加载（防抖）');
            if (this._reloadTimer) clearTimeout(this._reloadTimer);
            this._reloadTimer = setTimeout(() => {
              this._reloading = true;
              this.reloadAllData().finally(() => { this._reloading = false; this._reloadTimer = null; });
            }, 300);
          }
        }
      });
    }
  }

  async updateWebDAVStatus() {
    const status = await this.webdavSyncManager.getSyncStatus();
    const statusEl = document.getElementById('webdavStatus');
    const configBtn = document.getElementById('webdavConfigBtn');
    const uploadBtn = document.getElementById('webdavUploadBtn');
    const downloadBtn = document.getElementById('webdavDownloadBtn');
    const disconnectBtn = document.getElementById('webdavDisconnectBtn');
    const autoSyncSection = document.getElementById('autoSyncSection');

    if (!status.configured) {
        statusEl.textContent = '未配置';
        statusEl.className = ''; // Reset class
        statusEl.style.color = '#666';
        configBtn.style.display = 'inline-block';
        uploadBtn.style.display = 'none';
        downloadBtn.style.display = 'none';
        disconnectBtn.style.display = 'none';
        autoSyncSection.style.display = 'none';
    } else {
        const lastSync = status.lastLocalSync ? new Date(status.lastLocalSync).toLocaleString() : '从未';
        statusEl.textContent = `已连接 | 上次同步: ${lastSync}`;
        statusEl.style.color = '#4caf50';

        configBtn.style.display = 'none';
        uploadBtn.style.display = 'inline-block';
        downloadBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'inline-block';
        autoSyncSection.style.display = 'block';

        // Update Auto Sync UI parts
        const asStatus = this.autoSyncManager.getStatus();
        const asStatusEl = document.getElementById('autoSyncStatus');

        let asText = asStatus.enabled ? '已启用' : '未启用';
        if (asStatus.enabled && asStatus.lastSyncTime) {
             asText += ` | 上次: ${new Date(asStatus.lastSyncTime).toLocaleTimeString()}`;
        }
        asStatusEl.textContent = asText;
        asStatusEl.style.color = asStatus.enabled ? '#4caf50' : '#666';

        document.getElementById('autoSyncEnabled').checked = asStatus.enabled;
        document.getElementById('autoSyncInterval').value = asStatus.interval;
        document.getElementById('autoSyncOnStart').checked = asStatus.syncOnStart;
    }
  }

  loadWebDAVConfigToForm() {
      const config = this.webdavSyncManager.config || {};
      document.getElementById('webdavServerUrl').value = config.serverUrl || '';
      document.getElementById('webdavUsername').value = config.username || '';
      document.getElementById('webdavPassword').value = config.password || '';
      document.getElementById('webdavSyncPath').value = config.syncPath || '/newtab-sync/';
  }

  async testWebDAVConnection() {
      const resultEl = document.getElementById('webdavTestResult');
      resultEl.textContent = '测试中...';
      const config = {
          serverUrl: document.getElementById('webdavServerUrl').value,
          username: document.getElementById('webdavUsername').value,
          password: document.getElementById('webdavPassword').value
      };
      const success = await this.webdavSyncManager.testConnection(config);
      resultEl.textContent = success ? '连接成功' : '连接失败';
      resultEl.style.color = success ? 'green' : 'red';
  }

  async saveWebDAVConfig() {
      const config = {
          serverUrl: document.getElementById('webdavServerUrl').value,
          username: document.getElementById('webdavUsername').value,
          password: document.getElementById('webdavPassword').value,
          syncPath: document.getElementById('webdavSyncPath').value
      };
      if (await this.webdavSyncManager.saveConfig(config)) {
          document.getElementById('webdavConfigDialog').classList.remove('active');
          this.updateWebDAVStatus();
          alert('配置已保存');
      } else {
          alert('保存失败');
      }
  }

  async syncToWebDAV() {
      const btn = document.getElementById('webdavUploadBtn');
      btn.textContent = '同步中...';
      const result = await this.webdavSyncManager.smartSync();
      btn.textContent = '上传到云端'; // Reset text (simplified) or '智能同步'

      if (result.success) {
          if (result.localUpdated) {
            await this.reloadAllData();
          }
          alert('同步成功');
          this.updateWebDAVStatus();
      } else {
          alert('同步失败: ' + result.error);
      }
  }

  async syncFromWebDAV() {
      if(!confirm('这将覆盖本地数据，确定吗？')) return;
      const result = await this.webdavSyncManager.syncFromCloud();
      if (result.success) {
          await this.reloadAllData();
          alert('下载成功');
      } else {
          alert('下载失败: ' + result.error);
      }
  }

  async startAutoSync() {
      this.autoSyncManager.setOnSyncComplete(async (result) => {
          // 同步后只要本地被更新（下载/合并/图标物化）都刷新，不能只看 direction
          if (result && result.success && result.localUpdated !== false) {
            await this.reloadAllData();
          } else if (result && result.success && result.direction === 'download') {
            await this.reloadAllData();
          }
      });
      this.autoSyncManager.start();
      const result = await this.autoSyncManager.syncOnStartIfEnabled();
      if (result.success && (result.direction === 'download' || result.localUpdated)) {
          await this.reloadAllData();
      }
  }

  async reloadAllData() {
      await this.bookmarkManager.loadBookmarks();
      await this.settingsManager.init();
      await this.stickyNoteManager.loadNotes();
      // 重新加载后预填充图标缓存（WebDAV 同步可能改变了书签列表）
      await iconCache.populateCache(this._getIconUrls());
      // 强制重建卡片，确保换 logo 后立即可见
      this.uiManager.bookmarkRenderer.invalidate();
      this.uiManager.renderBookmarks();
      if (this.uiManager.isNotesPageOpen) {
          this.uiManager.renderNotes();
      }
      this.updateWebDAVStatus();
      // 后台预加载新增的未缓存图标
      setTimeout(() => this._preloadIcons(), 0);
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.app = app; // For debugging
});
