const OpenAI = require('openai');
const config = require('../config');

/**
 * Curated list of high-quality ElevenLabs voices with accents
 * These are pre-selected for professional interview context
 */
const VOICE_LIBRARY = [
  // British English
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', accent: 'british', gender: 'male', age: 'middle', description: 'warm, professional British male' },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', accent: 'british', gender: 'female', age: 'middle', description: 'confident British female' },

  // American English
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'american', gender: 'female', age: 'young', description: 'friendly American female' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', accent: 'american', gender: 'male', age: 'young', description: 'professional American male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', accent: 'american', gender: 'male', age: 'mature', description: 'authoritative American male' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'american', gender: 'male', age: 'middle', description: 'clear American male' },

  // Indian English
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', accent: 'indian', gender: 'male', age: 'young', description: 'friendly Indian-English male' },

  // Australian English
  { id: 'ZQe5CZNOzWyzPSCn5a3c', name: 'James', accent: 'australian', gender: 'male', age: 'middle', description: 'friendly Australian male' },

  // Arabic-accented English
  { id: 'Os2frcqCuUz8b9F93RuI', name: 'Mahmoud', accent: 'arabic', gender: 'male', age: 'middle', description: 'professional Arabic-English male' },

  // German-accented English
  { id: 'ODq5zmih8GrVes37Dizd', name: 'Patrick', accent: 'german', gender: 'male', age: 'middle', description: 'clear German-English male' },

  // Spanish-accented English
  { id: 'wViXBPUzp2ZZixB1xQuM', name: 'Sofia', accent: 'spanish', gender: 'female', age: 'young', description: 'warm Spanish-English female' },

  // French-accented English
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', accent: 'french', gender: 'female', age: 'young', description: 'elegant French-English female' },

  // Neutral/International
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', accent: 'neutral', gender: 'female', age: 'young', description: 'clear neutral female' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', accent: 'neutral', gender: 'male', age: 'middle', description: 'professional neutral male' },
];

// Map common name origins to likely accents
const NAME_ACCENT_MAP = {
  // Indian names
  indian: ['raj', 'priya', 'amit', 'neha', 'vikram', 'ananya', 'arjun', 'deepa', 'krishna', 'lakshmi', 'ravi', 'sunita', 'arun', 'kavita', 'sanjay', 'meera'],

  // Arabic names
  arabic: ['ahmed', 'fatima', 'mohammed', 'aisha', 'omar', 'layla', 'hassan', 'sara', 'mahmoud', 'nour', 'khalid', 'yasmin', 'ali', 'hana', 'youssef', 'amira'],

  // British names
  british: ['william', 'elizabeth', 'james', 'victoria', 'george', 'charlotte', 'harry', 'emma', 'oliver', 'sophia', 'edward', 'alice'],

  // German names
  german: ['hans', 'greta', 'klaus', 'ingrid', 'wolfgang', 'helga', 'fritz', 'ursula', 'dieter', 'brigitte', 'heinrich', 'anna'],

  // Spanish names
  spanish: ['carlos', 'maria', 'jose', 'ana', 'miguel', 'carmen', 'antonio', 'isabel', 'juan', 'sofia', 'pablo', 'lucia', 'diego', 'elena'],

  // French names
  french: ['pierre', 'marie', 'jean', 'claire', 'louis', 'sophie', 'michel', 'camille', 'francois', 'aurelie', 'antoine', 'juliette'],

  // Russian names
  russian: ['ivan', 'natasha', 'dmitry', 'olga', 'sergey', 'anna', 'alexei', 'elena', 'nikolai', 'tatiana', 'vladimir', 'maria', 'andrei', 'ekaterina'],
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

1. **accent**: The most appropriate English accent. Choose from: american, british, australian, indian, arabic, german, spanish, french, neutral
   - Consider job location (UK jobs → british, US jobs → american, etc.)
   - Consider speaker name origin (Indian name → indian accent, Arabic name → arabic accent, etc.)
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
