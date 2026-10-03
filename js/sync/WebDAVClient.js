export class WebDAVClient {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.username = config.username;
    this.password = config.password;
    this.syncPath = config.syncPath || '/newtab-sync/';
    this.filename = config.filename || 'newtab-data.json';
  }

  async sendRequest(method, path = '', data = null) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'webdav',
        config: {
          serverUrl: this.serverUrl,
          username: this.username,
          password: this.password
        },
        method: method,
        path: path,
        data: data
      }, (result) => {
        resolve(result);
      });
    });
  }

  async testConnection() {
    try {
      let result = await Promise.race([
        this.sendRequest('PROPFIND'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PROPFIND超时')), 10000))
      ]);

      if (!result.success) {
        result = await Promise.race([
          this.sendRequest('GET', '/'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET超时')), 10000))
        ]);
      }

      return result.success;
    } catch (error) {
      console.error('WebDAV: 测试连接失败', error.message);
      return false;
    }
  }

  async ensureDirectory() {
    const pathsToTry = [
      this.syncPath,
      this.syncPath.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}`,
      this.syncPath.replace(/\/idleeyan\//, '/'),
    ];

    for (const path of pathsToTry) {
      try {
        const result = await Promise.race([
          this.sendRequest('PROPFIND', path),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PROPFIND超时')), 5000))
        ]);

        if (result.success) {
          return true;
        }

        if (result.status === 404) {
          const mkcolResult = await Promise.race([
            this.sendRequest('MKCOL', path),
            new Promise((_, reject) => setTimeout(() => reject(new Error('MKCOL超时')), 5000))
          ]);
          if (mkcolResult.success || mkcolResult.status === 405) {
            return true;
          }
        }
      } catch (error) {
        // Ignore timeout, try next path
      }
    }

    return true;
  }

  async uploadData(data) {
    await this.ensureDirectory();

    const syncData = {
      version: '1.0',
      timestamp: Date.now(),
      device: navigator.userAgent,
      data: data
    };

    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}${this.filename}`,
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
    ];

    for (const filePath of pathsToTry) {
      try {
        let result = await Promise.race([
          this.sendRequest('PUT', filePath, syncData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PUT请求超时')), 10000))
        ]);

        if (result.success) {
          return true;
        }

        if (result.status === 403 || result.status === 405) {
          result = await Promise.race([
            this.sendRequest('POST', filePath, syncData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('POST请求超时')), 10000))
          ]);

          if (result.success) {
            return true;
          }
        }
      } catch (error) {
        // Ignore timeout, try next path
      }
    }

    return false;
  }

  async downloadData() {
    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}${this.filename}`,
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
    ];

    for (const filePath of pathsToTry) {
      try {
        const result = await Promise.race([
          this.sendRequest('GET', filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET请求超时')), 10000))
        ]);

        if (result.success) {
          try {
            const syncData = JSON.parse(result.data);
            return {
              success: true,
              data: syncData.data,
              timestamp: syncData.timestamp,
              version: syncData.version
            };
          } catch (error) {
            return { success: false, error: '解析数据失败: ' + error.message };
          }
        }
      } catch (error) {
        // Ignore timeout, try next path
      }
    }

    return { success: false, error: '服务器上没有同步数据' };
  }

  async getLastSyncInfo() {
    const pathsToTry = [
      `${this.syncPath}${this.filename}`,
      `${this.syncPath}${this.filename}`.replace(/\/$/, ''),
      `/vol1/1000${this.syncPath}${this.filename}`,
      `${this.syncPath.replace(/\/idleeyan\//, '/')}${this.filename}`,
    ];

    for (const filePath of pathsToTry) {
      try {
        const result = await Promise.race([
          this.sendRequest('HEAD', filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('HEAD请求超时')), 5000))
        ]);

        if (result.success) {
          const lastModified = result.headers['last-modified'];
          const contentLength = result.headers['content-length'];

          return {
            lastModified: lastModified ? new Date(lastModified).getTime() : null,
            size: contentLength ? parseInt(contentLength) : 0
          };
        }
      } catch (error) {
        // Ignore timeout, try next path
      }
    }

    return null;
  }
}
