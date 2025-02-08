const DB_NAME = 'openreader-db';
const DB_VERSION = 2;  // Increased version number
const PDF_STORE_NAME = 'pdf-documents';
const EPUB_STORE_NAME = 'epub-documents';
const CONFIG_STORE_NAME = 'config';

export interface PDFDocument {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  data: Blob;
}

export interface EPUBDocument {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;  // Changed from Blob to ArrayBuffer
}

export interface Config {
  key: string;
  value: string;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
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
        
        if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
          console.log('Creating PDF documents store...');
          db.createObjectStore(PDF_STORE_NAME, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(EPUB_STORE_NAME)) {
          console.log('Creating EPUB documents store...');
          db.createObjectStore(EPUB_STORE_NAME, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(CONFIG_STORE_NAME)) {
          console.log('Creating config store...');
          db.createObjectStore(CONFIG_STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  // PDF Document Methods
  async addDocument(document: PDFDocument): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Adding document to IndexedDB:', document.name);
        const transaction = this.db!.transaction([PDF_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(PDF_STORE_NAME);
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
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching document:', id);
        const transaction = this.db!.transaction([PDF_STORE_NAME], 'readonly');
        const store = transaction.objectStore(PDF_STORE_NAME);
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
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching all documents');
        const transaction = this.db!.transaction([PDF_STORE_NAME], 'readonly');
        const store = transaction.objectStore(PDF_STORE_NAME);
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
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Removing document:', id);
        const transaction = this.db!.transaction([PDF_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(PDF_STORE_NAME);
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

  // Add EPUB Document Methods
  async addEPUBDocument(document: EPUBDocument): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        if (document.data.byteLength === 0) {
          throw new Error('Cannot store empty ArrayBuffer');
        }

        console.log('Storing document:', {
          name: document.name,
          size: document.size,
          actualSize: document.data.byteLength
        });

        const transaction = this.db!.transaction([EPUB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        
        // Create a structured clone of the document to ensure proper storage
        const request = store.put({
          ...document,
          data: document.data.slice(0) // Create a copy of the ArrayBuffer
        });

        request.onerror = (event) => {
          console.error('Error storing document:', (event.target as IDBRequest).error);
          reject((event.target as IDBRequest).error);
        };

        transaction.oncomplete = () => {
          console.log('Document stored successfully');
          resolve();
        };
      } catch (error) {
        console.error('Error in addEPUBDocument:', error);
        reject(error);
      }
    });
  }

  async getEPUBDocument(id: string): Promise<EPUBDocument | undefined> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([EPUB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.get(id);

        request.onerror = (event) => {
          console.error('Error fetching document:', (event.target as IDBRequest).error);
          reject((event.target as IDBRequest).error);
        };

        request.onsuccess = () => {
          const doc = request.result;
          if (doc) {
            console.log('Retrieved document from DB:', {
              name: doc.name,
              size: doc.size,
              actualSize: doc.data.byteLength
            });
          }
          resolve(doc);
        };
      } catch (error) {
        console.error('Error in getEPUBDocument:', error);
        reject(error);
      }
    });
  }

  async getAllEPUBDocuments(): Promise<EPUBDocument[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([EPUB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.getAll();

        request.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async removeEPUBDocument(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([EPUB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EPUB_STORE_NAME);
        const request = store.delete(id);

        request.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };

        transaction.oncomplete = () => {
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Config Methods
  async setConfigItem(key: string, value: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Setting config item:', key);
        const transaction = this.db!.transaction([CONFIG_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG_STORE_NAME);
        const request = store.put({ key, value });

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error setting config item:', error);
          reject(error);
        };

        transaction.oncomplete = () => {
          console.log('Config item set successfully:', key);
          resolve();
        };
      } catch (error) {
        console.error('Error in setConfigItem transaction:', error);
        reject(error);
      }
    });
  }

  async getConfigItem(key: string): Promise<string | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching config item:', key);
        const transaction = this.db!.transaction([CONFIG_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CONFIG_STORE_NAME);
        const request = store.get(key);

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error fetching config item:', error);
          reject(error);
        };

        request.onsuccess = () => {
          const result = request.result as Config | undefined;
          console.log('Config item fetch result:', result ? 'found' : 'not found');
          resolve(result ? result.value : null);
        };
      } catch (error) {
        console.error('Error in getConfigItem transaction:', error);
        reject(error);
      }
    });
  }

  async getAllConfig(): Promise<Record<string, string>> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Fetching all config items');
        const transaction = this.db!.transaction([CONFIG_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CONFIG_STORE_NAME);
        const request = store.getAll();

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error fetching all config items:', error);
          reject(error);
        };

        request.onsuccess = () => {
          const result = request.result as Config[];
          const config: Record<string, string> = {};
          result.forEach((item) => {
            config[item.key] = item.value;
          });
          console.log('Retrieved config items count:', result.length);
          resolve(config);
        };
      } catch (error) {
        console.error('Error in getAllConfig transaction:', error);
        reject(error);
      }
    });
  }

  async removeConfigItem(key: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('Removing config item:', key);
        const transaction = this.db!.transaction([CONFIG_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG_STORE_NAME);
        const request = store.delete(key);

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Error removing config item:', error);
          reject(error);
        };

        transaction.oncomplete = () => {
          console.log('Config item removed successfully:', key);
          resolve();
        };
      } catch (error) {
        console.error('Error in removeConfigItem transaction:', error);
        reject(error);
      }
    });
  }
}

// Make sure we export a singleton instance
const indexedDBServiceInstance = new IndexedDBService();
export const indexedDBService = indexedDBServiceInstance;

// Helper functions for the ConfigContext
export async function getItem(key: string): Promise<string | null> {
  return indexedDBService.getConfigItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  return indexedDBService.setConfigItem(key, value);
}