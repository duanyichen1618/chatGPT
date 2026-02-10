const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  clipboard
} = require('electron');
const { loadConfig, saveConfig } = require('./config-store');
const { ensureDatabase, upsertHeaderValue } = require('./database');
const { ListenerRuntime } = require('./listener-runtime');

let mainWindow = null;
let listenerWindow = null;
let tray = null;
let configPath = '';
let appConfig = null;
let db = null;
let runtime = null;
let countdownTimer = null;
let countdownRemaining = 0;
let paused = false;

const emitToWindows = (channel, payload) => {
  [mainWindow, listenerWindow].forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  });
};

const log = (tag, message) => {
  const line = `【${tag}】${message}`;
  // eslint-disable-next-line no-console
  console.log(line);
  emitToWindows('runtime-log', line);
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 660,
    title: '库存同步中心',
    webPreferences: {
      preload: path.join(__dirname, '../preload/main-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      log('系统', '窗口已隐藏到托盘');
    }
  });
};

const createListenerConfigWindow = () => {
  if (listenerWindow && !listenerWindow.isDestroyed()) {
    listenerWindow.focus();
    return;
  }

  listenerWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    title: '网页监听配置',
    webPreferences: {
      preload: path.join(__dirname, '../preload/listener-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  listenerWindow.loadFile(path.join(__dirname, '../renderer/listener.html'));
  listenerWindow.on('closed', () => {
    listenerWindow = null;
  });
};

const createTray = () => {
  const trayIcon = nativeImage.createEmpty();
  tray = new Tray(trayIcon);
  tray.setToolTip('库存同步工具');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => mainWindow?.show()
    },
    {
      label: '网页监听配置',
      click: () => createListenerConfigWindow()
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow?.show();
  });
};

const setupMenu = () => {
  const menuTemplate = [
    {
      label: '功能',
      submenu: [
        {
          label: '库存同步主页',
          click: () => mainWindow?.show()
        },
        {
          label: '网页监听配置',
          click: () => createListenerConfigWindow()
        },
        {
          label: '开发者模式',
          click: () => {
            mainWindow?.webContents.openDevTools({ mode: 'detach' });
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

const applyRuntimeConfig = () => {
  if (!runtime) {
    return;
  }
  runtime.runWithConfig(appConfig);
  emitToWindows('config-updated', appConfig);
};

const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  countdownRemaining = Number(appConfig.settings.launchDelaySeconds || 30);
  emitToWindows('countdown', { remaining: countdownRemaining, paused });
  log('系统', `启动倒计时 ${countdownRemaining} 秒`);

  countdownTimer = setInterval(() => {
    if (paused) {
      return;
    }

    countdownRemaining -= 1;
    emitToWindows('countdown', { remaining: countdownRemaining, paused });

    if (countdownRemaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      applyRuntimeConfig();
      log('系统', '倒计时结束，自动启动监听');
    }
  }, 1000);
};

const setupIpc = () => {
  ipcMain.handle('get-config', async () => appConfig);
  ipcMain.handle('save-config', async (_, nextConfig) => {
    appConfig = nextConfig;
    saveConfig(configPath, appConfig);
    log('配置', '配置已保存到本地文件');
    return appConfig;
  });

  ipcMain.handle('apply-config-now', async () => {
    applyRuntimeConfig();
    return { ok: true };
  });

  ipcMain.handle('open-listener-window', async () => {
    createListenerConfigWindow();
    return { ok: true };
  });

  ipcMain.handle('set-paused', async (_, nextPaused) => {
    paused = Boolean(nextPaused);
    emitToWindows('countdown', { remaining: countdownRemaining, paused });
    log('系统', paused ? '已暂停自动启动' : '已恢复自动启动');
    return { ok: true, paused };
  });

  ipcMain.handle('toggle-auto-launch', async (_, enabled) => {
    appConfig.settings.autoStartOnBoot = Boolean(enabled);
    app.setLoginItemSettings({ openAtLogin: appConfig.settings.autoStartOnBoot });
    saveConfig(configPath, appConfig);
    log('系统', `开机自启: ${enabled ? '启用' : '关闭'}`);
    return { ok: true };
  });

  ipcMain.handle('toggle-devtools', async (_, target) => {
    const win = target === 'listener' ? listenerWindow : mainWindow;
    if (win && !win.isDestroyed()) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
    return { ok: true };
  });

  ipcMain.handle('pick-selector', async (_, pageId) => {
    const selector = await runtime.pickSelector(pageId);
    clipboard.writeText(selector);
    log('选择器', `已复制选择器到剪贴板: ${selector}`);
    return selector;
  });

  ipcMain.handle('get-active-pages', async () => runtime.getActivePages());
};

const bootstrap = () => {
  app.whenReady().then(() => {
    const loaded = loadConfig();
    configPath = loaded.configPath;
    appConfig = loaded.config;
    db = ensureDatabase(appConfig.databasePath);
    runtime = new ListenerRuntime({
      db,
      upsertHeaderValue,
      emitLog: log
    });

    createMainWindow();
    createTray();
    setupMenu();
    setupIpc();

    app.setLoginItemSettings({ openAtLogin: appConfig.settings.autoStartOnBoot });
    startCountdown();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', (event) => {
    event.preventDefault();
  });

  app.on('before-quit', () => {
    app.isQuiting = true;
    runtime?.stopAll();
  });
};

module.exports = {
  bootstrap
};
