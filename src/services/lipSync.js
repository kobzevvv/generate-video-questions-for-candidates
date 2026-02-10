const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('../config');

const SYNCLABS_API_BASE = 'https://api.sync.so/v2';

async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SYNCLABS_API_BASE);

    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'x-api-key': config.synclabsApiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Sync Labs API error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function createLipSyncJob(options) {
  const {
    videoUrl,
    audioUrl,
    model = 'sync-1.7.1-beta',
    webhookUrl = null
  } = options;

  const body = {
    model,
    input: [
      { type: 'video', url: videoUrl },
      { type: 'audio', url: audioUrl }
    ]
  };

  if (webhookUrl) {
    body.webhookUrl = webhookUrl;
  }

  const response = await apiRequest('POST', '/generate', body);

  return {
    jobId: response.id,
    status: response.status,
    response
  };
}

async function getLipSyncJobStatus(jobId) {
  const response = await apiRequest('GET', `/generate/${jobId}`);

  return {
    jobId: response.id,
    status: response.status,
    outputUrl: response.outputUrl || null,
    error: response.error || null,
    response
  };
}

async function waitForLipSyncCompletion(jobId, maxWaitMs = 600000, pollIntervalMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getLipSyncJobStatus(jobId);

    if (status.status === 'COMPLETED') {
      return status;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Lip-sync job failed: ${status.error || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Lip-sync job timed out after ${maxWaitMs}ms`);
}

async function downloadOutput(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadOutput(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(new Error(`Download failed: ${response.statusCode}`));
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

module.exports = {
  createLipSyncJob,
  getLipSyncJobStatus,
  waitForLipSyncCompletion,
  downloadOutput
};
