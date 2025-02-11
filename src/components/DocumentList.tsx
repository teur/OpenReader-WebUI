import Link from 'next/link';
import { Button } from '@headlessui/react';
import { Transition } from '@headlessui/react';
import { useState } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { PDFIcon, EPUBIcon } from '@/components/icons/Icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type DocumentToDelete = {
  id: string;
  name: string;
  type: 'pdf' | 'epub';
};

export function DocumentList() {
  const {
    pdfDocs,
    removePDFDocument: removePDF,
    isPDFLoading,
    epubDocs,
    removeEPUBDocument: removeEPUB,
    isEPUBLoading,
  } = useDocuments();

  const [documentToDelete, setDocumentToDelete] = useState<DocumentToDelete | null>(null);

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      if (documentToDelete.type === 'pdf') {
        await removePDF(documentToDelete.id);
      } else {
        await removeEPUB(documentToDelete.id);
      }
      setDocumentToDelete(null);
    } catch (err) {
      console.error('Failed to remove document:', err);
    }
  };

  const allDocuments = [
    ...pdfDocs.map(doc => ({ ...doc, type: 'pdf' as const })),
    ...epubDocs.map(doc => ({ ...doc, type: 'epub' as const })),
  ].sort((a, b) => b.lastModified - a.lastModified);

  if (isPDFLoading || isEPUBLoading) {
    return (
      <div className="w-full text-center text-muted">
        Loading documents...
      </div>
    );
  }

  if (allDocuments.length === 0) {
    return (
      <div className="w-full text-center text-muted">
        No documents uploaded yet
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-foreground">Your Documents</h2>
      <div className="bg-background rounded-lg shadow p-2 space-y-2">
        {allDocuments.map((doc) => (
          <Transition
            key={`${doc.type}-${doc.id}`}
            show={true}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <div className="flex items-center justify-between hover:bg-base p-1 rounded-lg transition-colors">
              <Link 
                href={`/${doc.type}/${encodeURIComponent(doc.id)}`}
                className="flex items-center space-x-4 flex-1 min-w-0"
              >
                <div className="flex-shrink-0">
                  {doc.type === 'pdf' ? (
                    <PDFIcon />
                  ) : (
                    <EPUBIcon />
                  )}
                </div>
                <div className="flex-1 min-w-0 transform transition-transform duration-200 ease-in-out hover:scale-[1.02]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm sm:text-md text-foreground font-medium truncate">{doc.name}</p>
                    <span className="text-xs rounded-full bg-muted/20 text-muted uppercase">
                      {doc.type}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted truncate">
                    {(doc.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </Link>
              <Button
                onClick={() => setDocumentToDelete({ id: doc.id, name: doc.name, type: doc.type })}
                className="ml-4 p-2 text-muted hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                aria-label="Delete document"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </Transition>
        ))}
      </div>

      <ConfirmDialog
        isOpen={documentToDelete !== null}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete ${documentToDelete?.name ? documentToDelete.name : 'this document'}? This action cannot be undone.`}
        confirmText="Delete"
        isDangerous={true}
      />
    </div>
  );
}
