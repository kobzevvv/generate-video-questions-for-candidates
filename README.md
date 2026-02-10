# Video Questions Generator

A scalable service that generates interview questions from job descriptions, converts them to speech, and applies lip-sync to speaker videos.

## Stage 1 MVP

This is the Stage 1 implementation with:
- REST API for job management
- Question generation using existing prompt templates
- TTS via OpenAI
- Lip-sync via Sync Labs
- File-based job queue (async worker pattern)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required API keys:
- `OPENAI_API_KEY` - Get from https://platform.openai.com
- `SYNCLABS_API_KEY` - Get from https://sync.so

### 3. Run the server and worker

Terminal 1 (API server):
```bash
npm start
```

Terminal 2 (job worker):
```bash
npm run worker
```

Or run both (dev mode):
```bash
npm run dev
```

## API Endpoints

### Create a job

```bash
# With job description (generates questions automatically)
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/speaker.mp4",
    "job_description": "We are looking for a senior backend engineer...",
    "voice": "nova",
    "language": "en"
  }'

# With custom script
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/speaker.mp4",
    "script": "Hello! Tell me about your experience with distributed systems."
  }'

# With specific template
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/speaker.mp4",
    "job_description": "...",
    "prompt_template_id": "tell-about-relevant-experience"
  }'
```

### Check job status

```bash
curl http://localhost:3000/api/jobs/job_abc123
```

### List available templates

```bash
curl http://localhost:3000/api/jobs/meta/templates
```

### List available voices

```bash
curl http://localhost:3000/api/jobs/meta/voices
```

## Project Structure

```
├── promts/                     # Prompt templates (existing)
├── input-examples/             # Example job descriptions (existing)
├── src/
│   ├── server.js               # Express API server
│   ├── worker.js               # Job processor
│   ├── config.js               # Configuration
│   ├── routes/
│   │   └── jobs.js             # Job endpoints
│   ├── services/
│   │   ├── promptLoader.js     # Load prompt templates
│   │   ├── questionGenerator.js # Generate questions via LLM
│   │   ├── tts.js              # OpenAI TTS
│   │   └── lipSync.js          # Sync Labs lip-sync
│   ├── jobs/
│   │   └── videoProcessor.js   # Main job orchestration
│   └── utils/
│       └── fileUtils.js        # File helpers
├── data/
│   ├── jobs/                   # Job state (JSON)
│   ├── uploads/                # Input videos
│   └── outputs/                # Processed files
```

## Available Templates

| Template | Description |
|----------|-------------|
| `intro-video` | Intro script for candidates |
| `must-have-requirements-check` | Verify mandatory requirements |
| `tell-about-relevant-experience` | Ask about relevant experience |
| `key-frameworks-in-use` | Ask about methodologies/frameworks |
| `failed-plan-fix` | Ask about handling failures |

## Available Voices

OpenAI TTS voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

## Stage 1 Limitations

1. **Lip-sync requires public URLs**: Sync Labs API needs publicly accessible video and audio URLs. For local files, you'll need to serve them via a public endpoint or upload to cloud storage.

2. **File-based queue**: Jobs are stored as JSON files. For production, replace with Redis/BullMQ.

3. **Single worker**: One job at a time. Scale with multiple worker instances in Stage 2.

## Stage 2 Improvements (Planned)

- [ ] File upload endpoint with cloud storage (S3/GCS)
- [ ] Redis-based job queue (BullMQ)
- [ ] Webhook notifications
- [ ] Multiple TTS provider support
- [ ] Multiple lip-sync provider support
- [ ] Job progress streaming
- [ ] Retry logic and dead-letter queue
