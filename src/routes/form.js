const express = require('express');
const router = express.Router();

// Serve the form
router.get('/', (req, res) => {
  res.send(generateFormHTML());
});

// Handle form submission
router.post('/submit', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { job_description, speaker_name, language } = req.body;

    if (!job_description) {
      return res.status(400).send('Job description is required');
    }

    // Create job via internal API
    const { v4: uuidv4 } = require('uuid');
    const config = require('../config');
    const { saveJob, ensureDirectories } = require('../utils/fileUtils');

    ensureDirectories();

    const jobId = `job_${uuidv4().slice(0, 8)}`;
    const job = {
      job_id: jobId,
      status: 'pending',
      created_at: new Date().toISOString(),
      job_description: job_description.trim(),
      speaker_name: speaker_name?.trim() || null,
      language: language || 'English',
      quality_mode: 'audio_only',
      // Auto-detect gender from common names (simple heuristic)
      gender: detectGender(speaker_name),
      video_url: null,
      video_path: null,
      script: null,
      prompt_template_id: null,
      voice: null,
      audio_url: null,
      accent: null,
      age: null,
      job_input_dir: null,
      locale: language === 'Russian' ? 'ru' : 'en'
    };

    saveJob(jobId, job);

    // Redirect to waiting page
    res.redirect(`/form/status/${jobId}`);

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).send('Error creating job: ' + error.message);
  }
});

// Status page with auto-refresh
router.get('/status/:id', (req, res) => {
  const { loadJob } = require('../utils/fileUtils');
  const job = loadJob(req.params.id);

  if (!job) {
    return res.status(404).send('Job not found');
  }

  if (job.status === 'completed') {
    return res.redirect(`/results/${job.job_id}`);
  }

  if (job.status === 'failed') {
    return res.send(generateErrorHTML(job));
  }

  // Still processing - show waiting page
  res.send(generateWaitingHTML(job));
});

function detectGender(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();

  const femaleNames = ['anna', 'maria', 'elena', 'olga', 'natasha', 'kate', 'sarah', 'emma', 'lisa', 'julia', 'sofia', 'victoria', 'alexandra', 'marina', 'irina', 'svetlana', 'tatiana', 'ekaterina', 'anastasia', 'daria'];
  const maleNames = ['john', 'mike', 'david', 'alex', 'nikita', 'dmitry', 'sergey', 'ivan', 'andrey', 'pavel', 'maxim', 'vladimir', 'oleg', 'igor', 'roman', 'artem', 'denis', 'konstantin', 'emre', 'ahmed'];

  if (femaleNames.some(f => n.includes(f))) return 'female';
  if (maleNames.some(m => n.includes(m))) return 'male';
  return null;
}

function generateFormHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generate Interview Questions</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 700px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    h1 {
      margin-bottom: 10px;
      color: #1a1a1a;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    form {
      background: #fff;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
    }
    .hint {
      font-size: 0.85rem;
      color: #888;
      font-weight: normal;
      margin-left: 5px;
    }
    textarea, input, select {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      margin-bottom: 20px;
      transition: border-color 0.2s;
    }
    textarea:focus, input:focus, select:focus {
      outline: none;
      border-color: #007bff;
    }
    textarea {
      min-height: 200px;
      resize: vertical;
    }
    .row {
      display: flex;
      gap: 20px;
    }
    .row > div {
      flex: 1;
    }
    button {
      width: 100%;
      padding: 15px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #0056b3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #999;
      font-size: 0.85rem;
    }
    .footer a {
      color: #007bff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>Generate Interview Questions</h1>
  <p class="subtitle">Create personalized video interview questions based on a job description</p>

  <form action="/form/submit" method="POST" id="questionForm">
    <label for="job_description">
      Job Description
      <span class="hint">(paste the full job posting)</span>
    </label>
    <textarea
      id="job_description"
      name="job_description"
      placeholder="Paste the job description here..."
      required
    ></textarea>

    <div class="row">
      <div>
        <label for="speaker_name">
          Interviewer Name
          <span class="hint">(optional)</span>
        </label>
        <input
          type="text"
          id="speaker_name"
          name="speaker_name"
          placeholder="e.g., Sarah, Dmitry"
        >
      </div>
      <div>
        <label for="language">Language</label>
        <select id="language" name="language">
          <option value="English">English</option>
          <option value="Russian">Russian</option>
          <option value="Spanish">Spanish</option>
          <option value="German">German</option>
          <option value="French">French</option>
        </select>
      </div>
    </div>

    <button type="submit" id="submitBtn">Generate Questions</button>
  </form>

  <div class="footer">
    <a href="/results/">View all generated results</a>
  </div>

  <script>
    document.getElementById('questionForm').addEventListener('submit', function() {
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = 'Creating job...';
    });
  </script>
</body>
</html>`;
}

function generateWaitingHTML(job) {
  const createdAt = new Date(job.created_at).toLocaleString();
  const questionsCount = job.generated_questions?.length || 0;
  const audioCount = job.audio_files?.length || 0;

  let statusText = 'Starting...';
  if (questionsCount > 0 && audioCount === 0) {
    statusText = `Generated ${questionsCount} questions, creating audio...`;
  } else if (audioCount > 0) {
    statusText = `Generated ${audioCount}/${questionsCount} audio files...`;
  } else if (job.status === 'processing') {
    statusText = 'Generating questions...';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3">
  <title>Processing... - ${job.job_id}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 60px 20px;
      background: #f5f5f5;
      color: #333;
      text-align: center;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #e0e0e0;
      border-top-color: #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      margin-bottom: 10px;
      font-size: 1.5rem;
    }
    .status {
      color: #666;
      margin-bottom: 20px;
    }
    .job-id {
      font-family: monospace;
      background: #e9ecef;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .note {
      margin-top: 40px;
      color: #999;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h1>Processing Your Request</h1>
  <p class="status">${statusText}</p>
  <p class="job-id">${job.job_id}</p>
  <p class="note">This page auto-refreshes every 3 seconds.<br>You'll be redirected when complete.</p>
</body>
</html>`;
}

function generateErrorHTML(job) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - ${job.job_id}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 60px 20px;
      background: #f5f5f5;
      color: #333;
      text-align: center;
    }
    .error-icon {
      font-size: 50px;
      margin-bottom: 20px;
    }
    h1 {
      margin-bottom: 10px;
      color: #dc3545;
    }
    .message {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    a {
      color: #007bff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="error-icon">⚠️</div>
  <h1>Something went wrong</h1>
  <div class="message">${job.error || 'Unknown error'}</div>
  <p><a href="/form/">← Try again</a></p>
</body>
</html>`;
}

module.exports = router;
