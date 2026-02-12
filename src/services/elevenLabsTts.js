const fs = require('fs');
const https = require('https');
const config = require('../config');

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Generate speech using ElevenLabs API
 */
async function generateSpeech(options) {
  const {
    text,
    voiceId,
    outputPath,
    modelId = 'eleven_multilingual_v2', // Best for accents
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true
  } = options;

  if (!config.elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  if (!voiceId) {
    throw new Error('voiceId is required for ElevenLabs TTS');
  }

  const requestBody = JSON.stringify({
    text,
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost
    }
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`);

    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey
      }
    };

    const req = https.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', chunk => errorBody += chunk);
        res.on('end', () => {
          reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${errorBody}`));
        });
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({
          outputPath,
          voice: voiceId,
          provider: 'elevenlabs',
          model: modelId
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * List available voices
 */
async function listVoices() {
  if (!config.elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const url = new URL(`${ELEVENLABS_API_BASE}/voices`);

    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'xi-api-key': config.elevenLabsApiKey
      }
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${body}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(data.voices || []);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Get user subscription info (to check remaining characters)
 */
async function getSubscriptionInfo() {
  if (!config.elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const url = new URL(`${ELEVENLABS_API_BASE}/user/subscription`);

    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'xi-api-key': config.elevenLabsApiKey
      }
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  generateSpeech,
  listVoices,
  getSubscriptionInfo
};
