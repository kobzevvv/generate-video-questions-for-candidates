const path = require('path');
const fs = require('fs');
const config = require('../config');
const { saveJob, downloadFile } = require('../utils/fileUtils');
const { generateQuestions, combineQuestionsToScript } = require('../services/questionGenerator');
const { generateSpeech } = require('../services/tts');
const { createLipSyncJob, waitForLipSyncCompletion, downloadOutput } = require('../services/lipSync');

async function processJob(job) {
  const jobId = job.job_id;
  console.log(`[${jobId}] Starting job processing...`);

  try {
    // Update status to processing
    job.status = 'processing';
    job.started_at = new Date().toISOString();
    saveJob(jobId, job);

    // Step 1: Determine script
    let script = job.script;
    let generatedQuestions = null;

    if (!script) {
      console.log(`[${jobId}] No script provided, generating questions...`);

      if (!job.job_description) {
        throw new Error('Either script or job_description is required');
      }

      generatedQuestions = await generateQuestions({
        jobDescription: job.job_description,
        language: job.language || config.defaultLanguage,
        speakerName: job.speaker_name,
        templateIds: job.prompt_template_id ? [job.prompt_template_id] : null
      });

      script = combineQuestionsToScript(generatedQuestions);
      job.generated_questions = generatedQuestions;
      job.generated_script = script;
      saveJob(jobId, job);

      console.log(`[${jobId}] Generated ${generatedQuestions.length} questions`);
    }

    if (!script || script.trim().length === 0) {
      throw new Error('Failed to generate script');
    }

    // Step 2: Generate speech audio
    console.log(`[${jobId}] Generating speech...`);
    const audioPath = path.join(config.outputsDir, `${jobId}_audio.mp3`);

    const ttsResult = await generateSpeech({
      text: script,
      voice: job.voice || config.defaultVoice,
      outputPath: audioPath
    });

    job.audio_path = audioPath;
    job.tts_result = ttsResult;
    saveJob(jobId, job);
    console.log(`[${jobId}] Speech generated: ${audioPath}`);

    // Step 3: Prepare video
    let videoPath = job.video_path;

    if (!videoPath && job.video_url) {
      console.log(`[${jobId}] Downloading video...`);
      videoPath = path.join(config.uploadsDir, `${jobId}_input.mp4`);
      await downloadFile(job.video_url, videoPath);
      job.video_path = videoPath;
      saveJob(jobId, job);
      console.log(`[${jobId}] Video downloaded: ${videoPath}`);
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error('Video file not found');
    }

    // Step 4: Apply lip-sync
    // Note: Sync Labs requires URLs, so for local files we need to serve them
    // For MVP, we assume video_url and audio need to be accessible URLs
    // In production, upload to S3/GCS or use a file serving endpoint

    console.log(`[${jobId}] Starting lip-sync...`);

    // For MVP: if we have URLs, use them directly
    // Otherwise, this needs a file server (Stage 2 improvement)
    const videoUrl = job.video_url;
    const audioUrl = job.audio_url; // Would need to be set if audio is uploaded somewhere

    if (!videoUrl) {
      // MVP limitation: we need a video URL for Sync Labs
      console.log(`[${jobId}] MVP limitation: video_url required for lip-sync`);
      console.log(`[${jobId}] Skipping lip-sync, returning audio only...`);

      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      job.output_audio_url = `/outputs/${jobId}_audio.mp3`;
      job.note = 'Lip-sync skipped: video_url required. Audio generated successfully.';
      saveJob(jobId, job);

      return job;
    }

    // For audio, we need a publicly accessible URL
    // In production, upload to cloud storage
    // For MVP, we'll note this limitation
    if (!audioUrl) {
      console.log(`[${jobId}] MVP limitation: need to serve audio publicly for lip-sync`);
      console.log(`[${jobId}] Set audio_url in job or implement file serving`);

      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      job.output_audio_url = `/outputs/${jobId}_audio.mp3`;
      job.note = 'Lip-sync pending: audio needs public URL. See Stage 2 for file serving.';
      saveJob(jobId, job);

      return job;
    }

    // Full lip-sync flow when URLs are available
    const lipSyncResult = await createLipSyncJob({
      videoUrl,
      audioUrl
    });

    job.lipsync_job_id = lipSyncResult.jobId;
    saveJob(jobId, job);

    console.log(`[${jobId}] Lip-sync job created: ${lipSyncResult.jobId}`);

    // Wait for completion
    const completedLipSync = await waitForLipSyncCompletion(lipSyncResult.jobId);

    // Download result
    const outputPath = path.join(config.outputsDir, `${jobId}_output.mp4`);
    await downloadOutput(completedLipSync.outputUrl, outputPath);

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    job.output_video_path = outputPath;
    job.output_video_url = `/outputs/${jobId}_output.mp4`;
    saveJob(jobId, job);

    console.log(`[${jobId}] Job completed successfully!`);
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
