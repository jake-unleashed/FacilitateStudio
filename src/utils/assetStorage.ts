/**
 * Asset Storage Utility
 * 
 * Manages storage and retrieval of 3D model assets using browser localStorage.
 * Handles asset metadata, base64 data encoding, and recent assets tracking.
 */

// Serialized version of ModelMetrics for storage (plain objects instead of THREE objects)
export interface SerializedModelMetrics {
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  bottomY: number;
  topY: number;
  maxDimension: number;
  triangleCount?: number;
}

export interface AssetMetadata {
  id: string;
  name: string;
  fileType: 'obj' | 'fbx' | 'glb' | 'gltf';
  fileSize: number;
  uploadDate: string; // ISO date string
  metrics?: SerializedModelMetrics;
}

export interface AssetData {
  base64Data: string;
  fileType: AssetMetadata['fileType'];
  metrics?: SerializedModelMetrics;
}

// Re-export for compatibility with existing code that imports ModelMetrics
export type ModelMetrics = SerializedModelMetrics;

const STORAGE_KEY_PREFIX = 'facilitate_asset_';
const METADATA_STORAGE_KEY = 'facilitate_asset_metadata';
const MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit (approximate)

// Conservative estimate: 5MB limit per origin (browsers typically allow 5-10MB)
const ESTIMATED_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB
const MIN_RECENT_ASSETS_TO_KEEP = 10; // Keep at least this many recent assets
const STORAGE_BUFFER_PERCENT = 0.1; // 10% buffer for safety

/**
 * Estimate current localStorage usage in bytes
 * Each character in localStorage is ~2 bytes (UTF-16 encoding)
 */
function estimateStorageUsage(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        // Each character in localStorage is ~2 bytes (UTF-16)
        total += key.length * 2 + value.length * 2;
      }
    }
  }
  return total;
}

/**
 * Estimate available storage space
 * Returns conservative estimate of remaining space
 */
function estimateAvailableSpace(): number {
  const used = estimateStorageUsage();
  return Math.max(0, ESTIMATED_STORAGE_LIMIT - used);
}

/**
 * Calculate the size of base64-encoded data
 * Base64 encoding increases size by ~33% (4/3 ratio)
 */
function calculateAssetSize(base64Data: string): number {
  // Base64 string length * 3/4 gives approximate original size
  // But we store it as base64, so actual storage is the string length * 2 bytes (UTF-16)
  return base64Data.length * 2;
}

/**
 * Calculate required space for a new asset
 * Includes file size (with base64 overhead), metadata, and buffer
 */
function calculateRequiredSpace(fileSize: number): number {
  // Base64 encoding increases size by ~33% (4/3 ratio)
  const base64Size = Math.ceil(fileSize * 4 / 3);
  // Storage uses UTF-16, so 2 bytes per character
  const storageSize = base64Size * 2;
  // Add buffer for metadata and safety margin
  const buffer = storageSize * STORAGE_BUFFER_PERCENT;
  return storageSize + buffer;
}

/**
 * Convert file to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/octet-stream;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get file extension and normalize to file type
 */
