---
name: check-video
description: Extract frames from a screencast video in ~/ビデオ/スクリーンキャスト/, analyze the content, and execute instructions. Use when the user wants to verify UI changes, debug visual issues, or document features from recorded screencasts.
---

# Check Video Screencast

Extract frames from screencast videos, analyze visual content, and execute instructions based on the video.

## When This Skill is Invoked

Claude uses this skill when:
- User runs `/check-video [N] <instruction>`
- User wants to analyze a recorded screencast
- User needs to verify UI changes shown in a video
- User wants to document features from a screen recording

## Usage

```
/check-video [N] <instruction>
```

- `N` (optional): Which video to use (1 = latest, 2 = second latest, etc.). Default: 1
- `instruction`: What to do after analyzing the video content

## Process

### 1. Locate the Video File

Find the latest (or N-th latest) video file in `~/ビデオ/スクリーンキャスト/`:

```bash
# Get the N-th latest video file (default N=1)
VIDEO_FILE=$(ls -t ~/ビデオ/スクリーンキャスト/*.{mp4,webm,mkv,avi,mov} 2>/dev/null | sed -n '${N}p')

# Example for latest (N=1):
VIDEO_FILE=$(ls -t ~/ビデオ/スクリーンキャスト/*.{mp4,webm,mkv,avi,mov} 2>/dev/null | head -1)
```

### 2. Extract Frames with ffmpeg

Extract key frames at regular intervals (e.g., every 3 seconds):

```bash
# Create temporary directory for frames
FRAME_DIR=$(mktemp -d)

# Extract frames every 3 seconds
ffmpeg -i "$VIDEO_FILE" -vf "fps=1/3" "$FRAME_DIR/frame_%04d.png"

# Or extract specific number of frames evenly distributed
DURATION=$(ffmpeg -i "$VIDEO_FILE" 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ,)
# Calculate interval for N frames (e.g., 10 frames)
ffmpeg -i "$VIDEO_FILE" -vf "select='not(mod(n\,30))'" -vsync vfr "$FRAME_DIR/frame_%04d.png"
```

### 3. Read and Analyze Frames

Use the Read tool to view each extracted frame:

```bash
# List all extracted frames
ls "$FRAME_DIR"/*.png
```

Then read each frame with the Read tool to analyze the visual content:
- UI elements and their states
- Text content visible in the UI
- Error messages or dialogs
- Visual bugs or layout issues
- Feature demonstrations

### 4. Execute the Instruction

Based on the analyzed video content, execute the user's instruction:
- Fix UI bugs identified in the video
- Update documentation with screenshots from the video
- Verify that features work as shown
- Implement missing features observed in the video
- Compare actual behavior with expected behavior

### 5. Cleanup

```bash
# Remove temporary frames
rm -rf "$FRAME_DIR"
```

## Frame Extraction Strategies

### Strategy 1: Time-based (Every N seconds)
```bash
# Every 3 seconds
ffmpeg -i "$VIDEO_FILE" -vf "fps=1/3" "$FRAME_DIR/frame_%04d.png"
```

### Strategy 2: Fixed Number of Frames
```bash
# Extract exactly 10 evenly-distributed frames
ffmpeg -i "$VIDEO_FILE" -vf "select='not(mod(n\,$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nokey=1:noprint_wrappers=1 "$VIDEO_FILE" | awk '{print int($1/10)}'))'" -vsync vfr "$FRAME_DIR/frame_%04d.png"
```

### Strategy 3: Scene Changes (Key Frames Only)
```bash
# Extract frames only when scene changes significantly
ffmpeg -i "$VIDEO_FILE" -vf "select='gt(scene,0.3)'" -vsync vfr "$FRAME_DIR/frame_%04d.png"
```

## Common Use Cases

### Use Case 1: UI Bug Verification
```
/check-video 1 Verify if the alignment issue in PhotoTags tab is fixed
```

### Use Case 2: Documentation
```
/check-video 1 Create screenshots for the S3 backup feature documentation
```

### Use Case 3: Feature Implementation
```
/check-video 1 Implement the emoji icons shown in the maintenance tab
```

### Use Case 4: Regression Testing
```
/check-video 2 Compare this video with the previous one to check for regressions
```

## Tips

1. **Frame Rate**: Adjust fps based on video length
   - Short videos (< 1 min): Extract every 2 seconds (`fps=1/2`)
   - Medium videos (1-5 min): Extract every 3-5 seconds (`fps=1/3` or `fps=1/5`)
   - Long videos (> 5 min): Extract every 10 seconds (`fps=1/10`)

2. **Video Format**: ffmpeg supports most formats (mp4, webm, mkv, avi, mov)

3. **Frame Quality**: Use PNG for lossless quality when analyzing UI details

4. **Focus on Key Moments**: Use scene detection to capture only important changes

5. **Temporary Storage**: Always use `mktemp -d` for frame storage and clean up afterwards

## Error Handling

- **Video not found**: Verify the path `~/ビデオ/スクリーンキャスト/` exists and contains video files
- **ffmpeg not installed**: Install with `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (Mac)
- **Permission errors**: Check file permissions on the video directory
- **Out of disk space**: Clean up old frames from previous runs

## Integration with PhotoClove Development

This skill is particularly useful for:
- Verifying UI alignment and styling issues
- Documenting new features with visual examples
- Reproducing bugs shown in screen recordings
- Comparing before/after states during refactoring
- Creating visual test cases for regression testing
