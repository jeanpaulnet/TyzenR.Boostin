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
  imageUrl916?: string;
  imageUrl169?: string;
  imageUrl11?: string;
  azureUrl916?: string;
  azureUrl169?: string;
  azureUrl11?: string;
  azureStatus916?: string;
  azureStatus169?: string;
  azureStatus11?: string;
}

export interface Settings {
  bizName: string;
  website: string;
  watermark: string;
  promptTemplate: string;
  commonTags: string;
}
