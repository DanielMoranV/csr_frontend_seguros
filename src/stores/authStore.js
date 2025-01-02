import { login, logout, me, updateUser } from '@/api';
import router from '@/router';
import cache from '@/utils/cache';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('authStore', {
    state: () => ({
        user: cache.getItem('currentUser'),
        token: cache.getItem('token'),
        message: '',
        status: 0,
        success: false,
        role: 'Invitado',
        socketId: cache.getItem('socketId'),
        session: false,
        loading: false
    }),
    getters: {
        getToken(state) {
            if (state.token) {
                return state.token;
            }
        },
        getSocketId(state) {
            return state.socketId;
        },
        auth() {
            const response = {
                loading: this.loading,
                session: this.session,
                message: this.message,
                status: this.status
            };
            return response;
        },
        getUser(state) {
            return state.user;
        },
        getNickName(state) {
            return state.user.nick;
        },
        getLoading(state) {
            return state.loading;
        }
    },
    actions: {
        async setSocketId(socketId) {
            cache.setItem('socketId', socketId);
            this.socketId = socketId;
        },
        async login(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(login(payload), this);
            if (this.success) {
                this.token = data.access_token;
                this.user = data.user;
                cache.setItem('token', this.token);
                cache.setItem('currentUser', this.user);
                this.message = 'Validación Correcta Bienvenido';
            }
            this.session = this.success;
            return this.success;
        },

        async logout() {
            this.loading = true;
            const { data } = await handleResponseStore(logout(), this);
            this.message = 'Sesión cerrada correctamente';
            cache.cleanAll();
            indexedDB.cleanAll();
            this.user = data;
            this.session = false;
            this.socketId = null;
            this.token = null;
            router.push({ name: 'login' });
        },
        async me() {
            this.loading = true;
            const { data } = await handleResponseStore(me(), this);
            if (this.success) {
                this.user = data.user;
                cache.setItem('currentUser', this.user);
                this.session = true;
                this.token = data.access_token;
                cache.setItem('token', this.token);
            }
            this.session = this.success;
            return this.success;
        },
        async updateUser(payload) {
            this.user = {
                ...this.user,
                ...payload
            };
            await cache.setItem('currentUser', this.user);
        },
        async updateProfile(payload, id) {
            this.loading = true;
            const { data } = await handleResponseStore(updateUser(payload, id), this);
            if (this.success) {
                this.user = data;
                this.message = 'Usuario actualizado correctamente';
                cache.setItem('currentUser', this.user);
            }
            return this.success;
        }
    }
});
