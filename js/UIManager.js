import { CompassClock } from './Compass.js';
import { BookmarkRenderer, StickyNotesRenderer, StatsRenderer, PageNavigator, ScrollNavigator } from './ui/index.js';

export class UIManager {
  constructor(bookmarkManager, settingsManager, statsManager, syncManager, backupManager, stickyNoteManager) {
    this.bookmarkManager = bookmarkManager;
    this.settingsManager = settingsManager;
    this.statsManager = statsManager;
    this.syncManager = syncManager;
    this.backupManager = backupManager;
    this.stickyNoteManager = stickyNoteManager;

    this.compassClock = new CompassClock();

    this.bookmarkRenderer = new BookmarkRenderer(
      bookmarkManager,
      settingsManager,
      statsManager,
      this.compassClock
    );

    this.stickyNotesRenderer = new StickyNotesRenderer(stickyNoteManager);
    this.statsRenderer = new StatsRenderer(bookmarkManager);
    this.pageNavigator = new PageNavigator();
    this.scrollNavigator = new ScrollNavigator(this.pageNavigator, {
      threshold: 50,
      debounceDelay: 300,
      animationDuration: 400,
      enableHistory: true
    });
  }

  init() {
    this.setupAddBookmarkDialogListeners();
    this.setupContextMenu();
    this.setupLogoSearch();
    this.setupSettingsDialogListeners();
    this.setupBackupUI();
    this.setupPageSwipe();
    this.setupStickyNotes();
    this.scrollNavigator.setup();

    this.settingsManager.onSettingChange = (key, value) => {
      if (key === 'cardSize' || key === 'cardShape' || key === 'sortBy') {
        this.renderBookmarks();
      }
    };

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.renderBookmarks();
      }, 200);
    });
  }

  setupSettingsDialogListeners() {
    const btn = document.getElementById('settingsButton');
    const dialog = document.getElementById('settingsDialog');
    const cancelBtn = document.getElementById('cancelSettingsBtn');
    const exportBtn = document.querySelector('#settingsDialog .dialog-btn[style*="76,175,80"]');
    const importBtn = document.querySelector('#settingsDialog .dialog-btn[style*="255,152,0"]');

    if (btn && dialog) {
      btn.addEventListener('click', () => {
        dialog.classList.add('active');
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
      exportBtn.onclick = () => this.bookmarkManager.exportData();
    }

    if (importBtn) {
      const fileInput = document.getElementById('importFileInput');
      if (fileInput) {
        importBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleImport(e);
      }
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

  renderBookmarks() {
    this.bookmarkRenderer.render();
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

    const searchInput = document.getElementById('logoSearchInput');
    if (searchInput) searchInput.value = bookmark.name || '';
    document.getElementById('logoSearchResults').innerHTML = '';

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
    this.setupLogoSearch();
  }

  setupLogoSearch() {
    const logoSearchBtn = document.getElementById('logoSearchBtn');
    const logoSearchInput = document.getElementById('logoSearchInput');

    if (logoSearchBtn && logoSearchInput) {
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

    let floatingPreview = document.getElementById('logoFloatingPreview');
    if (!floatingPreview) {
      floatingPreview = document.createElement('div');
      floatingPreview.id = 'logoFloatingPreview';
      floatingPreview.className = 'logo-preview-floating';
      floatingPreview.innerHTML = `
        <div class="preview-content">
          <img src="" alt="预览" id="logoFloatingImg">
          <div class="preview-name" id="logoFloatingName"></div>
        </div>
      `;
      document.body.appendChild(floatingPreview);
    }

    const previewImg = document.getElementById('logoFloatingImg');
    const previewName = document.getElementById('logoFloatingName');

    let html = `<div class="logo-grid">`;
    items.forEach((item, index) => {
      html += `
        <div class="logo-result-item" data-url="${item.url}" data-index="${index}">
           <img src="${item.url}" alt="${item.name}" loading="lazy">
           <div class="logo-name">${item.name}</div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;

    const updatePreviewPosition = (item) => {
      const rect = item.getBoundingClientRect();
      const previewWidth = 180;
      const previewHeight = 180;
      const padding = 15;
      
      let left = rect.right + padding;
      let top = rect.top + (rect.height / 2) - (previewHeight / 2);
      
      if (left + previewWidth + padding > window.innerWidth) {
        left = rect.left - previewWidth - padding;
      }
      
      if (left < padding) {
        left = padding;
      }
      
      if (top < padding) {
        top = padding;
      }
      
      if (top + previewHeight + padding > window.innerHeight) {
        top = window.innerHeight - previewHeight - padding;
      }
      
      floatingPreview.style.left = `${left}px`;
      floatingPreview.style.top = `${top}px`;
    };

    container.querySelectorAll('.logo-result-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        const url = item.dataset.url;
        const name = item.querySelector('.logo-name').textContent;
        
        previewImg.src = url;
        previewName.textContent = name;
        
        updatePreviewPosition(item);
        floatingPreview.classList.add('active');
      });

      item.addEventListener('mousemove', () => {
        updatePreviewPosition(item);
      });

      item.addEventListener('mouseleave', () => {
        floatingPreview.classList.remove('active');
      });

      item.addEventListener('click', () => {
        container.querySelectorAll('.logo-result-item').forEach(i => {
          i.classList.remove('selected');
        });
        item.classList.add('selected');
        document.getElementById('editIcon').value = item.dataset.url;
      });
    });

    const grid = container.querySelector('.logo-grid');
    if (grid) {
      grid.addEventListener('scroll', () => {
        const hoveredItem = container.querySelector('.logo-result-item:hover');
        if (hoveredItem) {
          updatePreviewPosition(hoveredItem);
        } else {
          floatingPreview.classList.remove('active');
        }
      });
    }
  }

  setupPageSwipe() {
    this.pageNavigator.setup(
      () => this.renderNotes(),
      () => {},
      () => this.renderStats(),
      () => {}
    );
  }

  renderNotes() {
    this.stickyNotesRenderer.render();
  }

  renderStats() {
    this.statsRenderer.render();
  }

  setupStickyNotes() {
    const addBtn = document.getElementById('addNoteBtn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const note = await this.stickyNoteManager.createNote();
        this.renderNotes();

        setTimeout(() => {
          const titleInput = document.querySelector(`[data-note-id="${note.id}"] .note-title-input`);
          if (titleInput) titleInput.focus();
        }, 100);
      });
    }
  }
}
