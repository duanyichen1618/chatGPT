let configState = null;
const pagesContainer = document.getElementById('pages');

const ensurePageDefaults = (page) => ({
  id: page.id || `page_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  name: page.name || '',
  url: page.url || '',
  refreshSeconds: Number(page.refreshSeconds) || 30,
  manualLogin: page.manualLogin ?? true,
  listeners: Array.isArray(page.listeners) ? page.listeners : [],
  autoLogin: {
    collapsed: page.autoLogin?.collapsed ?? false,
    enabled: page.autoLogin?.enabled ?? false,
    hasLoginTypeButton: page.autoLogin?.hasLoginTypeButton ?? false,
    loginTypeSelector: page.autoLogin?.loginTypeSelector || '',
    usernameSelector: page.autoLogin?.usernameSelector || '',
    username: page.autoLogin?.username || '',
    passwordSelector: page.autoLogin?.passwordSelector || '',
    password: page.autoLogin?.password || '',
    loginButtonSelector: page.autoLogin?.loginButtonSelector || '',
    postLoginUrl: page.autoLogin?.postLoginUrl || ''
  }
});

const selectorInput = (label, pageId, field, value) => `
  <label>${label}
    <div class="row">
      <input data-field="${field}" data-id="${pageId}" value="${escapeHtml(value || '')}" />
      <button data-action="pick-selector" data-id="${pageId}" data-target-field="${field}" type="button">元素选择器</button>
    </div>
  </label>
`;

const render = async () => {
  pagesContainer.innerHTML = '';
  const activePages = await window.listenerApi.getActivePages();

  configState.pages.forEach((page, index) => {
    const card = document.createElement('div');
    card.className = 'panel';

    const isRunning = activePages.some((item) => item.pageId === page.id && item.running);
    const collapseText = page.autoLogin.collapsed ? '展开自动登录配置' : '收起自动登录配置';

    card.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <h2>页面 ${index + 1} <span class="badge">${isRunning ? '运行中' : '未运行'}</span></h2>
        <button class="danger" data-action="remove-page" data-id="${page.id}">删除页面</button>
      </div>
      <div class="grid">
        <label>页面名称<input data-field="name" data-id="${page.id}" value="${escapeHtml(page.name)}" /></label>
        <label>页面URL<input data-field="url" data-id="${page.id}" value="${escapeHtml(page.url)}" /></label>
        <label>刷新秒数<input data-field="refreshSeconds" data-id="${page.id}" type="number" min="1" value="${page.refreshSeconds}" /></label>
        <label style="flex-direction:row;align-items:center;gap:6px;margin-top:18px;">手动登录<input data-field="manualLogin" data-id="${page.id}" type="checkbox" ${page.manualLogin ? 'checked' : ''} /></label>
      </div>

      <div class="card" style="margin-top:8px;">
        <div class="row" style="justify-content:space-between;">
          <h3>自动登录配置</h3>
          <button class="secondary" data-action="toggle-autologin-collapse" data-id="${page.id}">${collapseText}</button>
        </div>
        <div class="row" style="margin-top:8px;">
          <label style="flex-direction:row;align-items:center;gap:6px;">自动登录<input data-field="autoLogin.enabled" data-id="${page.id}" type="checkbox" ${page.autoLogin.enabled ? 'checked' : ''} /></label>
          <label style="flex-direction:row;align-items:center;gap:6px;">有登录类型按钮<input data-field="autoLogin.hasLoginTypeButton" data-id="${page.id}" type="checkbox" ${page.autoLogin.hasLoginTypeButton ? 'checked' : ''} /></label>
        </div>
        <div class="grid" style="margin-top:8px; display:${page.autoLogin.collapsed ? 'none' : 'grid'};">
          ${selectorInput('登录类型按钮', page.id, 'autoLogin.loginTypeSelector', page.autoLogin.loginTypeSelector)}
          ${selectorInput('用户名输入框', page.id, 'autoLogin.usernameSelector', page.autoLogin.usernameSelector)}
          <label>用户名<input data-field="autoLogin.username" data-id="${page.id}" value="${escapeHtml(page.autoLogin.username)}" /></label>
          ${selectorInput('密码输入框', page.id, 'autoLogin.passwordSelector', page.autoLogin.passwordSelector)}
          <label>密码<input data-field="autoLogin.password" data-id="${page.id}" value="${escapeHtml(page.autoLogin.password)}" /></label>
          ${selectorInput('登录按钮', page.id, 'autoLogin.loginButtonSelector', page.autoLogin.loginButtonSelector)}
          <label>登录后跳转URL<input data-field="autoLogin.postLoginUrl" data-id="${page.id}" value="${escapeHtml(page.autoLogin.postLoginUrl)}" /></label>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <h3>请求头监听器</h3>
          <button data-action="add-listener" data-id="${page.id}">新增监听器</button>
        </div>
        <div id="listeners-${page.id}"></div>
      </div>
    `;

    pagesContainer.appendChild(card);

    const listenerContainer = card.querySelector(`#listeners-${page.id}`);
    (page.listeners || []).forEach((listener, listenerIndex) => {
      const row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = `
        <div class="row" style="justify-content:space-between;">
          <strong>监听器 ${listenerIndex + 1}</strong>
          <button class="danger" data-action="remove-listener" data-id="${page.id}" data-index="${listenerIndex}">删除</button>
        </div>
        <div class="grid">
          <label>监听器名称<input data-listener-field="name" data-id="${page.id}" data-index="${listenerIndex}" value="${escapeHtml(listener.name || '')}" /></label>
          <label>主键(primaryKey)<input data-listener-field="primaryKey" data-id="${page.id}" data-index="${listenerIndex}" value="${escapeHtml(listener.primaryKey || '')}" /></label>
          <label>请求头名称<input data-listener-field="headerName" data-id="${page.id}" data-index="${listenerIndex}" value="${escapeHtml(listener.headerName || '')}" /></label>
          <label>URL匹配(逗号分隔)<input data-listener-field="urlPatterns" data-id="${page.id}" data-index="${listenerIndex}" value="${escapeHtml((listener.urlPatterns || []).join(','))}" /></label>
        </div>
      `;
      listenerContainer.appendChild(row);
    });
  });

  bindEvents();
};

