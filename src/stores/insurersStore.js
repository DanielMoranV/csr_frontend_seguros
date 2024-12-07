import { createInsurer, createInsurers, deleteInsurer, fetchInsurers, updateInsurer, updateInsurers } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useInsurersStore = defineStore('insurersStore', {
    state: () => ({
        insurers: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getInsurers(state) {
            return state.insurers;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            const insurersFromCache = await indexedDB.getItem('insurers');
            this.insurers = insurersFromCache || [];
            if (this.insurers.length === 0) {
                await this.fetchInsurers();
            }
            return this.insurers;
        },
        async fetchInsurers() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchInsurers(), this);
            if (this.success) {
                this.insurers = data;
                indexedDB.setItem('insurers', this.insurers);
            } else {
                this.insurers = [];
            }
            return this.success;
        },
        async createInsurer(payload) {
            const { data } = await handleResponseStore(createInsurer(payload), this);
            if (this.success) {
                this.insurers.push(data);
                indexedDB.setItem('insurers', this.insurers);
                this.message = 'Aseguradora creada correctamente';
            }
            return this.success;
        },
        async updateInsurer(payload, id) {
            const { data } = await handleResponseStore(updateInsurer(payload, id), this);
            if (this.success) {
                this.insurers = this.insurers.map((insurer) => (insurer.id === id ? data : insurer));
                indexedDB.setItem('insurers', this.insurers);
                this.message = 'Aseguradora actualizada correctamente';
            }
            return this.success;
        },
        async deleteInsurer(id) {
            await handleResponseStore(deleteInsurer(id), this);
            if (this.success) {
                this.insurers = this.insurers.filter((insurer) => insurer.id !== id);
                indexedDB.setItem('insurers', this.insurers);
                this.message = 'Aseguradora eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createInsurers(payload), this);
            if (this.success) {
                //await this.fetchInsurers();
                this.message = 'Aseguradoras creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateInsurers(payload), this);
            if (this.success) {
                //await this.fetchInsurers();
                this.message = 'Aseguradoras actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
