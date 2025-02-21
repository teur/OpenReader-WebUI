import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

export async function GET(req: NextRequest) {
  try {
    // Get API credentials from headers
    const openApiKey = req.headers.get('x-openai-key');
    const openApiBaseUrl = req.headers.get('x-openai-base-url');

    if (!openApiKey || !openApiBaseUrl) {
      return NextResponse.json({ error: 'Missing API credentials' }, { status: 401 });
    }

    // Request voices from OpenAI
    const response = await fetch(`${openApiBaseUrl}/audio/voices`, {
      headers: {
        'Authorization': `Bearer ${openApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch voices');
    }

    const data = await response.json();
    return NextResponse.json({ voices: data.voices || DEFAULT_VOICES });
  } catch (error) {
    console.error('Error fetching voices:', error);
    // Return default voices on error
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}