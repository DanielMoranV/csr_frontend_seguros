import { createAdmissionsList, createAdmissionsLists, deleteAdmissionsList, fetchAdmissionsLists, updateAdmissionsList, updateAdmissionsLists } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAdmissionsListsStore = defineStore('admissionsListStore', {
    state: () => ({
        admissionsLists: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getAdmissionsLists(state) {
            return state.admissionsLists;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const admissionsListsFromCache = await indexedDB.getItem('admissionsLists');
            this.admissionsLists = admissionsListsFromCache || [];
            if (this.admissionsLists.length === 0) {
                await this.fetchAdmissionsLists();
            }
            this.loading = false;
            return this.admissionsLists;
        },

        async fetchAdmissionsLists() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissionsLists(), this);
            if (this.success) {
                this.admissionsLists = data;
                await indexedDB.setItem('admissionsLists', this.admissionsLists);
            } else {
                this.admissionsLists = [];
            }
            return { success: this.success, data: this.admissionsLists };
        },
        async createAdmissionsList(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAdmissionsList(payload), this);
            if (this.success) {
                this.admissionsLists.push(data);
                await indexedDB.setItem('admissionsLists', this.admissionsLists);
            }
            return { success: this.success, data: this.admissionsLists };
        },
        async updateAdmissionsList(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateAdmissionsList(payload), this);
            if (this.success) {
                const index = this.admissionsLists.findIndex((admissionsList) => admissionsList.id === data.id);
                this.admissionsLists[index] = data;
                await indexedDB.setItem('admissionsLists', this.admissionsLists);
            }
            return { success: this.success, data: this.admissionsLists };
        },
        async deleteAdmissionsList(id) {
            this.loading = true;
            const { data } = await handleResponseStore(deleteAdmissionsList(id), this);
            if (this.success) {
                this.admissionsLists = this.admissionsLists.filter((admissionsList) => admissionsList.id !== id);
                await indexedDB.setItem('admissionsLists', this.admissionsLists);
            }
            return { success: this.success, data: this.admissionsLists };
        },

        async createMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAdmissionsLists(payload), this);
            if (this.success) {
                this.admissionsLists = data;
                // await indexedDB.setItem('admissionsLists', this.admissionsLists);
                this.message = { type: 'success', text: 'Lista de admisiones asignadas correctamente...' };
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateAdmissionsLists(payload), this);
            if (this.success) {
                this.admissionsLists = data;
                // await indexedDB.setItem('admissionsLists', this.admissionsLists);
                this.message = { type: 'success', text: 'Lista de admisiones actualizadas correctamente...' };
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
