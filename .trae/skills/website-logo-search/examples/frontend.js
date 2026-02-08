function performLogoSearch() {
    const logoSearchInput = document.getElementById('logoSearchInput');
    const logoSearchResults = document.getElementById('logoSearchResults');
    
    if (!logoSearchInput || !logoSearchResults) return;
    
    const searchTerm = logoSearchInput.value.trim();
    if (!searchTerm) {
        logoSearchResults.innerHTML = '<p style="text-align:center;padding:10px;color:#333;">请输入搜索关键词</p>';
        return;
    }
    
    logoSearchResults.classList.add('active');
    logoSearchResults.innerHTML = '<p style="text-align:center;padding:20px;">正在搜索...</p>';
    
    chrome.runtime.sendMessage({
        action: 'searchLogo',
        searchTerm: searchTerm
    }, function(response) {
        if (response && response.success) {
            displayLogoResults(response.items);
        } else {
            displaySearchError(response?.error || '搜索失败');
        }
    });
}

function displayLogoResults(logoItems) {
    const logoSearchResults = document.getElementById('logoSearchResults');
    if (!logoSearchResults) return;
    
    if (logoItems.length === 0) {
        logoSearchResults.innerHTML = `
            <div style="text-align:center;padding:20px;">
                <h5>未找到匹配的 Logo</h5>
                <p>请尝试使用其他关键词搜索</p>
            </div>
        `;
        return;
    }
    
    const iconInput = document.getElementById('editIcon');
    
    const resultsHtml = `
        <h5 style="margin-bottom:10px;">搜索结果 (${logoItems.length}个):</h5>
        <div class="results-grid" style="display:flex;flex-wrap:wrap;gap:10px;">
            ${logoItems.map((item, index) => `
                <div class="result-item" data-logo-url="${item.url}" data-logo-name="${item.name}" style="cursor:pointer;text-align:center;">
                    <img src="${item.url}" alt="${item.name}" style="width:48px;height:48px;border-radius:8px;object-fit:contain;background:white;padding:2px;border:2px solid transparent;">
                    <div style="font-size:0.7rem;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">${item.name}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    logoSearchResults.innerHTML = resultsHtml;
    
    document.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', function() {
            const logoUrl = this.dataset.logoUrl;
            
            if (iconInput) {
                iconInput.value = logoUrl;
            }
            
            document.querySelectorAll('.result-item img').forEach(img => {
                img.style.borderColor = 'transparent';
            });
            this.querySelector('img').style.borderColor = '#667eea';
        });
    });
}

function displaySearchError(errorMessage) {
    const logoSearchResults = document.getElementById('logoSearchResults');
    if (!logoSearchResults) return;
    
    logoSearchResults.innerHTML = `
        <div style="text-align:center;padding:20px;color:#ff6b6b;">
            <h5>搜索失败</h5>
            <p>${errorMessage}</p>
        </div>
    `;
}

function setupLogoSearch() {
    const logoSearchBtn = document.getElementById('logoSearchBtn');
    const logoSearchInput = document.getElementById('logoSearchInput');
    const logoSearchResults = document.getElementById('logoSearchResults');
    
    if (logoSearchBtn && logoSearchInput && logoSearchResults) {
        logoSearchBtn.onclick = null;
        logoSearchInput.onkeypress = null;
        
        logoSearchBtn.onclick = () => {
            performLogoSearch();
        };
        
        logoSearchInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                performLogoSearch();
            }
        };
    }
}
