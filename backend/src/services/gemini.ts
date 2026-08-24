import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../config/env.js';
import { providerConcurrency } from './providerConcurrency.js';

export const ScenePlanSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(5),
  purpose: z.string().min(1),
  visualType: z.enum(['premium_veo', 'b_roll', 'static_motion', 'text_overlay']).default('premium_veo'),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export const ChapterPlanSchema = z.object({
  title: z.string().min(1),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  scenes: z.array(ScenePlanSchema).min(1),
});
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;

export const VideoPlanSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  targetAudience: z.string().min(1),
  durationSeconds: z.number().positive(),
  chapters: z.array(ChapterPlanSchema).min(1),
  ending: z.string().min(1),
  cta: z.string().min(1),
});
export type VideoPlan = z.infer<typeof VideoPlanSchema>;

export interface GeneratePlanInput {
  topic: string;
  videoType: 'short' | 'long';
  durationMinutes?: number;
  durationSeconds?: number;
  style: 'realistic' | 'cinematic' | 'documentary' | 'educational' | 'storytelling' | 'simple';
  customInstructions?: string;
}

export class GeminiService {
  private clientInstance: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'MISSING_CREDENTIALS: GEMINI_API_KEY is not set. Please add a valid Google Gemini API Key to your .env file or environment.'
      );
    }
    if (!this.clientInstance) {
      this.clientInstance = new GoogleGenAI({ apiKey });
    }
    return this.clientInstance;
  }

  /**
   * Generates a structured video plan with strict schema validation and semaphore concurrency.
   */
  public async generateVideoPlan(input: GeneratePlanInput, maxRetries = 2): Promise<VideoPlan> {
    return providerConcurrency.gemini.run(async () => {
      console.log(`[GeminiService] Request started: generating ${input.videoType} plan for topic="${input.topic}" (${input.style})`);

      const client = this.getClient();
    const durationSec =
      input.videoType === 'long'
        ? (input.durationMinutes || 8) * 60
        : input.durationSeconds || 30;

    const chapterCount = input.videoType === 'long' ? Math.max(3, Math.round(durationSec / 120)) : 1;
    const scenesPerChapter = input.videoType === 'long' ? 2 : Math.max(2, Math.round(durationSec / 6));

    const systemInstruction = `
You are the AI Director for an automated video generation pipeline.
You must generate a structured JSON video plan according to the user's specification.

Strict JSON format rules:
- No conversational text or introductory sentences outside JSON.
- Output valid JSON only.
- Duration must match ${durationSec} seconds total.
- For every scene, provide:
  - "sceneNumber": integer starting from 1
  - "durationSeconds": number of seconds for this shot
  - "narration": natural spoken voiceover text
  - "visualPrompt": highly descriptive prompt for Veo 3.1 video generation describing lighting, camera motion, subjects, and cinematography
  - "purpose": scene intent (e.g., "Hook", "Establish context", "Core revelation", "Climax", "Conclusion")
`;

    const userPrompt = `
Generate a complete video plan:
- Topic: "${input.topic}"
- Video Type: "${input.videoType}"
- Total Duration: ${durationSec} seconds
- Visual Style: "${input.style}"
${input.customInstructions ? `- Custom Instructions: "${input.customInstructions}"` : ''}
- Target Chapter Count: ${chapterCount}
- Scenes Per Chapter: ${scenesPerChapter}

Expected JSON Schema:
{
  "title": "Title of the Video",
  "hook": "Spoken hook in the first seconds",
  "targetAudience": "Target audience description",
  "durationSeconds": ${durationSec},
  "chapters": [
    {
      "title": "Chapter Title",
      "startTime": 0,
      "endTime": ${Math.round(durationSec / chapterCount)},
      "scenes": [
        {
          "sceneNumber": 1,
          "durationSeconds": ${Math.round(durationSec / (chapterCount * scenesPerChapter))},
          "narration": "Voiceover line for scene 1",
          "visualPrompt": "Veo 3.1 cinematic prompt for scene 1",
          "purpose": "Hook"
        }
      ]
    }
  ],
  "ending": "Closing thoughts/summary",
  "cta": "Call to action"
}
`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`[GeminiService] Calling Gemini API (attempt ${attempt}/${maxRetries + 1})...`);
        const response = await client.models.generateContent({
          model: config.GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        console.log(`[GeminiService] Response received from Gemini model ${config.GEMINI_MODEL}`);
        const text = response.text || '';
        const parsed = this.parseAndValidate(text, durationSec);
        return parsed;
      } catch (err: any) {
          lastError = err;
          console.error(`[GeminiService] Attempt ${attempt} failed:`, err.message);
          if (err.message?.includes('MISSING_CREDENTIALS')) {
            throw err;
          }
        }
      }

      throw new Error(`Failed to generate valid video plan from Gemini after retries: ${lastError?.message}`);
    });
  }

  private parseAndValidate(rawText: string, expectedDurationSeconds: number): VideoPlan {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let json: any;
    try {
      json = JSON.parse(cleaned);
    } catch (err: any) {
      throw new Error(`Invalid JSON output from model: ${err.message}`);
    }

    // Force duration accuracy if slightly miscalculated by model
    if (!json.durationSeconds) {
      json.durationSeconds = expectedDurationSeconds;
    }

    const validated = VideoPlanSchema.parse(json);
    return validated;
  }
}

export const geminiService = new GeminiService();
