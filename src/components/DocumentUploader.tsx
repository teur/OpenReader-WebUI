'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from '@/components/icons/Icons';
import { useDocuments } from '@/contexts/DocumentContext';

interface DocumentUploaderProps {
  className?: string;
}

export function DocumentUploader({ className = '' }: DocumentUploaderProps) {
  const { addPDFDocument: addPDF, addEPUBDocument: addEPUB } = useDocuments();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    
    try {
      if (file.type === 'application/pdf') {
        await addPDF(file);
      } else if (file.type === 'application/epub+zip') {
        await addEPUB(file);
      }
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  }, [addPDF, addEPUB]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub']
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
            Uploading file...
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm sm:text-lg font-semibold text-foreground">
              {isDragActive ? 'Drop your file here' : 'Drop your file here, or click to select'}
            </p>
            <p className="text-xs sm:text-sm text-muted">
              PDF and EPUB files are accepted
            </p>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
