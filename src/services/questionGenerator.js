const OpenAI = require('openai');
const config = require('../config');
const { renderPrompt, listAvailableTemplates } = require('./promptLoader');

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

async function generateFromTemplate(templateId, variables) {
  const openai = getOpenAIClient();
  const prompt = renderPrompt(templateId, variables);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  return response.choices[0].message.content.trim();
}

async function generateQuestions(options) {
  const {
    jobDescription,
    language = config.defaultLanguage,
    speakerName = 'our team',
    templateIds = null
  } = options;

  const templatesToUse = templateIds || config.defaultTemplates;
  const availableTemplates = listAvailableTemplates();

  const results = [];

  for (const templateId of templatesToUse) {
    if (!availableTemplates.includes(templateId)) {
      console.warn(`Template not found, skipping: ${templateId}`);
      continue;
    }

    try {
      const variables = {
        language,
        job_description: jobDescription,
        speaker_name: speakerName
      };

      const generatedText = await generateFromTemplate(templateId, variables);

      results.push({
        template_id: templateId,
        text: generatedText
      });
    } catch (error) {
      console.error(`Error generating from template ${templateId}:`, error.message);
      results.push({
        template_id: templateId,
        error: error.message
      });
    }
  }

  return results;
}

function combineQuestionsToScript(questions) {
  return questions
    .filter(q => q.text && !q.error)
    .map(q => q.text)
    .join('\n\n');
}

module.exports = {
  generateFromTemplate,
  generateQuestions,
  combineQuestionsToScript
};
