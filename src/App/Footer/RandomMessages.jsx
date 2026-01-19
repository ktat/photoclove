import { useState, useEffect } from "react";

function RandomMessages() {
    const [randomMessage, setRandomMessage] = useState("Welcome to PhotoClove!");

    const messages = [
        // Basics (grammar-corrected)
        "If you are shooting birds in flight, you need a fast shutter speed.",
        "High ISO produces noisy photos, especially if your camera has a small sensor.",
        "A full-frame camera has a 35mm (36x24mm) sensor.",
        "A Micro Four Thirds camera has a sensor about half the diagonal of a 35mm sensor.",
        "A high shutter speed makes a photo darker. A low f-number or high ISO makes it brighter.",
        "A prime lens (fixed focal length) cannot zoom.",
        "The moon is very bright. You don't need a slow shutter speed or high ISO.",
        "Zoom ratio is the longest focal length divided by the shortest.",
        "Sensor sizes: Medium Format > 35mm > APS-C > Four Thirds > 1-inch > Smartphone.",

        // History
        "The first photograph was taken in 1826, requiring an 8-hour exposure.",
        "The word 'photography' comes from Greek, meaning 'drawing with light'.",
        "35mm film was originally created for motion pictures in the early 1900s.",
        "The first digital camera was created in 1975 and weighed about 3.6 kg.",
        "Daguerreotype (1839) was the first publicly available photographic process.",

        // Technique
        "The 'Rule of Thirds' places subjects at intersection points for balanced compositions.",
        "Golden hour provides warm, soft light just after sunrise and before sunset.",
        "Blue hour is the twilight period with a deep blue sky, great for cityscapes.",
        "Panning: follow a moving subject with slow shutter to blur the background.",
        "Fill flash softens harsh shadows in bright daylight portraits.",
        "A polarizing filter reduces reflections and deepens blue skies.",

        // Technical
        "Lower f-numbers mean wider apertures and shallower depth of field.",
        "Image stabilization can give you 3-5 stops of hand-holding advantage.",
        "RAW files give more flexibility in post-processing than JPEG.",
        "The 'Sunny 16' rule: on a sunny day, use f/16 with shutter speed = 1/ISO.",
        "Diffraction softens images at very small apertures like f/22.",
        "Crop factor: 50mm on APS-C looks like ~75mm on full-frame.",

        // Camera
        "Mirrorless cameras use the main sensor for both viewing and focusing.",
        "Electronic shutters are silent but can cause rolling shutter distortion.",

        // Trivia
        "The 'nifty fifty' (50mm f/1.8) is often recommended as a first prime lens.",
        "Bokeh comes from the Japanese word 'boke', meaning blur or haze.",
        "Red-eye is caused by flash light reflecting off blood vessels in the retina.",
        "A lens hood reduces flare and protects the front element.",
        "Most lenses are sharpest 2-3 stops down from their maximum aperture.",
        "Color temperature: daylight ~5500K, tungsten ~3200K.",
        "Overcast skies act as a giant softbox, creating even, flattering light.",

        // Lens knowledge
        "Wide-angle lenses exaggerate perspective and make objects appear farther apart.",
        "Telephoto lenses compress perspective, making distant objects appear closer together.",
        "Macro lenses can focus very close, often achieving 1:1 (life-size) magnification.",
        "Lens elements are coated to reduce reflections and improve contrast.",
        "Fast lenses (f/1.4, f/1.8) allow more light but are heavier and more expensive.",

        // Portrait
        "85mm is often called the 'portrait king' for its flattering perspective.",
        "Catchlights are reflections in the eyes that add life to portraits.",
        "Focus on the nearest eye for sharp portraits.",
        "Natural window light is one of the best light sources for portraits.",

        // Landscape
        "A tripod is essential for sharp landscape photos, especially at dawn or dusk.",
        "Hyperfocal distance maximizes depth of field from foreground to infinity.",
        "Leading lines guide the viewer's eye through the composition.",
        "Long exposures can smooth water and blur clouds for a dreamy effect.",

        // Night/Astro
        "The 500 Rule: divide 500 by focal length to get max shutter speed before star trails.",
        "A fast wide-angle lens (f/2.8 or faster) is ideal for Milky Way shots.",
        "Moon phases matter: a new moon provides the darkest skies for stars.",

        // Macro
        "Depth of field becomes extremely shallow in macro photography.",
        "Focus stacking combines multiple images to increase depth of field.",
        "Wind is the enemy of macro photography; even slight movement causes blur.",

        // File formats
        "TIFF is lossless and preferred for archiving edited images.",
        "Bit depth: 8-bit has 256 levels per channel; 16-bit has 65,536.",
        "Color space: sRGB for web, Adobe RGB for print.",
        "Metadata (EXIF) stores camera settings, date, and sometimes GPS.",

        // Printing
        "300 DPI is the standard resolution for high-quality photo prints.",
        "Monitor calibration ensures prints match what you see on screen.",

        // Maintenance
        "Sensor dust appears as dark spots, especially visible at small apertures.",
        "Use a rocket blower, not compressed air, to clean sensors safely.",
        "Silica gel packets help control humidity in camera bags.",
        "Battery life decreases in cold weather; keep spares warm in your pocket.",

        // Physics/Optics
        "Light travels at about 300,000 km per second.",
        "The inverse square law: doubling distance quarters the light intensity.",

        // Etymology
        "'Camera' comes from Latin 'camera obscura', meaning 'dark room'.",
        "'Lens' comes from Latin 'lentil', because early lenses were lentil-shaped.",
        "'Aperture' comes from Latin 'apertura', meaning 'opening'.",

        // Composition
        "Negative space (empty areas) can emphasize your subject.",
        "Odd numbers of subjects (3, 5, 7) often look more natural than even numbers.",
        "Frame within a frame: use doorways, windows, or branches to frame subjects.",
        "Diagonal lines add energy and movement to compositions.",

        // Mirrorless vs DSLR
        "Mirrorless cameras are smaller and lighter because they have no mirror.",
        "DSLR optical viewfinders show raw light; mirrorless EVFs show exposure preview.",
        "Eye-detection AF in mirrorless cameras tracks subject eyes automatically.",

        // Genres
        "Street photography captures candid moments of everyday life.",
        "Sports photography needs fast autofocus and high frame rates.",
        "Wildlife photography requires patience, long lenses, and quiet movements.",
    ];

    useEffect(() => {
        let previous = -1;
        const interval = setInterval(() => {
            let rand = parseInt(Math.random() * messages.length);
            while (rand === previous) {
                rand = parseInt(Math.random() * messages.length);
            }
            const selected = messages[rand];
            setRandomMessage(selected)
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>{randomMessage}</>
    )
}

export default RandomMessages;