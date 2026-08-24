import path from 'path';
import fs from 'fs';
import { veoService } from '../services/veo.js';
import { storageService } from '../services/storage.js';
import { config } from '../config/env.js';

async function main() {
  console.log('================================================================');
  console.log('    AI VIDEO STUDIO — SINGLE SCENE REAL VEO 3.1 GENERATION TEST ');
  console.log('================================================================\n');

  const testPrompt =
    'A cinematic documentary shot of a futuristic city at sunset, realistic architecture, natural movement, professional documentary cinematography.';

  console.log(`Model: ${config.VEO_MODEL}`);
  console.log(`Prompt: "${testPrompt}"\n`);

  if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === '') {
    console.error('----------------------------------------------------------------');
    console.error('ERROR: GEMINI_API_KEY is not configured in .env or environment.');
    console.error('Please obtain a Google API Key from https://aistudio.google.com/');
    console.error('and set GEMINI_API_KEY=your_key in backend/.env to run real generation.');
    console.error('----------------------------------------------------------------');
    process.exit(1);
  }

  const testJobId = `test_scene_${Date.now()}`;
  const jobDir = storageService.getJobDir(testJobId);
  const outputFilePath = path.join(jobDir, 'single_scene_output.mp4');

  const startTime = Date.now();

  try {
    const result = await veoService.generateScene({
      prompt: testPrompt,
      aspectRatio: '16:9',
      resolution: '720p',
      durationSeconds: 5,
      outputFilePath,
      onProgress: (status, elapsedSec) => {
        console.log(`>>> [PROGRESS] ${status} (${elapsedSec}s elapsed)`);
      },
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('\n================================================================');
    console.log(`SUCCESS: Real Veo 3.1 scene generated in ${elapsed}s!`);
    console.log(`Operation Name: ${result.operationName}`);
    console.log(`File Path: ${result.videoFilePath}`);
    console.log(`File Size: ${result.fileSizeBytes} bytes`);
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('\n================================================================');
    console.error('FAILURE: Video generation test failed.');
    console.error('Details:', err.message || err);
    console.error('================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
