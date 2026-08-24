import { VideoPlanSchema, ChapterPlanSchema, ScenePlanSchema } from '../services/gemini.js';
import { storageService } from '../services/storage.js';
import { videoPipelineManager } from '../services/pipeline.js';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Assertion failed for: ${testName}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('           AI VIDEO STUDIO — AUTOMATED ENGINE TESTS             ');
  console.log('================================================================\n');

  // Test 1: Gemini Schema Validation with Valid JSON Plan
  console.log('1. Testing Gemini Plan Schema Validation...');
  const validPlan = {
    title: 'The AI Revolution in Education',
    hook: 'What if machines could teach better than humans?',
    targetAudience: 'Educators and technology enthusiasts',
    durationSeconds: 30,
    chapters: [
      {
        title: 'Chapter 1: The New Classroom',
        startTime: 0,
        endTime: 30,
        scenes: [
          {
            sceneNumber: 1,
            durationSeconds: 15,
            narration: 'Artificial intelligence is fundamentally reshaping learning worldwide.',
            visualPrompt: 'Cinematic shot of modern students collaborating with holographic AI interfaces, soft daylight, photorealistic 8k',
            purpose: 'Hook & Context',
          },
          {
            sceneNumber: 2,
            durationSeconds: 15,
            narration: 'Personalized curriculum adapts to each student in real time.',
            visualPrompt: 'Close up tracking shot of glowing digital learning nodes connecting student profiles, 720p cinematic lighting',
            purpose: 'Core Revelation',
          },
        ],
      },
    ],
    ending: 'Education will never be the same again.',
    cta: 'Subscribe for daily AI breakthroughs!',
  };

  const parsed = VideoPlanSchema.parse(validPlan);
  assert(parsed.title === 'The AI Revolution in Education', 'Valid plan parsed correctly');
  assert(parsed.chapters.length === 1, 'Chapter structure retained');
  assert(parsed.chapters[0].scenes.length === 2, 'Scene breakdown validated');

  // Test 2: Invalid Schema Rejection
  console.log('\n2. Testing Invalid Schema Rejection...');
  const invalidPlan = {
    title: '', // Empty title violates min(1)
    durationSeconds: -10, // Negative duration
  };

  let schemaErrorCaught = false;
  try {
    VideoPlanSchema.parse(invalidPlan);
  } catch (err) {
    schemaErrorCaught = true;
  }
  assert(schemaErrorCaught, 'Invalid schema was successfully rejected by Zod validation');

  // Test 3: Storage Abstraction Operations
  console.log('\n3. Testing Storage Service (Upload, Get, Delete)...');
  const testJobId = 'test_storage_job_123';
  const testFilename = 'sample_test_asset.txt';
  const testBuffer = Buffer.from('AI Video Studio Engine Storage Test', 'utf-8');

  const uploadResult = await storageService.uploadVideo(testJobId, testFilename, testBuffer);
  assert(fs.existsSync(uploadResult.localPath), 'File saved to disk');
  assert(uploadResult.sizeBytes === testBuffer.length, 'File size matches uploaded buffer');

  const retrieved = await storageService.getVideo(uploadResult.key);
  assert(retrieved !== null && retrieved.toString('utf-8') === 'AI Video Studio Engine Storage Test', 'File retrieved successfully');

  const deleted = await storageService.deleteVideo(uploadResult.key);
  assert(deleted === true, 'File deleted successfully');

  // Test 4: Video Job Queue & Status Model
  console.log('\n4. Testing Video Job Lifecycle...');
  const job = videoPipelineManager.createJob({
    topic: 'Automated test video topic',
    videoType: 'short',
    durationSeconds: 30,
    style: 'cinematic',
  });

  assert(job.status === 'queued' || job.status === 'planning' || job.status === 'failed', 'Job initialized with valid status');
  assert(job.topic === 'Automated test video topic', 'Job metadata preserved');
  assert(job.durationSeconds === 30, 'Job target duration matches request');

  const fetchedJob = videoPipelineManager.getJob(job.id);
  assert(fetchedJob?.id === job.id, 'Job retrievable from pipeline registry by ID');

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed successfully!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
