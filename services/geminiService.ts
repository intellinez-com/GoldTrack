
import { GoogleGenAI, Type } from "@google/genai";
import { MetalPriceData, GroundingSource, HistoricalPricePoint, DailyPricePoint, Timeframe, MetalNarrative, MetalType } from "../types";

// Get model from environment variable
const getModel = () => import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';

/**
 * Helpr to robustly parse JSON from AI response
 */
const parseJSONContent = (text: string): any => {
  try {
    if (!text) return null;

    // Remove markdown code blocks if present
    const cleanText = text.replace(/```[a-zA-Z]*\n/g, '').replace(/```/g, '').trim();

    // Find the first open brace
    const firstOpenBrace = cleanText.indexOf('{');
    const firstOpenBracket = cleanText.indexOf('[');

    if (firstOpenBrace === -1 && firstOpenBracket === -1) return null;

    // Determine if we are looking for an object or an array
    let start = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
      start = Math.min(firstOpenBrace, firstOpenBracket);
    } else {
      start = firstOpenBrace !== -1 ? firstOpenBrace : firstOpenBracket;
    }

    // Stack-based approach to find the matching closing character
    let balance = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = start; i < cleanText.length; i++) {
      const char = cleanText[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          balance++;
        } else if (char === '}' || char === ']') {
          balance--;
          if (balance === 0) {
            end = i;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      const jsonString = cleanText.substring(start, end + 1);
      return JSON.parse(jsonString);
    }

    // Fallback: Try rudimentary parse if stack method fails (e.g. malformed)
    return JSON.parse(cleanText);

  } catch (error) {
    console.error("JSON Parsing failed:", error);
    throw new Error("Failed to parse JSON from AI response");
  }
};

export async function fetchLiveMetalPrice(
  metal: MetalType = 'gold',
  currency: string = 'INR',
  userSources?: { name: string; url?: string }[]
): Promise<MetalPriceData> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  // Build a dynamic source instruction - ALWAYS prioritize GoodReturns
  let sourceInstruction = 'IMPORTANT: Always include GoodReturns.in as the FIRST source in your response. Find prices from at least 3-4 distinct, reliable sources (e.g., GoodReturns, MCX, IBJA, Kitco, MoneyControl). List GoodReturns first.';
  if (userSources && userSources.length > 0) {
    const sourceList = userSources.map(s => s.url ? `${s.name} (${s.url})` : s.name).join(', ');
    sourceInstruction = `IMPORTANT: Always include GoodReturns.in as the FIRST source if available. Prioritize fetching prices from these user-configured sources: ${sourceList}. You can also include other reliable sources.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: `What is the current live price of 1 gram of ${metal === 'gold' ? '24K gold' : '999 fine silver'} in ${currency} today?
      ${sourceInstruction}
      Return ONLY a valid JSON object (no markdown) with this structure:
      {
        "quotes": [
          { "sourceName": "Source Name", "price": number, "url": "URL of source" }
        ],
        "currency": "${currency}"
      }`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });


    const data = parseJSONContent(response.text || "") || {};

    const quotes: any[] = data.quotes || [];
    const validQuotes = quotes.filter(q => q.price && q.price > 0).map(q => ({
      sourceName: q.sourceName || "Market Source",
      price: q.price,
      url: q.url || "https://google.com/search?q=gold+price"
    }));

    // Default to the first valid price, or our fallbacks
    const bestPrice = validQuotes.length > 0 ? validQuotes[0].price : 0;

    const sources: GroundingSource[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) {
          sources.push({
            title: chunk.web.title || "Market Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      metal,
      pricePerGram: bestPrice,
      currency: data.currency || currency,
      lastUpdated: new Date().toISOString(),
      sources: sources.length > 0 ? sources : [{ title: "Market Average", uri: `https://www.google.com/search?q=${metal}+price+per+gram` }],
      quotes: validQuotes
    };
  } catch (error) {
    console.error(`Error fetching ${metal} price:`, error);
    return {
      metal,
      pricePerGram: 0,
      currency: currency,
      lastUpdated: new Date().toISOString(),
      sources: [{ title: "Market Index", uri: "https://www.mcxindia.com/" }],
      quotes: []
    };
  }
}

