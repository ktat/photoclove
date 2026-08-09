//! Turning trimmed clips into the ffmpeg invocation that produces them.

use super::probe::VideoProbe;
use crate::entity::job_queue::VideoMergeClip;
use std::path::Path;

/// Constant Rate Factor of the merged output. 18 is visually lossless for x264,
/// which matters because trimming forces a re-encode of otherwise pristine
/// source footage.
const OUTPUT_CRF: &str = "18";
const OUTPUT_PRESET: &str = "medium";
const OUTPUT_AUDIO_BITRATE: &str = "192k";
/// Every clip is resampled to this rate so `concat` sees uniform audio.
const OUTPUT_AUDIO_SAMPLE_RATE: u32 = 48_000;

/// Builds the ffmpeg argument list that merges `clips` into `output_path`.
///
/// The first clip defines the output geometry and frame rate; the others are
/// letterboxed and resampled to match, because `concat` rejects segments whose
/// dimensions, SAR or stream layout differ.
pub(super) fn build_merge_args(
    clips: &[VideoMergeClip],
    probes: &[VideoProbe],
    output_path: &Path,
) -> Vec<String> {
    let target = &probes[0];
    let mut args: Vec<String> = ["-nostdin", "-y", "-progress", "pipe:1", "-nostats"]
        .iter()
        .map(|s| s.to_string())
        .collect();

    // Several segments can come from the same file, so give ffmpeg one input
    // per distinct path rather than one per segment - otherwise a long source
    // is opened and decoded once for every piece taken out of it.
    let mut input_paths: Vec<&str> = Vec::new();
    let mut input_index_for_clip = Vec::with_capacity(clips.len());
    for clip in clips {
        let index = match input_paths.iter().position(|p| *p == clip.path.as_str()) {
            Some(existing) => existing,
            None => {
                input_paths.push(clip.path.as_str());
                input_paths.len() - 1
            }
        };
        input_index_for_clip.push(index);
    }
    for path in &input_paths {
        args.push("-i".to_string());
        args.push(path.to_string());
    }

    // Clips with no audio track get a generated silent one appended after the
    // real inputs, since `concat` requires every segment to expose both streams.
    let mut silent_index_for_clip = vec![None; clips.len()];
    let mut next_input_index = input_paths.len();
    for (i, probe) in probes.iter().enumerate() {
        if probe.has_audio {
            continue;
        }
        args.push("-f".to_string());
        args.push("lavfi".to_string());
        args.push("-t".to_string());
        args.push(format!("{:.3}", clips[i].duration_sec()));
        args.push("-i".to_string());
        args.push(format!(
            "anullsrc=channel_layout=stereo:sample_rate={}",
            OUTPUT_AUDIO_SAMPLE_RATE
        ));
        silent_index_for_clip[i] = Some(next_input_index);
        next_input_index += 1;
    }

    let mut filters: Vec<String> = Vec::new();
    let mut concat_inputs = String::new();
    for (i, clip) in clips.iter().enumerate() {
        // `trim` cuts the decoded stream, so the cut lands on the exact frame
        // the user scrubbed to instead of the nearest keyframe.
        filters.push(format!(
            "[{input}:v]trim=start={start:.3}:end={end:.3},setpts=PTS-STARTPTS,\
             scale={w}:{h}:force_original_aspect_ratio=decrease,\
             pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps:.5}[v{i}]",
            input = input_index_for_clip[i],
            i = i,
            start = clip.start_sec,
            end = clip.end_sec,
            w = target.width,
            h = target.height,
            fps = target.fps,
        ));

        filters.push(match silent_index_for_clip[i] {
            // The silent source was already created at the trimmed length, so
            // it only needs its timestamps rebased.
            Some(silent) => format!(
                "[{silent}:a]asetpts=PTS-STARTPTS,\
                 aformat=sample_rates={rate}:channel_layouts=stereo[a{i}]",
                silent = silent,
                i = i,
                rate = OUTPUT_AUDIO_SAMPLE_RATE,
            ),
            None => format!(
                "[{input}:a]atrim=start={start:.3}:end={end:.3},asetpts=PTS-STARTPTS,\
                 aformat=sample_rates={rate}:channel_layouts=stereo[a{i}]",
                input = input_index_for_clip[i],
                i = i,
                start = clip.start_sec,
                end = clip.end_sec,
                rate = OUTPUT_AUDIO_SAMPLE_RATE,
            ),
        });

        concat_inputs.push_str(&format!("[v{}][a{}]", i, i));
    }
    filters.push(format!(
        "{}concat=n={}:v=1:a=1[outv][outa]",
        concat_inputs,
        clips.len()
    ));

    args.push("-filter_complex".to_string());
    args.push(filters.join(";"));
    for arg in [
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        // Carry the first source's container metadata - creation time, camera
        // make/model, GPS - into the result. filter_complex output otherwise
        // starts with no metadata at all.
        "-map_metadata",
        "0",
        "-c:v",
        "libx264",
        "-crf",
        OUTPUT_CRF,
        "-preset",
        OUTPUT_PRESET,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        OUTPUT_AUDIO_BITRATE,
        // Puts the moov atom up front so the merged file starts playing in the
        // in-app streaming player without downloading the whole file first.
        "-movflags",
        "+faststart",
    ] {
        args.push(arg.to_string());
    }
    args.push(output_path.display().to_string());
    args
}

