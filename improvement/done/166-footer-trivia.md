# Footer豆知識の修正と追加

## Overview

Footerの🦀がつぶやく豆知識（RandomMessages）の英文法修正と、新しい豆知識の追加。

## 現在の問題点

### 英文法の修正

| # | 現在 | 修正後 |
|---|------|--------|
| 2 | "High ISO will give you photos with noise. Especially if your camera's image sensor is small." | "High ISO produces noisy photos, especially if your camera has a small sensor." |
| 3 | "A full-size camera is a camera with a 35mm sensor." | "A full-frame camera has a 35mm (36×24mm) sensor." |
| 4 | "The MicroFourThrds camera is the camera with about a half of a 35mm sensor." | "A Micro Four Thirds camera has a sensor about half the diagonal of a 35mm sensor." |
| 6 | "A fixed focus length lens doesn't have zoom function." | "A prime lens (fixed focal length) cannot zoom." |
| 9 | "Sensor sizes: Medium Format > 35mm > APS-C > For Thrds > 1inch > Smart phone sensor." | "Sensor sizes: Medium Format > 35mm > APS-C > Four Thirds > 1-inch > Smartphone." |

## 追加提案

### 歴史（商標を避けた表現）

```javascript
// 商標なし - 安全
"The first photograph was taken in 1826, requiring an 8-hour exposure.",
"The word 'photography' comes from Greek, meaning 'drawing with light'.",
"35mm film was originally created for motion pictures, then adapted for still cameras in the 1920s.",
"The first digital camera was created in 1975 and weighed about 3.6 kg.",
"Color photography became widely available to consumers in the 1930s.",
"The first autofocus SLR camera was released in 1985.",
"Daguerreotype, invented in 1839, was the first publicly available photographic process.",
```

### 撮影テクニック

```javascript
"The 'Rule of Thirds' helps create balanced compositions by placing subjects at intersection points.",
"Golden hour occurs just after sunrise and before sunset, providing warm, soft light.",
"Blue hour is the twilight period with a deep blue sky, great for cityscapes.",
"Panning: follow a moving subject with a slow shutter speed to blur the background.",
"Back-button focus separates focusing from the shutter button for more control.",
"Fill flash can soften harsh shadows in bright daylight portraits.",
"A polarizing filter can reduce reflections and deepen blue skies.",
"Bracketing takes multiple shots at different exposures for HDR or safety.",
```

### 技術知識

```javascript
"Aperture is measured in f-stops. Lower f-numbers mean wider openings and shallower depth of field.",
"Image stabilization can give you 3-5 stops of hand-holding advantage.",
"RAW files contain unprocessed sensor data, giving more flexibility in post-processing.",
"JPEG uses lossy compression - each re-save slightly reduces image quality.",
"The 'Sunny 16' rule: on a sunny day, use f/16 with shutter speed = 1/ISO.",
"Diffraction softens images at very small apertures like f/22.",
"Depth of field depends on aperture, focal length, and distance to subject.",
"A stop is a doubling or halving of light (e.g., f/2.8 to f/4 is one stop less light).",
"Crop factor affects the effective focal length: 50mm on APS-C ≈ 75mm on full-frame.",
```

### カメラの仕組み

```javascript
"A mechanical shutter has two curtains that travel across the sensor.",
"Electronic shutters are silent but can cause rolling shutter distortion.",
"Phase detection AF is faster; contrast detection AF is more accurate.",
"Mirrorless cameras use the main sensor for both viewing and focusing.",
"DSLR stands for Digital Single-Lens Reflex, using a mirror to direct light to the viewfinder.",
"EVF (Electronic Viewfinder) shows a live preview including exposure settings.",
```

### 面白い豆知識（商標なし）

```javascript
"The 'nifty fifty' (50mm f/1.8) is often recommended as a first prime lens.",
"Bokeh comes from the Japanese word 'boke' (暈け), meaning blur or haze.",
"The Moon landing in 1969 was photographed with medium format cameras.",
"Red-eye in flash photos is caused by light reflecting off blood vessels in the retina.",
"The exposure triangle connects aperture, shutter speed, and ISO.",
"A lens hood helps reduce lens flare and protects the front element.",
"UV filters were essential for film; now they mainly protect the lens.",
"The 'chimping' habit of checking every shot on LCD can drain battery quickly.",
"Most lenses are sharpest 2-3 stops down from their maximum aperture.",
```

