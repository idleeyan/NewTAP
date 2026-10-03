import { iconLibrary } from './js/IconLibrary.js';

document.addEventListener('DOMContentLoaded', async () => {
  const pageTitle = document.getElementById('pageTitle');
  const pageUrl = document.getElementById('pageUrl');
  const addButton = document.getElementById('addButton');
  const openNewtabButton = document.getElementById('openNewtabButton');
  const statusMessage = document.getElementById('statusMessage');

  try {
    const ver = chrome.runtime.getManifest?.()?.version;
    if (ver) {
      const verEl = document.getElementById('popupVersion');
      if (verEl) verEl.textContent = `v${ver}`;
    }
  } catch { /* ignore */ }
  
  let currentTab = null;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    
    if (currentTab && currentTab.url && currentTab.title) {
      pageTitle.textContent = currentTab.title;
      pageUrl.textContent = currentTab.url;
      
      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
        showStatus('info', '无法添加Chrome内部页面');
        addButton.disabled = true;
      }
    } else {
      showStatus('info', '无法获取当前页面信息');
      addButton.disabled = true;
    }
  } catch (error) {
    console.error('获取当前标签页失败:', error);
    showStatus('error', '获取页面信息失败');
    addButton.disabled = true;
  }
  
  if (addButton) {
    addButton.addEventListener('click', async () => {
      if (!currentTab || !currentTab.url || !currentTab.title) {
        showStatus('error', '无法获取当前页面信息');
        return;
      }
      
      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
        showStatus('error', '无法添加Chrome内部页面');
        return;
      }
      
      addButton.classList.add('loading');
      addButton.disabled = true;
      
      try {
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        // 图库里有该网站的设计 LOGO 就用它，否则退回站点 favicon
        const preset = iconLibrary.matchByUrl(currentTab.url);
        const icon = preset ? preset.file : `https://${domain}/favicon.ico`;

        const result = await chrome.storage.local.get('customBookmarks');
        const customBookmarks = result.customBookmarks || [];

        const existingIndex = customBookmarks.findIndex(bookmark => bookmark.url === currentTab.url);
        if (existingIndex !== -1) {
          showStatus('error', '该网站已在书签中');
          addButton.classList.remove('loading');
          addButton.disabled = false;
          return;
        }

        const maxIndex = customBookmarks.reduce((max, b) => Math.max(max, b.index || 0), -1);

        const newBookmark = {
          id: Date.now().toString(),
          name: currentTab.title,
          url: currentTab.url,
          icon: icon,
          index: maxIndex + 1,
          visitCount: 0,
          lastVisit: Date.now(),
          firstVisit: Date.now()
        };

        customBookmarks.push(newBookmark);
        await chrome.storage.local.set({
          customBookmarks: customBookmarks,
          lastLocalModify: Date.now()
        });

        showStatus('success', '已成功添加到书签！');

        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (error) {
        console.error('添加书签失败:', error);
        showStatus('error', '添加失败：' + (error.message || '请重试'));
        addButton.classList.remove('loading');
        addButton.disabled = false;
      }
    });
  }
  
  if (openNewtabButton) {
    openNewtabButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://newtab' });
      window.close();
    });
  }
  
  function showStatus(type, message) {
    if (!statusMessage) return;
    
    statusMessage.className = 'status-message ' + type;
    statusMessage.textContent = message;
    
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.className = 'status-message';
        statusMessage.textContent = '';
      }, 3000);
    }
  }
});
