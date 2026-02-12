#!/usr/bin/env node
/**
 * Export job results to static HTML for GitHub Pages
 * Usage: node scripts/export-to-pages.js [job_id]
 *        node scripts/export-to-pages.js --all
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const JOBS_DIR = path.join(ROOT_DIR, 'data/jobs');
const PAGES_DIR = path.join(ROOT_DIR, 'docs');
const INPUT_EXAMPLES_DIR = path.join(ROOT_DIR, 'input-examples');
const PROMPTS_DIR = path.join(ROOT_DIR, 'promts');

// Ensure docs directory exists
if (!fs.existsSync(PAGES_DIR)) {
  fs.mkdirSync(PAGES_DIR, { recursive: true });
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

function loadJob(jobId) {
  const jobPath = path.join(JOBS_DIR, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) return null;
  return JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
}

function loadAllJobs() {
  if (!fs.existsSync(JOBS_DIR)) return [];
  return fs.readdirSync(JOBS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const job = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), 'utf-8'));
      return job;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function loadPromptTemplates() {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs.readdirSync(PROMPTS_DIR)
    .filter(f => f.endsWith('.prompt'))
    .map(f => ({
      id: f.replace('.prompt', ''),
      content: fs.readFileSync(path.join(PROMPTS_DIR, f), 'utf-8')
    }));
}

function generateJobHTML(job) {
  // Load additional data
  let jobDescription = job.job_description || '';
  let hiringManagerInfo = null;

  if (job.job_input_dir) {
    const jobDir = path.join(INPUT_EXAMPLES_DIR, job.job_input_dir);
    const jdPath = path.join(jobDir, 'job-description.md');
    const hmPath = path.join(jobDir, 'hiring-manager-info.md');

    if (fs.existsSync(jdPath)) jobDescription = fs.readFileSync(jdPath, 'utf-8');
    if (fs.existsSync(hmPath)) hiringManagerInfo = fs.readFileSync(hmPath, 'utf-8');
  }

  const promptsUsed = loadPromptTemplates();
  const questions = job.generated_questions || [];
  const createdAt = new Date(job.created_at).toLocaleString('ru-RU');

  // Generate questions HTML
  let questionsHTML = '';
  if (questions.length > 0) {
    questionsHTML = questions.map((q, i) => `
      <div class="question">
        <div class="question-header">
          <span class="question-number">${i + 1}</span>
          <span class="template-id">${escapeHtml(q.template_id || 'custom')}</span>
        </div>
        <div class="question-text">${escapeHtml(q.text)}</div>
      </div>
    `).join('\n');
  } else {
    questionsHTML = '<p class="no-questions">No questions generated</p>';
  }

  // Generate prompts HTML
  const promptsHTML = promptsUsed.map(p => `
    <details class="source-block">
      <summary>${escapeHtml(p.id)}.prompt</summary>
      <pre>${escapeHtml(p.content)}</pre>
    </details>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questions: ${escapeHtml(job.job_id)}</title>
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
    .back-link {
      display: inline-block;
      margin-bottom: 10px;
      color: #007bff;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .back-link:hover { text-decoration: underline; }
    header {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
    .input-params {
      background: #f0f7ff;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .input-params h3 { margin: 0 0 10px 0; font-size: 1rem; }
    .params-table { width: 100%; font-size: 0.9rem; }
    .params-table td { padding: 4px 10px 4px 0; border: none; }
    .params-table td:first-child { color: #666; width: 140px; }
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
    .hiring-manager h3 { margin: 0 0 10px 0; font-size: 1rem; }
    .hiring-manager pre { margin: 0; white-space: pre-wrap; font-size: 0.9rem; }
    .sources { background: #fafafa; }
    .sources h2 { color: #666; }
    .source-block { margin-bottom: 10px; }
    .source-block summary {
      cursor: pointer;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .source-block summary:hover { background: #e8e8e8; }
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
    <a href="index.html" class="back-link">← All Jobs</a>
    <h1>Generated Interview Questions</h1>
    <div class="meta">
      <span>Job ID: <strong>${escapeHtml(job.job_id)}</strong></span>
      <span>Status: <span class="status ${job.status}">${escapeHtml(job.status)}</span></span>
      <span>Created: ${createdAt}</span>
      ${job.language ? `<span>Language: ${escapeHtml(job.language)}</span>` : ''}
      ${job.selected_voice ? `<span>Voice: ${escapeHtml(job.selected_voice)}</span>` : ''}
    </div>
  </header>

  <section class="questions">
    <h2>Questions (${questions.length})</h2>
    ${questionsHTML}
  </section>

  <section class="sources">
    <h2>Source Inputs</h2>

    <div class="input-params">
      <h3>Job Parameters</h3>
      <table class="params-table">
        <tr><td>Speaker Name:</td><td><strong>${escapeHtml(job.speaker_name || '-')}</strong></td></tr>
        <tr><td>Language:</td><td>${escapeHtml(job.language || '-')}</td></tr>
        <tr><td>Gender:</td><td>${escapeHtml(job.gender || '-')}</td></tr>
        <tr><td>Accent:</td><td>${escapeHtml(job.accent || '-')}</td></tr>
        <tr><td>Selected Voice:</td><td><strong>${escapeHtml(job.selected_voice || '-')}</strong></td></tr>
        <tr><td>Input Directory:</td><td><code>${escapeHtml(job.job_input_dir || '-')}</code></td></tr>
      </table>
    </div>

    ${hiringManagerInfo ? `
    <div class="hiring-manager">
      <h3>Hiring Manager Info</h3>
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
</html>`;
}

function generateIndexHTML(jobs) {
  const jobsHTML = jobs.length > 0
    ? jobs.map(job => `
        <tr>
          <td><a href="${job.job_id}.html">${escapeHtml(job.job_id)}</a></td>
          <td><span class="status ${job.status}">${escapeHtml(job.status)}</span></td>
          <td>${escapeHtml(job.job_input_dir || '-')}</td>
          <td>${job.generated_questions?.length || 0}</td>
          <td>${escapeHtml(job.language || '-')}</td>
          <td>${new Date(job.created_at).toLocaleString('ru-RU')}</td>
        </tr>
      `).join('\n')
    : '<tr><td colspan="6" style="text-align:center;color:#666;">No jobs yet</td></tr>';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Questions Generator - Results</title>
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
    footer {
      text-align: center;
      color: #999;
      font-size: 0.8rem;
      padding: 20px;
    }
  </style>
</head>
<body>
  <h1>Interview Questions Generator</h1>

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

  <footer>
    Generated by Video Questions Generator
  </footer>
</body>
</html>`;
}

function exportJob(jobId) {
  const job = loadJob(jobId);
  if (!job) {
    console.error(`Job not found: ${jobId}`);
    return false;
  }

  const html = generateJobHTML(job);
  const outputPath = path.join(PAGES_DIR, `${jobId}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`Exported: ${outputPath}`);
  return true;
}

function exportAll() {
  const jobs = loadAllJobs();

  // Export each job
  let exported = 0;
  for (const job of jobs) {
    if (job.status === 'completed' && job.generated_questions?.length > 0) {
      const html = generateJobHTML(job);
      const outputPath = path.join(PAGES_DIR, `${job.job_id}.html`);
      fs.writeFileSync(outputPath, html);
      exported++;
    }
  }

  // Generate index
  const completedJobs = jobs.filter(j => j.status === 'completed' && j.generated_questions?.length > 0);
  const indexHTML = generateIndexHTML(completedJobs);
  fs.writeFileSync(path.join(PAGES_DIR, 'index.html'), indexHTML);

  console.log(`Exported ${exported} jobs to ${PAGES_DIR}/`);
  console.log(`Index page: ${PAGES_DIR}/index.html`);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--all') {
  exportAll();
} else {
  exportJob(args[0]);
  // Also regenerate index
  const jobs = loadAllJobs().filter(j => j.status === 'completed' && j.generated_questions?.length > 0);
  fs.writeFileSync(path.join(PAGES_DIR, 'index.html'), generateIndexHTML(jobs));
}

console.log('\nTo enable GitHub Pages:');
console.log('1. Go to repository Settings → Pages');
console.log('2. Set Source: "Deploy from a branch"');
console.log('3. Set Branch: "main" and folder: "/docs"');
console.log('4. Save and wait for deployment');
