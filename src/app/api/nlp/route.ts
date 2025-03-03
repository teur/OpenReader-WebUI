import { NextRequest, NextResponse } from 'next/server';
import nlp from 'compromise';

const MAX_BLOCK_LENGTH = 300;

const preprocessSentenceForAudio = (text: string): string => {
  return text
    .replace(/\S*(?:https?:\/\/|www\.)([^\/\s]+)(?:\/\S*)?/gi, '- (link to $1) -')
    .replace(/(\w+)-\s+(\w+)/g, '$1$2') // Remove hyphenation
    // Remove special character *
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const splitIntoSentences = (text: string): string[] => {
  const paragraphs = text.split(/\n+/);
  const blocks: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const cleanedText = preprocessSentenceForAudio(paragraph);
    const doc = nlp(cleanedText);
    const rawSentences = doc.sentences().out('array') as string[];
    
    let currentBlock = '';

    for (const sentence of rawSentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentBlock && (currentBlock.length + trimmedSentence.length + 1) > MAX_BLOCK_LENGTH) {
        blocks.push(currentBlock.trim());
        currentBlock = trimmedSentence;
      } else {
        currentBlock = currentBlock 
          ? `${currentBlock} ${trimmedSentence}`
          : trimmedSentence;
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock.trim());
    }
  }
  
  return blocks;
};

export async function POST(req: NextRequest) {
  // First check if the request body is empty
  const contentLength = req.headers.get('content-length');
  if (!contentLength || parseInt(contentLength) === 0) {
    return NextResponse.json(
      { error: 'Request body is empty' },
      { status: 400 }
    );
  }

  // Check content type
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 400 }
    );
  }

  try {
    // Get the raw body text first to validate it's not empty
    const rawBody = await req.text();
    if (!rawBody?.trim()) {
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      );
    }

    // Try to parse the JSON
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error('JSON parse error:', e);
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    // Validate the parsed body has the required text field
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 }
      );
    }

    const { text } = body;
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text field' },
        { status: 400 }
      );
    }

    if (text.length <= MAX_BLOCK_LENGTH) {
      // Single sentence preprocessing
      const cleanedText = preprocessSentenceForAudio(text);
      return NextResponse.json({ sentences: [cleanedText] });
    }

    // Full text splitting into sentences
    const sentences = splitIntoSentences(text);
    return NextResponse.json({ sentences });
  } catch (error) {
    console.error('Error processing text:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
