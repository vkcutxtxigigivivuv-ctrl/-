import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  CaptureFrameResult,
  ExportProjectRequest,
  ExportProjectResult,
  LibraryImage,
  ProjectData,
  ProjectSummary,
  SaveCapturedFrameRequest,
  UpdateLibraryImageRequest,
  VideoSelection
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const isDevelopment = process.env.NODE_ENV === "development";
const projectRootName = "ShotStudyTool Projects";

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#111318",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDevelopment) {
    window.loadURL("http://127.0.0.1:5173");
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"));
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function fileUrl(filePath: string) {
  return pathToFileURL(filePath).toString();
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function getImageInfo(filePath: string) {
  const stat = await fs.stat(filePath);
  const size = nativeImage.createFromPath(filePath).getSize();
  return {
    width: size.width,
    height: size.height,
    sizeBytes: stat.size,
    format: path.extname(filePath).replace(".", "").toLowerCase()
  };
}

function projectDir(projectId = "default") {
  return path.join(app.getPath("documents"), projectRootName, projectId);
}

function projectRootDir() {
  return path.join(app.getPath("documents"), projectRootName);
}

function projectFile(projectDirectory: string) {
  return path.join(projectDirectory, "project.json");
}

function toSummary(project: ProjectData): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    projectDir: project.projectDir || projectDir(project.id),
    videoName: project.video?.name,
    videoPath: project.video?.path,
    shotCount: project.shots.length,
    updatedAt: project.updatedAt
  };
}

async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const root = projectRootDir();
  await ensureDir(root);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const content = await fs.readFile(projectFile(path.join(root, entry.name)), "utf-8");
          return toSummary(JSON.parse(content) as ProjectData);
        } catch {
          return null;
        }
      })
  );

  return summaries
    .filter((summary): summary is ProjectSummary => Boolean(summary))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function listProjects(): Promise<ProjectData[]> {
  const root = projectRootDir();
  await ensureDir(root);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const projectDirectory = path.join(root, entry.name);
          const project = JSON.parse(await fs.readFile(projectFile(projectDirectory), "utf-8")) as ProjectData;
          return { ...project, projectDir: project.projectDir || projectDirectory };
        } catch {
          return null;
        }
      })
  );

  return projects.filter((project): project is ProjectData & { projectDir: string } => Boolean(project));
}

