import { useCallback } from 'react';

export function usePDFURLConversion() {
  /**
   * Converts PDF binary data to a data URL for display
   * 
   * @param {Blob} pdfData - The PDF binary data
   * @returns {Promise<string>} A data URL representing the PDF
   */
  const convertPDFDataToURL = useCallback((pdfData: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(pdfData);
    });
  }, []);

  return {
    convertPDFDataToURL,
  };
}
