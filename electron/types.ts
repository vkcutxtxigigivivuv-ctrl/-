export type VideoSelection = {
  path: string;
  url: string;
  name: string;
  size: number;
};

export type ShotItem = {
  id: string;
  imagePath: string;
  imageUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  time: number;
  timecode: string;
  note: string;
  tags: string[];
  createdAt: string;
};

export type MarkerItem = {
  id: string;
  time: number;
  timecode: string;
  label: string;
  createdAt: string;
};

export type ProjectData = {
  id: string;
  title: string;
  projectDir?: string;
  video?: VideoSelection;
  shots: ShotItem[];
  markers?: MarkerItem[];
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  projectDir: string;
  videoName?: string;
  videoPath?: string;
  shotCount: number;
  updatedAt: string;
};

export type LibraryImage = {
  id: string;
  projectId: string;
  projectTitle: string;
  imagePath: string;
  imageUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  time: number;
  timecode: string;
  note: string;
  tags: string[];
  createdAt: string;
  videoName?: string;
};

export type UpdateLibraryImageRequest = {
  projectId: string;
  shotId: string;
  note?: string;
  tags?: string[];
};

export type ExportImageFormat = "png" | "jpg";
export type ExportPreset = "images" | "eagle" | "billfish";

export type SaveCapturedFrameRequest = {
  dataUrl: string;
  videoName: string;
  time: number;
  projectDir?: string;
};

export type CaptureFrameResult = {
  path: string;
  url: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  fileName: string;
};

export type ExportProjectRequest = {
  project: ProjectData;
  imageFormat: ExportImageFormat;
  preset: ExportPreset;
  shotIds?: string[];
};

export type ExportProjectResult = {
  exportDir: string;
  files: string[];
};

export type AppBridge = {
  selectVideo: () => Promise<VideoSelection | null>;
  saveCapturedFrame: (request: SaveCapturedFrameRequest) => Promise<CaptureFrameResult>;
  saveProject: (project: ProjectData) => Promise<{ project: ProjectData; filePath: string }>;
  openProject: () => Promise<ProjectData | null>;
  listProjects: () => Promise<ProjectSummary[]>;
  loadProject: (projectDir: string) => Promise<ProjectData>;
  listLibraryImages: () => Promise<LibraryImage[]>;
  updateLibraryImage: (request: UpdateLibraryImageRequest) => Promise<LibraryImage>;
  revealInFolder: (filePath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  exportProject: (request: ExportProjectRequest) => Promise<ExportProjectResult | null>;
};
