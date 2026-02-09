const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config.json');

const loadConfig = (configPath = DEFAULT_CONFIG_PATH) => {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);

  if (!Array.isArray(config.pages)) {
    throw new Error('Config must include a pages array.');
  }

  return config;
};

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadConfig
};
