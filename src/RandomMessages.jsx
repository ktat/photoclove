import { useState, useEffect } from "react";

function RandomMessages() {
    const [randomMessage, setRandomMessage] = useState("Welcome to PhotoClove!");

    const messages = [
        "If you are shooting birds in flight, you need a fast shutter speed.",
        "High ISO will give you photos with noise. Especially if your camera's image sensor is small.",
        "A full-size camera is a camera with a 35mm sensor.",
        "The MicroFourThrds camera is the camera with about a half of a 35mm sensor.",
        "A high shutter speed makes a photo darker. A low f-number or high ISO makes a photo brighter.",
        "A fixed focus length lens doesn't have zoom function.",
        "The moon is very bright. You don't need a slow shutter speed or a high ISO.",
        "The zoom ratio of a compact camera is the ratio of the longest focal length to the shortest focal length of the camera.",
        "Sensor sizes: Medium Format > 35mm > APS-C > For Thrds > 1inch > Smart phone sensor."
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