function getFileType(fileName: string): AssetMetadata['fileType'] {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (['obj'].includes(ext)) return 'obj';
  if (['fbx'].includes(ext)) return 'fbx';
  if (['glb'].includes(ext)) return 'glb';
  if (['gltf'].includes(ext)) return 'gltf';
  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Generate unique asset ID
 */
function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all stored asset metadata
 */
function getAllMetadata(): AssetMetadata[] {
  try {
    const stored = localStorage.getItem(METADATA_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[assetStorage] Error reading metadata:', error);
    return [];
  }
}

/**
 * Save all asset metadata
 */
function saveAllMetadata(metadata: AssetMetadata[]): void {
  try {
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('[assetStorage] Error saving metadata:', error);
    throw new Error('Failed to save asset metadata');
  }
}

/**
 * Upload and store an asset
 */
export async function uploadAndStoreAsset(file: File): Promise<AssetMetadata> {
  const fileType = getFileType(file.name);
  
  // Calculate required space before conversion (proactive cleanup)
  const requiredSpace = calculateRequiredSpace(file.size);
  
  // Proactively ensure we have enough space
  try {
    ensureStorageSpace(requiredSpace);
  } catch (error) {
    // If proactive cleanup failed, throw immediately with clear message
    throw error instanceof Error ? error : new Error('Insufficient storage space. Please free up space and try again.');
  }

  // Convert to base64
  const base64Data = await fileToBase64(file);
  const assetId = generateAssetId();

  // Create metadata
  const metadata: AssetMetadata = {
    id: assetId,
    name: file.name,
    fileType,
    fileSize: file.size,
    uploadDate: new Date().toISOString(),
  };

  // Store base64 data with retry logic
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount <= maxRetries) {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${assetId}`, base64Data);
      break; // Success, exit retry loop
    } catch (error) {
      // If storage quota exceeded, try iterative cleanup
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        if (retryCount < maxRetries) {
          console.warn(`[assetStorage] Storage quota exceeded (attempt ${retryCount + 1}/${maxRetries}), cleaning up more assets...`);
          
          // Calculate actual required space for base64 data
          const actualRequiredSpace = calculateAssetSize(base64Data) + (requiredSpace * STORAGE_BUFFER_PERCENT);
          const removed = cleanupOldAssetsUntilSpaceAvailable(actualRequiredSpace);
          
          if (removed === 0) {
            // No more assets to remove
            const allMetadata = getAllMetadata();
            if (allMetadata.length <= MIN_RECENT_ASSETS_TO_KEEP) {
              throw new Error(
                `Storage quota exceeded. Cannot free enough space even after removing old assets. ` +
                `Please delete some assets manually or use a smaller file.`
              );
            }
          }
          
          retryCount++;
        } else {
          // Max retries reached
          console.error('[assetStorage] Failed to store asset after multiple cleanup attempts');
          throw new Error(
            'Storage quota exceeded. Unable to free enough space after multiple attempts. ' +
            'Please delete some assets manually or use a smaller file.'
          );
        }
      } else {
        // Other error, don't retry
        throw error;
      }
    }
  }

  // Add to metadata list
  const allMetadata = getAllMetadata();
  allMetadata.push(metadata);
  saveAllMetadata(allMetadata);

  return metadata;
}

/**
 * Get asset data by ID
 */
export async function getAsset(assetId: string): Promise<AssetData | null> {
  try {
    // Get base64 data
    const base64Data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${assetId}`);
    if (!base64Data) {
      return null;
    }

    // Get metadata for fileType and metrics
    const allMetadata = getAllMetadata();
    const metadata = allMetadata.find((m) => m.id === assetId);
    if (!metadata) {
      return null;
    }

    return {
      base64Data,
      fileType: metadata.fileType,
      metrics: metadata.metrics,
    };
  } catch (error) {
    console.error('[assetStorage] Error getting asset:', error);
    return null;
  }
}

/**
 * Update asset metadata
 */
export function updateAssetMetadata(
  assetId: string,
  updates: Partial<AssetMetadata>
): void {
  const allMetadata = getAllMetadata();
  const index = allMetadata.findIndex((m) => m.id === assetId);
  
  if (index === -1) {
    console.warn(`[assetStorage] Asset not found: ${assetId}`);
    return;
  }

  // Update metadata
  allMetadata[index] = {
    ...allMetadata[index],
    ...updates,
    id: allMetadata[index].id, // Prevent ID changes
  };

  saveAllMetadata(allMetadata);
}

/**
 * Get recent assets (sorted by upload date, most recent first)
 */
export function getRecentAssets(limit: number = 20): AssetMetadata[] {
  const allMetadata = getAllMetadata();
  
  // Sort by upload date (most recent first)
  const sorted = [...allMetadata].sort((a, b) => {
    return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
  });

  return sorted.slice(0, limit);
}

/**
 * Test if we can actually write to localStorage
 * Attempts to write and immediately remove a test value
 * @param testSizeBytes - Size of test data to write (default: 1KB)
 * @returns true if write succeeded, false if quota exceeded
 */
function testStorageWrite(testSizeBytes: number = 1024): boolean {
  const testKey = '__facilitate_storage_test__';
  try {
    // Create test data of specified size
    const testData = 'x'.repeat(Math.floor(testSizeBytes / 2)); // Each char is ~2 bytes in UTF-16
    localStorage.setItem(testKey, testData);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    // Clean up test key if it was partially written
    try {
      localStorage.removeItem(testKey);
    } catch {
      // Ignore cleanup errors
    }
    return false;
  }
}

