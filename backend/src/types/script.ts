import { z } from 'zod';

export const VideoStyleEnum = z.enum([
  'realistic',
  'cinematic',
  'documentary',
  'educational',
  'storytelling',
  'simple',
]);
export type VideoStyle = z.infer<typeof VideoStyleEnum>;

export const PlatformEnum = z.enum([
  'youtube_shorts',
  'instagram_reels',
  'tiktok',
  'facebook_reels',
  'youtube_long',
]);
export type Platform = z.infer<typeof PlatformEnum>;

export const AspectRatioEnum = z.enum(['9:16', '16:9', '1:1']);
export type AspectRatio = z.infer<typeof AspectRatioEnum>;

export const SceneVisualTypeEnum = z.enum([
  'veo_generated',
  'b_roll_generated',
  'visual_transition',
]);
export type SceneVisualType = z.infer<typeof SceneVisualTypeEnum>;

export const SceneSchema = z.object({
  sceneNumber: z.number(),
  timestampStartSeconds: z.number(),
  timestampEndSeconds: z.number(),
  estimatedDurationSeconds: z.number(),
  title: z.string(),
  narration: z.string(),
  visualType: SceneVisualTypeEnum.default('veo_generated'),
  veoPrompt: z.string().describe('Highly descriptive visual prompt for Veo 3.1 video generation'),
  cameraMotion: z.string().describe('e.g. slow pan, cinematic dolly in, drone aerial shot'),
  lightingAndAtmosphere: z.string().describe('e.g. golden hour, dramatic studio lighting, neon noir'),
  visualConsistencyTokens: z.array(z.string()).describe('Recurring visual tags ensuring stylistic alignment'),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ChapterSchema = z.object({
  chapterNumber: z.number(),
  title: z.string(),
  summary: z.string(),
  timestampStartSeconds: z.number(),
  timestampEndSeconds: z.number(),
  scenes: z.array(SceneSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const VisualBibleSchema = z.object({
  theme: z.string(),
  artStyle: z.string(),
  colorPalette: z.array(z.string()),
  lightingDirection: z.string(),
  characterDescriptions: z.record(z.string()).optional(),
  settingAndEnvironment: z.string(),
  prohibitedElements: z.array(z.string()).optional(),
});
export type VisualBible = z.infer<typeof VisualBibleSchema>;

export const YouTubePackageSchema = z.object({
  titles: z.array(z.string()),
  description: z.string(),
  tags: z.array(z.string()),
  chaptersText: z.string(),
  thumbnailConcept: z.string(),
  thumbnailPrompt: z.string(),
  callToAction: z.string(),
});
export type YouTubePackage = z.infer<typeof YouTubePackageSchema>;

export const VideoScriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  concept: z.string(),
  targetAudience: z.string(),
  style: VideoStyleEnum,
  platform: PlatformEnum,
  aspectRatio: AspectRatioEnum,
  targetDurationSeconds: z.number(),
  hook: z.object({
    narration: z.string(),
    visualHook: z.string(),
    durationSeconds: z.number(),
  }),
  visualBible: VisualBibleSchema,
  chapters: z.array(ChapterSchema),
  youtubePackage: YouTubePackageSchema.optional(),
  callToAction: z.string(),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;
