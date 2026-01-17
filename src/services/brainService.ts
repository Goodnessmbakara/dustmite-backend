import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
const modelId = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Initialize the model
const model = genAI.getGenerativeModel({ 
  model: modelId,
  generationConfig: {
    responseMimeType: "application/json"
  }
});

interface BrainDecision {
  action: 'BUY' | 'HOLD';
  reason: string;
}

export class BrainService {
  /**
   * Analyzes market conditions and asks Gemini for a decision.
   * 
   * @param currentApy The current yield APY (e.g. 5.5)
   * @param gasCost The estimated gas cost in USD (e.g. 0.05)
   * @returns A promise resolving to the decision (BUY or HOLD) and the reason.
   */
  static async analyzeMarket(currentApy: number, gasCost: number): Promise<BrainDecision> {
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set, defaulting to HOLD');
      return { action: 'HOLD', reason: 'Missing API Key' };
    }

    // Determine simplified sentiment based on APY (mock logic for the prompt context)
    // In a real app, this might come from news analysis.
    const sentiment = currentApy > 6.0 ? "Optimistic" : "Cautious";

    const prompt = `You are a risk-averse treasury manager. 
Current APY is ${currentApy}%. 
Gas cost is $${gasCost}. 
Market sentiment is ${sentiment}. 
Should I move funds? 
Respond JSON: { "action": "BUY"|"HOLD", "reason": "..." }`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const decision = JSON.parse(text) as BrainDecision;
      
      // Validation to ensure strictly BUY or HOLD
      if (decision.action !== 'BUY' && decision.action !== 'HOLD') {
        console.warn(`Brain returned invalid action: ${decision.action}. Defaulting to HOLD.`);
        return { action: 'HOLD', reason: 'Invalid AI response' };
      }

      return decision;
    } catch (error) {
      console.error('BrainService Error:', error);
      return { action: 'HOLD', reason: `AI Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Explains a past interaction or generic questions based on logs.
   * This corresponds to the /agent/chat requirement.
   */
  static async explainDifference(logsContext: string, userQuestion: string): Promise<string> {
      const chatModel = genAI.getGenerativeModel({ model: modelId }); // Default text response
      const prompt = `
      Context: Here are my last few investment decisions:
      ${logsContext}

      User Question: "${userQuestion}"

      Please explain your reasoning to the user based on the context provided.
      `;
      
      try {
        const result = await chatModel.generateContent(prompt);
        return result.response.text();
      } catch (error) {
         console.error('BrainChat Error:', error);
         return "I'm having trouble retrieving my memory right now.";
      }
  }
}
