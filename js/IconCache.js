/**
 * IconCache - 基于 chrome.storage.local 的图标本地持久化缓存
 *
 * 解决问题：每次打开新标签页都从 Google favicon 服务重新拉取图标，
 * 在国内网络环境下 Google 服务缓慢/不可达，导致图标长时间不显示、每次都走在线。
 *
 * 方案：
 * 1. 首次成功拉取图标后，将其转为 data URI 持久化到 chrome.storage.local（扩展本地存储，离线可用）。
 * 2. 之后每次打开新标签页，直接从本地读取 data URI，零网络请求、即时显示。
 * 3. 拉取源优先使用站点自身的 /favicon.ico（国内可达、速度快），Google 服务仅作最后兜底。
 * 4. 一旦缓存，永不过期（不再每次回源），彻底消除“每次读取在线图片”的慢。
 * 5. 兼容旧版 IndexedDB 缓存：首次启动自动迁移到 chrome.storage.local，避免重复拉取。
 */

const LS_KEY = 'iconDataStore';          // chrome.storage.local 中的持久化缓存对象
const MIGRATED_FLAG = 'iconCacheMigrated'; // 旧版 IndexedDB 是否已迁移标记
const FETCH_TIMEOUT = 8000;              // 单个图标拉取超时 8s

// 旧版 IndexedDB 配置（仅用于一次性迁移）
const DB_NAME = 'NewTapIconCache';
const DB_VERSION = 1;
const STORE_NAME = 'icons';

class IconCache {
  constructor() {
    /** @type {Map<string, string>} url -> dataUri 内存缓存（同步读取，渲染路径） */
    this._memoryCache = new Map();
    this._preloading = false;
    this._saveTimer = null;
    this._dbPromise = null;
    this._migratePromise = null;
  }

  /** 初始化缓存：从 chrome.storage.local 加载持久化数据到内存（同步读取路径） */
  async init() {
    try {
      const res = await chrome.storage.local.get(LS_KEY);
      const store = res[LS_KEY];
      if (store && typeof store === 'object') {
        for (const [url, dataUri] of Object.entries(store)) {
          if (dataUri && typeof dataUri === 'string' && dataUri.startsWith('data:')) {
            this._memoryCache.set(url, dataUri);
          }
        }
      }
    } catch (e) {
      console.warn('[IconCache] 加载本地缓存失败，降级为直连模式', e);
    }
    // 旧版 IndexedDB 迁移放到后台，绝不阻塞首屏
    this._migratePromise = this._migrateFromIndexedDB();
  }

  /** 一次性把旧版 IndexedDB 缓存迁移到 chrome.storage.local */
  async _migrateFromIndexedDB() {
    try {
      const flag = await chrome.storage.local.get(MIGRATED_FLAG);
      if (flag[MIGRATED_FLAG]) return;

      const db = await this._openDB();
      if (!db) {
        await chrome.storage.local.set({ [MIGRATED_FLAG]: true });
        return;
      }

      // 用游标精确遍历（key + value）
      const entries = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const out = [];
        const req = tx.objectStore(STORE_NAME).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            out.push([cursor.key, cursor.value]);
            cursor.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = () => reject(req.error);
      });

      let migrated = 0;
      for (const [url, value] of entries) {
        const dataUri = value && value.dataUri;
        if (url && dataUri && dataUri.startsWith('data:') && !this._memoryCache.has(url)) {
          this._memoryCache.set(url, dataUri);
          migrated++;
        }
      }

