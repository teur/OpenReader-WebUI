'use client';

import { RefObject, useCallback, useState, useEffect, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PDFSkeleton } from './PDFSkeleton';
import { useTTS } from '@/contexts/TTSContext';
import { usePDF } from '@/contexts/PDFContext';
import TTSPlayer from '@/components/player/TTSPlayer';

interface PDFViewerProps {
  zoomLevel: number;
}

export function PDFViewer({ zoomLevel }: PDFViewerProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // TTS context
  const {
    currentSentence,
    stopAndPlayFromIndex,
    isProcessing
  } = useTTS();

  // PDF context
  const {
    highlightPattern,
    clearHighlights,
    handleTextClick,
    onDocumentLoadSuccess,
    currDocURL,
    currDocPages,
    currDocText,
    currDocPage,
  } = usePDF();

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
    if (!currDocText) return;

    const handleClick = (event: MouseEvent) => handleTextClick(
      event,
      currDocText,
      containerRef as RefObject<HTMLDivElement>,
      stopAndPlayFromIndex,
      isProcessing
    );
    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [currDocText, handleTextClick, stopAndPlayFromIndex, isProcessing]);

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
    if (!currDocText) return;

    const highlightTimeout = setTimeout(() => {
      if (containerRef.current) {
        highlightPattern(currDocText, currentSentence || '', containerRef as RefObject<HTMLDivElement>);
      }
    }, 200);

    return () => {
      clearTimeout(highlightTimeout);
      clearHighlights();
    };
  }, [currDocText, currentSentence, highlightPattern, clearHighlights]);

  // Add page dimensions state
  const [pageWidth, setPageWidth] = useState<number>(595); // default A4 width
  const [pageHeight, setPageHeight] = useState<number>(842); // default A4 height

  // Modify scale calculation function to handle orientation
  const calculateScale = useCallback((width = pageWidth, height = pageHeight): number => {
    const margin = 24; // 24px padding on each side
    const containerHeight = window.innerHeight - 100; // approximate visible height
    const targetWidth = containerWidth - margin;
    const targetHeight = containerHeight - margin;

    // Calculate scales based on both dimensions
    const scaleByWidth = targetWidth / width;
    const scaleByHeight = targetHeight / height;

    // Use the smaller scale to ensure the page fits both dimensions
    const baseScale = Math.min(scaleByWidth, scaleByHeight);
    return baseScale * (zoomLevel / 100);
  }, [containerWidth, zoomLevel, pageWidth, pageHeight]);

  // Add resize observer effect
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        setContainerWidth(width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col items-center overflow-auto max-h-[calc(100vh-100px)] w-full px-6">
      <Document
        loading={<PDFSkeleton />}
        noData={<PDFSkeleton />}
        file={currDocURL}
        onLoadSuccess={(pdf) => {
          onDocumentLoadSuccess(pdf);
          //handlePageChange(1); // Load first page text
        }}
        className="flex flex-col items-center m-0" 
      >
        <div>
          <div className="flex justify-center">
            <Page
              pageNumber={currDocPage}
              renderAnnotationLayer={true}
              renderTextLayer={true}
              className="shadow-lg"
              scale={calculateScale()}
              onLoadSuccess={(page) => {
                setPageWidth(page.originalWidth);
                setPageHeight(page.originalHeight);
              }}
            />
          </div>
        </div>
      </Document>
      <TTSPlayer 
        currentPage={currDocPage}
        numPages={currDocPages}
      />
    </div>
  );
}