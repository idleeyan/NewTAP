import { iconLibrary } from '../IconLibrary.js';

/**
 * IconLibraryRenderer - 图标库选择面板
 *
 * 三个分组：
 * - 我的常用：访问统计前 30 的网站，命中预设的用设计 LOGO，未命中的用站点 favicon
 * - 全部预设：内置 38 个常用网站设计 LOGO，按分类陈列
 * - 我的收藏：用户自己保存进图库的图标，可删除
 */
export class IconLibraryRenderer {
  constructor() {
    this.tab = 'frequent';
    this.keyword = '';
    this.currentUrl = '';
    this.onSelect = null;
    this._renderToken = 0;
  }

  init(onSelect) {
    this.onSelect = onSelect;
    const dialog = document.getElementById('iconLibraryDialog');
    if (!dialog) return;

    const openBtn = document.getElementById('openIconLibraryBtn');
    if (openBtn) openBtn.addEventListener('click', () => this.open());

    document.getElementById('closeIconLibraryBtn')?.addEventListener('click', () => this.close());
    document.getElementById('closeIconLibraryBtn2')?.addEventListener('click', () => this.close());

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialog.classList.contains('active')) this.close();
    });

    const search = document.getElementById('iconLibrarySearch');
    if (search) {
      search.addEventListener('input', () => {
        this.keyword = search.value.trim();
        this.render();
      });
    }

    const tabs = document.getElementById('iconLibraryTabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.lib-tab');
        if (!btn) return;
        this.tab = btn.dataset.tab;
        tabs.querySelectorAll('.lib-tab').forEach(b => b.classList.toggle('active', b === btn));
        this.render();
      });
    }

    const body = document.getElementById('iconLibraryBody');
    if (body) {
      body.addEventListener('click', (e) => {
        const del = e.target.closest('.lib-del');
        if (del) {
          e.stopPropagation();
          iconLibrary.removeUserIcon(del.dataset.id).then(() => this.render());
          return;
        }
        const item = e.target.closest('.lib-item');
        if (item) this._pick(item);
      });
    }

    const saveBtn = document.getElementById('saveIconToLibraryBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveCurrent());
    }
  }

  /** 打开面板：context 里带当前编辑的网址，用于推荐高亮 */
  open(context = {}) {
    // 未显式传网址时，取编辑弹窗里正在编辑的网址，用于「匹配当前网址」高亮
    this.currentUrl = context.url || document.getElementById('editUrl')?.value || '';
    const dialog = document.getElementById('iconLibraryDialog');
    if (!dialog) return;
    dialog.classList.add('active');
    const search = document.getElementById('iconLibrarySearch');
    if (search) { search.value = ''; this.keyword = ''; }
    this.render();
  }

  close() {
    document.getElementById('iconLibraryDialog')?.classList.remove('active');
  }

  async render() {
    const body = document.getElementById('iconLibraryBody');
    if (!body) return;

    // 每次渲染发一个令牌：异步分组（读访问统计/收藏）返回时若令牌已过期，
    // 说明用户中途切了分组，直接丢弃结果，避免旧内容盖掉新分组
    const token = ++this._renderToken;

    if (this.tab === 'frequent') await this._renderFrequent(body, token);
    else if (this.tab === 'preset') this._renderPreset(body);
    else await this._renderMine(body, token);

    if (token === this._renderToken) this._bindImageFallback(body);
  }

  /** 图片加载不出来时（离线、favicon 缺失）用首字母占位，不留破图 */
  _bindImageFallback(body) {
    body.querySelectorAll('.lib-item img').forEach(img => {
      if (img._fallbackBound) return;
      img._fallbackBound = true;
      img.addEventListener('error', () => {
        const item = img.closest('.lib-item');
        if (!item) return;
        const ph = document.createElement('span');
        ph.className = 'lib-ph';
        ph.textContent = (item.dataset.name || '?').trim().charAt(0).toUpperCase();
        img.replaceWith(ph);
      });
    });
  }

  // ------------------------------------------------------------ 我的常用
  async _renderFrequent(body, token) {
    body.innerHTML = '<div class="lib-loading">正在读取访问统计...</div>';
    const sites = await iconLibrary.getFrequentSites(30);
    if (token !== this._renderToken) return;

    if (!sites.length) {
      body.innerHTML = '<div class="lib-empty">暂无访问统计，换个分组看看，或直接搜索网站名</div>';
      return;
    }

    const kw = this.keyword.toLowerCase();
    const list = kw ? sites.filter(s => (s.name + s.domain).toLowerCase().includes(kw)) : sites;

    if (!list.length) { body.innerHTML = '<div class="lib-empty">没有匹配的常用网站</div>'; return; }

    body.innerHTML = `
      <div class="lib-section-title">按访问次数排序的前 30 个站点${kw ? '（已筛选）' : ''}</div>
      <div class="lib-grid">${list.map((s, i) => {
        const src = s.preset ? s.preset.file : `https://${s.domain}/favicon.ico`;
        const rec = this._isRecommended(s.domain) ? '<span class="lib-badge">匹配当前网址</span>' : '';
        return `<div class="lib-item${this._isRecommended(s.domain) ? ' recommended' : ''}"
                     data-kind="frequent" data-index="${i}" data-src="${src}" data-name="${s.name}">
                  <img src="${src}" alt="${s.name}" loading="lazy">
                  <span class="lib-item-name">${s.name}</span>
                  ${s.preset ? '<span class="lib-dot" title="内置设计 LOGO">设计</span>' : ''}
                  ${rec}
                </div>`;
      }).join('')}</div>`;
  }

  _isRecommended(domain) {
    if (!this.currentUrl) return false;
    const host = iconLibrary._host(this.currentUrl);
    return !!host && (host === domain || host.endsWith('.' + domain));
  }

  // ------------------------------------------------------------ 全部预设
  _renderPreset(body) {
    const kw = this.keyword;
    const result = kw ? iconLibrary.searchPresets(kw) : iconLibrary.presets;

    if (!result.length) { body.innerHTML = '<div class="lib-empty">没有匹配的预设 LOGO</div>'; return; }

    const groups = kw ? [{ cat: '搜索结果', items: result }]
      : iconLibrary.categories.map(c => ({ cat: c, items: result.filter(p => p.cat === c) })).filter(g => g.items.length);

    body.innerHTML = groups.map(g => `
      <div class="lib-section-title">${g.cat}<span class="lib-count">${g.items.length}</span></div>
      <div class="lib-grid">${g.items.map(p => `
        <div class="lib-item" data-kind="preset" data-id="${p.id}" data-file="${p.file}" data-name="${p.name}">
          <img src="${p.file}" alt="${p.name}" loading="lazy">
          <span class="lib-item-name">${p.name}</span>
        </div>`).join('')}</div>`).join('');
  }

  // ------------------------------------------------------------ 我的收藏
  async _renderMine(body, token) {
    const list = await iconLibrary.getUserIcons();
    if (token !== this._renderToken) return;
    if (!list.length) {
      body.innerHTML = '<div class="lib-empty">还没有收藏，点下方「保存当前图标到图库」把正在用的图标存进来</div>';
      return;
    }
    const kw = this.keyword.toLowerCase();
    const shown = kw ? list.filter(i => (i.name || '').toLowerCase().includes(kw)) : list;

    body.innerHTML = `
      <div class="lib-section-title">自定义收藏<span class="lib-count">${shown.length}</span></div>
      <div class="lib-grid">${shown.map(i => `
        <div class="lib-item" data-kind="mine" data-id="${i.id}" data-src="${i.dataUri}" data-name="${i.name}">
          <img src="${i.dataUri}" alt="${i.name}" loading="lazy">
          <span class="lib-item-name">${i.name}</span>
          <span class="lib-del" data-id="${i.id}" title="删除">✕</span>
        </div>`).join('')}</div>`;
  }

  // ------------------------------------------------------------ 选择 / 保存
  async _pick(el) {
    const kind = el.dataset.kind;
    const name = el.dataset.name || '图标';
    let dataUri = el.dataset.src && el.dataset.src.startsWith('data:') ? el.dataset.src : null;

    if (!dataUri) {
      if (kind === 'preset') {
        const logo = iconLibrary.presets.find(p => p.id === el.dataset.id);
        dataUri = await iconLibrary.toPngDataUri(logo);
      } else {
        dataUri = await iconLibrary.imageToPngDataUri(el.dataset.src) || el.dataset.src;
      }
    }

    if (!dataUri) return;
    if (typeof this.onSelect === 'function') this.onSelect(dataUri, name);
  }

  async _saveCurrent() {
    const input = document.getElementById('editIcon');
    const nameInput = document.getElementById('editName');
    if (!input || !input.value) {
      alert('请先在「编辑网站」里填入图标，或直接从下方图库中选择一个');
      return;
    }
    const raw = input.value.trim();
    const dataUri = raw.startsWith('data:') ? raw : await iconLibrary.imageToPngDataUri(raw);
    if (!dataUri) { alert('这个图标无法保存，换一个试试'); return; }
    const ok = await iconLibrary.addUserIcon({ name: nameInput?.value || '自定义图标', dataUri });
    if (ok) {
      this.tab = 'mine';
      document.querySelectorAll('#iconLibraryTabs .lib-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'mine'));
      await this.render();
    }
  }
}
