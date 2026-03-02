export interface WorldEnvironmentCreateRequestBody {
  imageDataUrl: string;
  imageName?: string;
}

export interface WorldEnvironmentCreateResponse {
  operationId: string;
}

export interface WorldEnvironmentResult {
  worldId: string;
  worldMarbleUrl?: string;
  spzUrl: string;
  spzUrls: Record<string, string>;
  thumbnailUrl?: string;
}

export interface WorldEnvironmentStatusResponse {
  done: boolean;
  progress?: number;
  error?: string;
  result?: WorldEnvironmentResult;
}

export interface ParsedDataUrlImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  dataBase64: string;
}
