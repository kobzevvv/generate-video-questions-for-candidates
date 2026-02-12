const fs = require('fs');
const https = require('https');
const config = require('../config');

// Using fal.ai API for Sync Labs lipsync model
const FAL_API_BASE = 'https://fal.run/fal-ai/sync-lipsync/v2';
const FAL_QUEUE_BASE = 'https://queue.fal.run/fal-ai/sync-lipsync/v2';

function makeRequest(url, method, body, apiKey) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      method,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Authorization': `Key ${apiKey}`,
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
            reject(new Error(`fal.ai API error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`fal.ai API error: ${res.statusCode} - ${data}`));
          } else {
            reject(new Error(`Failed to parse response: ${data}`));
          }
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

/**
 * Create a lip-sync job using fal.ai queue API
 */
async function createLipSyncJob(options) {
  const {
    videoUrl,
    audioUrl,
    model = 'lipsync-2', // or 'lipsync-2-pro'
    syncMode = 'cut_off' // cut_off, loop, bounce, silence, remap
  } = options;

  const body = {
    video_url: videoUrl,
    audio_url: audioUrl,
    model,
    sync_mode: syncMode
  };

  // Use queue API for async processing
  const response = await makeRequest(
    FAL_QUEUE_BASE,
    'POST',
    body,
    config.falApiKey
  );

  return {
    requestId: response.request_id,
    status: response.status || 'IN_QUEUE',
    response
  };
}

/**
 * Get job status from fal.ai
 */
async function getLipSyncJobStatus(requestId) {
  const statusUrl = `https://queue.fal.run/fal-ai/sync-lipsync/v2/requests/${requestId}/status`;

  const response = await makeRequest(
    statusUrl,
    'GET',
    null,
    config.falApiKey
  );

  return {
    requestId,
    status: response.status,
    response
  };
}

/**
 * Get completed job result
 */
async function getLipSyncResult(requestId) {
  const resultUrl = `https://queue.fal.run/fal-ai/sync-lipsync/v2/requests/${requestId}`;

  const response = await makeRequest(
    resultUrl,
    'GET',
    null,
    config.falApiKey
  );

  return {
    requestId,
    outputUrl: response.video?.url || null,
    video: response.video,
    response
  };
}

/**
 * Wait for lip-sync job to complete
 */
async function waitForLipSyncCompletion(requestId, maxWaitMs = 600000, pollIntervalMs = 5000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getLipSyncJobStatus(requestId);

    console.log(`  [fal.ai] Status: ${status.status}`);

    if (status.status === 'COMPLETED') {
      // Get the result
      const result = await getLipSyncResult(requestId);
      return result;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Lip-sync job failed: ${JSON.stringify(status.response)}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Lip-sync job timed out after ${maxWaitMs}ms`);
}

/**
 * Run lip-sync synchronously (for shorter videos)
 */
async function runLipSyncSync(options) {
  const {
    videoUrl,
    audioUrl,
    model = 'lipsync-2',
    syncMode = 'cut_off'
  } = options;

  const body = {
    video_url: videoUrl,
    audio_url: audioUrl,
    model,
    sync_mode: syncMode
  };

  // Direct synchronous call (blocks until complete, good for short videos)
  const response = await makeRequest(
    FAL_API_BASE,
    'POST',
    body,
    config.falApiKey
  );

  return {
    outputUrl: response.video?.url || null,
    video: response.video,
    response
  };
}

/**
 * Download video from URL
 */
async function downloadOutput(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, (response) => {
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
  getLipSyncResult,
  waitForLipSyncCompletion,
  runLipSyncSync,
  downloadOutput
};
