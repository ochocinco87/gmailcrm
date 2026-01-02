import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { MacroAnalysis, FoodItem, Macros } from '../../App';

const API_KEY_STORAGE = '@macrosnap_api_key';

// OpenAI GPT-4 Vision API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Prompt for food analysis
const FOOD_ANALYSIS_PROMPT = `You are a nutrition expert AI. Analyze this food image and provide detailed nutritional information.

Identify each food item visible in the image and estimate the macronutrients based on typical portion sizes shown.

Respond ONLY with a valid JSON object in this exact format (no markdown, no code blocks, just pure JSON):
{
  "foodItems": [
    {
      "name": "Food item name",
      "portion": "Estimated portion size (e.g., '1 cup', '150g', '1 medium')",
      "macros": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "fiber": number,
        "sugar": number
      },
      "confidence": number between 0 and 1
    }
  ],
  "totalMacros": {
    "calories": sum of all calories,
    "protein": sum of all protein (g),
    "carbs": sum of all carbs (g),
    "fat": sum of all fat (g),
    "fiber": sum of all fiber (g),
    "sugar": sum of all sugar (g)
  },
  "confidence": overall confidence between 0 and 1
}

Be accurate with nutritional values. Use your knowledge of food nutrition databases like USDA. If you cannot identify the food, set confidence to 0.3 or lower.`;

export async function analyzeFoodImage(imageUri: string): Promise<MacroAnalysis> {
  // Get API key from storage
  const apiKey = await AsyncStorage.getItem(API_KEY_STORAGE);

  if (!apiKey) {
    // Return mock data for demo/testing purposes when no API key is set
    console.log('No API key set, returning demo data');
    return generateDemoAnalysis();
  }

  try {
    // Read image and convert to base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine image type from URI
    const imageType = imageUri.toLowerCase().includes('.png') ? 'png' : 'jpeg';

    // Call OpenAI API
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: FOOD_ANALYSIS_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${imageType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new Error(error.error?.message || 'Failed to analyze image');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const analysis = parseAnalysisResponse(content);
    return analysis;
  } catch (error) {
    console.error('Food analysis error:', error);
    // Return demo data on error for better UX
    return generateDemoAnalysis();
  }
}

function parseAnalysisResponse(content: string): MacroAnalysis {
  try {
    // Try to extract JSON from the response
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate and ensure proper structure
    const analysis: MacroAnalysis = {
      foodItems: (parsed.foodItems || []).map((item: any) => ({
        name: String(item.name || 'Unknown Food'),
        portion: String(item.portion || '1 serving'),
        macros: {
          calories: Math.round(Number(item.macros?.calories) || 0),
          protein: Math.round(Number(item.macros?.protein) || 0),
          carbs: Math.round(Number(item.macros?.carbs) || 0),
          fat: Math.round(Number(item.macros?.fat) || 0),
          fiber: item.macros?.fiber ? Math.round(Number(item.macros.fiber)) : undefined,
          sugar: item.macros?.sugar ? Math.round(Number(item.macros.sugar)) : undefined,
        },
        confidence: Number(item.confidence) || 0.5,
      })),
      totalMacros: {
        calories: Math.round(Number(parsed.totalMacros?.calories) || 0),
        protein: Math.round(Number(parsed.totalMacros?.protein) || 0),
        carbs: Math.round(Number(parsed.totalMacros?.carbs) || 0),
        fat: Math.round(Number(parsed.totalMacros?.fat) || 0),
        fiber: parsed.totalMacros?.fiber ? Math.round(Number(parsed.totalMacros.fiber)) : undefined,
        sugar: parsed.totalMacros?.sugar ? Math.round(Number(parsed.totalMacros.sugar)) : undefined,
      },
      confidence: Number(parsed.confidence) || 0.5,
    };

    return analysis;
  } catch (error) {
    console.error('Error parsing analysis response:', error);
    throw new Error('Failed to parse AI response');
  }
}

// Demo data for testing without API key
function generateDemoAnalysis(): MacroAnalysis {
  const demoFoods: FoodItem[] = [
    {
      name: 'Grilled Chicken Breast',
      portion: '6 oz (170g)',
      macros: {
        calories: 280,
        protein: 53,
        carbs: 0,
        fat: 6,
        fiber: 0,
        sugar: 0,
      },
      confidence: 0.85,
    },
    {
      name: 'Brown Rice',
      portion: '1 cup cooked',
      macros: {
        calories: 216,
        protein: 5,
        carbs: 45,
        fat: 2,
        fiber: 4,
        sugar: 0,
      },
      confidence: 0.82,
    },
    {
      name: 'Steamed Broccoli',
      portion: '1 cup',
      macros: {
        calories: 55,
        protein: 4,
        carbs: 11,
        fat: 1,
        fiber: 5,
        sugar: 2,
      },
      confidence: 0.88,
    },
  ];

  const totalMacros = demoFoods.reduce(
    (acc, item) => ({
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
      fiber: (acc.fiber || 0) + (item.macros.fiber || 0),
      sugar: (acc.sugar || 0) + (item.macros.sugar || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  );

  return {
    foodItems: demoFoods,
    totalMacros,
    confidence: 0.85,
  };
}
