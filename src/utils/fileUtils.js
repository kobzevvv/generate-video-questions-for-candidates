const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../config');

function ensureDirectories() {
  const dirs = [config.uploadsDir, config.outputsDir, config.jobsDir];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download: ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

function saveJob(jobId, jobData) {
  const jobPath = path.join(config.jobsDir, `${jobId}.json`);
  fs.writeFileSync(jobPath, JSON.stringify(jobData, null, 2));
}

function loadJob(jobId) {
  const jobPath = path.join(config.jobsDir, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) return null;
  return JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
}

function listPendingJobs() {
  ensureDirectories();
  const files = fs.readdirSync(config.jobsDir).filter(f => f.endsWith('.json'));
  const pendingJobs = [];

  for (const file of files) {
    const jobId = file.replace('.json', '');
    const job = loadJob(jobId);
    if (job && job.status === 'pending') {
      pendingJobs.push(job);
    }
  }

  return pendingJobs.sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );
}

module.exports = {
  ensureDirectories,
  downloadFile,
  saveJob,
  loadJob,
  listPendingJobs
};
