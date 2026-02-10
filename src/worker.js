const config = require('./config');
const { listPendingJobs, loadJob, saveJob, ensureDirectories } = require('./utils/fileUtils');
const { processJob } = require('./jobs/videoProcessor');

let isProcessing = false;

async function pollAndProcess() {
  if (isProcessing) return;

  try {
    const pendingJobs = listPendingJobs();

    if (pendingJobs.length === 0) {
      return;
    }

    isProcessing = true;
    const job = pendingJobs[0];

    console.log(`\n[Worker] Found pending job: ${job.job_id}`);

    try {
      await processJob(job);
      console.log(`[Worker] Job ${job.job_id} completed successfully`);
    } catch (error) {
      console.error(`[Worker] Job ${job.job_id} failed:`, error.message);
    }

  } catch (error) {
    console.error('[Worker] Error in poll cycle:', error);
  } finally {
    isProcessing = false;
  }
}

function startWorker() {
  ensureDirectories();

  console.log('Worker started');
  console.log(`Polling interval: ${config.workerPollInterval}ms`);
  console.log(`Jobs directory: ${config.jobsDir}`);
  console.log(`Outputs directory: ${config.outputsDir}`);
  console.log('\nWaiting for jobs...\n');

  // Initial poll
  pollAndProcess();

  // Set up polling interval
  setInterval(pollAndProcess, config.workerPollInterval);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Worker] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Worker] Shutting down...');
  process.exit(0);
});

startWorker();
