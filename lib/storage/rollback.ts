export interface RollbackState {
  originalBlobUrl?: string;
  generatedBlobUrl?: string;

  originalImageId?: string;
  generatedImageId?: string;

  generationId?: string;
}