import { useAuthStore } from '@/stores/authStore';
import axios from 'axios';

const api_url = import.meta.env.VITE_API_URL;

const instance = axios.create({
    baseURL: api_url,
    timeout: 20000000
});

instance.interceptors.request.use(
    (config) => {
        const { getToken, getSocketId } = useAuthStore();
        if (getToken) {
            config.headers.Authorization = 'Bearer ' + getToken;
        }
        if (getSocketId) {
            config.headers['X-Socket-ID'] = getSocketId;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

//Add a response interceptor
instance.interceptors.response.use(
    function (response) {
        if (response.config.responseType === 'blob') {
            return response; // Devolver la respuesta completa para blobs
        }
        return response.data;
    },
    function (error) {
        let errData = {
            message: error.message || (error.response && error.response.data.message) || error.response.data.error,
            code: error.code,
            status_code: error.response ? error.response.status : null,
            success: false,
            details: error.response ? error.response.data.errors : null,
            data: error.response ? error.response.data : null
        };

        // Manejo de errores específicos
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    errData.message = 'Credenciales incorrectas. Por favor, intentelo nuevamente.';
                    break;
                case 403:
                    errData.message = 'Usuario deshabilitado o no registrado.';
                    break;
                case 404:
                    errData.message = 'Recurso no encontrado.';
                    break;
                case 500:
                    errData.message = 'Error interno del servidor. Intente más tarde.';
                    break;
                default:
                    errData.message = `Error ${error.response.status}: ${error.response.statusText}`;
                    break;
            }
        } else if (error.code === 'ECONNABORTED') {
            console.log('error', error);
            errData.message = 'La solicitud ha tardado demasiado tiempo. Intente nuevamente.';
        } else {
            errData.message = 'Error de conexión. Verifique su red.';
        }

        return Promise.reject(errData);
    }
);

export default instance;
