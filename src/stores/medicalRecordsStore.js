import { createMedicalRecord, deleteMedicalRecord, fetchMedicalRecords, updateMedicalRecord } from '@/api';
import cache from '@/utils/cache';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useMedicalRecordsStore = defineStore('medicalRecordsStore', {
    state: () => ({
        medicalRecords: cache.getItem('medicalRecords'),
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getMedicalRecords(state) {
            return state.medicalRecords;
        }
    },
    actions: {
        async fetchMedicalRecords() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchMedicalRecords(), this);
            if (this.success) {
                this.medicalRecords = data;
                cache.setItem('medicalRecords', this.medicalRecords);
            } else {
                this.medicalRecords = [];
            }
            return this.success;
        },
        async createMedicalRecord(payload) {
            const { data } = await handleResponseStore(createMedicalRecord(payload), this);
            if (this.success) {
                this.medicalRecords.push(data);
                cache.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico creado correctamente';
            }
            return this.success;
        },
        async updateMedicalRecord(payload, id) {
            const { data } = await handleResponseStore(updateMedicalRecord(payload, id), this);
            if (this.success) {
                this.medicalRecords = this.medicalRecords.map((medicalRecord) => (medicalRecord.id === id ? data : medicalRecord));
                cache.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico actualizado correctamente';
            }
            return this.success;
        },
        async deleteMedicalRecord(id) {
            await handleResponseStore(deleteMedicalRecord(id), this);
            if (this.success) {
                this.medicalRecords = this.medicalRecords.filter((medicalRecord) => medicalRecord.id !== id);
                cache.setItem('medicalRecords', this.medicalRecords);
                this.message = 'Registro médico eliminado correctamente';
            }
            return this.success;
        }
    }
});
