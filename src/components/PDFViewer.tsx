'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useState, useEffect } from 'react';
import { PDFSkeleton } from './PDFSkeleton';
import { useTTS } from '@/context/TTSContext';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PDFViewerProps {
  pdfFile: string | undefined;
}

export function PDFViewer({ pdfFile }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const { setText } = useTTS();
  const [pdfText, setPdfText] = useState('');

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  useEffect(() => {
    if (pdfFile) {
      // Load PDF text when file changes
      const loadPdfText = async () => {
        try {
          const pdf = await pdfjs.getDocument(pdfFile).promise;
          let fullText = '';
          
          // Get text from all pages
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            fullText += pageText + ' ';
          }
          
          setPdfText(fullText);
          setText(fullText);
        } catch (error) {
          console.error('Error loading PDF text:', error);
        }
      };

      loadPdfText();
    }
  }, [pdfFile, setText]);

  return (
    <div className="flex flex-col items-center">
      <Document 
        file={pdfFile} 
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<PDFSkeleton />}
        noData={<PDFSkeleton />}
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
