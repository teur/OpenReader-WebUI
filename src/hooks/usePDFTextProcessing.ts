import { useCallback } from 'react';
import { pdfjs } from 'react-pdf';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export function usePDFTextProcessing() {
  /**
   * Extracts text content from a specific page of the PDF
   * 
   * @param {string} pdfURL - The URL of the PDF
   * @param {number} pageNumber - The page number to extract
   * @returns {Promise<string>} The extracted text
   */
  const extractTextFromPDF = useCallback(async (pdfURL: string, pageNumber: number): Promise<string> => {
    try {
      const base64Data = pdfURL.split(',')[1];
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const loadingTask = pdfjs.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;

      // Get only the specified page
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      // Filter out non-text items and assert proper type
      const textItems = textContent.items.filter((item): item is TextItem =>
        'str' in item && 'transform' in item
      );

      // Group text items into lines based on their vertical position
      const tolerance = 2;
      const lines: TextItem[][] = [];
      let currentLine: TextItem[] = [];
      let currentY: number | null = null;

      textItems.forEach((item) => {
        const y = item.transform[5];
        if (currentY === null) {
          currentY = y;
          currentLine.push(item);
        } else if (Math.abs(y - currentY) < tolerance) {
          currentLine.push(item);
        } else {
          lines.push(currentLine);
          currentLine = [item];
          currentY = y;
        }
      });
      lines.push(currentLine);

      // Process each line to build text
      let pageText = '';
      for (const line of lines) {
        // Sort items horizontally within the line
        line.sort((a, b) => a.transform[4] - b.transform[4]);

        let lineText = '';
        let prevItem: TextItem | null = null;

        for (const item of line) {
          if (!prevItem) {
            lineText = item.str;
          } else {
            const prevEndX = prevItem.transform[4] + (prevItem.width ?? 0);
            const currentStartX = item.transform[4];
            const space = currentStartX - prevEndX;

            // Add space if gap is significant, otherwise concatenate directly
            if (space > ((item.width ?? 0) * 0.3)) {
              lineText += ' ' + item.str;
            } else {
              lineText += item.str;
            }
          }
          prevItem = item;
        }
        pageText += lineText + ' ';
      }

      return pageText.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }, []);

  return {
    extractTextFromPDF,
  };
}
