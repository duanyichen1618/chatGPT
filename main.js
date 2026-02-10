const { app } = require('electron');
const path = require('path');
const { DEFAULT_CONFIG_PATH, loadConfig } = require('./src/config');
const { ensureDatabase, upsertHeaderValue } = require('./src/db');
const { createListenerWindow } = require('./src/listener');

const startApp = async () => {
  const configPath = process.env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
  const config = loadConfig(configPath);
  const databasePath = config.databasePath || path.join(process.cwd(), 'data.sqlite');
  const database = await ensureDatabase(databasePath);

  config.pages.forEach((pageConfig) => {
    createListenerWindow({
      pageConfig,
      db: database,
      upsertHeaderValue
    });
  });
};

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  app.quit();
});
