# 拉片工具

基于 Electron + React + FFmpeg 的本地拉片工作台。

## 当前 MVP

- 导入本地视频文件
- 播放、暂停、拖动时间轴、按秒前后移动
- 使用 FFmpeg 从原视频截取当前时间点的原分辨率 PNG 图片
- 截图列表管理
- 为单张截图添加备注和标签
- 保存项目为 `project.json`
- 批量导出截图、`notes.csv` 和项目数据

## 启动

```bash
npm.cmd install
npm.cmd start
```

如果在命令行启动，需要先进入项目目录：

```cmd
cd /d C:\Users\Administrator\Documents\拉片工具
npm.cmd start
```

## 打包为 exe

生成可直接运行的 Windows 应用文件夹：

```cmd
cd /d C:\Users\Administrator\Documents\拉片工具
npm.cmd run dist:dir
```

生成后双击：

```text
C:\Users\Administrator\Documents\拉片工具\release-adaptive-cinema-ui\win-unpacked\ShotStudyTool.exe
```

注意：`win-unpacked` 是一个完整应用文件夹，移动时要整个文件夹一起移动，不能只移动单独的 exe。

如果 Electron 下载失败，可以使用镜像重新安装：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm.cmd rebuild electron
```

## FFmpeg

项目默认使用 `@ffmpeg-installer/ffmpeg` 内置的 Windows FFmpeg。也可以通过环境变量指定自己的 FFmpeg：

```powershell
$env:FFMPEG_PATH='D:\tools\ffmpeg\bin\ffmpeg.exe'
npm.cmd start
```

## 项目数据

默认保存到系统文档目录下的 `拉片工具项目/<项目ID>/`，结构大致为：

```text
project.json
images/
```

导出时会生成：

```text
images/
notes.csv
notes.json
report.md
report.html
project.json
```

导出前可选择图片格式：

- `PNG 原图`：保留无损 PNG。
- `JPG 原图`：保持原分辨率，导出为高质量 JPG。

导出的 `notes.csv`、`notes.json`、`report.md`、`report.html` 会包含图片格式、宽高、文件大小和源截图路径。

## 下一步建议

- 增加逐帧前进/后退
- 增加快捷键截图
- 增加镜号、景别、运镜、光线等结构化拉片字段
- 增加图片标注
- 增加 PDF / Word 图文报告导出
