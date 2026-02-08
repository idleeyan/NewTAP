# NewTAP - 新标签页扩展

一个美观、实用的 Chrome/Edge 浏览器新标签页扩展，支持自定义书签、快速访问和 WebDAV 同步功能。

![版本](https://img.shields.io/badge/version-1.1-blue.svg)
![许可证](https://img.shields.io/badge/license-MIT-green.svg)

## 功能特性

- 美观的界面设计 - 简洁现代的新标签页布局
- 自定义书签 - 添加、编辑、删除常用网站书签
- 快速访问 - 一键访问你最常用的网站
- WebDAV 同步 - 支持通过 WebDAV 同步书签到飞牛NAS等存储服务
- 搜索功能 - 快速搜索书签和访问历史
- 网站图标自动获取 - 自动获取并显示网站 favicon
- 响应式设计 - 适配不同屏幕尺寸

## 安装方法

### 方式一：Chrome 网上应用店（推荐）

1. 访问 Chrome 网上应用店
2. 搜索 "NewTAP" 或 "新标签页"
3. 点击"添加至 Chrome"

### 方式二：开发者模式安装

1. 下载本仓库代码并解压
2. 打开 Chrome/Edge 浏览器，进入扩展管理页面 (`chrome://extensions/` 或 `edge://extensions/`)
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的文件夹

## 使用方法

### 基本操作

- **添加书签**：点击页面上的"+"按钮或右键菜单
- **编辑书签**：右键点击书签图标选择编辑
- **删除书签**：右键点击书签图标选择删除
- **搜索**：使用页面顶部的搜索框快速查找书签

### WebDAV 同步设置

1. 点击右上角的设置图标
2. 选择"同步设置"
3. 输入 WebDAV 服务器地址、用户名和密码
4. 点击"测试连接"验证配置
5. 启用自动同步或手动点击同步按钮

#### 飞牛NAS WebDAV 配置示例

- **服务器地址**：`http://你的NAS地址:5005/webdav/`
- **用户名**：你的飞牛NAS用户名
- **密码**：你的飞牛NAS密码

## 文件结构

```
新标签页/
├── manifest.json          # 扩展配置文件
├── newtab.html           # 新标签页主页面
├── newtab.js             # 新标签页主逻辑
├── popup.html            # 弹出窗口页面
├── popup.js              # 弹出窗口逻辑
├── background.js         # 后台服务脚本
├── webdav.js             # WebDAV 同步功能
├── js/                   # JavaScript 模块
│   ├── main.js           # 主入口
│   ├── UIManager.js      # UI 管理器
│   ├── BookmarkManager.js # 书签管理器
│   ├── SettingsManager.js # 设置管理器
│   ├── SyncManager.js    # 同步管理器
│   ├── StatsManager.js   # 统计管理器
│   ├── BackupManager.js  # 备份管理器
│   └── Compass.js        # 指南针组件
├── images/               # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 本文件
```

## 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖，轻量高效
- **WebDAV API** - 实现数据同步功能
- **Chrome Storage API** - 本地数据存储
- **Chrome Bookmarks API** - 浏览器书签集成

## 更新日志

### v1.1
- 新增 WebDAV 同步功能
- 优化书签管理界面
- 改进搜索功能
- 修复已知问题

### v1.0
- 初始版本发布
- 基础书签管理功能
- 新标签页替换

## 开发计划

- [ ] 支持主题切换（浅色/深色模式）
- [ ] 添加更多搜索引擎选项
- [ ] 支持书签文件夹分类
- [ ] 添加访问统计图表
- [ ] 支持导入/导出书签

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- GitHub: [@idleeyan](https://github.com/idleeyan)
- 项目地址: https://github.com/idleeyan/NewTAP

## 致谢

感谢所有为本项目提供建议和帮助的朋友们！