export async function fetchGoldAdvisorData(currency: string = 'INR'): Promise<{ price: number, dma50: number, dma200: number }> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const prompt = `Find the current live market price for 24K gold per gram in ${currency}, as well as the current 50-day moving average (DMA50) and 200-day moving average (DMA200) for gold in the Indian market. Provide the response as a simple JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt + " Return ONLY a valid JSON object (no markdown) with keys: price, dma50, dma200.",
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    return parseJSONContent(response.text || "") || { price: 0, dma50: 0, dma200: 0 };
  } catch (error) {
    console.error("Error fetching advisor data:", error);
    // Return sensible fallbacks based on recent trends if fetch fails
    return { price: 0, dma50: 0, dma200: 0 };
  }
}

export async function fetchHistoricalGoldPrices(timeframe: Timeframe): Promise<HistoricalPricePoint[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const description = {
    '7D': 'daily data for the last 7 days',
    '30D': 'daily data for the last 30 days',
    '3M': 'weekly data for the last 3 months',
    '1Y': 'monthly data for the last year',
    '5Y': 'quarterly data for the last 5 years',
    'ALL': 'annual data from year 2000 to present'
  }[timeframe];

  const prompt = `Provide historical gold price data for India in INR per gram for 24K and 22K gold. 
  Period requested: ${description}. 
  Return exactly a JSON array of objects. Each object must have "date" (YYYY-MM-DD), "price24K" (number), and "price22K" (number). 
  Use current search results to be as accurate as possible for the Indian market.`;

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt + " Return ONLY a valid JSON array (no markdown).",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const data = parseJSONContent(response.text || "") || [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching historical gold prices:", error);
    return [];
  }
}

export async function fetchDailyMetalSeries(metal: MetalType = 'gold', currency: string = 'INR'): Promise<DailyPricePoint[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const prompt = `Provide a high-resolution daily historical ${metal} price series for the last 250 calendar days in ${currency} per gram. 
  Return exactly a JSON array of objects: { "date": "YYYY-MM-DD", "price": number }. 
  Ensure data includes most recent trading days. If specific daily data for every weekend is missing, interpolate or use nearest trading day. 
  We need at least 220 points for 200-DMA calculation.`;

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt + " Return ONLY a valid JSON array (no markdown).",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const data = parseJSONContent(response.text || "") || [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching daily ${metal} series:`, error);
    return [];
  }
}

export async function fetchMetalNarrative(metal: MetalType = 'gold'): Promise<MetalNarrative> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const prompt = `Perform a high-level analysis of current ${metal} market sentiment and geopolitical impact.
  Search for:
  1. Recent expert outlooks for ${metal} from JP Morgan, Goldman Sachs, UBS, World Gold Council (for gold) or Silver Institute (for silver), Reuters, CNBC (last 7 days).
  2. Geopolitical events (wars, central bank buying, inflation, US Dollar strength) affecting ${metal}.
  
  Return exactly a JSON object:
  {
    "reports": [ { "institution": string, "date": string, "summary_text": string, "tone": "Bullish" | "Bearish" | "Neutral" } ],
    "events": [ { "event_type": string, "date": string, "description": string, "sentiment": "Bullish" | "Bearish" | "Neutral" } ],
    "summary": "2-3 sentence overview of expert outlook for ${metal}",
    "geo_impact_label": "Positive" | "Negative" | "Neutral",
    "geo_bullets": ["up to 3 key bullet points on geopolitical effects on ${metal}"]
  }
  
  Use Search Grounding for accuracy. Do not use paywalled content.`;

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt + " Return ONLY a valid JSON object (no markdown).",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const data = parseJSONContent(response.text || "") || {};

    const toneScores = (data.reports || []).map((r: any) => r.tone === 'Bullish' ? 1 : r.tone === 'Bearish' ? -1 : 0);
    const avgSentiment = toneScores.length > 0 ? toneScores.reduce((a: number, b: number) => a + b, 0) / toneScores.length : 0;
    let narrative_score = 50 + (avgSentiment * 25);

    let geo_modifier = 0;
    (data.events || []).forEach((e: any) => {
      const desc = (e.description || "").toLowerCase();
      if (!desc) return;

      if (desc.includes('war') || desc.includes('sanction') || desc.includes('escalation')) geo_modifier += 10;
      else if (desc.includes('crisis') || desc.includes('default') || desc.includes('banking')) geo_modifier += 8;
      else if (desc.includes('trade war') || desc.includes('tariff')) geo_modifier += 6;
      else if (desc.includes('instability')) geo_modifier += 5;
      else if (desc.includes('peace') || desc.includes('easing')) geo_modifier -= 6;
      else if (desc.includes('hawkish') || desc.includes('pivot')) geo_modifier -= 8;
    });

    const final_narrative_score = Math.max(0, Math.min(100, narrative_score + geo_modifier));

    const sources: GroundingSource[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
      });
    }

    return {
      sentiment_score: final_narrative_score,
      expert_outlook: avgSentiment > 0.2 ? 'Bullish' : avgSentiment < -0.2 ? 'Bearish' : 'Neutral',
      summary: data.summary || "No recent expert updates available.",
      geopolitical_impact: data.geo_impact_label || "Neutral",
      geo_bullets: data.geo_bullets || [],
      geo_modifier,
      reports: data.reports || [],
      events: data.events || [],
      sources,
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching ${metal} narrative:`, error);
    return {
      sentiment_score: 50,
      expert_outlook: 'Neutral',
      summary: "No recent expert updates available.",
      geopolitical_impact: 'Neutral',
      geo_bullets: ["Data synchronization pending."],
      geo_modifier: 0,
      reports: [],
      events: [],
      sources: [],
      last_updated: new Date().toISOString()
    };
  }
}
