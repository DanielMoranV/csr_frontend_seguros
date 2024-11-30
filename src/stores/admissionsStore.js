import { createAdmission, deleteAdmission, fetchAdmissions, updateAdmission } from '@/api';
import cache from '@/utils/cache';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAdmissionsStore = defineStore('admissionsStore', {
    state: () => ({
        admissions: cache.getItem('admissions'),
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getAdmissions(state) {
            return state.admissions;
        }
    },
    actions: {
        async fetchAdmissions() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissions(), this);
            if (this.success) {
                this.admissions = data;
                cache.setItem('admissions', this.admissions);
            } else {
                this.admissions = [];
            }
            return this.success;
        },
        async createAdmission(payload) {
            const { data } = await handleResponseStore(createAdmission(payload), this);
            if (this.success) {
                this.admissions.push(data);
                cache.setItem('admissions', this.admissions);
                this.message = 'Admisión creada correctamente';
            }
            return this.success;
        },
        async updateAdmission(payload, id) {
            const { data } = await handleResponseStore(updateAdmission(payload, id), this);
            if (this.success) {
                this.admissions = this.admissions.map((admission) => (admission.id === id ? data : admission));
                cache.setItem('admissions', this.admissions);
                this.message = 'Admisión actualizada correctamente';
            }
            return this.success;
        },
        async deleteAdmission(id) {
            await handleResponseStore(deleteAdmission(id), this);
            if (this.success) {
                this.admissions = this.admissions.filter((admission) => admission.id !== id);
                cache.setItem('admissions', this.admissions);
                this.message = 'Admisión eliminada correctamente';
            }
            return this.success;
        }
    }
});
