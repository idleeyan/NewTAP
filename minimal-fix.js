// 最小化修复：确保统计字段安全访问
(function() {
  const originalRenderBookmarks = BookmarksManager.prototype.renderBookmarks;
  
  BookmarksManager.prototype.renderBookmarks = function() {
    // 确保所有书签都有必要的统计字段
    this.bookmarks.forEach(bookmark => {
      if (!bookmark.visitHistory) bookmark.visitHistory = [];
      if (!bookmark.dailyStats) bookmark.dailyStats = {};
      if (!bookmark.timeOfDayStats) {
        bookmark.timeOfDayStats = { 
          morning: { count: 0, avgDuration: 0 },
          afternoon: { count: 0, avgDuration: 0 },
          evening: { count: 0, avgDuration: 0 }
        };
      }
    });
    
    // 调用原始方法
    return originalRenderBookmarks.call(this);
  };

  // 修复点击事件中的安全访问
  const originalCreateBookmarkElement = BookmarksManager.prototype.createBookmarkElement;
  if (typeof originalCreateBookmarkElement === 'function') {
    BookmarksManager.prototype.createBookmarkElement = function(bookmark, index, isTopSection) {
      const el = document.createElement('div');
      // ... 原有代码 ...
      
      el.addEventListener('click', async () => {
        try {
          window.open(bookmark.url, '_self');
          
          // 安全初始化
          if (!bookmark.visitCount) bookmark.visitCount = 0;
          if (!bookmark.lastVisit) bookmark.lastVisit = 0;
          if (!bookmark.firstVisit) bookmark.firstVisit = 0;
          
          // 确保统计对象存在
          if (!bookmark.dailyStats) bookmark.dailyStats = {};
          if (!bookmark.timeOfDayStats) {
            bookmark.timeOfDayStats = { 
              morning: { count: 0, avgDuration: 0 },
              afternoon: { count: 0, avgDuration: 0 },
              evening: { count: 0, avgDuration: 0 }
            };
          }
          
          // 安全更新
          const now = Date.now();
          const visitTime = new Date(now);
          const dateKey = visitTime.toISOString().split('T')[0];
          
          bookmark.visitCount++;
          bookmark.lastVisit = now;
          if (!bookmark.firstVisit) bookmark.firstVisit = now;
          
          // 安全更新 dailyStats
          if (!bookmark.dailyStats[dateKey]) {
            bookmark.dailyStats[dateKey] = { count: 0, totalDuration: 0 };
          }
          bookmark.dailyStats[dateKey].count++;
          
          // ... 其他逻辑 ...
          
          await chrome.storage.local.set({
            customBookmarks: this.customBookmarks,
            lastLocalModify: Date.now()
          });
        } catch (e) {
          console.error('统计记录错误:', e);
        }
      });
      
      return el;
    };
  }
})();