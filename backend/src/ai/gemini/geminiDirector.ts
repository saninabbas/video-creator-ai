import { getGenAIClient } from './geminiClient.js';
import { config } from '../../config/env.js';
import {
  VideoScript,
  VideoScriptSchema,
  VideoStyle,
  Platform,
  AspectRatio,
  YouTubePackage,
} from '../../types/script.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateShortOptions {
  idea: string;
  durationSeconds: 15 | 30 | 60 | 90;
  platform: 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'facebook_reels';
  style: VideoStyle;
  customInstructions?: string;
}

export interface CreateLongVideoOptions {
  idea: string;
  durationMinutes: 8 | 10 | 15 | 20 | 30;
  style: VideoStyle;
  customInstructions?: string;
}

export interface ScriptImprovement {
  type: 'hook' | 'pacing' | 'narration' | 'visual' | 'call_to_action';
  description: string;
  suggestedChange: string;
}

export interface ShortMomentSuggestion {
  id: string;
  title: string;
  hook: string;
  startSceneNumber: number;
  endSceneNumber: number;
  durationSeconds: number;
  viralityRationale: string;
}

export class GeminiDirector {
  private client = getGenAIClient();

  /**
   * Plans and writes a complete structured script for a Short video (15s-90s).
   */
  public async planShortVideo(options: CreateShortOptions): Promise<VideoScript> {
    console.log(`[GeminiDirector] Planning Short Video for idea: "${options.idea}" (${options.durationSeconds}s, ${options.style}, ${options.platform})`);

    const sceneCount = Math.max(2, Math.round(options.durationSeconds / 5)); // 5 seconds per scene avg

    const systemInstruction = `
You are the world's best AI Video Director, Executive Producer, and Viral Scriptwriter for short-form social video (YouTube Shorts, TikTok, Instagram Reels).
Your mission:
1. Understand the user's idea deeply.
2. Formulate an irresistible, immediate 0-3 second hook (curiosity gap, pattern interrupt, bold visual).
3. Create a unified "Visual Bible" to guarantee consistent art style, colors, lighting, and environment across all scenes.
4. Break down the video into ${sceneCount} punchy scenes matching the target duration of ${options.durationSeconds} seconds.
5. For EVERY scene, craft an expert Veo 3.1 visual prompt specifying cinematic camera motion (e.g., slow drone dolly, close-up tracking, dynamic whip pan), realistic lighting, atmosphere, and visual consistency tokens.
6. Write concise, spoken-speed narration tailored for high audience retention.
7. Return ONLY clean, valid JSON matching the exact schema requested. No markdown formatting outside of JSON.
`;

    const prompt = `
Generate a complete structured Short Video plan:
- Idea: "${options.idea}"
- Target Duration: ${options.durationSeconds} seconds
- Target Platform: ${options.platform}
- Visual Style: ${options.style}
${options.customInstructions ? `- Custom Instructions: "${options.customInstructions}"` : ''}

JSON Schema Requirements:
{
  "title": "Compelling Title",
  "concept": "Core premise",
  "targetAudience": "Audience description",
  "style": "${options.style}",
  "platform": "${options.platform}",
  "aspectRatio": "9:16",
  "targetDurationSeconds": ${options.durationSeconds},
  "hook": {
    "narration": "First 3 seconds spoken hook",
    "visualHook": "Eye-catching initial visual",
    "durationSeconds": 3
  },
  "visualBible": {
    "theme": "Core aesthetic theme",
    "artStyle": "Specific art style details",
    "colorPalette": ["#hex or color names"],
    "lightingDirection": "Lighting description",
    "characterDescriptions": { "narrator_or_subject": "Visual description" },
    "settingAndEnvironment": "Detailed environment description",
    "prohibitedElements": ["avoid artifacts", "unwanted tropes"]
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Complete Short Story",
      "summary": "Fast-paced short progression",
      "timestampStartSeconds": 0,
      "timestampEndSeconds": ${options.durationSeconds},
      "scenes": [
        {
          "sceneNumber": 1,
          "timestampStartSeconds": 0,
          "timestampEndSeconds": 5,
          "estimatedDurationSeconds": 5,
          "title": "Hook Scene",
          "narration": "Narration text for scene 1",
          "visualType": "veo_generated",
          "veoPrompt": "Photorealistic 4k cinematic shot of...",
          "cameraMotion": "Fast dolly in",
          "lightingAndAtmosphere": "Dramatic volumetric sunlight",
          "visualConsistencyTokens": ["tag1", "tag2"]
        }
      ]
    }
  ],
  "callToAction": "Actionable closing CTA (e.g. Subscribe for part 2, Follow for daily AI insights)"
}
`;

    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.length < 5) {
      console.log('[GeminiDirector] No GEMINI_API_KEY configured. Generating blueprint with built-in director engine.');
      return this.generateFallbackShortScript(options);
    }

