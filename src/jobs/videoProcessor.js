const path = require('path');
const fs = require('fs');
const config = require('../config');
const { saveJob, downloadFile } = require('../utils/fileUtils');
const { generateQuestions } = require('../services/questionGenerator');
const { generateSpeech } = require('../services/tts');
const { createLipSyncJob, waitForLipSyncCompletion, downloadOutput } = require('../services/lipSync');
const { overlayAudio, findTemplateVideo, hasAllTemplates } = require('../services/videoOverlay');
const { autoSelectVoice } = require('../services/voiceSelector');

/**
 * Quality modes:
 * - "template" (basic): Use pre-generated template videos + overlay audio (cheap, fast)
 * - "lipsync" (premium): Full lip-sync generation for each video (expensive, high quality)
 * - "audio_only": Just generate audio, no video
 */

/**
 * Find source video for a job (used in lipsync mode)
 */
function findSourceVideo(job) {
  if (job.video_path && fs.existsSync(job.video_path)) {
    return { path: job.video_path, type: 'local' };
  }

  if (job.video_url) {
    return { url: job.video_url, type: 'url' };
  }

  if (job.job_input_dir) {
    const jobVideoDir = path.join(config.inputExamplesDir, job.job_input_dir);
    if (fs.existsSync(jobVideoDir)) {
      const videoFiles = fs.readdirSync(jobVideoDir)
        .filter(f => /\.(mp4|mov|webm)$/i.test(f));
      if (videoFiles.length > 0) {
        return {
          path: path.join(jobVideoDir, videoFiles[0]),
          type: 'local',
          relativePath: `${job.job_input_dir}/${videoFiles[0]}`
        };
      }
    }
  }

  const defaultVideoDir = path.join(config.inputExamplesDir, 'default-input');
  if (fs.existsSync(defaultVideoDir)) {
    const videoFiles = fs.readdirSync(defaultVideoDir)
      .filter(f => /\.(mp4|mov|webm)$/i.test(f));
    if (videoFiles.length > 0) {
      return {
        path: path.join(defaultVideoDir, videoFiles[0]),
        type: 'local',
        relativePath: `default-input/${videoFiles[0]}`
      };
    }
  }

  return null;
}

function getPublicUrl(relativePath, type = 'outputs') {
  if (!config.publicBaseUrl) {
    return null;
  }
  return `${config.publicBaseUrl}/${type}/${relativePath}`;
}

/**
 * Process videos using template overlay (basic/cheap mode)
 */
async function processWithTemplates(jobId, audioFiles, locale, outputDir) {
  const videoFiles = [];

  for (const audioFile of audioFiles) {
    const templatePath = findTemplateVideo(audioFile.template_id, locale);

    if (!templatePath) {
      console.log(`[${jobId}]   No template for: ${audioFile.template_id}, skipping video`);
      videoFiles.push({
        index: audioFile.index,
        template_id: audioFile.template_id,
        text: audioFile.text,
        audio_url: audioFile.audio_url,
        video_file: null,
        error: `No template video found for ${audioFile.template_id}`
      });
      continue;
    }

    const videoFileName = `${jobId}_${String(audioFile.index).padStart(2, '0')}_${audioFile.template_id}.mp4`;
    const videoPath = path.join(outputDir, videoFileName);

    console.log(`[${jobId}]   Overlay ${audioFile.index}: ${audioFile.template_id}`);

    try {
      await overlayAudio({
        templateVideoPath: templatePath,
        audioPath: audioFile.audio_path,
        outputPath: videoPath
      });

      videoFiles.push({
        index: audioFile.index,
        template_id: audioFile.template_id,
        text: audioFile.text,
        audio_url: audioFile.audio_url,
        video_file: videoFileName,
        video_path: videoPath,
        video_url: `/outputs/${videoFileName}`,
        mode: 'template'
      });

      console.log(`[${jobId}]   Done: ${videoFileName}`);

    } catch (err) {
      console.error(`[${jobId}]   Overlay failed: ${err.message}`);
      videoFiles.push({
        index: audioFile.index,
        template_id: audioFile.template_id,
        text: audioFile.text,
        audio_url: audioFile.audio_url,
        video_file: null,
        error: err.message
      });
    }
  }

  return videoFiles;
}

/**
 * Process videos using full lip-sync (premium mode)
 */
