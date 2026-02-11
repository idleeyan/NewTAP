export class StatsRenderer {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
  }

  render() {
    const bookmarks = this.bookmarkManager.getAllBookmarks();
    console.log('渲染统计页面，书签数量:', bookmarks.length);
    console.log('书签数据:', bookmarks.map(b => ({ name: b.name, visitCount: b.visitCount })));

    const sorted = [...bookmarks].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));

    const totalVisitsCount = sorted.reduce((sum, b) => sum + (b.visitCount || 0), 0);
    console.log('总访问次数:', totalVisitsCount);

    const totalVisits = document.getElementById('totalVisitsPage');
    const totalBookmarks = document.getElementById('totalBookmarksPage');
    const mostVisited = document.getElementById('mostVisitedPage');

    if (totalVisits) totalVisits.textContent = totalVisitsCount.toLocaleString();
    if (totalBookmarks) totalBookmarks.textContent = bookmarks.length;

    if (mostVisited) {
      mostVisited.textContent = sorted[0]?.name || '-';
    }

    const list = document.getElementById('statsListPage');
    if (!list) return;

    if (sorted.length === 0) {
      list.innerHTML = `
        <div class="empty-notes" style="grid-column: 1 / -1;">
          <div class="empty-notes-icon">📊</div>
          <p>暂无统计数据</p>
        </div>
      `;
      return;
    }

    list.innerHTML = sorted.map(bookmark => `
      <div class="stats-item" data-url="${this.escapeHtml(bookmark.url)}" title="点击访问 ${this.escapeHtml(bookmark.name)}">
        <img src="${bookmark.icon || `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`}"
             alt="${bookmark.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>🌐</text></svg>'">
        <div class="stats-item-info">
          <div class="stats-item-name">${this.escapeHtml(bookmark.name)}</div>
          <div class="stats-item-url">${bookmark.url}</div>
        </div>
        <div class="stats-item-count">
          <span class="number">${bookmark.visitCount || 0}</span>
          <span class="label">次访问</span>
        </div>
      </div>
    `).join('');

    this.setupClickHandlers(list);
  }

  setupClickHandlers(list) {
    list.querySelectorAll('.stats-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          window.open(url, '_blank');
        }
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
