const fs = require('fs');
const path = require('path');
const config = require('../config');

function loadPromptTemplate(templateId) {
  const filePath = path.join(config.promptsDir, `${templateId}.prompt`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

function renderPrompt(templateId, variables) {
  let template = loadPromptTemplate(templateId);

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{${key}}`, value || '');
  }

  return template;
}

function listAvailableTemplates() {
  if (!fs.existsSync(config.promptsDir)) {
    return [];
  }

  return fs.readdirSync(config.promptsDir)
    .filter(f => f.endsWith('.prompt'))
    .map(f => f.replace('.prompt', ''));
}

function getTemplateMetadata(templateId) {
  const template = loadPromptTemplate(templateId);

  // Extract placeholders from template
  const placeholders = [...template.matchAll(/\{(\w+)\}/g)]
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  return {
    id: templateId,
    placeholders,
    requiresJobDescription: placeholders.includes('job_description'),
    requiresSpeakerName: placeholders.includes('speaker_name')
  };
}

module.exports = {
  loadPromptTemplate,
  renderPrompt,
  listAvailableTemplates,
  getTemplateMetadata
};
