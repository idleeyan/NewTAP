
export class BackupManager {
  constructor(bookmarkManager, settingsManager) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.maxBackups = 5;
  }

  async init() {
    // Check if we need an auto backup on startup
    await this.checkAutoBackup();
  }

  async createBackup(reason = 'manual') {
    try {
      const data = await chrome.storage.local.get([
        'customBookmarks',
        'bookmarkCardSize',
        'bookmarkCardShape',
        'bookmarkSortBy',
        'bgSettings',
        'webdavConfig',
        'autoSyncConfig',
        'deletedBookmarks'
      ]);

      const backup = {
        id: Date.now(),
        timestamp: Date.now(),
        reason: reason,
        itemCount: (data.customBookmarks || []).length,
        data: data
      };

      const result = await chrome.storage.local.get('backups');
      let backups = result.backups || [];

      // Add new backup
      backups.unshift(backup);

      // Trim to max backups
      if (backups.length > this.maxBackups) {
        backups = backups.slice(0, this.maxBackups);
      }

      await chrome.storage.local.set({ backups });
      console.log(`备份创建成功 (${reason})`, backup);
      return true;
    } catch (error) {
      console.error('创建备份失败:', error);
      return false;
    }
  }

  async getBackups() {
    try {
      const result = await chrome.storage.local.get('backups');
      return result.backups || [];
    } catch (error) {
      console.error('获取备份列表失败:', error);
      return [];
    }
  }

  async restoreBackup(backupId) {
    try {
      const result = await chrome.storage.local.get('backups');
      const backups = result.backups || [];
      const backup = backups.find(b => b.id === backupId);

      if (!backup || !backup.data) {
        throw new Error('备份不存在或数据损坏');
      }

      // Restore data
      await chrome.storage.local.set(backup.data);

      // Update managers
      await this.bookmarkManager.loadBookmarks();
      await this.settingsManager.init();

      console.log(`备份已还原 (${new Date(backup.timestamp).toLocaleString()})`);
      return true;
    } catch (error) {
      console.error('还原备份失败:', error);
      return false;
    }
  }

  async checkAutoBackup() {
    try {
      const backups = await this.getBackups();
      const lastBackup = backups.length > 0 ? backups[0] : null;
      const now = Date.now();

      // If no backups, or last backup was more than 24 hours ago
      if (!lastBackup || (now - lastBackup.timestamp) > 24 * 60 * 60 * 1000) {
        console.log('触发每日自动备份...');
        await this.createBackup('daily_auto');
      }
    } catch (error) {
      console.error('自动备份检查失败:', error);
    }
  }

  async deleteBackup(backupId) {
    try {
        const result = await chrome.storage.local.get('backups');
        let backups = result.backups || [];
        backups = backups.filter(b => b.id !== backupId);
        await chrome.storage.local.set({ backups });
        return true;
    } catch (error) {
        console.error('删除备份失败:', error);
        return false;
    }
  }
}
