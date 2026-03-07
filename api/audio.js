import OpenAI from 'openai';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return res.status(500).json({ error: 'OpenAI API key is not configured' });
    }

    // Parse request body - Vercel automatically parses JSON, but handle both cases
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    }
    
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const { text, voice = 'alloy' } = body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    });

    // Convert the response to a buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Set appropriate headers for audio response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error generating audio:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to generate audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