/**
 * Clean up old assets until sufficient space is available
 * Removes oldest assets iteratively until required space is freed
 * Uses actual write tests instead of estimates for accuracy
 * @param requiredBytes - Amount of space needed in bytes
 * @returns Number of assets removed
 */
function cleanupOldAssetsUntilSpaceAvailable(requiredBytes: number): number {
  const allMetadata = getAllMetadata();
  
  if (allMetadata.length === 0) {
    return 0;
  }

  // Sort by upload date (oldest first)
  const sorted = [...allMetadata].sort((a, b) => {
    return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
  });

  // Start with keeping minimum, but allow reducing if needed
  let minToKeep = Math.min(MIN_RECENT_ASSETS_TO_KEEP, sorted.length);
  let maxToRemove = sorted.length - minToKeep;

  if (maxToRemove <= 0) {
    // Can't remove any assets (would go below minimum)
    return 0;
  }

  let removedCount = 0;
  let attempts = 0;
  const maxAttempts = sorted.length; // Safety limit

  // Remove assets in batches and test if we have space
  // Remove 25% at a time for efficiency, then test
  while (removedCount < maxToRemove && attempts < maxAttempts) {
    // Calculate batch size: remove 25% of remaining, or at least 1
    const remainingCount = sorted.length - removedCount;
    const batchSize = Math.max(1, Math.floor(remainingCount * 0.25));
    const actualBatchSize = Math.min(batchSize, maxToRemove - removedCount);

    // Remove batch of assets
    for (let i = 0; i < actualBatchSize; i++) {
      const assetToRemove = sorted[removedCount + i];
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${assetToRemove.id}`);
    }

    removedCount += actualBatchSize;

    // Update metadata after batch removal
    const remainingAssets = sorted.slice(removedCount);
    saveAllMetadata(remainingAssets);

    // Test if we can now write (use a test size similar to what we need)
    // Use a smaller test size for efficiency, but proportional to required
    const testSize = Math.min(requiredBytes, 100 * 1024); // Test with up to 100KB
    if (testStorageWrite(testSize)) {
      // Success! We have space now
      console.log(`[assetStorage] Cleaned up ${removedCount} old asset(s). Storage test passed.`);
      return removedCount;
    }

    attempts++;
    
    // If we've removed everything except minimum, try reducing minimum
    if (removedCount >= maxToRemove && minToKeep > 0) {
      minToKeep = Math.max(0, minToKeep - 5); // Reduce minimum by 5
      maxToRemove = sorted.length - minToKeep;
    }
  }

  // Final test after all removals
  const finalTestSize = Math.min(requiredBytes, 100 * 1024);
  if (!testStorageWrite(finalTestSize)) {
    console.warn(`[assetStorage] Cleaned up ${removedCount} asset(s) but storage test still fails.`);
  } else {
    console.log(`[assetStorage] Cleaned up ${removedCount} old asset(s). Storage test passed.`);
  }

  return removedCount;
}

/**
 * Ensure sufficient storage space is available before upload
 * Proactively cleans up old assets if needed
 * Uses actual write tests instead of estimates for accuracy
 * @param requiredBytes - Amount of space needed in bytes
 * @throws Error if insufficient space even after cleanup
 */
function ensureStorageSpace(requiredBytes: number): void {
  // First, test if we can write a value of similar size
  const testSize = Math.min(requiredBytes, 100 * 1024); // Test with up to 100KB for efficiency
  const canWrite = testStorageWrite(testSize);

  if (!canWrite) {
    // Storage is full, need to cleanup
    const currentUsed = estimateStorageUsage();
    const estimatedLimit = ESTIMATED_STORAGE_LIMIT;
    const usagePercent = (currentUsed / estimatedLimit) * 100;
    
    console.log(`[assetStorage] Storage full (${usagePercent.toFixed(1)}% estimated). Required: ${(requiredBytes / 1024 / 1024).toFixed(2)}MB. Cleaning up...`);
    
    const removed = cleanupOldAssetsUntilSpaceAvailable(requiredBytes);
    
    // Test again after cleanup
    const canWriteAfterCleanup = testStorageWrite(testSize);
    
    if (!canWriteAfterCleanup) {
      const allMetadata = getAllMetadata();
      if (allMetadata.length === 0) {
        throw new Error(
          `Insufficient storage space. All assets have been removed, but storage is still full. ` +
          `This may indicate other data is using localStorage. Please clear browser storage or use a smaller file.`
        );
      } else if (allMetadata.length <= MIN_RECENT_ASSETS_TO_KEEP) {
        throw new Error(
          `Insufficient storage space. Removed all but ${allMetadata.length} recent asset(s), but still need ${(requiredBytes / 1024 / 1024).toFixed(2)}MB. ` +
          `Please delete some assets manually or use a smaller file.`
        );
      } else {
        throw new Error(
          `Insufficient storage space. Cleaned up ${removed} asset(s), but still need more space. ` +
          `Please delete some assets manually or use a smaller file.`
        );
      }
    } else {
      console.log(`[assetStorage] Cleanup successful. Storage test passed after removing ${removed} asset(s).`);
    }
  }
}

/**
 * Delete an asset
 */
export function deleteAsset(assetId: string): void {
  // Remove base64 data
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${assetId}`);

  // Remove from metadata
  const allMetadata = getAllMetadata();
  const filtered = allMetadata.filter((m) => m.id !== assetId);
  saveAllMetadata(filtered);
}

/**
 * Storage statistics for debugging and monitoring
 */
export interface StorageStats {
  totalAssets: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  estimatedUsedBytes: number;
  estimatedUsedMB: number;
  estimatedAvailableBytes: number;
  estimatedAvailableMB: number;
  estimatedLimitBytes: number;
  estimatedLimitMB: number;
  usagePercent: number;
  oldestAsset: AssetMetadata | null;
  newestAsset: AssetMetadata | null;
}

/**
 * Get current storage statistics
 * Useful for debugging and future UI features
 */
export function getStorageStats(): StorageStats {
  const allMetadata = getAllMetadata();
  const estimatedUsed = estimateStorageUsage();
  const estimatedAvailable = estimateAvailableSpace();
  const estimatedLimit = ESTIMATED_STORAGE_LIMIT;
  const usagePercent = (estimatedUsed / estimatedLimit) * 100;

  // Calculate total size of assets (rough estimate based on fileSize)
  const totalSizeBytes = allMetadata.reduce((sum, asset) => sum + asset.fileSize, 0);

  // Find oldest and newest assets
  let oldestAsset: AssetMetadata | null = null;
  let newestAsset: AssetMetadata | null = null;

  if (allMetadata.length > 0) {
    const sorted = [...allMetadata].sort((a, b) => {
      return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
    });
    oldestAsset = sorted[0];
    newestAsset = sorted[sorted.length - 1];
  }

  return {
    totalAssets: allMetadata.length,
    totalSizeBytes,
    totalSizeMB: totalSizeBytes / 1024 / 1024,
    estimatedUsedBytes: estimatedUsed,
    estimatedUsedMB: estimatedUsed / 1024 / 1024,
    estimatedAvailableBytes: estimatedAvailable,
    estimatedAvailableMB: estimatedAvailable / 1024 / 1024,
    estimatedLimitBytes: estimatedLimit,
    estimatedLimitMB: estimatedLimit / 1024 / 1024,
    usagePercent,
    oldestAsset,
    newestAsset,
  };
}

/**
 * Storage health status
 */
export interface StorageHealth {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  usagePercent: number;
  canStoreFile: (fileSizeBytes: number) => boolean;
}

/**
 * Get storage health status
 * Returns health status with warnings if storage is getting full
 */
export function getStorageHealth(): StorageHealth {
  const stats = getStorageStats();
  const usagePercent = stats.usagePercent;

  let status: 'healthy' | 'warning' | 'critical';
  let message: string;

  if (usagePercent >= 95) {
    status = 'critical';
    message = `Storage is critically full (${usagePercent.toFixed(1)}% used). Uploads may fail.`;
  } else if (usagePercent >= 80) {
    status = 'warning';
    message = `Storage is getting full (${usagePercent.toFixed(1)}% used). Consider deleting old assets.`;
  } else {
    status = 'healthy';
    message = `Storage usage: ${usagePercent.toFixed(1)}%`;
  }

  // Function to check if a file can be stored
  const canStoreFile = (fileSizeBytes: number): boolean => {
    const requiredSpace = calculateRequiredSpace(fileSizeBytes);
    return stats.estimatedAvailableBytes >= requiredSpace || stats.totalAssets > MIN_RECENT_ASSETS_TO_KEEP;
  };

  return {
    status,
    message,
    usagePercent,
    canStoreFile,
  };
}
