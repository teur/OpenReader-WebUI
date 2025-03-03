import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    // Get API credentials from headers or fall back to environment variables
    const openApiKey = req.headers.get('x-openai-key') || process.env.API_KEY || 'none';
    const openApiBaseUrl = req.headers.get('x-openai-base-url') || process.env.API_BASE;
    const { text, voice, speed, format } = await req.json();
    console.log('Received TTS request:', text, voice, speed, format);

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
      response_format: format === 'aac' ? 'aac' : 'mp3',
    }, { signal: req.signal }); // Pass the abort signal to OpenAI client

    // Get the audio data as array buffer
    // This will also be aborted if the client cancels
    const stream = response.body;

    // Return audio data with appropriate headers
    const contentType = format === 'aac' ? 'audio/aac' : 'audio/mpeg';
    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType
      }
    });
  } catch (error) {
    // Check if this was an abort error
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('TTS request aborted by client');
      return new NextResponse(null, { status: 499 }); // Use 499 status for client closed request
    }

    console.warn('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}