
import { GoogleGenAI, Type } from "@google/genai";

// Fixed to follow coding guidelines: 
// 1. Initialize GoogleGenAI inside the function right before use to ensure up-to-date API key.
// 2. Use recommended model 'gemini-3-flash-preview' for basic text tasks (summarization/classification).
// 3. Access process.env.API_KEY directly for initialization.
export const analyzeDocument = async (title: string, description: string): Promise<{ summary: string; priority: 'Simple Transaction' | 'Complex Transaction' | 'Highly Technical Transaction' }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API Key found. Returning mock AI response.");
    return {
      summary: "AI Analysis unavailable (Missing API Key). This is a placeholder summary.",
      priority: 'Simple Transaction'
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `
      Analyze the following document information:
      Title: ${title}
      Description: ${description}

      Provide a short professional summary (max 20 words) and classify the document transaction type (Simple Transaction, Complex Transaction, Highly Technical Transaction) based on complexity implied.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['Simple Transaction', 'Complex Transaction', 'Highly Technical Transaction'] }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);

  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      summary: "Failed to generate AI summary.",
      priority: 'Simple Transaction'
    };
  }
};
