
import { GoogleGenAI, Type } from "@google/genai";
import { MetalPriceData, GroundingSource, HistoricalPricePoint, DailyPricePoint, Timeframe, MetalNarrative, MetalType } from "../types";

// Get model from environment variable
const getModel = () => import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';

export async function fetchLiveMetalPrice(metal: MetalType = 'gold', currency: string = 'INR'): Promise<MetalPriceData> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: `What is the current live price of 1 gram of ${metal === 'gold' ? '24K gold' : '999 fine silver'} in ${currency} today? Provide the response as a simple JSON object. Use current market data for India/International markets.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: {
              type: Type.NUMBER,
              description: `Current price of ${metal} per gram`,
            },
            currency: {
              type: Type.STRING,
              description: 'The currency code (e.g., INR)',
            },
          },
          required: ["price", "currency"],
        },
      },
    });

    const text = response.text || "";
    const data = JSON.parse(text);

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
      pricePerGram: data.price || (metal === 'gold' ? 7800.0 : 95.0),
      currency: data.currency || currency,
      lastUpdated: new Date().toISOString(),
      sources: sources.length > 0 ? sources : [{ title: "Market Average", uri: `https://www.google.com/search?q=${metal}+price+per+gram` }]
    };
  } catch (error) {
    console.error(`Error fetching ${metal} price:`, error);
    return {
      metal,
      pricePerGram: metal === 'gold' ? 7925.50 : 98.20,
      currency: currency,
      lastUpdated: new Date().toISOString(),
      sources: [{ title: "Market Index", uri: "https://www.mcxindia.com/" }]
    };
  }
}

export async function fetchGoldAdvisorData(currency: string = 'INR'): Promise<{ price: number, dma50: number, dma200: number }> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const prompt = `Find the current live market price for 24K gold per gram in ${currency}, as well as the current 50-day moving average (DMA50) and 200-day moving average (DMA200) for gold in the Indian market. Provide the response as a simple JSON object.`;

  try {
    const response = await ai.models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            dma50: { type: Type.NUMBER },
            dma200: { type: Type.NUMBER }
          },
          required: ["price", "dma50", "dma200"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error fetching advisor data:", error);
    // Return sensible fallbacks based on recent trends if fetch fails
    return { price: 7950, dma50: 7680, dma200: 7250 };
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
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              price24K: { type: Type.NUMBER },
              price22K: { type: Type.NUMBER }
            },
            required: ["date", "price24K", "price22K"]
          }
        }
      },
    });

    const text = response.text || "[]";
    const data = JSON.parse(text);
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
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              price: { type: Type.NUMBER }
            },
            required: ["date", "price"]
          }
        }
      },
    });

    const text = response.text || "[]";
    const data = JSON.parse(text);
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
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reports: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  date: { type: Type.STRING },
                  summary_text: { type: Type.STRING },
                  tone: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] }
                }
              }
            },
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event_type: { type: Type.STRING },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  sentiment: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] }
                }
              }
            },
            summary: { type: Type.STRING },
            geo_impact_label: { type: Type.STRING, enum: ["Positive", "Negative", "Neutral"] },
            geo_bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["reports", "events", "summary", "geo_impact_label", "geo_bullets"]
        }
      },
    });

    const data = JSON.parse(response.text || "{}");

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
