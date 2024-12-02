import { createMedicalRecord, createMedicalRecords, deleteMedicalRecord, fetchMedicalRecords, updateMedicalRecord, updateMedicalRecords } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useMedicalRecordsStore = defineStore('medicalRecordsStore', {
    state: () => ({
        medicalRecords: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getMedicalRecords(state) {
            return state.medicalRecords;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            const medicalRecordsFromCache = await indexedDB.getItem('medicalRecords');
            this.medicalRecords = medicalRecordsFromCache || [];
        },
        async fetchMedicalRecords() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchMedicalRecords(), this);
            if (this.success) {
                this.medicalRecords = data;
                indexedDB.setItem('medicalRecords', this.medicalRecords);
            } else {
                this.medicalRecords = [];
            }
            return this.success;
        },
        async createMedicalRecord(payload) {
            const { data } = await handleResponseStore(createMedicalRecord(payload), this);
            if (this.success) {
                this.medicalRecords.push(data);
                indexedDB.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico creado correctamente';
            }
            return this.success;
        },
        async updateMedicalRecord(payload, id) {
            const { data } = await handleResponseStore(updateMedicalRecord(payload, id), this);
            if (this.success) {
                this.medicalRecords = this.medicalRecords.map((medicalRecord) => (medicalRecord.id === id ? data : medicalRecord));
                indexedDB.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico actualizado correctamente';
            }
            return this.success;
        },
        async deleteMedicalRecord(id) {
            await handleResponseStore(deleteMedicalRecord(id), this);
            if (this.success) {
                this.medicalRecords = this.medicalRecords.filter((medicalRecord) => medicalRecord.id !== id);
                indexedDB.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico eliminado correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createMedicalRecords(payload), this);
            if (this.success) {
                await this.fetchMedicalRecords();
                this.message = 'Historias clínicas creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateMedicalRecords(payload), this);
            if (this.success) {
                await this.fetchMedicalRecords();
                this.message = 'Historias clínicas actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
