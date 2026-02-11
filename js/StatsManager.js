export class StatsManager {
  constructor() {
  }

  getStats() {
    return {
      totalVisits: 0
    };
  }

  static recordVisit(bookmark) {
    const now = Date.now();
    const visitTime = new Date(now);
    const hour = visitTime.getHours();

    bookmark.visitCount = (bookmark.visitCount || 0) + 1;
    bookmark.lastVisit = now;
    if (!bookmark.firstVisit) {
      bookmark.firstVisit = now;
    }

    const visitRecord = {
      timestamp: now,
      date: visitTime.toISOString().split('T')[0],
      time: visitTime.toTimeString().split(' ')[0],
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

    if (!bookmark.dailyStats) {
      bookmark.dailyStats = {};
    }
    const dateKey = visitRecord.date;
    if (!bookmark.dailyStats[dateKey]) {
      bookmark.dailyStats[dateKey] = { count: 0, totalDuration: 0 };
    }
    bookmark.dailyStats[dateKey].count++;

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