    try {
      const response = await this.client.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const parsed = this.cleanAndParseJson(text);
      const videoScript: VideoScript = VideoScriptSchema.parse({
        ...parsed,
        id: uuidv4(),
        aspectRatio: '9:16',
        platform: options.platform,
        style: options.style,
        targetDurationSeconds: options.durationSeconds,
      });

      return videoScript;
    } catch (err: any) {
      console.warn('[GeminiDirector] Gemini API call error, using director engine fallback:', err.message);
      return this.generateFallbackShortScript(options);
    }
  }

  /**
   * Plans and writes an 8 to 30 minute long-form YouTube documentary or educational video.
   */
  public async planLongVideo(options: CreateLongVideoOptions): Promise<VideoScript> {
    const durationSeconds = options.durationMinutes * 60;
    console.log(`[GeminiDirector] Planning Long Video (${options.durationMinutes} min / ${durationSeconds}s) for idea: "${options.idea}"`);

    // Long videos are broken down into chapters with intelligent scene distribution (Section 13)
    const chapterCount = Math.max(4, Math.round(options.durationMinutes / 2)); // e.g. 4-10 chapters
    const scenesPerChapter = 3; // 3 scenes per chapter = 12-30 scenes total

    const systemInstruction = `
You are the Chief Creative Director and Documentary Showrunner for a premier YouTube channel.
Your task is to architect a compelling, high-retention long-form video of ${options.durationMinutes} minutes (${durationSeconds} seconds).

ARCHITECTURE REQUIREMENTS:
1. Divide the script into ${chapterCount} comprehensive chapters (Introduction/Hook, Development, Core Conflict/Insights, Climax, Conclusion/Takeaways).
2. For each chapter, create ${scenesPerChapter} distinct scenes.
3. Establish an exhaustive "Visual Bible" ensuring visual continuity (characters, setting, color palette, camera grammar, mood) across all scenes.
4. For every scene, write:
   - Engaging spoken narration (with realistic spoken word count matching scene duration).
   - Veo 3.1 prompt engineered with cinematic camera movements, lens choices, volumetric lighting, and visual consistency tokens.
   - Classification of visual asset type (veo_generated for key dramatic scenes, b_roll_generated, or visual_transition).
5. Generate the complete "YouTube Package":
   - 5 high-CTR title variations.
   - SEO-optimized YouTube description with timestamps and links.
   - Chapter timestamp list.
   - High-converting thumbnail concept + Veo/Imagen prompt for the thumbnail.
   - Relevant SEO tags.
6. Return ONLY valid JSON.
`;

    const prompt = `
Generate a master long-form video blueprint:
- Idea: "${options.idea}"
- Target Duration: ${options.durationMinutes} minutes (${durationSeconds} seconds)
- Style: ${options.style}
${options.customInstructions ? `- Custom Instructions: "${options.customInstructions}"` : ''}

JSON Schema structure:
{
  "title": "Master YouTube Title",
  "concept": "Documentary premise",
  "targetAudience": "Target demographics & interests",
  "style": "${options.style}",
  "platform": "youtube_long",
  "aspectRatio": "16:9",
  "targetDurationSeconds": ${durationSeconds},
  "hook": {
    "narration": "Riveting 15-30 second cold open",
    "visualHook": "High stakes visual opening scene",
    "durationSeconds": 20
  },
  "visualBible": {
    "theme": "Documentary visual theme",
    "artStyle": "Cinematic 8k realism",
    "colorPalette": ["#1A1A2E", "#E94560", "#0F3460"],
    "lightingDirection": "Warm natural backlight with subtle moody fill",
    "characterDescriptions": { "primary_figure": "Historical or thematic subject representation" },
    "settingAndEnvironment": "Epic landscapes and detailed interior environments",
    "prohibitedElements": ["anachronisms", "cartoonish artifacts"]
  },
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter Title",
      "summary": "Chapter synopsis",
      "timestampStartSeconds": 0,
      "timestampEndSeconds": ${Math.round(durationSeconds / chapterCount)},
      "scenes": [
        {
          "sceneNumber": 1,
          "timestampStartSeconds": 0,
          "timestampEndSeconds": 30,
          "estimatedDurationSeconds": 30,
          "title": "Scene Title",
          "narration": "Full narration paragraph for this scene...",
          "visualType": "veo_generated",
          "veoPrompt": "Veo 3.1 prompt with camera direction...",
          "cameraMotion": "Slow aerial sweep",
          "lightingAndAtmosphere": "Dusk golden hour with atmospheric haze",
          "visualConsistencyTokens": ["tokenA", "tokenB"]
        }
      ]
    }
  ],
  "youtubePackage": {
    "titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
    "description": "Full formatted YouTube description with chapters and call to action...",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "chaptersText": "0:00 - Intro\\n...",
    "thumbnailConcept": "Visual description of thumbnail",
    "thumbnailPrompt": "Prompt to generate thumbnail",
    "callToAction": "Closing YouTube CTA"
  },
  "callToAction": "Subscribe and comment your thoughts below"
}
`;

    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.length < 5) {
      console.log('[GeminiDirector] No GEMINI_API_KEY configured. Generating long video blueprint with built-in director engine.');
      return this.generateFallbackLongScript(options);
    }

    try {
      const response = await this.client.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const parsed = this.cleanAndParseJson(text);
      const videoScript: VideoScript = VideoScriptSchema.parse({
        ...parsed,
        id: uuidv4(),
        aspectRatio: '16:9',
        platform: 'youtube_long',
        style: options.style,
        targetDurationSeconds: durationSeconds,
      });

      return videoScript;
    } catch (err: any) {
      console.warn('[GeminiDirector] Gemini API call error, using long director engine fallback:', err.message);
      return this.generateFallbackLongScript(options);
    }
  }

  /**
   * AI Improve: Analyzes an existing script and suggests 3-5 high-impact improvements.
   */
  public async analyzeAndImprove(script: VideoScript): Promise<ScriptImprovement[]> {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.length < 5) {
      return [
        {
          type: 'hook',
          description: 'The first 3 seconds can be made 40% punchier to stop high-speed feed scrollers.',
          suggestedChange: `Change hook to: "Nobody expected this discovery inside ${script.title.slice(0, 30)}..."`,
        },
        {
          type: 'visual',
          description: 'Increase dynamic lighting contrast on opening scenes.',
          suggestedChange: 'Add volumetric lighting and rapid dolly zoom on first reveal.',
        },
        {
          type: 'call_to_action',
          description: 'Create a curiosity loop in the closing call to action.',
          suggestedChange: 'Add: "Let us know in the comments: what theory do you believe?"',
        },
      ];
    }

    try {
      const prompt = `
Analyze the following video script and provide 3-5 concrete, actionable improvements for hook strength, pacing, narration clarity, visual drama, and CTA conversion.

Script Data:
${JSON.stringify(script, null, 2)}

Return JSON array of:
[
  {
    "type": "hook" | "pacing" | "narration" | "visual" | "call_to_action",
    "description": "What needs improvement",
    "suggestedChange": "Exact revised wording or direction"
  }
]
`;

      const response = await this.client.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      return this.cleanAndParseJson(text) as ScriptImprovement[];
    } catch (err: any) {
      console.warn('[GeminiDirector] analyzeAndImprove API failed, using fallback:', err.message);
      return [
        {
          type: 'hook',
          description: 'Strengthen initial curiosity gap.',
          suggestedChange: 'Open with high-contrast cinematic visual.',
        },
      ];
    }
  }

  /**
   * Long Video -> Shorts: Extracts 3-7 viral short-form clips from a long script.
   */
  public async extractShortMoments(script: VideoScript, count = 5): Promise<ShortMomentSuggestion[]> {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.length < 5) {
      const moments: ShortMomentSuggestion[] = [];
      const totalScenes = script.chapters.flatMap((c) => c.scenes);
      const step = Math.max(1, Math.floor(totalScenes.length / count));

      for (let i = 0; i < Math.min(count, totalScenes.length); i++) {
        const targetScene = totalScenes[i * step] || totalScenes[0];
        moments.push({
          id: `short_moment_${i + 1}`,
          title: `Secret Reveal: ${targetScene.title}`,
          hook: `You won't believe what happens in ${targetScene.title}`,
          startSceneNumber: targetScene.sceneNumber,
          endSceneNumber: targetScene.sceneNumber,
          durationSeconds: 30,
          viralityRationale: 'High retention visual moment with strong curiosity gap.',
        });
      }
      return moments;
    }

    try {
      const prompt = `
You are a viral social media strategist. Analyze this long-form video script and identify exactly ${count} compelling, standalone viral moments suitable for 30-60 second YouTube Shorts, TikTok, and Reels.

Long Video Script:
${JSON.stringify(script, null, 2)}

Return JSON array of:
[
  {
    "id": "short_1",
    "title": "Catchy Short Title",
    "hook": "Specific 3-second hook for this short",
    "startSceneNumber": 1,
    "endSceneNumber": 2,
    "durationSeconds": 30,
    "viralityRationale": "Why this specific moment will perform well on social feeds"
  }
]
`;

      const response = await this.client.models.generateContent({
        model: config.GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      return this.cleanAndParseJson(text) as ShortMomentSuggestion[];
    } catch (err: any) {
      console.warn('[GeminiDirector] extractShortMoments API failed, using fallback:', err.message);
      return [];
    }
  }

  private generateFallbackShortScript(options: CreateShortOptions): VideoScript {
    const sceneDuration = 5;
    const sceneCount = Math.max(2, Math.round(options.durationSeconds / sceneDuration));
    const scenes = [];

    for (let i = 1; i <= sceneCount; i++) {
      const startSec = (i - 1) * sceneDuration;
      const endSec = i * sceneDuration;
      scenes.push({
        sceneNumber: i,
        timestampStartSeconds: startSec,
        timestampEndSeconds: endSec,
        estimatedDurationSeconds: sceneDuration,
        title: `Scene ${i} — ${i === 1 ? 'Viral Hook' : 'Visual Revelation ' + i}`,
        narration: i === 1
          ? `Did you know this mind-blowing fact about ${options.idea.slice(0, 30)}?`
          : `Point number ${i}: Deep in this mystery lies an incredible phenomenon that scientists only recently uncovered.`,
        visualType: 'veo_generated' as const,
        veoPrompt: `Photorealistic 4k cinematic shot representing ${options.idea}, scene ${i}, dramatic lighting, rich textures, high-definition camera tracking`,
        cameraMotion: i % 2 === 0 ? 'Smooth drone orbit' : 'Cinematic dolly push-in',
        lightingAndAtmosphere: 'Moody atmospheric glow with volumetric ray tracing',
        visualConsistencyTokens: ['hyperrealistic', '4k_cinematic', 'high_contrast'],
      });
    }

    return {
      id: uuidv4(),
      title: `The Truth About ${options.idea.slice(0, 40)}`,
      concept: `High-retention breakdown of ${options.idea}`,
      targetAudience: 'Curious learners and social media explore feeds',
      style: options.style,
      platform: options.platform,
      aspectRatio: '9:16',
      targetDurationSeconds: options.durationSeconds,
      hook: {
        narration: `Did you know this about ${options.idea.slice(0, 25)}?`,
        visualHook: `Dramatic close-up opening frame of ${options.idea}`,
        durationSeconds: 3,
      },
      visualBible: {
        theme: `${options.style} Social Reel`,
        artStyle: 'Ultra-HD cinematic realism with high dynamic range',
        colorPalette: ['#111827', '#3B82F6', '#F59E0B', '#10B981'],
        lightingDirection: 'High-contrast studio rim lighting and soft key',
        characterDescriptions: { narrator: 'Engaging modern narrator / focal element' },
        settingAndEnvironment: 'Dynamic cinematic setting tailored to subject matter',
        prohibitedElements: ['blurry artifacts', 'low resolution', 'distorted text'],
      },
      chapters: [
        {
          chapterNumber: 1,
          title: 'Full Story',
          summary: 'Fast-paced progressive reveal',
          timestampStartSeconds: 0,
          timestampEndSeconds: options.durationSeconds,
          scenes,
        },
      ],
      callToAction: 'Follow for more incredible facts every single day!',
    };
  }

  private generateFallbackLongScript(options: CreateLongVideoOptions): VideoScript {
    const totalSeconds = options.durationMinutes * 60;
    const chapterCount = 4;
    const scenesPerChapter = 2;
    const totalScenes = chapterCount * scenesPerChapter;
    const sceneDuration = Math.round(totalSeconds / totalScenes);

    const chapters = [];
    let currentSceneNumber = 1;
    let currentTime = 0;

    const chapterTitles = [
      'The Genesis and Origin',
      'The Technological Breakthrough',
      'Unforeseen Challenges and Discovery',
      'The Future Paradigm and Beyond',
    ];

    for (let ch = 1; ch <= chapterCount; ch++) {
      const chapterScenes = [];
      const chStartTime = currentTime;

      for (let sc = 1; sc <= scenesPerChapter; sc++) {
        const scStartTime = currentTime;
        const scEndTime = currentTime + sceneDuration;
        currentTime = scEndTime;

        chapterScenes.push({
          sceneNumber: currentSceneNumber,
          timestampStartSeconds: scStartTime,
          timestampEndSeconds: scEndTime,
          estimatedDurationSeconds: sceneDuration,
          title: `Scene ${currentSceneNumber}: ${chapterTitles[ch - 1]} (Part ${sc})`,
          narration: `In this critical phase of ${options.idea}, researchers and historians discovered astonishing details that altered our fundamental understanding. Every discovery unlocked a profound new dimension.`,
          visualType: 'veo_generated' as const,
          veoPrompt: `Masterclass documentary visual for ${options.idea}: Chapter ${ch} Scene ${sc}. Majestic scale, detailed architecture, atmospheric natural lighting, 8k documentary cinematography`,
          cameraMotion: sc % 2 === 0 ? 'Wide aerial sweeping shot' : 'Slow cinematic slider dolly',
          lightingAndAtmosphere: 'Natural golden hour documentary illumination',
          visualConsistencyTokens: ['master_documentary', 'natural_lighting', 'historical_accuracy'],
        });
        currentSceneNumber++;
      }

      chapters.push({
        chapterNumber: ch,
        title: chapterTitles[ch - 1],
        summary: `Comprehensive exploration of ${chapterTitles[ch - 1]} in the context of ${options.idea}`,
        timestampStartSeconds: chStartTime,
        timestampEndSeconds: currentTime,
        scenes: chapterScenes,
      });
    }

    return {
      id: uuidv4(),
      title: `${options.idea}: The Complete Documentary`,
      concept: `An in-depth ${options.durationMinutes}-minute documentary investigation into ${options.idea}`,
      targetAudience: 'Documentary enthusiasts, history and science YouTube audiences',
      style: options.style,
      platform: 'youtube_long',
      aspectRatio: '16:9',
      targetDurationSeconds: totalSeconds,
      hook: {
        narration: `What if everything you thought you knew about ${options.idea.slice(0, 30)} was only half the story?`,
        visualHook: `Stunning 16:9 aerial panorama establishing the scale of ${options.idea}`,
        durationSeconds: 15,
      },
      visualBible: {
        theme: 'Historical & Educational Master Documentary',
        artStyle: 'Cinematic 8k realism with documentary color grade',
        colorPalette: ['#0F172A', '#1E293B', '#D97706', '#E2E8F0'],
        lightingDirection: 'Directional sunlight with natural atmospheric diffusion',
        characterDescriptions: { subject: 'Historical figures and authoritative experts' },
        settingAndEnvironment: 'Expansive historic and modern environments',
        prohibitedElements: ['anachronisms', 'cgi look', 'oversaturation'],
      },
      chapters,
      youtubePackage: {
        titles: [
          `${options.idea}: The Untold Story (Full Documentary)`,
          `How ${options.idea} Changed History Forever`,
          `The Real Truth Behind ${options.idea}`,
          `${options.idea} Explained in ${options.durationMinutes} Minutes`,
          `Inside the Mystery of ${options.idea}`,
        ],
        description: `Explore the complete story of ${options.idea} in this exhaustive ${options.durationMinutes}-minute documentary.\n\nTimestamps:\n0:00 - Introduction\n2:00 - The Genesis\n4:00 - The Discovery\n6:00 - Future Implications\n\nSubscribe for more deep dives!`,
        tags: ['documentary', 'history', 'science', 'education', 'viral_youtube'],
        chaptersText: '0:00 - Introduction\n2:00 - The Genesis\n4:00 - The Discovery\n6:00 - Future Implications',
        thumbnailConcept: `Dramatic split composition featuring key artifact from ${options.idea} bathed in golden sunlight with bold intriguing contrast`,
        thumbnailPrompt: `Cinematic YouTube thumbnail for documentary on ${options.idea}, dramatic high-contrast lighting, 8k resolution, photorealistic`,
        callToAction: 'If you enjoyed this documentary, subscribe and leave a comment with what topic we should cover next.',
      },
      callToAction: 'Subscribe for weekly deep-dive documentaries and hit the notification bell.',
    };
  }

  private cleanAndParseJson(raw: string): any {
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch (err: any) {
      console.error('[GeminiDirector] Failed to parse JSON response from Gemini:', raw);
      throw new Error(`Invalid JSON returned by Gemini: ${err.message}`);
    }
  }
}

export const geminiDirector = new GeminiDirector();

