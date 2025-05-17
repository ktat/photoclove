# PhotoClove

PhotoClove is a photo manager application written in Rust with tauri.

## Motivation

Photo viewer/importer applications tends to be slow when you have a lot of photos.
I try to use some free/paid applications, but they don't much my usecase and they all are very slow.

- I don't need a rich editor.
- I require the features to import fastly and to view photos fastly.

So, I decided to create this by myself.

## Dependency

### nodejs, pnpm

- nodejs v23.8.0
- pnpm

### ffmpeg, gstreamer

On Ubuntu, install the following package to watch mp4 file and to create movie thumbnail.

```
sudo apt install gstreamer1.0-plugins-bad ffmpeg
```

## how to run

```sh
pnpm tauri dev
```

## how to build

### on Windows

```sh
pnpm tauri build
```

### on WSL2 (Ubuntu 22.04)

#### Update WSL

```sh
wsl --update
wsl --shutdown
```

#### install required packages

```sh
sudo apt install libfuse2 librsvg2-dev libgstreamer1.0-dev patchelf
```

#### create fuse group if need

if fuse group doesn't exist, create it

```sh
sudo addgroup --system fuse
sudo chown root:fuse /dev/fuse
sudo chmod 660 /dev/fuse
sudo usermod -aG fuse $USER
newgrp fuse
```

#### Build app

```sh
rm -rf src-tauri/target
env PATH=$(echo $PATH | perl -p -e 's{:/mnt/c.+:}{:}g') APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=true pnpm tauri build
```

## Featurs to be ipmlemented

Just a plan, currentrly a few features are only implemented.

- [x] Fast photo viewer
  - [x] Fast when using NFS
  - [x] Allow photos over network drive(NFS/SMB mount on Linux. assign Network drive on Windows)
- [x] Fast importer
  - [ ] only check duplication for the files which has same name prefix and different size.
  - [ ] import files created after last import file timestamp in directories.
  - [x] filter import targets by date
  - [x] importing in background
  - [x] Thumbnail creation
     - [x] Thumbnail creation in background
- [ ] Provide very simple editor
  - [ ] rotation
  - [ ] crop
- [ ] Additional photo data
  - [x] Star
  - [x] Comment/Note
  - [ ] Tag
  - [ ] Album(low priority)
- [ ] Search/Filter
  - [x] Star
  - [x] Comment/Note
  - [ ] Camera
  - [ ] Tag
- [ ] Upload to cloud services
  - [x] Google Photos (works. but in progress)
  - [ ] Amazon Photos
- [x] Preferences editor(low priority)
  - [x] directories(import from)
  - [x] directory(import to)
  - [x] num of parralel when copying photos
  - [x] thumbnail settings
  - [ ] directory date format(currentry, yyyy-mm-dd only)
- [x] Welcome tutorial
- [x] Playing movies(mp4, webm) ... not good, but works
- [ ] Slide Show(low priority)
- [ ] i18n(low priority)
- [ ] trashbox management
- [ ] redo/undo
- [ ] Show photos imported reacently
- [ ] Crop photo and search with Google
