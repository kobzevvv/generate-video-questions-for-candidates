const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const config = require('../config');

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

const AVAILABLE_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

async function generateSpeech(options) {
  const {
    text,
    voice = config.defaultVoice,
    outputPath,
    model = 'tts-1-hd' // or 'tts-1' for faster/cheaper
  } = options;

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS');
  }

  const selectedVoice = AVAILABLE_VOICES.includes(voice) ? voice : config.defaultVoice;

  const openai = getOpenAIClient();

  const response = await openai.audio.speech.create({
    model,
    voice: selectedVoice,
    input: text,
    response_format: 'mp3'
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  return {
    audioPath: outputPath,
    voice: selectedVoice,
    model,
    textLength: text.length
  };
}

function getAvailableVoices() {
  return AVAILABLE_VOICES.map(v => ({
    id: v,
    name: v.charAt(0).toUpperCase() + v.slice(1)
  }));
}

module.exports = {
  generateSpeech,
  getAvailableVoices,
  AVAILABLE_VOICES
};
