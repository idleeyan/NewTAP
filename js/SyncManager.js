
export class WebDAVClient {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.username = config.username;
    this.password = config.password;
    this.syncPath = config.syncPath || '/newtab-sync/';
    this.filename = config.filename || 'newtab-data.json';
  }

  async sendRequest(method, path = '', data = null) {
    console.log('WebDAV: 发送请求', method, path);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'webdav',
        config: {
          serverUrl: this.serverUrl,
          username: this.username,
          password: this.password
        },
        method: method,
        path: path,
        data: data
      }, (result) => {
        console.log('WebDAV: 收到响应', method, path, result);
        resolve(result);
      });
    });
  }

  async testConnection() {
    try {
      // 先尝试 PROPFIND
      let result = await Promise.race([
        this.sendRequest('PROPFIND'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PROPFIND超时')), 10000))
      ]);
      console.log('WebDAV: PROPFIND 测试结果', result);

      // 如果 PROPFIND 失败，尝试 GET 根目录
      if (!result.success) {
        console.log('WebDAV: PROPFIND 失败，尝试 GET');
        result = await Promise.race([
          this.sendRequest('GET', '/'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET超时')), 10000))
        ]);
        console.log('WebDAV: GET 测试结果', result);
      }

      return result.success;
    } catch (error) {
      console.error('WebDAV: 测试连接失败', error.message);
      return false;
    }
  }

  async ensureDirectory() {
    // 尝试不同的路径格式
    const pathsToTry = [
      this.syncPath,
      this.syncPath.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}`,
      this.syncPath.replace(/\/idleeyan\//, '/'),
    ];

    for (const path of pathsToTry) {
      try {
        const result = await Promise.race([
          this.sendRequest('PROPFIND', path),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PROPFIND超时')), 5000))
        ]);

        if (result.success) {
          return true;
        }

        // 如果是404，尝试创建目录
        if (result.status === 404) {
          const mkcolResult = await Promise.race([
            this.sendRequest('MKCOL', path),
            new Promise((_, reject) => setTimeout(() => reject(new Error('MKCOL超时')), 5000))
          ]);
          // 405表示方法不允许，有些服务器会自动创建目录，所以不算失败
          if (mkcolResult.success || mkcolResult.status === 405) {
            return true;
          }
        }
      } catch (error) {
        console.log('WebDAV: 目录检查超时', path, error.message);
      }
    }

    // 所有路径都失败，但继续尝试上传（有些服务器不需要显式创建目录）
    return true;
  }

  async uploadData(data) {
    console.log('WebDAV: 开始上传数据');
    const dirResult = await this.ensureDirectory();
    console.log('WebDAV: 目录确保结果', dirResult);

    const syncData = {
      version: '1.0',
      timestamp: Date.now(),
      device: navigator.userAgent,
      data: data
    };

    // 尝试不同的路径格式
    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''), // 移除末尾斜杠
      `/vol1/1000${this.syncPath}${this.filename}`, // 飞牛NAS完整路径
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`, // 移除idleeyan
    ];

    for (const filePath of pathsToTry) {
      console.log('WebDAV: 尝试上传文件到', filePath);

      try {
        // 先尝试PUT
        let result = await Promise.race([
          this.sendRequest('PUT', filePath, syncData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PUT请求超时')), 10000))
        ]);
        console.log('WebDAV: PUT结果', result);

        if (result.success) {
          return true;
        }

        // PUT失败，尝试POST
        if (result.status === 403 || result.status === 405) {
          console.log('WebDAV: PUT失败，尝试POST');
          result = await Promise.race([
            this.sendRequest('POST', filePath, syncData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('POST请求超时')), 10000))
          ]);
          console.log('WebDAV: POST结果', result);

          if (result.success) {
            return true;
          }
        }
      } catch (error) {
        console.log('WebDAV: 上传请求失败或超时', filePath, error.message);
      }
    }

    console.log('WebDAV: 所有路径都上传失败');
    return false;
  }

  async downloadData() {
    // 尝试不同的路径格式
    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}${this.filename}`,
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
    ];

    for (const filePath of pathsToTry) {
      console.log('WebDAV: 尝试下载文件从', filePath);
      try {
        const result = await Promise.race([
          this.sendRequest('GET', filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET请求超时')), 10000))
        ]);
        console.log('WebDAV: 下载结果', result);

        if (result.success) {
          try {
            const syncData = JSON.parse(result.data);
            return {
              success: true,
              data: syncData.data,
              timestamp: syncData.timestamp,
              version: syncData.version
            };
          } catch (error) {
            return { success: false, error: '解析数据失败: ' + error.message };
          }
        }
      } catch (error) {
        console.log('WebDAV: 下载请求失败或超时', filePath, error.message);
      }
    }

    return { success: false, error: '服务器上没有同步数据' };
  }

  async getLastSyncInfo() {
    // 尝试不同的路径格式
    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}${this.filename}`,
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
    ];

    for (const filePath of pathsToTry) {
      try {
        const result = await Promise.race([
          this.sendRequest('HEAD', filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('HEAD请求超时')), 5000))
        ]);

        if (result.success) {
          const lastModified = result.headers['last-modified'];
          const contentLength = result.headers['content-length'];

          return {
            lastModified: lastModified ? new Date(lastModified).getTime() : null,
            size: contentLength ? parseInt(contentLength) : 0
          };
        }
      } catch (error) {
        console.log('WebDAV: HEAD请求失败或超时', filePath, error.message);
      }
    }

    return null;
  }
}

