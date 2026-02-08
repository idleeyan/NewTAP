document.addEventListener('DOMContentLoaded', async () => {
  const pageTitle = document.getElementById('pageTitle');
  const pageUrl = document.getElementById('pageUrl');
  const addButton = document.getElementById('addButton');
  const openNewtabButton = document.getElementById('openNewtabButton');
  const statusMessage = document.getElementById('statusMessage');
  
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
        const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        
        const newBookmark = {
          id: Date.now().toString(),
          name: currentTab.title,
          url: currentTab.url,
          icon: icon,
          index: 0,
          visitCount: 0,
          lastVisit: Date.now()
        };
        
        const result = await chrome.storage.local.get('customBookmarks');
        const customBookmarks = result.customBookmarks || [];
        
        const existingIndex = customBookmarks.findIndex(bookmark => bookmark.url === newBookmark.url);
        if (existingIndex !== -1) {
          showStatus('error', '该网站已在书签中');
          addButton.classList.remove('loading');
          addButton.disabled = false;
          return;
        }
        
        customBookmarks.push(newBookmark);
        await chrome.storage.local.set({ customBookmarks: customBookmarks });
        
        showStatus('success', '已成功添加到书签！');
        
        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (error) {
        console.error('添加书签失败:', error);
        showStatus('error', '添加失败，请重试');
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