async function processWithLipSync(jobId, audioFiles, videoUrl, outputDir) {
  const videoFiles = [];

  for (const audioFile of audioFiles) {
    const audioUrl = getPublicUrl(audioFile.audio_file, 'outputs');
    const videoFileName = `${jobId}_${String(audioFile.index).padStart(2, '0')}_${audioFile.template_id}.mp4`;
    const videoPath = path.join(outputDir, videoFileName);

    console.log(`[${jobId}]   Lip-sync ${audioFile.index}/${audioFiles.length}: ${audioFile.template_id}`);
    console.log(`[${jobId}]     Audio: ${audioUrl}`);

    try {
      const lipSyncResult = await createLipSyncJob({
        videoUrl,
        audioUrl
      });

      console.log(`[${jobId}]     fal.ai request: ${lipSyncResult.requestId}`);

      const completed = await waitForLipSyncCompletion(
        lipSyncResult.requestId,
        config.lipSyncTimeout,
        config.lipSyncPollInterval
      );

      await downloadOutput(completed.outputUrl, videoPath);

      videoFiles.push({
        index: audioFile.index,
        template_id: audioFile.template_id,
        text: audioFile.text,
        audio_url: audioFile.audio_url,
        video_file: videoFileName,
        video_path: videoPath,
        video_url: `/outputs/${videoFileName}`,
        lipsync_request_id: lipSyncResult.requestId,
        mode: 'lipsync'
      });

      console.log(`[${jobId}]     Done: ${videoFileName}`);

    } catch (err) {
      console.error(`[${jobId}]     Lip-sync failed: ${err.message}`);
      videoFiles.push({
        index: audioFile.index,
        template_id: audioFile.template_id,
        text: audioFile.text,
        audio_url: audioFile.audio_url,
        video_file: null,
        error: err.message
      });
    }
  }

  return videoFiles;
}

