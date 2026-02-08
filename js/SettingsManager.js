
export class SettingsManager {
  constructor() {
    this.cardSize = 'medium';
    this.cardShape = 'square';
    this.sortBy = 'default';
    this.bgSettings = {
      mode: 'default', // default, bing, custom
      customUrl: '',
      overlayOpacity: 40
    };

    // Event listeners
    this.onSettingChange = null; // Callback function
  }

  async init() {
    await this.loadCardSize();
    await this.loadCardShape();
    await this.loadSortBy();
    await this.loadBgSettings();
    this.applyBackground();
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

  async saveCardSize(size) {
    if (['small', 'medium', 'large'].includes(size)) {
      this.cardSize = size;
      try {
        await chrome.storage.local.set({
          bookmarkCardSize: this.cardSize,
          lastLocalModify: Date.now()
        });
        if (this.onSettingChange) this.onSettingChange('cardSize', size);
      } catch (error) {
        console.error('保存卡片大小设置失败:', error);
      }
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

  async saveCardShape(shape) {
    if (['square', 'round'].includes(shape)) {
      this.cardShape = shape;
      try {
        await chrome.storage.local.set({
          bookmarkCardShape: this.cardShape,
          lastLocalModify: Date.now()
        });
        if (this.onSettingChange) this.onSettingChange('cardShape', shape);
      } catch (error) {
        console.error('保存卡片形状设置失败:', error);
      }
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

  async saveSortBy(sortBy) {
    if (['default', 'visits', 'recent', 'name'].includes(sortBy)) {
      this.sortBy = sortBy;
      try {
        await chrome.storage.local.set({
          bookmarkSortBy: this.sortBy,
          lastLocalModify: Date.now()
        });
        if (this.onSettingChange) this.onSettingChange('sortBy', sortBy);
      } catch (error) {
        console.error('保存排序方式设置失败:', error);
      }
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

  setupUI() {
    this.setupCardSizeControls();
    this.setupCardShapeControls();
    this.setupSortControls();
    this.setupBackgroundSettingsUI();
  }

  setupCardSizeControls() {
    const sizeButtons = document.querySelectorAll('.size-button');
    sizeButtons.forEach(button => {
      // Update UI state based on current setting
      if (button.dataset.size === this.cardSize) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }

      // Remove old listeners to prevent duplicates if called multiple times
      // (This is a simplified approach, in a real app we might handle this better)
      const newBtn = button.cloneNode(true);
      button.parentNode.replaceChild(newBtn, button);

      newBtn.addEventListener('click', () => {
        const size = newBtn.dataset.size;
        this.saveCardSize(size);
        this.updateCardSizeUI(size);
      });
    });
  }

  updateCardSizeUI(activeSize) {
    const sizeButtons = document.querySelectorAll('.size-button');
    sizeButtons.forEach(button => {
      if (button.dataset.size === activeSize) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
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

      const newBtn = button.cloneNode(true);
      button.parentNode.replaceChild(newBtn, button);

      newBtn.addEventListener('click', () => {
        const shape = newBtn.dataset.shape;
        this.saveCardShape(shape);
        this.updateCardShapeUI(shape);
      });
    });
  }

  updateCardShapeUI(activeShape) {
    const shapeButtons = document.querySelectorAll('.shape-button');
    shapeButtons.forEach(button => {
      if (button.dataset.shape === activeShape) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
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

      const newBtn = button.cloneNode(true);
      button.parentNode.replaceChild(newBtn, button);

      newBtn.addEventListener('click', () => {
        const sortBy = newBtn.dataset.sort;
        this.saveSortBy(sortBy);
        this.updateSortUI(sortBy);
      });
    });
  }

  updateSortUI(activeSort) {
    const sortButtons = document.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      if (button.dataset.sort === activeSort) {
        button.style.background = '#667eea';
        button.style.color = 'white';
      } else {
        button.style.background = 'rgba(255,255,255,1)';
        button.style.color = '#333';
      }
    });
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
    modeButtons.forEach(button => {
        // Clone to remove old listeners
        const btn = button.cloneNode(true);
        button.parentNode.replaceChild(btn, button);

        btn.addEventListener('click', async () => {
            this.bgSettings.mode = btn.dataset.mode;
            updateUIState();
            this.applyBackground();
            await this.saveBgSettings();
        });
    });

    // Handle inputs
    // We can't easily clone inputs without losing reference, so we'll just add listener
    // Ideally we should handle cleanup or use a more robust event delegation

    // Remove old listeners by cloning (simple way)
    const newCustomUrlInput = customUrlInput.cloneNode(true);
    customUrlInput.parentNode.replaceChild(newCustomUrlInput, customUrlInput);

    newCustomUrlInput.addEventListener('change', async () => {
      this.bgSettings.customUrl = newCustomUrlInput.value.trim();
      if (this.bgSettings.mode === 'custom') {
        this.applyBackground();
      }
      await this.saveBgSettings();
    });

    const newOpacityInput = opacityInput.cloneNode(true);
    opacityInput.parentNode.replaceChild(newOpacityInput, opacityInput);

    newOpacityInput.addEventListener('input', () => {
      const val = newOpacityInput.value;
      opacityValue.textContent = `${val}%`;
      this.bgSettings.overlayOpacity = parseInt(val);
      // 实时预览
      const overlay = document.getElementById('bgOverlay');
      if (overlay) {
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${val / 100})`;
      }
    });

    newOpacityInput.addEventListener('change', async () => {
      await this.saveBgSettings();
    });
  }
}
