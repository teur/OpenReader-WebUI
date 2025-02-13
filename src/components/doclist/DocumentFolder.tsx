import { useState } from 'react';
import { Button } from '@headlessui/react';
import { DocumentListItem } from './DocumentListItem';
import { Folder, DocumentListDocument } from '@/types/documents';

interface DocumentFolderProps {
  folder: Folder;
  isCollapsed: boolean;
  onToggleCollapse: (folderId: string) => void;
  onDelete: () => void;
  sortedDocuments: DocumentListDocument[];
  onDocumentDelete: (doc: DocumentListDocument) => void;
  draggedDoc: DocumentListDocument | null;
  dropTargetDoc: DocumentListDocument | null;
  onDragStart: (doc: DocumentListDocument) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, doc: DocumentListDocument) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, doc: DocumentListDocument) => void;
}

const ChevronIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const calculateFolderSize = (documents: DocumentListDocument[]) => {
  return documents.reduce((total, doc) => total + doc.size, 0);
};

export function DocumentFolder({
  folder,
  isCollapsed,
  onToggleCollapse,
  onDelete,
  sortedDocuments,
  onDocumentDelete,
  draggedDoc,
  dropTargetDoc,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: DocumentFolderProps) {
  const [isHovering, setIsHovering] = useState(false);
  const isDropTarget = isHovering && draggedDoc && !draggedDoc.folderId;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovering(true);
        if (draggedDoc && !draggedDoc.folderId) {
          onDragOver(e, { ...draggedDoc, folderId: folder.id });
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovering(false);
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovering(false);
        if (!draggedDoc || draggedDoc.folderId) return;
        onDrop(e, { ...draggedDoc, folderId: folder.id });
      }}
      className={`rounded-lg p-2 transition-all bg-offbase shadow hover:shadow-md ${
        isDropTarget ? 'ring-2 ring-accent bg-primary/10' : ''
      }`}
    >
      <div className={`flex items-center justify-between ${isCollapsed ? 'mb-0' : 'mb-2'}`}>
        <div className="flex items-center">
          <h3 className="text-lg px-1 font-semibold">{folder.name}</h3>
          <Button
            onClick={onDelete}
            className="p-1 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Delete folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        <Button
          onClick={() => onToggleCollapse(folder.id)}
          className="p-1 hover:bg-offbase rounded-lg transition-colors"
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
        >
          <ChevronIcon
            className={`w-5 h-5 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>
      
      {!isCollapsed && (
        <div className="space-y-2">
          {sortedDocuments.map(doc => (
            <DocumentListItem
              key={`${doc.type}-${doc.id}`}
              doc={doc}
              onDelete={onDocumentDelete}
              dragEnabled={true}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              isDropTarget={dropTargetDoc?.id === doc.id}
            />
          ))}
        </div>
      )}
      
      {isCollapsed && (
        <p className="text-xs px-1 text-left text-muted">
          {(calculateFolderSize(sortedDocuments) / 1024 / 1024).toFixed(2)} MB
          {` • ${sortedDocuments.length} ${sortedDocuments.length === 1 ? 'file' : 'files'}`}
        </p>
      )}
    </div>
  );
}