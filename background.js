// WebDAV请求处理
async function handleWebDAVRequest(request) {
    const { config, method, path = '', data = null } = request;
    const { serverUrl, username, password } = config;

    // 确保服务器URL不以斜杠结尾，路径以斜杠开头
    const baseUrl = serverUrl.replace(/\/$/, '');
    const fullPath = path.startsWith('/') ? path : '/' + path;
    const url = baseUrl + fullPath;

    const credentials = btoa(`${username}:${password}`);
    const headers = {
        'Authorization': `Basic ${credentials}`
    };

    if (method === 'PROPFIND') {
        headers['Depth'] = '0';
        headers['Content-Type'] = 'text/xml; charset=utf-8';
    }

    if (method === 'PUT' || method === 'POST') {
        headers['Content-Type'] = 'application/json';
        // 某些 WebDAV 服务器需要这些头部
        headers['Accept'] = '*/*';
        headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
    }

    try {
        const fetchOptions = {
            method: method,
            headers: headers,
            signal: AbortSignal.timeout(10000) // 10秒超时
        };

        if (data && (method === 'PUT' || method === 'POST')) {
            fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        }

        const response = await fetch(url, fetchOptions);

        if (method === 'GET') {
            const responseData = await response.text();
            return {
                success: response.ok,
                status: response.status,
                data: responseData
            };
        } else if (method === 'HEAD') {
            return {
                success: response.ok,
                status: response.status,
                headers: {
                    'last-modified': response.headers.get('last-modified'),
                    'content-length': response.headers.get('content-length')
                }
            };
        } else {
            return {
                success: response.ok || response.status === 201 || response.status === 204,
                status: response.status,
                statusText: response.statusText
            };
        }
    } catch (error) {
        console.error('WebDAV请求失败:', error);
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}

// 监听来自newtab页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 处理logo搜索请求
    if (request.action === 'searchLogo') {
        const searchTerm = request.searchTerm;
        if (!searchTerm) {
            sendResponse({ error: 'Search term is required' });
            return true;
        }
        
        // 调用搜索函数
        searchLogoFromBaidu(searchTerm, sendResponse);
        return true;
    }

    // 代理获取图片并转为 data URI 返回
    // 规避前端 <img> 在扩展环境下加载外部图源的各类失败（Referer/Sec-Fetch/防盗链等）
    if (request.action === 'fetchLogoImage') {
        const url = request.url;
        if (!url) { sendResponse({ success: false, error: 'url required' }); return true; }
        fetch(url)
            .then(r => r.blob())
            .then(async blob => {
                const buf = await blob.arrayBuffer();
                // MV3 service worker 无 FileReader，手动分块转 base64
                let binary = '';
                const bytes = new Uint8Array(buf);
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                }
                const base64 = btoa(binary);
                sendResponse({ success: true, dataUri: `data:${blob.type || 'image/jpeg'};base64,${base64}` });
            })
            .catch(err => {
                console.log('[LogoProxy] 代理抓图失败:', String(url).slice(0, 100), '|', err.message);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    // 处理WebDAV请求
    if (request.action === 'webdav') {
        handleWebDAVRequest(request).then(sendResponse);
        return true;
    }

    // 默认返回false
    return false;
});

// 从百度图片搜索logo
function searchLogoFromBaidu(searchTerm, sendResponse) {
    const searchUrl = `https://image.baidu.com/search/flip?tn=baiduimage&ie=utf-8&word=${encodeURIComponent(searchTerm + ' logo')}&pn=0&rn=60`;
    
    fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            const logoItems = [];
            
            const regex = /"thumbURL":"([^"]+)"/g;
            let match;
            let count = 0;
            
            // 百度图床对 Chrome 扩展环境请求不稳定（ERR_CONNECTION_CLOSED），限量后置以减少影响
            while ((match = regex.exec(html)) && count < 8) {
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
            
            // 继续搜索搜狗图片，合并结果
            searchLogoFromSogou(searchTerm, sendResponse, logoItems);
        })
        .catch(error => {
            console.error('百度图片搜索失败:', error);
            searchLogoFromSogou(searchTerm, sendResponse, []);
        });
}

// 从搜狗图片搜索logo
function searchLogoFromSogou(searchTerm, sendResponse, existingItems = []) {
    const searchUrl = `https://pic.sogou.com/pics?query=${encodeURIComponent(searchTerm + ' logo')}&di=2&_asf=pic.sogou.com&w=05009900`;
    
    fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            const logoItems = [...existingItems];
            
            const regex = /"thumbUrl":"([^"]+)"/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) && count < 20) {
                try {
                    let logoUrl = match[1];
                    if (logoUrl) {
                        logoUrl = logoUrl.replace(/\\u002F/g, '/');
                        const name = `${searchTerm}_sogou_${count + 1}`;
                        logoItems.push({ name, url: logoUrl });
                        count++;
                    }
                } catch (error) {
                    console.error('解析搜狗图片项失败:', error);
                }
            }
            
            // 继续搜索必应图片，合并结果
            searchLogoFromBing(searchTerm, sendResponse, logoItems);
        })
        .catch(error => {
            console.error('搜狗图片搜索失败:', error);
            searchLogoFromBing(searchTerm, sendResponse, existingItems);
        });
}

// 从必应图片搜索logo
function searchLogoFromBing(searchTerm, sendResponse, existingItems = []) {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(searchTerm + ' logo')}&form=HDRSC2&first=1`;
    
    fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            const logoItems = [...existingItems];
            
            // 必应图片的 murl 在HTML中被转义为 &quot;murl&quot;:&quot;URL&quot;
            // 匹配模式：&quot;murl&quot;:&quot;http(s)://...&quot;
            const regex = /&quot;murl&quot;:&quot;([^&]+)&quot;/g;
            let match;
            let count = 0;
            
            while ((match = regex.exec(html)) && count < 20) {
                try {
                    let logoUrl = match[1];
                    if (logoUrl && logoUrl.startsWith('http')) {
                        logoUrl = logoUrl.replace(/&amp;/g, '&');
                        const name = `${searchTerm}_bing_${count + 1}`;
                        
                        if (!logoItems.some(item => item.url === logoUrl)) {
                            logoItems.push({ name, url: logoUrl });
                            count++;
                        }
                    }
                } catch (error) {
                    console.error('解析必应图片项失败:', error);
                }
            }
            
            // 返回合并后的结果
            sendResponse({ success: true, items: logoItems });
        })
        .catch(error => {
            console.error('必应图片搜索失败:', error);
            // 如果前面已有结果，返回合并的结果
            sendResponse({ success: true, items: existingItems });
        });
}
