# 库存同步工具（Electron + Node.js + SQLite）

该项目实现了一个桌面端库存同步基础框架：
- 主窗口：库存同步主页（入口）
- 子窗口：网页监听配置中心（通过菜单或按钮打开）
- 后台模块：按配置打开目标网页、监听请求头并写入 SQLite、自动刷新、自动登录

## 核心能力

- 支持配置多个网页、每个网页多个监听器。
- 每个监听器监听指定请求头，将值按 `primaryKey` 写入数据库（存在则更新）。
- 支持按页面配置刷新间隔（秒），每次刷新后继续监听。
- 支持手动登录/自动登录配置，自动登录支持选择器字段配置。
- 支持“元素选择器”拾取：从运行中的监听页面进入元素拾取，选择器自动复制剪贴板并回填 UI。
- 支持配置本地持久化，启动后 30 秒倒计时自动运行，可暂停/恢复。
- 关闭主窗口后最小化到托盘，支持开机自动启动切换。
- 提供开发者模式按钮，主界面和配置界面都可打开 DevTools。

## 启动方式

```bash
npm install
npm start
```

## 配置文件

默认配置文件位于 Electron `userData` 目录下的 `config.json`。
也可通过环境变量覆盖：

```bash
CONFIG_PATH=/your/path/config.json npm start
```

## 数据库

默认数据库路径在配置的 `databasePath` 字段，初始值为 `userData/data.sqlite`。
数据表：`header_values`

字段：
- `primary_key`（主键）
- `value`
- `updated_at`
- `page_id`
- `header_name`
