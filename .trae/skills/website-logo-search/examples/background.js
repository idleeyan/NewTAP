chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'searchLogo') {
        const searchTerm = request.searchTerm;
        if (!searchTerm) {
            sendResponse({ error: 'Search term is required' });
            return true;
        }
        
        searchLogoFromBaidu(searchTerm, sendResponse);
        return true;
    }
    
    return false;
});

function searchLogoFromBaidu(searchTerm, sendResponse) {
    const searchUrl = `https://image.baidu.com/search/flip?tn=baiduimage&ie=utf-8&word=${encodeURIComponent(searchTerm + ' logo')}&pn=0&rn=20`;
    
    fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            const logoItems = [];
            
            const regex = /"thumbURL":"([^"]+)"/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) && count < 10) {
                try {
                    const logoUrl = match[1];
                    if (logoUrl) {
                        const name = `${searchTerm}_${count + 1}`;
                        logoItems.push({ name, url: logoUrl });
                        count++;
                    }
                } catch (error) {
                    console.error('解析图片项失败:', error);
                }
            }
            
            console.log('百度图片搜索结果:', logoItems);
            
            if (logoItems.length === 0) {
                searchLogoFromSeeklogo(searchTerm, sendResponse);
            } else {
                sendResponse({ success: true, items: logoItems });
            }
        })
        .catch(error => {
            console.error('百度图片搜索失败:', error);
            searchLogoFromSeeklogo(searchTerm, sendResponse);
        });
}

function searchLogoFromSeeklogo(searchTerm, sendResponse) {
    const searchUrl = `https://seeklogo.com/search/${encodeURIComponent(searchTerm)}.html`;
    
    fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            const logoItems = [];
            
            const regex = /<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) && count < 10) {
                try {
                    const logoUrl = match[1];
                    const name = match[2] || `${searchTerm}_${count + 1}`;
                    
                    if (logoUrl && logoUrl.startsWith('http')) {
                        logoItems.push({ name, url: logoUrl });
                        count++;
                    }
                } catch (error) {
                    console.error('解析logo项失败:', error);
                }
            }
            
            console.log('seeklogo.com搜索结果:', logoItems);
            
            sendResponse({ success: true, items: logoItems });
        })
        .catch(error => {
            console.error('seeklogo.com搜索失败:', error);
            const mockItems = [
                { name: `${searchTerm} Logo 1`, url: `https://via.placeholder.com/120x120/667eea/ffffff?text=${encodeURIComponent(searchTerm)}1` },
                { name: `${searchTerm} Logo 2`, url: `https://via.placeholder.com/120x120/764ba2/ffffff?text=${encodeURIComponent(searchTerm)}2` }
            ];
            sendResponse({ success: true, items: mockItems });
        });
}
