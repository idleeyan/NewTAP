import { iconCache } from '../IconCache.js';

export class BookmarkRenderer {
  constructor(bookmarkManager, settingsManager, statsManager) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.statsManager = statsManager;
    this._clockInterval = null;
    this._lastRenderKey = '';
    this._pendingRender = false;
  }

  /**
   * 生成渲染缓存键，用于跳过无变化的重复渲染
   * 必须包含名称与图标内容指纹：仅比较“是否已缓存”会导致换 logo/改名后跳过重绘
   * @private
   */
  _buildRenderKey() {
    const bookmarks = this.bookmarkManager.bookmarks;
    const container = document.querySelector('.bookmarks-section');
    this._lastContainerWidth = container ? container.clientWidth : 0;
    const widthBucket = Math.round(this._lastContainerWidth / 50);
    let dataHash = '';
    for (const b of bookmarks) {
      const icon = b.icon || '';
      // data URI 很长，用长度+尾部做指纹；URL 直接参与
      const iconFp = icon.startsWith('data:')
        ? `d${icon.length}:${icon.slice(-32)}`
        : `u${icon}`;
      const iconResolved = iconCache.getFromMemory(b.icon) ? '1' : '0';
      dataHash += `${b.url}|${b.name || ''}|${iconFp}|${b.visitCount || 0}|${b.lastVisit || 0}|${iconResolved}|${b.index || 0};`;
    }
    return `${bookmarks.length}|${this.settingsManager.cardSize}|${this.settingsManager.cardShape}|${this.settingsManager.sortBy}|${widthBucket}|${dataHash}`;
  }

  /** 强制下次 render 真正重建 DOM（编辑/同步后使用） */
  invalidate() {
    this._lastRenderKey = '';
  }

  render() {
    const renderKey = this._buildRenderKey();
    if (renderKey === this._lastRenderKey) return;

    if (this._pendingRender) return;
    this._pendingRender = true;

    requestAnimationFrame(() => {
      this._pendingRender = false;
      this._lastRenderKey = this._buildRenderKey();
      this._doRender();
    });
  }

  _doRender() {
    const topGrid = document.getElementById('topBookmarksGrid');
    const moreGrid = document.getElementById('moreBookmarksGrid');
    const topCountEl = document.getElementById('topBookmarksCount');
    const moreCountEl = document.getElementById('moreBookmarksCount');
    const moreSection = document.getElementById('moreBookmarksSection');

    if (!topGrid) return;

    topGrid.innerHTML = '';
    if (moreGrid) moreGrid.innerHTML = '';

    const cardSize = this.settingsManager.cardSize;
    const cardShape = this.settingsManager.cardShape;
    const sortBy = this.settingsManager.sortBy;

    topGrid.className = `bookmarks-grid ${cardSize}`;
    if (moreGrid) moreGrid.className = `bookmarks-grid more-grid ${cardSize}`;

    let sortedBookmarks = [...this.bookmarkManager.bookmarks];

    switch (sortBy) {
      case 'name':
        sortedBookmarks.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        break;
      case 'visits':
        sortedBookmarks.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
        break;
      case 'recent':
        sortedBookmarks.sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0));
        break;
      case 'default':
      default:
        sortedBookmarks.sort((a, b) => (a.index || 0) - (b.index || 0));
        break;
    }

    const cardsPerRow = this.calculateCardsPerRow(cardSize, this._lastContainerWidth);
    const topRowCount = 4;
    const topCardsCount = cardsPerRow * topRowCount - 1;

    const topBookmarks = sortedBookmarks.slice(0, topCardsCount);
    const moreBookmarks = sortedBookmarks.slice(topCardsCount);

    if (topCountEl) {
      topCountEl.textContent = `${topBookmarks.length}个网站`;
    }

    if (moreCountEl) {
      moreCountEl.textContent = `${moreBookmarks.length}个网站`;
    }

    if (moreSection) {
      moreSection.style.display = moreBookmarks.length > 0 ? 'block' : 'none';
    }

    const topFragment = document.createDocumentFragment();
    topBookmarks.forEach((bookmark, index) => {
      topFragment.appendChild(this.createBookmarkElement(bookmark, index, true, cardShape));
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'bookmark-wrapper add-bookmark animate-in';
    addBtn.style.animationDelay = `${Math.min(topBookmarks.length, 15) * 0.01}s`;
    addBtn.id = 'compassAddBtn';
    addBtn.innerHTML = `
      <div class="bookmark-card">
        <div class="add-plus" aria-hidden="true">+</div>
        <div class="digital-clock">
          <div class="digital-time" id="digitalTime">00:00</div>
          <div class="digital-date" id="digitalDate">1/1 周一</div>
        </div>
      </div>
      <div class="bookmark-title">添加网站</div>
    `;
    addBtn.querySelector('.bookmark-card').addEventListener('click', () => {
      const dialog = document.getElementById('addBookmarkDialog');
      if (dialog) {
        dialog.classList.add('active');
        document.querySelector('.add-options').style.display = 'grid';
        const manualForm = document.getElementById('manualAddForm');
        if (manualForm) { manualForm.style.display = 'none'; manualForm.reset(); }
      }
    });
    topFragment.appendChild(addBtn);

    topGrid.appendChild(topFragment);

    this._startDigitalClock();

    if (moreGrid && moreBookmarks.length > 0) {
      const moreFragment = document.createDocumentFragment();
      moreBookmarks.forEach((bookmark, index) => {
        moreFragment.appendChild(this.createBookmarkElement(bookmark, index + topCardsCount, false, cardShape, true));
      });
      moreGrid.appendChild(moreFragment);
    }
  }

  createBookmarkElement(bookmark, index, isTopSection, cardShape) {
    const wrapper = document.createElement('div');
    wrapper.className = `bookmark-wrapper animate-in`;
    const delay = Math.min(index, 15) * 0.01;
    wrapper.style.animationDelay = `${delay}s`;

    wrapper.draggable = true;
    wrapper.dataset.index = index;
    wrapper.dataset.url = bookmark.url;

    const card = document.createElement('div');
    card.className = `bookmark-card ${cardShape}`;
    if (bookmark.icon) {
      // 优先使用缓存的 data URI（即时显示），未缓存时回退到原始 URL（网络加载）
      const iconSrc = iconCache.getFromMemory(bookmark.icon) || bookmark.icon;
      card.style.backgroundImage = `url('${iconSrc.replace(/'/g, "\\'")}')`;
    }

    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.name;

    wrapper.appendChild(card);
    wrapper.appendChild(title);

    card.addEventListener('click', () => {
      // 先跳转，确保用户操作即时响应；统计与保存在后台异步执行
      window.open(bookmark.url, '_self');
      const originalBookmark = this.bookmarkManager.customBookmarks.find(b => b.url === bookmark.url);
      if (originalBookmark) {
        this.statsManager.constructor.recordVisit(originalBookmark);
        // 后台保存，不阻塞跳转
        this.bookmarkManager.saveBookmarks().catch(() => {});
      }
    });

    wrapper.addEventListener('contextmenu', (e) => {
      const menu = document.getElementById('contextMenu');
      if (!menu) return;
      e.preventDefault();
      e.stopPropagation();
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.classList.add('active');
      menu.dataset.url = bookmark.url;
    });

    this.setupDragEvents(wrapper, bookmark, index);

    return wrapper;
  }

  setupDragEvents(el, bookmark, index) {
    el.addEventListener('dragstart', (e) => {
      if (this.settingsManager.sortBy !== 'default') {
        e.preventDefault();
        return;
      }
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.bookmark-wrapper').forEach(item => {
        item.classList.remove('drag-over');
      });
    });

    el.addEventListener('dragover', (e) => {
      if (this.settingsManager.sortBy !== 'default') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const draggingItem = document.querySelector('.dragging');
      if (draggingItem !== el) {
        el.classList.add('drag-over');
      }
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', async (e) => {
      if (this.settingsManager.sortBy !== 'default') return;
      e.preventDefault();
      el.classList.remove('drag-over');

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = index;

      if (fromIndex !== toIndex) {
        const success = await this.bookmarkManager.reorderBookmarks(fromIndex, toIndex);
        if (success) {
          this.render();
        }
      }
    });
  }

  calculateCardsPerRow(cardSize, containerWidth) {
    if (!containerWidth) {
      const container = document.querySelector('.bookmarks-section');
      if (!container) return 5;
      containerWidth = container.clientWidth;
    }

    const availableWidth = containerWidth - 60;

    let cardMinWidth;
    switch (cardSize) {
      case 'small': cardMinWidth = 120; break;
      case 'large': cardMinWidth = 180; break;
      case 'medium': default: cardMinWidth = 150; break;
    }

    const gap = 22;
    const cardsPerRow = Math.floor((availableWidth + gap) / (cardMinWidth + gap));

    return Math.max(1, cardsPerRow);
  }

  /**
   * 启动数字时钟
   * @private
   */
  _startDigitalClock() {
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const update = () => {
      const now = new Date();
      const timeEl = document.getElementById('digitalTime');
      const dateEl = document.getElementById('digitalDate');
      if (timeEl) {
        timeEl.textContent = String(now.getHours()).padStart(2, '0') + ':' +
                             String(now.getMinutes()).padStart(2, '0');
      }
      if (dateEl) {
        dateEl.textContent = (now.getMonth() + 1) + '/' + now.getDate() +
                             ' 周' + weekdays[now.getDay()];
      }
    };
    update();
    this._clockInterval = setInterval(update, 10000);
  }
}