const bindEvents = () => {
  document.querySelectorAll('[data-field]').forEach((el) => {
    el.onchange = (event) => {
      const page = configState.pages.find((p) => p.id === event.target.dataset.id);
      if (!page) return;
      const field = event.target.dataset.field;
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setByPath(page, field, field === 'refreshSeconds' ? Number(value) : value);
    };
  });

  document.querySelectorAll('[data-listener-field]').forEach((el) => {
    el.onchange = (event) => {
      const { id, index, listenerField } = event.target.dataset;
      const page = configState.pages.find((p) => p.id === id);
      if (!page) return;
      const listener = page.listeners[Number(index)];
      if (!listener) return;

      if (listenerField === 'urlPatterns') {
        listener.urlPatterns = String(event.target.value).split(',').map((item) => item.trim()).filter(Boolean);
      } else {
        listener[listenerField] = event.target.value;
      }
    };
  });

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = async (event) => {
      const { action, id, index, targetField } = event.target.dataset;
      if (action === 'remove-page') {
        configState.pages = configState.pages.filter((p) => p.id !== id);
        await render();
      } else if (action === 'add-listener') {
        const page = configState.pages.find((p) => p.id === id);
        page.listeners.push({ name: '', primaryKey: '', headerName: '', urlPatterns: [] });
        await render();
      } else if (action === 'remove-listener') {
        const page = configState.pages.find((p) => p.id === id);
        page.listeners.splice(Number(index), 1);
        await render();
      } else if (action === 'toggle-autologin-collapse') {
        const page = configState.pages.find((p) => p.id === id);
        page.autoLogin.collapsed = !page.autoLogin.collapsed;
        await render();
      } else if (action === 'pick-selector') {
        const selector = await window.listenerApi.pickSelector(id);
        const page = configState.pages.find((p) => p.id === id);
        setByPath(page, targetField, selector);
        await render();
      }
    };
  });
};

const setByPath = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      current[key] = value;
      return;
    }
    current[key] = current[key] || {};
    current = current[key];
  });
};

const escapeHtml = (str) => String(str || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

document.getElementById('add-page').onclick = async () => {
  configState.pages.push(ensurePageDefaults({}));
  await render();
};

document.getElementById('save').onclick = async () => {
  await window.listenerApi.saveConfig(configState);
};

document.getElementById('apply').onclick = async () => {
  await window.listenerApi.saveConfig(configState);
  await window.listenerApi.applyConfigNow();
};

document.getElementById('devtools').onclick = async () => {
  await window.listenerApi.toggleDevtools();
};

window.listenerApi.onConfigUpdated((newConfig) => {
  configState = {
    ...newConfig,
    pages: (newConfig.pages || []).map(ensurePageDefaults)
  };
  render();
});

window.listenerApi.getConfig().then((loaded) => {
  configState = {
    ...loaded,
    pages: (loaded.pages || []).map(ensurePageDefaults)
  };
  render();
});
