'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePDF } from '@/contexts/PDFContext';

interface PDFUploaderProps {
  className?: string;
}

export function PDFUploader({ className = '' }: PDFUploaderProps) {
  const { addDocument, error: contextError } = usePDF();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setIsUploading(true);
      setError(null);
      try {
        await addDocument(file);
      } catch (err) {
        setError(contextError || 'Failed to upload PDF. Please try again.');
        console.error('Upload error:', err);
      } finally {
        setIsUploading(false);
      }
    }
  }, [addDocument, contextError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading
  });

  return (
    <div
      {...getRootProps()}
      className={`
        w-full p-8 border-2 border-dashed rounded-lg
        ${isDragActive ? 'border-accent bg-base' : 'border-muted'}
        transition-colors duration-200 ease-in-out
        ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-accent hover:bg-base'}
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

        {isUploading ? (
          <p className="text-lg font-semibold text-foreground">
            Uploading PDF...
          </p>
        ) : (
          <>
            <p className="mb-2 text-lg font-semibold text-foreground">
              {isDragActive ? 'Drop your PDF here' : 'Drop your PDF here, or click to select'}
            </p>
            <p className="text-sm text-muted">
              Only PDF files are accepted
            </p>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