async function processJob(job) {
  const jobId = job.job_id;
  const qualityMode = job.quality_mode || 'template'; // template, lipsync, audio_only

  console.log(`[${jobId}] Starting job processing (mode: ${qualityMode})...`);

  try {
    job.status = 'processing';
    job.started_at = new Date().toISOString();
    job.quality_mode = qualityMode;
    saveJob(jobId, job);

    // Step 1: Generate questions
    let questions = [];

    if (job.script) {
      questions = [{
        template_id: 'custom',
        text: job.script
      }];
    } else {
      console.log(`[${jobId}] Generating questions...`);

      if (!job.job_description) {
        throw new Error('Either script or job_description is required');
      }

      questions = await generateQuestions({
        jobDescription: job.job_description,
        language: job.language || config.defaultLanguage,
        speakerName: job.speaker_name,
        templateIds: job.prompt_template_id ? [job.prompt_template_id] : null
      });

      questions = questions.filter(q => q.text && !q.error);

      if (questions.length === 0) {
        throw new Error('Failed to generate any questions');
      }

      job.generated_questions = questions;
      saveJob(jobId, job);

      console.log(`[${jobId}] Generated ${questions.length} questions`);
    }

    // Step 2: Auto-select voice if not specified
    let voiceId = job.voice_id;
    let voiceInfo = null;

    if (!voiceId && config.elevenLabsApiKey) {
      console.log(`[${jobId}] Auto-selecting voice based on context...`);
      try {
        voiceInfo = await autoSelectVoice(
          job.job_description || '',
          job.speaker_name,
          job.language
        );
        voiceId = voiceInfo.voiceId;
        job.auto_selected_voice = voiceInfo;
        saveJob(jobId, job);
        console.log(`[${jobId}] Auto-selected: ${voiceInfo.voiceName} (${voiceInfo.analysis.accent} ${voiceInfo.analysis.gender})`);
      } catch (err) {
        console.error(`[${jobId}] Voice auto-selection failed:`, err.message);
        // Will fall back to default or OpenAI
      }
    }

    // Step 3: Generate audio for each question
    console.log(`[${jobId}] Generating audio for ${questions.length} questions...`);

    const audioFiles = [];
    let selectedVoice = null;

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const index = String(i + 1).padStart(2, '0');
      const templateId = question.template_id || 'question';
      const audioFileName = `${jobId}_${index}_${templateId}.mp3`;
      const audioPath = path.join(config.outputsDir, audioFileName);

      console.log(`[${jobId}]   Audio ${index}/${questions.length}: ${templateId}`);

      const ttsResult = await generateSpeech({
        text: question.text,
        voice: job.voice || selectedVoice,
        voiceId: voiceId, // Auto-selected or manually specified
        provider: voiceId ? 'elevenlabs' : job.tts_provider,
        gender: job.gender,
        accent: job.accent,
        age: job.age,
        outputPath: audioPath
      });

      if (!selectedVoice) {
        selectedVoice = ttsResult.voice;
        const providerInfo = ttsResult.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI';
        console.log(`[${jobId}]   Voice: ${ttsResult.voice} (${providerInfo})`);
      }

      audioFiles.push({
        index: i + 1,
        template_id: templateId,
        text: question.text,
        audio_file: audioFileName,
        audio_path: audioPath,
        audio_url: `/outputs/${audioFileName}`,
        voice: ttsResult.voice,
        provider: ttsResult.provider || 'openai'
      });
    }

    job.audio_files = audioFiles;
    job.selected_voice = selectedVoice;
    saveJob(jobId, job);

    console.log(`[${jobId}] Generated ${audioFiles.length} audio files`);

    // Step 3: Generate videos based on quality mode
    let videoFiles = [];

    if (qualityMode === 'audio_only') {
      console.log(`[${jobId}] Audio-only mode, skipping video generation`);

    } else if (qualityMode === 'template') {
      // Basic mode: overlay audio on template videos
      const locale = job.locale || job.language || 'en';
      const templateIds = audioFiles.map(a => a.template_id);

      if (hasAllTemplates(templateIds, locale)) {
        console.log(`[${jobId}] Using template overlay mode...`);
        videoFiles = await processWithTemplates(jobId, audioFiles, locale, config.outputsDir);
      } else {
        console.log(`[${jobId}] Templates not found, falling back to audio-only`);
        job.note = 'Template videos not found. Audio files generated only.';
      }

    } else if (qualityMode === 'lipsync') {
      // Premium mode: full lip-sync
      const videoSource = findSourceVideo(job);

      if (!videoSource) {
        console.log(`[${jobId}] No video source for lip-sync, falling back to audio-only`);
        job.note = 'No video source found for lip-sync. Audio files generated only.';
      } else if (!config.publicBaseUrl) {
        console.log(`[${jobId}] PUBLIC_BASE_URL not set, cannot use lip-sync`);
        job.note = 'Set PUBLIC_BASE_URL for lip-sync. Audio files generated only.';
      } else if (!config.falApiKey) {
        console.log(`[${jobId}] FAL_API_KEY not set, cannot use lip-sync`);
        job.note = 'Set FAL_API_KEY for lip-sync. Audio files generated only.';
      } else {
        let videoUrl;
        if (videoSource.type === 'url') {
          videoUrl = videoSource.url;
        } else {
          videoUrl = getPublicUrl(videoSource.relativePath, 'inputs');
        }

        console.log(`[${jobId}] Using lip-sync mode...`);
        console.log(`[${jobId}] Video URL: ${videoUrl}`);

        videoFiles = await processWithLipSync(jobId, audioFiles, videoUrl, config.outputsDir);
      }
    }

    // Step 4: Complete job
    job.video_files = videoFiles;
    job.status = 'completed';
    job.completed_at = new Date().toISOString();

    const successfulVideos = videoFiles.filter(v => v.video_file);
    const failedVideos = videoFiles.filter(v => !v.video_file);

    job.outputs = {
      video_files: successfulVideos.map(f => ({
        index: f.index,
        template_id: f.template_id,
        video_url: f.video_url,
        audio_url: f.audio_url,
        mode: f.mode
      })),
      audio_files: audioFiles.map(f => ({
        index: f.index,
        template_id: f.template_id,
        url: f.audio_url
      })),
      total_videos: successfulVideos.length,
      total_audio: audioFiles.length,
      voice: selectedVoice,
      quality_mode: qualityMode
    };

    if (failedVideos.length > 0 && successfulVideos.length > 0) {
      job.note = `Generated ${successfulVideos.length}/${audioFiles.length} videos. ${failedVideos.length} failed.`;
      job.failed_items = failedVideos.map(v => ({ index: v.index, error: v.error }));
    } else if (successfulVideos.length > 0) {
      job.note = `Successfully generated ${successfulVideos.length} videos (${qualityMode} mode).`;
    } else if (!job.note) {
      job.note = `Generated ${audioFiles.length} audio files.`;
    }

    saveJob(jobId, job);

    console.log(`[${jobId}] Job completed!`);
    console.log(`[${jobId}] Output: ${successfulVideos.length} videos, ${audioFiles.length} audio files`);

    return job;

  } catch (error) {
    console.error(`[${jobId}] Job failed:`, error.message);

    job.status = 'failed';
    job.error = error.message;
    job.failed_at = new Date().toISOString();
    saveJob(jobId, job);

    throw error;
  }
}

module.exports = { processJob };
