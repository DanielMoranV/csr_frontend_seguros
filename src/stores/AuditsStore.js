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
        async createAudit(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAudit(payload), this);

            if (this.success) {
                this.audits.push(data);
                await indexedDB.setItem('audits', this.audits);
            }
            return { success: this.success, data: this.audits };
        },
        async updateAudit(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateAudit(payload), this);

            if (this.success) {
                const index = this.audits.findIndex((audit) => audit.id === data.id);
                this.audits[index] = data;
                await indexedDB.setItem('audits', this.audits);
            }
            return { success: this.success, data: this.audits };
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
