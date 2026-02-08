
export class StatsManager {
  constructor() {
    this.dialog = document.getElementById('statsDialog');
    this.closeBtn = document.getElementById('closeStatsBtn');
    this.statsList = document.getElementById('statsList');
    this.totalVisitsEl = document.getElementById('totalVisits');
    this.totalBookmarksEl = document.getElementById('totalBookmarks');
    this.mostVisitedEl = document.getElementById('mostVisited');

    this.init();
  }

  init() {
    if (this.closeBtn && this.dialog) {
      this.closeBtn.onclick = () => this.hide();
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog) this.hide();
      });
    }
  }

  show(bookmarks) {
    if (!this.dialog) return;
    this.render(bookmarks);
    this.dialog.classList.add('active');
  }

  hide() {
    if (this.dialog) {
      this.dialog.classList.remove('active');
    }
  }

  render(bookmarks) {
    if (!bookmarks) return;

    const sortedBookmarks = [...bookmarks].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));

    const totalVisits = sortedBookmarks.reduce((sum, b) => sum + (b.visitCount || 0), 0);
    const totalBookmarks = sortedBookmarks.length;
    const mostVisited = sortedBookmarks.length > 0 ? sortedBookmarks[0].name : '-';

    if (this.totalVisitsEl) this.totalVisitsEl.textContent = totalVisits.toLocaleString();
    if (this.totalBookmarksEl) this.totalBookmarksEl.textContent = totalBookmarks;
    if (this.mostVisitedEl) this.mostVisitedEl.textContent = mostVisited.length > 8 ? mostVisited.substring(0, 8) + '...' : mostVisited;

    if (this.statsList) {
      this.statsList.innerHTML = '';

      if (sortedBookmarks.length === 0) {
        this.statsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无数据</div>';
        return;
      }

      const fragment = document.createDocumentFragment();

      sortedBookmarks.forEach((bookmark) => {
        const item = document.createElement('div');
        item.className = 'stats-item';

        const visitCount = bookmark.visitCount || 0;
        const lastVisit = bookmark.lastVisit ? new Date(bookmark.lastVisit).toLocaleDateString() : '从未';
        const firstVisit = bookmark.firstVisit ? new Date(bookmark.firstVisit).toLocaleDateString() : '从未';

        // Get recent 3 visits
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

      this.statsList.appendChild(fragment);
    }
  }

  // Helper to record a visit (logic extracted from renderBookmarks click handler)
  static recordVisit(bookmark) {
    const now = Date.now();
    const visitTime = new Date(now);
    const hour = visitTime.getHours();

    // Update basic stats
    bookmark.visitCount = (bookmark.visitCount || 0) + 1;
    bookmark.lastVisit = now;
    if (!bookmark.firstVisit) {
      bookmark.firstVisit = now;
    }

    // Record detailed visit history (limit 100)
    const visitRecord = {
      timestamp: now,
      date: visitTime.toISOString().split('T')[0], // YYYY-MM-DD
      time: visitTime.toTimeString().split(' ')[0], // HH:MM:SS
      hour: hour,
      dayOfWeek: visitTime.getDay(),
      month: visitTime.getMonth() + 1,
      year: visitTime.getFullYear(),
      duration: 0,
      referrer: 'direct'
    };

    if (!bookmark.visitHistory) {
      bookmark.visitHistory = [];
    }
    bookmark.visitHistory.unshift(visitRecord);
    if (bookmark.visitHistory.length > 100) {
      bookmark.visitHistory.pop();
    }

    // Daily stats
    if (!bookmark.dailyStats) {
      bookmark.dailyStats = {};
    }
    const dateKey = visitRecord.date;
    if (!bookmark.dailyStats[dateKey]) {
      bookmark.dailyStats[dateKey] = { count: 0, totalDuration: 0 };
    }
    bookmark.dailyStats[dateKey].count++;

    // Time of day stats
    if (!bookmark.timeOfDayStats) {
      bookmark.timeOfDayStats = { morning: { count: 0, avgDuration: 0 }, afternoon: { count: 0, avgDuration: 0 }, evening: { count: 0, avgDuration: 0 } };
    }

    let timeOfDay = 'evening';
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';

    if (!bookmark.timeOfDayStats[timeOfDay]) {
      bookmark.timeOfDayStats[timeOfDay] = { count: 0, avgDuration: 0 };
    }
    bookmark.timeOfDayStats[timeOfDay].count++;

    return bookmark;
  }
}
