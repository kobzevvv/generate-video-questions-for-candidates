const fs = require('fs');
const path = require('path');

/**
 * Parse YAML-like hiring manager info file
 * Format:
 *   name: Emre
 *   language: English
 *   accent: Turkish-English
 *   gender: male
 */
function parseHiringManagerInfo(content) {
  const info = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(':')) continue;

    const colonIndex = trimmed.indexOf(':');
    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (key && value) {
      info[key] = value;
    }
  }

  return {
    name: info.name || null,
    language: info.language || 'English',
    accent: info.accent || null,
    gender: normalizeGender(info.gender),
    age: info.age ? parseInt(info.age, 10) : null
  };
}

function normalizeGender(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'male' || lower === 'm' || lower === 'мужской') return 'male';
  if (lower === 'female' || lower === 'f' || lower === 'женский') return 'female';
  return null;
}

function loadHiringManagerInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseHiringManagerInfo(content);
}

function loadFromJobDirectory(jobDirPath) {
  const infoPath = path.join(jobDirPath, 'hiring-manager-info.md');
  return loadHiringManagerInfo(infoPath);
}

module.exports = {
  parseHiringManagerInfo,
  loadHiringManagerInfo,
  loadFromJobDirectory
};
