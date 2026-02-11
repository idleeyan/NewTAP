export class PageNavigator {
  constructor() {
    this.isNotesPageOpen = false;
    this.isStatsPageOpen = false;
    this.onPageChange = null;
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

    const dots = document.querySelectorAll('.page-dot');
    const slideLeftBtn = document.getElementById('slideLeftBtn');

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        this.goToPage(index);
      });
    });

    if (slideLeftBtn) {
      slideLeftBtn.addEventListener('click', () => this.closeNotesPage());
    }

    const rightTriggerZone = document.getElementById('rightTriggerZone');
    if (rightTriggerZone) {
      rightTriggerZone.addEventListener('click', () => this.openNotesPage());
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
        if (diffX > 0 && !this.isNotesPageOpen && !this.isStatsPageOpen) {
          this.openNotesPage();
        } else if (diffX < 0 && (this.isNotesPageOpen || this.isStatsPageOpen)) {
          if (this.isStatsPageOpen) {
            this.closeStatsPage();
          } else {
            this.closeNotesPage();
          }
        }
      }
    }, { passive: true });
  }

  setupMouseDrag() {
    let isDragging = false;
    let startX = 0;
    const notesPage = document.getElementById('notesPage');

    document.addEventListener('mousedown', (e) => {
      if (e.clientX > window.innerWidth - 50 || this.isNotesPageOpen || this.isStatsPageOpen) {
        isDragging = true;
        startX = e.clientX;
        document.body.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      if (this.isNotesPageOpen && notesPage) {
        const diff = e.clientX - startX;
        if (diff > 0) {
          notesPage.style.transform = `translateX(${diff}px)`;
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.cursor = '';

      const diff = startX - e.clientX;

      if (!this.isNotesPageOpen && !this.isStatsPageOpen && diff > 100) {
        this.openNotesPage();
      } else if (this.isNotesPageOpen && diff < -100) {
        this.closeNotesPage();
      } else if (this.isStatsPageOpen && diff < -100) {
        this.closeStatsPage();
      } else if (this.isNotesPageOpen && notesPage) {
        notesPage.style.transform = '';
      }
    });
  }

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && !this.isNotesPageOpen && !this.isStatsPageOpen) {
        this.openNotesPage();
      } else if (e.key === 'ArrowLeft') {
        if (this.isStatsPageOpen) {
          this.closeStatsPage();
        } else if (this.isNotesPageOpen) {
          this.closeNotesPage();
        }
      }
    });
  }

  openNotesPage() {
    const notesPage = document.getElementById('notesPage');
    const dots = document.querySelectorAll('.page-dot');
    const leftTrigger = document.getElementById('leftTriggerZone');
    const rightTrigger = document.getElementById('rightTriggerZone');
    const settingsButton = document.getElementById('settingsButton');
    const notesEntryButton = document.getElementById('notesEntryButton');
    const statsEntryButton = document.getElementById('statsEntryButton');

    if (!notesPage) return;

    this.isNotesPageOpen = true;
    notesPage.classList.add('active');

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === 1);
    });

    if (leftTrigger) leftTrigger.style.display = 'flex';
    if (rightTrigger) rightTrigger.style.display = 'none';
    if (settingsButton) settingsButton.style.display = 'none';
    if (notesEntryButton) notesEntryButton.style.display = 'none';
    if (statsEntryButton) statsEntryButton.style.display = 'none';

    if (this.onOpenNotes) this.onOpenNotes();
    this.notifyPageChange();
  }

  closeNotesPage() {
    const notesPage = document.getElementById('notesPage');
    const dots = document.querySelectorAll('.page-dot');
    const leftTrigger = document.getElementById('leftTriggerZone');
    const rightTrigger = document.getElementById('rightTriggerZone');
    const settingsButton = document.getElementById('settingsButton');
    const notesEntryButton = document.getElementById('notesEntryButton');
    const statsEntryButton = document.getElementById('statsEntryButton');

    if (!notesPage) return;

    this.isNotesPageOpen = false;
    notesPage.classList.remove('active');
    notesPage.style.transform = '';

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === 0);
    });

    if (leftTrigger) leftTrigger.style.display = 'none';
    if (rightTrigger) rightTrigger.style.display = 'flex';
    if (settingsButton) settingsButton.style.display = '';
    if (notesEntryButton) notesEntryButton.style.display = '';
    if (statsEntryButton) statsEntryButton.style.display = '';

    if (this.onCloseNotes) this.onCloseNotes();
    this.notifyPageChange();
  }

  openStatsPage() {
    const statsPage = document.getElementById('statsPage');
    const dots = document.querySelectorAll('.page-dot');
    const leftTrigger = document.getElementById('leftTriggerZone');
    const rightTrigger = document.getElementById('rightTriggerZone');
    const settingsButton = document.getElementById('settingsButton');
    const notesEntryButton = document.getElementById('notesEntryButton');
    const statsEntryButton = document.getElementById('statsEntryButton');

    if (!statsPage) return;

    this.isStatsPageOpen = true;
    statsPage.classList.add('active');

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === 2);
    });

    if (leftTrigger) leftTrigger.style.display = 'flex';
    if (rightTrigger) rightTrigger.style.display = 'none';
    if (settingsButton) settingsButton.style.display = 'none';
    if (notesEntryButton) notesEntryButton.style.display = 'none';
    if (statsEntryButton) statsEntryButton.style.display = 'none';

    if (this.onOpenStats) this.onOpenStats();
    this.notifyPageChange();
  }

  closeStatsPage() {
    const statsPage = document.getElementById('statsPage');
    const dots = document.querySelectorAll('.page-dot');
    const leftTrigger = document.getElementById('leftTriggerZone');
    const rightTrigger = document.getElementById('rightTriggerZone');
    const settingsButton = document.getElementById('settingsButton');
    const notesEntryButton = document.getElementById('notesEntryButton');
    const statsEntryButton = document.getElementById('statsEntryButton');

    if (!statsPage) return;

    this.isStatsPageOpen = false;
    statsPage.classList.remove('active');

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === 0);
    });

    if (leftTrigger) leftTrigger.style.display = 'none';
    if (rightTrigger) rightTrigger.style.display = 'flex';
    if (settingsButton) settingsButton.style.display = '';
    if (notesEntryButton) notesEntryButton.style.display = '';
    if (statsEntryButton) statsEntryButton.style.display = '';

    if (this.onCloseStats) this.onCloseStats();
    this.notifyPageChange();
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
}
