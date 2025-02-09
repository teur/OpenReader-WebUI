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

const isShortSentence = (sentence: string): boolean => {
  const words = sentence.trim().split(/\s+/);
  return words.length <= 5;
};

export const splitIntoSentences = (text: string): string[] => {
  // Preprocess the text before splitting into sentences
  const cleanedText = preprocessSentenceForAudio(text);
  const doc = nlp(cleanedText);
  const rawSentences = doc.sentences().out('array') as string[];
  
  // Combine short sentences with previous ones
  const processedSentences: string[] = [];
  
  for (let i = 0; i < rawSentences.length; i++) {
    const currentSentence = rawSentences[i].trim();
    
    if (isShortSentence(currentSentence) && processedSentences.length > 0) {
      // Combine with previous sentence
      const lastIndex = processedSentences.length - 1;
      processedSentences[lastIndex] = `${processedSentences[lastIndex]} ${currentSentence}`;
    } else {
      processedSentences.push(currentSentence);
    }
  }
  
  return processedSentences;
};