### 光と色

```javascript
"Color temperature is measured in Kelvin: daylight is about 5500K, tungsten is about 3200K.",
"White balance adjusts colors so white objects appear white under different lighting.",
"Overcast skies act as a giant softbox, creating even, flattering light.",
"Hard light creates strong shadows; soft light creates gentle gradients.",
```

## 修正後の完全なリスト

```javascript
const messages = [
    // 既存（修正済み）
    "If you are shooting birds in flight, you need a fast shutter speed.",
    "High ISO produces noisy photos, especially if your camera has a small sensor.",
    "A full-frame camera has a 35mm (36×24mm) sensor.",
    "A Micro Four Thirds camera has a sensor about half the diagonal of a 35mm sensor.",
    "A high shutter speed makes a photo darker. A low f-number or high ISO makes it brighter.",
    "A prime lens (fixed focal length) cannot zoom.",
    "The moon is very bright. You don't need a slow shutter speed or high ISO.",
    "Zoom ratio is the longest focal length divided by the shortest.",
    "Sensor sizes: Medium Format > 35mm > APS-C > Four Thirds > 1-inch > Smartphone.",

    // 歴史
    "The first photograph was taken in 1826, requiring an 8-hour exposure.",
    "The word 'photography' comes from Greek, meaning 'drawing with light'.",
    "35mm film was originally created for motion pictures in the early 1900s.",
    "The first digital camera was created in 1975 and weighed about 3.6 kg.",
    "Daguerreotype (1839) was the first publicly available photographic process.",

    // テクニック
    "The 'Rule of Thirds' places subjects at intersection points for balanced compositions.",
    "Golden hour provides warm, soft light just after sunrise and before sunset.",
    "Blue hour is the twilight period with a deep blue sky, great for cityscapes.",
    "Panning: follow a moving subject with slow shutter to blur the background.",
    "Fill flash softens harsh shadows in bright daylight portraits.",
    "A polarizing filter reduces reflections and deepens blue skies.",

    // 技術
    "Lower f-numbers mean wider apertures and shallower depth of field.",
    "Image stabilization can give you 3-5 stops of hand-holding advantage.",
    "RAW files give more flexibility in post-processing than JPEG.",
    "The 'Sunny 16' rule: on a sunny day, use f/16 with shutter speed = 1/ISO.",
    "Diffraction softens images at very small apertures like f/22.",
    "Crop factor: 50mm on APS-C looks like ~75mm on full-frame.",

    // カメラ
    "Mirrorless cameras use the main sensor for both viewing and focusing.",
    "Electronic shutters are silent but can cause rolling shutter distortion.",

    // 豆知識
    "The 'nifty fifty' (50mm f/1.8) is often recommended as a first prime lens.",
    "Bokeh comes from the Japanese word 'boke' (暈け), meaning blur or haze.",
    "Red-eye is caused by flash light reflecting off blood vessels in the retina.",
    "A lens hood reduces flare and protects the front element.",
    "Most lenses are sharpest 2-3 stops down from their maximum aperture.",
    "Color temperature: daylight ~5500K, tungsten ~3200K.",
    "Overcast skies act as a giant softbox, creating even, flattering light.",
];
```

## 追加提案（カテゴリ拡張）

### レンズの知識

```javascript
"Wide-angle lenses (below 35mm) exaggerate perspective and make objects appear farther apart.",
"Telephoto lenses compress perspective, making distant objects appear closer together.",
"Macro lenses can focus very close, often achieving 1:1 (life-size) magnification.",
"Fisheye lenses capture up to 180° field of view with distinctive barrel distortion.",
"Lens elements are coated to reduce reflections and improve contrast.",
"Aspherical lens elements help correct optical aberrations and reduce lens size.",
"Chromatic aberration causes color fringing at high-contrast edges.",
"Lens breathing: some lenses change focal length slightly when focusing.",
"Fast lenses (f/1.4, f/1.8) allow more light but are heavier and more expensive.",
"Kit lenses are versatile but often have smaller maximum apertures (f/3.5-5.6).",
```

