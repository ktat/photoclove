# PhotoClove

PhotoClove is a photo manager application written in Rust with tauri.

## Motivation

Photo viewer/importer applications tends to be slow when you have a lot of photos.
I try to use some free/paid applications, but they don't much my usecase and they all are very slow.

- I don't need a rich editor.
- I require the features to import fastly and to view photos fastly.

So, I decided to create this by myself.

## Featurs to be ipmlemented

Just a plan, currentrly a few features are only implemented.

- [x] Fast photo viewer
  - [x] Fast when using NFS
  - [ ] Allow photos over network drive(priority is very low because I uses NFS mount on Linux)
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
- [ ] Search
- [ ] Filter
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
