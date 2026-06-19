// api/index.js - This is the translator for your proxy
export default async function handler(req, res) {
  // Allow only POST requests (OpenAI uses POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get the request body from n8n
    const { model, messages, temperature, max_tokens } = req.body;

    // Your Google Gemini API key (from environment variables)
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    // Convert OpenAI-style messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Call Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: temperature || 0.7,
            maxOutputTokens: max_tokens || 1024,
          },
        }),
      }
    );

    const data = await response.json();
    
    // Convert Gemini response back to OpenAI format
    const openAIResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini'
        }
      }]
    };

    res.status(200).json(openAIResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
