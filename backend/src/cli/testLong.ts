import { longVideoPipeline } from '../services/longVideoPipeline.js';
import { CreateLongVideoOptions } from '../ai/gemini/geminiDirector.js';

async function run() {
  console.log('====================================================');
  console.log('   AI VIDEO STUDIO — LONG VIDEO (8-MIN) PIPELINE    ');
  console.log('====================================================\n');

  const options: CreateLongVideoOptions = {
    idea: 'The Untold History of Ancient Megastructures and Lost Technologies',
    durationMinutes: 8,
    style: 'documentary',
    customInstructions: 'Focus on architectural marvels, lost engineering knowledge, and majestic archaeological aerials.',
  };

  console.log('Input Parameters:');
  console.log(`- Idea: "${options.idea}"`);
  console.log(`- Duration: ${options.durationMinutes} minutes (480 seconds)`);
  console.log(`- Style: ${options.style}\n`);

  const startTime = Date.now();

  const result = await longVideoPipeline.execute(options, (job) => {
    console.log(`>>> [PROGRESS ${job.progressPercent}%] ${job.userFacingStatus}`);
  });

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log('\n====================================================');
  console.log(`Execution completed in ${durationSec}s`);
  console.log(`Job Status: ${result.status}`);
  console.log(`Master Video Output: ${result.outputVideoPath || 'None'}`);
  console.log(`Thumbnail Path: ${result.thumbnailPath || 'None'}`);
  console.log(`Subtitles Path: ${result.subtitlesPath || 'None'}`);
  if (result.script?.youtubePackage) {
    console.log('\nYouTube Package Generated:');
    console.log(`- Titles: ${result.script.youtubePackage.titles.join(' | ')}`);
    console.log(`- Chapters:\n${result.script.youtubePackage.chaptersText}`);
  }
  console.log('====================================================\n');

  if (result.status === 'completed') {
    console.log('SUCCESS: Long Video 8-Minute Proof of Concept has passed all criteria!');
    process.exit(0);
  } else {
    console.error('FAILURE: Long Video generation did not complete successfully.');
    console.error('Error details:', result.error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
