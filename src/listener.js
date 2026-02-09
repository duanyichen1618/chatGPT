const { BrowserWindow } = require('electron');

const normalizeHeaderName = (headerName) => headerName.toLowerCase();

const createListenerWindow = ({ pageConfig, db, upsertHeaderValue }) => {
  const window = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const { webContents } = window;

  const attachListeners = () => {
    const listeners = pageConfig.listeners || [];

    listeners.forEach((listener) => {
      const filter = listener.urlPatterns?.length
        ? { urls: listener.urlPatterns }
        : { urls: ['*://*/*'] };

      webContents.session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        const headerKey = normalizeHeaderName(listener.headerName);
        const headerValue = details.requestHeaders[headerKey] || details.requestHeaders[listener.headerName];

        if (headerValue) {
          upsertHeaderValue(db, listener.primaryKey, String(headerValue));
        }

        callback({ requestHeaders: details.requestHeaders });
      });
    });
  };

  const runAutoLogin = async () => {
    const { autoLogin = {}, url } = pageConfig;

    if (!autoLogin.enabled) {
      return;
    }

    const currentUrl = webContents.getURL();
    if (currentUrl === url) {
      return;
    }

    await webContents.executeJavaScript(
      `(() => {
        const autoLogin = ${JSON.stringify(autoLogin)};
        const clickIfExists = (selector) => {
          if (!selector) return;
          const el = document.querySelector(selector);
          if (el) el.click();
        };

        if (autoLogin.hasLoginTypeButton) {
          clickIfExists(autoLogin.loginTypeSelector);
        }

        const usernameEl = document.querySelector(autoLogin.usernameSelector);
        if (usernameEl) {
          usernameEl.focus();
          usernameEl.value = autoLogin.username;
          usernameEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const passwordEl = document.querySelector(autoLogin.passwordSelector);
        if (passwordEl) {
          passwordEl.focus();
          passwordEl.value = autoLogin.password;
          passwordEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        clickIfExists(autoLogin.loginButtonSelector);
      })();`
    );

    setTimeout(() => {
      const targetUrl = autoLogin.postLoginUrl || url;
      if (targetUrl) {
        webContents.loadURL(targetUrl);
      }
    }, 10000);
  };

  const startRefreshTimer = () => {
    if (!pageConfig.refreshSeconds) {
      return;
    }

    setInterval(() => {
      const currentUrl = webContents.getURL();
      if (currentUrl !== pageConfig.url && pageConfig.autoLogin?.enabled) {
        runAutoLogin();
        return;
      }

      webContents.reload();
    }, pageConfig.refreshSeconds * 1000);
  };

  webContents.on('did-finish-load', () => {
    runAutoLogin();
  });

  attachListeners();
  startRefreshTimer();
  webContents.loadURL(pageConfig.url);

  return window;
};

module.exports = {
  createListenerWindow
};
