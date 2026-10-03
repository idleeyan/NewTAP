import { CompassClock } from './Compass.js';
import { BookmarkRenderer, StickyNotesRenderer, StatsRenderer, PageNavigator, IconLibraryRenderer } from './ui/index.js';
import { iconCache } from './IconCache.js';
import { iconLibrary } from './IconLibrary.js';

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
      statsManager
    );

    this.stickyNotesRenderer = new StickyNotesRenderer(stickyNoteManager);
    this.statsRenderer = new StatsRenderer(bookmarkManager);
    this.pageNavigator = new PageNavigator();
    this.iconLibraryRenderer = new IconLibraryRenderer();
  }

  init() {
    this.setupAddBookmarkDialogListeners();
    this.setupContextMenu();
    this.setupLogoSearch();
    this.setupIconLibrary();
    this.setupSettingsDialogListeners();
    this.setupBackupUI();
    this.setupPageSwipe();
    this.setupStickyNotes();

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

    this._initToast();
    this._showVersion();
  }

  /** 在设置弹窗展示当前扩展版本，便于用户确认自己使用的版本 */
  _showVersion() {
    const el = document.getElementById('settingsVersion');
    if (!el) return;
    try {
      const v = chrome.runtime.getManifest?.()?.version;
      if (v) el.textContent = `v${v}`;
    } catch { /* ignore */ }
  }

  _initToast() {
    if (document.getElementById('toastContainer')) return;
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }

  showToast(message, type = 'info') {
    this._initToast();
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: { bg: 'rgba(76, 175, 80, 0.95)', border: 'rgba(76, 175, 80, 0.6)' },
      error: { bg: 'rgba(244, 67, 54, 0.95)', border: 'rgba(244, 67, 54, 0.6)' },
      info: { bg: 'rgba(102, 126, 234, 0.95)', border: 'rgba(102, 126, 234, 0.6)' }
    };
    const c = colors[type] || colors.info;

    toast.style.cssText = `padding:12px 24px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;background:${c.bg};border:1px solid ${c.border};backdrop-filter:blur(10px);box-shadow:0 4px 16px rgba(0,0,0,0.2);opacity:0;transform:translateY(-12px);transition:all 0.3s ease;pointer-events:auto;max-width:400px;text-align:center;`;
    toast.textContent = message;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-12px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        this.showToast('添加成功', 'success');
      } catch (err) {
        this.showToast(err.message || '添加失败', 'error');
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
      el.dataset.name = item.name;
      el.dataset.url = item.url;
      el.dataset.icon = item.icon || '';
      el.innerHTML = `
        <img src="${item.icon}" alt="" loading="lazy" onerror="this.style.display='none'" style="width:24px;height:24px;border-radius:4px;object-fit:contain;background:white;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</span>
      `;
      fragment.appendChild(el);
    });

    container.appendChild(fragment);

    if (!container._importClickAttached) {
      container._importClickAttached = true;
      container.addEventListener('click', async (e) => {
        const el = e.target.closest('.import-item');
        if (!el) return;
        try {
          await this.bookmarkManager.addBookmark({
            name: el.dataset.name,
            url: el.dataset.url,
            icon: el.dataset.icon
          });
          this.renderBookmarks();
          document.getElementById('addBookmarkDialog').classList.remove('active');
          this.showToast('添加成功', 'success');
        } catch(e) { this.showToast(e.message || '添加失败', 'error'); }
      });
    }
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

    dialog.dataset.editUrl = url;
    document.getElementById('editName').value = bookmark.name;
    document.getElementById('editUrl').value = bookmark.url;
    document.getElementById('editIcon').value = bookmark.icon || '';
    this._updateIconPreview(bookmark.icon);

    const searchInput = document.getElementById('logoSearchInput');
    if (searchInput) searchInput.value = bookmark.name || '';
    document.getElementById('logoSearchResults').innerHTML = '';

    if (!form._editSubmitAttached) {
      form._editSubmitAttached = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editUrl = dialog.dataset.editUrl;
        if (!editUrl) return;
        const updates = {
          name: document.getElementById('editName').value,
          url: document.getElementById('editUrl').value,
          icon: document.getElementById('editIcon').value
        };
        await this.bookmarkManager.updateBookmark(editUrl, updates);
        // 换 logo/改名必须强制重建卡片，避免渲染键缓存导致“要手动刷新”
        this.bookmarkRenderer.invalidate();
        this.renderBookmarks();
        dialog.classList.remove('active');
        this.showToast('已保存', 'success');

        // 远程图标立即转存为 data URI 并再刷一次，避免外链防盗链/缓存导致看起来没更新
        const newIcon = updates.icon;
        if (newIcon && !newIcon.startsWith('data:')) {
          const targetUrl = updates.url || editUrl;
          iconCache.fetchAndCache(newIcon, targetUrl).then((dataUri) => {
            if (!dataUri) return;
            const bm = this.bookmarkManager.customBookmarks.find(b => b.url === targetUrl || b.url === editUrl);
            if (bm && bm.icon === newIcon) {
              this.bookmarkRenderer.invalidate();
              this.renderBookmarks();
            }
          }).catch(() => {});
        }
      });
    }

    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn && !cancelBtn._editCancelAttached) {
      cancelBtn._editCancelAttached = true;
      cancelBtn.addEventListener('click', () => dialog.classList.remove('active'));
    }

    dialog.classList.add('active');
    this.setupLogoSearch();
  }

  setupLogoSearch() {
    const logoSearchBtn = document.getElementById('logoSearchBtn');
    const logoSearchInput = document.getElementById('logoSearchInput');

    if (!logoSearchBtn || !logoSearchInput) return;

    if (!logoSearchBtn._logoSearchAttached) {
      logoSearchBtn._logoSearchAttached = true;
      logoSearchBtn.addEventListener('click', () => this.performLogoSearch());
    }

    if (!logoSearchInput._logoSearchAttached) {
      logoSearchInput._logoSearchAttached = true;
      logoSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.performLogoSearch();
      });
    }
  }

  /** 图标库：编辑中则写入图标URL，否则收入「我的收藏」 */
  setupIconLibrary() {
    this.iconLibraryRenderer.init(async (dataUri, name) => {
      const editing = document.getElementById('editDialog')?.classList.contains('active');
      if (editing) {
        const input = document.getElementById('editIcon');
        if (input) input.value = dataUri;
        this._updateIconPreview(dataUri);
        this.showToast(`已选用「${name}」的图标`, 'success');
      } else {
        const ok = await iconLibrary.addUserIcon({ name, dataUri });
        this.showToast(ok ? `已收藏「${name}」` : '这个图标已在收藏里', ok ? 'success' : 'info');
      }
      this.iconLibraryRenderer.close();
    });

    // 设置里批量套用预设 LOGO / 直接打开图库
    const applyBtn = document.getElementById('applyPresetIconsBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        applyBtn.disabled = true;
        const count = await this.bookmarkManager.applyPresetIcons();
        applyBtn.disabled = false;
        if (count > 0) {
          this.bookmarkRenderer.invalidate();
          this.renderBookmarks();
          this.showToast(`已为 ${count} 个网站套用预设图标`, 'success');
        } else {
          this.showToast('没有可套用的网站（已全部是预设或自定义图标）', 'info');
        }
      });
    }

    document.getElementById('openIconLibraryFromSettingsBtn')
      ?.addEventListener('click', () => this.iconLibraryRenderer.open());

    const editIcon = document.getElementById('editIcon');
    if (editIcon && !editIcon._previewAttached) {
      editIcon._previewAttached = true;
      editIcon.addEventListener('input', () => this._updateIconPreview(editIcon.value.trim()));
    }
  }

  /** 编辑弹窗内的图标即时预览 */
  _updateIconPreview(src) {
    const box = document.getElementById('editIconPreview');
    if (!box) return;
    const img = box.querySelector('img');
    if (!src) { box.style.display = 'none'; return; }
    if (img) img.src = src;
    box.style.display = 'flex';
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
      item.className = 'backup-list-item';
      item.dataset.backupId = backup.id;
      item.dataset.backupDate = new Date(backup.timestamp).toLocaleString();
      item.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 15px; border-bottom: 1px solid rgba(0,0,0,0.05);
        font-size: 0.9rem;
      `;

      const date = item.dataset.backupDate;
      const typeMap = { 'manual': '手动', 'daily_auto': '自动' };
      const type = typeMap[backup.reason] || '自动';

      item.innerHTML = `
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 500; color: #333;">${date}</span>
          <span style="font-size: 0.75rem; color: #888;">${type} · ${backup.itemCount}个网站</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="restore-btn" data-action="restore" style="padding: 4px 8px; border-radius: 4px; background: rgba(33,150,243,0.1); color: #2196f3; border: none; cursor: pointer; font-size: 0.8rem;">恢复</button>
          <button class="delete-btn" data-action="delete" style="padding: 4px 8px; border-radius: 4px; background: rgba(244,67,54,0.1); color: #f44336; border: none; cursor: pointer; font-size: 0.8rem;">删除</button>
        </div>
      `;

      fragment.appendChild(item);
    });

    listEl.appendChild(fragment);

    if (!listEl._backupClickAttached) {
      listEl._backupClickAttached = true;
      listEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const item = btn.closest('.backup-list-item');
        if (!item) return;

        const backupId = item.dataset.backupId;
        const date = item.dataset.backupDate;
        const action = btn.dataset.action;

        if (action === 'restore') {
          if (confirm(`确定要恢复到 ${date} 的备份吗？\n当前未保存的更改将会丢失。`)) {
            const success = await this.backupManager.restoreBackup(Number(backupId));
            if (success) {
              this.renderBookmarks();
              this.settingsManager.applyBackground();
              alert('恢复成功！');
            } else {
              alert('恢复失败');
            }
          }
        } else if (action === 'delete') {
          if (confirm('确定删除此备份？')) {
            await this.backupManager.deleteBackup(Number(backupId));
            this.renderBackupList();
          }
        }
      });
    }
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

    // 来源可靠性排序：必应（源站直链）最前、搜狗次之、百度图床（扩展环境 ERR_CONNECTION_CLOSED）最后
    const sourceScore = (name) => name.includes('_bing_') ? 0 : name.includes('_sogou_') ? 1 : 2;
    items = [...items].sort((a, b) => sourceScore(a.name) - sourceScore(b.name));

    let floatingPreview = document.getElementById('logoFloatingPreview');
    if (!floatingPreview) {
      floatingPreview = document.createElement('div');
      floatingPreview.id = 'logoFloatingPreview';
      floatingPreview.className = 'logo-preview-floating';
      floatingPreview.innerHTML = `
        <div class="preview-content">
          <img src="" alt="预览" id="logoFloatingImg" referrerpolicy="no-referrer">
          <div class="preview-name" id="logoFloatingName"></div>
        </div>
      `;
      document.body.appendChild(floatingPreview);
    }

    const previewImg = document.getElementById('logoFloatingImg');
    const previewName = document.getElementById('logoFloatingName');

    // 预览图加载失败时隐藏浮层（百度图床在扩展环境不稳定）
    previewImg.onerror = () => floatingPreview.classList.remove('active');

    let html = `<div class="logo-grid">`;
    items.forEach((item, index) => {
      html += `
        <div class="logo-result-item" data-url="${item.url}" data-datauri="" data-name="${item.name}" data-index="${index}">
           <img src="${item.url}" alt="${item.name}" loading="lazy" referrerpolicy="no-referrer">
           <div class="logo-name">${item.name}</div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;

    // 直接加载原 URL（搜狗/必应等可正常显示）；加载失败时走 background 代理转 data URI 兜底（百度图床等）
    container.querySelectorAll('.logo-result-item img').forEach(img => {
      const item = img.closest('.logo-result-item');
      const url = item.dataset.url;
      img.addEventListener('error', () => {
        if (img.dataset.proxyTried) { img.style.opacity = '0.2'; return; }
        img.dataset.proxyTried = '1';
        chrome.runtime.sendMessage({ action: 'fetchLogoImage', url }, (resp) => {
          if (resp && resp.success && resp.dataUri) {
            img.src = resp.dataUri;
            item.dataset.datauri = resp.dataUri;
          } else {
            img.style.opacity = '0.2';
          }
        });
      });
    });

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

      if (left < padding) left = padding;
      if (top < padding) top = padding;
      if (top + previewHeight + padding > window.innerHeight) {
        top = window.innerHeight - previewHeight - padding;
      }

      floatingPreview.style.left = `${left}px`;
      floatingPreview.style.top = `${top}px`;
    };

    const grid = container.querySelector('.logo-grid');
    if (!grid) return;

    const handleItemEnter = (item) => {
      previewImg.src = item.dataset.datauri || item.dataset.url;
      previewName.textContent = item.dataset.name;
      updatePreviewPosition(item);
      floatingPreview.classList.add('active');
    };

    const handleItemLeave = () => {
      floatingPreview.classList.remove('active');
    };

    // 标志挂在每次重建的 grid 上：grid 每次搜索都随 innerHTML 重建，
    // 若挂在 container 上会导致第二次搜索跳过绑定，新 grid 无任何监听（点击/悬停失效）
    if (!grid._logoResultListenersAttached) {
      grid._logoResultListenersAttached = true;

      grid.addEventListener('mouseenter', (e) => {
        const item = e.target.closest('.logo-result-item');
        if (item) handleItemEnter(item);
      }, true);

      grid.addEventListener('mousemove', (e) => {
        const item = e.target.closest('.logo-result-item');
        if (item) updatePreviewPosition(item);
      });

      grid.addEventListener('mouseleave', (e) => {
        const item = e.target.closest('.logo-result-item');
        if (item) handleItemLeave();
      }, true);

      grid.addEventListener('click', (e) => {
        const item = e.target.closest('.logo-result-item');
        if (!item) return;
        grid.querySelectorAll('.logo-result-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const editIcon = document.getElementById('editIcon');
        if (editIcon) editIcon.value = item.dataset.datauri || item.dataset.url;
        // 选中即后台把图片转成 data URI，确保离线、永久，且不受 favicon 回源逻辑干扰
        if (!item.dataset.datauri) {
          const selUrl = item.dataset.url;
          chrome.runtime.sendMessage({ action: 'fetchLogoImage', url: selUrl }, (resp) => {
            if (resp && resp.success && resp.dataUri) {
              item.dataset.datauri = resp.dataUri;
              if (item.classList.contains('selected')) editIcon.value = resp.dataUri;
            }
          });
        }
      });

      grid.addEventListener('scroll', () => {
        const hoveredItem = grid.querySelector('.logo-result-item:hover');
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
