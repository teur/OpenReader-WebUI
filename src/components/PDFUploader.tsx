'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePDF } from '@/contexts/PDFContext';
import { UploadIcon } from '@/components/icons/Icons';

interface PDFUploaderProps {
  className?: string;
}

export function PDFUploader({ className = '' }: PDFUploaderProps) {
  const { addDocument } = usePDF();
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
        setError('Failed to upload PDF. Please try again.');
        console.error('Upload error:', err);
      } finally {
        setIsUploading(false);
      }
    }
  }, [addDocument]);

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
        w-full py-5 px-3 border-2 border-dashed rounded-lg
        ${isDragActive ? 'border-accent bg-base' : 'border-muted'}
        transform trasition-transform duration-200 ease-in-out hover:scale-[1.008]
        ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-accent hover:bg-base'}
        ${className}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-center">
        <UploadIcon className="w-7 h-7 sm:w-10 sm:h-10 mb-2 text-muted" />

        {isUploading ? (
          <p className="text-sm sm:text-lg font-semibold text-foreground">
            Uploading PDF...
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm sm:text-lg font-semibold text-foreground">
              {isDragActive ? 'Drop your PDF here' : 'Drop your PDF here, or click to select'}
            </p>
            <p className="text-xs sm:text-sm text-muted">
              Only PDF files are currently accepted
            </p>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
