import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: In a real environment, ensure process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const refinePrompts = async (prompts: string[]): Promise<string[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key is missing. Returning original prompts.");
    return prompts;
  }

  try {
    const formattedList = prompts.map((p, i) => `PROMPT ${i + 1}:\n${p}`).join('\n---\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert Medical Monitor Assistant. 
      I have a list of prompts used for auditing clinical trial documents.
      Please refine these prompts to be more precise, professional, and effective for an LLM (Large Language Model) context.
      Maintain the original intent strictly.
      
      Return ONLY the refined prompts as a JSON string array. Do not add markdown formatting to the output (no \`\`\`json).
      
      Input Prompts:
      ${formattedList}`,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return prompts;
    
    const refined = JSON.parse(text);
    return Array.isArray(refined) ? refined : prompts;
  } catch (error) {
    console.error("Gemini refinement failed:", error);
    return prompts;
  }
};