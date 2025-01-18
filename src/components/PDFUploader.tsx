'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePDF } from '@/context/PDFContext';

interface PDFUploaderProps {
  className?: string;
}

export function PDFUploader({ className = '' }: PDFUploaderProps) {
  const { addDocument } = usePDF();
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      await addDocument(file);
    }
  }, [addDocument]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`
        w-full p-8 border-2 border-dashed rounded-lg
        ${isDragActive ? 'border-accent bg-base' : 'border-muted'}
        transition-colors duration-200 ease-in-out cursor-pointer
        hover:border-accent hover:bg-base
        ${className}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-center">
        <svg
          className="w-12 h-12 mb-4 text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="mb-2 text-lg font-semibold text-foreground">
          Drop your PDF here, or click to select
        </p>
        <p className="text-sm text-muted">
          Only PDF files are accepted
        </p>
      </div>
    </div>
  );
}
