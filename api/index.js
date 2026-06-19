// api/index.js - Simple, working Gemini proxy for n8n
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method Not Allowed. Please use POST requests.',
      tip: 'In n8n, use the "OpenAI" node with this proxy URL'
    });
  }

  try {
    // Get the request body
    const body = req.body;
    
    // Extract OpenAI-style data
    const { model, messages, temperature, max_tokens } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Missing "messages" array in request body' 
      });
    }

    // Get Gemini API key from environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: Missing Gemini API key',
        fix: 'Add GEMINI_API_KEY in Vercel → Settings → Environment Variables'
      });
    }

    // Convert OpenAI messages to Gemini format
    const geminiContents = messages.map(msg => {
      let role = 'user';
      if (msg.role === 'assistant') role = 'model';
      if (msg.role === 'system') role = 'user'; // Gemini doesn't have system role
      
      return {
        role: role,
        parts: [{ text: msg.content }]
      };
    });

    // Determine which Gemini model to use
    const geminiModel = model || 'gemini-1.5-flash';
    // Only use specific Gemini models
    const validModels = ['gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];
    const finalModel = validModels.includes(geminiModel) ? geminiModel : 'gemini-1.5-flash';

    console.log(`Using model: ${finalModel}`);

    // Call Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${finalModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: temperature || 0.7,
            maxOutputTokens: max_tokens || 1024,
          },
        }),
      }
    );

    const data = await response.json();

    // Check for Gemini API errors
    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(400).json({
        error: data.error.message || 'Gemini API error',
        details: data.error
      });
    }

    // Extract the response text
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Format response to look like OpenAI
    const openAIResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: generatedText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    res.status(200).json(openAIResponse);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