async function listLibraryImages(): Promise<LibraryImage[]> {
  const projects = await listProjects();
  return projects
    .flatMap((project) =>
      project.shots.map((shot) => ({
        id: shot.id,
        projectId: project.id,
        projectTitle: project.title,
        imagePath: shot.imagePath,
        imageUrl: fileUrl(shot.imagePath),
        time: shot.time,
        timecode: shot.timecode,
        note: shot.note,
        tags: shot.tags,
        createdAt: shot.createdAt,
        videoName: project.video?.name
      }))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function toLibraryImage(project: ProjectData, shot: ProjectData["shots"][number]): LibraryImage {
  return {
    id: shot.id,
    projectId: project.id,
    projectTitle: project.title,
    imagePath: shot.imagePath,
    imageUrl: fileUrl(shot.imagePath),
    time: shot.time,
    timecode: shot.timecode,
    note: shot.note,
    tags: shot.tags,
    createdAt: shot.createdAt,
    videoName: project.video?.name
  };
}

function formatTimestamp(seconds: number) {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return `${String(hh).padStart(2, "0")}-${String(mm).padStart(2, "0")}-${String(ss).padStart(2, "0")}-${String(ms).padStart(3, "0")}`;
}

function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }

  try {
    const ffmpegPath = (require("@ffmpeg-installer/ffmpeg") as { path: string }).path;
    return ffmpegPath.replace("app.asar", "app.asar.unpacked");
  } catch {
    return "ffmpeg";
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath();
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`Cannot start FFmpeg: ${ffmpegPath}\n${error.message}`));
    });
    child.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with code ${code}`));
    });
  });
}

ipcMain.handle("video:select", async (event): Promise<VideoSelection | null> => {
  const options = {
    title: "选择视频",
    properties: ["openFile"],
    filters: [
      { name: "视频文件", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"] },
      { name: "所有文件", extensions: ["*"] }
    ]
  } satisfies Electron.OpenDialogOptions;
  const parent = BrowserWindow.fromWebContents(event.sender);
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const videoPath = result.filePaths[0];
  const stat = await fs.stat(videoPath);
  return {
    path: videoPath,
    url: fileUrl(videoPath),
    name: path.basename(videoPath),
    size: stat.size
  };
});

ipcMain.handle("video:save-captured-frame", async (_event, request: SaveCapturedFrameRequest): Promise<CaptureFrameResult> => {
  const imageDir = path.join(request.projectDir || projectDir(), "images");
  await ensureDir(imageDir);

  const fileName = `${path.parse(request.videoName).name}_${formatTimestamp(request.time)}.png`;
  const outputPath = path.join(imageDir, fileName);
  const base64 = request.dataUrl.replace(/^data:image\/png;base64,/, "");
  await fs.writeFile(outputPath, Buffer.from(base64, "base64"));

  return { path: outputPath, url: fileUrl(outputPath), fileName };
});

ipcMain.handle("project:save", async (_event, project: ProjectData) => {
  const targetDir = project.projectDir || projectDir(project.id);
  await ensureDir(targetDir);

  const savedProject = { ...project, projectDir: targetDir };
  const filePath = path.join(targetDir, "project.json");
  await fs.writeFile(filePath, JSON.stringify(savedProject, null, 2), "utf-8");

  return { project: savedProject, filePath };
});

ipcMain.handle("project:list", async (): Promise<ProjectSummary[]> => {
  return listProjectSummaries();
});

ipcMain.handle("project:load", async (_event, projectDirectory: string): Promise<ProjectData> => {
  return JSON.parse(await fs.readFile(projectFile(projectDirectory), "utf-8")) as ProjectData;
});

ipcMain.handle("library:list-images", async (): Promise<LibraryImage[]> => {
  return listLibraryImages();
});

ipcMain.handle("library:update-image", async (_event, request: UpdateLibraryImageRequest): Promise<LibraryImage> => {
  const projects = await listProjects();
  const project = projects.find((item) => item.id === request.projectId);
  if (!project || !project.projectDir) {
    throw new Error("找不到图片所属项目");
  }

  const shotIndex = project.shots.findIndex((shot) => shot.id === request.shotId);
  if (shotIndex < 0) {
    throw new Error("找不到要更新的图片");
  }

  project.shots[shotIndex] = {
    ...project.shots[shotIndex],
    note: request.note ?? project.shots[shotIndex].note,
    tags: request.tags ?? project.shots[shotIndex].tags
  };
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(projectFile(project.projectDir), JSON.stringify(project, null, 2), "utf-8");

  return toLibraryImage(project, project.shots[shotIndex]);
});

ipcMain.handle("file:reveal", async (_event, filePath: string): Promise<void> => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("project:open", async (event): Promise<ProjectData | null> => {
  const options = {
    title: "打开拉片项目",
    properties: ["openFile"],
    filters: [{ name: "拉片项目", extensions: ["json"] }]
  } satisfies Electron.OpenDialogOptions;
  const parent = BrowserWindow.fromWebContents(event.sender);
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return JSON.parse(await fs.readFile(result.filePaths[0], "utf-8")) as ProjectData;
});

ipcMain.handle("project:export", async (event, request: ExportProjectRequest): Promise<ExportProjectResult | null> => {
  const options = {
    title: "选择导出目录",
    properties: ["openDirectory", "createDirectory"]
  } satisfies Electron.OpenDialogOptions;
  const parent = BrowserWindow.fromWebContents(event.sender);
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const exportDir = result.filePaths[0];
  const imageDir = path.join(exportDir, "images");
  const imageFormat = request.imageFormat || "png";
  await ensureDir(imageDir);

  const selectedIds = new Set(request.shotIds);
  const shotsToExport = request.shotIds?.length
    ? request.project.shots.filter((shot) => selectedIds.has(shot.id))
    : request.project.shots;
  const files: string[] = [];
  const metadataRows = [["filename", "timecode", "tags", "note", "sourceImagePath"]];
  const metadataItems = [];

  for (const shot of shotsToExport) {
    const imageName = `${path.parse(shot.imagePath).name}.${imageFormat}`;
    const outputImagePath = path.join(imageDir, imageName);

    if (imageFormat === "png" && path.extname(shot.imagePath).toLowerCase() === ".png") {
      await fs.copyFile(shot.imagePath, outputImagePath);
    } else {
      await runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        shot.imagePath,
        ...(imageFormat === "jpg" ? ["-q:v", "2"] : []),
        "-y",
        outputImagePath
      ]);
    }

    await getImageInfo(outputImagePath);
    files.push(`images/${imageName}`);
    metadataRows.push([
      imageName,
      shot.timecode,
      shot.tags.join(", "),
      shot.note.replace(/\r?\n/g, " "),
      shot.imagePath
    ]);
    metadataItems.push({
      name: imageName,
      path: `images/${imageName}`,
      tags: shot.tags,
      annotation: shot.note,
      notes: shot.note,
      url: "",
      timecode: shot.timecode,
      sourceImagePath: shot.imagePath
    });
  }

  if (request.preset === "eagle") {
    await fs.writeFile(
      path.join(exportDir, "metadata.json"),
      JSON.stringify({ version: "1.0", source: "ShotStudyTool", items: metadataItems }, null, 2),
      "utf-8"
    );
    await fs.writeFile(
      path.join(exportDir, "eagle-tags.csv"),
      `\ufeff${metadataRows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`,
      "utf-8"
    );
  }

  if (request.preset === "billfish") {
    await fs.writeFile(
      path.join(exportDir, "billfish-metadata.csv"),
      `\ufeff${metadataRows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(exportDir, "billfish-metadata.json"),
      JSON.stringify({ source: "ShotStudyTool", items: metadataItems }, null, 2),
      "utf-8"
    );
  }

  await shell.openPath(exportDir);

  return { exportDir, files };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
