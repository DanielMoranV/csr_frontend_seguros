import { createDevolution, createDevolutions, deleteDevolution, fetchDevolutions, updateDevolution, updateDevolutions } from '@/api';
import FastApiService from '@/service/FastApiService';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useDevolutionsStore = defineStore('devolutionsStore', {
    state: () => ({
        devolutions: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getDevolutions(state) {
            return state.devolutions;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            const devolutionsFromCache = await indexedDB.getItem('devolutions');
            this.devolutions = devolutionsFromCache || [];
            if (this.devolutions.length === 0) {
                await this.fetchDevolutions();
            }
            return this.devolutions;
        },
        async initializeStoreDevolutionsDataRange(payload) {
            this.loading = true;
            // Carga inicial desde IndexedDB
            const devolutionsFromCache = await indexedDB.getItem('devolutions');
            this.devolutions = devolutionsFromCache || [];
            if (this.devolutions.length === 0) {
                await this.fetchDevolutionsDateRange(payload);
            }
            this.loading = false;
            return this.devolutions;
        },

        async fetchDevolutionsDateRange(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(FastApiService.devolutionsByRange(payload), this);
            if (this.success) {
                this.devolutions = data;
                await indexedDB.setItem('devolutions', this.devolutions);
            } else {
                this.devolutions = [];
            }
            return { success: this.success, data };
        },
        async fetchDevolutionsByInvoices(invoiceNumbers) {
            this.loading = true;
            const { data } = await handleResponseStore(FastApiService.devolutionsByInvoiceNumbers(invoiceNumbers), this);
            if (this.success) {
                return data;
            } else {
                return [];
            }
        },
        async fetchDevolutions() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchDevolutions(), this);
            if (this.success) {
                this.devolutions = data;
                await indexedDB.setItem('devolutions', this.devolutions);
            }
            return this.success;
        },
        async createDevolution(payload) {
            const { data } = await handleResponseStore(createDevolution(payload), this);
            if (this.success) {
                this.devolutions.push(data);
                await indexedDB.setItem('devolutions', this.devolutions);
            }
            return this.success;
        },
        async updateDevolution(payload, id) {
            const { data } = await handleResponseStore(updateDevolution(payload, id), this);
            if (this.success) {
                this.devolutions = this.devolutions.map((devolution) => (devolution.id === id ? data : devolution));
            }
        },
        async deleteDevolution(id) {
            const { data } = await handleResponseStore(deleteDevolution(id), this);
            if (this.success) {
                this.devolutions = this.devolutions.filter((devolution) => devolution.id !== id);
            }
        },
        async createDevolutions(payload) {
            const { data } = await handleResponseStore(createDevolutions(payload), this);
            if (this.success) {
                this.devolutions.push(data);
            }
        },
        async updateDevolutions(payload) {
            const { data } = await handleResponseStore(updateDevolutions(payload), this);
            if (this.success) {
                this.devolutions = this.devolutions.map((devolution) => (devolution.id === payload.id ? data : devolution));
            }
        },
        async deleteDevolutions(payload) {
            const { data } = await handleResponseStore(deleteDevolutions(payload), this);
            if (this.success) {
                this.devolutions = this.devolutions.filter((devolution) => devolution.id !== payload.id);
            }
        },

        async createMultiple(payload) {
            const { data } = await handleResponseStore(createDevolutions(payload), this);
            if (this.success) {
                this.message = 'Devoluciones creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateDevolutions(payload), this);
            if (this.success) {
                this.message = 'Devoluciones actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
