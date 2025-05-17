export default function WelcomeImage() {
    const randomImages = [
        "/bird.jpg",
        "/mountain.jpg",
        "/raityou.jpg",
        "/midagahara.jpg",
        "/kamikochi.jpg",
        "/monkey.jpg"
    ];
    const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

    return randomItem(randomImages)
};