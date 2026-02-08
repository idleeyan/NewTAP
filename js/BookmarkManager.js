
export class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.customBookmarks = [];
    this.defaultBookmarks = [
      {
        name: 'Google',
        url: 'https://www.google.com',
        icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
        index: 0,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '百度',
        url: 'https://www.baidu.com',
        icon: 'https://www.google.com/s2/favicons?domain=baidu.com&sz=64',
        index: 1,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: 'GitHub',
        url: 'https://github.com',
        icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
        index: 2,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: 'YouTube',
        url: 'https://www.youtube.com',
        icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
        index: 3,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '知乎',
        url: 'https://www.zhihu.com',
        icon: 'https://www.google.com/s2/favicons?domain=zhihu.com&sz=64',
        index: 4,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '微博',
        url: 'https://weibo.com',
        icon: 'https://www.google.com/s2/favicons?domain=weibo.com&sz=64',
        index: 5,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '腾讯视频',
        url: 'https://v.qq.com',
        icon: 'https://www.google.com/s2/favicons?domain=v.qq.com&sz=64',
        index: 6,
        visitCount: 0,
        lastVisit: 0
      },
      {
        name: '网易云音乐',
        url: 'https://music.163.com',
        icon: 'https://www.google.com/s2/favicons?domain=music.163.com&sz=64',
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
      throw new Error('Name and URL are required');
    }

    const newBookmark = {
      id: Date.now().toString(),
      name: bookmark.name,
      url: bookmark.url,
      icon: bookmark.icon || `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`,
      index: this.bookmarks.length,
      visitCount: 0,
      lastVisit: Date.now(),
      firstVisit: Date.now()
    };

    this.customBookmarks.push(newBookmark);
    await this.saveBookmarks();
    return newBookmark;
  }

  async updateBookmark(url, updates) {
    const index = this.customBookmarks.findIndex(b => b.url === url);
    if (index !== -1) {
      this.customBookmarks[index] = { ...this.customBookmarks[index], ...updates };
      await this.saveBookmarks();
      return true;
    }
    return false;
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
