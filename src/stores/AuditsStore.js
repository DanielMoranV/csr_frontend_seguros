import { createAudit, fetchAudits, fetchAuditsByAdmissions, fetchAuditsDateRange, updateAudit } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAuditsStore = defineStore('auditsStore', {
    state: () => ({
        audits: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getAudits(state) {
            return state.audits;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const auditsFromCache = await indexedDB.getItem('audits');
            this.audits = auditsFromCache || [];
            if (this.audits.length === 0) {
                await this.fetchAudits();
            }
            return this.audits;
        },
        async initializeStoreAuditsDatanRange(payload) {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const auditsFromCache = await indexedDB.getItem('audits');
            this.audits = auditsFromCache || [];
            if (this.audits.length === 0) {
                await this.fetchAuditsDateRange(payload);
            }
            this.loading = false;
            return this.audits;
        },
        async fetchAuditsDateRange(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAuditsDateRange(payload), this);
            if (this.success) {
                this.audits = data;
                await indexedDB.setItem('audits', this.audits);
            } else {
                this.audits = [];
            }
            return { success: this.success, data: this.audits };
        },
        async fetchAudits() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAudits(), this);

            if (this.success) {
                this.audits = data;
                await indexedDB.setItem('audits', this.audits);
            } else {
                this.audits = [];
            }
            return { success: this.success, data: this.audits };
        },
        async getAuditsByAdmissions(admisionsNumbers) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAuditsByAdmissions({ admissions: admisionsNumbers }), this);

            if (this.success) {
                this.audits = data;
                await indexedDB.setItem('audits', this.audits);
            } else {
                this.audits = [];
            }
            return { success: this.success, data: this.audits };
        },
        async createAudit(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAudit(payload), this);

            if (this.success) {
                this.audits.push(data);
                await indexedDB.setItem('audits', this.audits);
            }
            return { success: this.success, data };
        },
        async updateAudit(payload) {
            this.loading = true;

            const { data } = await handleResponseStore(updateAudit(payload, payload.id), this);

            if (this.success) {
                const index = this.audits.findIndex((audit) => audit.id === data.id);
                this.audits[index] = data;
                await indexedDB.setItem('audits', this.audits);
            }
            return { success: this.success, data };
        },
        async deleteAudit(id) {
            this.loading = true;
            const { data } = await handleResponseStore(deleteAudit(id), this);

            if (this.success) {
                this.audits = this.audits.filter((audit) => audit.id !== id);
                await indexedDB.setItem('audits', this.audits);
            }
            return { success: this.success, data: this.audits };
        }
    }
});
