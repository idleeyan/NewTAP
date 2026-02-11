export class WebDAVClient {
  constructor(config) {
    this.serverUrl = config.serverUrl;
    this.username = config.username;
    this.password = config.password;
    this.syncPath = config.syncPath || '/newtab-sync/';
    this.filename = config.filename || 'newtab-data.json';
  }

  async sendRequest(method, path = '', data = null) {
    console.log('WebDAV: 发送请求', method, path);
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
        console.log('WebDAV: 收到响应', method, path, result);
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
      console.log('WebDAV: PROPFIND 测试结果', result);

      if (!result.success) {
        console.log('WebDAV: PROPFIND 失败，尝试 GET');
        result = await Promise.race([
          this.sendRequest('GET', '/'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET超时')), 10000))
        ]);
        console.log('WebDAV: GET 测试结果', result);
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
        console.log('WebDAV: 目录检查超时', path, error.message);
      }
    }

    return true;
  }

  async uploadData(data) {
    console.log('WebDAV: 开始上传数据');
    const dirResult = await this.ensureDirectory();
    console.log('WebDAV: 目录确保结果', dirResult);

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
      console.log('WebDAV: 尝试上传文件到', filePath);

      try {
        let result = await Promise.race([
          this.sendRequest('PUT', filePath, syncData),
          new Promise((_, reject) => setTimeout(() => reject(new Error('PUT请求超时')), 10000))
        ]);
        console.log('WebDAV: PUT结果', result);

        if (result.success) {
          return true;
        }

        if (result.status === 403 || result.status === 405) {
          console.log('WebDAV: PUT失败，尝试POST');
          result = await Promise.race([
            this.sendRequest('POST', filePath, syncData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('POST请求超时')), 10000))
          ]);
          console.log('WebDAV: POST结果', result);

          if (result.success) {
            return true;
          }
        }
      } catch (error) {
        console.log('WebDAV: 上传请求失败或超时', filePath, error.message);
      }
    }

    console.log('WebDAV: 所有路径都上传失败');
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
      console.log('WebDAV: 尝试下载文件从', filePath);
      try {
        const result = await Promise.race([
          this.sendRequest('GET', filePath),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GET请求超时')), 10000))
        ]);
        console.log('WebDAV: 下载结果', result);

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
        console.log('WebDAV: 下载请求失败或超时', filePath, error.message);
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
        console.log('WebDAV: HEAD请求失败或超时', filePath, error.message);
      }
    }

    return null;
  }
}
