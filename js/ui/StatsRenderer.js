export class StatsRenderer {
  constructor(bookmarkManager) {
    this.bookmarkManager = bookmarkManager;
    this._lastRenderKey = '';
    this._elements = null;
    this._clickHandlerAttached = false;
    this._hostnameCache = new Map();
  }

  _getElements() {
    if (!this._elements) {
      this._elements = {
        totalVisits: document.getElementById('totalVisitsPage'),
        totalBookmarks: document.getElementById('totalBookmarksPage'),
        mostVisited: document.getElementById('mostVisitedPage'),
        list: document.getElementById('statsListPage')
      };
    }
    return this._elements;
  }

  _buildRenderKey() {
    const bookmarks = this.bookmarkManager.getAllBookmarks();
    let dataHash = '';
    for (const b of bookmarks) {
      dataHash += `${b.url}|${b.visitCount || 0}|${b.name};`;
    }
    return `${bookmarks.length}|${dataHash}`;
  }

  _getHostname(url) {
    if (!url) return '';
    const cached = this._hostnameCache.get(url);
    if (cached !== undefined) return cached;
    try {
      const hostname = new URL(url).hostname;
      this._hostnameCache.set(url, hostname);
      return hostname;
    } catch {
      this._hostnameCache.set(url, '');
      return '';
    }
  }

  render() {
    const renderKey = this._buildRenderKey();
    if (renderKey === this._lastRenderKey) return;

    requestAnimationFrame(() => {
      // Re-check after rAF in case data changed during frame
      const currentKey = this._buildRenderKey();
      if (currentKey === this._lastRenderKey) return;
      this._lastRenderKey = currentKey;
      this._doRender();
    });
  }

  _doRender() {
    const els = this._getElements();
    const bookmarks = this.bookmarkManager.getAllBookmarks();
    const sorted = [...bookmarks].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
    const totalVisitsCount = sorted.reduce((sum, b) => sum + (b.visitCount || 0), 0);

    if (els.totalVisits) els.totalVisits.textContent = totalVisitsCount.toLocaleString();
    if (els.totalBookmarks) els.totalBookmarks.textContent = bookmarks.length;
    if (els.mostVisited) els.mostVisited.textContent = sorted[0]?.name || '-';

    if (!els.list) return;

    if (sorted.length === 0) {
      els.list.innerHTML = `
        <div class="empty-notes" style="grid-column: 1 / -1;">
          <div class="empty-notes-icon">📊</div>
          <p>暂无统计数据</p>
        </div>
      `;
      // list（#statsListPage）为持久元素，监听一次委托绑定即可；此处不重置标志，
      // 否则统计从空变有后 _setupClickHandlers 会重复绑定（点击一次打开多个标签页）
      return;
    }

    const fragment = document.createDocumentFragment();
    sorted.forEach(bookmark => {
      const item = document.createElement('div');
      item.className = 'stats-item';
      item.dataset.url = bookmark.url;
      item.title = `点击访问 ${bookmark.name}`;

      const hostname = this._getHostname(bookmark.url);
      const iconUrl = bookmark.icon || (hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` : '');
      const fallbackIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='18' font-size='18'%3E🌐%3C/text%3E%3C/svg%3E";

      item.innerHTML = `
        <img src="${iconUrl}" alt="${this.escapeHtml(bookmark.name)}" loading="lazy"
             onerror="this.src='${fallbackIcon}'">
        <div class="stats-item-info">
          <div class="stats-item-name">${this.escapeHtml(bookmark.name)}</div>
          <div class="stats-item-url">${this.escapeHtml(bookmark.url)}</div>
        </div>
        <div class="stats-item-count">
          <span class="number">${bookmark.visitCount || 0}</span>
          <span class="label">次访问</span>
        </div>
      `;
      fragment.appendChild(item);
    });

    els.list.innerHTML = '';
    els.list.appendChild(fragment);

    this._setupClickHandlers(els.list);
  }

  _setupClickHandlers(list) {
    if (this._clickHandlerAttached) return;
    this._clickHandlerAttached = true;

    list.addEventListener('click', (e) => {
      const item = e.target.closest('.stats-item');
      if (!item) return;
      const url = item.dataset.url;
      if (url) window.open(url, '_blank');
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
