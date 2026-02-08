// 修复统计字段的脚本
async function fixBookmarkStats() {
  try {
    console.log('开始修复书签统计字段...');
    
    const result = await chrome.storage.local.get('customBookmarks');
    let bookmarks = result.customBookmarks || [];
    
    // 修复每个书签
    bookmarks = bookmarks.map(bookmark => {
      // 确保基本字段存在
      if (bookmark.visitCount === undefined) bookmark.visitCount = 0;
      if (bookmark.lastVisit === undefined) bookmark.lastVisit = 0;
      if (bookmark.firstVisit === undefined) bookmark.firstVisit = 0;
      
      // 确保统计对象存在
      if (!bookmark.visitHistory) bookmark.visitHistory = [];
      if (!bookmark.dailyStats) bookmark.dailyStats = {};
      if (!bookmark.timeOfDayStats) {
        bookmark.timeOfDayStats = { 
          morning: { count: 0, avgDuration: 0 }, 
          afternoon: { count: 0, avgDuration: 0 }, 
          evening: { count: 0, avgDuration: 0 } 
        };
      }
      
      return bookmark;
    });
    
    // 保存修复后的数据
    await chrome.storage.local.set({ customBookmarks: bookmarks });
    console.log('书签统计字段修复完成！');
    
    // 重新初始化书签管理器
    if (window.bookmarksManager) {
      window.bookmarksManager.bookmarks = [...bookmarks];
      window.bookmarksManager.customBookmarks = [...bookmarks];
      window.bookmarksManager.renderBookmarks();
    }
    
  } catch (error) {
    console.error('修复失败:', error);
  }
}

// 自动执行修复
fixBookmarkStats();