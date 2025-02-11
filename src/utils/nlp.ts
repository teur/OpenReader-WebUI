import nlp from 'compromise';

// Text preprocessing function to clean and normalize text
export const preprocessSentenceForAudio = (text: string): string => {
  return text
    // Replace URLs with descriptive text including domain
    .replace(/\S*(?:https?:\/\/|www\.)([^\/\s]+)(?:\/\S*)?/gi, '- (link to $1) -')
    // Remove special characters except basic punctuation
    //.replace(/[^\w\s.,!?;:'"()-]/g, ' ')
    // Fix hyphenated words at line breaks (word- word -> wordword)
    .replace(/(\w+)-\s+(\w+)/g, '$1$2')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
};

const MAX_BLOCK_LENGTH = 250; // Maximum characters per block

export const splitIntoSentences = (text: string): string[] => {
  // Preprocess the text before splitting into sentences
  const cleanedText = preprocessSentenceForAudio(text);
  const doc = nlp(cleanedText);
  const rawSentences = doc.sentences().out('array') as string[];
  
  const blocks: string[] = [];
  let currentBlock = '';

  for (const sentence of rawSentences) {
    const trimmedSentence = sentence.trim();
    
    // If adding this sentence would exceed the limit, start a new block
    if (currentBlock && (currentBlock.length + trimmedSentence.length + 1) > MAX_BLOCK_LENGTH) {
      blocks.push(currentBlock.trim());
      currentBlock = trimmedSentence;
    } else {
      // Add to current block with a space if not empty
      currentBlock = currentBlock 
        ? `${currentBlock} ${trimmedSentence}`
        : trimmedSentence;
    }
  }

  // Add the last block if not empty
  if (currentBlock) {
    blocks.push(currentBlock.trim());
  }
  
  return blocks;
};