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

// OpenAI TTS voice characteristics
const VOICE_PROFILES = {
  nova: { gender: 'female', style: 'warm', age: 'young' },
  shimmer: { gender: 'female', style: 'soft', age: 'young' },
  alloy: { gender: 'neutral', style: 'balanced', age: 'middle' },
  echo: { gender: 'male', style: 'neutral', age: 'middle' },
  onyx: { gender: 'male', style: 'deep', age: 'mature' },
  fable: { gender: 'male', style: 'british', age: 'middle' }
};

const AVAILABLE_VOICES = Object.keys(VOICE_PROFILES);

/**
 * Select best matching voice based on criteria
 * @param {Object} criteria - { gender, accent, age }
 * @returns {string} voice id
 */
function selectVoice(criteria = {}) {
  const { gender, accent, age } = criteria;

  // If no criteria, return default
  if (!gender && !accent && !age) {
    return config.defaultVoice;
  }

  let candidates = [...AVAILABLE_VOICES];

  // Filter by gender first
  if (gender === 'male') {
    candidates = candidates.filter(v =>
      VOICE_PROFILES[v].gender === 'male' || VOICE_PROFILES[v].gender === 'neutral'
    );
  } else if (gender === 'female') {
    candidates = candidates.filter(v =>
      VOICE_PROFILES[v].gender === 'female' || VOICE_PROFILES[v].gender === 'neutral'
    );
  }

  // If no candidates after filter, fallback
  if (candidates.length === 0) {
    candidates = [...AVAILABLE_VOICES];
  }

  // Score candidates based on additional criteria
  const scored = candidates.map(voice => {
    let score = 0;
    const profile = VOICE_PROFILES[voice];

    // Gender exact match bonus
    if (gender && profile.gender === gender) {
      score += 10;
    }

    // Age matching
    if (age) {
      if (age < 35 && profile.age === 'young') score += 5;
      else if (age >= 35 && age < 50 && profile.age === 'middle') score += 5;
      else if (age >= 50 && profile.age === 'mature') score += 5;
    }

    // Accent hints (basic mapping - OpenAI doesn't really have accents)
    // For british accent hint, prefer fable
    if (accent) {
      const accentLower = accent.toLowerCase();
      if (accentLower.includes('british') && voice === 'fable') {
        score += 3;
      }
      // For deeper/authoritative, prefer onyx
      if ((accentLower.includes('deep') || accentLower.includes('author')) && voice === 'onyx') {
        score += 3;
      }
    }

    return { voice, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].voice;
}

async function generateSpeech(options) {
  const {
    text,
    voice = null,
    gender = null,
    accent = null,
    age = null,
    outputPath,
    model = 'tts-1-hd'
  } = options;

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS');
  }

  // Select voice: explicit voice > matched voice > default
  let selectedVoice;
  if (voice && AVAILABLE_VOICES.includes(voice)) {
    selectedVoice = voice;
  } else {
    selectedVoice = selectVoice({ gender, accent, age });
  }

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
    voiceProfile: VOICE_PROFILES[selectedVoice],
    model,
    textLength: text.length
  };
}

function getAvailableVoices() {
  return AVAILABLE_VOICES.map(v => ({
    id: v,
    name: v.charAt(0).toUpperCase() + v.slice(1),
    ...VOICE_PROFILES[v]
  }));
}

module.exports = {
  generateSpeech,
  getAvailableVoices,
  selectVoice,
  AVAILABLE_VOICES,
  VOICE_PROFILES
};
