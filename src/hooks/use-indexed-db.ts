import { useCallback, useEffect, useState } from 'react';

// Define the database structure and versions
const DB_NAME = 'landlordCache';
const DB_VERSION = 1;
const STORES = {
  places: 'places',
  reviews: 'reviews',
  timestamps: 'timestamps'
};

// Type for cached data timestamp tracking
interface CacheTimestamp {
  key: string;
  timestamp: number;
  expiresAt: number;
}

export function useIndexedDB() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize the database
  useEffect(() => {
    let isMounted = true;
    
    const initDB = async () => {
      try {
        // Check if IndexedDB is supported
        if (!('indexedDB' in window)) {
          throw new Error('IndexedDB not supported in this browser');
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains(STORES.places)) {
            db.createObjectStore(STORES.places, { keyPath: 'id' });
          }
          
          if (!db.objectStoreNames.contains(STORES.reviews)) {
            const reviewStore = db.createObjectStore(STORES.reviews, { keyPath: 'id' });
            // Create an index for faster querying reviews by place_id
            reviewStore.createIndex('place_id', 'place_id', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(STORES.timestamps)) {
            db.createObjectStore(STORES.timestamps, { keyPath: 'key' });
          }
        };
        
        request.onsuccess = (event) => {
          if (!isMounted) return;
          
          const database = (event.target as IDBOpenDBRequest).result;
          setDb(database);
          setIsReady(true);
          console.log('IndexedDB initialized successfully');
        };
        
        request.onerror = (event) => {
          if (!isMounted) return;
          
          const error = new Error(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error?.message}`);
          setError(error);
          console.error('IndexedDB initialization error:', error);
        };
      } catch (err) {
        if (!isMounted) return;
        
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error setting up IndexedDB:', err);
      }
    };
    
    initDB();
    
    return () => {
      isMounted = false;
      // Close the database connection when the component unmounts
      if (db) {
        db.close();
      }
    };
  }, []);

  // Set cache timestamp
  const setCacheTimestamp = useCallback(async (key: string, expiryMinutes: number = 60) => {
    if (!db || !isReady) return;
    
    try {
      const timestamp = Date.now();
      const expiresAt = timestamp + (expiryMinutes * 60 * 1000);
      
      const transaction = db.transaction(STORES.timestamps, 'readwrite');
      const store = transaction.objectStore(STORES.timestamps);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ key, timestamp, expiresAt });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return timestamp;
    } catch (err) {
      console.error('Error setting cache timestamp:', err);
      throw err;
    }
  }, [db, isReady]);

  // Check if cache is valid
  const isCacheValid = useCallback(async (key: string, maxAgeMinutes: number = 60): Promise<boolean> => {
    if (!db || !isReady) return false;
    
    try {
      const transaction = db.transaction(STORES.timestamps, 'readonly');
      const store = transaction.objectStore(STORES.timestamps);
      
      const timestampRecord = await new Promise<CacheTimestamp | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (!timestampRecord) return false;
      
      const now = Date.now();
      const maxAge = maxAgeMinutes * 60 * 1000;
      const isValid = now < timestampRecord.expiresAt && (now - timestampRecord.timestamp) < maxAge;
      
      return isValid;
    } catch (err) {
      console.error('Error checking cache validity:', err);
      return false;
    }
  }, [db, isReady]);

  // Get cache timestamp
  const getCacheTimestamp = useCallback(async (key: string): Promise<number | null> => {
    if (!db || !isReady) return null;
    
    try {
      const transaction = db.transaction(STORES.timestamps, 'readonly');
      const store = transaction.objectStore(STORES.timestamps);
      
      const timestampRecord = await new Promise<CacheTimestamp | undefined>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return timestampRecord ? timestampRecord.timestamp : null;
    } catch (err) {
      console.error('Error getting cache timestamp:', err);
      return null;
    }
  }, [db, isReady]);

  // Store places in IndexedDB
  const storePlaces = useCallback(async (places: any[], cacheDurationMinutes: number = 60) => {
    if (!db || !isReady) return;
    
    try {
      const transaction = db.transaction([STORES.places, STORES.timestamps], 'readwrite');
      const placesStore = transaction.objectStore(STORES.places);
      
      // Clear existing places
      await new Promise<void>((resolve, reject) => {
        const clearRequest = placesStore.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
      
      // Add all places
      for (const place of places) {
        await new Promise<void>((resolve, reject) => {
          const request = placesStore.add(place);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      // Update timestamp
      await setCacheTimestamp('places', cacheDurationMinutes);
      
      console.log(`Cached ${places.length} places in IndexedDB`);
      return true;
    } catch (err) {
      console.error('Error storing places in IndexedDB:', err);
      return false;
    }
  }, [db, isReady, setCacheTimestamp]);

  // Store reviews in IndexedDB
  const storeReviews = useCallback(async (reviews: any[], cacheDurationMinutes: number = 60) => {
    if (!db || !isReady) return;
    
    try {
      const transaction = db.transaction([STORES.reviews, STORES.timestamps], 'readwrite');
      const reviewsStore = transaction.objectStore(STORES.reviews);
      
      // Clear existing reviews
      await new Promise<void>((resolve, reject) => {
        const clearRequest = reviewsStore.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
      
      // Add all reviews
      for (const review of reviews) {
        await new Promise<void>((resolve, reject) => {
          const request = reviewsStore.add(review);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      // Update timestamp
      await setCacheTimestamp('reviews', cacheDurationMinutes);
      
      console.log(`Cached ${reviews.length} reviews in IndexedDB`);
      return true;
    } catch (err) {
      console.error('Error storing reviews in IndexedDB:', err);
      return false;
    }
  }, [db, isReady, setCacheTimestamp]);

  // Get places from IndexedDB
  const getPlaces = useCallback(async () => {
    if (!db || !isReady) return [];
    
    try {
      const transaction = db.transaction(STORES.places, 'readonly');
      const store = transaction.objectStore(STORES.places);
      
      const places = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return places;
    } catch (err) {
      console.error('Error getting places from IndexedDB:', err);
      return [];
    }
  }, [db, isReady]);

  // Get reviews from IndexedDB, optionally filtered by place IDs
  const getReviews = useCallback(async (placeIds?: string[]) => {
    if (!db || !isReady) return [];
    
    try {
      const transaction = db.transaction(STORES.reviews, 'readonly');
      const store = transaction.objectStore(STORES.reviews);
      
      // If no place IDs are provided, get all reviews
      if (!placeIds || placeIds.length === 0) {
        const reviews = await new Promise<any[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        return reviews;
      }
      
      // Otherwise, get reviews for specific places
      const index = store.index('place_id');
      const allReviews: any[] = [];
      
      // Get reviews for each place ID
      for (const placeId of placeIds) {
        const placeReviews = await new Promise<any[]>((resolve, reject) => {
          const request = index.getAll(placeId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        allReviews.push(...placeReviews);
      }
      
      return allReviews;
    } catch (err) {
      console.error('Error getting reviews from IndexedDB:', err);
      return [];
    }
  }, [db, isReady]);

  // Clear all cached data
  const clearCache = useCallback(async () => {
    if (!db || !isReady) return;
    
    try {
      const transaction = db.transaction([STORES.places, STORES.reviews, STORES.timestamps], 'readwrite');
      
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(STORES.places).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(STORES.reviews).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
        new Promise<void>((resolve, reject) => {
          const request = transaction.objectStore(STORES.timestamps).clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
      ]);
      
      console.log('IndexedDB cache cleared');
      return true;
    } catch (err) {
      console.error('Error clearing IndexedDB cache:', err);
      return false;
    }
  }, [db, isReady]);

  return {
    isReady,
    error,
    isCacheValid,
    getCacheTimestamp,
    storePlaces,
    storeReviews,
    getPlaces,
    getReviews,
    clearCache
  };
} 