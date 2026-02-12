require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  openaiApiKey: process.env.OPENAI_API_KEY,
  synclabsApiKey: process.env.SYNCLABS_API_KEY, // deprecated, use falApiKey
  falApiKey: process.env.FAL_API_KEY,

  uploadsDir: path.join(ROOT_DIR, process.env.UPLOADS_DIR || 'data/uploads'),
  outputsDir: path.join(ROOT_DIR, process.env.OUTPUTS_DIR || 'data/outputs'),
  jobsDir: path.join(ROOT_DIR, process.env.JOBS_DIR || 'data/jobs'),
  promptsDir: path.join(ROOT_DIR, 'promts'),
  inputExamplesDir: path.join(ROOT_DIR, 'input-examples'),

  // Public base URL for Sync Labs to access files (ngrok, cloudflare tunnel, etc.)
  // Set this when running with ngrok: PUBLIC_BASE_URL=https://abc123.ngrok.io
  publicBaseUrl: process.env.PUBLIC_BASE_URL || null,

  workerPollInterval: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10),

  // Lip-sync settings
  lipSyncEnabled: process.env.LIPSYNC_ENABLED !== 'false',
  lipSyncPollInterval: parseInt(process.env.LIPSYNC_POLL_INTERVAL_MS || '5000', 10),
  lipSyncTimeout: parseInt(process.env.LIPSYNC_TIMEOUT_MS || '600000', 10), // 10 min

  // OpenAI TTS voices: alloy, echo, fable, onyx, nova, shimmer
  defaultVoice: 'nova',
  defaultLanguage: 'en',

  // Default prompt templates to use when generating full question set
  defaultTemplates: [
    'intro-video',
    'must-have-requirements-check',
    'tell-about-relevant-experience',
    'key-frameworks-in-use',
    'failed-plan-fix'
  ]
};
