/**
 * Utility functions for audio processing
 */

/**
 * Creates a URL from an ArrayBuffer containing MP3 audio data
 * @param buffer The ArrayBuffer containing MP3 audio data
 * @returns A blob URL that can be used for audio playback
 */
export const audioBufferToURL = (buffer: ArrayBuffer): string => {
  const blob = new Blob([buffer], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
};