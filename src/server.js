const express = require('express');
const path = require('path');
const config = require('./config');
const jobsRouter = require('./routes/jobs');
const resultsRouter = require('./routes/results');
const formRouter = require('./routes/form');
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
app.use('/form', formRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0-stage1'
  });
});

// Root - redirect to form
app.get('/', (req, res) => {
  res.redirect('/form/');
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
  console.log(`Form: http://${config.host}:${config.port}/form/`);
  console.log(`Results: http://${config.host}:${config.port}/results/`);
});

module.exports = app;
