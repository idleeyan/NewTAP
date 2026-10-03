import { iconCache } from './IconCache.js';
import { iconLibrary } from './IconLibrary.js';

export class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.customBookmarks = [];
    this.defaultBookmarks = [
      {
        name: 'Google',
        url: 'https://www.google.com',
        icon: 'images/logos/google.svg',
        index: 0,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '百度',
        url: 'https://www.baidu.com',
        icon: 'images/logos/baidu.svg',
        index: 1,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: 'GitHub',
        url: 'https://github.com',
        icon: 'images/logos/github.svg',
        index: 2,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: 'YouTube',
        url: 'https://www.youtube.com',
        icon: 'images/logos/youtube.svg',
        index: 3,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '知乎',
        url: 'https://www.zhihu.com',
        icon: 'images/logos/zhihu.svg',
        index: 4,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '微博',
        url: 'https://weibo.com',
        icon: 'images/logos/weibo.svg',
        index: 5,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '腾讯视频',
        url: 'https://v.qq.com',
        icon: 'images/logos/vqq.svg',
        index: 6,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '网易云音乐',
        url: 'https://music.163.com',
        icon: 'images/logos/netease-music.svg',
        index: 7,
        visitCount: 0,
        lastVisit: 0
      }
    ];
  }

  async loadBookmarks() {
    try {
      const result = await chrome.storage.local.get('customBookmarks');
      this.customBookmarks = result.customBookmarks || [];

      // If no custom bookmarks, maybe load defaults or just empty
      // In original code: this.bookmarks = [...this.customBookmarks];
      // But if customBookmarks was empty/undefined initially?
      // Original code had defaultBookmarks but seemingly only used them if loading failed?
      // Actually original code: this.customBookmarks = result.customBookmarks || []; this.bookmarks = [...this.customBookmarks];
      // And in catch: this.bookmarks = [...this.defaultBookmarks];

      if (this.customBookmarks.length === 0 && !result.customBookmarks) {
           // First run? Or just empty.
           // Let's keep original behavior: if load fails (catch), use defaults.
           // If load succeeds but is empty, it's empty.
           // But wait, original code:
           // try { ... } catch { this.bookmarks = [...this.defaultBookmarks]; }
           // So if storage has no data (returns undefined), it's empty array.
           // Only if chrome.storage fails (error) it uses defaults.
           // However, for a better UX on first load, we might want defaults if empty.
           // Let's stick to simple loading for now.
      }
      this.bookmarks = [...this.customBookmarks];

      // Check if we should initialize with defaults if absolutely empty on first run?
      // We'll leave it empty if user deleted everything.

    } catch (error) {
      console.error('加载书签失败:', error);
      this.bookmarks = [...this.defaultBookmarks];
      // Save defaults so we have them next time?
      this.customBookmarks = [...this.defaultBookmarks];
      await this.saveBookmarks();
    }
    return this.bookmarks;
  }

  async saveBookmarks() {
    try {
      await chrome.storage.local.set({
        customBookmarks: this.customBookmarks,
        lastLocalModify: Date.now()
      });
      this.bookmarks = [...this.customBookmarks];
      return true;
    } catch (error) {
      console.error('保存书签失败:', error);
      return false;
    }
  }

  async addBookmark(bookmark) {
    // Validate
    if (!bookmark.name || !bookmark.url) {
      throw new Error('名称和网址不能为空');
    }

    // Normalize URL - add https:// if no protocol prefix
    let normalizedUrl = bookmark.url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Parse hostname safely
    let hostname;
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch (e) {
      throw new Error('网址格式无效，请检查后重试');
    }

    // 图标：优先用图库里为常用网站设计的预设 LOGO（离线、统一、好看），
    // 用户自带图标（data URI 或指定图片）一律保留，不被覆盖
    let icon = bookmark.icon || `https://${hostname}/favicon.ico`;
    if (this.isDefaultFavicon(icon)) {
      const preset = iconLibrary.matchByUrl(normalizedUrl);
      if (preset) icon = preset.file;
    }

    const newBookmark = {
      id: Date.now().toString(),
      name: bookmark.name,
      url: normalizedUrl,
      icon,
      index: this.bookmarks.length,
      visitCount: 0,
      lastVisit: Date.now(),
      firstVisit: Date.now()
    };

    this.customBookmarks.push(newBookmark);
    const saved = await this.saveBookmarks();
    if (!saved) {
      // Rollback on failure
      this.customBookmarks.pop();
      throw new Error('保存失败，请重试');
    }
    return newBookmark;
  }

  async updateBookmark(url, updates) {
    const index = this.customBookmarks.findIndex(b => b.url === url);
    if (index !== -1) {
      // 用户显式更换图标：清掉旧图标与新图标的本地缓存，避免沿用错误/旧数据
      if (updates.icon && updates.icon !== this.customBookmarks[index].icon) {
        iconCache.invalidate(this.customBookmarks[index].icon);
        iconCache.invalidate(updates.icon);
      }
      // 更换图标（或任意更新）时刷新 lastModify，确保合并同步时本机版本胜出，
      // 避免云端旧版本把用户新选的 data URI logo 覆盖掉
      this.customBookmarks[index] = { ...this.customBookmarks[index], ...updates, lastModify: Date.now() };
      await this.saveBookmarks();
      return true;
    }
    return false;
  }

  /**
   * 判断是不是「系统默认图标」：站点 favicon.ico 或 Google favicon 服务。
   * 这类图标在国内常常拉不到，可以安全替换成图库预设 LOGO。
   */
  isDefaultFavicon(icon) {
    if (!icon) return true;
    return /\/favicon\.ico(\?|$)/i.test(icon) ||
           /s2\/favicons|gstatic\.com\/faviconV2/i.test(icon);
  }

  /**
   * 批量为已有书签套用图库预设 LOGO（只替换默认 favicon，不动用户自定义图标）
   * @returns {Promise<number>} 被替换的书签数量
   */
  async applyPresetIcons() {
    let count = 0;
    for (const b of this.customBookmarks) {
      if (b.icon && b.icon.startsWith('data:')) continue;
      const preset = iconLibrary.matchByUrl(b.url);
      if (!preset || b.icon === preset.file) continue;
      iconCache.invalidate(b.icon);
      b.icon = preset.file;
      b.lastModify = Date.now();
      count++;
    }
    if (count > 0) await this.saveBookmarks();
    return count;
  }

  async deleteBookmark(url) {
    const index = this.customBookmarks.findIndex(b => b.url === url);
    if (index === -1) return false;

    const deletedBookmark = this.customBookmarks[index];
    this.customBookmarks.splice(index, 1);

    // Track deleted for sync
    try {
      const result = await chrome.storage.local.get('deletedBookmarks');
      const deletedBookmarks = result.deletedBookmarks || [];
      deletedBookmarks.push({
        url: deletedBookmark.url,
        name: deletedBookmark.name,
        deletedAt: Date.now()
      });
      await chrome.storage.local.set({ deletedBookmarks });
    } catch (e) {
      console.error('Failed to track deleted bookmark', e);
    }

    await this.saveBookmarks();
    return true;
  }

  async reorderBookmarks(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.customBookmarks.length ||
        toIndex < 0 || toIndex >= this.customBookmarks.length) {
      return false;
    }

    const [movedItem] = this.customBookmarks.splice(fromIndex, 1);
    this.customBookmarks.splice(toIndex, 0, movedItem);

    // Update indices property if used
    this.customBookmarks.forEach((b, i) => b.index = i);

    await this.saveBookmarks();
    return true;
  }

  // Import/Export helpers
  async getBrowserHistory() {
    if (!chrome.history || !chrome.history.search) return [];

    try {
      const result = await chrome.history.search({ text: '', maxResults: 100 });
      const domainMap = new Map();

      result.forEach(item => {
        if (!item.lastVisitTime || !item.url) return;
        try {
          const url = new URL(item.url);
          const domain = url.hostname;
           if (domain.includes('chrome://') || domain.includes('chrome-extension://') || domain.includes('localhost') || domain === '') return;

           if (!domainMap.has(domain)) {
             domainMap.set(domain, {
               name: domain.replace(/^www\./, ''),
               url: item.url,
               icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
               visitCount: 1,
               lastVisit: item.lastVisitTime
             });
           } else {
             const entry = domainMap.get(domain);
             entry.visitCount++;
             if (item.lastVisitTime > entry.lastVisit) {
               entry.url = item.url;
               entry.lastVisit = item.lastVisitTime;
             }
           }
        } catch(e) {}
      });

      return Array.from(domainMap.values()).sort((a, b) => b.visitCount - a.visitCount);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async getBrowserBookmarks() {
    if (!chrome.bookmarks) return [];
    try {
      const tree = await chrome.bookmarks.getTree();
      const bookmarks = [];
      const traverse = (nodes) => {
        nodes.forEach(node => {
          if (node.url) {
            try {
              const url = new URL(node.url);
              bookmarks.push({
                id: node.id,
                name: node.title || url.hostname,
                url: node.url,
                icon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
              });
            } catch (e) {}
          }
          if (node.children) traverse(node.children);
        });
      };
      traverse(tree);
      return bookmarks;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async getOpenTabs() {
    if (!chrome.tabs) return [];
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.filter(t => t.url && t.url.startsWith('http')).map(t => {
         const url = new URL(t.url);
         return {
           id: t.id,
           name: t.title || url.hostname,
           url: t.url,
           icon: t.favIconUrl || `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
         };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  getAllBookmarks() {
    return this.bookmarks || [];
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get(null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    }
  }
}
