const express = require('express');
const path = require('path');
const config = require('./config');
const jobsRouter = require('./routes/jobs');
const resultsRouter = require('./routes/results');
const { ensureDirectories } = require('./utils/fileUtils');

const app = express();

// Middleware
app.use(express.json());

// Serve static files
app.use('/outputs', express.static(config.outputsDir));
app.use('/uploads', express.static(config.uploadsDir));
app.use('/inputs', express.static(config.inputExamplesDir));

// Routes
app.use('/api/jobs', jobsRouter);
app.use('/results', resultsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0-stage1'
  });
});

// Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Video Questions Generator API',
    version: '1.0.0',
    endpoints: {
      'POST /api/jobs': 'Create a new video processing job',
      'GET /api/jobs/:id': 'Get job status and results (JSON)',
      'GET /results/:id': 'View results as HTML page',
      'GET /api/jobs/meta/templates': 'List available prompt templates',
      'GET /api/jobs/meta/voices': 'List available TTS voices',
      'GET /api/health': 'Health check'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
ensureDirectories();

app.listen(config.port, config.host, () => {
  console.log(`Server running at http://${config.host}:${config.port}`);
  console.log(`Outputs served at http://${config.host}:${config.port}/outputs/`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /api/jobs          - Create job');
  console.log('  GET  /api/jobs/:id      - Get job status (JSON)');
  console.log('  GET  /results/:id       - View results (HTML)');
  console.log('  GET  /api/jobs/meta/templates - List templates');
  console.log('  GET  /api/jobs/meta/voices    - List voices');
  console.log('  GET  /api/health        - Health check');
});

module.exports = app;
