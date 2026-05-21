# Shot Study Tool 拉片工具

一个面向拉片、截图整理、画面备注和素材管理的本地桌面工具。  
当前版本以 Windows 桌面应用为主，基于 Electron、React 和 FFmpeg 构建。

## 当前状态

项目处于早期可用版本，已经支持完整的「导入影片 -> 截图 -> 备注/打标签 -> 素材库管理 -> 导出」流程。

适合用于：

- 电影、剧集、广告、MV 的画面分析。
- 按时间码截取原画质图片。
- 给截图记录构图、运镜、光线、调度等备注。
- 建立自己的拉片截图素材库。
- 将截图导出给 Eagle、Billfish 等图片管理软件继续整理。

## 下载使用

普通用户不需要安装 Node.js，也不需要运行命令。

前往 GitHub Releases 下载最新版 Windows 包：

```text
ShotStudyTool Setup <version>.exe
```

或下载便携版：

```text
ShotStudyTool <version>.exe
```

建议优先使用安装版。便携版适合临时测试或放在移动硬盘中使用。

## 主要功能

- 导入本地视频文件。
- 显示当前时间码和视频总时长。
- 播放、暂停、拖动进度条、前后跳秒。
- 放大播放区，专注查看画面细节。
- 添加时间轴标记，并点击标记快速跳转。
- 使用 FFmpeg 截取当前帧，保留原视频分辨率。
- 截图列表支持筛选、排序、单张导出、批量删除。
- 右侧备注面板可收起。
- 单张截图支持备注、描述、标签。
- 全局图片素材库保留所有已截取图片。
- 素材库支持按项目、标签、关键词筛选。
- 素材库图片可编辑备注和标签。
- 支持导出 PNG 或 JPG 图片。
- 支持普通图片导出、Eagle 导出、Billfish 导出。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `←` / `→` | 后退 / 前进 1 秒 |
| `Shift + ←` / `Shift + →` | 后退 / 前进 5 秒 |
| `,` / `.` | 微调前后约 0.04 秒 |
| `C` | 截图 |
| `M` | 添加标记 |
| `F` | 放大 / 退出放大播放区 |
| `Esc` | 退出放大播放区 |
| `Ctrl + S` | 保存项目 |

在备注、标签、搜索框里输入文字时，快捷键不会误触发。

## 数据保存

项目数据和截图默认保存在本机应用数据目录中。  
每个项目大致包含：

```text
project.json
images/
```

导出时可生成：

```text
images/
notes.csv
notes.json
report.md
report.html
project.json
metadata.json
eagle-tags.csv
billfish-metadata.csv
billfish-metadata.json
```

## 开发运行

```bash
npm.cmd install
npm.cmd start
```

## 构建 Windows 应用

```bash
npm.cmd run dist
```

构建产物会生成到：

```text
release/
```

其中包含安装版和便携版。

## FFmpeg

项目默认使用 `@ffmpeg-installer/ffmpeg` 内置的 Windows FFmpeg。

如需使用自定义 FFmpeg：

```powershell
$env:FFMPEG_PATH='<path-to-ffmpeg.exe>'
npm.cmd start
```

## 后续计划

- 优化素材库批量编辑能力。
- 增加更多结构化拉片字段。
- 增加更完整的报告导出模板。
- 优化大视频加载和连续截图性能。
- 增加自动更新或版本提示。
