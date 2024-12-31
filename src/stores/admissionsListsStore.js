import { createAdmissionListAndRequest, createAdmissionsList, createAdmissionsLists, deleteAdmissionsList, fetchAdmissionsLists, fetchAdmissionsListsByPeriod, fetchAdmissionsListsPeriods, updateAdmissionsList, updateAdmissionsLists } from '@/api';
import FastApiService from '@/service/FastApiService';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useAdmissionsListsStore = defineStore('admissionsListStore', {
    state: () => ({
        admissionsLists: [],
        periods: [],
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
        async initializeStoreByPeriod(period) {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const admissionsListsFromCache = await indexedDB.getItem('admissionsLists');
            this.admissionsLists = admissionsListsFromCache || [];
            if (this.admissionsLists.length === 0) {
                await this.fetchAdmissionsListsByPeriod(period);
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
        async fetchAdmissionsListsPeriods() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissionsListsPeriods(), this);
            if (this.success) {
                this.periods = data;
                await indexedDB.setItem('periods', this.periods);
            } else {
                this.periods = [];
            }
            return { success: this.success, data: this.periods };
        },
        async fetchAdmissionsListsByPeriod(period) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchAdmissionsListsByPeriod(period), this);
            if (this.success) {
                this.admissionsLists = data;
                // obtener una lista de admisiones admission_number a partir de admissionsLists
                const admissionNumbers = data.map((admissionsList) => admissionsList.admission_number);
                this.loading = true;
                let { results, errors } = await FastApiService.admisionsByNumbers(admissionNumbers);
                // Combinar los arrays
                console.log('errors', errors);
                const combinedArray = results.map((admission) => {
                    // Buscar la coincidencia en admissionsLists
                    const match = this.admissionsLists.find((list) => list.admission_number === admission.number);

                    // Retornar un nuevo objeto combinando ambas fuentes de datos
                    return {
                        ...admission,
                        ...match // Si no hay coincidencia, será undefined
                    };
                });
                // Filtrar elementos sin coincidencia si es necesario
                const filteredCombinedArray = combinedArray.filter((item) => item.admission_number);
                await indexedDB.setItem('admissionsLists', filteredCombinedArray);
                this.admissionsLists = filteredCombinedArray;
            } else {
                this.admissionsLists = [];
            }
            this.loading = false;
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
        },
        async createAdmissionListAndRequest(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAdmissionListAndRequest(payload), this);
            if (this.success) {
                this.message = 'Lista de admisiones creada y solicitud realizada correctamente...';
                return { success: this.success, data };
            }
        }
    }
});
