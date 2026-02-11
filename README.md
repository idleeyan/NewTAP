# NewTAP - 新标签页扩展

一个美观、实用的 Chrome/Edge 浏览器新标签页扩展，支持自定义书签、快速访问和 WebDAV 同步功能。

![版本](https://img.shields.io/badge/version-1.5.7-blue.svg)
![许可证](https://img.shields.io/badge/license-MIT-green.svg)

## 功能特性

- **美观的界面设计** - 简洁现代的新标签页布局，玻璃态卡片效果
- **自定义书签** - 添加、编辑、删除常用网站书签，支持拖拽排序
- **快速访问** - 一键访问你最常用的网站
- **WebDAV 同步** - 支持通过 WebDAV 同步书签到飞牛NAS等存储服务
- **LOGO 搜索** - 编辑书签时可搜索并选择网站 LOGO 图标
- **便签功能** - 内置便签系统，支持创建和管理多个便签
- **访问统计** - 统计网站访问次数，点击卡片可直接访问
- **滚动导航** - 支持滚轮/触摸滑动在主页、便签页、统计页之间切换
- **响应式设计** - 适配不同屏幕尺寸

## 安装方法

### 开发者模式安装（推荐）

1. 下载本仓库代码并解压
2. 打开 Chrome/Edge 浏览器，进入扩展管理页面 (`chrome://extensions/` 或 `edge://extensions/`)
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的文件夹

## 使用方法

### 基本操作

- **添加书签**：点击页面上的"+"按钮或右键菜单
- **编辑书签**：右键点击书签图标选择编辑，可搜索并选择 LOGO
- **删除书签**：右键点击书签图标选择删除
- **拖拽排序**：长按书签卡片可拖拽调整位置
- **页面导航**：滚轮滑动或点击底部导航切换页面

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
├── manifest.json              # 扩展配置文件
├── newtab.html               # 新标签页主页面
├── background.js             # 后台服务脚本
├── css/                      # 样式文件
│   ├── base.css              # 基础样式、变量
│   ├── components.css        # 组件样式
│   ├── pages.css             # 页面样式
│   └── animations.css        # 动画样式
├── js/                       # JavaScript 模块
│   ├── main.js               # 主入口
│   ├── UIManager.js          # UI 管理器
│   ├── BookmarkManager.js    # 书签管理器
│   ├── SettingsManager.js    # 设置管理器
│   ├── StatsManager.js       # 统计管理器
│   ├── BackupManager.js      # 备份管理器
│   ├── StickyNoteManager.js  # 便签管理器
│   ├── Compass.js            # 指南针组件
│   ├── sync/                 # 同步模块
│   │   ├── WebDAVClient.js   # WebDAV 客户端
│   │   ├── DataMerger.js     # 数据合并
│   │   ├── WebDAVSyncManager.js
│   │   ├── AutoSyncManager.js
│   │   └── index.js
│   └── ui/                   # UI 模块
│       ├── BookmarkRenderer.js
│       ├── StickyNotesRenderer.js
│       ├── StatsRenderer.js
│       ├── PageNavigator.js
│       ├── ScrollNavigator.js
│       └── index.js
├── images/                   # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                 # 本文件
```

## 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **原生 JavaScript** - 无框架依赖，轻量高效
- **ES6 Modules** - 模块化代码组织
- **WebDAV API** - 实现数据同步功能
- **Chrome Storage API** - 本地数据存储
- **CSS Variables** - 主题样式管理

## 更新日志

### v1.5.7
- 统计页面卡片支持点击直接访问网站

### v1.5.6
- 修复对话框内滚动触发页面切换的问题

### v1.5.5
- 增加 LOGO 搜索结果数量（每个搜索引擎 20 个）

### v1.5.4
- 优化 LOGO 搜索结果布局，固定高度可滚动
- 实现悬浮式放大预览面板，智能跟随定位

### v1.5.3
- 设计独立正方形预览面板

### v1.5.2
- 优化 LOGO 悬停放大效果

### v1.5.1
- LOGO 搜索界面添加悬停放大和选中边框效果

### v1.5.0
- 模块化重构：拆分 SyncManager、UIManager 为独立模块
- CSS 提取为独立文件
- 优化首页布局，减少常用网站行数

### v1.4.0
- 新增滚动导航功能
- 支持滚轮/触摸滑动切换页面

### v1.3.0
- 新增便签功能
- 新增访问统计页面

### v1.2.0
- 新增 LOGO 搜索功能
- 支持从百度、搜狗、必应搜索网站图标

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

- [x] 支持主题切换（浅色/深色模式）
- [x] 添加访问统计图表
- [x] 支持导入/导出书签
- [ ] 添加更多搜索引擎选项
- [ ] 支持书签文件夹分类

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
