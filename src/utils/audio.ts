/**
 * Utility functions for audio processing
 */

interface AudioChunk {
  buffer: ArrayBuffer;
  title?: string;
  startTime: number;
}

/**
 * Creates a URL from an ArrayBuffer containing MP3 audio data
 * @param buffer The ArrayBuffer containing MP3 audio data
 * @returns A blob URL that can be used for audio playback
 */
export const audioBufferToURL = (buffer: ArrayBuffer): string => {
  const blob = new Blob([buffer], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
};

/**
 * Combines audio chunks into a single audio file
 * @param audioChunks Array of audio chunks with metadata
 * @param format Output format ('mp3' or 'm4b')
 * @param setIsAudioCombining Optional callback to track combining state
 * @returns Promise resolving to the combined audio buffer
 */
export const combineAudioChunks = async (
  audioChunks: AudioChunk[],
  format: 'mp3' | 'm4b',
  setIsAudioCombining?: (state: boolean) => void
): Promise<ArrayBuffer> => {
  if (setIsAudioCombining) {
    setIsAudioCombining(true);
  }
  
  try {
    if (format === 'm4b') {
      // Filter out chunks without titles and silence buffers
      const titledChunks = audioChunks.filter(chunk => chunk.title && chunk.buffer.byteLength > 48000);
      
      let bookId: string | undefined;
      
      // Upload each chunk sequentially and get book ID
      for (const chunk of titledChunks) {
        const response = await fetch('/api/audio/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapterTitle: chunk.title,
            buffer: Array.from(new Uint8Array(chunk.buffer)),
            bookId // Will be undefined for first chunk, then set for subsequent ones
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to upload audio chunk');
        }

        const result = await response.json();
        bookId = result.bookId; // Save book ID for subsequent chunks
      }

      if (!bookId) {
        throw new Error('No book ID received from server');
      }

      // Get the final combined M4B file
      const m4bResponse = await fetch(`/api/audio/convert?bookId=${bookId}`);
      if (!m4bResponse.ok) {
        throw new Error('Failed to get combined M4B');
      }

      return await m4bResponse.arrayBuffer();
    }

    // For MP3, just concatenate the buffers
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.buffer.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of audioChunks) {
      combinedBuffer.set(new Uint8Array(chunk.buffer), offset);
      offset += chunk.buffer.byteLength;
    }

    return combinedBuffer.buffer;
  } finally {
    if (setIsAudioCombining) setIsAudioCombining(false);
  }
}