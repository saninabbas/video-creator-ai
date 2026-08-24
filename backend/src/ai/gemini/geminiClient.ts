import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/env.js';

let clientInstance: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.warn('[GeminiClient] WARNING: GEMINI_API_KEY is not set in environment or .env file.');
    }
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}
