import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    // Get API credentials from headers
    const openApiKey = req.headers.get('x-openai-key');
    const openApiBaseUrl = req.headers.get('x-openai-base-url');
    const { text, voice, speed } = await req.json();
    console.log('Received TTS request:', text, voice, speed);

    if (!openApiKey || !openApiBaseUrl) {
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 401 });
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
    }, { signal: req.signal }); // Pass the abort signal to OpenAI client

    // Get the audio data as array buffer
    // This will also be aborted if the client cancels
    const arrayBuffer = await response.arrayBuffer();

    // Return audio data with appropriate headers
    return new NextResponse(arrayBuffer);
  } catch (error) {
    // Check if this was an abort error
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('TTS request aborted by client');
      return new Response(null, { status: 499 }); // Use 499 status for client closed request
    }

    console.error('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}