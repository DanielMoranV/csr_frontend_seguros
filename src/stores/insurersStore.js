import { createInsurer, createInsurers, deleteInsurer, fetchInsurers, updateInsurer, updateInsurers } from '@/api';
import cache from '@/utils/cache';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useInsurersStore = defineStore('insurersStore', {
    state: () => ({
        insurers: cache.getItem('insurers'),
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getInsurers(state) {
            return state.insurers;
        }
    },
    actions: {
        async fetchInsurers() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchInsurers(), this);
            if (this.success) {
                this.insurers = data;
                cache.setItem('insurers', this.insurers);
            } else {
                this.insurers = [];
            }
            return this.success;
        },
        async createInsurer(payload) {
            const { data } = await handleResponseStore(createInsurer(payload), this);
            if (this.success) {
                this.insurers.push(data);
                cache.setItem('insurers', this.insurers);
                this.message = 'Aseguradora creada correctamente';
            }
            return this.success;
        },
        async updateInsurer(payload, id) {
            const { data } = await handleResponseStore(updateInsurer(payload, id), this);
            if (this.success) {
                this.insurers = this.insurers.map((insurer) => (insurer.id === id ? data : insurer));
                cache.setItem('insurers', this.insurers);
                this.message = 'Aseguradora actualizada correctamente';
            }
            return this.success;
        },
        async deleteInsurer(id) {
            await handleResponseStore(deleteInsurer(id), this);
            if (this.success) {
                this.insurers = this.insurers.filter((insurer) => insurer.id !== id);
                cache.setItem('insurers', this.insurers);
                this.message = 'Aseguradora eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createInsurers(payload), this);
            if (this.success) {
                data.success.forEach((insurer) => {
                    this.insurers.push(insurer);
                });
                cache.setItem('insurers', this.insurers);
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateInsurers(payload), this);
            if (this.success) {
                payload.forEach((insurerData) => {
                    this.insurers = this.insurers.map((insurer) => (insurer.id === insurerData.id ? insurerData : insurer));
                });
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
