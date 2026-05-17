import { GoogleGenAI } from "@google/genai";
import { Env } from "./env.config";

export const genAI = Env.GEMINI_API_KEY
	? new GoogleGenAI({ apiKey: Env.GEMINI_API_KEY })
	: null;
export const genAIModel = Env.GEMINI_MODEL;
