"use client";

import { FC, useEffect, useState } from 'react';

interface CacheControlBarProps {
  isCached: boolean;
  isFetchingFresh: boolean;
  lastUpdated?: number;
  onRefresh: () => Promise<boolean>;
  onClearCache: () => Promise<boolean>;
}

export const CacheControlBar: FC<CacheControlBarProps> = ({
  isCached,
  isFetchingFresh,
  lastUpdated,
  onRefresh,
  onClearCache
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('');
  
  // Convert timestamp to human-readable "time ago" format
  useEffect(() => {
    if (!lastUpdated) {
      setTimeAgo('');
      return;
    }
    
    const updateTimeAgo = () => {
      const now = Date.now();
      const diffMs = now - lastUpdated;
      
      // Convert to appropriate unit
      if (diffMs < 60000) { // Less than 1 minute
        setTimeAgo('just now');
      } else if (diffMs < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diffMs / 60000);
        setTimeAgo(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`);
      } else if (diffMs < 86400000) { // Less than 1 day
        const hours = Math.floor(diffMs / 3600000);
        setTimeAgo(`${hours} ${hours === 1 ? 'hour' : 'hours'} ago`);
      } else { // More than 1 day
        const days = Math.floor(diffMs / 86400000);
        setTimeAgo(`${days} ${days === 1 ? 'day' : 'days'} ago`);
      }
    };
    
    updateTimeAgo();
    
    // Update every minute
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await onClearCache();
    } finally {
      setIsClearing(false);
    }
  };
  
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm mb-4">
      <div className="flex items-center space-x-2">
        <StatusIndicator isOnline={!isCached} />
        <span className="font-medium">
          {isCached ? 'Using cached data' : 'Using live data'}
        </span>
        {timeAgo && (
          <span className="text-gray-500 dark:text-gray-400">
            • Last updated {timeAgo}
          </span>
        )}
        {isFetchingFresh && !isRefreshing && (
          <span className="text-blue-500 animate-pulse">
            • Refreshing in background...
          </span>
        )}
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRefreshing ? (
            <>
              <span className="inline-block animate-spin mr-1">↻</span>
              Refreshing...
            </>
          ) : (
            'Refresh Data'
          )}
        </button>
        
        <button
          onClick={handleClearCache}
          disabled={isClearing || !isCached}
          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {isClearing ? 'Clearing...' : 'Clear Cache'}
        </button>
      </div>
    </div>
  );
};

const StatusIndicator: FC<{ isOnline: boolean }> = ({ isOnline }) => {
  return (
    <div 
      className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`}
      title={isOnline ? 'Live Data' : 'Cached Data'}
    />
  );
}; 