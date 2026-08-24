import { shortVideoPipeline } from '../services/shortVideoPipeline.js';
import { CreateShortOptions } from '../ai/gemini/geminiDirector.js';

async function run() {
  console.log('====================================================');
  console.log('   AI VIDEO STUDIO — SHORT VIDEO PIPELINE TEST      ');
  console.log('====================================================\n');

  const options: CreateShortOptions = {
    idea: '5 mind-blowing facts about deep sea creatures you never knew existed',
    durationSeconds: 15,
    platform: 'youtube_shorts',
    style: 'cinematic',
    customInstructions: 'Make the visual atmosphere dark, bioluminescent, and eerie.',
  };

  console.log('Input Parameters:');
  console.log(`- Idea: "${options.idea}"`);
  console.log(`- Duration: ${options.durationSeconds}s`);
  console.log(`- Platform: ${options.platform}`);
  console.log(`- Style: ${options.style}\n`);

  const startTime = Date.now();

  const result = await shortVideoPipeline.execute(options, (job) => {
    console.log(`>>> [PROGRESS ${job.progressPercent}%] ${job.userFacingStatus}`);
  });

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log('\n====================================================');
  console.log(`Execution completed in ${durationSec}s`);
  console.log(`Job Status: ${result.status}`);
  console.log(`Video Output Path: ${result.outputVideoPath || 'None'}`);
  console.log(`Thumbnail Path: ${result.thumbnailPath || 'None'}`);
  console.log(`Subtitles Path: ${result.subtitlesPath || 'None'}`);
  console.log('====================================================\n');

  if (result.status === 'completed') {
    console.log('SUCCESS: Short Video Proof of Concept has passed all criteria!');
    process.exit(0);
  } else {
    console.error('FAILURE: Short Video generation did not complete successfully.');
    console.error('Error details:', result.error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
