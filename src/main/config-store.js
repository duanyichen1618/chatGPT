const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const getDefaultConfig = () => ({
  settings: {
    launchDelaySeconds: 30,
    autoStartOnBoot: false,
    listenerHeadless: false,
    autoLoginHeadless: false
  },
  databasePath: path.join(app.getPath('userData'), 'data.sqlite'),
  pages: []
});

const resolveConfigPath = () => process.env.CONFIG_PATH || path.join(app.getPath('userData'), 'config.json');

const loadConfig = () => {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    const fallback = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(fallback, null, 2), 'utf-8');
    return { configPath, config: fallback };
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const merged = {
    ...getDefaultConfig(),
    ...parsed,
    settings: {
      ...getDefaultConfig().settings,
      ...(parsed.settings || {})
    },
    pages: Array.isArray(parsed.pages) ? parsed.pages : []
  };

  return { configPath, config: merged };
};

const saveConfig = (configPath, config) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
};

module.exports = {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  resolveConfigPath
};
