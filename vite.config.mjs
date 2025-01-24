import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        include: ['dayjs', 'dayjs/plugin/utc', 'dayjs/plugin/calendar', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/duration', 'dayjs/plugin/relativeTime', 'exceljs', 'file-saver', 'dayjs/locale/es'],

        noDiscovery: true
    },
    plugins: [
        vue(),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    server: {
        host: '0.0.0.0', // Acepta conexiones desde cualquier IP
        port: 5173 // Cambia el puerto si es necesario
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
});
