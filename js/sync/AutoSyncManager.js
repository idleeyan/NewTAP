export class AutoSyncManager {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.intervalId = null;
    this.onSyncComplete = null;
    this.config = {
      enabled: false,
      interval: 30,
      syncOnStart: false
    };
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get('autoSyncConfig');
      if (result.autoSyncConfig) {
        this.config = { ...this.config, ...result.autoSyncConfig };
      }
      return this.config;
    } catch (error) {
      console.error('加载自动同步配置失败:', error);
      return this.config;
    }
  }

  async saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ autoSyncConfig: this.config });

      if (this.config.enabled) {
        this.start();
      } else {
        this.stop();
      }

      return true;
    } catch (error) {
      console.error('保存自动同步配置失败:', error);
      return false;
    }
  }

  async init() {
    await this.loadConfig();

    if (this.config.enabled) {
      this.start();

      if (this.config.syncOnStart) {
        console.log('启动时自动同步');
        await this.doSync();
      }
    }

    return this.config;
  }

  start() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const intervalMs = this.config.interval * 60 * 1000;

    this.intervalId = setInterval(async () => {
      console.log('自动同步触发');
      await this.doSync();
    }, intervalMs);

    console.log(`自动同步已启动，间隔: ${this.config.interval} 分钟`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('自动同步已停止');
  }

  async doSync() {
    if (!this.syncManager) {
      console.error('同步管理器未初始化');
      return { success: false, error: '同步管理器未初始化' };
    }

    try {
      const result = await this.syncManager.smartSync();
      console.log('自动同步结果:', result);

      if (result.success) {
        await chrome.storage.local.set({
          lastAutoSync: Date.now(),
          lastAutoSyncResult: result
        });
      }

      if (this.onSyncComplete) {
        this.onSyncComplete(result);
      }

      return result;
    } catch (error) {
      console.error('自动同步失败:', error);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      interval: this.config.interval,
      syncOnStart: this.config.syncOnStart,
      isRunning: this.intervalId !== null
    };
  }

  async getLastSyncInfo() {
    try {
      const result = await chrome.storage.local.get(['lastAutoSync', 'lastAutoSyncResult']);
      return {
        lastSyncTime: result.lastAutoSync || null,
        lastSyncResult: result.lastAutoSyncResult || null
      };
    } catch (error) {
      console.error('获取上次同步信息失败:', error);
      return { lastSyncTime: null, lastSyncResult: null };
    }
  }

  setOnSyncComplete(callback) {
    this.onSyncComplete = callback;
  }

  async syncOnStartIfEnabled() {
    if (this.config.syncOnStart && this.config.enabled) {
      return await this.doSync();
    }
    return { success: false, error: '启动同步未启用' };
  }
}
