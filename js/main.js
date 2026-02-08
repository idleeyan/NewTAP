
import { BookmarkManager } from './BookmarkManager.js';
import { SettingsManager } from './SettingsManager.js';
import { StatsManager } from './StatsManager.js';
import { UIManager } from './UIManager.js';
import { WebDAVSyncManager, AutoSyncManager } from './SyncManager.js';
import { BackupManager } from './BackupManager.js';

class App {
  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.settingsManager = new SettingsManager();
    this.statsManager = new StatsManager();
    this.webdavSyncManager = new WebDAVSyncManager();
    this.autoSyncManager = new AutoSyncManager(this.webdavSyncManager);
    this.backupManager = new BackupManager(this.bookmarkManager, this.settingsManager);

    // UI Manager orchestrates the view
    this.uiManager = new UIManager(
      this.bookmarkManager,
      this.settingsManager,
      this.statsManager,
      this.webdavSyncManager,
      this.backupManager
    );
  }

  async init() {
    // Load all data
    await this.bookmarkManager.loadBookmarks();
    await this.settingsManager.init(); // Loads sizes, shapes, bg
    await this.webdavSyncManager.loadConfig();
    await this.autoSyncManager.loadConfig();
    await this.backupManager.init(); // Auto backup check

    // Initialize UI
    this.settingsManager.setupUI();
    this.uiManager.init();
    this.uiManager.renderBookmarks();

    // Setup Sync UI interactions (bridging UI and SyncManager)
    this.setupSyncUI();

    // Start Auto Sync
    this.startAutoSync();
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

            await this.autoSyncManager.saveConfig({ enabled, interval, syncOnStart });
            this.autoSyncManager.start();
            this.updateWebDAVStatus(); // refreshes UI
            alert('自动同步设置已保存');
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
      this.autoSyncManager.start();
      const result = await this.autoSyncManager.syncOnStartIfEnabled();
      if (result.success && result.direction === 'download') {
          await this.reloadAllData();
          console.log('启动时自动同步完成');
      }
  }

  async reloadAllData() {
      await this.bookmarkManager.loadBookmarks();
      await this.settingsManager.init();
      this.uiManager.renderBookmarks();
      this.updateWebDAVStatus();
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  window.app = app; // For debugging
});