### ポートレート撮影

```javascript
"85mm is often called the 'portrait king' for its flattering perspective.",
"Catchlights are reflections in the eyes that add life to portraits.",
"Butterfly lighting creates a shadow under the nose, flattering for most faces.",
"Rembrandt lighting creates a triangle of light on the shadowed cheek.",
"Eye-level shots feel natural; low angles add power; high angles soften.",
"Focus on the nearest eye for sharp portraits.",
"A wide aperture (f/1.8-f/2.8) blurs the background, isolating your subject.",
"Natural window light is one of the best light sources for portraits.",
```

### 風景撮影

```javascript
"A tripod is essential for sharp landscape photos, especially at dawn or dusk.",
"Hyperfocal distance maximizes depth of field from foreground to infinity.",
"Graduated ND filters balance bright skies with darker foregrounds.",
"Leading lines guide the viewer's eye through the composition.",
"Including foreground interest adds depth to landscape photos.",
"Long exposures can smooth water and blur clouds for a dreamy effect.",
"Scout locations during the day, then return for golden or blue hour.",
"Weather adds drama: storms, fog, and mist create atmosphere.",
```

### 夜景・星空撮影

```javascript
"The 500 Rule: divide 500 by focal length to get max shutter speed before star trails.",
"Light pollution maps help find dark skies for astrophotography.",
"A fast wide-angle lens (f/2.8 or faster) is ideal for Milky Way shots.",
"Star trails require exposures of 30 minutes or longer.",
"City lights at night often have a warm orange glow from sodium lamps.",
"Use manual focus at infinity for sharp stars; autofocus struggles in darkness.",
"Moon phases matter: a new moon provides the darkest skies for stars.",
"High ISO noise reduction can smear fine star details.",
```

### マクロ・クローズアップ

```javascript
"Depth of field becomes extremely shallow in macro photography.",
"Focus stacking combines multiple images to increase depth of field.",
"Extension tubes allow closer focusing without buying a macro lens.",
"Ring lights provide even, shadow-free lighting for macro subjects.",
"A diffuser softens harsh light on small subjects like insects and flowers.",
"Magnification ratio 1:1 means the subject is life-size on the sensor.",
"Wind is the enemy of macro photography; even slight movement causes blur.",
```

### フィルム写真

```javascript
"Film grain is caused by silver halide crystals; higher ISO = larger grain.",
"Slide film (positive) has less exposure latitude than negative film.",
"Black and white film can be developed at home with simple chemistry.",
"Expired film often produces color shifts and increased grain.",
"Push processing increases film speed but adds contrast and grain.",
"Pull processing decreases contrast and can rescue overexposed film.",
"C-41 is the standard color negative process; E-6 is for slide film.",
```

### ファイル形式と後処理

```javascript
"TIFF is lossless and preferred for archiving edited images.",
"PNG supports transparency; JPEG does not.",
"HEIF/HEIC offers better compression than JPEG at similar quality.",
"Bit depth: 8-bit has 256 levels per channel; 16-bit has 65,536.",
"Color space: sRGB for web, Adobe RGB for print.",
"DNG is an open RAW format that ensures long-term compatibility.",
"Metadata (EXIF) stores camera settings, date, and sometimes GPS.",
"Clipping warning shows areas that are pure white or pure black.",
```

### 印刷

```javascript
"300 DPI is the standard resolution for high-quality photo prints.",
"Larger prints need higher resolution: 8x10 needs at least 2400x3000 pixels.",
"Monitor calibration ensures prints match what you see on screen.",
"Paper finish affects the look: glossy for vibrant colors, matte for subtle tones.",
"Inkjet printers use more colors than CMYK for wider color gamut.",
```

### カメラメンテナンス

```javascript
"Sensor dust appears as dark spots, especially visible at small apertures.",
"Use a rocket blower, not compressed air, to clean sensors safely.",
"Store lenses with caps on in a dry place to prevent fungus.",
"Silica gel packets help control humidity in camera bags.",
"Clean lens glass with a microfiber cloth in circular motions.",
"Battery life decreases in cold weather; keep spares warm in your pocket.",
```

