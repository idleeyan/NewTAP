import { WebDAVClient } from './WebDAVClient.js';
import { DataMerger } from './DataMerger.js';

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
        'stickyNotes'
      ]);

      const serverResult = await this.client.downloadData();

      if (!serverResult.success) {
        if (serverResult.error && (serverResult.error.includes('404') || serverResult.error.includes('服务器上没有同步数据'))) {
          console.log('服务器没有数据，上传本地数据');
          return await this.syncToCloud();
        }
        return serverResult;
      }

      const serverData = serverResult.data;
      const serverTimestamp = serverResult.timestamp;
      const localTimestamp = localData.lastLocalModify || 0;

      console.log('同步时间戳对比:', {
        serverTimestamp: new Date(serverTimestamp).toLocaleString(),
        localTimestamp: new Date(localTimestamp).toLocaleString()
      });

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
        }
      );

      const mergedStickyNotes = DataMerger.mergeStickyNotes(
        localData.stickyNotes,
        serverData.stickyNotes
      );

      const mergedData = {
        customBookmarks: mergedBookmarks,
        deletedBookmarks: mergedDeleted,
        stickyNotes: mergedStickyNotes,
        ...mergedSettings
      };

      const localChanged = DataMerger.hasDataChanged(localData, mergedData);
      const serverChanged = DataMerger.hasDataChanged(serverData, mergedData);

      console.log('数据变更检测:', { localChanged, serverChanged });

      if (!localChanged && !serverChanged) {
        this.lastSyncTime = Date.now();
        this.lastSyncDirection = 'none';
        await chrome.storage.local.set({ lastWebDAVSync: this.lastSyncTime });
        return {
          success: true,
          direction: 'none',
          message: '数据已是最新，无需同步'
        };
      }

      if (localChanged) {
        await chrome.storage.local.set({
          customBookmarks: mergedBookmarks,
          deletedBookmarks: mergedDeleted,
          stickyNotes: mergedStickyNotes,
          bookmarkCardSize: mergedSettings.bookmarkCardSize,
          bookmarkCardShape: mergedSettings.bookmarkCardShape,
          bookmarkSortBy: mergedSettings.bookmarkSortBy,
          lastLocalModify: Date.now()
        });
      }

      if (serverChanged || localTimestamp > serverTimestamp) {
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
        localUpdated: localChanged,
        serverUpdated: serverChanged || localTimestamp > serverTimestamp,
        bookmarksCount: mergedBookmarks.length
      };
    } catch (error) {
      console.error('智能同步失败:', error);
      return { success: false, error: error.message };
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
        'stickyNotes'
      ]);

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
