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

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openApiKey,
      baseURL: openApiBaseUrl,
    });

    // Request audio from OpenAI
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice as "alloy",
      input: text,
      speed: speed,
    });

    // Get the audio data as array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Return audio data with appropriate headers
    return new NextResponse(arrayBuffer);
  } catch (error) {
    console.error('Error generating TTS:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}