// api/index.js - Working Gemini Proxy
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method Not Allowed. Please use POST requests.',
      tip: 'In n8n, use the "OpenAI" node with this proxy URL'
    });
  }

  try {
    // Get the request body from n8n
    const { model, messages, temperature, max_tokens } = req.body;

    // Get API key from environment variable OR from request
    let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    // If not in environment, try to get it from the Authorization header
    if (!GEMINI_API_KEY) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        GEMINI_API_KEY = authHeader.substring(7);
      }
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing GEMINI_API_KEY. Set it in Vercel environment variables or send it in the Authorization header.'
      });
    }

    // Convert OpenAI messages to Gemini format
    const geminiContents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Use the model requested, or default to gemini-2.0-flash-exp
    const modelName = model || 'gemini-2.0-flash-exp';

    // Call Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
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

    // Check for errors from Gemini
    if (data.error) {
      console.error('Gemini API error:', data.error);
      return res.status(400).json({
        error: data.error.message || 'Gemini API error'
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
        }
      }]
    };

    res.status(200).json(openAIResponse);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}
