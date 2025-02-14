import { NextRequest, NextResponse } from 'next/server';
import nlp from 'compromise';

const MAX_BLOCK_LENGTH = 450;

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
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to process text' }, { status: 500 });
  }
}
