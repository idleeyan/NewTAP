class BookmarksManager {
  constructor() {
    this.defaultBookmarks = [
      { 
        name: 'Google', 
        url: 'https://www.google.com', 
        icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64', 
        index: 0, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: '百度', 
        url: 'https://www.baidu.com', 
        icon: 'https://www.google.com/s2/favicons?domain=baidu.com&sz=64', 
        index: 1, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: 'GitHub', 
        url: 'https://github.com', 
        icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64', 
        index: 2, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: 'YouTube', 
        url: 'https://www.youtube.com', 
        icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64', 
        index: 3, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: '知乎', 
        url: 'https://www.zhihu.com', 
        icon: 'https://www.google.com/s2/favicons?domain=zhihu.com&sz=64', 
        index: 4, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: '微博', 
        url: 'https://weibo.com', 
        icon: 'https://www.google.com/s2/favicons?domain=weibo.com&sz=64', 
        index: 5, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: '腾讯视频', 
        url: 'https://v.qq.com', 
        icon: 'https://www.google.com/s2/favicons?domain=v.qq.com&sz=64', 
        index: 6, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      },
      { 
        name: '网易云音乐', 
        url: 'https://music.163.com', 
        icon: 'https://www.google.com/s2/favicons?domain=music.163.com&sz=64', 
        index: 7, 
        visitCount: 0, 
        lastVisit: 0,
        firstVisit: 0,
        visitHistory: [],
        dailyStats: {},
        timeOfDayStats: { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } }
      }
    ];
    this.bookmarks = [];
    this.customBookmarks = [];
    this.cardSize = 'medium';
    this.cardShape = 'square';
    this.sortBy = 'default';
    this.bgSettings = {
      mode: 'default', // default, bing, custom
      customUrl: '',
      overlayOpacity: 40
    };
    this.webdavManager = new WebDAVSyncManager();
    this.autoSyncManager = new AutoSyncManager(this.webdavManager);
    this.init();
  }

  async init() {
    await this.loadCustomBookmarks();
    await this.loadCardSize();
    await this.loadCardShape();
    await this.loadSortBy();
    await this.loadBgSettings();
    this.applyBackground();
    await this.webdavManager.loadConfig();
    await this.autoSyncManager.loadConfig();
    this.renderBookmarks();
    this.setupSettingsButton();
    this.setupBackgroundSettingsUI();
    this.setupAddBookmarkDialogListeners();
    this.updateLayout();
    this.setupWebDAVUI();
    this.setupAutoSync();
    this.setupMoreBookmarksToggle();
  }

  setupAutoSync() {
    this.autoSyncManager.start();
    this.autoSyncManager.syncOnStartIfEnabled().then(result => {
      if (result.success && result.direction === 'download') {
        this.loadCustomBookmarks().then(() => {
          this.loadCardSize().then(() => {
            this.loadCardShape().then(() => {
              this.loadSortBy().then(() => {
                this.renderBookmarks();
                this.updateLayout();
                this.showImportNotification('已自动同步最新数据');
              });
            });
          });
        });
      }
    });
  }

  setupMoreBookmarksToggle() {
    const section = document.getElementById('moreBookmarksSection');
    const header = document.getElementById('moreBookmarksHeader');
    const wrapper = document.getElementById('moreBookmarksWrapper');
    const icon = document.getElementById('toggleMoreIcon');

    if (!header || !wrapper || !section) return;

    // 封装展开/收起逻辑
    const toggle = (forceState) => {
      const isExpanded = wrapper.classList.contains('expanded');
      // 如果 forceState 存在，则设置为 forceState，否则取反
      const shouldExpand = forceState !== undefined ? forceState : !isExpanded;

      if (shouldExpand) {
        wrapper.classList.add('expanded');
        header.classList.add('expanded');
        icon.textContent = '▲';
      } else {
        wrapper.classList.remove('expanded');
        header.classList.remove('expanded');
        icon.textContent = '▼';
      }
    };

    // 点击切换（保留作为手动控制，且清除之前的自动计时器以防冲突）
    header.addEventListener('click', (e) => {
      // 阻止事件冒泡，防止触发 section 的 mouseenter/leave 逻辑混乱（虽然通常不会，但保险起见）
      // e.stopPropagation();
      toggle();
    });

    // 自动展开/收起逻辑
    let hoverTimer;
    let leaveTimer;

    // 鼠标进入区域
    section.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer); // 只要鼠标回到了区域内，就取消即将发生的收起

      // 如果还没展开，设定延时展开
      if (!wrapper.classList.contains('expanded')) {
        hoverTimer = setTimeout(() => {
          toggle(true);
        }, 200); // 200ms 悬停后展开，防误触
      }
    });

    // 鼠标离开区域
    section.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer); // 如果鼠标快速划过（未到200ms），取消展开

      // 如果已经展开，设定延时收起
      if (wrapper.classList.contains('expanded')) {
        leaveTimer = setTimeout(() => {
          toggle(false);
        }, 600); // 离开600ms后收起，给用户从边缘移回的机会
      }
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.renderBookmarks();
      }, 200);
    });
  }

  async loadCustomBookmarks() {
    try {
      const result = await chrome.storage.local.get('customBookmarks');
      this.customBookmarks = result.customBookmarks || [];
      this.bookmarks = [...this.customBookmarks];
    } catch (error) {
      console.error('加载书签失败:', error);
      this.bookmarks = [...this.defaultBookmarks];
    }
  }

  renderBookmarks() {
    const topGrid = document.getElementById('topBookmarksGrid');
    const moreGrid = document.getElementById('moreBookmarksGrid');
    const topCountEl = document.getElementById('topBookmarksCount');
    const moreSection = document.getElementById('moreBookmarksSection');

    if (!topGrid) return;

    topGrid.innerHTML = '';
    if (moreGrid) moreGrid.innerHTML = '';

    topGrid.className = `bookmarks-grid ${this.cardSize}`;
    if (moreGrid) moreGrid.className = `bookmarks-grid ${this.cardSize}`;

    window.bookmarksManager = this;

    let sortedBookmarks = [...this.bookmarks];

    switch (this.sortBy) {
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

    const cardsPerRow = this.calculateCardsPerRow();
    const topRowCount = 5;
    const topCardsCount = cardsPerRow * topRowCount;

    const topBookmarks = sortedBookmarks.slice(0, topCardsCount);
    const moreBookmarks = sortedBookmarks.slice(topCardsCount);

    if (topCountEl) {
      topCountEl.textContent = `${topBookmarks.length}个网站`;
    }

    if (moreSection) {
      moreSection.style.display = moreBookmarks.length > 0 ? 'block' : 'none';
    }

    const createBookmarkElement = (bookmark, index, isTopSection) => {
      const el = document.createElement('div');
      el.className = `bookmark-item ${this.cardShape} animate-in`; // 添加动画类
      // 设置交错动画延迟，前15个元素逐渐增加延迟，后面的统一延迟，防止等待太久
      const delay = Math.min(index, 15) * 0.05;
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
        window.open(bookmark.url, '_self');

        // 记录详细访问信息
        const now = Date.now();
        const visitTime = new Date(now);
        const hour = visitTime.getHours();
        
        // 更新基本统计
        bookmark.visitCount = (bookmark.visitCount || 0) + 1;
        bookmark.lastVisit = now;
        if (!bookmark.firstVisit) {
          bookmark.firstVisit = now;
        }

        // 记录详细访问历史（限制最多100条）
        const visitRecord = {
          timestamp: now,
          date: visitTime.toISOString().split('T')[0], // YYYY-MM-DD
          time: visitTime.toTimeString().split(' ')[0], // HH:MM:SS
          hour: hour,
          dayOfWeek: visitTime.getDay(), // 0-6 (Sunday-Saturday)
          month: visitTime.getMonth() + 1, // 1-12
          year: visitTime.getFullYear(),
          duration: 0, // 初始为0
          referrer: 'direct'
        };

        // 添加到访问历史（限制100条）
        if (!bookmark.visitHistory) {
          bookmark.visitHistory = [];
        }
        bookmark.visitHistory.unshift(visitRecord);
        if (bookmark.visitHistory.length > 100) {
          bookmark.visitHistory.pop();
        }

        // 初始化 dailyStats（如果不存在）
        if (!bookmark.dailyStats) {
          bookmark.dailyStats = {};
        }

        // 更新每日统计
        const dateKey = visitRecord.date;
        if (!bookmark.dailyStats[dateKey]) {
          bookmark.dailyStats[dateKey] = { count: 0, totalDuration: 0 };
        }
        bookmark.dailyStats[dateKey].count++;
        // 注意：实际停留时长需要在页面关闭时记录，这里先设为0

        // 初始化 timeOfDayStats（如果不存在）
        if (!bookmark.timeOfDayStats) {
          bookmark.timeOfDayStats = { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } };
        }

        // 更新时段统计
        let timeOfDay = 'evening';
        if (hour >= 6 && hour < 12) timeOfDay = 'morning';
        else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
        
        if (!bookmark.timeOfDayStats[timeOfDay]) {
          bookmark.timeOfDayStats[timeOfDay] = { count: 0, avgDuration: 0 };
        }
        bookmark.timeOfDayStats[timeOfDay].count++;
        // 平均停留时长计算需要后续实现

        await chrome.storage.local.set({
          customBookmarks: this.customBookmarks,
          lastLocalModify: Date.now()
        });
      });
      el.addEventListener('contextmenu', (e) => window.showContextMenu(e, bookmark.url));

      return el;
    };

    const topFragment = document.createDocumentFragment();
    topBookmarks.forEach((bookmark, index) => {
      topFragment.appendChild(createBookmarkElement(bookmark, index, true));
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'bookmark-item add-bookmark animate-in'; // 添加动画类
    addBtn.style.animationDelay = `${Math.min(topBookmarks.length, 15) * 0.05}s`; // 紧随最后一个卡片
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
    addBtn.addEventListener('click', () => this.showAddBookmarkDialog());
    topFragment.appendChild(addBtn);

    topGrid.appendChild(topFragment);

    if (moreGrid && moreBookmarks.length > 0) {
      const moreFragment = document.createDocumentFragment();
      moreBookmarks.forEach((bookmark, index) => {
        moreFragment.appendChild(createBookmarkElement(bookmark, index + topCardsCount, false));
      });
      moreGrid.appendChild(moreFragment);
    }
  }

  calculateCardsPerRow() {
    const container = document.querySelector('.bookmarks-section');
    if (!container) return 5;

    const containerWidth = container.clientWidth - 60;

    let cardMinWidth;
    switch (this.cardSize) {
      case 'small':
        cardMinWidth = 120;
        break;
      case 'large':
        cardMinWidth = 180;
        break;
      case 'medium':
      default:
        cardMinWidth = 150;
        break;
    }

    const gap = 22;
    const cardsPerRow = Math.floor((containerWidth + gap) / (cardMinWidth + gap));

    return Math.max(1, cardsPerRow);
  }

  async loadCardSize() {
    try {
      const result = await chrome.storage.local.get('bookmarkCardSize');
      if (result.bookmarkCardSize && ['small', 'medium', 'large'].includes(result.bookmarkCardSize)) {
        this.cardSize = result.bookmarkCardSize;
      }
    } catch (error) {
      console.error('加载卡片大小设置失败:', error);
      this.cardSize = 'medium';
    }
  }

  async saveCardSize() {
    try {
      await chrome.storage.local.set({
        bookmarkCardSize: this.cardSize,
        lastLocalModify: Date.now()
      });
    } catch (error) {
      console.error('保存卡片大小设置失败:', error);
    }
  }

  async loadCardShape() {
    try {
      const result = await chrome.storage.local.get('bookmarkCardShape');
      if (result.bookmarkCardShape && ['square', 'round'].includes(result.bookmarkCardShape)) {
        this.cardShape = result.bookmarkCardShape;
      }
    } catch (error) {
      console.error('加载卡片形状设置失败:', error);
      this.cardShape = 'square';
    }
  }

  async saveCardShape() {
    try {
      await chrome.storage.local.set({
        bookmarkCardShape: this.cardShape,
        lastLocalModify: Date.now()
      });
    } catch (error) {
      console.error('保存卡片形状设置失败:', error);
    }
  }

  async loadSortBy() {
    try {
      const result = await chrome.storage.local.get('bookmarkSortBy');
      if (result.bookmarkSortBy && ['default', 'visits', 'recent', 'name'].includes(result.bookmarkSortBy)) {
        this.sortBy = result.bookmarkSortBy;
      }
    } catch (error) {
      console.error('加载排序方式设置失败:', error);
      this.sortBy = 'default';
    }
  }

  async saveSortBy() {
    try {
      await chrome.storage.local.set({
        bookmarkSortBy: this.sortBy,
        lastLocalModify: Date.now()
      });
    } catch (error) {
      console.error('保存排序方式设置失败:', error);
    }
  }

  async loadBgSettings() {
    try {
      const result = await chrome.storage.local.get('bgSettings');
      if (result.bgSettings) {
        this.bgSettings = { ...this.bgSettings, ...result.bgSettings };
      }
    } catch (error) {
      console.error('加载背景设置失败:', error);
    }
  }

  async saveBgSettings() {
    try {
      await chrome.storage.local.set({
        bgSettings: this.bgSettings,
        lastLocalModify: Date.now()
      });
    } catch (error) {
      console.error('保存背景设置失败:', error);
    }
  }

  applyBackground() {
    const container = document.getElementById('bgContainer');
    const overlay = document.getElementById('bgOverlay');

    if (!container || !overlay) return;

    // 应用遮罩透明度
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${this.bgSettings.overlayOpacity / 100})`;

    // 应用背景图
    if (this.bgSettings.mode === 'default') {
      container.style.backgroundImage = 'none';
      document.body.style.background = '#1a1a2e';
    } else {
      let url = '';
      if (this.bgSettings.mode === 'bing') {
        // 使用 Bing 每日壁纸接口
        url = 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN';
      } else if (this.bgSettings.mode === 'custom') {
        url = this.bgSettings.customUrl;
      }

      if (url) {
        container.style.backgroundImage = `url('${url}')`;
        document.body.style.background = 'transparent'; // 让 body 透明以显示 fixed 背景
      } else {
        container.style.backgroundImage = 'none';
        document.body.style.background = '#1a1a2e';
      }
    }
  }

  setupBackgroundSettingsUI() {
    const modeButtons = document.querySelectorAll('.bg-mode-btn');
    const customUrlGroup = document.getElementById('bgCustomUrlGroup');
    const customUrlInput = document.getElementById('bgCustomUrl');
    const opacityInput = document.getElementById('bgOverlayOpacity');
    const opacityValue = document.getElementById('bgOverlayValue');

    if (!opacityInput) return;

    // 初始化 UI 状态
    const updateUIState = () => {
      modeButtons.forEach(btn => {
        if (btn.dataset.mode === this.bgSettings.mode) {
          btn.style.background = '#667eea';
          btn.style.color = 'white';
        } else {
          btn.style.background = 'rgba(255,255,255,1)';
          btn.style.color = '#333';
        }
      });

      if (this.bgSettings.mode === 'custom') {
        customUrlGroup.style.display = 'block';
      } else {
        customUrlGroup.style.display = 'none';
      }

      customUrlInput.value = this.bgSettings.customUrl || '';
      opacityInput.value = this.bgSettings.overlayOpacity;
      opacityValue.textContent = `${this.bgSettings.overlayOpacity}%`;
    };

    updateUIState();

    // 绑定事件
    modeButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        this.bgSettings.mode = btn.dataset.mode;
        updateUIState();
        this.applyBackground();
        await this.saveBgSettings();
      });
    });

    customUrlInput.addEventListener('change', async () => {
      this.bgSettings.customUrl = customUrlInput.value.trim();
      if (this.bgSettings.mode === 'custom') {
        this.applyBackground();
      }
      await this.saveBgSettings();
    });

    opacityInput.addEventListener('input', () => {
      const val = opacityInput.value;
      opacityValue.textContent = `${val}%`;
      this.bgSettings.overlayOpacity = parseInt(val);
      // 实时预览
      const overlay = document.getElementById('bgOverlay');
      if (overlay) {
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${val / 100})`;
      }
    });

    opacityInput.addEventListener('change', async () => {
      await this.saveBgSettings();
    });
  }

  updateLayout() {
    const grid = document.getElementById('bookmarksGrid');
    if (!grid) return;
    
    grid.className = `bookmarks-grid ${this.cardSize}`;
    
    const bookmarkItems = document.querySelectorAll('.bookmark-item:not(.add-bookmark)');
    bookmarkItems.forEach(item => {
      item.classList.remove('square', 'round');
      item.classList.add(this.cardShape);
    });
  }

  async updateCardSize(newSize) {
    if (['small', 'medium', 'large'].includes(newSize)) {
      this.cardSize = newSize;
      await this.saveCardSize();
      
      const topGrid = document.getElementById('topBookmarksGrid');
      const moreGrid = document.getElementById('moreBookmarksGrid');
      
      if (topGrid) {
        topGrid.className = `bookmarks-grid ${this.cardSize}`;
      }
      if (moreGrid) {
        moreGrid.className = `bookmarks-grid ${this.cardSize}`;
      }
      
      const sizeButtons = document.querySelectorAll('.size-button');
      sizeButtons.forEach(button => {
        if (button.dataset.size === this.cardSize) {
          button.style.background = '#667eea';
          button.style.color = 'white';
        } else {
          button.style.background = 'rgba(255,255,255,1)';
          button.style.color = '#333';
        }
      });
      
      this.renderBookmarks();
    }
  }

  async updateCardShape(newShape) {
    if (['square', 'round'].includes(newShape)) {
      this.cardShape = newShape;
      await this.saveCardShape();
      
      const shapeButtons = document.querySelectorAll('.shape-button');
      shapeButtons.forEach(button => {
        if (button.dataset.shape === this.cardShape) {
          button.style.background = '#667eea';
          button.style.color = 'white';
        } else {
          button.style.background = 'rgba(255,255,255,1)';
          button.style.color = '#333';
        }
      });
      
      this.updateLayout();
    }
  }

  setupSettingsButton() {
    const btn = document.getElementById('settingsButton');
    const dialog = document.getElementById('settingsDialog');
    const cancelBtn = document.getElementById('cancelSettingsBtn');
    const exportBtn = document.querySelector('#settingsDialog .dialog-btn[style*="76,175,80"]');
    const importBtn = document.querySelector('#settingsDialog .dialog-btn[style*="255,152,0"]');
    const sortButtons = document.querySelectorAll('.sort-button');

    if (btn && dialog) {
      btn.addEventListener('click', () => {
        dialog.classList.add('active');
        this.setupCardSizeControls();
        this.setupCardShapeControls();
        this.setupSortControls();
      });
      if (cancelBtn) cancelBtn.addEventListener('click', () => dialog.classList.remove('active'));
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.classList.remove('active'); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dialog.classList.remove('active'); });
    }

    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
    if (importBtn) {
      const fileInput = document.getElementById('importFileInput');
      if (fileInput) importBtn.addEventListener('click', () => fileInput.click());
      if (fileInput) fileInput.addEventListener('change', (e) => this.importData(e));
    }

    const viewStatsBtn = document.getElementById('viewStatsBtn');
    if (viewStatsBtn) {
      viewStatsBtn.addEventListener('click', () => this.showStatsDialog());
    }
  }

  showStatsDialog() {
    const dialog = document.getElementById('statsDialog');
    const closeBtn = document.getElementById('closeStatsBtn');
    const statsList = document.getElementById('statsList');

    if (!dialog) return;

    this.renderStats();

    dialog.classList.add('active');

    if (closeBtn) {
      closeBtn.onclick = () => dialog.classList.remove('active');
    }

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.classList.remove('active');
    });
  }

  renderStats() {
    const totalVisitsEl = document.getElementById('totalVisits');
    const totalBookmarksEl = document.getElementById('totalBookmarks');
    const mostVisitedEl = document.getElementById('mostVisited');
    const statsList = document.getElementById('statsList');
    const timeStatsEl = document.getElementById('timeStats');

    const sortedBookmarks = [...this.bookmarks].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));

    const totalVisits = sortedBookmarks.reduce((sum, b) => sum + (b.visitCount || 0), 0);
    const totalBookmarks = sortedBookmarks.length;
    const mostVisited = sortedBookmarks.length > 0 ? sortedBookmarks[0].name : '-';

    if (totalVisitsEl) totalVisitsEl.textContent = totalVisits.toLocaleString();
    if (totalBookmarksEl) totalBookmarksEl.textContent = totalBookmarks;
    if (mostVisitedEl) mostVisitedEl.textContent = mostVisited.length > 8 ? mostVisited.substring(0, 8) + '...' : mostVisited;

    // 计算时间统计
    let totalDays = 0;
    let morningCount = 0, afternoonCount = 0, eveningCount = 0;
    let avgDuration = 0;
    
    sortedBookmarks.forEach(bookmark => {
      if (bookmark.visitHistory && bookmark.visitHistory.length > 0) {
        totalDays += bookmark.dailyStats ? Object.keys(bookmark.dailyStats).length : 0;
        
        // 统计时段分布
        if (bookmark.timeOfDayStats) {
          morningCount += bookmark.timeOfDayStats.morning?.count || 0;
          afternoonCount += bookmark.timeOfDayStats.afternoon?.count || 0;
          eveningCount += bookmark.timeOfDayStats.evening?.count || 0;
        }
        
        // 计算平均停留时长（简化计算）
        const totalDuration = bookmark.visitHistory.reduce((sum, v) => sum + (v.duration || 0), 0);
        const totalCount = bookmark.visitHistory.length;
        if (totalCount > 0) {
          avgDuration += totalDuration / totalCount;
        }
      }
    });
    
    avgDuration = totalBookmarks > 0 ? Math.round(avgDuration / totalBookmarks) : 0;

    if (timeStatsEl) {
      timeStatsEl.innerHTML = `
        <div class="time-stat-item">
          <span>总天数:</span>
          <span>${totalDays}天</span>
        </div>
        <div class="time-stat-item">
          <span>早间访问:</span>
          <span>${morningCount}次 (${morningCount > 0 ? Math.round(morningCount * 100 / (morningCount + afternoonCount + eveningCount)) : 0}%)</span>
        </div>
        <div class="time-stat-item">
          <span>午间访问:</span>
          <span>${afternoonCount}次 (${afternoonCount > 0 ? Math.round(afternoonCount * 100 / (morningCount + afternoonCount + eveningCount)) : 0}%)</span>
        </div>
        <div class="time-stat-item">
          <span>晚间访问:</span>
          <span>${eveningCount}次 (${eveningCount > 0 ? Math.round(eveningCount * 100 / (morningCount + afternoonCount + eveningCount)) : 0}%)</span>
        </div>
        <div class="time-stat-item">
          <span>平均停留:</span>
          <span>${avgDuration}秒</span>
        </div>
      `;
    }

    if (statsList) {
      statsList.innerHTML = '';

      if (sortedBookmarks.length === 0) {
        statsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无数据</div>';
        return;
      }

      const fragment = document.createDocumentFragment();

      sortedBookmarks.forEach((bookmark, index) => {
        const item = document.createElement('div');
        item.className = 'stats-item';

        const visitCount = bookmark.visitCount || 0;
        const lastVisit = bookmark.lastVisit ? new Date(bookmark.lastVisit).toLocaleDateString() : '从未';
        const firstVisit = bookmark.firstVisit ? new Date(bookmark.firstVisit).toLocaleDateString() : '从未';
        
        // 获取最近3次访问时间点
        const recentVisits = bookmark.visitHistory && bookmark.visitHistory.length > 0 
          ? bookmark.visitHistory.slice(0, 3).map(v => `${v.date} ${v.time}`)
          : ['无记录'];

        item.innerHTML = `
          <img src="${bookmark.icon}" alt="" onerror="this.style.display='none'">
          <div class="stats-item-info">
            <div class="stats-item-name">${bookmark.name}</div>
            <div class="stats-item-url">${bookmark.url}</div>
            <div class="stats-item-detail">
              <div><span>首次访问:</span> ${firstVisit}</div>
              <div><span>最近3次:</span> ${recentVisits.join(', ')}</div>
            </div>
          </div>
          <div class="stats-item-count">
            <div class="number">${visitCount}</div>
            <div class="label">次访问</div>
          </div>
        `;

        fragment.appendChild(item);
      });

      statsList.appendChild(fragment);
    }
  }

  setupCardSizeControls() {
    const sizeButtons = document.querySelectorAll('.size-button');
    sizeButtons.forEach(button => {
      if (button.dataset.size === this.cardSize) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
      
      button.addEventListener('click', () => {
        const size = button.dataset.size;
        this.updateCardSize(size);
      });
    });
  }

  setupCardShapeControls() {
    const shapeButtons = document.querySelectorAll('.shape-button');
    shapeButtons.forEach(button => {
      if (button.dataset.shape === this.cardShape) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
      
      button.addEventListener('click', () => {
        const shape = button.dataset.shape;
        this.updateCardShape(shape);
      });
    });
  }

  setupSortControls() {
    const sortButtons = document.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      if (button.dataset.sort === this.sortBy) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
      
      button.addEventListener('click', () => {
        const sortBy = button.dataset.sort;
        this.updateSortBy(sortBy);
      });
    });
  }

  async updateSortBy(newSortBy) {
    if (['default', 'visits', 'recent', 'name'].includes(newSortBy)) {
      this.sortBy = newSortBy;
      await this.saveSortBy();
      this.renderBookmarks();
      
      const sortButtons = document.querySelectorAll('.sort-button');
      sortButtons.forEach(button => {
        if (button.dataset.sort === this.sortBy) {
          button.style.background = '#667eea';
          button.style.color = 'white';
        } else {
          button.style.background = 'rgba(255,255,255,1)';
          button.style.color = '#333';
        }
      });
    }
  }

  async loadHistoryItems() {
    try {
      console.log('开始加载历史记录...');
      
      // 检查 chrome.history API 是否可用
      if (!chrome.history || !chrome.history.search) {
        console.error('chrome.history API 不可用');
        window.historyItems = [];
        return;
      }
      
      const result = await chrome.history.search({ text: '', maxResults: 100 });
      console.log('历史记录原始数据:', result);
      
      const domainMap = new Map();
      result.forEach(item => {
        if (item.lastVisitTime && item.url) {
          try {
            const url = new URL(item.url);
            const domain = url.hostname;
            
            // 跳过 Chrome 内部页面和无效域名
            if (domain.includes('chrome://') || 
                domain.includes('chrome-extension://') ||
                domain.includes('localhost') ||
                domain === '') {
              return;
            }
            
            if (!domainMap.has(domain)) {
              domainMap.set(domain, {
                name: domain.replace(/^www\./, ''),
                url: item.url,
                icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
                visitCount: 1,
                lastVisit: item.lastVisitTime
              });
            } else {
              domainMap.get(domain).visitCount++;
              // 更新为最新的URL
              if (item.lastVisitTime > domainMap.get(domain).lastVisit) {
                domainMap.get(domain).url = item.url;
                domainMap.get(domain).lastVisit = item.lastVisitTime;
              }
            }
          } catch (e) {
            console.warn('解析URL失败:', item.url, e);
          }
        }
      });
      
      window.historyItems = Array.from(domainMap.values())
        .sort((a, b) => b.visitCount - a.visitCount);
      
      console.log('处理后的历史记录:', window.historyItems);
    } catch (error) {
      console.error('加载历史记录失败:', error);
      window.historyItems = [];
    }
  }

  async loadBookmarkItems() {
    try {
      const tree = await chrome.bookmarks.getTree();
      const bookmarks = [];
      const traverse = (nodes) => {
        nodes.forEach(node => {
          if (node.url) {
            try {
              const url = new URL(node.url);
              const domain = url.hostname;
              bookmarks.push({
                id: node.id,
                name: node.title || domain,
                url: node.url,
                icon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
              });
            } catch (e) {}
          }
          if (node.children) traverse(node.children);
        });
      };
      traverse(tree);
      window.bookmarkItems = bookmarks;
    } catch (error) {
      console.error('加载书签失败:', error);
      window.bookmarkItems = [];
    }
  }

  async loadOpenTabsItems() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      window.openTabs = tabs
        .filter(tab => tab.url && tab.url.startsWith('http'))
        .map(tab => {
          const url = new URL(tab.url);
          return {
            id: tab.id,
            name: tab.title || url.hostname,
            url: tab.url,
            icon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
          };
        });
    } catch (error) {
      console.error('获取打开的标签页失败:', error);
      window.openTabs = [];
    }
  }

  async addFromHistoryOrBookmark(item, source) {
    try {
      // 验证 URL
      let url;
      try {
        url = new URL(item.url);
      } catch (e) {
        alert('无效的网址');
        return;
      }
      
      const domain = url.hostname;
      const icon = item.icon || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      
      // 检查是否已存在
      if (this.customBookmarks.some(b => b.url === item.url)) {
        alert('该网站已存在！');
        return;
      }
      
      // 检查 URL 是否有效
      if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
        alert('只支持 HTTP 或 HTTPS 协议的网站');
        return;
      }
      
      const newBookmark = {
        id: Date.now().toString(),
        name: item.name || domain,
        url: item.url,
        icon: icon,
        index: this.bookmarks.length,
        visitCount: item.visitCount || 0,
        lastVisit: item.lastVisit || Date.now()
      };
      
      this.customBookmarks.push(newBookmark);
      await chrome.storage.local.set({
        customBookmarks: this.customBookmarks,
        lastLocalModify: Date.now()
      });

      this.bookmarks = [...this.customBookmarks];
      this.renderBookmarks();
      
      const dialog = document.getElementById('addBookmarkDialog');
      if (dialog) dialog.classList.remove('active');
      
      this.showImportNotification(`已从${source}添加: ${newBookmark.name}`);
    } catch (error) {
      console.error('添加失败:', error);
      alert('添加失败: ' + error.message);
    }
  }

  showImportNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(76, 175, 80, 0.9); color: white; padding: 12px 24px;
      border-radius: 8px; z-index: 3000; animation: slideUp 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  setupAddBookmarkDialogListeners() {
    const dialog = document.getElementById('addBookmarkDialog');
    const manualForm = document.getElementById('manualAddForm');
    const manualBtn = document.getElementById('manualAddBtn');
    const historyAddBtn = document.getElementById('historyAddBtn');
    const bookmarkAddBtn = document.getElementById('bookmarkAddBtn');
    const openTabsBtn = document.getElementById('openTabsAddBtn');
    const cancelBtn = document.getElementById('cancelManualAddBtn');
    const historyContainer = document.getElementById('historyItemsContainer');
    const bookmarkContainer = document.getElementById('bookmarkItemsContainer');
    const tabsContainer = document.getElementById('openTabsContainer');

    if (dialog) {
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.classList.remove('active'); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dialog.classList.remove('active'); });
    }

    const showSection = (section) => {
      document.querySelector('.add-options').style.display = 'none';
      if (manualForm) manualForm.style.display = 'none';
      if (historyContainer) historyContainer.style.display = 'none';
      if (bookmarkContainer) bookmarkContainer.style.display = 'none';
      if (tabsContainer) tabsContainer.style.display = 'none';
      if (section) section.style.display = 'block';
    };

    if (manualBtn) manualBtn.addEventListener('click', () => showSection(manualForm));

    if (historyAddBtn) historyAddBtn.addEventListener('click', async () => {
      showSection(historyContainer);
      if (!window.historyItems || window.historyItems.length === 0) {
        await this.loadHistoryItems();
        this.renderHistoryItems();
      }
    });

    if (bookmarkAddBtn) bookmarkAddBtn.addEventListener('click', async () => {
      showSection(bookmarkContainer);
      if (!window.bookmarkItems || window.bookmarkItems.length === 0) {
        await this.loadBookmarkItems();
        this.renderBookmarkItems();
      }
    });

    if (openTabsBtn) openTabsBtn.addEventListener('click', async () => {
      showSection(tabsContainer);
      if (!window.openTabs || window.openTabs.length === 0) {
        await this.loadOpenTabsItems();
        this.renderOpenTabsItems();
      }
    });

    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      document.querySelector('.add-options').style.display = 'grid';
      if (manualForm) { manualForm.style.display = 'none'; manualForm.reset(); }
      if (historyContainer) { historyContainer.style.display = 'none'; }
      if (bookmarkContainer) { bookmarkContainer.style.display = 'none'; }
      if (tabsContainer) { tabsContainer.style.display = 'none'; }
    });

    if (manualForm) manualForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addFromForm();
    });
  }

  renderHistoryItems() {
    const container = document.getElementById('historyItemsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 如果没有历史记录数据，显示加载状态
    if (!window.historyItems) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">正在加载历史记录...</div>';
      return;
    }
    
    // 如果历史记录为空
    if (window.historyItems.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:#666;">
          <div style="font-size:2rem;margin-bottom:10px;">📭</div>
          <div>暂无历史记录</div>
          <div style="font-size:0.8rem;margin-top:5px;">请先浏览一些网站</div>
        </div>
      `;
      return;
    }
    
    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
      <span style="font-size: 0.9rem; opacity: 0.8;">点击添加历史记录中的网站</span>
      <span style="font-size: 0.8rem; color: #999;">共 ${window.historyItems.length} 个</span>
    `;
    fragment.appendChild(header);

    window.historyItems.slice(0, 50).forEach(item => {
      const el = document.createElement('div');
      el.className = 'import-item';
      el.innerHTML = `
        <img src="${item.icon}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23999%22><text x=%2250%%22 y=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2214%22>🌐</text></svg>'" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:white;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
        <span style="font-size:0.75rem;opacity:0.6;">访问${item.visitCount}次</span>
      `;
      el.addEventListener('click', () => this.addFromHistoryOrBookmark(item, '历史记录'));
      fragment.appendChild(el);
    });

    if (window.historyItems.length > 50) {
      const more = document.createElement('div');
      more.style.cssText = 'text-align:center;padding:8px;font-size:0.8rem;opacity:0.7;';
      more.textContent = `还有 ${window.historyItems.length - 50} 条记录...`;
      fragment.appendChild(more);
    }

    container.appendChild(fragment);
  }

  renderBookmarkItems() {
    const container = document.getElementById('bookmarkItemsContainer');
    if (!container || !window.bookmarkItems) return;
    
    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = '<span style="font-size: 0.9rem; opacity: 0.8;">点击添加书签中的网站</span>';
    fragment.appendChild(header);

    window.bookmarkItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'import-item';
      el.innerHTML = `
        <img src="${item.icon}" alt="" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:white;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
      `;
      el.addEventListener('click', () => this.addFromHistoryOrBookmark(item, '书签'));
      fragment.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  renderOpenTabsItems() {
    const container = document.getElementById('openTabsContainer');
    if (!container || !window.openTabs) return;
    
    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = '<span style="font-size: 0.9rem; opacity: 0.8;">点击添加当前窗口的标签页</span>';
    fragment.appendChild(header);

    window.openTabs.forEach(item => {
      const el = document.createElement('div');
      el.className = 'import-item';
      el.innerHTML = `
        <img src="${item.icon}" alt="" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:white;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
      `;
      el.addEventListener('click', () => this.addFromHistoryOrBookmark(item, '标签页'));
      fragment.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  showAddBookmarkDialog() {
    const dialog = document.getElementById('addBookmarkDialog');
    if (dialog) {
      dialog.classList.add('active');
      document.querySelector('.add-options').style.display = 'grid';
      const manualForm = document.getElementById('manualAddForm');
      if (manualForm) { manualForm.style.display = 'none'; manualForm.reset(); }
    }
  }

  async addFromForm() {
    const name = document.getElementById('manualName').value.trim();
    const url = document.getElementById('manualUrl').value.trim();
    
    if (!name || !url) { alert('请填写名称和网址'); return; }
    
    try {
      const domain = new URL(url).hostname;
      const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      
      const newBookmark = {
        id: Date.now().toString(),
        name, url, icon,
        index: this.bookmarks.length,
        visitCount: 0,
        lastVisit: Date.now()
      };
      
      this.customBookmarks.push(newBookmark);
      await chrome.storage.local.set({ customBookmarks: this.customBookmarks });
      
      this.bookmarks = [...this.customBookmarks];
      this.renderBookmarks();
      
      const dialog = document.getElementById('addBookmarkDialog');
      if (dialog) dialog.classList.remove('active');
    } catch (e) {
      alert('网址格式不正确');
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

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.customBookmarks) {
        await chrome.storage.local.set({ customBookmarks: data.customBookmarks });
        await this.loadCustomBookmarks();
        this.renderBookmarks();
        alert('导入成功！');
      }
    } catch (error) {
      alert('导入失败: ' + error.message);
    }
    event.target.value = '';
  }

  setupWebDAVUI() {
    const configBtn = document.getElementById('webdavConfigBtn');
    const uploadBtn = document.getElementById('webdavUploadBtn');
    const downloadBtn = document.getElementById('webdavDownloadBtn');
    const disconnectBtn = document.getElementById('webdavDisconnectBtn');
    const configDialog = document.getElementById('webdavConfigDialog');
    const configForm = document.getElementById('webdavConfigForm');
    const cancelConfigBtn = document.getElementById('cancelWebdavConfigBtn');
    const testBtn = document.getElementById('testWebdavBtn');

    this.updateWebDAVStatus();

    if (configBtn) {
      configBtn.addEventListener('click', () => {
        this.loadWebDAVConfigToForm();
        configDialog.classList.add('active');
      });
    }

    if (cancelConfigBtn) {
      cancelConfigBtn.addEventListener('click', () => {
        configDialog.classList.remove('active');
        document.getElementById('webdavTestResult').textContent = '';
      });
    }

    if (configDialog) {
      configDialog.addEventListener('click', (e) => {
        if (e.target === configDialog) {
          configDialog.classList.remove('active');
        }
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', () => this.testWebDAVConnection());
    }

    if (configForm) {
      configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveWebDAVConfig();
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.syncToWebDAV());
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.syncFromWebDAV());
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.disconnectWebDAV());
    }
  }

  async updateWebDAVStatus() {
    const statusEl = document.getElementById('webdavStatus');
    const configBtn = document.getElementById('webdavConfigBtn');
    const uploadBtn = document.getElementById('webdavUploadBtn');
    const downloadBtn = document.getElementById('webdavDownloadBtn');
    const disconnectBtn = document.getElementById('webdavDisconnectBtn');
    const autoSyncSection = document.getElementById('autoSyncSection');

    const status = await this.webdavManager.getSyncStatus();

    if (!status.configured) {
      statusEl.textContent = '未配置';
      statusEl.style.color = '#666';
      if (configBtn) configBtn.style.display = 'inline-block';
      if (uploadBtn) uploadBtn.style.display = 'none';
      if (downloadBtn) downloadBtn.style.display = 'none';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      if (autoSyncSection) autoSyncSection.style.display = 'none';
    } else {
      const lastSync = status.lastLocalSync 
        ? new Date(status.lastLocalSync).toLocaleString() 
        : '从未';
      statusEl.textContent = `已连接: ${new URL(status.serverUrl).hostname} | 上次同步: ${lastSync}`;
      statusEl.style.color = '#4caf50';
      if (configBtn) configBtn.style.display = 'none';
      if (uploadBtn) uploadBtn.style.display = 'inline-block';
      if (downloadBtn) downloadBtn.style.display = 'inline-block';
      if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
      if (autoSyncSection) {
        autoSyncSection.style.display = 'block';
        this.updateAutoSyncUI();
      }
    }
  }

  updateAutoSyncUI() {
    const status = this.autoSyncManager.getStatus();
    const statusEl = document.getElementById('autoSyncStatus');
    const enabledCheckbox = document.getElementById('autoSyncEnabled');
    const intervalInput = document.getElementById('autoSyncInterval');
    const onStartCheckbox = document.getElementById('autoSyncOnStart');
    const saveBtn = document.getElementById('saveAutoSyncBtn');

    if (status.enabled) {
      const lastSync = status.lastSyncTime 
        ? new Date(status.lastSyncTime).toLocaleString() 
        : '从未';
      statusEl.textContent = `已启用 | 间隔: ${status.interval}分钟 | 上次自动同步: ${lastSync}`;
      statusEl.style.color = '#4caf50';
    } else {
      statusEl.textContent = '未启用';
      statusEl.style.color = '#666';
    }

    if (enabledCheckbox) enabledCheckbox.checked = status.enabled;
    if (intervalInput) intervalInput.value = status.interval;
    if (onStartCheckbox) onStartCheckbox.checked = status.syncOnStart;

    if (saveBtn) {
      saveBtn.onclick = () => this.saveAutoSyncConfig();
    }
  }

  async saveAutoSyncConfig() {
    const enabled = document.getElementById('autoSyncEnabled').checked;
    const interval = parseInt(document.getElementById('autoSyncInterval').value) || 30;
    const syncOnStart = document.getElementById('autoSyncOnStart').checked;

    if (interval < 5) {
      alert('同步间隔不能小于5分钟');
      return;
    }

    await this.autoSyncManager.saveConfig({
      enabled,
      interval,
      syncOnStart
    });

    this.autoSyncManager.start();
    this.updateAutoSyncUI();
    this.showImportNotification('自动同步设置已保存');
  }

  loadWebDAVConfigToForm() {
    const config = this.webdavManager.config;
    if (config) {
      document.getElementById('webdavServerUrl').value = config.serverUrl || '';
      document.getElementById('webdavUsername').value = config.username || '';
      document.getElementById('webdavPassword').value = config.password || '';
      document.getElementById('webdavSyncPath').value = config.syncPath || '/newtab-sync/';
    } else {
      document.getElementById('webdavConfigForm').reset();
      document.getElementById('webdavSyncPath').value = '/newtab-sync/';
    }
    document.getElementById('webdavTestResult').textContent = '';
  }

  async testWebDAVConnection() {
    const serverUrl = document.getElementById('webdavServerUrl').value.trim();
    const username = document.getElementById('webdavUsername').value.trim();
    const password = document.getElementById('webdavPassword').value;
    const resultEl = document.getElementById('webdavTestResult');

    if (!serverUrl || !username || !password) {
      resultEl.textContent = '请填写所有必填字段';
      resultEl.style.color = '#f44336';
      return;
    }

    resultEl.textContent = '正在测试连接...';
    resultEl.style.color = '#666';

    const testConfig = { serverUrl, username, password };
    const success = await this.webdavManager.testConnection(testConfig);

    if (success) {
      resultEl.textContent = '连接成功！';
      resultEl.style.color = '#4caf50';
    } else {
      resultEl.textContent = '连接失败，请检查配置';
      resultEl.style.color = '#f44336';
    }
  }

  async saveWebDAVConfig() {
    const serverUrl = document.getElementById('webdavServerUrl').value.trim();
    const username = document.getElementById('webdavUsername').value.trim();
    const password = document.getElementById('webdavPassword').value;
    const syncPath = document.getElementById('webdavSyncPath').value.trim() || '/newtab-sync/';

    if (!serverUrl || !username || !password) {
      alert('请填写所有必填字段');
      return;
    }

    const config = { serverUrl, username, password, syncPath };
    const success = await this.webdavManager.saveConfig(config);

    if (success) {
      alert('WebDAV配置已保存');
      document.getElementById('webdavConfigDialog').classList.remove('active');
      await this.updateWebDAVStatus();
    } else {
      alert('保存配置失败');
    }
  }

  async syncToWebDAV() {
    const btn = document.getElementById('webdavUploadBtn');
    const originalText = btn.textContent;
    btn.textContent = '同步中...';
    btn.disabled = true;

    console.log('开始智能同步...');
    const result = await this.webdavManager.smartSync();
    console.log('同步结果:', result);

    btn.textContent = originalText;
    btn.disabled = false;

    if (result.success) {
      if (result.direction === 'upload') {
        this.showImportNotification('数据已上传到云端');
      } else if (result.direction === 'download') {
        await this.loadCustomBookmarks();
        await this.loadCardSize();
        await this.loadCardShape();
        await this.loadSortBy();
        this.renderBookmarks();
        this.updateLayout();
        this.showImportNotification('已从云端下载最新数据');
      } else if (result.direction === 'none') {
        this.showImportNotification('数据已是最新');
      } else {
        this.showImportNotification('同步完成');
      }
      await this.updateWebDAVStatus();
    } else {
      alert('同步失败: ' + (result.error || '未知错误'));
    }
  }

  async syncFromWebDAV() {
    if (!confirm('从云端下载将覆盖本地数据，是否继续？')) {
      return;
    }

    const btn = document.getElementById('webdavDownloadBtn');
    const originalText = btn.textContent;
    btn.textContent = '下载中...';
    btn.disabled = true;

    const result = await this.webdavManager.syncFromCloud();

    btn.textContent = originalText;
    btn.disabled = false;

    if (result.success) {
      await this.loadCustomBookmarks();
      await this.loadCardSize();
      await this.loadCardShape();
      await this.loadSortBy();
      this.renderBookmarks();
      this.updateLayout();
      this.showImportNotification('数据已从云端下载');
      await this.updateWebDAVStatus();
    } else {
      alert('下载失败: ' + result.error);
    }
  }

  async disconnectWebDAV() {
    if (!confirm('确定要断开WebDAV连接吗？')) {
      return;
    }

    await this.webdavManager.clearConfig();
    await this.updateWebDAVStatus();
    this.showImportNotification('WebDAV连接已断开');
  }
}

// 罗盘时钟 - 支持多个实例
function initCompassClock() {
  // 初始化添加按钮中的罗盘
  initCompassInButton();
}

// 在添加按钮中初始化罗盘
function initCompassInButton() {
  const hoursRing = document.getElementById('compassHoursBtn');
  const minutesRing = document.getElementById('compassMinutesBtn');
  const secondsRing = document.getElementById('compassSecondsBtn');
  const dateEl = document.getElementById('compassDateBtn');
  const weekdayEl = document.getElementById('compassWeekdayBtn');
  
  if (!hoursRing || !minutesRing || !secondsRing) {
    // 如果按钮还不存在，稍后重试
    setTimeout(initCompassInButton, 100);
    return;
  }
  
  // 创建光圈环 - 使用百分比位置
  function createGlowRing(container, count, radiusPercent, type) {
    container.innerHTML = '';
    container.dataset.type = type;
    container.dataset.count = count;
    
    // 创建光点背景环
    const glowTrack = document.createElement('div');
    glowTrack.className = 'compass-glow-track';
    container.appendChild(glowTrack);
    
    // 创建光点和数字
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360 - 90;
      const rad = (angle * Math.PI) / 180;
      // 使用百分比计算位置
      const x = 50 + radiusPercent * Math.cos(rad);
      const y = 50 + radiusPercent * Math.sin(rad);
      
      // 光点
      const dot = document.createElement('div');
      dot.className = 'compass-glow-dot';
      dot.dataset.value = i;
      dot.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
      `;
      container.appendChild(dot);
      
      // 数字
      const num = document.createElement('div');
      num.className = 'compass-number glow-number';
      num.dataset.value = i;
      num.textContent = i.toString().padStart(2, '0');
      num.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      container.appendChild(num);
    }
  }
  
  // 初始化 - 使用百分比半径
  createGlowRing(hoursRing, 24, 42, 'hours');   // 42% 半径
  createGlowRing(minutesRing, 60, 38, 'minutes'); // 38% 半径
  createGlowRing(secondsRing, 60, 30, 'seconds'); // 30% 半径
  
  // 更新时钟
  function update() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    
    // 更新日期
    if (dateEl) dateEl.textContent = `${now.getMonth() + 1}/${now.getDate()}`;
    if (weekdayEl) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      weekdayEl.textContent = weekdays[now.getDay()];
    }
    
    // 旋转环
    const hoursRotation = -h * 15;
    const minutesRotation = -m * 6;
    const secondsRotation = -s * 6;
    
    hoursRing.style.transform = `translate(-50%, -50%) rotate(${hoursRotation}deg)`;
    minutesRing.style.transform = `translate(-50%, -50%) rotate(${minutesRotation}deg)`;
    secondsRing.style.transform = `translate(-50%, -50%) rotate(${secondsRotation}deg)`;
    
    // 更新光圈环
    function updateGlowRing(container, current, rotation, total) {
      const dots = container.querySelectorAll('.compass-glow-dot');
      const numbers = container.querySelectorAll('.glow-number');
      const halfTotal = total / 2;
      
      dots.forEach((dot) => {
        dot.classList.remove('active', 'nearby');
        const val = parseInt(dot.dataset.value);
        
        if (val === current) {
          dot.classList.add('active');
        } else {
          let diff = val - current;
          if (diff < -halfTotal) diff += total;
          if (diff > halfTotal) diff -= total;
          if (Math.abs(diff) <= 3 && Math.abs(diff) > 0) {
            dot.classList.add('nearby');
          }
        }
      });
      
      numbers.forEach((num) => {
        const val = parseInt(num.dataset.value);
        num.classList.remove('active', 'nearby');
        
        if (val === current) {
          num.classList.add('active');
          num.style.opacity = '1';
        } else {
          let diff = val - current;
          if (diff < -halfTotal) diff += total;
          if (diff > halfTotal) diff -= total;
          if (Math.abs(diff) <= 2 && Math.abs(diff) > 0) {
            num.classList.add('nearby');
            num.style.opacity = '0.6';
          } else {
            num.style.opacity = '0';
          }
        }
        
        // 保持数字正向
        num.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
      });
    }
    
    updateGlowRing(hoursRing, h, hoursRotation, 24);
    updateGlowRing(minutesRing, m, minutesRotation, 60);
    updateGlowRing(secondsRing, s, secondsRotation, 60);
  }
  
  update();
  setInterval(update, 1000);
}

function showContextMenu(e, url) {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  e.preventDefault();
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.add('active');
  
  menu.dataset.url = url;
  
  const closeMenu = () => menu.classList.remove('active');
  setTimeout(() => {
    document.addEventListener('click', closeMenu, { once: true });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeMenu(); }, { once: true });
  }, 0);
}

function handleContextAction(action, url) {
  const menu = document.getElementById('contextMenu');
  menu.classList.remove('active');
  
  switch (action) {
    case 'currentTab':
      window.open(url, '_self');
      break;
    case 'newTab':
      window.open(url, '_blank');
      break;
    case 'edit':
      showEditDialog(url);
      break;
    case 'delete':
      deleteBookmark(url);
      break;
  }
}

function showEditDialog(url) {
  const dialog = document.getElementById('editDialog');
  const form = document.getElementById('editForm');
  if (!dialog || !form) return;
  
  const manager = window.bookmarksManager;
  const bookmark = manager.bookmarks.find(b => b.url === url);
  if (!bookmark) return;
  
  document.getElementById('editName').value = bookmark.name;
  document.getElementById('editUrl').value = bookmark.url;
  document.getElementById('editIcon').value = bookmark.icon || '';
  
  const searchInput = document.getElementById('logoSearchInput');
  if (searchInput && bookmark.url) {
    try {
      const urlObj = new URL(bookmark.url);
      searchInput.value = bookmark.name || urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      searchInput.value = bookmark.name || '';
    }
  }
  
  document.getElementById('logoSearchResults').innerHTML = '';
  
  form.onsubmit = async (e) => {
      e.preventDefault();
      bookmark.name = document.getElementById('editName').value;
      bookmark.url = document.getElementById('editUrl').value;
      bookmark.icon = document.getElementById('editIcon').value;

      await chrome.storage.local.set({
        customBookmarks: manager.customBookmarks,
        lastLocalModify: Date.now()
      });
      manager.renderBookmarks();
      dialog.classList.remove('active');
    };
  
  document.getElementById('cancelEditBtn').onclick = () => dialog.classList.remove('active');
  dialog.classList.add('active');
  
  setupLogoSearch();
  
  setTimeout(() => {
    if (searchInput && searchInput.value) {
      const searchBtn = document.getElementById('logoSearchBtn');
      if (searchBtn) searchBtn.click();
    }
  }, 200);
}

async function deleteBookmark(url) {
  const manager = window.bookmarksManager;
  const index = manager.bookmarks.findIndex(b => b.url === url);
  if (index === -1) return;

  if (!confirm('确定删除此书签？')) return;

  const deletedBookmark = manager.customBookmarks[index];
  manager.customBookmarks.splice(index, 1);

  const result = await chrome.storage.local.get('deletedBookmarks');
  const deletedBookmarks = result.deletedBookmarks || [];
  deletedBookmarks.push({
    url: deletedBookmark.url,
    name: deletedBookmark.name,
    deletedAt: Date.now()
  });

  await chrome.storage.local.set({
    customBookmarks: manager.customBookmarks,
    deletedBookmarks: deletedBookmarks,
    lastLocalModify: Date.now()
  });
  manager.bookmarks = [...manager.customBookmarks];
  manager.renderBookmarks();
}

function setupLogoSearch() {
  const logoSearchBtn = document.getElementById('logoSearchBtn');
  const logoSearchInput = document.getElementById('logoSearchInput');
  const logoSearchResults = document.getElementById('logoSearchResults');
  
  if (logoSearchBtn && logoSearchInput && logoSearchResults) {
    logoSearchBtn.onclick = null;
    logoSearchInput.onkeypress = null;
    
    logoSearchBtn.onclick = () => {
      performLogoSearch();
    };
    
    logoSearchInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        performLogoSearch();
      }
    };
  }
}

function performLogoSearch() {
  const logoSearchInput = document.getElementById('logoSearchInput');
  const logoSearchResults = document.getElementById('logoSearchResults');
  
  if (!logoSearchInput || !logoSearchResults) return;
  
  const searchTerm = logoSearchInput.value.trim();
  if (!searchTerm) {
    logoSearchResults.innerHTML = '<p style="text-align:center;padding:10px;color:#333;">请输入搜索关键词</p>';
    return;
  }
  
  logoSearchResults.classList.add('active');
  logoSearchResults.innerHTML = '<p style="text-align:center;padding:20px;">正在搜索...</p>';
  
  chrome.runtime.sendMessage({
    action: 'searchLogo',
    searchTerm: searchTerm
  }, function(response) {
    if (response && response.success) {
      displayLogoResults(response.items);
    } else {
      displaySearchError(response?.error || '搜索失败');
    }
  });
}

function displayLogoResults(logoItems) {
  const logoSearchResults = document.getElementById('logoSearchResults');
  if (!logoSearchResults) return;
  
  if (logoItems.length === 0) {
    logoSearchResults.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <h5>未找到匹配的 Logo</h5>
        <p>请尝试使用其他关键词搜索</p>
      </div>
    `;
    return;
  }
  
  const iconInput = document.getElementById('editIcon');
  
  const resultsHtml = `
    <h5 style="margin-bottom:10px;">搜索结果 (${logoItems.length}个):</h5>
    <div class="results-grid" style="display:flex;flex-wrap:wrap;gap:10px;">
      ${logoItems.map((item, index) => `
        <div class="result-item" data-logo-url="${item.url}" data-logo-name="${item.name}" style="cursor:pointer;text-align:center;">
          <img src="${item.url}" alt="${item.name}" style="width:48px;height:48px;border-radius:8px;object-fit:contain;background:white;padding:2px;border:2px solid transparent;">
          <div style="font-size:0.7rem;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">${item.name}</div>
        </div>
      `).join('')}
    </div>
  `;
  
  logoSearchResults.innerHTML = resultsHtml;
  
  document.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', function() {
      const logoUrl = this.dataset.logoUrl;
      
      if (iconInput) {
        iconInput.value = logoUrl;
      }
      
      document.querySelectorAll('.result-item img').forEach(img => {
        img.style.borderColor = 'transparent';
      });
      this.querySelector('img').style.borderColor = '#667eea';
    });
  });
}

function displaySearchError(errorMessage) {
  const logoSearchResults = document.getElementById('logoSearchResults');
  if (!logoSearchResults) return;
  
  logoSearchResults.innerHTML = `
    <div style="text-align:center;padding:20px;color:#ff6b6b;">
      <h5>搜索失败</h5>
      <p>${errorMessage}</p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  // 初始化罗盘时钟
  initCompassClock();
  
  const menu = document.getElementById('contextMenu');
  if (menu) {
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => handleContextAction(item.dataset.action, menu.dataset.url));
    });
  }
  
  new BookmarksManager();
});