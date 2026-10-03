export class PageNavigator {
  constructor() {
    this.isNotesPageOpen = false;
    this.isStatsPageOpen = false;
    this.onPageChange = null;
    this.totalPages = 3;
    this._dots = null;
    this._listenersAttached = false;
  }

  getCurrentPageIndex() {
    if (this.isStatsPageOpen) return 2;
    if (this.isNotesPageOpen) return 1;
    return 0;
  }

  notifyPageChange() {
    if (this.onPageChange) {
      this.onPageChange(this.getCurrentPageIndex());
    }
  }

  setup(onOpenNotes, onCloseNotes, onOpenStats, onCloseStats) {
    this.onOpenNotes = onOpenNotes;
    this.onCloseNotes = onCloseNotes;
    this.onOpenStats = onOpenStats;
    this.onCloseStats = onCloseStats;

    if (this._listenersAttached) return;
    this._listenersAttached = true;

    this._dots = document.querySelectorAll('.page-dot');
    const slideLeftBtn = document.getElementById('slideLeftBtn');

    this._dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.goToPage(index);
      });
    });

    if (slideLeftBtn) {
      slideLeftBtn.addEventListener('click', () => this.goBack());
    }

    const notesEntryButton = document.getElementById('notesEntryButton');
    if (notesEntryButton) {
      notesEntryButton.addEventListener('click', () => this.openNotesPage());
    }

    const statsEntryButton = document.getElementById('statsEntryButton');
    if (statsEntryButton) {
      statsEntryButton.addEventListener('click', () => this.openStatsPage());
    }

    const statsBackBtn = document.getElementById('statsBackBtn');
    if (statsBackBtn) {
      statsBackBtn.addEventListener('click', () => this.closeStatsPage());
    }

    this.setupTouchGestures();
    this.setupMouseDrag();
    this.setupKeyboardNav();

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeNotesPage());
    }

    const homeBtn = document.getElementById('homeButton');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => this.goToPage(0));
    }
  }

  setupTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0 && this.getCurrentPageIndex() < 2) {
          this.goForward();
        } else if (diffX < 0 && this.getCurrentPageIndex() > 0) {
          this.goBack();
        }
      }
    }, { passive: true });
  }

  setupMouseDrag() {
    let isDragging = false;
    let startX = 0;
    const notesPage = document.getElementById('notesPage');
    const statsPage = document.getElementById('statsPage');

    document.addEventListener('mousedown', (e) => {
      // 模态框打开时不触发拖拽手势
      if (e.target.closest('.note-modal-overlay')) return;

      if (e.clientX > window.innerWidth - 50 || this.isNotesPageOpen || this.isStatsPageOpen) {
        isDragging = true;
        startX = e.clientX;
        document.body.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const diff = e.clientX - startX;
      const target = this.isNotesPageOpen ? notesPage :
                     this.isStatsPageOpen ? statsPage : null;

      if (target && diff > 0) {
        target.style.transform = `translateX(${diff}px)`;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.cursor = '';

      const diff = startX - e.clientX;

      if (this.getCurrentPageIndex() === 0 && diff > 100) {
        this.goForward();
      } else if (this.getCurrentPageIndex() > 0 && diff < -100) {
        this.goBack();
      } else {
        const target = this.isNotesPageOpen ? notesPage :
                       this.isStatsPageOpen ? statsPage : null;
        if (target) target.style.transform = '';
      }
    });
  }

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && this.getCurrentPageIndex() < 2) {
        this.goForward();
      } else if (e.key === 'ArrowLeft' && this.getCurrentPageIndex() > 0) {
        this.goBack();
      }
    });
  }

  goForward() {
    const currentPage = this.getCurrentPageIndex();
    if (currentPage < 2) {
      this.goToPage(currentPage + 1);
    }
  }

  goBack() {
    const currentPage = this.getCurrentPageIndex();
    if (currentPage > 0) {
      this.goToPage(currentPage - 1);
    }
  }

  goToPage(pageIndex) {
    if (pageIndex === 0) {
      this.closeNotesPage();
      this.closeStatsPage();
    } else if (pageIndex === 1) {
      this.closeStatsPage();
      this.openNotesPage();
    } else if (pageIndex === 2) {
      this.closeNotesPage();
      this.openStatsPage();
    }
  }

  _updateDots(activeIndex) {
    if (!this._dots) {
      this._dots = document.querySelectorAll('.page-dot');
    }
    this._dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === activeIndex);
    });
  }

  openNotesPage() {
    const notesPage = document.getElementById('notesPage');
    const leftTrigger = document.getElementById('leftTriggerZone');

    if (!notesPage) return;

    this.isNotesPageOpen = true;
    notesPage.classList.add('active');

    this._updateDots(1);

    if (leftTrigger) leftTrigger.style.display = 'flex';

    if (this.onOpenNotes) this.onOpenNotes();
    this.notifyPageChange();
  }

  closeNotesPage() {
    const notesPage = document.getElementById('notesPage');
    const leftTrigger = document.getElementById('leftTriggerZone');

    if (!notesPage) return;

    this.isNotesPageOpen = false;
    notesPage.classList.remove('active');
    notesPage.style.transform = '';

    this._updateDots(this.getCurrentPageIndex());

    if (this.getCurrentPageIndex() === 0) {
      if (leftTrigger) leftTrigger.style.display = 'none';
    }

    if (this.onCloseNotes) this.onCloseNotes();
    this.notifyPageChange();
  }

  openStatsPage() {
    const statsPage = document.getElementById('statsPage');
    const leftTrigger = document.getElementById('leftTriggerZone');

    if (!statsPage) return;

    this.isStatsPageOpen = true;
    statsPage.classList.add('active');

    this._updateDots(2);

    if (leftTrigger) leftTrigger.style.display = 'flex';

    if (this.onOpenStats) this.onOpenStats();
    this.notifyPageChange();
  }

  closeStatsPage() {
    const statsPage = document.getElementById('statsPage');
    const leftTrigger = document.getElementById('leftTriggerZone');

    if (!statsPage) return;

    this.isStatsPageOpen = false;
    statsPage.classList.remove('active');

    this._updateDots(this.getCurrentPageIndex());

    if (this.getCurrentPageIndex() === 0) {
      if (leftTrigger) leftTrigger.style.display = 'none';
    }

    if (this.onCloseStats) this.onCloseStats();
    this.notifyPageChange();
  }
}
