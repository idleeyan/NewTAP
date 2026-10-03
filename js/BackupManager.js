
/**
 * BackupManager
 *
 * 存储结构（v1.16.20+，元数据/数据分离）：
 *   - backupIndex: [ { id, timestamp, reason, itemCount }, ... ]  // 轻量元数据列表，新的在前
 *   - backupData_<id>: { customBookmarks, bookmarkCardSize, ... }    // 单份完整备份数据，按需加载
 *
 * 兼容：init 时若检测到旧格式 backups 数组（含 data 字段），自动迁移为分离结构并删除旧 key。
 * 这样 getBackups() 只读轻量 index，列表渲染与每日自动检查不再跨进程反序列化多份完整数据。
 */
export class BackupManager {
  constructor(bookmarkManager, settingsManager) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.maxBackups = 5;
    this._DATA_KEY_PREFIX = 'backupData_';
  }

  async init() {
    // 1) 一次性迁移旧格式（迁移后旧 backups key 被删除，后续启动直接跳过）
    await this._migrateOldBackups();
    // 2) 检查是否需要每日自动备份（仅读轻量 index）
    await this.checkAutoBackup();
  }

  /**
   * 迁移旧格式：旧 backups 数组每项含完整 data，拆分为 backupIndex + backupData_<id>
   * 幂等：迁移成功后删除 backups key，后续启动检测不到即跳过。
   */
  async _migrateOldBackups() {
    try {
      const result = await chrome.storage.local.get('backups');
      const oldBackups = result.backups;
      if (!Array.isArray(oldBackups) || oldBackups.length === 0) return;

      // 已存在 index 视为已迁移，仅清理可能的旧 key
      const idxResult = await chrome.storage.local.get('backupIndex');
      if (Array.isArray(idxResult.backupIndex) && idxResult.backupIndex.length > 0) {
        await chrome.storage.local.remove('backups');
        return;
      }

      // 拆分：写各 backupData_<id>，构造 backupIndex
      const writes = {};
      const index = [];
      for (const b of oldBackups) {
        if (!b || !b.id) continue;
        writes[`${this._DATA_KEY_PREFIX}${b.id}`] = b.data || {};
        index.push({
          id: b.id,
          timestamp: b.timestamp || b.id,
          reason: b.reason || 'manual',
          itemCount: b.itemCount || 0
        });
      }
      writes['backupIndex'] = index;
      // 先写新结构，再删旧 key，保证中途异常不丢数据
      await chrome.storage.local.set(writes);
      await chrome.storage.local.remove('backups');
    } catch (error) {
      // 迁移失败不影响后续流程
      console.error('[Backup] 旧数据迁移失败:', error);
    }
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

      // Strip heavy stats data from bookmarks to keep backups small
      if (data.customBookmarks) {
        data.customBookmarks = data.customBookmarks.map(b => {
          const { visitHistory, dailyStats, timeOfDayStats, ...light } = b;
          return light;
        });
      }

      const id = Date.now();
      const itemCount = (data.customBookmarks || []).length;
      const meta = { id, timestamp: id, reason, itemCount };

      // 写入完整数据（单独 key）+ 更新 index
      const dataKey = `${this._DATA_KEY_PREFIX}${id}`;
      await chrome.storage.local.set({ [dataKey]: data });

      const result = await chrome.storage.local.get('backupIndex');
      let index = Array.isArray(result.backupIndex) ? result.backupIndex : [];
      index.unshift(meta);

      // 超量裁剪：删除被淘汰备份的完整数据 key，再更新 index
      if (index.length > this.maxBackups) {
        const dropped = index.slice(this.maxBackups);
        const removeKeys = dropped.map(m => `${this._DATA_KEY_PREFIX}${m.id}`);
        if (removeKeys.length > 0) {
          await chrome.storage.local.remove(removeKeys);
        }
        index = index.slice(0, this.maxBackups);
      }

      await chrome.storage.local.set({ backupIndex: index });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 返回轻量元数据列表（不含完整 data），供列表渲染与时间戳检查使用。
   */
  async getBackups() {
    try {
      const result = await chrome.storage.local.get('backupIndex');
      return Array.isArray(result.backupIndex) ? result.backupIndex : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 按需加载单份完整备份数据（仅在恢复时调用）。
   */
  async getBackupData(backupId) {
    try {
      const result = await chrome.storage.local.get(`${this._DATA_KEY_PREFIX}${backupId}`);
      return result[`${this._DATA_KEY_PREFIX}${backupId}`] || null;
    } catch (error) {
      return null;
    }
  }

  async restoreBackup(backupId) {
    try {
      const data = await this.getBackupData(backupId);
      if (!data) {
        throw new Error('备份不存在或数据损坏');
      }

      // 恢复数据
      await chrome.storage.local.set(data);

      // 更新 managers
      await this.bookmarkManager.loadBookmarks();
      await this.settingsManager.init();

      return true;
    } catch (error) {
      return false;
    }
  }

  async checkAutoBackup() {
    try {
      // 仅读轻量 index，不再全量加载备份数据
      const index = await this.getBackups();
      const lastBackup = index.length > 0 ? index[0] : null;
      const now = Date.now();

      // 无备份，或上次备份超过 24 小时
      if (!lastBackup || (now - lastBackup.timestamp) > 24 * 60 * 60 * 1000) {
        await this.createBackup('daily_auto');
      }
    } catch (error) {
      // 忽略自动备份错误
    }
  }

  async deleteBackup(backupId) {
    try {
      const result = await chrome.storage.local.get('backupIndex');
      let index = Array.isArray(result.backupIndex) ? result.backupIndex : [];
      index = index.filter(b => b.id !== backupId);

      // 同时删除对应的完整数据 key，避免残留占用空间
      await chrome.storage.local.remove(`${this._DATA_KEY_PREFIX}${backupId}`);
      await chrome.storage.local.set({ backupIndex: index });
      return true;
    } catch (error) {
      return false;
    }
  }
}
