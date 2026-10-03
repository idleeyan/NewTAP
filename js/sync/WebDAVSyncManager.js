import { WebDAVClient } from './WebDAVClient.js';
import { DataMerger } from './DataMerger.js';
import { iconCache } from '../IconCache.js';

export class WebDAVSyncManager {
  constructor() {
    this.config = null;
    this.client = null;
    this.lastSyncTime = null;
    this.lastSyncDirection = null;
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get('webdavConfig');
      this.config = result.webdavConfig || null;
      if (this.config) {
        this.client = new WebDAVClient(this.config);
      }
      return this.config;
    } catch (error) {
      console.error('加载WebDAV配置失败:', error);
      return null;
    }
  }

  async saveConfig(config) {
    try {
      await chrome.storage.local.set({ webdavConfig: config });
      this.config = config;
      this.client = new WebDAVClient(config);
      return true;
    } catch (error) {
      console.error('保存WebDAV配置失败:', error);
      return false;
    }
  }

  async testConnection(config) {
    const testClient = new WebDAVClient(config);
    return await testClient.testConnection();
  }

  async smartSync() {
    if (!this.client) {
      return { success: false, error: 'WebDAV未配置' };
    }

    try {
      const localData = await chrome.storage.local.get([
        'customBookmarks',
        'bookmarkCardSize',
        'bookmarkCardShape',
        'bookmarkSortBy',
        'lastLocalModify',
        'deletedBookmarks',
        'stickyNotes',
        'deletedStickyNotes'
      ]);

      const serverResult = await this.client.downloadData();

      if (!serverResult.success) {
        if (serverResult.error && (serverResult.error.includes('404') || serverResult.error.includes('服务器上没有同步数据') || serverResult.error.includes('解析数据失败'))) {
          return await this.syncToCloud();
        }
        return serverResult;
      }

      const serverData = serverResult.data;
      const serverTimestamp = serverResult.timestamp;
      const localTimestamp = localData.lastLocalModify || 0;

      const localDeleted = localData.deletedBookmarks || [];
      const serverDeleted = serverData.deletedBookmarks || [];

      const mergedBookmarks = DataMerger.mergeBookmarks(
        localData.customBookmarks,
        serverData.customBookmarks,
        localDeleted,
        serverDeleted
      );

      const mergedDeleted = DataMerger.mergeDeletedList(localDeleted, serverDeleted);

      const mergedSettings = DataMerger.mergeSettings(
        {
          bookmarkCardSize: localData.bookmarkCardSize,
          bookmarkCardShape: localData.bookmarkCardShape,
          bookmarkSortBy: localData.bookmarkSortBy
        },
        {
          bookmarkCardSize: serverData.bookmarkCardSize,
          bookmarkCardShape: serverData.bookmarkCardShape,
          bookmarkSortBy: serverData.bookmarkSortBy
        },
        localTimestamp,
        serverTimestamp
      );

      const localDeletedNotes = localData.deletedStickyNotes || [];
      const serverDeletedNotes = serverData.deletedStickyNotes || [];

      const mergedStickyNotes = DataMerger.mergeStickyNotes(
        localData.stickyNotes,
        serverData.stickyNotes,
        localDeletedNotes,
        serverDeletedNotes
      );

      const mergedDeletedNotes = DataMerger.mergeDeletedStickyNotes(localDeletedNotes, serverDeletedNotes);

      const mergedData = {
        customBookmarks: mergedBookmarks,
        deletedBookmarks: mergedDeleted,
        stickyNotes: mergedStickyNotes,
        deletedStickyNotes: mergedDeletedNotes,
        ...mergedSettings
      };

      const localChanged = DataMerger.hasDataChanged(localData, mergedData);
      const serverChanged = DataMerger.hasDataChanged(serverData, mergedData);
      const shouldPush = serverChanged || localTimestamp > serverTimestamp;

      let finalBookmarks = mergedBookmarks;
      let iconsMaterialized = false;

      // 上传前把在线图标内联为 data URI，跨端显示一致、离线可用
      if (shouldPush) {
        finalBookmarks = await this._materializeIcons(mergedBookmarks);
        iconsMaterialized = finalBookmarks.some((b, i) => b.icon !== mergedBookmarks[i]?.icon);
        mergedData.customBookmarks = finalBookmarks;
      }

      if (!localChanged && !serverChanged && !iconsMaterialized) {
        this.lastSyncTime = Date.now();
        this.lastSyncDirection = 'none';
        await chrome.storage.local.set({ lastWebDAVSync: this.lastSyncTime });
        return {
          success: true,
          direction: 'none',
          localUpdated: false,
          serverUpdated: false,
          message: '数据已是最新，无需同步'
        };
      }

      // 本地有变更，或图标被物化为 data URI 时写回本机，避免“云端已是新 logo、本机仍是旧 URL”
      if (localChanged || iconsMaterialized) {
        await chrome.storage.local.set({
          customBookmarks: finalBookmarks,
          deletedBookmarks: mergedDeleted,
          stickyNotes: mergedStickyNotes,
          deletedStickyNotes: mergedDeletedNotes,
          bookmarkCardSize: mergedSettings.bookmarkCardSize,
          bookmarkCardShape: mergedSettings.bookmarkCardShape,
          bookmarkSortBy: mergedSettings.bookmarkSortBy,
          lastLocalModify: Date.now()
        });
      }

      if (shouldPush) {
        const uploadResult = await this.client.uploadData(mergedData);
        if (!uploadResult) {
          return { success: false, error: '上传合并后的数据失败' };
        }
        this.lastSyncDirection = 'upload';
      } else {
        this.lastSyncDirection = 'download';
      }

      this.lastSyncTime = Date.now();
      await chrome.storage.local.set({ lastWebDAVSync: this.lastSyncTime });

      return {
        success: true,
        direction: this.lastSyncDirection,
        localUpdated: localChanged || iconsMaterialized,
        serverUpdated: shouldPush,
        bookmarksCount: finalBookmarks.length
      };
    } catch (error) {
      console.error('智能同步失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 把书签列表中的在线图标 URL 内联为 data URI。
   * - 已是 data URI 的原样保留。
   * - 本机 iconDataStore 已有缓存的，直接取用，不联网。
   * - 未缓存的尝试联网拉取一次；失败则保留原 URL（优雅降级，不阻塞同步）。
   * @param {Array} bookmarks
   * @returns {Promise<Array>} icon 已尽量 data URI 化的副本
   */
  async _materializeIcons(bookmarks) {
    if (!Array.isArray(bookmarks)) return bookmarks;
    const tasks = bookmarks.map(async (b) => {
      const copy = { ...b };
      const icon = copy.icon;
      if (!icon || icon.startsWith('data:')) return copy;
      let dataUri = iconCache.getFromMemory(icon);
      if (!dataUri) {
        try {
          dataUri = await iconCache.fetchAndCache(icon, copy.url);
        } catch (e) {
          dataUri = null;
        }
      }
      if (dataUri) copy.icon = dataUri;
      return copy;
    });
    const results = await Promise.allSettled(tasks);
    return results.map((r, i) => (r.status === 'fulfilled' ? r.value : bookmarks[i]));
  }

  /** 仅当有图标从 URL 变成 data URI 时，把结果写回本机书签 */
  async _writeBackMaterializedIcons(materialized) {
    try {
      const result = await chrome.storage.local.get('customBookmarks');
      const current = result.customBookmarks || [];
      const byUrl = new Map(materialized.map(b => [b.url, b.icon]));
      let changed = false;
      const next = current.map(b => {
        const newIcon = byUrl.get(b.url);
        if (newIcon && newIcon !== b.icon && String(newIcon).startsWith('data:')) {
          changed = true;
          return { ...b, icon: newIcon };
        }
        return b;
      });
      if (changed) {
        await chrome.storage.local.set({ customBookmarks: next });
      }
      return changed;
    } catch {
      return false;
    }
  }

  async syncToCloud() {
    if (!this.client) {
      return { success: false, error: 'WebDAV未配置' };
    }

    try {
      const data = await chrome.storage.local.get([
        'customBookmarks',
        'deletedBookmarks',
        'bookmarkCardSize',
        'bookmarkCardShape',
        'bookmarkSortBy',
        'stickyNotes',
        'deletedStickyNotes'
      ]);

      // 上传前把在线图标内联为 data URI，并写回本机，保证多端图标一致
      data.customBookmarks = await this._materializeIcons(data.customBookmarks);
      await this._writeBackMaterializedIcons(data.customBookmarks);

      const success = await this.client.uploadData(data);

      if (success) {
        this.lastSyncTime = Date.now();
        this.lastSyncDirection = 'upload';
        await chrome.storage.local.set({
          lastWebDAVSync: this.lastSyncTime,
          lastLocalModify: Date.now()
        });
        return { success: true, timestamp: this.lastSyncTime, direction: 'upload' };
      } else {
        return { success: false, error: '上传数据失败' };
      }
    } catch (error) {
      console.error('同步到云端失败:', error);
      return { success: false, error: error.message };
    }
  }

  async syncFromCloud() {
    if (!this.client) {
      return { success: false, error: 'WebDAV未配置' };
    }

    try {
      const result = await this.client.downloadData();

      if (!result.success) {
        return result;
      }

      const data = result.data;

      if (data.customBookmarks !== undefined) {
        await chrome.storage.local.set({ customBookmarks: data.customBookmarks });
      }
      if (data.deletedBookmarks !== undefined) {
        await chrome.storage.local.set({ deletedBookmarks: data.deletedBookmarks });
      }
      if (data.bookmarkCardSize !== undefined) {
        await chrome.storage.local.set({ bookmarkCardSize: data.bookmarkCardSize });
      }
      if (data.bookmarkCardShape !== undefined) {
        await chrome.storage.local.set({ bookmarkCardShape: data.bookmarkCardShape });
      }
      if (data.bookmarkSortBy !== undefined) {
        await chrome.storage.local.set({ bookmarkSortBy: data.bookmarkSortBy });
      }
      if (data.stickyNotes !== undefined) {
        await chrome.storage.local.set({ stickyNotes: data.stickyNotes });
      }
      if (data.deletedStickyNotes !== undefined) {
        await chrome.storage.local.set({ deletedStickyNotes: data.deletedStickyNotes });
      }

      this.lastSyncTime = Date.now();
      this.lastSyncDirection = 'download';
      await chrome.storage.local.set({ lastWebDAVSync: this.lastSyncTime });

      return {
        success: true,
        timestamp: this.lastSyncTime,
        direction: 'download',
        bookmarksCount: data.customBookmarks ? data.customBookmarks.length : 0
      };
    } catch (error) {
      console.error('从云端同步失败:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    try {
      await chrome.storage.local.remove(['webdavConfig', 'lastWebDAVSync']);
      this.config = null;
      this.client = null;
      this.lastSyncTime = null;
      this.lastSyncDirection = null;
      return true;
    } catch (error) {
      console.error('断开WebDAV连接失败:', error);
      return false;
    }
  }

  getLastSyncInfo() {
    return {
      lastSyncTime: this.lastSyncTime,
      lastSyncDirection: this.lastSyncDirection
    };
  }

  async getSyncStatus() {
    const lastLocalSync = this.lastSyncTime;
    return {
      configured: !!this.config,
      lastLocalSync: lastLocalSync
    };
  }

  async clearConfig() {
    return await this.disconnect();
  }
}
