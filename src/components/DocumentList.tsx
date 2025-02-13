'use client';

import Link from 'next/link';
import { useCallback, useState, useEffect } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { PDFIcon, EPUBIcon, ChevronUpDownIcon } from '@/components/icons/Icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Popover,
  PopoverPanel,
  Button,
} from '@headlessui/react';
import { getDocumentListState, saveDocumentListState } from '@/utils/indexedDB';
import {
  DocumentType,
  DocumentListDocument,
  Folder,
  DocumentListState,
  SortBy,
  SortDirection
} from '@/types/documents';

type DocumentToDelete = {
  id: string;
  name: string;
  type: DocumentType;
};

const generateDefaultFolderName = (doc1: DocumentListDocument, doc2: DocumentListDocument) => {
  // Try to find common words between the two document names
  const words1 = doc1.name.toLowerCase().split(/[\s-_\.]+/);
  const words2 = doc2.name.toLowerCase().split(/[\s-_\.]+/);
  const commonWords = words1.filter(word => words2.includes(word));

  if (commonWords.length > 0) {
    // Use the first common word that's at least 3 characters long
    const significant = commonWords.find(word => word.length >= 3);
    if (significant) {
      return `${significant.charAt(0).toUpperCase()}${significant.slice(1)}`;
    }
  }

  // Fallback to a numbered folder
  const timestamp = new Date().toISOString().slice(0, 10);
  return `Folder ${timestamp}`;
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

  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentToDelete | null>(null);
  const [draggedDoc, setDraggedDoc] = useState<DocumentListDocument | null>(null);
  const [dropTargetDoc, setDropTargetDoc] = useState<DocumentListDocument | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [pendingFolderDocs, setPendingFolderDocs] = useState<{ source: DocumentListDocument, target: DocumentListDocument } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load saved state
    const loadState = async () => {
      const savedState = await getDocumentListState();
      if (savedState) {
        setSortBy(savedState.sortBy);
        setSortDirection(savedState.sortDirection);
        setFolders(savedState.folders);
        setCollapsedFolders(new Set(savedState.collapsedFolders));
      }
      setIsInitialized(true);
    };

    loadState();
  }, []);

  useEffect(() => {
    const saveState = async () => {
      const state: DocumentListState = {
        sortBy,
        sortDirection,
        folders,
        collapsedFolders: Array.from(collapsedFolders)
      };
      await saveDocumentListState(state);
    };

    if (isInitialized) { // Prevents saving empty state on first render or back navigation
      saveState();
    }
  }, [sortBy, sortDirection, folders, collapsedFolders]);

  const allDocuments: DocumentListDocument[] = [
    ...pdfDocs.map(doc => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      lastModified: doc.lastModified,
      type: 'pdf' as const,
    })),
    ...epubDocs.map(doc => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      lastModified: doc.lastModified,
      type: 'epub' as const,
    })),
  ];

  const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: 'name', label: 'Name' },
    { value: 'type', label: 'Type' },
    { value: 'date', label: 'Date' },
    { value: 'size', label: 'Size' },
  ];

  const sortDocuments = useCallback((docs: DocumentListDocument[]) => {
    return [...docs].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'type':
          return sortDirection === 'asc'
            ? a.type.localeCompare(b.type)
            : b.type.localeCompare(a.type);
        case 'size':
          return sortDirection === 'asc'
            ? a.size - b.size
            : b.size - a.size;
        default:
          return sortDirection === 'asc'
            ? a.lastModified - b.lastModified
            : b.lastModified - a.lastModified;
      }
    });
  }, [sortBy, sortDirection]);

  const handleDragStart = (doc: DocumentListDocument) => {
    // Only allow dragging documents that aren't in folders
    if (!doc.folderId) {
      setDraggedDoc(doc);
    }
  };

  const handleDragEnd = () => {
    setDraggedDoc(null);
    setDropTargetDoc(null);
  };

  const handleDragOver = (e: React.DragEvent, doc: DocumentListDocument) => {
    e.preventDefault();
    if (draggedDoc && draggedDoc.id !== doc.id && !draggedDoc.folderId) {
      // Only highlight target if neither document is in a folder
      if (!doc.folderId) {
        setDropTargetDoc(doc);
      }
    }
  };

  const handleDragLeave = () => {
    setDropTargetDoc(null);
  };

  const handleDrop = useCallback((e: React.DragEvent, targetDoc: DocumentListDocument) => {
    e.preventDefault();
    if (!draggedDoc || draggedDoc.id === targetDoc.id || draggedDoc.folderId) return;

    // Only create new folders for unfoldered documents
    if (!targetDoc.folderId) {
      setPendingFolderDocs({
        source: draggedDoc,
        target: targetDoc
      });
      setNewFolderName('');
    }
  }, [draggedDoc]);

  const createFolder = useCallback(() => {
    if (!pendingFolderDocs) return;

    const folderName = newFolderName.trim() ||
      generateDefaultFolderName(pendingFolderDocs.source, pendingFolderDocs.target);

    const folderId = `folder-${Date.now()}`;
    setFolders(prev => [
      ...prev,
      {
        id: folderId,
        name: folderName,
        documents: [
          { ...pendingFolderDocs.source, folderId },
          { ...pendingFolderDocs.target, folderId }
        ]
      }
    ]);

    setPendingFolderDocs(null);
    setNewFolderName('');
    setDropTargetDoc(null);
    setDraggedDoc(null);
  }, [pendingFolderDocs, newFolderName]);

  const handleFolderNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createFolder();
    } else if (e.key === 'Escape') {
      setPendingFolderDocs(null);
      setNewFolderName('');
    }
  };

  const handleDelete = useCallback(async () => {
    if (!documentToDelete) return;

    try {
      if (documentToDelete.type === 'pdf') {
        await removePDF(documentToDelete.id);
      } else {
        await removeEPUB(documentToDelete.id);
      }

      // Remove from folders if document is in one
      setFolders(prev => prev.map(folder => ({
        ...folder,
        documents: folder.documents.filter(doc =>
          !(doc.id === documentToDelete.id && doc.type === documentToDelete.type)
        )
      })));

      setDocumentToDelete(null);
    } catch (err) {
      console.error('Failed to remove document:', err);
    }
  }, [documentToDelete, removePDF, removeEPUB]);

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderViewControls = () => (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Listbox value={sortBy} onChange={setSortBy}>
          <ListboxButton className="flex items-center space-x-0.5 sm:space-x-1 bg-transparent text-foreground text-xs sm:text-sm focus:outline-none cursor-pointer hover:bg-offbase rounded pl-1.5 sm:pl-2 pr-0.5 sm:pr-1 py-0.5 sm:py-1">
            <span>{sortOptions.find(opt => opt.value === sortBy)?.label}</span>
            <ChevronUpDownIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </ListboxButton>
          <ListboxOptions className="absolute z-50 w-28 sm:w-32 overflow-auto rounded-lg bg-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {sortOptions.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className={({ active, selected }) =>
                  `relative cursor-pointer select-none py-0.5 px-1.5 sm:py-2 sm:px-3 ${active ? 'bg-offbase' : ''
                  } ${selected ? 'font-medium' : ''}`
                }
              >
                <span className="text-xs sm:text-sm">{option.label}</span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Listbox>
      </div>

      <Button
        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
        className="px-1 bg-base hover:bg-offbase rounded"
      >
        {sortDirection === 'asc' ? '↑' : '↓'}
      </Button>
    </div>
  );

  const renderDocument = (doc: DocumentListDocument) => (
    <div
      key={`${doc.type}-${doc.id}`}
      draggable={!doc.folderId} // Only make unfoldered documents draggable
      onDragStart={() => handleDragStart(doc)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOver(e, doc)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, doc)}
      className={`
        w-full
        ${!doc.folderId && dropTargetDoc?.id === doc.id ? 'ring-2 ring-primary bg-primary/10' : ''}
        bg-background rounded-lg p-2 shadow hover:shadow-md transition-shadow
      `}
    >
      <div className="flex items-center rounded-lg">
        <Link
          href={`/${doc.type}/${encodeURIComponent(doc.id)}`}
          draggable={false}
          className="flex items-center align-center space-x-4 w-full truncate hover:bg-base rounded-lg p-1 pr-4 transition-colors"
        >
          <div className="flex-shrink-0">
            {doc.type === 'pdf' ? (
              <PDFIcon />
            ) : (
              <EPUBIcon />
            )}
          </div>
          <div className="flex flex-col min-w-0 transform transition-transform duration-200 ease-in-out hover:scale-[1.02] w-full truncate">
            <p className="text-sm sm:text-md text-foreground font-medium truncate">{doc.name}</p>
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
    </div>
  );

  // Add this helper function before renderFolder
  const calculateFolderSize = (documents: DocumentListDocument[]) => {
    return documents.reduce((total, doc) => total + doc.size, 0);
  };

  const deleteFolder = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
  };

  const renderFolder = (folder: Folder) => (
    <div
      key={folder.id}
      onDragOver={(e) => {
        e.preventDefault();
        // Only show drop target if dragged doc isn't already in a folder
        if (draggedDoc && !draggedDoc.folderId) {
          setDropTargetDoc({ ...draggedDoc, folderId: folder.id });
        }
      }}
      onDragLeave={() => setDropTargetDoc(null)}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedDoc || draggedDoc.folderId) return;

        // Check if document is already in this folder
        if (folder.documents.some(doc => doc.id === draggedDoc.id)) {
          return;
        }

        setFolders(prev => prev.map(f => {
          if (f.id === folder.id) {
            return {
              ...f,
              documents: [...f.documents, { ...draggedDoc, folderId: folder.id }]
            };
          }
          return f;
        }));
        setDraggedDoc(null);
        setDropTargetDoc(null);
      }}
      className={`rounded-lg p-2 transition-all bg-offbase shadow-lg transition-shadow ${dropTargetDoc?.folderId === folder.id ? 'ring-2 ring-primary bg-primary/10' : ''
        }`}
    >
      <div className={`flex items-center justify-between ${collapsedFolders.has(folder.id) ? 'mb-0' : 'mb-2'}`}>
        <div className="flex items-center">
          <h3 className="text-lg px-1 font-semibold">{folder.name}</h3>
          <Button
            onClick={() => deleteFolder(folder.id)}
            className="p-1 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Delete folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <Button
          onClick={() => toggleFolderCollapse(folder.id)}
          className="p-1 hover:bg-offbase rounded-lg transition-colors"
          aria-label={collapsedFolders.has(folder.id) ? "Expand folder" : "Collapse folder"}
        >
          <ChevronIcon
            className={`w-5 h-5 transform transition-transform ${collapsedFolders.has(folder.id) ? 'rotate-180' : ''
              }`}
          />
        </Button>
      </div>
      {!collapsedFolders.has(folder.id) && (
        <div className="space-y-2">
          {sortDocuments(folder.documents).map(renderDocument)}
        </div>
      )}
      {collapsedFolders.has(folder.id) && (
        <p className="text-xs px-1 text-left text-muted">
          {(calculateFolderSize(folder.documents) / 1024 / 1024).toFixed(2)} MB
          {` • ${folder.documents.length} ${folder.documents.length === 1 ? 'file' : 'files'}`}
        </p>
      )}
    </div>
  );

  if (isPDFLoading || isEPUBLoading) {
    return <div className="w-full text-center text-muted">Loading documents...</div>;
  }

  if (allDocuments.length === 0) {
    return <div className="w-full text-center text-muted">No documents uploaded yet</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Your Documents</h2>
          {renderViewControls()}
        </div>

        <div className="space-y-4">
          {folders.map(renderFolder)}

          <div className="space-y-2">
            {/* Only show documents that don't have a folderId */}
            {sortDocuments(allDocuments.filter(doc => !folders.some(folder =>
              folder.documents.some(d => d.id === doc.id)
            ))).map(renderDocument)}
          </div>
        </div>

        <Popover className="fixed">
          {pendingFolderDocs && (
            <div className="fixed inset-0 flex items-center justify-center">
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
              <PopoverPanel
                static
                className="relative bg-background p-6 rounded-lg shadow-lg max-w-sm w-full"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Create New Folder</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={handleFolderNameKeyDown}
                      placeholder="Enter folder name"
                      className="w-full rounded-lg bg-base py-2 px-3 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      autoFocus
                    />
                    <p className="text-xs text-muted"> Press Enter to create or Escape to cancel</p>
                  </div>
                </div>
              </PopoverPanel>
            </div>
          )}
        </Popover>

        <ConfirmDialog
          isOpen={documentToDelete !== null}
          onClose={() => setDocumentToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Document"
          message={`Are you sure you want to delete ${documentToDelete?.name || 'this document'}?`}
          confirmText="Delete"
          isDangerous={true}
        />
      </div>
    </DndProvider>
  );
}

const ChevronIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);
