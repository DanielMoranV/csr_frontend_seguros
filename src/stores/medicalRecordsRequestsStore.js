import { createMedicalRecordsRequest, createMedicalRecordsRequests, deleteMedicalRecordsRequest, fetchMedicalRecordsRequests, updateMedicalRecordsRequest, updateMedicalRecordsRequests } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useMedicalRecordsRequestsStore = defineStore('medicalRecordsRequestsStore', {
    state: () => ({
        medicalRecordsRequests: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getMedicalRecordsRequests(state) {
            return state.medicalRecordsRequests;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const medicalRecordsRequestsFromCache = await indexedDB.getItem('medicalRecordsRequests');
            this.medicalRecordsRequests = medicalRecordsRequestsFromCache || [];
            if (this.medicalRecordsRequests.length === 0) {
                await this.fetchMedicalRecordsRequests();
            }
            this.loading = false;
            return this.medicalRecordsRequests;
        },

        async fetchMedicalRecordsRequests() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchMedicalRecordsRequests(), this);
            if (this.success) {
                this.medicalRecordsRequests = data;
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            } else {
                this.medicalRecordsRequests = [];
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async createMedicalRecordsRequest(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createMedicalRecordsRequest(payload), this);
            if (this.success) {
                this.medicalRecordsRequests.push(data);
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async updateMedicalRecordsRequest(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateMedicalRecordsRequest(payload), this);
            if (this.success) {
                const index = this.medicalRecordsRequests.findIndex((medicalRecordsRequest) => medicalRecordsRequest.id === data.id);
                this.medicalRecordsRequests[index] = data;
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async deleteMedicalRecordsRequest(id) {
            this.loading = true;
            const { data } = await handleResponseStore(deleteMedicalRecordsRequest(id), this);
            if (this.success) {
                this.medicalRecordsRequests = this.medicalRecordsRequests.filter((medicalRecordsRequest) => medicalRecordsRequest.id !== id);
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
        },
        async createMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createMedicalRecordsRequests(payload), this);
            if (this.success) {
                this.medicalRecordsRequests = this.medicalRecordsRequests.concat(data);
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async updateMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateMedicalRecordsRequests(payload), this);
            if (this.success) {
                this.medicalRecordsRequests = data;
                // await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
                this.message = { type: 'success', text: 'Solicitudes de historias clínicas actualizadas correctamente...' };
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
