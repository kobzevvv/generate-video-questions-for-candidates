const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { saveJob, loadJob, ensureDirectories } = require('../utils/fileUtils');
const { listAvailableTemplates, getTemplateMetadata } = require('../services/promptLoader');
const { getAvailableVoices } = require('../services/tts');

const router = express.Router();

// Create a new job
router.post('/', (req, res) => {
  try {
    ensureDirectories();

    const {
      video_url,
      video_path,
      script,
      job_description,
      prompt_template_id,
      voice,
      language,
      speaker_name,
      audio_url, // For lip-sync when audio is hosted externally
      // Hiring manager info (can be provided directly or loaded from file)
      gender,
      accent,
      age,
      hiring_manager_info, // Optional: { name, language, accent, gender, age }
      // Input directory for job-specific assets (video, hiring-manager-info.md)
      job_input_dir, // e.g. "Sales-Manager-B2B-EV-Charging-Stations"
      // Quality mode: "template" (basic), "lipsync" (premium), "audio_only"
      quality_mode,
      locale // for template selection, e.g. "en", "ru", "es"
    } = req.body;

    // Validation
    if (!script && !job_description) {
      return res.status(400).json({
        error: 'Either script or job_description is required'
      });
    }

    // Note: video_url is now optional - can generate audio-only

    // Validate template if provided
    if (prompt_template_id) {
      const available = listAvailableTemplates();
      if (!available.includes(prompt_template_id)) {
        return res.status(400).json({
          error: `Unknown template: ${prompt_template_id}`,
          available_templates: available
        });
      }
    }

    // Merge hiring manager info from direct params or nested object
    const hm = hiring_manager_info || {};
    const resolvedSpeakerName = speaker_name || hm.name || null;
    const resolvedGender = gender || hm.gender || null;
    const resolvedAccent = accent || hm.accent || null;
    const resolvedAge = age || hm.age || null;
    const resolvedLanguage = language || hm.language || config.defaultLanguage;

    // Create job
    const jobId = `job_${uuidv4().slice(0, 8)}`;
    const job = {
      job_id: jobId,
      status: 'pending',
      created_at: new Date().toISOString(),

      // Input parameters
      video_url: video_url || null,
      video_path: video_path || null,
      script: script || null,
      job_description: job_description || null,
      prompt_template_id: prompt_template_id || null,
      voice: voice || null, // null = auto-select based on gender/accent
      language: resolvedLanguage,
      speaker_name: resolvedSpeakerName,
      audio_url: audio_url || null,

      // Voice matching parameters
      gender: resolvedGender,
      accent: resolvedAccent,
      age: resolvedAge,

      // Input directory for job-specific assets
      job_input_dir: job_input_dir || null,

      // Quality mode: "template" (basic), "lipsync" (premium), "audio_only"
      quality_mode: quality_mode || 'template',
      locale: locale || null
    };

    saveJob(jobId, job);

    res.status(201).json({
      job_id: jobId,
      status: job.status,
      quality_mode: job.quality_mode,
      created_at: job.created_at,
      message: 'Job created and queued for processing'
    });

  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get job status
router.get('/:id', (req, res) => {
  try {
    const job = loadJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Build response based on job state
    const response = {
      job_id: job.job_id,
      status: job.status,
      quality_mode: job.quality_mode || 'template',
      created_at: job.created_at
    };

    if (job.started_at) response.started_at = job.started_at;
    if (job.completed_at) response.completed_at = job.completed_at;
    if (job.failed_at) response.failed_at = job.failed_at;

    if (job.generated_questions) response.generated_questions = job.generated_questions;
    if (job.selected_voice) response.selected_voice = job.selected_voice;

    // Output files
    if (job.outputs) response.outputs = job.outputs;
    if (job.video_files) {
      response.video_files = job.video_files.map(f => ({
        index: f.index,
        template_id: f.template_id,
        video_url: f.video_url,
        audio_url: f.audio_url,
        text: f.text,
        error: f.error || undefined
      }));
    }
    if (job.audio_files) {
      response.audio_files = job.audio_files.map(f => ({
        index: f.index,
        template_id: f.template_id,
        url: f.audio_url,
        text: f.text
      }));
    }

    if (job.error) response.error = job.error;
    if (job.note) response.note = job.note;

    res.json(response);

  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// List available templates
router.get('/meta/templates', (req, res) => {
  try {
    const templates = listAvailableTemplates();
    const detailed = templates.map(id => getTemplateMetadata(id));

    res.json({
      templates: detailed,
      default_templates: config.defaultTemplates
    });

  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// List available voices
router.get('/meta/voices', (req, res) => {
  res.json({
    voices: getAvailableVoices(),
    default_voice: config.defaultVoice
  });
});

module.exports = router;
