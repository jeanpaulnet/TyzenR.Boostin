export interface ScannedItem {
  id: string;
  url: string;
  title: string;
  description: string;
  imagePrompt: string;
  imageUrl: string;
  azureUrl: string;
  azureStatus: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  timestamp: number;
  pastImageUrls?: string[];
}

export interface Settings {
  bizName: string;
  website: string;
  watermark: string;
  promptTemplate: string;
  commonTags: string;
}
