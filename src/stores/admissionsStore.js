import { createAdmission, createAdmissions, deleteAdmission, fetchAdmissionByNumber, fetchAdmissions, fetchAdmissionsDateRange, updateAdmission, updateAdmissions } from '@/api';
import FastApiService from '@/service/FastApiService';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAdmissionsStore = defineStore('admissionsStore', {
    state: () => ({
        admissions: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getAdmissions(state) {
            return state.admissions;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const admissionsFromCache = await indexedDB.getItem('admissions');
            this.admissions = admissionsFromCache || [];
            if (this.admissions.length === 0) {
                await this.fetchAdmissions();
            }
            this.loading = false;
            return this.admissions;
        },
        async initializeStoreAdmissionsDateRangeApi(payload) {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const admissionsFromCache = await indexedDB.getItem('admissions');
            this.admissions = admissionsFromCache || [];
            if (this.admissions.length === 0) {
                await this.fetchAdmissionsDateRangeApi(payload);
            }
            this.loading = false;
            return this.admissions;
        },

        async fetchAdmissionsDateRange(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissionsDateRange(payload), this);
            if (this.success) {
                this.admissions = data;
                await indexedDB.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return { success: this.success, data: this.admissions };
        },
        async fetchAdmissionsDateRangeApi(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(FastApiService.admisionsByRange(payload), this);
            if (this.success) {
                this.admissions = data;
                await indexedDB.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return { success: this.success, data: this.admissions };
        },

        async fetchAdmissionByNumber(number) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissionByNumber(number), this);
            if (this.success) {
                this.admissions = data;
                await indexedDB.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return { success: this.success, data: this.admissions };
        },

        async fetchAdmissionByNumberApi(number) {
            this.loading = true;
            const { data } = await handleResponseStore(FastApiService.admisionsByNumber(number), this);
            if (this.success) {
                this.admissions = data;
                await indexedDB.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return { success: this.success, data: this.admissions };
        },
        async fetchAdmissions() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissions(), this);
            if (this.success) {
                this.admissions = data;
                await indexedDB.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return this.success;
        },
        async createAdmission(payload) {
            const { data } = await handleResponseStore(createAdmission(payload), this);
            if (this.success) {
                this.admissions.push(data);
                await indexedDB.setItem('admissions', this.admissions);
                this.message = 'Admisión creada correctamente';
            }
            return this.success;
        },
        async updateAdmission(payload, id) {
            const { data } = await handleResponseStore(updateAdmission(payload, id), this);
            if (this.success) {
                this.admissions = this.admissions.map((admission) => (admission.id === id ? data : admission));
                await indexedDB.setItem('admissions', this.admissions);
                this.message = 'Admisión actualizada correctamente';
            }
            return this.success;
        },
        async deleteAdmission(id) {
            await handleResponseStore(deleteAdmission(id), this);
            if (this.success) {
                this.admissions = this.admissions.filter((admission) => admission.id !== id);
                await indexedDB.setItem('admissions', this.admissions);
                this.message = 'Admisión eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createAdmissions(payload), this);
            if (this.success) {
                //await this.fetchAdmissions();
                this.message = 'Admisiones creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateAdmissions(payload), this);
            if (this.success) {
                //await this.fetchAdmissions();
                this.message = 'Admisiones actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
