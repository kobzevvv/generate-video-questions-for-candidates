require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',

  openaiApiKey: process.env.OPENAI_API_KEY,
  synclabsApiKey: process.env.SYNCLABS_API_KEY,

  uploadsDir: path.join(ROOT_DIR, process.env.UPLOADS_DIR || 'data/uploads'),
  outputsDir: path.join(ROOT_DIR, process.env.OUTPUTS_DIR || 'data/outputs'),
  jobsDir: path.join(ROOT_DIR, process.env.JOBS_DIR || 'data/jobs'),
  promptsDir: path.join(ROOT_DIR, 'promts'),

  workerPollInterval: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10),

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
