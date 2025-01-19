const DB_NAME = 'openreader-db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf-documents';

export interface PDFDocument {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  data: Blob;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (!window.indexedDB) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      console.log('Initializing IndexedDB...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error('IndexedDB initialization error:', error);
        reject(error);
      };

      request.onsuccess = (event) => {
        console.log('IndexedDB initialized successfully');
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('Upgrading IndexedDB schema...');
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('Creating PDF documents store...');
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async addDocument(document: PDFDocument): Promise<void> {
    if (!this.db) {
      console.log('Database not initialized, initializing now...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Adding document to IndexedDB:', document.name);
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(document);

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error adding document:', error);
          reject(error);
        };

        transaction.oncomplete = () => {
          console.log('Document added successfully:', document.name);
          resolve();
        };
      } catch (error) {
        console.error('Error in addDocument transaction:', error);
        reject(error);
      }
    });
  }

  async getDocument(id: string): Promise<PDFDocument | undefined> {
    if (!this.db) {
      console.log('Database not initialized, initializing now...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching document:', id);
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error fetching document:', error);
          reject(error);
        };

        request.onsuccess = () => {
          console.log('Document fetch result:', request.result ? 'found' : 'not found');
          resolve(request.result);
        };
      } catch (error) {
        console.error('Error in getDocument transaction:', error);
        reject(error);
      }
    });
  }

  async getAllDocuments(): Promise<PDFDocument[]> {
    if (!this.db) {
      console.log('Database not initialized, initializing now...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching all documents');
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error fetching all documents:', error);
          reject(error);
        };

        request.onsuccess = () => {
          console.log('Retrieved documents count:', request.result?.length || 0);
          resolve(request.result || []);
        };
      } catch (error) {
        console.error('Error in getAllDocuments transaction:', error);
        reject(error);
      }
    });
  }

  async removeDocument(id: string): Promise<void> {
    if (!this.db) {
      console.log('Database not initialized, initializing now...');
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Removing document:', id);
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error removing document:', error);
          reject(error);
        };

        transaction.oncomplete = () => {
          console.log('Document removed successfully:', id);
          resolve();
        };
      } catch (error) {
        console.error('Error in removeDocument transaction:', error);
        reject(error);
      }
    });
  }
}

export const indexedDBService = new IndexedDBService();
