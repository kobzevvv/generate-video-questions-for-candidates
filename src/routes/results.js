const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { loadJob } = require('../utils/fileUtils');
const { loadPromptTemplate } = require('../services/promptLoader');

const router = express.Router();

/**
 * List all jobs with links to results
 */
router.get('/', (req, res) => {
  try {
    const jobsDir = config.jobsDir;

    if (!fs.existsSync(jobsDir)) {
      return res.send(generateListHTML([]));
    }

    const jobFiles = fs.readdirSync(jobsDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // newest first

    const jobs = jobFiles.map(f => {
      const jobPath = path.join(jobsDir, f);
      const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
      return {
        job_id: job.job_id,
        status: job.status,
        created_at: job.created_at,
        job_input_dir: job.job_input_dir,
        language: job.language,
        questions_count: job.generated_questions?.length || 0
      };
    });

    res.send(generateListHTML(jobs));

  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
  }
});

function generateListHTML(jobs) {
  const jobsHTML = jobs.length > 0
    ? jobs.map(job => `
        <tr>
          <td><a href="/results/${job.job_id}">${job.job_id}</a></td>
          <td><span class="status ${job.status}">${job.status}</span></td>
          <td>${job.job_input_dir || '-'}</td>
          <td>${job.questions_count}</td>
          <td>${job.language || '-'}</td>
          <td>${new Date(job.created_at).toLocaleString('ru-RU')}</td>
        </tr>
      `).join('\n')
    : '<tr><td colspan="6" style="text-align:center;color:#666;">No jobs yet</td></tr>';

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Jobs - Video Questions Generator</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 { margin-bottom: 20px; }
    table {
      width: 100%;
      background: #fff;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    a { color: #007bff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .status {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .status.completed { background: #d4edda; color: #155724; }
    .status.processing { background: #fff3cd; color: #856404; }
    .status.pending { background: #e2e3e5; color: #383d41; }
    .status.failed { background: #f8d7da; color: #721c24; }
    .actions { margin-bottom: 20px; }
    .btn {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .btn:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>📋 All Jobs</h1>

  <table>
    <thead>
      <tr>
        <th>Job ID</th>
        <th>Status</th>
        <th>Input Dir</th>
        <th>Questions</th>
        <th>Language</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${jobsHTML}
    </tbody>
  </table>
</body>
</html>
  `;
}

/**
 * Render job results as HTML page
 * Shows generated questions and all source inputs
 */
router.get('/:id', (req, res) => {
  try {
    const job = loadJob(req.params.id);

    if (!job) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Not Found</title></head>
        <body><h1>Job not found: ${req.params.id}</h1></body>
        </html>
      `);
    }

    // Load job description from file if job_input_dir is set
    let jobDescription = job.job_description || '';
    let hiringManagerInfo = null;

    if (job.job_input_dir) {
      const jobDir = path.join(config.inputExamplesDir, job.job_input_dir);

      // Load job description
      const jdPath = path.join(jobDir, 'job-description.md');
      if (fs.existsSync(jdPath)) {
        jobDescription = fs.readFileSync(jdPath, 'utf-8');
      }

      // Load hiring manager info
      const hmPath = path.join(jobDir, 'hiring-manager-info.md');
      if (fs.existsSync(hmPath)) {
        hiringManagerInfo = fs.readFileSync(hmPath, 'utf-8');
      }
    }

    // Load prompt templates used
    const promptsUsed = [];
    const templateIds = config.defaultTemplates;

    for (const templateId of templateIds) {
      try {
        const template = loadPromptTemplate(templateId);
        promptsUsed.push({
          id: templateId,
          content: template
        });
      } catch (e) {
        // Skip if template not found
      }
    }

    // Generate HTML
    const html = generateResultsHTML(job, {
      jobDescription,
      hiringManagerInfo,
      promptsUsed
    });

    res.send(html);

  } catch (error) {
    console.error('Error rendering results:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body><h1>Error loading results</h1><pre>${error.message}</pre></body>
      </html>
    `);
  }
});

function generateResultsHTML(job, sources) {
  const { jobDescription, hiringManagerInfo, promptsUsed } = sources;

  const questions = job.generated_questions || [];
  const audioFiles = job.audio_files || [];
  const status = job.status;
  const createdAt = new Date(job.created_at).toLocaleString('ru-RU');

  // Map audio files by index for quick lookup
  const audioByIndex = {};
  audioFiles.forEach(a => { audioByIndex[a.index] = a; });

  // Generate questions HTML with audio players
  let questionsHTML = '';
  if (questions.length > 0) {
    questionsHTML = questions.map((q, i) => {
      const audio = audioByIndex[i + 1];
      const audioHTML = audio ? `
        <div class="audio-player">
          <audio controls>
            <source src="${audio.audio_url}" type="audio/mpeg">
          </audio>
        </div>
      ` : '';

      return `
        <div class="question">
          <div class="question-header">
            <span class="question-number">${i + 1}</span>
            <span class="template-id">${q.template_id || 'custom'}</span>
          </div>
          <div class="question-text">${escapeHtml(q.text)}</div>
          ${audioHTML}
        </div>
      `;
    }).join('\n');
  } else if (job.script) {
    const audio = audioByIndex[1];
    const audioHTML = audio ? `
      <div class="audio-player">
        <audio controls>
          <source src="${audio.audio_url}" type="audio/mpeg">
        </audio>
      </div>
    ` : '';
    questionsHTML = `
      <div class="question">
        <div class="question-header">
          <span class="question-number">1</span>
          <span class="template-id">custom script</span>
        </div>
        <div class="question-text">${escapeHtml(job.script)}</div>
        ${audioHTML}
      </div>
    `;
  } else {
    questionsHTML = '<p class="no-questions">Questions not yet generated</p>';
  }

  // Generate prompts HTML
  const promptsHTML = promptsUsed.map(p => `
    <details class="source-block">
      <summary>${p.id}.prompt</summary>
      <pre>${escapeHtml(p.content)}</pre>
    </details>
  `).join('\n');

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questions: ${job.job_id}</title>
  <style>
    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }

    header {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .back-link {
      display: inline-block;
      margin-bottom: 10px;
      color: #007bff;
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    h1 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
      color: #1a1a1a;
    }

    .meta {
      font-size: 0.9rem;
      color: #666;
    }

    .meta span { margin-right: 20px; }

    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .status.completed { background: #d4edda; color: #155724; }
    .status.processing { background: #fff3cd; color: #856404; }
    .status.pending { background: #e2e3e5; color: #383d41; }
    .status.failed { background: #f8d7da; color: #721c24; }

    section {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    h2 {
      margin: 0 0 15px 0;
      font-size: 1.2rem;
      color: #1a1a1a;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }

    .question {
      background: #f8f9fa;
      border-left: 4px solid #007bff;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 0 8px 8px 0;
    }

    .question-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .question-number {
      background: #007bff;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.9rem;
    }

    .template-id {
      background: #e9ecef;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      color: #666;
      font-family: monospace;
    }

    .question-text {
      font-size: 1.1rem;
      white-space: pre-wrap;
    }

    .audio-player {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .audio-player audio {
      width: 100%;
      height: 40px;
    }

    .no-questions {
      color: #666;
      font-style: italic;
    }

    .sources {
      background: #fafafa;
    }

    .sources h2 {
      color: #666;
    }

    .source-block {
      margin-bottom: 10px;
    }

    .source-block summary {
      cursor: pointer;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
    }

    .source-block summary:hover {
      background: #e8e8e8;
    }

    .source-block pre {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.85rem;
      margin: 10px 0 0 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .source-block.open pre {
      display: block;
    }

    .input-params {
      background: #f0f7ff;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .input-params h3 {
      margin: 0 0 10px 0;
      font-size: 1rem;
    }

    .params-table {
      width: 100%;
      font-size: 0.9rem;
    }

    .params-table td {
      padding: 4px 10px 4px 0;
      border: none;
    }

    .params-table td:first-child {
      color: #666;
      width: 140px;
    }

    .params-table code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.85rem;
    }

    .hiring-manager {
      background: #e8f4fd;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
    }

    .hiring-manager h3 {
      margin: 0 0 10px 0;
      font-size: 1rem;
    }

    .hiring-manager pre {
      margin: 0;
      white-space: pre-wrap;
      font-size: 0.9rem;
    }

    footer {
      text-align: center;
      color: #999;
      font-size: 0.8rem;
      padding: 20px;
    }
  </style>
</head>
<body>
  <header>
    <a href="/results/" class="back-link">← All Jobs</a>
    <h1>Generated Interview Questions</h1>
    <div class="meta">
      <span>Job ID: <strong>${job.job_id}</strong></span>
      <span>Status: <span class="status ${status}">${status}</span></span>
      <span>Created: ${createdAt}</span>
      ${job.language ? `<span>Language: ${job.language}</span>` : ''}
      ${job.selected_voice ? `<span>Voice: ${job.selected_voice}</span>` : ''}
    </div>
  </header>

  <section class="questions">
    <h2>📋 Questions (${questions.length || (job.script ? 1 : 0)})</h2>
    ${questionsHTML}
  </section>

  <section class="sources">
    <h2>📂 Source Inputs</h2>

    <div class="input-params">
      <h3>⚙️ Job Parameters</h3>
      <table class="params-table">
        <tr><td>Speaker Name:</td><td><strong>${escapeHtml(job.speaker_name || '-')}</strong></td></tr>
        <tr><td>Language:</td><td>${escapeHtml(job.language || '-')}</td></tr>
        <tr><td>Gender:</td><td>${escapeHtml(job.gender || '-')}</td></tr>
        <tr><td>Accent:</td><td>${escapeHtml(job.accent || '-')}</td></tr>
        <tr><td>Selected Voice:</td><td><strong>${escapeHtml(job.selected_voice || '-')}</strong></td></tr>
        <tr><td>Input Directory:</td><td><code>${escapeHtml(job.job_input_dir || '-')}</code></td></tr>
        <tr><td>Quality Mode:</td><td>${escapeHtml(job.quality_mode || 'template')}</td></tr>
      </table>
    </div>

    ${hiringManagerInfo ? `
    <div class="hiring-manager">
      <h3>👤 Hiring Manager Info (from file)</h3>
      <pre>${escapeHtml(hiringManagerInfo)}</pre>
    </div>
    ` : ''}

    <details class="source-block" open>
      <summary>job-description.md</summary>
      <pre>${escapeHtml(jobDescription || 'No job description provided')}</pre>
    </details>

    <h3 style="margin: 20px 0 10px; font-size: 1rem; color: #666;">Prompt Templates Used:</h3>
    ${promptsHTML}
  </section>

  <footer>
    Generated by Video Questions Generator
  </footer>
</body>
</html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = router;
