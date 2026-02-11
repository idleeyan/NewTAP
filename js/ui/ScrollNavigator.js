export class ScrollNavigator {
  constructor(pageNavigator, config = {}) {
    this.pageNavigator = pageNavigator;
    this.config = {
      threshold: config.threshold || 50,
      debounceDelay: config.debounceDelay || 300,
      animationDuration: config.animationDuration || 400,
      enableHistory: config.enableHistory !== false,
      ...config
    };

    this.isNavigating = false;
    this.lastScrollTime = 0;
    this.scrollDebounceTimer = null;
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.isTouching = false;

    this.pages = ['main', 'notes', 'stats'];
    this.currentPageIndex = 0;

    this.loaderElement = null;
    this.toastElement = null;
  }

  setup() {
    this.createLoader();
    this.createToast();
    this.setupScrollListener();
    this.setupTouchListener();
    this.setupHistoryListener();
    this.syncWithPageNavigator();

    if (this.config.enableHistory) {
      this.initHistory();
    }
  }

  syncWithPageNavigator() {
    this.pageNavigator.onPageChange = (pageIndex) => {
      this.currentPageIndex = pageIndex;
    };
  }

  createLoader() {
    this.loaderElement = document.createElement('div');
    this.loaderElement.className = 'scroll-nav-loader';
    this.loaderElement.innerHTML = `
      <div class="scroll-nav-spinner"></div>
      <div class="scroll-nav-text">加载中...</div>
    `;
    this.loaderElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      z-index: 9999;
      backdrop-filter: blur(5px);
    `;
    document.body.appendChild(this.loaderElement);

    const style = document.createElement('style');
    style.textContent = `
      .scroll-nav-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: #667eea;
        border-radius: 50%;
        animation: scroll-nav-spin 0.8s linear infinite;
      }
      .scroll-nav-text {
        color: white;
        margin-top: 15px;
        font-size: 0.9rem;
      }
      @keyframes scroll-nav-spin {
        to { transform: rotate(360deg); }
      }
      .scroll-nav-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 20px;
        font-size: 0.9rem;
        z-index: 9998;
        opacity: 0;
        transition: opacity 0.3s ease;
        backdrop-filter: blur(10px);
      }
      .scroll-nav-toast.show {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  createToast() {
    this.toastElement = document.createElement('div');
    this.toastElement.className = 'scroll-nav-toast';
    document.body.appendChild(this.toastElement);
  }

  showToast(message, duration = 2000) {
    this.toastElement.textContent = message;
    this.toastElement.classList.add('show');

    setTimeout(() => {
      this.toastElement.classList.remove('show');
    }, duration);
  }

  showLoader() {
    this.loaderElement.style.display = 'flex';
  }

  hideLoader() {
    this.loaderElement.style.display = 'none';
  }

  getCurrentScrollContainer() {
    if (this.pageNavigator.isStatsPageOpen) {
      return document.getElementById('statsPage');
    }
    if (this.pageNavigator.isNotesPageOpen) {
      return document.getElementById('notesPage');
    }
    return document.getElementById('mainPage');
  }

  getScrollInfo(element) {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceToTop: scrollTop,
      distanceToBottom: scrollHeight - scrollTop - clientHeight,
      isAtTop: scrollTop <= this.config.threshold,
      isAtBottom: scrollHeight - scrollTop - clientHeight <= this.config.threshold
    };
  }

  setupScrollListener() {
    const handleWheel = (e) => {
      if (this.isNavigating) return;

      let target = e.target;
      while (target && target !== document) {
        if (target.classList && (
          target.classList.contains('dialog-overlay') ||
          target.classList.contains('dialog-content') ||
          target.classList.contains('logo-grid') ||
          target.classList.contains('modal') ||
          target.getAttribute('role') === 'dialog'
        )) {
          return;
        }
        target = target.parentElement;
      }

      const now = Date.now();
      if (now - this.lastScrollTime < this.config.debounceDelay) return;

      const container = this.getCurrentScrollContainer();
      if (!container) return;

      const scrollInfo = this.getScrollInfo(container);
      const delta = e.deltaY;

      clearTimeout(this.scrollDebounceTimer);

      this.scrollDebounceTimer = setTimeout(() => {
        this.handleScrollNavigation(delta, scrollInfo);
      }, 50);

      this.lastScrollTime = now;
    };

    document.addEventListener('wheel', handleWheel, { passive: true });
  }

  handleScrollNavigation(delta, scrollInfo) {
    if (delta > 0 && scrollInfo.isAtBottom) {
      this.navigateToNext();
    } else if (delta < 0 && scrollInfo.isAtTop) {
      this.navigateToPrevious();
    }
  }

  setupTouchListener() {
    let touchStartTime = 0;
    let lastTouchY = 0;
    let accumulatedDelta = 0;

    const isInDialog = (element) => {
      let target = element;
      while (target && target !== document) {
        if (target.classList && (
          target.classList.contains('dialog-overlay') ||
          target.classList.contains('dialog-content') ||
          target.classList.contains('logo-grid') ||
          target.classList.contains('modal') ||
          target.getAttribute('role') === 'dialog'
        )) {
          return true;
        }
        target = target.parentElement;
      }
      return false;
    };

    document.addEventListener('touchstart', (e) => {
      if (this.isNavigating) return;
      if (isInDialog(e.target)) return;
      
      this.isTouching = true;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartX = e.touches[0].clientX;
      lastTouchY = this.touchStartY;
      touchStartTime = Date.now();
      accumulatedDelta = 0;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.isTouching || this.isNavigating) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = lastTouchY - currentY;
      const diffX = Math.abs(this.touchStartX - currentX);

      if (diffX > Math.abs(diffY) * 1.5) {
        return;
      }

      accumulatedDelta += diffY;
      lastTouchY = currentY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!this.isTouching || this.isNavigating) return;
      this.isTouching = false;

      const touchDuration = Date.now() - touchStartTime;
      const avgVelocity = Math.abs(accumulatedDelta) / touchDuration;

      if (avgVelocity < 0.3 && Math.abs(accumulatedDelta) < 100) {
        return;
      }

      const container = this.getCurrentScrollContainer();
      if (!container) return;

      const scrollInfo = this.getScrollInfo(container);

      if (accumulatedDelta > 50 && scrollInfo.isAtBottom) {
        this.navigateToNext();
      } else if (accumulatedDelta < -50 && scrollInfo.isAtTop) {
        this.navigateToPrevious();
      }
    }, { passive: true });
  }

  async navigateToNext() {
    if (this.isNavigating) return;
    if (this.currentPageIndex >= this.pages.length - 1) {
      this.showToast('已经是最后一页了');
      return;
    }

    this.isNavigating = true;
    this.showLoader();

    try {
      const nextPageIndex = this.currentPageIndex + 1;
      await this.animateNavigation(nextPageIndex);

      this.currentPageIndex = nextPageIndex;
      this.updateHistory(nextPageIndex);
    } catch (error) {
      console.error('导航失败:', error);
      this.showToast('页面加载失败');
    } finally {
      this.hideLoader();
      setTimeout(() => {
        this.isNavigating = false;
      }, this.config.animationDuration);
    }
  }

  async navigateToPrevious() {
    if (this.isNavigating) return;
    if (this.currentPageIndex <= 0) {
      this.showToast('已经是第一页了');
      return;
    }

    this.isNavigating = true;
    this.showLoader();

    try {
      const prevPageIndex = this.currentPageIndex - 1;
      await this.animateNavigation(prevPageIndex);

      this.currentPageIndex = prevPageIndex;
      this.updateHistory(prevPageIndex);
    } catch (error) {
      console.error('导航失败:', error);
      this.showToast('页面加载失败');
    } finally {
      this.hideLoader();
      setTimeout(() => {
        this.isNavigating = false;
      }, this.config.animationDuration);
    }
  }

  async animateNavigation(pageIndex) {
    return new Promise((resolve) => {
      const pageNames = ['main', 'notes', 'stats'];

      switch (pageNames[pageIndex]) {
        case 'main':
          this.pageNavigator.closeNotesPage();
          this.pageNavigator.closeStatsPage();
          break;
        case 'notes':
          this.pageNavigator.closeStatsPage();
          this.pageNavigator.openNotesPage();
          break;
        case 'stats':
          this.pageNavigator.closeNotesPage();
          this.pageNavigator.openStatsPage();
          break;
      }

      setTimeout(resolve, this.config.animationDuration);
    });
  }

  initHistory() {
    const initialState = {
      pageIndex: 0,
      timestamp: Date.now()
    };
    history.replaceState(initialState, '', '#page-0');
  }

  updateHistory(pageIndex) {
    if (!this.config.enableHistory) return;

    const state = {
      pageIndex: pageIndex,
      timestamp: Date.now()
    };

    history.pushState(state, '', `#page-${pageIndex}`);
  }

  setupHistoryListener() {
    if (!this.config.enableHistory) return;

    window.addEventListener('popstate', (e) => {
      if (!e.state) return;

      const targetPageIndex = e.state.pageIndex;

      if (targetPageIndex !== this.currentPageIndex) {
        this.isNavigating = true;
        this.animateNavigation(targetPageIndex).then(() => {
          this.currentPageIndex = targetPageIndex;
          this.isNavigating = false;
        });
      }
    });
  }

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getCurrentPageIndex() {
    return this.currentPageIndex;
  }

  destroy() {
    if (this.loaderElement) {
      this.loaderElement.remove();
    }
    if (this.toastElement) {
      this.toastElement.remove();
    }
  }
}
