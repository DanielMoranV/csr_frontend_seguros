import { useAuthStore } from '@/stores/authStore';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const api_url = import.meta.env.VITE_API_URL;
const { getToken, setSocketId } = useAuthStore();

window.Pusher = Pusher;
Pusher.logToConsole = true;

const broadcaster = import.meta.env.VITE_BROADCAST_DRIVER;

let echoConfig;

if (broadcaster === 'reverb') {
    console.log('reverb');
    echoConfig = {
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        cluster: import.meta.env.VITE_REVERB_CLUSTER || 'mt1',
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT,
        wssPort: import.meta.env.VITE_REVERB_PORT,
        forceTLS: false,
        encrypted: true,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${api_url}/broadcasting/auth`,
        auth: {
            headers: {
                Authorization: `Bearer ${getToken}`
            }
        }
    };
} else if (broadcaster === 'pusher') {
    echoConfig = {
        broadcaster: 'pusher',
        key: import.meta.env.VITE_PUSHER_APP_KEY,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
        authEndpoint: `${api_url}/broadcasting/auth`,
        forceTLS: true,
        auth: {
            headers: {
                Authorization: `Bearer ${getToken}`
            }
        }
    };
}

const useEcho = new Echo(echoConfig);

useEcho.connector.pusher.connection.bind('connected', () => {
    const socketId = useEcho.connector.pusher.connection.socket_id;
    setSocketId(socketId);
});

export default useEcho;