export class DataMerger {
  static mergeBookmarks(localBookmarks, serverBookmarks, localDeleted = [], serverDeleted = []) {
    const merged = [];
    const urlMap = new Map();
    const deletedUrls = new Set();

    const allDeleted = [...(localDeleted || []), ...(serverDeleted || [])];
    allDeleted.forEach(item => {
      if (item.url) deletedUrls.add(item.url);
    });

    const allBookmarks = [...(localBookmarks || []), ...(serverBookmarks || [])];

    allBookmarks.forEach(bookmark => {
      if (!bookmark || !bookmark.url) return;

      if (deletedUrls.has(bookmark.url)) {
        const localDeletedTime = localDeleted.find(d => d.url === bookmark.url)?.deletedAt || 0;
        const serverDeletedTime = serverDeleted.find(d => d.url === bookmark.url)?.deletedAt || 0;
        const bookmarkTime = bookmark.lastModify || bookmark.lastVisit || 0;

        if (bookmarkTime > Math.max(localDeletedTime, serverDeletedTime)) {
          deletedUrls.delete(bookmark.url);
        } else {
          return;
        }
      }

      const existing = urlMap.get(bookmark.url);
      if (existing) {
        const existingTime = existing.lastModify || existing.lastVisit || 0;
        const bookmarkTime = bookmark.lastModify || bookmark.lastVisit || 0;

        if (bookmarkTime > existingTime) {
          const mergedBookmark = { ...bookmark };
          mergedBookmark.visitCount = Math.max(existing.visitCount || 0, bookmark.visitCount || 0);
          urlMap.set(bookmark.url, mergedBookmark);
        } else {
          const mergedBookmark = { ...existing };
          mergedBookmark.visitCount = Math.max(existing.visitCount || 0, bookmark.visitCount || 0);
          urlMap.set(bookmark.url, mergedBookmark);
        }
      } else {
        urlMap.set(bookmark.url, { ...bookmark });
      }
    });

    urlMap.forEach(bookmark => merged.push(bookmark));

    merged.sort((a, b) => (a.index || 0) - (b.index || 0));

    merged.forEach((bookmark, index) => {
      bookmark.index = index;
    });

    return merged;
  }

  static mergeSettings(localSettings, serverSettings) {
    const merged = {};

    const settingsKeys = ['bookmarkCardSize', 'bookmarkCardShape', 'bookmarkSortBy'];

    settingsKeys.forEach(key => {
      const localValue = localSettings[key];
      const serverValue = serverSettings[key];

      if (localValue !== undefined && serverValue !== undefined) {
        if (localValue !== serverValue) {
          merged[key] = serverValue;
        } else {
          merged[key] = localValue;
        }
      } else if (localValue !== undefined) {
        merged[key] = localValue;
      } else if (serverValue !== undefined) {
        merged[key] = serverValue;
      }
    });

    return merged;
  }

  static mergeDeletedList(localDeleted, serverDeleted) {
    const merged = [];
    const urlMap = new Map();

    const allDeleted = [...(localDeleted || []), ...(serverDeleted || [])];

    allDeleted.forEach(item => {
      if (!item || !item.url) return;

      const existing = urlMap.get(item.url);
      if (existing) {
        if (item.deletedAt > existing.deletedAt) {
          urlMap.set(item.url, { ...item });
        }
      } else {
        urlMap.set(item.url, { ...item });
      }
    });

    urlMap.forEach(item => merged.push(item));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return merged.filter(item => item.deletedAt > thirtyDaysAgo);
  }