      if (migrated > 0) this._scheduleSave();
      await chrome.storage.local.set({ [MIGRATED_FLAG]: true });
      if (migrated > 0) console.info(`[IconCache] 已从旧版 IndexedDB 迁移 ${migrated} 个图标到本地存储`);
    } catch {
      // IndexedDB 不存在或迁移失败都不影响新缓存工作
    }
  }

  /** 打开旧版 IndexedDB（仅迁移用，带超时，避免冷启动卡死） */
  _openDB(timeoutMs = 2000) {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('[IconCache] IndexedDB 打开超时，跳过旧缓存迁移');
          resolve(null);
        }
      }, timeoutMs);

      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        clearTimeout(timer);
        settled = true;
        resolve(null);
        return;
      }

      req.onupgradeneeded = () => {
        // 库不存在时 open 会创建空库；取消升级避免无意义创建
        try { req.transaction.abort(); } catch { /* ignore */ }
      };
      req.onsuccess = () => {
        if (settled) {
          try { req.result.close(); } catch { /* ignore */ }
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(req.result);
      };
      req.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      req.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
    });
    // 避免未处理的 rejection 噪音
    this._dbPromise.catch(() => {});
    return this._dbPromise;
  }

  /**
   * 同步读取内存缓存（渲染时调用，无延迟）
   * @returns {string|null} dataUri 或 null
   */
  getFromMemory(url) {
    if (!url) return null;
    if (url.startsWith('data:')) return url; // 已是 data URI，直接用
    return this._memoryCache.get(url) || null;
  }

  /**
   * 批量确保内存缓存已就绪。
   * 内存已在 init 时从 chrome.storage.local 载入；旧版 IndexedDB 由后台迁移负责。
   * 这里只做轻量等待（迁移完成），绝不打开/阻塞 IndexedDB，避免拖慢首屏。
   */
  async populateCache(urls) {
    if (this._migratePromise) {
      await Promise.race([
        this._migratePromise,
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
    // 迁移完成后内存缓存已是最新的；未命中项留给后台 preload 拉取
    return;
  }

  /** 写入旧版 IndexedDB（兜底持久层，可选） */
  async _setInDB(url, dataUri) {
    try {
      const db = await this._dbPromise;
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ dataUri, ts: Date.now() }, url);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* 兜底层失败不影响主缓存 */ }
  }

  /** 持久化内存缓存到 chrome.storage.local（防抖批量写入） */
  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      const store = {};
      for (const [url, dataUri] of this._memoryCache.entries()) {
        store[url] = dataUri;
      }
      chrome.storage.local.set({ [LS_KEY]: store }).catch(e => {
        console.warn('[IconCache] 写入本地存储失败', e);
      });
    }, 600);
  }

  /**
   * 尝试从给定 URL 拉取图标并转为 data URI
   * 失败返回 null（不抛异常）
   */
  async _tryFetch(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const response = await fetch(url, {
        signal: controller.signal,
        referrerPolicy: 'no-referrer'
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  /**
   * 从原始图标 URL 中提取域名，用于构造 fallback 源
   */
  _extractDomain(iconUrl, bookmarkUrl) {
    try {
      if (bookmarkUrl) return new URL(bookmarkUrl).hostname;
      const m = iconUrl.match(/[?&]domain=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
      return new URL(iconUrl).hostname;
    } catch {
      return null;
    }
  }

  /**
   * 构造回源列表：
   * - 自动生成的 favicon 服务 URL（Google s2 / gstatic）：优先抓站点自身 /favicon.ico 提速，Google 兜底。
   * - 用户显式选择的图片 URL（如搜索结果缩略图）：直接抓该 URL，尊重用户选择；
   *   仅当抓取失败才回退到站点自身 favicon.ico，绝不用搜索引警的 favicon 反客为主。
   */
  _buildSources(iconUrl, bookmarkUrl) {
    const sources = [];
    if (!iconUrl || iconUrl.startsWith('data:')) return sources;

    const domain = this._extractDomain(iconUrl, bookmarkUrl);
    // 旧版 Google s2 / gstatic 图标服务在国内常不可达，统一回退到站点自身 favicon.ico
    const isLegacyService = /google\.(com|cn)\/s2\/favicons|gstatic\.com\/faviconV2/.test(iconUrl);

    if (isLegacyService) {
      if (domain) sources.push(`https://${domain}/favicon.ico`);
      return sources;
    }

    // 站点自身 favicon / 用户显式图片 URL：直接抓取（尊重原选择）
    sources.push(iconUrl);
    if (domain) sources.push(`https://${domain}/favicon.ico`);

    return sources;
  }

  /**
   * 使某个图标的本地缓存失效（用户显式更换图标时调用）。
   * 因为缓存已去掉 TTL、永久保存，用户重新选择后必须清掉旧/错误的缓存，
   * 否则会一直沿用上次回源得到的结果（可能并非用户所选）。
   */
  invalidate(url) {
    if (!url || url.startsWith('data:')) return;
    if (this._memoryCache.delete(url)) {
      this._scheduleSave(); // 持久化移除
    }
  }

  /**
   * 拉取并缓存单个图标（带 fallback 链），永久保存、永不过期
   * @returns {Promise<string|null>} dataUri 或 null
   */
  async fetchAndCache(iconUrl, bookmarkUrl) {
    if (!iconUrl || iconUrl.startsWith('data:')) return iconUrl || null;
    if (this._memoryCache.has(iconUrl)) return this._memoryCache.get(iconUrl);

    const sources = this._buildSources(iconUrl, bookmarkUrl);
    for (const source of sources) {
      const dataUri = await this._tryFetch(source);
      if (dataUri) {
        this._memoryCache.set(iconUrl, dataUri);
        this._setInDB(iconUrl, dataUri);   // 兜底层
        this._scheduleSave();              // 主持久层：chrome.storage.local
        return dataUri;
      }
    }
    return null;
  }

  /**
   * 批量预加载未缓存的图标（渲染后后台调用）
   * @returns {Promise<boolean>} 是否有新图标被缓存（需要重新渲染）
   */
  async preloadBatch(items) {
    if (this._preloading) return false;
    this._preloading = true;

    try {
      const todo = [];
      const seen = new Set();
      for (const item of items) {
        const url = item?.icon;
        if (!url || url.startsWith('data:')) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        if (!this._memoryCache.has(url)) {
          todo.push(item);
        }
      }

      if (todo.length === 0) return false;

      let newlyCached = false;
      await Promise.all(todo.map(async (item) => {
        const result = await this.fetchAndCache(item.icon, item.url);
        if (result) newlyCached = true;
      }));

      return newlyCached;
    } finally {
      this._preloading = false;
    }
  }
}

// 单例导出
export const iconCache = new IconCache();
