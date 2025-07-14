import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { show } from "@tauri-apps/api/app";

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});
    const [comment, setComment] = useState("");
    const [activeTab, setActiveTab] = useState("info");
    const [originalStyles, setOriginalStyles] = useState(new Map());
    const [editorStyles, setEditorStyles] = useState({
        rotate: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        scale: 100
    });

    useEffect((e) => {
        if (props.currentPhotoPath && props.currentPhotoPath !== "" && props.showSideMenu) {
            getPhotoInfo(props.currentPhotoPath).then((photoInfo) => {
            });
        }
    }, [props.currentPhotoPath, props.showSideMenu])

    // Clear stored original styles when photo changes
    useEffect(() => {
        setOriginalStyles(new Map());
        // Reset editor styles when photo changes
        setEditorStyles({
            rotate: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            scale: 100
        });
        
        // Reset UI sliders
        setTimeout(() => {
            document.querySelectorAll('.photo-info-editor input[type="range"]').forEach(slider => {
                slider.value = slider.defaultValue;
            });
            
            ['rotate', 'brightness', 'contrast', 'saturation', 'hue', 'scale'].forEach(prop => {
                const valueSpan = document.getElementById(`${prop}-value`);
                if (valueSpan) {
                    valueSpan.textContent = prop === 'brightness' || prop === 'contrast' || prop === 'saturation' || prop === 'scale' ? '100' : '0';
                }
            });
            
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = '';
            }
        }, 100);
    }, [props.currentPhotoPath])

    async function getPhotoInfo(path) {
        if (props.imgCacheMap[path] && props.imgCacheMap[path][1]) {
            setPhotoInfo(props.imgCacheMap[path][1])
        } else if (props.showSideMenu) {
            await invoke("get_photo_info", { pathStr: path }).then((r) => {
                let data = JSON.parse(r);
                if (data.meta) {
                    if (data.meta.star.data > 0) {
                        const newStar = [false, false, false, false, false];
                        for (let i = 0; i < data.meta.star.data; i++) {
                            newStar[i] = true;
                        }
                        props.setStar(newStar);
                    } else {
                        props.setStar([false, false, false, false, false]);
                    }
                    if (data.meta.comment) {
                        setComment(data.meta.comment.data);
                    } else {
                        setComment("");
                    }
                } else {
                    props.setStar([false, false, false, false, false]);
                    setComment("");
                }
                setPhotoInfo(data);
            });
        }
    };

    function getCurrentStarRate() {
        return getStarRate(props.star);
    }

    function getStarRate(star) {
        let starIndex = 0;
        for (let i = 0; i < 5; i++) {
            if (props.star[i]) {
                starIndex = i + 1;
            } else {
                break;
            }
        }
        return starIndex;
    }

    function toggleStar(i) {
        const newStar = []
        const currentStarRate = getCurrentStarRate()
        if (i === 0 && currentStarRate === 0) {
            newStar[0] = true;
        } else if (!props.star[i] || (props.star[i] && props.star[i + 1])) {
            for (let j = 0; j <= i; j++) {
                newStar[j] = true;
            }
            if (i < 4) {
                for (let j = i + 1; j < 5; j++) {
                    newStar[j] = false;
                }
            }
        } else {
            if (i < 4) {
                for (let j = i + 1; j < 5; j++) {
                    newStar[j] = false;
                }
            }
        }
        const newStarRate = getStarRate(newStar);
        if (currentStarRate !== newStarRate) {
            invoke("save_star", { pathStr: props.currentPhotoPath, starNum: newStarRate });
            props.setStar(newStar);
        }
    }

    function saveComment() {
        invoke("save_comment", { pathStr: props.currentPhotoPath, commentStr: comment });
    }


    // Editor functions
    function updateStyle(property, value) {
        // Update state
        setEditorStyles(prev => {
            const newStyles = {
                ...prev,
                [property]: parseInt(value)
            };
            
            // Generate CSS with the new values immediately
            const css = generateCSSFromValues(newStyles);
            
            // Update CSS preview
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = css;
            }
            
            // Apply to current image immediately with new values
            applyTempStyleWithValues(newStyles);
            
            return newStyles;
        });
        
        // Update the value display
        const valueSpan = document.getElementById(`${property}-value`);
        if (valueSpan) {
            valueSpan.textContent = value;
        }
    }

    function generateCSS() {
        return generateCSSFromValues(editorStyles);
    }

    function generateCSSFromValues(styles) {
        const { rotate, brightness, contrast, saturation, hue, scale } = styles;
        
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
        
        return css.trim();
    }

    function applyTempStyle(css) {
        applyTempStyleWithValues(editorStyles);
    }

    function applyTempStyleWithValues(styles) {
        const { rotate, brightness, contrast, saturation, hue, scale } = styles;
        
        // Store and apply styles to main image
        const mainImage = document.querySelector('#photoImgTag');
        if (mainImage) {
            // Store original styles immediately if not stored
            if (!originalStyles.has('main-image')) {
                const originalStyle = {
                    transform: mainImage.style.transform || '',
                    filter: mainImage.style.filter || '',
                    cssText: mainImage.style.cssText || ''
                };
                // Use callback to ensure immediate update
                setOriginalStyles(prev => new Map(prev.set('main-image', originalStyle)));
                // Also store locally for immediate use
                originalStyles.set('main-image', originalStyle);
            }
            
            // Get the stored original values (use local Map for immediate access)
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
                }
            });
        };
        
        applyToThumbnails('.photos .row img', 'grid-thumb');
        applyToThumbnails('#photos-list-mini img', 'mini-thumb');
    }

    async function applyStyle() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('Please select a photo first');
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('No styles to apply');
            return;
        }
        
        try {
            await invoke('save_css_style', {
                photoPath: props.currentPhotoPath,
                cssStyle: css
            });
            
            props.addFooterMessage('Style applied successfully');
        } catch (error) {
            console.error('Failed to apply style:', error);
            props.addFooterMessage('Failed to apply style');
        }
    }

    async function saveAsCopy() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('Please select a photo first');
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('No styles to save');
            return;
        }
        
        props.addFooterMessage('Save as copy functionality not yet implemented');
    }

    function resetStyle() {
        // First restore original styles before resetting state
        const mainImage = document.querySelector('#photoImgTag');
        if (mainImage) {
            const originalStyle = originalStyles.get('main-image');
            if (originalStyle) {
                mainImage.style.transform = originalStyle.transform;
                mainImage.style.filter = originalStyle.filter;
            } else {
                mainImage.style.transform = '';
                mainImage.style.filter = '';
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
                } else {
                    img.style.transform = '';
                    img.style.filter = '';
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
            scale: 100
        });
        
        // Reset UI elements after state is set
        setTimeout(() => {
            // Reset all sliders and values
            document.querySelectorAll('.photo-info-editor input[type="range"]').forEach(slider => {
                slider.value = slider.defaultValue;
            });
            
            ['rotate', 'brightness', 'contrast', 'saturation', 'hue', 'scale'].forEach(prop => {
                const valueSpan = document.getElementById(`${prop}-value`);
                if (valueSpan) {
                    valueSpan.textContent = prop === 'brightness' || prop === 'contrast' || prop === 'saturation' || prop === 'scale' ? '100' : '0';
                }
            });
            
            // Clear CSS preview
            const previewTextarea = document.getElementById('css-preview-text');
            if (previewTextarea) {
                previewTextarea.value = '';
            }
        }, 0);
    }

    async function downloadStyled() {
        if (!props.currentPhotoPath) {
            props.addFooterMessage('Please select a photo first');
            return;
        }
        
        const css = generateCSS();
        if (!css) {
            props.addFooterMessage('No styles to download');
            return;
        }
        
        try {
            // Get the main image element
            const mainImage = document.querySelector('#photoImgTag');
            if (!mainImage) {
                props.addFooterMessage('Photo not found');
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
                // Apply CSS transforms to canvas context
                ctx.save();
                
                // Move to center for rotation
                ctx.translate(canvas.width / 2, canvas.height / 2);
                
                // Parse and apply transforms from editor styles
                const { rotate, brightness, contrast, saturation, scale } = editorStyles;
                
                if (rotate !== 0) {
                    ctx.rotate((rotate * Math.PI) / 180);
                }
                
                if (scale !== 100) {
                    const scaleValue = scale / 100;
                    ctx.scale(scaleValue, scaleValue);
                }
                
                // Apply filter effects (brightness, contrast, saturation are approximated)
                if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
                    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
                }
                
                // Draw the image centered
                ctx.drawImage(tempImg, -tempImg.width / 2, -tempImg.height / 2);
                ctx.restore();
                
                // Convert canvas to blob and download
                canvas.toBlob(function(blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const fileName = props.currentPhotoPath.split('/').pop().replace(/\.[^/.]+$/, '_styled.png');
                    link.download = fileName;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Show notification with download path
                    const downloadPath = `Downloads/${fileName}`;
                    props.addFooterMessage(`Styled image downloaded to: ${downloadPath}`);
                }, 'image/png');
            };
            
            tempImg.onerror = function() {
                props.addFooterMessage('Failed to load image for download');
            };
            
            // Load the original image
            tempImg.src = mainImage.src;
            
        } catch (error) {
            console.error('Download failed:', error);
            props.addFooterMessage('Download failed: ' + error.message);
        }
    }

    return (
        <>
            <div className="togglePhotoInfo">
                <a href="#" onClick={() => {
                    props.setShowSideMenu(!props.showSideMenu);
                    document.querySelector("#dummy-for-focus").focus();
                }}>
                    {props.showSideMenu ? ">" : "<"}
                </a>
            </div>
            <div className="photo-info-tabs">
                <div className="tab-header">
                    <button 
                        className={activeTab === "info" ? "tab-button active" : "tab-button"}
                        onClick={() => setActiveTab("info")}
                    >
                        📷 Info
                    </button>
                    <button 
                        className={activeTab === "editor" ? "tab-button active" : "tab-button"}
                        onClick={() => setActiveTab("editor")}
                    >
                        🎨 Editor
                    </button>
                </div>
            </div>
            {props.currentPhotoPath && props.showSideMenu && (
                <div className="tab-content">
                    {activeTab === "info" && (
                        <div className="info-tab">
                            <table>
                                <tbody>
                                    <tr><th>File Name</th>
                                        <td>
                                            <a href="#" onClick={() => {
                                                writeText(props.currentPhotoPath);
                                                props.addFooterMessage("clipboard", "Copy file path to clipboard", 50000);
                                            }}>📋</a>
                                            <a
                                                onMouseEnter={() => { props.addFooterMessage("current_phtoo_path", "File Path: " + props.currentPhotoPath, false, 10000) }}>
                                                {props.currentPhotoPath.replace(/^.+\//, '')}
                                            </a>
                                        </td></tr>
                                    <tr><th>ISO</th><td>{photoInfo.exif ? photoInfo.exif.iso : ""}</td></tr>
                                    <tr><th>FNumber</th><td>{photoInfo.exif ? photoInfo.exif.fnumber : ""}</td></tr>
                                    <tr><th>Shutter Speed</th><td>{photoInfo.exif ? photoInfo.exif.exposure_time : ""}</td></tr>
                                    <tr><th>LensModel</th><td>{photoInfo.exif ? photoInfo.exif.lens_model : ""}</td></tr>
                                    <tr><th>LensMake</th><td>{photoInfo.exif ? photoInfo.exif.lens_make : ""}</td></tr>
                                    <tr><th>Make</th><td>{photoInfo.exif ? photoInfo.exif.make : ""}</td></tr>
                                    <tr><th>Model</th><td>{photoInfo.exif ? photoInfo.exif.model : ""}</td></tr>
                                    <tr><th>Date & Time</th><td>{photoInfo.exif ? photoInfo.exif.date_time : ""}</td></tr>
                                    <tr><th>Focal Length</th><td>{photoInfo.exif ?
                                        photoInfo.exif.focal_length == photoInfo.exif.focal_length_in35mm_film
                                            ? photoInfo.exif.focal_length
                                            : photoInfo.exif.focal_length + "(" + photoInfo.exif.focal_length_in35mm_film + ")" : ""}
                                    </td></tr>
                                    <tr><th>Digital Zoom Ratio</th><td>{photoInfo.exif ? photoInfo.exif.digital_zoom_ratio : ""}</td></tr>
                                    <tr><th>Exposure Mode</th><td>{photoInfo.exif ? photoInfo.exif.exposure_mode : ""}</td></tr>
                                    <tr><th>WhiteBalance Mode</th><td>{photoInfo.exif ? photoInfo.exif.white_balance_mode : ""}</td></tr>
                                    <tr><th>Orientation</th><td>{photoInfo.exif ? photoInfo.exif.orientation : ""}</td></tr>
                                </tbody>
                            </table>
                            <div>
                                Stars:
                                <span className="star">
                                    {
                                        [0, 1, 2, 3, 4].map((v, i) => {
                                            return <a key={i} href="#" value={v} onClick={() => { toggleStar(v) }}>{props.star[i] ? "★" : "☆"}</a>
                                        })
                                    }
                                </span>
                            </div>
                            <div className="comment">
                                Comment:<br />
                                <textarea
                                    onChange={(e) => setComment(e.target.value)}
                                    value={comment}>
                                </textarea>
                                <button onClick={() => saveComment()}>SAVE</button>
                            </div>
                        </div>
                    )}
                    {activeTab === "editor" && (
                        <div className="editor-tab">
                            <div className="photo-info-editor">
                                <div className="editor-controls">
                                    <div className="editor-control">
                                        <label>Rotation (deg):</label>
                                        <input type="range" min="0" max="360" defaultValue="0" 
                                               onChange={(e) => updateStyle('rotate', e.target.value)} />
                                        <span id="rotate-value">0</span>
                                    </div>
                                    <div className="editor-control">
                                        <label>Brightness:</label>
                                        <input type="range" min="0" max="200" defaultValue="100" 
                                               onChange={(e) => updateStyle('brightness', e.target.value)} />
                                        <span id="brightness-value">100</span>
                                    </div>
                                    <div className="editor-control">
                                        <label>Contrast:</label>
                                        <input type="range" min="0" max="200" defaultValue="100" 
                                               onChange={(e) => updateStyle('contrast', e.target.value)} />
                                        <span id="contrast-value">100</span>
                                    </div>
                                    <div className="editor-control">
                                        <label>Saturation:</label>
                                        <input type="range" min="0" max="200" defaultValue="100" 
                                               onChange={(e) => updateStyle('saturation', e.target.value)} />
                                        <span id="saturation-value">100</span>
                                    </div>
                                    <div className="editor-control">
                                        <label>Hue (deg):</label>
                                        <input type="range" min="0" max="360" defaultValue="0" 
                                               onChange={(e) => updateStyle('hue', e.target.value)} />
                                        <span id="hue-value">0</span>
                                    </div>
                                    <div className="editor-control">
                                        <label>Scale:</label>
                                        <input type="range" min="50" max="200" defaultValue="100" 
                                               onChange={(e) => updateStyle('scale', e.target.value)} />
                                        <span id="scale-value">100</span>
                                    </div>
                                </div>
                                <div className="editor-buttons">
                                    <button onClick={() => applyStyle()}>Apply</button>
                                    <button onClick={() => saveAsCopy()}>Save as Copy</button>
                                    <button onClick={() => resetStyle()}>Reset</button>
                                    <button onClick={() => downloadStyled()}>Download</button>
                                </div>
                                <div className="css-preview">
                                    <label>CSS Preview:</label>
                                    <textarea id="css-preview-text" rows="4" readOnly></textarea>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>);
}

export default PhotoInfo;
