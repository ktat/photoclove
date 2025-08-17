import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { logger } from '../../../services/LoggerService.js';
import fileUrl from '../../../PathUtil.jsx';

// TODO: This file is too large (1284 lines) and should be refactored into smaller modules:
// - PhotoEditor/cssUtils.js: CSS parsing and generation utilities
// - PhotoEditor/cropUtils.js: Crop functionality and preset handling
// - PhotoEditor/styleUtils.js: Style application and transformation utilities
// - PhotoEditor/ToolBar.jsx: Editor controls and UI components
// - PhotoEditor/CropOverlay.jsx: Crop selection overlay component

function PhotoEditor(props) {
    const [originalStyles, setOriginalStyles] = useState(new Map());
    const [editorStyles, setEditorStyles] = useState({
        rotate: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        scale: 100,
        crop: { x: 0, y: 0, width: 100, height: 100 }
    });
    const [cropMode, setCropMode] = useState(false);
    const [cropSelection, setCropSelection] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [cropOverlayBounds, setCropOverlayBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dragMode, setDragMode] = useState('create');
    const [cropPresets] = useState([
        { name: 'Original', ratio: null },
        { name: 'Square', ratio: 1 },
        { name: 'Portrait 4:3', ratio: 4/3 },
        { name: 'Landscape 3:4', ratio: 3/4 },
        { name: 'Portrait 3:2', ratio: 3/2 },
        { name: 'Landscape 2:3', ratio: 2/3 },
        { name: 'Wide 16:9', ratio: 16/9 },
        { name: 'Tall 9:16', ratio: 9/16 }
    ]);

    // Load saved CSS styles when photo changes
    useEffect(() => {
        setOriginalStyles(new Map());
        
        if (props.currentPhotoPath) {
            // Load saved CSS style for this photo
            invoke("get_css_style", { photoPath: props.currentPhotoPath })
                .then((savedCssStyle) => {
                    
                    if (savedCssStyle && savedCssStyle.trim() !== '') {
                        // Parse the saved CSS and update editor values
                        const editorValues = parseCssToEditorValues(savedCssStyle);
                        setEditorStyles(editorValues);
                        
                        // Update UI elements with saved values
                        setTimeout(() => {
                            updateUIElementsWithValues(editorValues, savedCssStyle);
                            
                            // Note: Don't apply temp styles here - PhotoDisplay will apply saved CSS via props
                        }, 200);
                    } else {
                        // No saved CSS, use default values
                        const defaultValues = {
                            rotate: 0,
                            brightness: 100,
                            contrast: 100,
                            saturation: 100,
                            hue: 0,
                            scale: 100,
                            crop: { x: 0, y: 0, width: 100, height: 100 }
                        };
                        setEditorStyles(defaultValues);
                        
                        setTimeout(() => {
                            updateUIElementsWithValues(defaultValues, '');
                        }, 100);
                    }
                })
                .catch((error) => {
                    logger.error('PhotoEditor', 'css_load_failed', 'Failed to load CSS style', { photoPath: props.currentPhotoPath, error: error.message });
                    // Fallback to reset editor styles
                    const defaultValues = {
                        rotate: 0,
                        brightness: 100,
                        contrast: 100,
                        saturation: 100,
                        hue: 0,
                        scale: 100,
                        crop: { x: 0, y: 0, width: 100, height: 100 }
                    };
                    setEditorStyles(defaultValues);
                    
                    setTimeout(() => {
                        updateUIElementsWithValues(defaultValues, '');
                    }, 100);
                });
        }
    }, [props.currentPhotoPath])

    // Cleanup effect to reset crop mode when component unmounts
    useEffect(() => {
        return () => {
            setCropMode(false);
            setIsDragging(false);
        };
    }, [])

    // Update CSS preview when editor is opened
    useEffect(() => {
        if (props.currentPhotoPath) {
            // Ensure CSS preview is populated
            setTimeout(() => {
                
                const css = generateCSSFromValues(editorStyles);
                
                const previewTextarea = document.getElementById('css-preview-text');
                if (previewTextarea) {
                    previewTextarea.value = css;
                    logger.debug('PhotoEditor', 'css_preview_updated', 'CSS preview updated', { css });
                } else {
                    logger.warn('PhotoEditor', 'css_preview_missing', 'CSS preview textarea not found');
                }
                
                // Also ensure UI elements reflect current editorStyles
                updateUIElementsWithValues(editorStyles, css);
            }, 100);
        }
    }, [editorStyles])

    // Helper function to update CSS preview
    function updateUIElementsWithValues(editorValues, cssStyle) {
        logger.debug('PhotoEditor', 'update_css_preview', 'Updating CSS preview with values', { editorValues });
        
        // Update CSS preview with the actual saved CSS
        const previewTextarea = document.getElementById('css-preview-text');
        if (previewTextarea) {
            previewTextarea.value = cssStyle || '';
            logger.debug('PhotoEditor', 'css_preview_set', 'CSS preview textarea updated', { cssStyle });
        } else {
            logger.warn('PhotoEditor', 'css_preview_not_found', 'CSS preview textarea not found');
        }
    }
    
    // Function to parse CSS string and extract editor values
    function parseCssToEditorValues(cssString) {
        logger.debug('PhotoEditor', 'parse_css_start', 'Parsing CSS string', { cssString });
        
        const defaultValues = {
            rotate: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            scale: 100,
            crop: { x: 0, y: 0, width: 100, height: 100 }
        };

        if (!cssString || cssString.trim() === '') {
            logger.debug('PhotoEditor', 'parse_css_empty', 'CSS string is empty, returning defaults');
            return defaultValues;
        }

        const values = { ...defaultValues };
        
        // Parse transform property
        const transformMatch = cssString.match(/transform:\s*([^;]+)/);
        if (transformMatch) {
            const transformValue = transformMatch[1];
            
            // Parse rotation: rotate(90deg)
            const rotateMatch = transformValue.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
            if (rotateMatch) {
                values.rotate = parseInt(rotateMatch[1]);
            }
            
            // Parse scale: scale(1.5)
            const scaleMatch = transformValue.match(/scale\((\d+(?:\.\d+)?)\)/);
            if (scaleMatch) {
                values.scale = Math.round(parseFloat(scaleMatch[1]) * 100);
            }
        }
        
        // Parse filter property
        const filterMatch = cssString.match(/filter:\s*([^;]+)/);
        if (filterMatch) {
            const filterValue = filterMatch[1];
            
            // Parse brightness: brightness(150%)
            const brightnessMatch = filterValue.match(/brightness\((\d+(?:\.\d+)?)%\)/);
            if (brightnessMatch) {
                values.brightness = parseInt(brightnessMatch[1]);
            }
            
            // Parse contrast: contrast(120%)
            const contrastMatch = filterValue.match(/contrast\((\d+(?:\.\d+)?)%\)/);
            if (contrastMatch) {
                values.contrast = parseInt(contrastMatch[1]);
            }
            
            // Parse saturation: saturate(80%)
            const saturationMatch = filterValue.match(/saturate\((\d+(?:\.\d+)?)%\)/);
            if (saturationMatch) {
                values.saturation = parseInt(saturationMatch[1]);
            }
            
            // Parse hue rotation: hue-rotate(45deg)
            const hueMatch = filterValue.match(/hue-rotate\((-?\d+(?:\.\d+)?)deg\)/);
            if (hueMatch) {
                values.hue = parseInt(hueMatch[1]);
            }
        }
        
        // Parse clip-path property for crop
        const clipPathMatch = cssString.match(/clip-path:\s*inset\((\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
        if (clipPathMatch) {
            const top = parseFloat(clipPathMatch[1]);
            const right = parseFloat(clipPathMatch[2]);
            const bottom = parseFloat(clipPathMatch[3]);
            const left = parseFloat(clipPathMatch[4]);
            
            values.crop = {
                x: left,
                y: top,
                width: 100 - left - right,
                height: 100 - top - bottom
            };
        }
        
        logger.debug('PhotoEditor', 'parse_css_complete', 'CSS parsing complete', { values });
        return values;
    }

    // Editor functions
    function updateStyle(property, value) {
        // Handle rotation 360 = 0 case
        if ((property === 'rotate' || property === 'hue')  && parseInt(value) === 360) {
            value = 0;
        }
        
        // Update state
        setEditorStyles(prev => {
            const newStyles = {
                ...prev,
                [property]: parseInt(value)
            };
            
            // Generate CSS with the new values immediately
            const css = generateCSSFromValues(newStyles);
            
            // Update CSS preview with the generated CSS
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = css;
                logger.debug('PhotoEditor', 'update_style_preview', 'CSS preview updated in updateStyle', { css });
            }
            
            // Apply to current image immediately with new values
            applyTempStyleWithValues(newStyles);
            
            return newStyles;
        });
    }

    function resetSingleControl(property) {
        const defaultValues = {
            rotate: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            scale: 100,
            crop: { x: 0, y: 0, width: 100, height: 100 }
        };
        updateStyle(property, defaultValues[property]);
    }

    function rotateBy(degrees) {
        const currentRotation = editorStyles.rotate;
        const newRotation = (currentRotation + degrees) % 360;
        updateStyle('rotate', newRotation < 0 ? newRotation + 360 : newRotation);
    }

    function generateCSS() {
        return generateCSSFromValues(editorStyles);
    }

    function generateCSSFromValues(styles) {
        const { rotate, brightness, contrast, saturation, hue, scale, crop } = styles;
        
        let transform = [];
        let filter = [];
        
        if (rotate !== 0) transform.push(`rotate(${rotate}deg)`);
        if (scale !== 100) transform.push(`scale(${scale / 100})`);
        
        if (brightness !== 100) filter.push(`brightness(${brightness}%)`);
        if (contrast !== 100) filter.push(`contrast(${contrast}%)`);
        if (saturation !== 100) filter.push(`saturate(${saturation}%)`);
        if (hue !== 0) filter.push(`hue-rotate(${hue}deg)`);
        
        let css = '';
        if (transform.length > 0) {
            css += `transform: ${transform.join(' ')}; `;
        }
        if (filter.length > 0) {
            css += `filter: ${filter.join(' ')}; `;
        }
        
        // Add crop as clip-path if it's not the default (full image)
        if (crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100)) {
            const top = crop.y;
            const right = 100 - crop.x - crop.width;
            const bottom = 100 - crop.y - crop.height;
            const left = crop.x;
            css += `clip-path: inset(${top}% ${right}% ${bottom}% ${left}%); `;
        }
        
        return css.trim();
    }

    function applyTempStyle(css) {
        applyTempStyleWithValues(editorStyles);
    }

    function applyTempStyleWithValues(styles) {
        logger.debug('PhotoEditor', 'apply_temp_styles', 'Applying temporary styles', { styles });
        const { rotate, brightness, contrast, saturation, hue, scale, crop } = styles;
        
        // Store and apply styles to main image
        const mainImage = document.querySelector('#photoImgTag');
        logger.debug('PhotoEditor', 'main_image_check', 'Main image element found', { found: !!mainImage });
        if (mainImage) {
            // Store original styles immediately if not stored
            if (!originalStyles.has('main-image')) {
                const originalStyle = {
                    transform: mainImage.style.transform || '',
                    filter: mainImage.style.filter || '',
                    clipPath: mainImage.style.clipPath || '',
                    cssText: mainImage.style.cssText || ''
                };
                setOriginalStyles(prev => new Map(prev.set('main-image', originalStyle)));
                originalStyles.set('main-image', originalStyle);
            }
            
            // Get the stored original values
            const original = originalStyles.get('main-image') || { transform: '', filter: '' };
            
            // Build combined styles directly
            const transforms = [];
            const filters = [];
            
            // Add original styles first
            if (original.transform && original.transform !== 'none') {
                transforms.push(original.transform);
            }
            if (original.filter && original.filter !== 'none') {
                filters.push(original.filter);
            }
            
            // Add editor styles
            if (rotate !== 0) transforms.push(`rotate(${rotate}deg)`);
            if (scale !== 100) transforms.push(`scale(${scale / 100})`);
            
            if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
            if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
            if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
            if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
            
            // Apply styles immediately
            mainImage.style.transform = transforms.length > 0 ? transforms.join(' ') : '';
            mainImage.style.filter = filters.length > 0 ? filters.join(' ') : '';
            
            // Apply crop as clip-path if it's not the default (full image)
            if (crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100)) {
                const top = crop.y;
                const right = 100 - crop.x - crop.width;
                const bottom = 100 - crop.y - crop.height;
                const left = crop.x;
                mainImage.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
            } else {
                mainImage.style.clipPath = '';
            }
        }
        
        // Apply to thumbnails with same immediate approach
        const applyToThumbnails = (selector, keyPrefix) => {
            const thumbnails = document.querySelectorAll(selector);
            thumbnails.forEach((img, index) => {
                if (img.src && props.currentPhotoPath && img.src.includes(props.currentPhotoPath.split('/').pop())) {
                    const key = `${keyPrefix}-${index}`;
                    
                    if (!originalStyles.has(key)) {
                        const originalStyle = {
                            transform: img.style.transform || '',
                            filter: img.style.filter || '',
                            clipPath: img.style.clipPath || '',
                            cssText: img.style.cssText || ''
                        };
                        setOriginalStyles(prev => new Map(prev.set(key, originalStyle)));
                        originalStyles.set(key, originalStyle);
                    }
                    
                    const original = originalStyles.get(key) || { transform: '', filter: '' };
                    
                    const transforms = [];
                    const filters = [];
                    
                    if (original.transform && original.transform !== 'none') {
                        transforms.push(original.transform);
                    }
                    if (original.filter && original.filter !== 'none') {
                        filters.push(original.filter);
                    }
                    
                    if (rotate !== 0) transforms.push(`rotate(${rotate}deg)`);
                    if (scale !== 100) transforms.push(`scale(${scale / 100})`);
                    
                    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
                    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
                    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
                    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
                    
                    img.style.transform = transforms.length > 0 ? transforms.join(' ') : '';
                    img.style.filter = filters.length > 0 ? filters.join(' ') : '';
                    
                    // Apply crop as clip-path if it's not the default (full image)
                    if (crop && (crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100)) {
                        const top = crop.y;
                        const right = 100 - crop.x - crop.width;
                        const bottom = 100 - crop.y - crop.height;
                        const left = crop.x;
                        img.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}%)`;
                    } else {
                        img.style.clipPath = '';
                    }
                }
            });
        };
        
        applyToThumbnails('.photos .row img', 'grid-thumb');
        applyToThumbnails('#photos-list-mini img', 'mini-thumb');
    }

    async function applyStyle() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to apply', false, 3000);
            return;
        }
        
        try {
            await invoke('save_css_style', {
                photoPath: props.currentPhotoPath,
                cssStyle: css
            });
            
            props.addFooterMessage('editor', 'Style applied successfully', false, 3000);
        } catch (error) {
            logger.error('PhotoEditor', 'style_apply_failed', 'Failed to apply style', { error: error.message });
            props.addFooterMessage('editor', 'Failed to apply style', false, 3000);
        }
    }

    async function saveAsCopy() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to save', false, 3000);
            return;
        }
        
        try {
            props.addFooterMessage('editor', 'Creating styled copy...', false, 2000);
            
            // Use the same canvas logic as downloadStyled() to create the image
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }
            
            // Create a canvas to render the styled image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match image, but limit to reasonable size to prevent memory issues
            const maxSize = 4096; // Max 4K resolution
            let width = mainImage.naturalWidth || mainImage.width;
            let height = mainImage.naturalHeight || mainImage.height;
            
            if (width > maxSize || height > maxSize) {
                const scale = Math.min(maxSize / width, maxSize / height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
                logger.info('PhotoEditor', 'resize_image', 'Resizing image', {
                    originalWidth: mainImage.naturalWidth,
                    originalHeight: mainImage.naturalHeight,
                    newWidth: width,
                    newHeight: height
                });
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Create a new image with applied styles
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = async function() {
                // Parse and apply transforms from editor styles (same as downloadStyled)
                const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;
                
                // First, draw the image to a temporary canvas to apply filters
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = tempImg.width;
                tempCanvas.height = tempImg.height;
                
                // Draw the original image
                tempCtx.drawImage(tempImg, 0, 0);
                
                // Apply filters by manipulating image data if needed
                if (brightness !== 100 || contrast !== 100 || saturation !== 100 || hue !== 0) {
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imageData.data;
                    
                    // Apply brightness, contrast, saturation, and hue adjustments
                    for (let i = 0; i < data.length; i += 4) {
                        let r = data[i];
                        let g = data[i + 1];
                        let b = data[i + 2];
                        
                        // Apply brightness (simple multiplication)
                        if (brightness !== 100) {
                            const brightnessMultiplier = brightness / 100;
                            r = Math.min(255, r * brightnessMultiplier);
                            g = Math.min(255, g * brightnessMultiplier);
                            b = Math.min(255, b * brightnessMultiplier);
                        }
                        
                        // Apply contrast (using formula: (pixel - 128) * contrast + 128)
                        if (contrast !== 100) {
                            const contrastMultiplier = contrast / 100;
                            r = Math.min(255, Math.max(0, (r - 128) * contrastMultiplier + 128));
                            g = Math.min(255, Math.max(0, (g - 128) * contrastMultiplier + 128));
                            b = Math.min(255, Math.max(0, (b - 128) * contrastMultiplier + 128));
                        }
                        
                        // Apply saturation (convert to HSL, adjust saturation, convert back)
                        if (saturation !== 100) {
                            const saturationMultiplier = saturation / 100;
                            const max = Math.max(r, g, b);
                            const min = Math.min(r, g, b);
                            const delta = max - min;
                            
                            if (delta !== 0) {
                                const avg = (max + min) / 2;
                                const adjustedDelta = delta * saturationMultiplier;
                                const factor = adjustedDelta / delta;
                                
                                r = Math.min(255, Math.max(0, avg + (r - avg) * factor));
                                g = Math.min(255, Math.max(0, avg + (g - avg) * factor));
                                b = Math.min(255, Math.max(0, avg + (b - avg) * factor));
                            }
                        }
                        
                        // Apply hue rotation (simplified RGB hue shift)
                        if (hue !== 0) {
                            const hueRadians = (hue * Math.PI) / 180;
                            const cosHue = Math.cos(hueRadians);
                            const sinHue = Math.sin(hueRadians);
                            
                            const newR = r * (cosHue + (1 - cosHue) / 3) + g * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3)) + b * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3));
                            const newG = r * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3)) + g * (cosHue + (1 - cosHue) / 3) + b * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3));
                            const newB = r * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3)) + g * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3)) + b * (cosHue + (1 - cosHue) / 3);
                            
                            r = Math.min(255, Math.max(0, newR));
                            g = Math.min(255, Math.max(0, newG));
                            b = Math.min(255, Math.max(0, newB));
                        }
                        
                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                    }
                    
                    tempCtx.putImageData(imageData, 0, 0);
                }
                
                // Now apply transforms (rotation, scale) to the final canvas
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                
                if (rotate !== 0) {
                    ctx.rotate((rotate * Math.PI) / 180);
                }
                
                if (scale !== 100) {
                    const scaleValue = scale / 100;
                    ctx.scale(scaleValue, scaleValue);
                }
                
                // Draw the filtered image centered
                ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
                ctx.restore();
                
                // Convert canvas to blob and send to backend
                canvas.toBlob(async function(blob) {
                    try {
                        // Use FileReader for more reliable base64 conversion
                        const reader = new FileReader();
                        reader.onload = async function(e) {
                            try {
                                const base64Data = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
                                
                                // Send to backend to save as copy
                                const newPhotoPath = await invoke('save_styled_copy_from_frontend', {
                                    originalPhotoPath: props.currentPhotoPath,
                                    cssStyle: css,
                                    imageData: base64Data
                                });
                                
                                // Extract filename from path for display
                                const newFilename = newPhotoPath.split('/').pop();
                                props.addFooterMessage('editor', `Styled copy created: ${newFilename}`, false, 5000);
                                
                                // Refresh photo list to show the new image
                                if (props.onPhotosRefresh) {
                                    props.onPhotosRefresh();
                                }
                                
                                // Since we don't have onDatesRefresh prop, trigger a manual reload
                                // by emitting an event that the main app can listen to
                                if (window.dispatchEvent) {
                                    window.dispatchEvent(new CustomEvent('refreshDates'));
                                }
                                
                            } catch (error) {
                                logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
                                props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
                            }
                        };
                        
                        reader.onerror = function() {
                            props.addFooterMessage('editor', 'Failed to process image data', false, 3000);
                        };
                        
                        // Convert blob to base64 using FileReader
                        reader.readAsDataURL(blob);
                        
                    } catch (error) {
                        logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
                        props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
                    }
                }, 'image/jpeg', 0.95);
            };
            
            tempImg.onerror = function() {
                props.addFooterMessage('editor', 'Failed to load image for processing', false, 3000);
            };
            
            // Load the original image
            tempImg.src = mainImage.src;
            
        } catch (error) {
            logger.error('PhotoEditor', 'save_styled_copy_failed', 'Failed to save styled copy', { error: error.message });
            props.addFooterMessage('editor', `Failed to create styled copy: ${error}`, false, 5000);
        }
    }

    function resetStyle() {
        // First restore original styles before resetting state
        const mainImage = document.querySelector('#photoImgTag');
        if (mainImage) {
            const originalStyle = originalStyles.get('main-image');
            if (originalStyle) {
                mainImage.style.transform = originalStyle.transform;
                mainImage.style.filter = originalStyle.filter;
                mainImage.style.clipPath = originalStyle.clipPath || '';
            } else {
                mainImage.style.transform = '';
                mainImage.style.filter = '';
                mainImage.style.clipPath = '';
            }
        }
        
        // Restore original styles to thumbnails
        const restoreThumbnails = (selector, keyPrefix) => {
            const thumbnails = document.querySelectorAll(selector);
            thumbnails.forEach((img, index) => {
                const key = `${keyPrefix}-${index}`;
                const originalStyle = originalStyles.get(key);
                if (originalStyle) {
                    img.style.transform = originalStyle.transform;
                    img.style.filter = originalStyle.filter;
                    img.style.clipPath = originalStyle.clipPath || '';
                } else {
                    img.style.transform = '';
                    img.style.filter = '';
                    img.style.clipPath = '';
                }
            });
        };
        
        restoreThumbnails('.photos .row img', 'grid-thumb');
        restoreThumbnails('#photos-list-mini img', 'mini-thumb');
        
        // Clear stored original styles BEFORE resetting state
        setOriginalStyles(new Map());
        
        // Reset state (this will trigger applyTempStyleWithValues)
        setEditorStyles({
            rotate: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            scale: 100,
            crop: { x: 0, y: 0, width: 100, height: 100 }
        });
        
        // Reset crop mode
        setCropMode(false);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        
        // Clear CSS preview
        setTimeout(() => {
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = '';
            }
        }, 0);
    }

    async function downloadStyled() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('editor', 'Please select a photo first', false, 3000);
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('editor', 'No styles to download', false, 3000);
            return;
        }
        
        try {
            // Get the main image element
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('editor', 'Photo not found', false, 3000);
                return;
            }
            
            // Create a canvas to render the styled image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match image
            canvas.width = mainImage.naturalWidth || mainImage.width;
            canvas.height = mainImage.naturalHeight || mainImage.height;
            
            // Create a new image with applied styles
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = function() {
                // Parse and apply transforms from editor styles
                const { rotate, brightness, contrast, saturation, hue, scale } = editorStyles;
                
                // First, draw the image to a temporary canvas to apply filters
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = tempImg.width;
                tempCanvas.height = tempImg.height;
                
                // Draw the original image
                tempCtx.drawImage(tempImg, 0, 0);
                
                // Apply filters by manipulating image data if needed
                if (brightness !== 100 || contrast !== 100 || saturation !== 100 || hue !== 0) {
                    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const data = imageData.data;
                    
                    // Apply brightness, contrast, saturation, and hue adjustments
                    for (let i = 0; i < data.length; i += 4) {
                        let r = data[i];
                        let g = data[i + 1];
                        let b = data[i + 2];
                        
                        // Apply brightness (simple multiplication)
                        if (brightness !== 100) {
                            const brightnessMultiplier = brightness / 100;
                            r = Math.min(255, r * brightnessMultiplier);
                            g = Math.min(255, g * brightnessMultiplier);
                            b = Math.min(255, b * brightnessMultiplier);
                        }
                        
                        // Apply contrast (using formula: (pixel - 128) * contrast + 128)
                        if (contrast !== 100) {
                            const contrastMultiplier = contrast / 100;
                            r = Math.min(255, Math.max(0, (r - 128) * contrastMultiplier + 128));
                            g = Math.min(255, Math.max(0, (g - 128) * contrastMultiplier + 128));
                            b = Math.min(255, Math.max(0, (b - 128) * contrastMultiplier + 128));
                        }
                        
                        // Apply saturation (convert to HSL, adjust saturation, convert back)
                        if (saturation !== 100) {
                            const saturationMultiplier = saturation / 100;
                            const max = Math.max(r, g, b);
                            const min = Math.min(r, g, b);
                            const delta = max - min;
                            
                            if (delta !== 0) {
                                const avg = (max + min) / 2;
                                const adjustedDelta = delta * saturationMultiplier;
                                const factor = adjustedDelta / delta;
                                
                                r = Math.min(255, Math.max(0, avg + (r - avg) * factor));
                                g = Math.min(255, Math.max(0, avg + (g - avg) * factor));
                                b = Math.min(255, Math.max(0, avg + (b - avg) * factor));
                            }
                        }
                        
                        // Apply hue rotation (simplified RGB hue shift)
                        if (hue !== 0) {
                            const hueRadians = (hue * Math.PI) / 180;
                            const cosHue = Math.cos(hueRadians);
                            const sinHue = Math.sin(hueRadians);
                            
                            const newR = r * (cosHue + (1 - cosHue) / 3) + g * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3)) + b * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3));
                            const newG = r * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3)) + g * (cosHue + (1 - cosHue) / 3) + b * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3));
                            const newB = r * ((1 - cosHue) / 3 - sinHue * Math.sqrt(1/3)) + g * ((1 - cosHue) / 3 + sinHue * Math.sqrt(1/3)) + b * (cosHue + (1 - cosHue) / 3);
                            
                            r = Math.min(255, Math.max(0, newR));
                            g = Math.min(255, Math.max(0, newG));
                            b = Math.min(255, Math.max(0, newB));
                        }
                        
                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                    }
                    
                    tempCtx.putImageData(imageData, 0, 0);
                }
                
                // Now apply transforms (rotation, scale) to the final canvas
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                
                if (rotate !== 0) {
                    ctx.rotate((rotate * Math.PI) / 180);
                }
                
                if (scale !== 100) {
                    const scaleValue = scale / 100;
                    ctx.scale(scaleValue, scaleValue);
                }
                
                // Draw the filtered image centered
                ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
                ctx.restore();
                
                // Convert canvas to blob and download
                canvas.toBlob(async function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const fileName = props.currentPhotoPath.split('/').pop().replace(/\.[^/.]+$/, '_styled.png');
                    link.download = fileName;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Get configurable download directory and show notification
                    try {
                        const downloadDir = await invoke('get_download_dir');
                        const fullPath = `${downloadDir}/${fileName}`;
                        
                        // Check and request notification permission if needed
                        let permissionGranted = await isPermissionGranted();
                        if (!permissionGranted) {
                            const permission = await requestPermission();
                            permissionGranted = permission === 'granted';
                        }
                        
                        // Show system notification if permission is granted
                        if (permissionGranted) {
                            await sendNotification({
                                title: 'Download Complete',
                                body: `Styled image saved to: ${fullPath}`
                            });
                        }
                        
                        // Also show footer message with full path and click-to-open functionality
                        props.addFooterMessage("download", `Styled image downloaded to: ${fullPath} (Click to open)`, false, 8000);
                        
                        // Add click handler to footer message
                        setTimeout(() => {
                            const downloadMessage = document.querySelector('.download');
                            if (downloadMessage) {
                                downloadMessage.style.cursor = 'pointer';
                                downloadMessage.style.textDecoration = 'underline';
                                downloadMessage.title = 'Click to open file';
                                downloadMessage.addEventListener('click', async () => {
                                    try {
                                        await invoke('open_file_in_default_app', { filePath: fullPath });
                                    } catch (error) {
                                        logger.error('PhotoEditor', 'file_open_failed', 'Failed to open downloaded file', { error: error.message });
                                        // Fallback to plugin opener
                                        try {
                                            await openUrl(fileUrl(fullPath));
                                        } catch (fallbackError) {
                                            logger.error('PhotoEditor', 'fallback_file_open_failed', 'Fallback file opening also failed', { error: fallbackError.message });
                                        }
                                    }
                                });
                            }
                        }, 100);
                    } catch (error) {
                        logger.error('PhotoEditor', 'download_notification_failed', 'Failed to get download directory or show notification', { error: error.message });
                        // Fallback to footer message only
                        props.addFooterMessage("download", `Styled image downloaded: ${fileName}`, false, 5000);
                    }
                }, 'image/png');
            };
            
            tempImg.onerror = function() {
                props.addFooterMessage('editor', 'Failed to load image for download', false, 3000);
            };
            
            // Load the original image
            tempImg.src = mainImage.src;
            
        } catch (error) {
            logger.error('PhotoEditor', 'download_failed', 'Download failed', { error: error.message });
            props.addFooterMessage('editor', 'Download failed: ' + error.message, false, 3000);
        }
    }

    // Crop functionality
    function enterCropMode() {
        setCropMode(true);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        logger.debug('PhotoEditor', 'crop_mode_enter', 'Entering crop mode');
    }

    function exitCropMode() {
        setCropMode(false);
        setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
        setIsDragging(false);
        logger.debug('PhotoEditor', 'crop_mode_exit', 'Exiting crop mode');
    }

    function applyCrop() {
        setEditorStyles(prev => ({
            ...prev,
            crop: { ...cropSelection }
        }));
        setCropMode(false);
        setIsDragging(false);
        
        // Apply the crop immediately
        const newStyles = {
            ...editorStyles,
            crop: { ...cropSelection }
        };
        applyTempStyleWithValues(newStyles);
    }

    function setCropPreset(preset) {
        if (!preset.ratio) {
            // Original size
            setCropSelection({ x: 0, y: 0, width: 100, height: 100 });
            return;
        }

        // Calculate crop area to maintain aspect ratio
        const ratio = preset.ratio;
        let width = 100;
        let height = 100;
        let x = 0;
        let y = 0;

        if (ratio > 1) {
            // Landscape: limit by height
            height = 100 / ratio;
            y = (100 - height) / 2;
        } else {
            // Portrait: limit by width
            width = 100 * ratio;
            x = (100 - width) / 2;
        }

        setCropSelection({ x, y, width, height });
    }

    function handleImageMouseDown(e) {
        if (!cropMode) return;
        
        logger.debug('PhotoEditor', 'crop_mouse_down', 'Mouse down event in crop mode');
        
        // Get position relative to the overlay element (which covers the image)
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        logger.debug('PhotoEditor', 'crop_position', 'Calculated crop position', { x, y });

        setIsDragging(true);
        setDragStart({ x, y });
        setDragMode('create');
        setCropSelection({ x, y, width: 0, height: 0 });
        
        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseMove(e) {
        if (!cropMode || !isDragging) return;

        // Get position relative to the overlay element
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (dragMode === 'create') {
            const width = Math.abs(x - dragStart.x);
            const height = Math.abs(y - dragStart.y);
            const startX = Math.min(x, dragStart.x);
            const startY = Math.min(y, dragStart.y);

            setCropSelection({
                x: Math.max(0, Math.min(startX, 100)),
                y: Math.max(0, Math.min(startY, 100)),
                width: Math.max(0, Math.min(width, 100 - Math.max(0, startX))),
                height: Math.max(0, Math.min(height, 100 - Math.max(0, startY)))
            });
        }
        
        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }

    function handleImageMouseUp(e) {
        if (!cropMode) return;
        logger.debug('PhotoEditor', 'crop_mouse_up', 'Mouse up event in crop mode');
        setIsDragging(false);
        
        // Prevent default to avoid any interference
        e.preventDefault();
        e.stopPropagation();
    }


    // Render crop overlay (no full screen darkening needed)
    const renderCropOverlay = () => {
        return null; // Only photo area overlay is needed
    };

    // Render photo-specific crop overlay directly on the photo container
    const renderPhotoOverlay = () => {
        if (!cropMode) return null;

        const photoContainer = document.querySelector('#photo');
        if (!photoContainer) return null;

        // Ensure photo container is positioned relatively
        if (window.getComputedStyle(photoContainer).position === 'static') {
            photoContainer.style.position = 'relative';
        }

        return ReactDOM.createPortal(
            <>
                {/* Semi-transparent overlay over the photo */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent dark
                    border: 'none',
                    pointerEvents: 'auto',
                    cursor: 'crosshair',
                    zIndex: 10000
                }}
                onMouseDown={handleImageMouseDown}
                onMouseMove={handleImageMouseMove}
                onMouseUp={handleImageMouseUp}
                >
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        color: 'white',
                        fontSize: '14px',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        pointerEvents: 'none'
                    }}>
                        Click and drag to crop
                    </div>
                    {/* Crop selection rectangle */}
                    <div
                        id="crop-selection"
                        style={{
                            position: 'absolute',
                            border: '2px dashed #ffffff',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            pointerEvents: 'none',
                            left: `${cropSelection.x}%`,
                            top: `${cropSelection.y}%`,
                            width: `${cropSelection.width}%`,
                            height: `${cropSelection.height}%`
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: 'white',
                            fontSize: '12px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                        }}>
                            {Math.round(cropSelection.width)}% × {Math.round(cropSelection.height)}%
                        </div>
                    </div>

                    {/* Instruction text */}
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        color: 'white',
                        fontSize: '14px',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        pointerEvents: 'none',
                        zIndex: 10001
                    }}>
                        Click and drag on the photo to select crop area
                    </div>
                </div>
            </>,
            photoContainer
        );
    };

    return (
        <>
            {renderCropOverlay()}
            {renderPhotoOverlay()}
            <div className="editor-tab">
                <div className="photo-info-editor">
                    <div className="editor-controls">
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Rotation (deg):</label>
                                <input type="range" min="0" max="360" value={editorStyles.rotate}
                                       className="editor-slider" onChange={(e) => updateStyle('rotate', e.target.value)} />
                                <input type="number" min="0" max="360" value={editorStyles.rotate}
                                       className="value-input" onChange={(e) => updateStyle('rotate', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('rotate')} title="Reset rotation">↻</button>
                            </div>
                            <div className="rotation-shortcuts">
                                <button className="shortcut-btn" onClick={() => rotateBy(-90)} title="Turn left 90°">↶ 90°</button>
                                <button className="shortcut-btn" onClick={() => rotateBy(90)} title="Turn right 90°">↷ 90°</button>
                            </div>
                        </div>
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Brightness:</label>
                                <input type="range" min="0" max="200" value={editorStyles.brightness}
                                       className="editor-slider" onChange={(e) => updateStyle('brightness', e.target.value)} />
                                <input type="number" min="0" max="200" value={editorStyles.brightness}
                                       className="value-input" onChange={(e) => updateStyle('brightness', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('brightness')} title="Reset brightness">↻</button>
                            </div>
                        </div>
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Contrast:</label>
                                <input type="range" min="0" max="200" value={editorStyles.contrast}
                                       className="editor-slider" onChange={(e) => updateStyle('contrast', e.target.value)} />
                                <input type="number" min="0" max="200" value={editorStyles.contrast}
                                       className="value-input" onChange={(e) => updateStyle('contrast', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('contrast')} title="Reset contrast">↻</button>
                            </div>
                        </div>
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Saturation:</label>
                                <input type="range" min="0" max="200" value={editorStyles.saturation}
                                       className="editor-slider" onChange={(e) => updateStyle('saturation', e.target.value)} />
                                <input type="number" min="0" max="200" value={editorStyles.saturation}
                                       className="value-input" onChange={(e) => updateStyle('saturation', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('saturation')} title="Reset saturation">↻</button>
                            </div>
                        </div>
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Hue (deg):</label>
                                <input type="range" min="0" max="360" value={editorStyles.hue}
                                       className="editor-slider" onChange={(e) => updateStyle('hue', e.target.value)} />
                                <input type="number" min="0" max="360" value={editorStyles.hue}
                                       className="value-input" onChange={(e) => updateStyle('hue', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('hue')} title="Reset hue">↻</button>
                            </div>
                        </div>
                        <div className="editor-control">
                            <div className="control-row">
                                <label>Scale:</label>
                                <input type="range" min="50" max="200" value={editorStyles.scale}
                                       className="editor-slider" onChange={(e) => updateStyle('scale', e.target.value)} />
                                <input type="number" min="50" max="200" value={editorStyles.scale}
                                       className="value-input" onChange={(e) => updateStyle('scale', e.target.value)} />
                                <button className="reset-btn" onClick={() => resetSingleControl('scale')} title="Reset scale">↻</button>
                            </div>
                        </div>
                        <div className="editor-control crop-control">
                            <div className="control-row">
                                <label>Crop:</label>
                                {!cropMode ? (
                                    <button className="action-btn" onClick={enterCropMode}>Crop</button>
                                ) : (
                                    <div className="crop-buttons">
                                        <button className="action-btn" onClick={applyCrop}>Done</button>
                                        <button className="action-btn" onClick={exitCropMode}>Cancel</button>
                                    </div>
                                )}
                            </div>
                            {cropMode && (
                                <div className="crop-presets">
                                    <label>Presets:</label>
                                    <div className="preset-buttons">
                                        {cropPresets.map((preset, index) => (
                                            <button
                                                key={index}
                                                className="preset-btn"
                                                onClick={() => setCropPreset(preset)}
                                                title={`Set crop to ${preset.name}`}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="editor-buttons">
                        <button className="action-btn" onClick={() => applyStyle()}>Apply</button>
                        <button className="action-btn" onClick={() => saveAsCopy()}>Save As Copy</button>
                        <button className="action-btn" onClick={() => resetStyle()}>Reset</button>
                        <button className="action-btn" onClick={() => downloadStyled()}>Download</button>
                    </div>
                    <div className="css-preview">
                        <label>CSS Preview:</label>
                        <textarea id="css-preview-text" rows="4" readOnly className="css-preview-textarea"></textarea>
                    </div>
                </div>
            </div>
        </>
    );
}

export default PhotoEditor;
