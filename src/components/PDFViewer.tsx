'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useState, useEffect } from 'react';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PDFViewerProps {
  pdfFile: string;
  highlightText?: string; // Text to highlight in the PDF
}

export function PDFViewer({ pdfFile, highlightText }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>();

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  // Function to highlight text in the PDF
  const highlightPattern = (text: string, pattern: string) => {
    if (!pattern) return text;
    const regex = new RegExp(`(${pattern})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  // Add styles for highlighted text
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .react-pdf__Page__textContent mark {
        background-color: yellow;
        border-radius: 2px;
        padding: 0;
        margin: 0;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <Document 
        file={pdfFile} 
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
                  className="rounded-xl shadow-lg"
                  scale={1.2}
                  customTextRenderer={(textItem) => 
                    highlightText ? 
                      highlightPattern(textItem.str, highlightText) : 
                      textItem.str
                  }
                />
              </div>
            </div>
          ),
        )}
      </Document>
    </div>
  );
}