### 物理・光学

```javascript
"Light travels at about 300,000 km per second.",
"The human eye has an equivalent ISO of about 1 in daylight, up to 800 in darkness.",
"Mirrors reflect light; lenses refract (bend) light.",
"Infrared photography reveals a world invisible to the human eye.",
"Polarized light vibrates in a single plane; polarizers block other planes.",
"Diffraction limits sharpness: light bends around aperture edges.",
"The inverse square law: doubling distance quarters the light intensity.",
```

### 写真用語の語源

```javascript
"'Camera' comes from Latin 'camera obscura', meaning 'dark room'.",
"'Lens' comes from Latin 'lentil', because early lenses were lentil-shaped.",
"'Aperture' comes from Latin 'apertura', meaning 'opening'.",
"'Shutter' originally referred to the physical door blocking light.",
"'Flash' was named after the bright flash of early powder flashes.",
"'Negative' and 'positive' describe reversed vs. true tones.",
"'Stop' originated from physical stops in early aperture mechanisms.",
```

### 構図の原則

```javascript
"Negative space (empty areas) can emphasize your subject.",
"Symmetry creates a sense of balance and calm.",
"Breaking rules intentionally can create dynamic, memorable images.",
"Odd numbers of subjects (3, 5, 7) often look more natural than even numbers.",
"Frame within a frame: use doorways, windows, or branches to frame subjects.",
"Diagonal lines add energy and movement to compositions.",
"The golden spiral (Fibonacci) is another way to place subjects harmoniously.",
"Simplify: remove distracting elements from the frame.",
```

### ミラーレス vs 一眼レフ

```javascript
"Mirrorless cameras have no mirror, making them smaller and lighter than DSLRs.",
"DSLR mirrors flip up during exposure, causing a brief viewfinder blackout.",
"Mirrorless EVFs show exposure preview; DSLR optical viewfinders show raw light.",
"Mirrorless cameras can use on-sensor phase detection for fast, accurate AF.",
"DSLRs have longer battery life because optical viewfinders use no power.",
"Mirrorless silent shooting is ideal for weddings, wildlife, and street photography.",
"Eye-detection AF in mirrorless cameras tracks subject eyes automatically.",
"Mirrorless cameras often have in-body image stabilization (IBIS).",
"DSLRs have a larger selection of native lenses, though adapters bridge the gap.",
"Mirrorless cameras excel at video with features like 4K and focus peaking.",
"SLR stands for Single-Lens Reflex; the mirror reflects light to the viewfinder.",
"The mirror box in DSLRs adds size but provides a direct optical view.",
"Mirrorless cameras first became popular in the late 2000s.",
"Flange distance is shorter in mirrorless, allowing adaptation of many legacy lenses.",
"EVF lag has improved dramatically; modern mirrorless EVFs feel nearly instant.",
```

### 撮影ジャンル

```javascript
"Street photography captures candid moments of everyday life.",
"Documentary photography tells stories through truthful images.",
"Fine art photography prioritizes the artist's vision over documentation.",
"Product photography often uses light tents for even, shadow-free lighting.",
"Food photography: shoot quickly before hot food loses its steam.",
"Sports photography needs fast autofocus and high frame rates.",
"Wildlife photography requires patience, long lenses, and quiet movements.",
"Architectural photography often uses tilt-shift lenses to correct perspective.",
```

## 除外した内容（商標関連）

以下は商標が含まれるため除外：
- ~~Kodak introduced the first consumer camera in 1888~~
- ~~Leica adapted 35mm for still cameras~~
- ~~Hasselblad was used for Moon landing~~
- ~~The first autofocus SLR was the Minolta 7000~~

## Source Code Changes

**ファイル**: `src/App/Footer/RandomMessages.jsx`

## Testing Strategy

- [ ] 全メッセージが10秒ごとにランダム表示される
- [ ] 英文法が正しい
- [ ] 商標が含まれていない
- [ ] 内容が正確
