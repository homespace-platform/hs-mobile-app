/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');

// Expo passes app.json in as `config`. google-services.json (Firebase, Android push) is
// not committed; add it only when present so `expo start` still works without it.
module.exports = ({ config }) => {
  const googleServices = './google-services.json';
  if (!fs.existsSync(path.join(__dirname, googleServices))) return config;
  return { ...config, android: { ...config.android, googleServicesFile: googleServices } };
};