  static hasDataChanged(localData, mergedData) {
    const localBookmarks = localData.customBookmarks || [];
    const mergedBookmarks = mergedData.customBookmarks || [];

    if (localBookmarks.length !== mergedBookmarks.length) {
      return true;
    }

    const localUrls = new Set(localBookmarks.map(b => b.url));
    const mergedUrls = new Set(mergedBookmarks.map(b => b.url));

    if (localUrls.size !== mergedUrls.size) {
      return true;
    }

    for (const url of localUrls) {
      if (!mergedUrls.has(url)) {
        return true;
      }
    }

    for (const bookmark of localBookmarks) {
      const mergedBookmark = mergedBookmarks.find(b => b.url === bookmark.url);
      if (!mergedBookmark) {
        return true;
      }

      if (bookmark.name !== mergedBookmark.name ||
          bookmark.icon !== mergedBookmark.icon ||
          (bookmark.visitCount || 0) !== (mergedBookmark.visitCount || 0)) {
        return true;
      }
    }

    const localDeleted = localData.deletedBookmarks || [];
    const mergedDeleted = mergedData.deletedBookmarks || [];
    if (localDeleted.length !== mergedDeleted.length) {
      return true;
    }

    const settingsKeys = ['bookmarkCardSize', 'bookmarkCardShape', 'bookmarkSortBy'];
    for (const key of settingsKeys) {
      if (localData[key] !== mergedData[key]) {
        return true;
      }
    }

    return false;
  }
}

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
        'deletedBookmarks'
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

      const mergedData = {
        customBookmarks: mergedBookmarks,
        deletedBookmarks: mergedDeleted,
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
        'bookmarkSortBy'
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

      this.lastSyncTime = Date.now();
      this.lastSyncDirection = 'download';
      await chrome.storage.local.set({
        lastWebDAVSync: this.lastSyncTime,
        lastLocalModify: Date.now()
      });

      return {
        success: true,
        timestamp: result.timestamp,
        serverTime: new Date(result.timestamp).toLocaleString(),
        direction: 'download'
      };
    } catch (error) {
      console.error('从云端同步失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getSyncStatus() {
    if (!this.client) {
      return { configured: false };
    }

    const serverInfo = await this.client.getLastSyncInfo();
    const localResult = await chrome.storage.local.get(['lastWebDAVSync', 'lastLocalModify']);
    const lastLocalSync = localResult.lastWebDAVSync || null;
    const lastLocalModify = localResult.lastLocalModify || null;

    return {
      configured: true,
      serverInfo,
      lastLocalSync,
      lastLocalModify,
      serverUrl: this.config.serverUrl,
      lastSyncDirection: this.lastSyncDirection
    };
  }

  async clearConfig() {
    try {
      await chrome.storage.local.remove(['webdavConfig', 'lastWebDAVSync', 'lastLocalModify', 'deletedBookmarks']);
      this.config = null;
      this.client = null;
      this.lastSyncTime = null;
      this.lastSyncDirection = null;
      return true;
    } catch (error) {
      console.error('清除WebDAV配置失败:', error);
      return false;
    }
  }
}

export class AutoSyncManager {
  constructor(webdavSyncManager) {
    this.webdavManager = webdavSyncManager;
    this.syncInterval = null;
    this.isSyncing = false;
    this.config = {
      enabled: false,
      interval: 30,
      syncOnStart: false,
      lastSyncTime: null
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
      return true;
    } catch (error) {
      console.error('保存自动同步配置失败:', error);
      return false;
    }
  }

  start() {
    this.stop();

    if (!this.config.enabled) {
      console.log('自动同步未启用');
      return false;
    }

    const intervalMs = this.config.interval * 60 * 1000;
    console.log(`启动自动同步，间隔: ${this.config.interval}分钟`);

    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, intervalMs);

    return true;
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('自动同步已停止');
    }
  }

  async performSync() {
    if (!this.webdavManager.client) {
      console.log('WebDAV未配置，跳过自动同步');
      return { success: false, error: 'WebDAV未配置' };
    }

    // 避免并发同步
    if (this.isSyncing) return { success: false, error: '同步已在进行中' };
    this.isSyncing = true;

    try {
      console.log('执行自动同步...');

      // 简单的重试机制
      let result;
      for (let i = 0; i < 3; i++) {
        try {
          result = await this.webdavManager.smartSync();
          if (result.success) break;
          // 如果是网络错误，等待后重试
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        } catch (e) {
          console.error(`同步尝试 ${i+1} 失败:`, e);
          if (i === 2) result = { success: false, error: e.message };
        }
      }

      if (result && result.success) {
        this.config.lastSyncTime = Date.now();
        await this.saveConfig(this.config);
        console.log('自动同步成功:', result.direction || result.message);
      } else {
        console.error('自动同步失败:', result ? result.error : '未知错误');
      }
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  async syncOnStartIfEnabled() {
    if (this.config.syncOnStart && this.config.enabled) {
      console.log('启动时同步已启用，执行同步...');
      return await this.performSync();
    }
    return { success: false, skipped: true };
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      interval: this.config.interval,
      syncOnStart: this.config.syncOnStart,
      lastSyncTime: this.config.lastSyncTime,
      isRunning: this.syncInterval !== null
    };
  }
}
