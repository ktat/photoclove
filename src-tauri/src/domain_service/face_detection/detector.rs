//! Face Detector using SCRFD model
//!
//! SCRFD (Sample and Computation Redistribution for Efficient Face Detection)
//! is a high-performance face detection model from InsightFace.

use image::{DynamicImage, GenericImageView};
use ort::session::Session;
use ort::value::Tensor;
use std::path::PathBuf;

use super::{BoundingBox, DetectedFace};

/// SCRFD model input size
const INPUT_SIZE: u32 = 640;

/// SCRFD Face Detector
pub struct FaceDetector {
    session: Option<Session>,
    models_dir: PathBuf,
}

impl FaceDetector {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            session: None,
            models_dir,
        }
    }

    /// Initialize the detector by loading the ONNX model
    pub fn init(&mut self) -> Result<(), String> {
        let model_path = self.models_dir.join("det_10g.onnx");

        if !model_path.exists() {
            return Err(format!(
                "Face detector model not found at {}. Please download from Preferences > Face Detection.",
                model_path.display()
            ));
        }

        log::info!(
            target: "face_detection",
            "loading_detector_model; path={}",
            model_path.display()
        );

        let session = Session::builder()
            .map_err(|e| format!("Failed to create session builder: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set threads: {}", e))?
            .commit_from_file(&model_path)
            .map_err(|e| format!("Failed to load SCRFD model: {}", e))?;

        self.session = Some(session);

        log::info!(target: "face_detection", "scrfd_model_loaded");
        Ok(())
    }

    /// Check if the detector is initialized
    pub fn is_initialized(&self) -> bool {
        self.session.is_some()
    }

    /// Detect faces in an image
    pub fn detect(
        &mut self,
        image: &DynamicImage,
        confidence_threshold: f32,
        max_faces: usize,
    ) -> Result<Vec<DetectedFace>, String> {
        if self.session.is_none() {
            return Err("Detector not initialized".to_string());
        }

        let (orig_width, orig_height) = image.dimensions();

        // Preprocess image (before mutable session borrow)
        let (input_data, scale, pad_x, pad_y) = Self::preprocess_image(image)?;

        // Create input tensor with shape [1, 3, height, width] (NCHW format)
        let input_tensor = Tensor::from_array((
            [1_usize, 3, INPUT_SIZE as usize, INPUT_SIZE as usize],
            input_data.into_boxed_slice(),
        ))
        .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        // Run inference in a separate scope to limit mutable borrow
        let output_data = {
            let session = self.session.as_mut().unwrap();

            let outputs = session
                .run(ort::inputs![input_tensor])
                .map_err(|e| format!("SCRFD inference failed: {}", e))?;

            // Extract outputs with their shapes for proper parsing
            let mut data: Vec<(String, Vec<usize>, Vec<f32>)> = Vec::new();
            for (name, tensor) in outputs.iter() {
                if let Ok((shape, values)) = tensor.try_extract_tensor::<f32>() {
                    let shape_vec: Vec<usize> = shape.iter().map(|&x| x as usize).collect();
                    log::debug!(
                        target: "face_detection",
                        "output_tensor; name={}; shape={:?}; len={}",
                        name,
                        shape_vec,
                        values.len()
                    );
                    data.push((name.to_string(), shape_vec, values.to_vec()));
                }
            }
            data
        };

        // Parse outputs (outside mutable borrow)
        let faces = Self::parse_scrfd_outputs(
            &output_data,
            orig_width,
            orig_height,
            scale,
            pad_x,
            pad_y,
            confidence_threshold,
            max_faces,
        );

        log::debug!(
            target: "face_detection",
            "faces_detected; count={}; image_size={}x{}",
            faces.len(),
            orig_width,
            orig_height
        );

        Ok(faces)
    }

    /// Preprocess image for SCRFD model
    /// Returns tensor data in NCHW format (batch=1, channels=3, height, width)
    /// Also returns scale factor and padding offset for coordinate conversion
    fn preprocess_image(image: &DynamicImage) -> Result<(Vec<f32>, f32, u32, u32), String> {
        let (orig_w, orig_h) = image.dimensions();

        // Calculate scale to fit within INPUT_SIZE while preserving aspect ratio
        let scale = (INPUT_SIZE as f32 / orig_w as f32).min(INPUT_SIZE as f32 / orig_h as f32);
        let new_w = (orig_w as f32 * scale) as u32;
        let new_h = (orig_h as f32 * scale) as u32;

        // Resize maintaining aspect ratio
        let resized = image.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
        let rgb = resized.to_rgb8();

        // Calculate padding to center the image
        let pad_x = (INPUT_SIZE - new_w) / 2;
        let pad_y = (INPUT_SIZE - new_h) / 2;

        log::debug!(
            target: "face_detection",
            "preprocess; orig={}x{}; resized={}x{}; scale={}; pad=({},{})",
            orig_w, orig_h, new_w, new_h, scale, pad_x, pad_y
        );

        // Create tensor in NCHW format with padding (gray background)
        // Using (127.5 - 127.5) / 128.0 = 0.0 for gray padding
        let mut tensor = vec![0.0f32; (3 * INPUT_SIZE * INPUT_SIZE) as usize];

        // Copy resized image to center with RGB normalization
        // SCRFD/InsightFace uses RGB format with mean subtraction and std division
        // Mean: [127.5, 127.5, 127.5], Std: [128.0, 128.0, 128.0]
        for y in 0..new_h {
            for x in 0..new_w {
                let pixel = rgb.get_pixel(x, y);
                let out_x = pad_x + x;
                let out_y = pad_y + y;
                let idx = (out_y * INPUT_SIZE + out_x) as usize;

                // SCRFD uses RGB format: (pixel - 127.5) / 128.0
                tensor[idx] = (pixel[0] as f32 - 127.5) / 128.0; // R channel
                tensor[(INPUT_SIZE * INPUT_SIZE) as usize + idx] = (pixel[1] as f32 - 127.5) / 128.0; // G channel
                tensor[(2 * INPUT_SIZE * INPUT_SIZE) as usize + idx] = (pixel[2] as f32 - 127.5) / 128.0; // B channel
            }
        }

        Ok((tensor, scale, pad_x, pad_y))
    }

    /// Parse SCRFD model outputs to extract face bounding boxes
    /// SCRFD outputs 9 tensors: 3 score maps, 3 bbox maps, 3 keypoint maps (for strides 8, 16, 32)
    fn parse_scrfd_outputs(
        outputs: &[(String, Vec<usize>, Vec<f32>)],
        orig_width: u32,
        orig_height: u32,
        scale: f32,
        pad_x: u32,
        pad_y: u32,
        confidence_threshold: f32,
        max_faces: usize,
    ) -> Vec<DetectedFace> {
        let mut faces = Vec::new();

        // Categorize outputs by shape
        // Score tensors: last dim = 1 (or 2 for some variants)
        // Bbox tensors: last dim = 4
        // Keypoint tensors: last dim = 10
        let mut score_tensors: Vec<&(String, Vec<usize>, Vec<f32>)> = Vec::new();
        let mut bbox_tensors: Vec<&(String, Vec<usize>, Vec<f32>)> = Vec::new();

        for output in outputs {
            let (name, shape, _data) = output;
            if shape.len() >= 2 {
                let last_dim = shape[shape.len() - 1];
                match last_dim {
                    1 | 2 => {
                        log::debug!(target: "face_detection", "score_tensor; name={}; shape={:?}", name, shape);
                        score_tensors.push(output);
                    }
                    4 => {
                        log::debug!(target: "face_detection", "bbox_tensor; name={}; shape={:?}", name, shape);
                        bbox_tensors.push(output);
                    }
                    10 => {
                        // Keypoints - skip for now
                        log::debug!(target: "face_detection", "kps_tensor; name={}; shape={:?}", name, shape);
                    }
                    _ => {
                        log::debug!(target: "face_detection", "unknown_tensor; name={}; shape={:?}", name, shape);
                    }
                }
            }
        }

        // Sort by number of anchors (descending) to pair score/bbox tensors by stride
        score_tensors.sort_by(|a, b| {
            let a_anchors = a.2.len();
            let b_anchors = b.2.len();
            b_anchors.cmp(&a_anchors)
        });
        bbox_tensors.sort_by(|a, b| {
            let a_anchors = a.2.len() / 4;
            let b_anchors = b.2.len() / 4;
            b_anchors.cmp(&a_anchors)
        });

        log::debug!(
            target: "face_detection",
            "tensor_counts; scores={}; bboxes={}",
            score_tensors.len(),
            bbox_tensors.len()
        );

        // SCRFD uses anchor-based detection with strides 8, 16, 32
        let strides = [8, 16, 32];

        // Process each pair of score/bbox tensors
        for (idx, (score_tensor, bbox_tensor)) in
            score_tensors.iter().zip(bbox_tensors.iter()).enumerate()
        {
            let stride = if idx < strides.len() {
                strides[idx]
            } else {
                8 // default
            };

            let (_, score_shape, scores) = score_tensor;
            let (_, _bbox_shape, bboxes) = bbox_tensor;

            // Calculate feature map size for this stride
            let fmc = INPUT_SIZE as usize / stride;
            // Shape is [num_anchors, 1] - get the first dimension
            let num_anchors = if !score_shape.is_empty() {
                score_shape[0]
            } else {
                scores.len()
            };

            log::debug!(
                target: "face_detection",
                "processing_stride; stride={}; fmc={}; num_anchors={}; score_len={}; bbox_len={}",
                stride,
                fmc,
                num_anchors,
                scores.len(),
                bboxes.len()
            );

            // Process each anchor
            // SCRFD has 2 anchors per grid cell
            let anchors_per_cell = 2;

            // Log score statistics for debugging (raw values)
            let max_score_raw = scores.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            let min_score_raw = scores.iter().cloned().fold(f32::INFINITY, f32::min);
            log::debug!(
                target: "face_detection",
                "score_stats_raw; stride={}; min={}; max={}",
                stride,
                min_score_raw,
                max_score_raw
            );

            for i in 0..num_anchors {
                // Get score - shape is [num_anchors, 1]
                // SCRFD model already outputs sigmoid-activated probabilities (0-1)
                let score = scores.get(i).copied().unwrap_or(0.0);

                if score < confidence_threshold {
                    continue;
                }

                // Get bbox (distance format: left, top, right, bottom from anchor center)
                let bbox_idx = i * 4;
                if bbox_idx + 3 >= bboxes.len() {
                    continue;
                }

                let left = bboxes[bbox_idx];
                let top = bboxes[bbox_idx + 1];
                let right = bboxes[bbox_idx + 2];
                let bottom = bboxes[bbox_idx + 3];

                // Calculate anchor position in the feature map
                // Grid layout: anchors are arranged as [cell0_anchor0, cell0_anchor1, cell1_anchor0, cell1_anchor1, ...]
                let cell_idx = i / anchors_per_cell;
                let cell_x = cell_idx % fmc;
                let cell_y = cell_idx / fmc;

                // Anchor center in input image coordinates
                let anchor_x = (cell_x as f32 + 0.5) * stride as f32;
                let anchor_y = (cell_y as f32 + 0.5) * stride as f32;

                // Convert from distance to absolute coordinates
                // SCRFD bbox format: distances from anchor center (already in pixel units after model processing)
                let x1 = anchor_x - left * stride as f32;
                let y1 = anchor_y - top * stride as f32;
                let x2 = anchor_x + right * stride as f32;
                let y2 = anchor_y + bottom * stride as f32;

                // Clamp to input size
                let x1 = x1.max(0.0).min(INPUT_SIZE as f32);
                let y1 = y1.max(0.0).min(INPUT_SIZE as f32);
                let x2 = x2.max(0.0).min(INPUT_SIZE as f32);
                let y2 = y2.max(0.0).min(INPUT_SIZE as f32);

                // Skip invalid boxes
                if x2 <= x1 || y2 <= y1 {
                    continue;
                }

                // Convert from padded coordinates to original image coordinates
                // 1. Remove padding offset
                let x1_unpad = x1 - pad_x as f32;
                let y1_unpad = y1 - pad_y as f32;
                let x2_unpad = x2 - pad_x as f32;
                let y2_unpad = y2 - pad_y as f32;

                // 2. Convert from scaled coordinates to original
                let x1_orig = x1_unpad / scale;
                let y1_orig = y1_unpad / scale;
                let x2_orig = x2_unpad / scale;
                let y2_orig = y2_unpad / scale;

                // 3. Clamp to original image bounds
                let x1_orig = x1_orig.max(0.0).min(orig_width as f32);
                let y1_orig = y1_orig.max(0.0).min(orig_height as f32);
                let x2_orig = x2_orig.max(0.0).min(orig_width as f32);
                let y2_orig = y2_orig.max(0.0).min(orig_height as f32);

                // Skip invalid boxes after transformation
                if x2_orig <= x1_orig || y2_orig <= y1_orig {
                    continue;
                }

                // Convert to normalized coordinates relative to original image
                let bbox = BoundingBox::new(
                    x1_orig / orig_width as f32,
                    y1_orig / orig_height as f32,
                    (x2_orig - x1_orig) / orig_width as f32,
                    (y2_orig - y1_orig) / orig_height as f32,
                );

                faces.push(DetectedFace {
                    bbox,
                    confidence: score,
                    embedding: None,
                });
            }
        }

        log::debug!(
            target: "face_detection",
            "pre_nms_faces; count={}",
            faces.len()
        );

        // Apply NMS (Non-Maximum Suppression)
        let faces = Self::nms(faces, 0.4);

        // Sort by confidence and limit
        let mut faces = faces;
        faces.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        faces.truncate(max_faces);

        faces
    }

    /// Non-Maximum Suppression to remove overlapping detections
    fn nms(mut faces: Vec<DetectedFace>, iou_threshold: f32) -> Vec<DetectedFace> {
        faces.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        let mut keep = Vec::new();

        while !faces.is_empty() {
            let best = faces.remove(0);
            keep.push(best.clone());

            faces.retain(|face| {
                let iou = Self::calculate_iou(&best.bbox, &face.bbox);
                iou < iou_threshold
            });
        }

        keep
    }

    /// Calculate Intersection over Union between two bounding boxes
    fn calculate_iou(a: &BoundingBox, b: &BoundingBox) -> f32 {
        let a_x2 = a.x + a.width;
        let a_y2 = a.y + a.height;
        let b_x2 = b.x + b.width;
        let b_y2 = b.y + b.height;

        let inter_x1 = a.x.max(b.x);
        let inter_y1 = a.y.max(b.y);
        let inter_x2 = a_x2.min(b_x2);
        let inter_y2 = a_y2.min(b_y2);

        if inter_x2 <= inter_x1 || inter_y2 <= inter_y1 {
            return 0.0;
        }

        let inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1);
        let a_area = a.width * a.height;
        let b_area = b.width * b.height;
        let union_area = a_area + b_area - inter_area;

        if union_area <= 0.0 {
            0.0
        } else {
            inter_area / union_area
        }
    }
}
