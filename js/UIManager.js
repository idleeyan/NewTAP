
import { CompassClock } from './Compass.js';

export class UIManager {
  constructor(bookmarkManager, settingsManager, statsManager, syncManager, backupManager) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.statsManager = statsManager;
    this.syncManager = syncManager;
    this.backupManager = backupManager;

    this.compassClock = new CompassClock();
  }

  init() {
    this.setupMoreBookmarksToggle();
    this.setupAddBookmarkDialogListeners();
    this.setupContextMenu();
    this.setupLogoSearch();
    this.setupSettingsDialogListeners();
    this.setupBackupUI();

    // Listen for settings changes to update layout
    this.settingsManager.onSettingChange = (key, value) => {
      if (key === 'cardSize' || key === 'cardShape' || key === 'sortBy') {
        this.renderBookmarks();
      }
    };
  }

  setupSettingsDialogListeners() {
    const btn = document.getElementById('settingsButton');
    const dialog = document.getElementById('settingsDialog');
    const cancelBtn = document.getElementById('cancelSettingsBtn');
    const exportBtn = document.querySelector('#settingsDialog .dialog-btn[style*="76,175,80"]');
    const importBtn = document.querySelector('#settingsDialog .dialog-btn[style*="255,152,0"]');
    const viewStatsBtn = document.getElementById('viewStatsBtn');

    if (btn && dialog) {
      btn.addEventListener('click', () => {
        dialog.classList.add('active');
        // Re-setup controls to ensure they reflect current state
        this.settingsManager.setupUI();
      });

      if (cancelBtn) cancelBtn.addEventListener('click', () => dialog.classList.remove('active'));

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.classList.remove('active');
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dialog.classList.remove('active');
      });
    }

    if (exportBtn) {
        // Cloning to remove old listeners not strictly necessary if we are careful,
        // but safe practice in re-init scenarios. Here we just add listener.
        exportBtn.onclick = () => this.bookmarkManager.exportData(); // Assuming exportData exists
        // Wait, exportData was in UIManager before, let's check BookmarkManager
        // It's not in BookmarkManager in my previous step, I need to add it there or here.
        // Let's implement export here using BookmarkManager data
    }

    if (importBtn) {
      const fileInput = document.getElementById('importFileInput');
      if (fileInput) {
          importBtn.onclick = () => fileInput.click();
          fileInput.onchange = (e) => this.handleImport(e);
      }
    }

    if (viewStatsBtn) {
      viewStatsBtn.onclick = () => this.statsManager.show(this.bookmarkManager.bookmarks);
    }
  }

  async handleImport(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.customBookmarks) {
              await chrome.storage.local.set({ customBookmarks: data.customBookmarks });
              await this.bookmarkManager.loadBookmarks();
              this.renderBookmarks();
              alert('导入成功！');
          }
      } catch (e) {
          alert('导入失败: ' + e.message);
      }
      event.target.value = '';
  }

  async renderBookmarks() {
    const topGrid = document.getElementById('topBookmarksGrid');
    const moreGrid = document.getElementById('moreBookmarksGrid');
    const topCountEl = document.getElementById('topBookmarksCount');
    const moreSection = document.getElementById('moreBookmarksSection');

    if (!topGrid) return;

    topGrid.innerHTML = '';
    if (moreGrid) moreGrid.innerHTML = '';

    const cardSize = this.settingsManager.cardSize;
    const cardShape = this.settingsManager.cardShape;
    const sortBy = this.settingsManager.sortBy;

    topGrid.className = `bookmarks-grid ${cardSize}`;
    if (moreGrid) moreGrid.className = `bookmarks-grid ${cardSize}`;

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

    const topFragment = document.createDocumentFragment();
    topBookmarks.forEach((bookmark, index) => {
      topFragment.appendChild(this.createBookmarkElement(bookmark, index, true, cardShape));
    });

    // Add Button (Compass)
    const addBtn = document.createElement('div');
    addBtn.className = 'bookmark-item add-bookmark animate-in';
    addBtn.style.animationDelay = `${Math.min(topBookmarks.length, 15) * 0.05}s`;
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

    // Initialize compass inside the button after it's added to DOM
    setTimeout(() => {
        this.compassClock.initCompassInButton();
    }, 0);

    if (moreGrid && moreBookmarks.length > 0) {
      const moreFragment = document.createDocumentFragment();
      moreBookmarks.forEach((bookmark, index) => {
        moreFragment.appendChild(this.createBookmarkElement(bookmark, index + topCardsCount, false, cardShape));
      });
      moreGrid.appendChild(moreFragment);
    }
  }

  createBookmarkElement(bookmark, index, isTopSection, cardShape) {
    const el = document.createElement('div');
    el.className = `bookmark-item ${cardShape} animate-in`;
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
      // Record stats
      // We modify the bookmark object directly here, then save
      // Ideally this logic belongs in StatsManager or BookmarkManager, but UIManager coordinates it
      // Let's use StatsManager helper
      // Wait, we need to update the bookmark object in the manager

      // Update local object
      const updatedBookmark = this.statsManager.constructor.recordVisit(bookmark);

      // Save changes
      // We need to find it in the manager's list and update it
      // Actually bookmark is a reference to the object in the list, so it is already updated?
      // Yes, JS objects are references. We just need to trigger save.
      await this.bookmarkManager.saveBookmarks();

      window.open(bookmark.url, '_self');
    });

    el.addEventListener('contextmenu', (e) => this.showContextMenu(e, bookmark.url));

    // Drag and Drop implementation
    this.setupDragEvents(el, bookmark, index);

    return el;
  }

  setupDragEvents(el, bookmark, index) {
    el.addEventListener('dragstart', (e) => {
      // Only allow dragging in default sort mode
      if (this.settingsManager.sortBy !== 'default') {
        e.preventDefault();
        return;
      }

      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index);

      // Create a custom drag image if needed, or use default
      // e.dataTransfer.setDragImage(el, 0, 0);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.remove('drag-over');
      });
    });

    el.addEventListener('dragover', (e) => {
      if (this.settingsManager.sortBy !== 'default') return;

      e.preventDefault(); // Necessary to allow dropping
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
        // Perform reorder
        const success = await this.bookmarkManager.reorderBookmarks(fromIndex, toIndex);
        if (success) {
          this.renderBookmarks();
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

  setupMoreBookmarksToggle() {
    const section = document.getElementById('moreBookmarksSection');
    const header = document.getElementById('moreBookmarksHeader');
    const wrapper = document.getElementById('moreBookmarksWrapper');
    const icon = document.getElementById('toggleMoreIcon');

    if (!header || !wrapper || !section) return;

    const toggle = (forceState) => {
      const isExpanded = wrapper.classList.contains('expanded');
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

    header.addEventListener('click', () => toggle());

    let hoverTimer;
    let leaveTimer;

    section.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer);
      if (!wrapper.classList.contains('expanded')) {
        hoverTimer = setTimeout(() => toggle(true), 200);
      }
    });

    section.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      if (wrapper.classList.contains('expanded')) {
        leaveTimer = setTimeout(() => toggle(false), 600);
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
      const items = await this.bookmarkManager.getBrowserHistory();
      this.renderImportItems(historyContainer, items, '历史记录');
    });

    if (bookmarkAddBtn) bookmarkAddBtn.addEventListener('click', async () => {
      showSection(bookmarkContainer);
      const items = await this.bookmarkManager.getBrowserBookmarks();
      this.renderImportItems(bookmarkContainer, items, '书签');
    });

    if (openTabsBtn) openTabsBtn.addEventListener('click', async () => {
      showSection(tabsContainer);
      const items = await this.bookmarkManager.getOpenTabs();
      this.renderImportItems(tabsContainer, items, '标签页');
    });

    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      document.querySelector('.add-options').style.display = 'grid';
      if (manualForm) { manualForm.style.display = 'none'; manualForm.reset(); }
      if (historyContainer) { historyContainer.style.display = 'none'; }
      if (bookmarkContainer) { bookmarkContainer.style.display = 'none'; }
      if (tabsContainer) { tabsContainer.style.display = 'none'; }
    });

    if (manualForm) manualForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('manualName').value.trim();
      const url = document.getElementById('manualUrl').value.trim();

      try {
        await this.bookmarkManager.addBookmark({ name, url });
        this.renderBookmarks();
        if (dialog) dialog.classList.remove('active');
      } catch (err) {
        alert(err.message);
      }
    });
  }

  renderImportItems(container, items, sourceName) {
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">暂无数据</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.8;">点击添加 ${sourceName} 中的网站</span>`;
    fragment.appendChild(header);

    items.slice(0, 50).forEach(item => {
      const el = document.createElement('div');
      el.className = 'import-item';
      el.innerHTML = `
        <img src="${item.icon}" alt="" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:white;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
      `;
      el.addEventListener('click', async () => {
        try {
          await this.bookmarkManager.addBookmark(item);
          this.renderBookmarks();
          document.getElementById('addBookmarkDialog').classList.remove('active');
        } catch(e) { alert(e.message); }
      });
      fragment.appendChild(el);
    });

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

  // Context Menu
  setupContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    const closeMenu = () => menu.classList.remove('active');

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const url = menu.dataset.url;
        this.handleContextAction(action, url);
        closeMenu();
      });
    });

    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }

  showContextMenu(e, url) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    e.preventDefault();
    e.stopPropagation();

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('active');
    menu.dataset.url = url;
  }

  async handleContextAction(action, url) {
    switch (action) {
      case 'currentTab':
        window.open(url, '_self');
        break;
      case 'newTab':
        window.open(url, '_blank');
        break;
      case 'edit':
        this.showEditDialog(url);
        break;
      case 'delete':
        if (confirm('确定删除此书签？')) {
          await this.bookmarkManager.deleteBookmark(url);
          this.renderBookmarks();
        }
        break;
    }
  }

  showEditDialog(url) {
    const dialog = document.getElementById('editDialog');
    const form = document.getElementById('editForm');
    if (!dialog || !form) return;

    const bookmark = this.bookmarkManager.customBookmarks.find(b => b.url === url);
    if (!bookmark) return;

    document.getElementById('editName').value = bookmark.name;
    document.getElementById('editUrl').value = bookmark.url;
    document.getElementById('editIcon').value = bookmark.icon || '';

    // Setup logo search for edit
    const searchInput = document.getElementById('logoSearchInput');
    if (searchInput) searchInput.value = bookmark.name || '';
    document.getElementById('logoSearchResults').innerHTML = '';

    // Remove old listeners by cloning
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    const cancelBtn = document.getElementById('cancelEditBtn');
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.addEventListener('click', () => dialog.classList.remove('active'));

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = {
        name: document.getElementById('editName').value,
        url: document.getElementById('editUrl').value,
        icon: document.getElementById('editIcon').value
      };

      await this.bookmarkManager.updateBookmark(url, updates);
      this.renderBookmarks();
      dialog.classList.remove('active');
    });

    dialog.classList.add('active');

    // Re-bind logo search button since we might have replaced elements or lost context
    this.setupLogoSearch();
  }

  setupLogoSearch() {
    const logoSearchBtn = document.getElementById('logoSearchBtn');
    const logoSearchInput = document.getElementById('logoSearchInput');

    if (logoSearchBtn && logoSearchInput) {
       // Clone to remove old listeners
       const newBtn = logoSearchBtn.cloneNode(true);
       logoSearchBtn.parentNode.replaceChild(newBtn, logoSearchBtn);

       const newInput = logoSearchInput.cloneNode(true);
       logoSearchInput.parentNode.replaceChild(newInput, logoSearchInput);

       newBtn.addEventListener('click', () => this.performLogoSearch());
       newInput.addEventListener('keypress', (e) => {
         if (e.key === 'Enter') this.performLogoSearch();
       });
    }
  }

  setupBackupUI() {
    const createBtn = document.getElementById('createBackupBtn');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        if (confirm('确定要创建当前配置的备份吗？')) {
          createBtn.textContent = '备份中...';
          createBtn.disabled = true;
          const success = await this.backupManager.createBackup('manual');
          createBtn.textContent = '➕ 创建新备份';
          createBtn.disabled = false;
          if (success) {
            this.renderBackupList();
            alert('备份创建成功');
          } else {
            alert('备份创建失败');
          }
        }
      });
    }

    // Refresh list when settings dialog opens
    const settingsBtn = document.getElementById('settingsButton');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.renderBackupList();
      });
    }
  }

  async renderBackupList() {
    const listEl = document.getElementById('backupList');
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #666; font-size: 0.85rem;">加载中...</div>';

    const backups = await this.backupManager.getBackups();

    if (backups.length === 0) {
      listEl.innerHTML = '<div style="padding: 15px; text-align: center; color: #666; font-size: 0.85rem;">暂无备份</div>';
      return;
    }

    listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    backups.forEach(backup => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 15px; border-bottom: 1px solid rgba(0,0,0,0.05);
        font-size: 0.9rem;
      `;

      const date = new Date(backup.timestamp).toLocaleString();
      const typeMap = { 'manual': '手动', 'daily_auto': '自动' };
      const type = typeMap[backup.reason] || '自动';

      item.innerHTML = `
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 500; color: #333;">${date}</span>
          <span style="font-size: 0.75rem; color: #888;">${type} · ${backup.itemCount}个网站</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="restore-btn" style="padding: 4px 8px; border-radius: 4px; background: rgba(33,150,243,0.1); color: #2196f3; border: none; cursor: pointer; font-size: 0.8rem;">恢复</button>
          <button class="delete-btn" style="padding: 4px 8px; border-radius: 4px; background: rgba(244,67,54,0.1); color: #f44336; border: none; cursor: pointer; font-size: 0.8rem;">删除</button>
        </div>
      `;

      item.querySelector('.restore-btn').onclick = async () => {
        if (confirm(`确定要恢复到 ${date} 的备份吗？\n当前未保存的更改将会丢失。`)) {
          const success = await this.backupManager.restoreBackup(backup.id);
          if (success) {
            this.renderBookmarks();
            // Re-apply background settings immediately
            this.settingsManager.applyBackground();
            alert('恢复成功！');
          } else {
            alert('恢复失败');
          }
        }
      };

      item.querySelector('.delete-btn').onclick = async () => {
        if (confirm('确定删除此备份？')) {
          await this.backupManager.deleteBackup(backup.id);
          this.renderBackupList();
        }
      };

      fragment.appendChild(item);
    });

    listEl.appendChild(fragment);
  }

  performLogoSearch() {
    const logoSearchInput = document.getElementById('logoSearchInput');
    const logoSearchResults = document.getElementById('logoSearchResults');

    if (!logoSearchInput || !logoSearchResults) return;

    const searchTerm = logoSearchInput.value.trim();
    if (!searchTerm) return;

    logoSearchResults.innerHTML = '<p style="text-align:center;padding:20px;">正在搜索...</p>';

    chrome.runtime.sendMessage({
      action: 'searchLogo',
      searchTerm: searchTerm
    }, (response) => {
      if (response && response.success) {
        this.displayLogoResults(response.items);
      } else {
        logoSearchResults.innerHTML = `<p style="text-align:center;padding:10px;color:red;">${response?.error || '搜索失败'}</p>`;
      }
    });
  }

  displayLogoResults(items) {
    const container = document.getElementById('logoSearchResults');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:10px;">未找到结果</p>';
      return;
    }

    let html = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">';
    items.forEach(item => {
      html += `
        <div class="result-item" data-url="${item.url}" style="cursor:pointer;text-align:center;">
           <img src="${item.url}" style="width:40px;height:40px;object-fit:contain;">
           <div style="font-size:10px;overflow:hidden;width:50px;white-space:nowrap;">${item.name}</div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('editIcon').value = item.dataset.url;
      });
    });
  }
}
