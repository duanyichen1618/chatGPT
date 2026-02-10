const { BrowserWindow } = require('electron');

const normalizeHeaderName = (headerName = '') => headerName.toLowerCase();

class ListenerRuntime {
  constructor({ upsertHeaderValue, db, emitLog }) {
    this.upsertHeaderValue = upsertHeaderValue;
    this.db = db;
    this.emitLog = emitLog;
    this.pageStates = new Map();
  }

  stopAll() {
    [...this.pageStates.keys()].forEach((pageId) => this.stopPage(pageId));
  }

  getActivePages() {
    return [...this.pageStates.values()].map((state) => ({
      pageId: state.pageId,
      name: state.pageConfig.name,
      url: state.pageConfig.url,
      running: !state.window.isDestroyed()
    }));
  }

  runWithConfig(config) {
    this.emitLog('runtime', '开始应用网页监听配置');
    this.stopAll();
    (config.pages || []).forEach((pageConfig, index) => {
      const pageId = pageConfig.id || `page_${index + 1}`;
      this.startPage(pageId, pageConfig, config.settings || {});
    });
  }

  startPage(pageId, pageConfig, settings) {
    this.stopPage(pageId);

    const listenerHeadless = Boolean(settings.listenerHeadless);
    const window = new BrowserWindow({
      width: 1280,
      height: 900,
      show: !listenerHeadless,
      title: `监听页面 - ${pageConfig.name || pageId}`,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: `persist:listener-${pageId}`
      }
    });

    const state = {
      pageId,
      window,
      pageConfig,
      refreshTimer: null,
      listenersAttached: false,
      listenerDisposers: [],
      settings
    };

    this.pageStates.set(pageId, state);
    this.attachRequestListeners(state);
    this.attachLifecycle(state);

    this.emitLog(pageId, `打开页面: ${pageConfig.url}`);
    window.webContents.loadURL(pageConfig.url);
    window.webContents.openDevTools({ mode: 'detach' });

    if (pageConfig.refreshSeconds > 0) {
      state.refreshTimer = setInterval(() => {
        this.emitLog(pageId, '执行定时刷新');
        this.handleRefresh(state);
      }, pageConfig.refreshSeconds * 1000);
    }
  }

  stopPage(pageId) {
    const state = this.pageStates.get(pageId);
    if (!state) {
      return;
    }

    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
    }

    state.listenerDisposers.forEach((dispose) => dispose());
    state.listenerDisposers = [];

    if (state.window && !state.window.isDestroyed()) {
      state.window.destroy();
    }

    this.pageStates.delete(pageId);
    this.emitLog(pageId, '页面监听已停止');
  }

  attachLifecycle(state) {
    const { window, pageId } = state;
    window.on('closed', () => {
      if (this.pageStates.has(pageId)) {
        this.stopPage(pageId);
      }
    });

    window.webContents.on('did-finish-load', async () => {
      this.emitLog(pageId, `页面加载完成: ${window.webContents.getURL()}`);
      await this.tryAutoLogin(state);
    });
  }

  attachRequestListeners(state) {
    if (state.listenersAttached) {
      return;
    }

    const listeners = state.pageConfig.listeners || [];
    const { session } = state.window.webContents;

    listeners.forEach((listener) => {
      const filter = listener.urlPatterns?.length ? { urls: listener.urlPatterns } : { urls: ['*://*/*'] };
      const handler = (details, callback) => {
        const normalizedKey = normalizeHeaderName(listener.headerName);
        const headerEntries = Object.entries(details.requestHeaders || {});
        const matched = headerEntries.find(([key]) => normalizeHeaderName(key) === normalizedKey);
        if (matched && matched[1]) {
          this.upsertHeaderValue(this.db, {
            primaryKey: listener.primaryKey,
            value: matched[1],
            pageId: state.pageId,
            headerName: listener.headerName
          });
          this.emitLog(state.pageId, `捕获请求头 ${listener.headerName} 并写入主键 ${listener.primaryKey}`);
        }
        callback({ requestHeaders: details.requestHeaders });
      };

      session.webRequest.onBeforeSendHeaders(filter, handler);
      state.listenerDisposers.push(() => session.webRequest.onBeforeSendHeaders(null));
    });

    state.listenersAttached = true;
  }

  async handleRefresh(state) {
    const currentUrl = state.window.webContents.getURL();
    const targetUrl = state.pageConfig.url;
    if (currentUrl !== targetUrl && state.pageConfig.autoLogin?.enabled) {
      await this.tryAutoLogin(state);
      return;
    }

    if (!state.window.isDestroyed()) {
      state.window.webContents.reload();
    }
  }

  async tryAutoLogin(state) {
    const autoLogin = state.pageConfig.autoLogin || {};
    const currentUrl = state.window.webContents.getURL();
    if (!autoLogin.enabled || currentUrl === state.pageConfig.url) {
      return;
    }

    this.emitLog(state.pageId, '开始执行自动登录流程');
    const script = `(() => {
      const cfg = ${JSON.stringify(autoLogin)};
      const click = (selector) => {
        if (!selector) return;
        const element = document.querySelector(selector);
        if (element) {
          element.click();
        }
      };
      const fill = (selector, value) => {
        if (!selector) return;
        const element = document.querySelector(selector);
        if (element) {
          element.focus();
          element.value = value || '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      if (cfg.hasLoginTypeButton) {
        click(cfg.loginTypeSelector);
      }
      fill(cfg.usernameSelector, cfg.username);
      fill(cfg.passwordSelector, cfg.password);
      click(cfg.loginButtonSelector);
    })();`;

    await state.window.webContents.executeJavaScript(script, true);
    setTimeout(() => {
      if (!state.window.isDestroyed()) {
        const destination = autoLogin.postLoginUrl || state.pageConfig.url;
        this.emitLog(state.pageId, `自动登录流程结束，10秒后跳转: ${destination}`);
        state.window.webContents.loadURL(destination);
      }
    }, 10000);
  }

  async pickSelector(pageId) {
    const state = this.pageStates.get(pageId);
    if (!state || state.window.isDestroyed()) {
      throw new Error('页面未运行，无法选择元素');
    }

    const result = await state.window.webContents.executeJavaScript(
      `new Promise((resolve) => {
        const oldCursor = document.body.style.cursor;
        document.body.style.cursor = 'crosshair';
        const tooltip = document.createElement('div');
        tooltip.style.position = 'fixed';
        tooltip.style.zIndex = '2147483647';
        tooltip.style.background = 'rgba(0,0,0,0.75)';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '4px 8px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.borderRadius = '4px';
        document.documentElement.appendChild(tooltip);

        const buildSelector = (el) => {
          if (el.id) return '#' + el.id;
          const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          return el.tagName.toLowerCase() + cls;
        };

        const onMove = (event) => {
          const el = event.target;
          tooltip.textContent = buildSelector(el);
          tooltip.style.left = event.clientX + 12 + 'px';
          tooltip.style.top = event.clientY + 12 + 'px';
        };

        const onClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selector = buildSelector(event.target);
          cleanup();
          resolve(selector);
        };

        const cleanup = () => {
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('click', onClick, true);
          document.body.style.cursor = oldCursor;
          tooltip.remove();
        };

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('click', onClick, true);
      })`,
      true
    );

    return result;
  }
}

module.exports = {
  ListenerRuntime
};
