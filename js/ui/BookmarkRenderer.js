export class BookmarkRenderer {
  constructor(bookmarkManager, settingsManager, statsManager, compassClock) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.statsManager = statsManager;
    this.compassClock = compassClock;
  }

  render() {
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

    const cardsPerRow = this.calculateCardsPerRow(cardSize);
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
    addBtn.className = 'bookmark-item add-bookmark animate-in';
    addBtn.style.animationDelay = `${Math.min(topBookmarks.length, 15) * 0.01}s`;
    addBtn.id = 'compassAddBtn';
    addBtn.innerHTML = `
      <div class="compass-clock" id="compassClockInBtn">
        <div class="compass-ring compass-hours" id="compassHoursBtn"></div>
        <div class="compass-ring compass-minutes" id="compassMinutesBtn"></div>
        <div class="compass-ring compass-seconds" id="compassSecondsBtn"></div>
        <div class="compass-center">
          <div class="compass-date" id="compassDateBtn">1/1</div>
          <div class="compass-weekday" id="compassWeekdayBtn">周一</div>
        </div>
      </div>
      <div class="bookmark-title">添加网站</div>
    `;
    addBtn.addEventListener('click', () => {
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

    setTimeout(() => {
      this.compassClock.initCompassInButton();
    }, 0);

    if (moreGrid && moreBookmarks.length > 0) {
      const moreFragment = document.createDocumentFragment();
      moreBookmarks.forEach((bookmark, index) => {
        moreFragment.appendChild(this.createBookmarkElement(bookmark, index + topCardsCount, false, cardShape, true));
      });
      moreGrid.appendChild(moreFragment);
    }
  }

  createBookmarkElement(bookmark, index, isTopSection, cardShape) {
    const el = document.createElement('div');
    el.className = `bookmark-item ${cardShape} animate-in`;
    const delay = Math.min(index, 15) * 0.01;
    el.style.animationDelay = `${delay}s`;

    el.draggable = true;
    el.dataset.index = index;
    el.dataset.url = bookmark.url;
    el.innerHTML = `
      <div class="bookmark-title">${bookmark.name}</div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .bookmark-item[data-url="${bookmark.url}"]::before {
        background-image: url('${bookmark.icon}');
      }
    `;
    el.appendChild(style);

    el.addEventListener('click', async () => {
      const originalBookmark = this.bookmarkManager.customBookmarks.find(b => b.url === bookmark.url);
      console.log('点击书签:', bookmark.name, '找到原始书签:', !!originalBookmark);
      if (originalBookmark) {
        this.statsManager.constructor.recordVisit(originalBookmark);
        console.log('访问计数更新为:', originalBookmark.visitCount);
        await this.bookmarkManager.saveBookmarks();
        console.log('书签已保存');
      } else {
        console.warn('未找到原始书签，URL:', bookmark.url);
        console.log('customBookmarks:', this.bookmarkManager.customBookmarks.map(b => b.url));
      }
      window.open(bookmark.url, '_self');
    });

    el.addEventListener('contextmenu', (e) => {
      const menu = document.getElementById('contextMenu');
      if (!menu) return;
      e.preventDefault();
      e.stopPropagation();
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.classList.add('active');
      menu.dataset.url = bookmark.url;
    });

    this.setupDragEvents(el, bookmark, index);

    return el;
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
      document.querySelectorAll('.bookmark-item').forEach(item => {
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

  calculateCardsPerRow(cardSize) {
    const container = document.querySelector('.bookmarks-section');
    if (!container) return 5;

    const containerWidth = container.clientWidth - 60;

    let cardMinWidth;
    switch (cardSize) {
      case 'small': cardMinWidth = 120; break;
      case 'large': cardMinWidth = 180; break;
      case 'medium': default: cardMinWidth = 150; break;
    }

    const gap = 22;
    const cardsPerRow = Math.floor((containerWidth + gap) / (cardMinWidth + gap));

    return Math.max(1, cardsPerRow);
  }
}
