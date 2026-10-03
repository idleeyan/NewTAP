import { PRESET_LOGOS, PRESET_CATEGORIES } from './PresetLogos.js';

/**
 * IconLibrary - 常用网站图标库
 *
 * 两部分内容：
 * 1. 预设库：内置 38 个常用网站的品牌风格 LOGO（images/logos/*.svg），随扩展发布，离线可用。
 * 2. 我的收藏：用户自己保存进图库的图标，存在 chrome.storage.local，可增删。
 *
 * 「常用网站」= 浏览器访问统计（chrome.history）按域名聚合后访问量前 30 的站点。
 * 图库会优先展示这些站点，并自动匹配到对应的预设 LOGO。
 */

const TOP_SITES_LIMIT = 30;        // 访问前 30 视为常用网站
const STORAGE_KEY = 'iconLibraryUser'; // 我的收藏
const HISTORY_SCAN = 3000;         // 参与统计的历史条目数
const FREQUENT_TTL = 5 * 60 * 1000; // 常用站点缓存 5 分钟

class IconLibrary {
  constructor() {
    this.presets = PRESET_LOGOS;
    this.categories = PRESET_CATEGORIES;
    this._pngCache = new Map();
    this._svgTextCache = new Map();
    this._frequentCache = null;
    this._frequentAt = 0;
    this._userIcons = null;
  }

  // ---------------------------------------------------------------- 匹配

  /** 提取 host（去掉 www. 前缀） */
  _host(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * 按网址匹配预设 LOGO：先精确域名，再二级/三级后缀匹配
   * @returns {object|null}
   */
  matchByUrl(url) {
    const host = this._host(url);
    if (!host) return null;
    let best = null;
    for (const p of this.presets) {
      for (const d of p.domains) {
        if (host === d) return p;
        if (host.endsWith('.' + d) && (!best || d.length > best._len)) {
          best = { ...p, _len: d.length };
        }
      }
    }
    return best;
  }

  /** 按关键词（名称 / 域名 / id）搜索预设 */
  searchPresets(keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    if (!kw) return [...this.presets];
    return this.presets.filter(p =>
      p.name.toLowerCase().includes(kw) ||
      p.id.includes(kw) ||
      p.domains.some(d => d.includes(kw))
    );
  }

  /** 按分类取预设 */
  getByCategory(cat) {
    return this.presets.filter(p => p.cat === cat);
  }

  // ---------------------------------------------------------------- 常用网站（访问统计 Top N）

  /**
   * 读取访问统计，按域名聚合取前 N（默认 30）作为常用网站
   * @returns {Promise<Array<{domain,name,url,visitCount,preset}>>}
   */
  async getFrequentSites(limit = TOP_SITES_LIMIT) {
    const now = Date.now();
    if (this._frequentCache && now - this._frequentAt < FREQUENT_TTL) {
      return this._frequentCache.slice(0, limit);
    }

    let sites = [];
    try {
      if (chrome.history && chrome.history.search) {
        const res = await chrome.history.search({ text: '', maxResults: HISTORY_SCAN, startTime: 0 });
        const map = new Map();
        for (const item of res || []) {
          if (!item.url || !/^https?:/i.test(item.url)) continue;
          const host = this._host(item.url);
          if (!host || host.startsWith('chrome') || host.includes('localhost')) continue;
          const entry = map.get(host) || { domain: host, name: host, url: item.url, visitCount: 0 };
          entry.visitCount += item.visitCount || 1;
          if (!item.lastVisitTime || item.lastVisitTime > (entry.lastVisit || 0)) {
            entry.lastVisit = item.lastVisitTime || 0;
            entry.url = item.url;
          }
          map.set(host, entry);
        }
        sites = Array.from(map.values()).sort((a, b) => b.visitCount - a.visitCount);
      }
    } catch (e) {
      console.warn('[IconLibrary] 读取访问统计失败', e);
    }

    // 补全：匹配预设、补充中文名
    sites = sites.map(s => {
      const preset = this.matchByUrl('https://' + s.domain);
      return {
        ...s,
        preset,
        name: preset ? preset.name : s.domain,
      };
    });

    this._frequentCache = sites;
    this._frequentAt = now;
    return sites.slice(0, limit);
  }

  /** 常用网站里能匹配到预设 LOGO 的条目（用于「我的常用」分组优先展示设计稿） */
  async getFrequentPresets(limit = TOP_SITES_LIMIT) {
    const sites = await this.getFrequentSites(limit);
    const seen = new Set();
    const out = [];
    for (const s of sites) {
      if (s.preset && !seen.has(s.preset.id)) {
        seen.add(s.preset.id);
        out.push({ ...s.preset, visitCount: s.visitCount });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- 图标数据

  /** 取扩展内资源的绝对地址 */
  _absUrl(file) {
    try {
      return chrome.runtime.getURL(file);
    } catch {
      return file;
    }
  }

  async _fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed: ' + url);
    return await res.text();
  }

  /** 读取预设 SVG 源码 */
  async getSvgText(logo) {
    if (logo.svg) return logo.svg;
    if (this._svgTextCache.has(logo.file)) return this._svgTextCache.get(logo.file);
    const text = await this._fetchText(this._absUrl(logo.file));
    this._svgTextCache.set(logo.file, text);
    return text;
  }

  /**
   * 把预设 SVG 光栅化成 PNG data URI。
   * 存成 PNG 而不是 SVG：跨设备（WebDAV 同步）显示完全一致，不依赖对方系统字体。
   */
  async toPngDataUri(logo, size = 128) {
    const key = (logo.file || logo.id) + '@' + size;
    if (this._pngCache.has(key)) return this._pngCache.get(key);
    try {
      const svgText = await this.getSvgText(logo);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('svg decode failed'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const dataUri = canvas.toDataURL('image/png');
      this._pngCache.set(key, dataUri);
      return dataUri;
    } catch (e) {
      console.warn('[IconLibrary] 转换 PNG 失败，回退 SVG 路径', e);
      return this._absUrl(logo.file);
    }
  }

  /** 把任意图片 URL / data URI 统一转成 PNG data URI（用于「保存到图库」） */
  async imageToPngDataUri(src, size = 128) {
    if (!src) return null;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('image load failed'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- 我的收藏

  async getUserIcons() {
    if (this._userIcons) return this._userIcons;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEY);
      this._userIcons = Array.isArray(res[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
    } catch {
      this._userIcons = [];
    }
    return this._userIcons;
  }

  async addUserIcon({ name, dataUri }) {
    if (!dataUri) return false;
    const list = await this.getUserIcons();
    if (list.some(i => i.dataUri === dataUri)) return false;
    list.unshift({ id: 'u' + Date.now().toString(36), name: name || '自定义图标', dataUri, createdAt: Date.now() });
    this._userIcons = list.slice(0, 120); // 上限 120 个，避免存储膨胀
    await chrome.storage.local.set({ [STORAGE_KEY]: this._userIcons });
    return true;
  }

  async removeUserIcon(id) {
    const list = await this.getUserIcons();
    this._userIcons = list.filter(i => i.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: this._userIcons });
    return true;
  }
}

export const iconLibrary = new IconLibrary();
