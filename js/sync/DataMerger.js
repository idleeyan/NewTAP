export class DataMerger {
  static mergeBookmarks(localBookmarks, serverBookmarks, localDeleted = [], serverDeleted = []) {
    const merged = [];
    const urlMap = new Map();
    const deletedUrls = new Set();

    const allDeleted = [...(localDeleted || []), ...(serverDeleted || [])];
    allDeleted.forEach(item => {
      if (item.url) deletedUrls.add(item.url);
    });

    const allBookmarks = [...(localBookmarks || []), ...(serverBookmarks || [])];

    allBookmarks.forEach(bookmark => {
      if (!bookmark || !bookmark.url) return;

      if (deletedUrls.has(bookmark.url)) {
        const localDeletedTime = localDeleted.find(d => d.url === bookmark.url)?.deletedAt || 0;
        const serverDeletedTime = serverDeleted.find(d => d.url === bookmark.url)?.deletedAt || 0;
        const bookmarkTime = bookmark.lastModify || bookmark.lastVisit || 0;

        if (bookmarkTime > Math.max(localDeletedTime, serverDeletedTime)) {
          deletedUrls.delete(bookmark.url);
        } else {
          return;
        }
      }

      const existing = urlMap.get(bookmark.url);
      if (existing) {
        const existingTime = existing.lastModify || existing.lastVisit || 0;
        const bookmarkTime = bookmark.lastModify || bookmark.lastVisit || 0;

        if (bookmarkTime > existingTime) {
          const mergedBookmark = { ...bookmark };
          mergedBookmark.visitCount = Math.max(existing.visitCount || 0, bookmark.visitCount || 0);
          urlMap.set(bookmark.url, mergedBookmark);
        } else {
          const mergedBookmark = { ...existing };
          mergedBookmark.visitCount = Math.max(existing.visitCount || 0, bookmark.visitCount || 0);
          urlMap.set(bookmark.url, mergedBookmark);
        }
      } else {
        urlMap.set(bookmark.url, { ...bookmark });
      }
    });

    urlMap.forEach(bookmark => merged.push(bookmark));

    merged.sort((a, b) => (a.index || 0) - (b.index || 0));

    merged.forEach((bookmark, index) => {
      bookmark.index = index;
    });

    return merged;
  }

  static mergeSettings(localSettings, serverSettings) {
    const merged = {};

    const settingsKeys = ['bookmarkCardSize', 'bookmarkCardShape', 'bookmarkSortBy'];

    settingsKeys.forEach(key => {
      const localValue = localSettings[key];
      const serverValue = serverSettings[key];

      if (localValue !== undefined && serverValue !== undefined) {
        if (localValue !== serverValue) {
          merged[key] = serverValue;
        } else {
          merged[key] = localValue;
        }
      } else if (localValue !== undefined) {
        merged[key] = localValue;
      } else if (serverValue !== undefined) {
        merged[key] = serverValue;
      }
    });

    return merged;
  }

  static mergeDeletedList(localDeleted, serverDeleted) {
    const merged = [];
    const urlMap = new Map();

    const allDeleted = [...(localDeleted || []), ...(serverDeleted || [])];

    allDeleted.forEach(item => {
      if (!item || !item.url) return;

      const existing = urlMap.get(item.url);
      if (existing) {
        if (item.deletedAt > existing.deletedAt) {
          urlMap.set(item.url, { ...item });
        }
      } else {
        urlMap.set(item.url, { ...item });
      }
    });

    urlMap.forEach(item => merged.push(item));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return merged.filter(item => item.deletedAt > thirtyDaysAgo);
  }

  static mergeStickyNotes(localNotes, serverNotes) {
    const merged = [];
    const idMap = new Map();

    const allNotes = [...(localNotes || []), ...(serverNotes || [])];

    allNotes.forEach(note => {
      if (!note || !note.id) return;

      const existing = idMap.get(note.id);
      if (existing) {
        const existingTime = existing.updatedAt || existing.createdAt || 0;
        const noteTime = note.updatedAt || note.createdAt || 0;

        if (noteTime > existingTime) {
          idMap.set(note.id, { ...note });
        }
      } else {
        idMap.set(note.id, { ...note });
      }
    });

    idMap.forEach(note => merged.push(note));

    merged.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    return merged;
  }

  static hasDataChanged(localData, mergedData) {
    const localBookmarks = localData.customBookmarks || [];
    const mergedBookmarks = mergedData.customBookmarks || [];

    if (localBookmarks.length !== mergedBookmarks.length) {
      return true;
    }

    const localUrls = new Set(localBookmarks.map(b => b.url));
    const mergedUrls = new Set(mergedBookmarks.map(b => b.url));

    if (localUrls.size !== mergedUrls.size) {
      return true;
    }

    for (const url of localUrls) {
      if (!mergedUrls.has(url)) {
        return true;
      }
    }

    for (const bookmark of localBookmarks) {
      const mergedBookmark = mergedBookmarks.find(b => b.url === bookmark.url);
      if (!mergedBookmark) {
        return true;
      }

      if (bookmark.name !== mergedBookmark.name ||
          bookmark.icon !== mergedBookmark.icon ||
          (bookmark.visitCount || 0) !== (mergedBookmark.visitCount || 0)) {
        return true;
      }
    }

    const localDeleted = localData.deletedBookmarks || [];
    const mergedDeleted = mergedData.deletedBookmarks || [];
    if (localDeleted.length !== mergedDeleted.length) {
      return true;
    }

    const settingsKeys = ['bookmarkCardSize', 'bookmarkCardShape', 'bookmarkSortBy'];
    for (const key of settingsKeys) {
      if (localData[key] !== mergedData[key]) {
        return true;
      }
    }

    const localNotes = localData.stickyNotes || [];
    const mergedNotes = mergedData.stickyNotes || [];
    if (localNotes.length !== mergedNotes.length) {
      return true;
    }

    const localNoteIds = new Set(localNotes.map(n => n.id));
    const mergedNoteIds = new Set(mergedNotes.map(n => n.id));
    for (const id of localNoteIds) {
      if (!mergedNoteIds.has(id)) {
        return true;
      }
    }

    for (const note of localNotes) {
      const mergedNote = mergedNotes.find(n => n.id === note.id);
      if (!mergedNote) {
        return true;
      }

      if (note.title !== mergedNote.title ||
          note.content !== mergedNote.content ||
          note.color !== mergedNote.color) {
        return true;
      }
    }

    return false;
  }
}
