import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    // Get API credentials from headers or fall back to environment variables
    const openApiKey = req.headers.get('x-openai-key') || process.env.API_KEY || 'none';
    const openApiBaseUrl = req.headers.get('x-openai-base-url') || process.env.API_BASE;
    const { text, voice, speed } = await req.json();
    console.log('Received TTS request:', text, voice, speed);

    if (!openApiKey) {
      return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 401 });
    }

    if (!text || !voice || !speed) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Initialize OpenAI client with abort signal
    const openai = new OpenAI({
      apiKey: openApiKey,
      baseURL: openApiBaseUrl,
    });

    // Request audio from OpenAI and pass along the abort signal
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice as "alloy",
      input: text,
      speed: speed,
      response_format: 'mp3',  // Always use mp3 since we convert to WAV later if needed
    }, { signal: req.signal });

    // Get the audio data as array buffer
    const stream = response.body;

    // Return audio data with appropriate headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });
  } catch (error) {
    // Check if this was an abort error
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('TTS request aborted by client');
      return new NextResponse(null, { status: 499 }); // Use 499 status for client closed request
    }

    console.error('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}