const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Overlay audio onto a template video using ffmpeg
 * The template video's audio is replaced with the new audio
 */
async function overlayAudio(options) {
  const {
    templateVideoPath,
    audioPath,
    outputPath
  } = options;

  if (!fs.existsSync(templateVideoPath)) {
    throw new Error(`Template video not found: ${templateVideoPath}`);
  }

  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  return new Promise((resolve, reject) => {
    // ffmpeg command:
    // -i video.mp4 -i audio.mp3 -c:v copy -map 0:v:0 -map 1:a:0 -shortest output.mp4
    const args = [
      '-y', // Overwrite output
      '-i', templateVideoPath,
      '-i', audioPath,
      '-c:v', 'copy', // Copy video codec (no re-encoding)
      '-map', '0:v:0', // Use video from first input
      '-map', '1:a:0', // Use audio from second input
      '-shortest', // Cut to shortest stream
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({
          outputPath,
          success: true
        });
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg error: ${err.message}`));
    });
  });
}

/**
 * Find template video for a given template ID and locale
 * Searches in: templates/{locale}/{templateId}.mp4
 * Falls back to: templates/default/{templateId}.mp4
 */
function findTemplateVideo(templateId, locale = 'en') {
  const templatesDir = path.join(config.inputExamplesDir, '..', 'templates');

  // Try locale-specific template first
  const localeTemplatePath = path.join(templatesDir, locale, `${templateId}.mp4`);
  if (fs.existsSync(localeTemplatePath)) {
    return localeTemplatePath;
  }

  // Fall back to default template
  const defaultTemplatePath = path.join(templatesDir, 'default', `${templateId}.mp4`);
  if (fs.existsSync(defaultTemplatePath)) {
    return defaultTemplatePath;
  }

  return null;
}

/**
 * Check if all template videos exist for given template IDs
 */
function hasAllTemplates(templateIds, locale = 'en') {
  for (const templateId of templateIds) {
    if (!findTemplateVideo(templateId, locale)) {
      return false;
    }
  }
  return true;
}

/**
 * Get audio duration in seconds using ffprobe
 */
async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', audioPath,
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'csv=p=0'
    ];

    const ffprobe = spawn('ffprobe', args);
    let stdout = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        resolve(duration);
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`ffprobe error: ${err.message}`));
    });
  });
}

module.exports = {
  overlayAudio,
  findTemplateVideo,
  hasAllTemplates,
  getAudioDuration
};
