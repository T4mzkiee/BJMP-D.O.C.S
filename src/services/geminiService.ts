import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const analyzeDocument = async (title: string, description: string): Promise<{ summary: string; priority: 'Simple Transaction' | 'Complex Transaction' | 'Highly Technical Transaction' }> => {
  if (!ai) {
    console.warn("No API Key found. Returning mock AI response.");
    return {
      summary: "AI Analysis unavailable (Missing API Key). This is a placeholder summary.",
      priority: 'Simple Transaction'
    };
  }

  try {
    const prompt = `
      Analyze the following document information:
      Title: ${title}
      Description: ${description}

      Provide a short professional summary (max 20 words) and classify the document transaction type (Simple Transaction, Complex Transaction, Highly Technical Transaction) based on complexity implied.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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