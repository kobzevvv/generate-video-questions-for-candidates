const OpenAI = require('openai');
const config = require('../config');

/**
 * Curated list of high-quality ElevenLabs voices with accents
 * These are pre-selected for professional interview context
 */
const VOICE_LIBRARY = [
  // ========== BRITISH ENGLISH ==========
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', accent: 'british', gender: 'male', age: 'middle', description: 'warm, professional British male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', accent: 'british', gender: 'male', age: 'middle', description: 'deep British male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', accent: 'british', gender: 'female', age: 'young', description: 'pleasant British female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', accent: 'british', gender: 'female', age: 'middle', description: 'confident British female' },

  // ========== AMERICAN ENGLISH ==========
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'american', gender: 'female', age: 'young', description: 'calm American female' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', accent: 'american', gender: 'female', age: 'young', description: 'warm American female' },
  { id: 'LcfcDJNUP1GQjkzn1xUU', name: 'Emily', accent: 'american', gender: 'female', age: 'young', description: 'calm American female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'american', gender: 'male', age: 'young', description: 'professional American male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'american', gender: 'male', age: 'young', description: 'deep American male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'american', gender: 'male', age: 'middle', description: 'deep American male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', accent: 'american', gender: 'male', age: 'mature', description: 'authoritative American male' },

  // ========== AUSTRALIAN ENGLISH ==========
  { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', accent: 'australian', gender: 'male', age: 'mature', description: 'calm Australian male' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', accent: 'australian', gender: 'male', age: 'middle', description: 'casual Australian male' },

  // ========== INDIAN ENGLISH ==========
  { id: 'N2al4jd45e882svx17SU', name: 'Aakash', accent: 'indian', gender: 'male', age: 'middle', description: 'professional Indian male' },
  { id: 'k7nOSUCadIEwB6fdJmbw', name: 'Ahmed', accent: 'indian', gender: 'male', age: 'middle', description: 'warm professional Indian male' },
  { id: 'mfMM3ijQgz8QtMeKifko', name: 'Riya', accent: 'indian', gender: 'female', age: 'young', description: 'professional Indian female' },
  { id: 'pGYsZruQzo8cpdFVZyJc', name: 'Smriti', accent: 'indian', gender: 'female', age: 'middle', description: 'warm Indian female' },

  // ========== ARABIC / DUBAI / MIDDLE EAST ==========
  { id: 'G1HOkzin3NMwRHSq60UI', name: 'Chaouki', accent: 'arabic', gender: 'male', age: 'middle', description: 'deep professional Arabic male' },
  { id: '5Spsi3mCH9e7futpnGE5', name: 'Fares', accent: 'arabic', gender: 'male', age: 'middle', description: 'warm Gulf Arabic male' },
  { id: 'qi4PkV9c01kb869Vh7Su', name: 'Asmaa', accent: 'arabic', gender: 'female', age: 'young', description: 'gentle Arabic female' },
  { id: 'a1KZUXKFVFDOb33I1uqr', name: 'Salma', accent: 'arabic', gender: 'female', age: 'young', description: 'young talented Arabic female' },

  // ========== RUSSIAN ==========
  { id: '1qd9R09Ljlx9V1Ok0t5S', name: 'Ivan', accent: 'russian', gender: 'male', age: 'middle', description: 'deep velvety Russian male' },
  { id: 'kwajW3Xh5svCeKU5ky2S', name: 'Dmitry', accent: 'russian', gender: 'male', age: 'young', description: 'cheerful Russian male' },
  { id: '8M81RK3MD7u4DOJpu2G5', name: 'Viktoriia', accent: 'russian', gender: 'female', age: 'young', description: 'clear resonant Russian female' },
  { id: 'C3FusDjPequ6qFchqpzu', name: 'Ekaterina', accent: 'russian', gender: 'female', age: 'middle', description: 'warm engaging Russian female' },

  // ========== CHINESE / MANDARIN ==========
  { id: '4VZIsMPtgggwNg7OXbPY', name: 'James Gao', accent: 'chinese', gender: 'male', age: 'middle', description: 'calm friendly Chinese male' },
  { id: 'Ixmp8zKRajBp10jLtsrq', name: 'Lazarus', accent: 'chinese', gender: 'male', age: 'young', description: 'neutral Mandarin male' },
  { id: 'bhJUNIXWQQ94l8eI2VUf', name: 'Amy', accent: 'chinese', gender: 'female', age: 'young', description: 'natural friendly Chinese female' },
  { id: 'ByhETIclHirOlWnWKhHc', name: 'ShanShan', accent: 'chinese', gender: 'female', age: 'young', description: 'youthful lively Chinese female' },

  // ========== LATIN AMERICAN SPANISH ==========
  { id: 'wSFJ1H2XywFI0wLdTylp', name: 'Karim', accent: 'latam', gender: 'male', age: 'young', description: 'neutral Mexican male' },
  { id: 'W6Z2FAa578IKOGSVo2sA', name: 'Eduardo', accent: 'latam', gender: 'male', age: 'middle', description: 'authentic Mexican male' },
  { id: 'J4vZAFDEcpenkMp3f3R9', name: 'Valentina', accent: 'latam', gender: 'female', age: 'young', description: 'conversational Colombian female' },
  { id: 'VmejBeYhbrcTPwDniox7', name: 'Lina', accent: 'latam', gender: 'female', age: 'young', description: 'warm friendly Colombian female' },

  // ========== SPANISH (SPAIN) ==========
  { id: 'usTmJvQOCyW3nRcZ8OEo', name: 'Dante', accent: 'spanish', gender: 'male', age: 'middle', description: 'dynamic Castilian Spanish male' },
  { id: '1vLlJCWRhRcfmTewn4cm', name: 'Javier', accent: 'spanish', gender: 'male', age: 'middle', description: 'expressive Spanish male' },
  { id: 'dHdIIFZMLzs6XfsGtmIP', name: 'Sheila', accent: 'spanish', gender: 'female', age: 'middle', description: 'dynamic Spanish female' },

  // ========== GERMAN ==========
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', accent: 'german', gender: 'male', age: 'middle', description: 'clear German male' },

  // ========== FRENCH ==========
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', accent: 'french', gender: 'female', age: 'young', description: 'elegant French female' },

  // ========== ITALIAN ==========
  { id: 'zcAOhNBS3c14rBihAFp1', name: 'Giovanni', accent: 'italian', gender: 'male', age: 'young', description: 'Italian-English male' },

  // ========== NEUTRAL / INTERNATIONAL ==========
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', accent: 'neutral', gender: 'female', age: 'young', description: 'soft neutral female' },
  { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Serena', accent: 'neutral', gender: 'female', age: 'middle', description: 'pleasant neutral female' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', accent: 'neutral', gender: 'male', age: 'middle', description: 'deep neutral male' },
];

// Map common name origins to likely accents
const NAME_ACCENT_MAP = {
  // Indian names
  indian: ['raj', 'priya', 'amit', 'neha', 'vikram', 'ananya', 'arjun', 'deepa', 'krishna', 'lakshmi', 'ravi', 'sunita', 'arun', 'kavita', 'sanjay', 'meera', 'aakash', 'riya', 'smriti', 'rahul', 'pooja', 'aditya', 'shreya'],

  // Arabic names (Dubai, UAE, Saudi, Egypt, etc.)
  arabic: ['ahmed', 'fatima', 'mohammed', 'aisha', 'omar', 'layla', 'hassan', 'sara', 'mahmoud', 'nour', 'khalid', 'yasmin', 'ali', 'hana', 'youssef', 'amira', 'fares', 'salma', 'asmaa', 'rashid', 'maryam', 'sultan', 'noura'],

  // British names
  british: ['william', 'elizabeth', 'james', 'victoria', 'george', 'charlotte', 'harry', 'emma', 'oliver', 'sophia', 'edward', 'alice', 'henry', 'margaret'],

  // German names
  german: ['hans', 'greta', 'klaus', 'ingrid', 'wolfgang', 'helga', 'fritz', 'ursula', 'dieter', 'brigitte', 'heinrich', 'anna', 'stefan', 'katrin'],

  // Spanish/Latin American names
  latam: ['carlos', 'maria', 'jose', 'ana', 'miguel', 'carmen', 'antonio', 'isabel', 'juan', 'pablo', 'lucia', 'diego', 'elena', 'valentina', 'santiago', 'camila', 'alejandro', 'gabriela', 'fernando', 'adriana', 'ricardo', 'natalia'],

  // Spanish (Spain)
  spanish: ['javier', 'sofia', 'alvaro', 'marta', 'ines', 'gonzalo', 'pilar', 'rafael', 'rocio'],

  // French names
  french: ['pierre', 'marie', 'jean', 'claire', 'louis', 'sophie', 'michel', 'camille', 'francois', 'aurelie', 'antoine', 'juliette', 'laurent', 'celine'],

  // Russian names
  russian: ['ivan', 'natasha', 'dmitry', 'olga', 'sergey', 'alexei', 'elena', 'nikolai', 'tatiana', 'vladimir', 'andrei', 'ekaterina', 'viktor', 'anastasia', 'mikhail', 'irina'],

  // Chinese names
  chinese: ['wei', 'ming', 'li', 'wang', 'chen', 'zhang', 'liu', 'yang', 'huang', 'zhao', 'xiao', 'jing', 'ying', 'mei', 'hong', 'jun', 'hui', 'lin', 'yu', 'fang'],

  // Italian names
  italian: ['marco', 'giulia', 'luca', 'francesca', 'matteo', 'chiara', 'lorenzo', 'valentina', 'andrea', 'alessia', 'giovanni', 'sofia'],
};

/**
 * Analyze job context and determine best voice characteristics using GPT
 */
async function analyzeJobContext(jobDescription, speakerName, language) {
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  const prompt = `Analyze this job posting and speaker information to determine the best voice characteristics for a video interview.

Job Description:
${jobDescription}

Speaker Name: ${speakerName || 'Not specified'}
Language: ${language || 'English'}

Based on the job location, company context, speaker name origin, and overall tone, determine:

1. **accent**: The most appropriate accent. Choose from: american, british, australian, indian, arabic, russian, chinese, latam, spanish, german, french, italian, neutral
   - Consider job location:
     * UK/London → british
     * US/California/New York → american
     * Dubai/UAE/Saudi/Middle East → arabic
     * India/Bangalore/Mumbai → indian
     * Russia/Moscow → russian
     * China/Beijing/Shanghai/Hong Kong → chinese
     * Mexico/Colombia/Argentina/Latin America → latam
     * Spain/Madrid/Barcelona → spanish
     * Germany/Berlin/Munich → german
     * France/Paris → french
     * Italy/Milan/Rome → italian
     * Australia/Sydney → australian
   - Consider speaker name origin (Indian name → indian, Arabic name → arabic, Chinese name → chinese, etc.)
   - If unclear, use "neutral" or "american"

2. **gender**: male or female
   - If speaker name clearly indicates gender, use that
   - Otherwise, infer from context or default to "neutral" (which we'll map to a balanced choice)

3. **age**: young (20-35), middle (35-50), or mature (50+)
   - Consider the seniority of the role
   - Senior/executive roles → mature
   - Entry-level → young
   - Default → middle

4. **reasoning**: Brief explanation of your choice (1-2 sentences)

Respond in JSON format:
{
  "accent": "...",
  "gender": "...",
  "age": "...",
  "reasoning": "..."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      accent: result.accent || 'neutral',
      gender: result.gender || 'neutral',
      age: result.age || 'middle',
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error analyzing job context:', error.message);
    // Fallback to simple name-based detection
    return detectFromName(speakerName);
  }
}

/**
 * Simple fallback: detect accent from speaker name
 */
function detectFromName(speakerName) {
  if (!speakerName) {
    return { accent: 'neutral', gender: 'neutral', age: 'middle', reasoning: 'No name provided, using neutral voice' };
  }

  const nameLower = speakerName.toLowerCase().trim();

  // Check against name maps
  for (const [accent, names] of Object.entries(NAME_ACCENT_MAP)) {
    if (names.some(n => nameLower.includes(n))) {
      return {
        accent,
        gender: 'neutral',
        age: 'middle',
        reasoning: `Name "${speakerName}" suggests ${accent} origin`
      };
    }
  }

  return { accent: 'neutral', gender: 'neutral', age: 'middle', reasoning: 'Could not determine accent from name' };
}

/**
 * Select best matching voice from library
 */
function selectVoiceFromLibrary(criteria) {
  const { accent, gender, age } = criteria;

  // Score each voice
  const scored = VOICE_LIBRARY.map(voice => {
    let score = 0;

    // Accent match is most important
    if (voice.accent === accent) {
      score += 100;
    } else if (voice.accent === 'neutral') {
      score += 30; // Neutral is always acceptable
    } else if (accent === 'neutral') {
      score += 50; // If we want neutral, any voice is somewhat ok
    }

    // Gender match
    if (gender === 'neutral') {
      score += 20; // Any gender is fine
    } else if (voice.gender === gender) {
      score += 50;
    }

    // Age match
    if (voice.age === age) {
      score += 20;
    } else if (age === 'middle') {
      score += 10; // Middle age is versatile
    }

    return { voice, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return best match
  return scored[0].voice;
}

/**
 * Main function: automatically select voice based on job context
 */
async function autoSelectVoice(jobDescription, speakerName, language) {
  console.log(`[VoiceSelector] Analyzing context for speaker: ${speakerName || 'unknown'}`);

  // Step 1: Analyze job context
  const criteria = await analyzeJobContext(jobDescription, speakerName, language);
  console.log(`[VoiceSelector] Analysis: accent=${criteria.accent}, gender=${criteria.gender}, age=${criteria.age}`);
  console.log(`[VoiceSelector] Reasoning: ${criteria.reasoning}`);

  // Step 2: Select best matching voice
  const voice = selectVoiceFromLibrary(criteria);
  console.log(`[VoiceSelector] Selected: ${voice.name} (${voice.id}) - ${voice.description}`);

  return {
    voiceId: voice.id,
    voiceName: voice.name,
    voiceDescription: voice.description,
    analysis: criteria
  };
}

module.exports = {
  autoSelectVoice,
  analyzeJobContext,
  selectVoiceFromLibrary,
  detectFromName,
  VOICE_LIBRARY
};