/// Rejects trim ranges the editor should never have produced, so ffmpeg fails
/// fast with a readable message instead of writing a broken file, and clamps
/// the ones that are merely optimistic.
///
/// The editor derives `end_sec` from the HTML video element's duration, which
/// can read slightly longer than the container duration ffprobe reports. Left
/// alone that overshoot desyncs the output: `trim` stops the video at end of
/// stream while the `anullsrc` filler for a silent clip is sized from the
/// requested range, so the audio runs long and `concat` carries the drift into
/// every following segment.
pub(super) fn normalize_clips(
    clips: &[VideoMergeClip],
    probes: &[VideoProbe],
) -> Result<Vec<VideoMergeClip>, String> {
    let mut normalized = Vec::with_capacity(clips.len());
    for (clip, probe) in clips.iter().zip(probes.iter()) {
        if clip.start_sec < 0.0 || clip.end_sec <= clip.start_sec {
            return Err(format!(
                "Invalid trim range for {}: start={:.3}s end={:.3}s",
                clip.path, clip.start_sec, clip.end_sec
            ));
        }
        // A zero duration means ffprobe could not report one; trust the editor
        // in that case rather than rejecting a playable file.
        if probe.duration_sec > 0.0 && clip.start_sec >= probe.duration_sec {
            return Err(format!(
                "Trim start {:.3}s is past the end of {} ({:.3}s)",
                clip.start_sec, clip.path, probe.duration_sec
            ));
        }

        let mut clip = clip.clone();
        if probe.duration_sec > 0.0 && clip.end_sec > probe.duration_sec {
            log::debug!(
                target: "video_edit_service",
                "clamped_trim_end; path={}; requested={:.3}; duration={:.3}",
                clip.path, clip.end_sec, probe.duration_sec
            );
            clip.end_sec = probe.duration_sec;
        }
        normalized.push(clip);
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe(width: u32, height: u32, has_audio: bool) -> VideoProbe {
        VideoProbe {
            width,
            height,
            fps: 30.0,
            has_audio,
            duration_sec: 60.0,
            creation_time: None,
        }
    }

    fn clip(path: &str, start_sec: f64, end_sec: f64) -> VideoMergeClip {
        VideoMergeClip {
            path: path.to_string(),
            start_sec,
            end_sec,
        }
    }

    #[test]
    fn merge_args_trim_each_clip_and_concat_them() {
        let clips = vec![clip("/a.mp4", 1.5, 4.0), clip("/b.mp4", 0.0, 2.0)];
        let probes = vec![probe(1920, 1080, true), probe(1280, 720, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .expect("filter_complex is present");
        assert!(filter.contains("[0:v]trim=start=1.500:end=4.000"));
        assert!(filter.contains("[1:v]trim=start=0.000:end=2.000"));
        // The second clip is normalized to the first clip's geometry.
        assert!(filter.contains("scale=1920:1080"));
        assert!(filter.contains("[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]"));
        assert_eq!(args.last().unwrap(), "/out.mp4");
    }

    #[test]
    fn silent_source_is_added_for_clips_without_audio() {
        let clips = vec![clip("/a.mp4", 0.0, 3.0), clip("/b.mp4", 0.0, 2.0)];
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, false)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        assert!(args.iter().any(|a| a.starts_with("anullsrc=")));
        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        // The silent input follows the two real inputs, so it is index 2.
        assert!(filter.contains("[2:a]asetpts=PTS-STARTPTS"));
        assert!(!filter.contains("[1:a]atrim"));
    }

    #[test]
    fn rejects_inverted_and_out_of_range_trims() {
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, true)];
        let inverted = vec![clip("/a.mp4", 5.0, 5.0), clip("/b.mp4", 0.0, 2.0)];
        assert!(normalize_clips(&inverted, &probes).is_err());

        let past_end = vec![clip("/a.mp4", 90.0, 95.0), clip("/b.mp4", 0.0, 2.0)];
        assert!(normalize_clips(&past_end, &probes).is_err());

        let valid = vec![clip("/a.mp4", 0.0, 2.0), clip("/b.mp4", 1.0, 2.0)];
        assert!(normalize_clips(&valid, &probes).is_ok());
    }

    #[test]
    fn clamps_trim_end_to_the_probed_duration() {
        // probe() reports 60s; the editor asks for 65s off the player's
        // slightly longer idea of the duration.
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, false)];
        let clips = vec![clip("/a.mp4", 0.0, 65.0), clip("/b.mp4", 10.0, 20.0)];

        let normalized = normalize_clips(&clips, &probes).expect("ranges are valid");
        assert!((normalized[0].end_sec - 60.0).abs() < f64::EPSILON);
        // A range inside the media is left exactly as the user set it.
        assert!((normalized[1].end_sec - 20.0).abs() < f64::EPSILON);

        // The silent filler for the audio-less clip must match its video length.
        let args = build_merge_args(&normalized, &probes, Path::new("/out.mp4"));
        let silent_len = args
            .iter()
            .position(|a| a.starts_with("anullsrc="))
            .map(|i| args[i - 2].clone())
            .expect("silent input is sized with -t");
        assert_eq!(silent_len, "10.000");
    }

    #[test]
    fn keeps_trim_end_when_the_probe_reports_no_duration() {
        let mut unknown = probe(1920, 1080, true);
        unknown.duration_sec = 0.0;
        let probes = vec![unknown.clone(), unknown];
        let clips = vec![clip("/a.mp4", 0.0, 65.0), clip("/b.mp4", 0.0, 2.0)];

        let normalized = normalize_clips(&clips, &probes).expect("ranges are valid");
        assert!((normalized[0].end_sec - 65.0).abs() < f64::EPSILON);
    }

    #[test]
    fn several_segments_of_one_file_share_a_single_input() {
        // Two cuts taken out of the same source, plus a second file.
        let clips = vec![
            clip("/a.mp4", 0.0, 2.0),
            clip("/b.mp4", 0.0, 1.0),
            clip("/a.mp4", 10.0, 12.0),
        ];
        let probes = vec![
            probe(1920, 1080, true),
            probe(1920, 1080, true),
            probe(1920, 1080, true),
        ];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        // /a.mp4 is opened once even though it supplies two segments.
        assert_eq!(args.iter().filter(|a| *a == "/a.mp4").count(), 1);
        assert_eq!(args.iter().filter(|a| *a == "-i").count(), 2);

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        // Segments 0 and 2 both read input 0; segment 1 reads input 1.
        assert!(filter.contains("[0:v]trim=start=0.000:end=2.000"));
        assert!(filter.contains("[1:v]trim=start=0.000:end=1.000"));
        assert!(filter.contains("[0:v]trim=start=10.000:end=12.000"));
        assert!(filter.contains("[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[outv][outa]"));
    }

    #[test]
    fn a_single_segment_is_a_plain_trim() {
        let clips = vec![clip("/a.mp4", 3.0, 9.0)];
        let probes = vec![probe(1920, 1080, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let filter = args
            .iter()
            .position(|a| a == "-filter_complex")
            .map(|i| args[i + 1].clone())
            .unwrap();
        assert!(filter.contains("[0:v]trim=start=3.000:end=9.000"));
        assert!(filter.contains("[v0][a0]concat=n=1:v=1:a=1[outv][outa]"));
    }

    #[test]
    fn output_inherits_the_first_source_metadata() {
        let clips = vec![clip("/a.mp4", 0.0, 2.0), clip("/b.mp4", 0.0, 1.0)];
        let probes = vec![probe(1920, 1080, true), probe(1920, 1080, true)];
        let args = build_merge_args(&clips, &probes, Path::new("/out.mp4"));

        let index = args
            .iter()
            .position(|a| a == "-map_metadata")
            .expect("metadata is mapped");
        assert_eq!(args[index + 1], "0");
    }
}
