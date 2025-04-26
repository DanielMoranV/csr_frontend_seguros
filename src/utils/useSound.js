// useSound.js
export function useSound() {
    function playNotificationSound() {
        const audio = new Audio('/sounds/notification.mp3');
        audio.play();
    }

    return { playNotificationSound };
}
