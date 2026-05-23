import { uploadSettingsApi } from '../api/services';

export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 600 * 1024;

let cachedMaxUploadSizeBytes: number | null = null;
let inflightRequest: Promise<number> | null = null;

export async function getPlatformMaxUploadSizeBytes(forceRefresh = false): Promise<number> {
  if (!forceRefresh && cachedMaxUploadSizeBytes !== null) {
    return cachedMaxUploadSizeBytes;
  }

  if (!forceRefresh && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = uploadSettingsApi
    .get()
    .then((response) => {
      const value = response.data.maxUploadSizeBytes;
      cachedMaxUploadSizeBytes = value > 0 ? value : DEFAULT_MAX_UPLOAD_SIZE_BYTES;
      return cachedMaxUploadSizeBytes;
    })
    .catch(() => DEFAULT_MAX_UPLOAD_SIZE_BYTES)
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}

export function invalidatePlatformUploadSizeCache() {
  cachedMaxUploadSizeBytes = null;
}

export function formatUploadSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isFileSizeWithinLimit(file: File, maxBytes: number): boolean {
  return file.size <= maxBytes;
}
