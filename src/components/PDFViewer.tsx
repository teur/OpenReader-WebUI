'use client';

import { RefObject } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useState, useEffect, useRef } from 'react';
import { PDFSkeleton } from './PDFSkeleton';
import { useTTS } from '@/contexts/TTSContext';
import { usePDF } from '@/contexts/PDFContext';

interface PDFViewerProps {
  pdfData: Blob | undefined;
}

export function PDFViewer({ pdfData }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const { setText, currentSentence, stopAndPlayFromIndex, isProcessing } = useTTS();
  const [pdfText, setPdfText] = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState<string>();
  const [loadingError, setLoadingError] = useState<string>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { extractTextFromPDF, highlightPattern, clearHighlights, handleTextClick } = usePDF();

  // Add static styles once during component initialization
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .react-pdf__Page__textContent span {
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .react-pdf__Page__textContent span:hover {
      background-color: rgba(255, 255, 0, 0.2) !important;
    }
  `;
  document.head.appendChild(styleElement);

  // Cleanup styles when component unmounts
  useEffect(() => {
    return () => {
      styleElement.remove();
    };
  }, [styleElement]);

  useEffect(() => {
    /*
     * Converts PDF blob to a data URL for display.
     * Cleans up by clearing the data URL when component unmounts.
     * 
     * Dependencies:
     * - pdfData: Re-run when the PDF blob changes to convert it to a new data URL
     */
    if (!pdfData) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPdfDataUrl(reader.result as string);
    };
    reader.onerror = () => {
      console.error('Error reading file:', reader.error);
      setLoadingError('Failed to load PDF');
    };
    reader.readAsDataURL(pdfData);

    return () => {
      setPdfDataUrl(undefined);
    };
  }, [pdfData]);

  useEffect(() => {
    /*
     * Extracts text content from the PDF once it's loaded.
     * Sets the extracted text for both display and text-to-speech.
     * 
     * Dependencies:
     * - pdfDataUrl: Re-run when the data URL is ready
     * - extractTextFromPDF: Function from context that could change
     * - setText: Function from context that could change
     * - pdfData: Source PDF blob that's being processed
     */
    if (!pdfDataUrl || !pdfData) return;

    const loadPdfText = async () => {
      try {
        const text = await extractTextFromPDF(pdfData);
        setPdfText(text);
        setText(text);
      } catch (error) {
        console.error('Error loading PDF text:', error);
        setLoadingError('Failed to extract PDF text');
      }
    };

    loadPdfText();
  }, [pdfDataUrl, extractTextFromPDF, setText, pdfData]);

  useEffect(() => {
    /*
     * Sets up click event listeners for text selection in the PDF.
     * Cleans up by removing the event listener when component unmounts.
     * 
     * Dependencies:
     * - pdfText: Re-run when the extracted text content changes
     * - handleTextClick: Function from context that could change
     * - stopAndPlayFromIndex: Function from context that could change
     */
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => handleTextClick(
      event,
      pdfText,
      containerRef as RefObject<HTMLDivElement>,
      stopAndPlayFromIndex,
      isProcessing
    );
    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [pdfText, handleTextClick, stopAndPlayFromIndex, isProcessing]);

  useEffect(() => {
    /*
     * Handles highlighting the current sentence being read by TTS.
     * Includes a small delay for smooth highlighting and cleans up on unmount.
     * 
     * Dependencies:
     * - pdfText: Re-run when the text content changes
     * - currentSentence: Re-run when the TTS position changes
     * - highlightPattern: Function from context that could change
     * - clearHighlights: Function from context that could change
     */
    const highlightTimeout = setTimeout(() => {
      if (containerRef.current) {
        highlightPattern(pdfText, currentSentence || '', containerRef as RefObject<HTMLDivElement>);
      }
    }, 100);

    return () => {
      clearTimeout(highlightTimeout);
      clearHighlights();
    };
  }, [pdfText, currentSentence, highlightPattern, clearHighlights]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center overflow-auto max-h-[calc(100vh-100px)]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {loadingError ? (
        <div className="text-red-500 mb-4">{loadingError}</div>
      ) : null}
      <Document
        loading={<PDFSkeleton />}
        noData={<PDFSkeleton />}
        file={pdfDataUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        className="flex flex-col items-center"
      >
        {Array.from(
          new Array(numPages),
          (el, index) => (
            <div key={`page_${index + 1}`}>
              <div className="bg-offbase my-4 px-2 py-0.5 rounded-full w-fit">
                <p className="text-xs">
                  {index + 1} / {numPages}
                </p>
              </div>
              <div className="flex justify-center">
                <Page
                  pageNumber={index + 1}
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                  className="shadow-lg"
                  scale={1.2}
                />
              </div>
            </div>
          ),
        )}
      </Document>
    </div>
  );
}