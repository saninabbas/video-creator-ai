import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function downloadImage(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        resolve(false);
      }
    });
    req.on('error', () => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      resolve(false);
    });
  });
}

async function testRender() {
  const prompt = 'sports man running athletic sprinter track morning golden hour 4k cinematic';
  const width = 720;
  const height = 1280;
  const dur = 5;
  const imgPath = path.resolve('storage/test_ai_frame.jpg');
  const outPath = path.resolve('storage/test_ai_clip.mp4');

  const dir = path.dirname(imgPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=42`;
  console.log('Downloading AI image frame from:', url);
  const ok = await downloadImage(url, imgPath);
  console.log('Downloaded:', ok, 'exists:', fs.existsSync(imgPath));

  if (ok && fs.existsSync(imgPath)) {
    console.log('Rendering motion clip with FFmpeg...');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imgPath)
        .loop(dur)
        .input(`anoisesrc=d=${dur}:c=pink:r=44100:a=0.001`)
        .inputFormat('lavfi')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-pix_fmt yuv420p',
          `-vf scale=${width}:${height},zoompan=z='min(zoom+0.0015,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dur*30}:s=${width}x${height}:fps=30`,
          '-preset fast',
          '-shortest'
        ])
        .output(outPath)
        .on('end', () => {
          console.log('Successfully created dynamic AI motion video clip:', outPath);
          resolve(outPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          reject(err);
        })
        .run();
    });
  }
}

testRender().catch(console.error);
