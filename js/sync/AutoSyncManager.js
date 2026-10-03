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
      console.log('[AutoSync] loadConfig 读取到:', result.autoSyncConfig);
      if (result.autoSyncConfig) {
        this.config = { ...this.config, ...result.autoSyncConfig };
      }
      console.log('[AutoSync] loadConfig 合并后 config:', this.config);
      return this.config;
    } catch (error) {
      console.error('[AutoSync] 加载自动同步配置失败:', error);
      return this.config;
    }
  }

  async saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ autoSyncConfig: this.config });

      // 读回验证：确认存储确实写入成功（防止静默失败造成“已保存”假象）
      const verify = await chrome.storage.local.get('autoSyncConfig');
      const stored = verify.autoSyncConfig;
      const matched = stored &&
        stored.enabled === this.config.enabled &&
        stored.interval === this.config.interval &&
        stored.syncOnStart === this.config.syncOnStart;

      if (!matched) {
        console.error('[AutoSync] 保存验证失败：写入值与读回值不一致', { 写入: { ...this.config }, 读回: stored });
        return { success: false, error: '保存验证失败：存储未正确写入' };
      }

      console.log('[AutoSync] 配置保存并验证通过:', this.config);

      if (this.config.enabled) {
        this.start();
      } else {
        this.stop();
      }

      return { success: true };
    } catch (error) {
      console.error('[AutoSync] 保存自动同步配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  async init() {
    await this.loadConfig();

    if (this.config.enabled) {
      this.start();

      if (this.config.syncOnStart) {
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
      await this.doSync();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async doSync() {
    if (!this.syncManager) {
      console.error('同步管理器未初始化');
      return { success: false, error: '同步管理器未初始化' };
    }

    try {
      const result = await this.syncManager.smartSync();

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
