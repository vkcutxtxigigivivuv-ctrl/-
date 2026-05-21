import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Camera,
  Download,
  FilePlus2,
  Flag,
  FolderOpen,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Save,
  Image,
  Trash2,
  Video
} from "lucide-react";
import type {
  ExportImageFormat,
  ExportPreset,
  LibraryImage,
  MarkerItem,
  ProjectData,
  ProjectSummary,
  ShotItem
} from "./types";

type SortMode = "newest" | "oldest" | "timeAsc" | "timeDesc";
type ViewMode = "home" | "film" | "library";

const makeId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function createProject(): ProjectData {
  return {
    id: makeId(),
    title: "未命名拉片项目",
    shots: [],
    markers: [],
    updatedAt: now()
  };
}

function formatTime(seconds: number) {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function formatFileSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [project, setProject] = useState<ProjectData>(() => createProject());
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedLibraryImageId, setSelectedLibraryImageId] = useState<string | null>(null);
  const [checkedShotIds, setCheckedShotIds] = useState<string[]>([]);
  const [exportImageFormat, setExportImageFormat] = useState<ExportImageFormat>("png");
  const [exportPreset, setExportPreset] = useState<ExportPreset>("images");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [shotFilter, setShotFilter] = useState("");
  const [libraryProjectFilter, setLibraryProjectFilter] = useState("all");
  const [libraryTagFilter, setLibraryTagFilter] = useState("all");
  const [newTag, setNewTag] = useState("");
  const [isNoteCollapsed, setIsNoteCollapsed] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [status, setStatus] = useState("准备就绪");
  const [isBusy, setIsBusy] = useState(false);

  const markers = project.markers ?? [];
  const selectedShot = project.shots.find((shot) => shot.id === selectedShotId) ?? project.shots[0];
  const selectedLibraryImage =
    libraryImages.find((image) => image.id === selectedLibraryImageId) ?? libraryImages[0];
  const activeImage = viewMode === "library" ? selectedLibraryImage : selectedShot;
  const sceneImage =
    activeImage?.imageUrl ?? selectedLibraryImage?.imageUrl ?? selectedShot?.imageUrl ?? libraryImages[0]?.imageUrl;
  const sceneStyle = {
    "--scene-image": sceneImage ? `url("${sceneImage.replace(/"/g, '\\"')}")` : "none"
  } as CSSProperties;
  const visibleShots = useMemo(() => {
    const keyword = shotFilter.trim().toLowerCase();
    const filtered = keyword
      ? project.shots.filter((shot) =>
          [shot.timecode, shot.note, shot.tags.join(" ")].join(" ").toLowerCase().includes(keyword)
        )
      : project.shots;

    return [...filtered].sort((a, b) => {
      if (sortMode === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortMode === "timeAsc") return a.time - b.time;
      if (sortMode === "timeDesc") return b.time - a.time;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [project.shots, shotFilter, sortMode]);
  const visibleLibraryImages = useMemo(() => {
    const keyword = shotFilter.trim().toLowerCase();
    const filtered = libraryImages.filter((image) => {
      const matchesKeyword = keyword
        ? [image.timecode, image.note, image.tags.join(" "), image.projectTitle, image.videoName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      const matchesProject = libraryProjectFilter === "all" || image.projectId === libraryProjectFilter;
      const matchesTag = libraryTagFilter === "all" || image.tags.includes(libraryTagFilter);
      return matchesKeyword && matchesProject && matchesTag;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sortMode === "timeAsc") return a.time - b.time;
      if (sortMode === "timeDesc") return b.time - a.time;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [libraryImages, libraryProjectFilter, libraryTagFilter, shotFilter, sortMode]);
  const libraryProjects = useMemo(
    () =>
      Array.from(new Map(libraryImages.map((image) => [image.projectId, image.projectTitle])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [libraryImages]
  );
  const libraryTags = useMemo(
    () => Array.from(new Set(libraryImages.flatMap((image) => image.tags))).sort((a, b) => a.localeCompare(b)),
    [libraryImages]
  );

  useEffect(() => {
    refreshProjectList();
    refreshLibraryImages();
  }, []);

  function getBridge() {
    if (!window.shotStudy) {
      setStatus("桌面桥接未加载，请关闭旧窗口并打开新版 exe");
      throw new Error("桌面桥接未加载，请打开新版 ShotStudyTool.exe");
    }
    return window.shotStudy;
  }

  function updateProject(patch: Partial<ProjectData>) {
    setProject((current) => ({ ...current, ...patch, updatedAt: now() }));
  }

  async function refreshProjectList() {
    if (!window.shotStudy) return;
    setProjectList(await window.shotStudy.listProjects());
  }

  async function refreshLibraryImages() {
    if (!window.shotStudy) return;
    setLibraryImages(await window.shotStudy.listLibraryImages());
  }

  function setShots(updater: (shots: ShotItem[]) => ShotItem[]) {
    setProject((current) => ({ ...current, shots: updater(current.shots), updatedAt: now() }));
  }

  function setMarkers(updater: (markers: MarkerItem[]) => MarkerItem[]) {
    setProject((current) => ({ ...current, markers: updater(current.markers ?? []), updatedAt: now() }));
  }

  async function runTask(label: string, task: () => Promise<void>) {
    setIsBusy(true);
    setStatus(label);
    try {
      await task();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSelectVideo() {
    await runTask("正在选择视频...", async () => {
      const video = await getBridge().selectVideo();
      if (!video) {
        setStatus("已取消导入");
        return;
      }
      const nextProject = { ...createProject(), video, title: video.name, updatedAt: now() };
      const result = await getBridge().saveProject(nextProject);
      setProject(result.project);
      await refreshProjectList();
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setViewMode("film");
      setStatus(`已导入：${video.name}`);
    });
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!project.video || !video) {
      setStatus("请先导入视频");
      return;
    }
    if (!video.videoWidth || !video.videoHeight) {
      setStatus("视频尚未准备好，请稍等一秒再截图");
      return;
    }

    await runTask("正在快速截图...", async () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const time = video.currentTime;
      const result = await getBridge().saveCapturedFrame({
        dataUrl: canvas.toDataURL("image/png"),
        videoName: project.video!.name,
        time,
        projectDir: project.projectDir
      });
      const shot: ShotItem = {
        id: makeId(),
        imagePath: result.path,
        imageUrl: result.url,
        time,
        timecode: formatTime(time),
        note: "",
        tags: [],
        createdAt: now()
      };
      const updatedProject = { ...project, shots: [shot, ...project.shots], updatedAt: now() };
      setShots((shots) => [shot, ...shots]);
      setSelectedShotId(shot.id);
      await getBridge().saveProject(updatedProject);
      await refreshLibraryImages();
      await refreshProjectList();
      setStatus(`已截图：${shot.timecode}`);
    });
  }

  function updateShot(id: string, patch: Partial<ShotItem>) {
    setShots((shots) => shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)));
  }

  function deleteShot(id: string) {
    if (!window.confirm("确定删除这张截图吗？")) return;
    setShots((shots) => shots.filter((shot) => shot.id !== id));
    setCheckedShotIds((ids) => ids.filter((shotId) => shotId !== id));
    setSelectedShotId(null);
  }

  function deleteCheckedShots() {
    if (!window.confirm(`确定删除选中的 ${checkedShotIds.length} 张截图吗？`)) return;
    const ids = new Set(checkedShotIds);
    setShots((shots) => shots.filter((shot) => !ids.has(shot.id)));
    setCheckedShotIds([]);
    if (selectedShotId && ids.has(selectedShotId)) {
      setSelectedShotId(null);
    }
  }

  function toggleCheckedShot(id: string) {
    setCheckedShotIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  async function exportShots(shotIds?: string[]) {
    await runTask(shotIds?.length === 1 ? "正在导出当前图片..." : "正在导出图片...", async () => {
      const result = await getBridge().exportProject({
        project,
        imageFormat: exportImageFormat,
        preset: exportPreset,
        shotIds
      });
      setStatus(result ? `已导出 ${result.files.length} 张图片：${result.exportDir}` : "已取消导出");
    });
  }

  async function exportLibraryImages(images = visibleLibraryImages) {
    await runTask("正在导出素材库图片...", async () => {
      const exportProject: ProjectData = {
        id: "library-export",
        title: "素材库导出",
        shots: images.map((image) => ({
          id: image.id,
          imagePath: image.imagePath,
          imageUrl: image.imageUrl,
          time: image.time,
          timecode: image.timecode,
          note: image.note,
          tags: image.tags,
          createdAt: image.createdAt
        })),
        updatedAt: now()
      };
      const result = await getBridge().exportProject({
        project: exportProject,
        imageFormat: exportImageFormat,
        preset: exportPreset
      });
      setStatus(result ? `已导出 ${result.files.length} 张素材：${result.exportDir}` : "已取消导出");
    });
  }

  async function handleSaveProject() {
    await runTask("正在保存项目...", async () => {
      const result = await getBridge().saveProject(project);
      setProject(result.project);
      setSelectedLibraryImageId(null);
      await refreshLibraryImages();
      await refreshProjectList();
      setStatus(`项目已保存：${result.filePath}`);
    });
  }

  async function handleOpenProject() {
    await runTask("正在打开项目...", async () => {
      const opened = await getBridge().openProject();
      if (!opened) {
        setStatus("已取消打开");
        return;
      }
      setProject({ ...opened, markers: opened.markers ?? [] });
      setSelectedShotId(opened.shots[0]?.id ?? null);
      setViewMode("film");
      setStatus(`已打开项目：${opened.title}`);
    });
  }

  async function openProjectFromList(summary: ProjectSummary) {
    await runTask("正在打开影片项目...", async () => {
      const loaded = await getBridge().loadProject(summary.projectDir);
      setProject({ ...loaded, markers: loaded.markers ?? [] });
      setSelectedShotId(loaded.shots[0]?.id ?? null);
      setSelectedLibraryImageId(null);
      setViewMode("film");
      setStatus(`已打开：${loaded.title}`);
    });
  }

  async function openProjectForLibraryImage(image: LibraryImage) {
    const summary = projectList.find((item) => item.id === image.projectId);
    if (!summary) {
      setStatus("找不到图片所属项目，请刷新项目列表");
      return;
    }
    await runTask("正在打开图片所属项目...", async () => {
      const loaded = await getBridge().loadProject(summary.projectDir);
      setProject({ ...loaded, markers: loaded.markers ?? [] });
      setSelectedShotId(image.id);
      setSelectedLibraryImageId(null);
      setViewMode("film");
      setStatus(`已打开：${loaded.title}`);
    });
  }

  function updateLibraryDraft(id: string, patch: Partial<LibraryImage>) {
    setLibraryImages((images) => images.map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  async function saveLibraryImage(image: LibraryImage) {
    await runTask("正在保存素材描述...", async () => {
      const updated = await getBridge().updateLibraryImage({
        projectId: image.projectId,
        shotId: image.id,
        note: image.note,
        tags: image.tags
      });
      setLibraryImages((images) => images.map((item) => (item.id === updated.id ? updated : item)));
      await refreshProjectList();
      setStatus("素材描述已保存");
    });
  }

  async function revealActiveImage() {
    if (!activeImage) return;
    await getBridge().revealInFolder(activeImage.imagePath);
  }

  async function addLibraryTag() {
    if (!selectedLibraryImage) return;
    const tag = newTag.trim();
    if (!tag) return;

    const tags = Array.from(new Set([...selectedLibraryImage.tags, tag]));
    const nextImage = { ...selectedLibraryImage, tags };
    updateLibraryDraft(selectedLibraryImage.id, { tags });
    setNewTag("");
    await saveLibraryImage(nextImage);
  }

  function addMarker() {
    const markerTime = videoRef.current?.currentTime ?? currentTime;
    const marker: MarkerItem = {
      id: makeId(),
      time: markerTime,
      timecode: formatTime(markerTime),
      label: `标记 ${markers.length + 1}`,
      createdAt: now()
    };
    setMarkers((items) => [...items, marker].sort((a, b) => a.time - b.time));
    setStatus(`已添加标记：${marker.timecode}`);
  }

  function deleteMarker(id: string) {
    setMarkers((items) => items.filter((marker) => marker.id !== id));
  }

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? await video.play() : video.pause();
  }

  function step(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }

  function seek(time: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, time));
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
    }

    function handleShortcut(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.altKey) return;
      const key = event.key.toLowerCase();

      if (event.key === "Escape" && isVideoExpanded) {
        event.preventDefault();
        setIsVideoExpanded(false);
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (key === "s") {
          event.preventDefault();
          void handleSaveProject();
        }
        return;
      }

      if (viewMode !== "film" || !project.video) return;

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(event.shiftKey ? -5 : -1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(event.shiftKey ? 5 : 1);
        return;
      }

      if (key === "," || key === "<") {
        event.preventDefault();
        step(-0.04);
        return;
      }

      if (key === "." || key === ">") {
        event.preventDefault();
        step(0.04);
        return;
      }

      if (key === "c" && !isBusy) {
        event.preventDefault();
        void handleCapture();
        return;
      }

      if (key === "m") {
        event.preventDefault();
        addMarker();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        setIsVideoExpanded((value) => !value);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [duration, isVideoExpanded, project.video, viewMode, isBusy, currentTime]);

  if (viewMode === "home") {
    return (
      <main className={`home-shell ${sceneImage ? "has-scene" : ""}`} style={sceneStyle}>
        <section className="home-header">
          <Video size={32} />
          <div>
            <h1>拉片工具</h1>
            <p>导入影片进行截图分析，或进入图片素材库管理已保存截图。</p>
          </div>
        </section>
        <section className="home-actions">
          <button type="button" onClick={handleSelectVideo} disabled={isBusy}>
            <FilePlus2 size={22} />
            导入影片
          </button>
          <button type="button" onClick={() => setViewMode("library")} disabled={libraryImages.length === 0}>
            <Image size={22} />
            图片素材库
          </button>
          <button type="button" onClick={handleOpenProject} disabled={isBusy}>
            <FolderOpen size={22} />
            打开项目
          </button>
        </section>
        <section className="project-library">
          <div className="panel-heading">
            <h2>已导入影片</h2>
            <button type="button" onClick={refreshProjectList}>刷新</button>
          </div>
          <div className="project-list">
            {projectList.map((item) => (
              <button className="project-card" type="button" key={item.projectDir} onClick={() => openProjectFromList(item)}>
                <strong>{item.title}</strong>
                <span>{item.videoName || "未关联影片"}</span>
                <span>{item.shotCount} 张截图 · {new Date(item.updatedAt).toLocaleString()}</span>
              </button>
            ))}
            {projectList.length === 0 && <div className="empty-list">还没有导入过影片</div>}
          </div>
        </section>
        <p className="home-status">{status}</p>
      </main>
    );
  }

  return (
    <main className={`app-shell ${sceneImage ? "has-scene" : ""}`} style={sceneStyle}>
      <header className="topbar">
        <div className="brand">
          <Video size={22} />
          <div>
            <input
              className="project-title"
              value={project.title}
              onChange={(event) => updateProject({ title: event.target.value })}
              onBlur={handleSaveProject}
              aria-label="项目名称"
            />
            <p>{project.video ? `${project.video.name} · ${formatFileSize(project.video.size)}` : "还没有导入视频"}</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setViewMode("home")} title="返回首页">
            首页
          </button>
          <button type="button" onClick={() => setViewMode("film")} disabled={!project.video} title="影片页面">
            影片
          </button>
          <button type="button" onClick={() => setViewMode("library")} title="图片素材库">
            素材库
          </button>
          <button type="button" onClick={handleOpenProject} disabled={isBusy} title="打开项目">
            <FolderOpen size={18} />
          </button>
          <button type="button" onClick={handleSelectVideo} disabled={isBusy} title="导入视频">
            <FilePlus2 size={18} />
          </button>
          <button type="button" onClick={handleSaveProject} disabled={isBusy} title="保存项目">
            <Save size={18} />
          </button>
          <select
            className="format-select"
            value={exportImageFormat}
            onChange={(event) => setExportImageFormat(event.target.value as ExportImageFormat)}
            disabled={isBusy}
            aria-label="导出图片格式"
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
          <select
            className="format-select"
            value={exportPreset}
            onChange={(event) => setExportPreset(event.target.value as ExportPreset)}
            disabled={isBusy}
            aria-label="导出预设"
          >
            <option value="images">图片</option>
            <option value="eagle">Eagle</option>
            <option value="billfish">Billfish</option>
          </select>
          <button
            type="button"
            onClick={() => (viewMode === "library" ? exportLibraryImages() : exportShots())}
            disabled={isBusy || (viewMode === "library" ? visibleLibraryImages.length === 0 : project.shots.length === 0)}
            title={viewMode === "library" ? "导出当前筛选素材" : "导出全部图片"}
          >
            <Download size={18} />
          </button>
        </div>
      </header>

      <section
        className={`workspace ${isNoteCollapsed ? "note-hidden" : ""} ${viewMode === "library" ? "library-view" : ""} ${
          isVideoExpanded ? "video-expanded" : ""
        }`}
      >
        {viewMode === "film" && (
          <section className="player-panel">
            <div className="viewer">
              {project.video ? (
                <video
                  key={project.video.path}
                  ref={videoRef}
                  src={project.video.url}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                  onError={() => setStatus("视频加载失败，请换一个编码或格式试试")}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="empty-video">
                  <Video size={48} />
                  <span>导入视频后开始拉片</span>
                </div>
              )}
            </div>

            {markers.length > 0 && (
              <div className="marker-bar">
                {markers.map((marker) => (
                  <button type="button" key={marker.id} onClick={() => seek(marker.time)} title={marker.label}>
                    {marker.timecode}
                    <span
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMarker(marker.id);
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="transport">
              <button type="button" onClick={togglePlay} disabled={!project.video} title={isPlaying ? "暂停" : "播放"}>
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button type="button" onClick={() => step(-1)} disabled={!project.video} title="后退 1 秒，Shift 为 5 秒">
                -1s
              </button>
              <button type="button" onClick={() => step(1)} disabled={!project.video} title="前进 1 秒，Shift 为 5 秒">
                +1s
              </button>
              <div className="timeline-wrap">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.001}
                  value={currentTime}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value);
                    setCurrentTime(nextTime);
                    seek(nextTime);
                  }}
                  disabled={!project.video}
                  aria-label="时间轴"
                />
                {duration > 0 &&
                  markers.map((marker) => (
                    <button
                      className="timeline-marker"
                      key={marker.id}
                      type="button"
                      style={{ left: `${(marker.time / duration) * 100}%` }}
                      onClick={() => seek(marker.time)}
                      title={`${marker.label} · ${marker.timecode}`}
                    />
                  ))}
              </div>
              <output className="time-readout">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{duration ? formatTime(duration) : "00:00:00.000"}</span>
              </output>
              <button type="button" onClick={addMarker} disabled={!project.video} title="添加标记">
                <Flag size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsVideoExpanded((value) => !value)}
                disabled={!project.video}
                title={isVideoExpanded ? "退出放大" : "放大播放"}
              >
                {isVideoExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button className="capture-button" type="button" onClick={handleCapture} disabled={!project.video || isBusy} title="截图 C">
                <Camera size={18} />
                {isBusy ? "处理中" : "截图"}
              </button>
            </div>
            <p className="status-line">{status}</p>
          </section>
        )}

        <aside className="shot-list">
          <div className="panel-heading">
            <h2>截图</h2>
            <span>
              {viewMode === "library"
                ? `${visibleLibraryImages.length}/${libraryImages.length}`
                : `${visibleShots.length}/${project.shots.length}`}
            </span>
          </div>
          <div className="shot-tools">
            <input
              value={shotFilter}
              onChange={(event) => setShotFilter(event.target.value)}
              placeholder="筛选时间码、标签、备注"
            />
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="timeAsc">时间升序</option>
              <option value="timeDesc">时间降序</option>
            </select>
            {viewMode === "library" && (
              <>
                <select value={libraryProjectFilter} onChange={(event) => setLibraryProjectFilter(event.target.value)}>
                  <option value="all">全部项目</option>
                  {libraryProjects.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
                <select value={libraryTagFilter} onChange={(event) => setLibraryTagFilter(event.target.value)}>
                  <option value="all">全部标签</option>
                  {libraryTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShotFilter("");
                    setLibraryProjectFilter("all");
                    setLibraryTagFilter("all");
                  }}
                >
                  清空筛选
                </button>
                <button type="button" onClick={() => exportLibraryImages()} disabled={visibleLibraryImages.length === 0 || isBusy}>
                  <Download size={16} />
                  导出当前筛选
                </button>
              </>
            )}
            {viewMode === "film" && (
              <button type="button" onClick={deleteCheckedShots} disabled={checkedShotIds.length === 0} title="删除所选截图">
                <Trash2 size={16} />
                删除所选 {checkedShotIds.length || ""}
              </button>
            )}
          </div>
          <div className="shots">
            {(viewMode === "library"
              ? visibleLibraryImages.map((image) => ({
                  id: image.id,
                  imagePath: image.imagePath,
                  imageUrl: image.imageUrl,
                  time: image.time,
                  timecode: image.timecode,
                  note: image.note,
                  tags: image.tags,
                  createdAt: image.createdAt,
                  projectTitle: image.projectTitle,
                  videoName: image.videoName
                }))
              : visibleShots
            ).map((shot) => (
              <div
                className={`shot-card ${viewMode === "library" ? "library-card" : ""} ${
                  shot.id === (viewMode === "library" ? selectedLibraryImageId : selectedShot?.id) ? "active" : ""
                }`}
                key={shot.id}
              >
                {viewMode === "film" && (
                  <input
                    className="shot-check"
                    type="checkbox"
                    checked={checkedShotIds.includes(shot.id)}
                    onChange={() => toggleCheckedShot(shot.id)}
                    title="选择截图"
                  />
                )}
                <button
                  className="shot-main"
                  type="button"
                  title={`时间码：${shot.timecode}`}
                  aria-label={`选择截图 ${shot.timecode}`}
                  onClick={() => {
                    if (viewMode === "library") {
                      setSelectedLibraryImageId(shot.id);
                    } else {
                      setSelectedShotId(shot.id);
                    }
                  }}
                >
                  <img src={shot.imageUrl} alt={shot.timecode} />
                </button>
                {viewMode === "film" ? (
                  <>
                    <button type="button" onClick={() => exportShots([shot.id])} disabled={isBusy} title="单独导出这张图片">
                      <Download size={16} />
                    </button>
                    <button type="button" onClick={() => deleteShot(shot.id)} title="删除这张截图">
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : null}
              </div>
            ))}
            {(viewMode === "library" ? visibleLibraryImages.length === 0 : visibleShots.length === 0) && (
              <div className="empty-list" aria-label="没有匹配的截图" />
            )}
          </div>
        </aside>

        {!isNoteCollapsed && (
        <aside className="note-panel">
          <div className="panel-heading">
            <h2>备注</h2>
            <button type="button" onClick={() => setIsNoteCollapsed(true)} title="收起右侧栏">
              收起
            </button>
            {viewMode === "film" && selectedShot && (
              <button type="button" onClick={() => deleteShot(selectedShot.id)} title="删除截图">
                <Trash2 size={17} />
              </button>
            )}
          </div>

          {activeImage ? (
            <div className="note-editor">
              <img src={activeImage.imageUrl} alt={activeImage.timecode} />
              <label>
                时间码
                <input value={activeImage.timecode} readOnly />
              </label>
              {viewMode === "library" && typeof (activeImage as Partial<LibraryImage>).projectTitle === "string" && (
                <label>
                  所属项目
                  <input
                    value={`${(activeImage as Partial<LibraryImage>).projectTitle}${
                      (activeImage as Partial<LibraryImage>).videoName
                        ? ` · ${(activeImage as Partial<LibraryImage>).videoName}`
                        : ""
                    }`}
                    readOnly
                  />
                </label>
              )}
              {viewMode === "library" && selectedLibraryImage && (
                <button type="button" onClick={() => openProjectForLibraryImage(selectedLibraryImage)}>
                  打开所属项目
                </button>
              )}
              {viewMode === "library" && selectedLibraryImage && (
                <button type="button" onClick={revealActiveImage}>
                  在文件夹中显示
                </button>
              )}
              {viewMode === "library" && selectedLibraryImage && (
                <button type="button" onClick={() => exportLibraryImages([selectedLibraryImage])}>
                  导出这张素材
                </button>
              )}
              <label>
                标签
                <input
                  value={activeImage.tags.join(", ")}
                  onChange={(event) =>
                    viewMode === "library" && selectedLibraryImage
                      ? updateLibraryDraft(selectedLibraryImage.id, {
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean)
                        })
                      : selectedShot &&
                        updateShot(selectedShot.id, {
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean)
                        })
                  }
                  onBlur={() => viewMode === "library" && selectedLibraryImage && saveLibraryImage(selectedLibraryImage)}
                  onBlurCapture={() => viewMode === "film" && handleSaveProject()}
                  placeholder="构图, 运镜, 光线"
                />
              </label>
              {viewMode === "library" && selectedLibraryImage && (
                <div className="tag-adder">
                  <input
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addLibraryTag();
                      }
                    }}
                    placeholder="新增标签"
                  />
                  <button type="button" onClick={addLibraryTag}>添加标签</button>
                </div>
              )}
              <label>
                画面备注
                <textarea
                  value={activeImage.note}
                  onChange={(event) =>
                    viewMode === "library" && selectedLibraryImage
                      ? updateLibraryDraft(selectedLibraryImage.id, { note: event.target.value })
                      : selectedShot && updateShot(selectedShot.id, { note: event.target.value })
                  }
                  onBlur={() => viewMode === "library" && selectedLibraryImage && saveLibraryImage(selectedLibraryImage)}
                  onBlurCapture={() => viewMode === "film" && handleSaveProject()}
                  placeholder="记录景别、构图、调度、剪辑点或你的分析..."
                />
              </label>
            </div>
          ) : (
            <div className="empty-list">选择一张截图后添加备注</div>
          )}
        </aside>
        )}
        {isNoteCollapsed && (
          <button className="floating-expand" type="button" onClick={() => setIsNoteCollapsed(false)}>
            展开备注
          </button>
        )}
      </section>
    </main>
  );
}
