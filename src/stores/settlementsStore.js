import { createSettlement, createSettlements, deleteSettlement, fetchSettlements, updateSettlement, updateSettlements } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useSettlementsStore = defineStore('settlementsStore', {
    state: () => ({
        settlements: [],
        loading: false,
        message: {},
        success: false,
        status: null
    }),
    getters: {
        getSettlements(state) {
            return state.settlements;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            this.loading = true;
            const settlementsFromCache = await indexedDB.getItem('settlements');
            this.settlements = settlementsFromCache || [];
            if (this.settlements.length === 0) {
                await this.fetchSettlements();
            }
            this.loading = false;
            return this.settlements;
        },
        async fetchSettlements() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchSettlements(), this);
            if (this.success) {
                this.settlements = data;
                await indexedDB.setItem('settlements', this.settlements);
            } else {
                this.settlements = [];
            }
            return this.success;
        },
        async createSettlement(payload) {
            const { data } = await handleResponseStore(createSettlement(payload), this);
            if (this.success) {
                this.settlements.push(data);
                await indexedDB.setItem('settlements', this.settlements);
                this.message = 'Liquidación creada correctamente';
            }
            return this.success;
        },
        async updateSettlement(payload, id) {
            const { data } = await handleResponseStore(updateSettlement(payload, id), this);
            if (this.success) {
                this.settlements = this.settlements.map((settlement) => (settlement.id === id ? data : settlement));
                await indexedDB.setItem('settlements', this.settlements);
                this.message = 'Liquidación actualizada correctamente';
            }
            return this.success;
        },
        async deleteSettlement(id) {
            await handleResponseStore(deleteSettlement(id), this);
            if (this.success) {
                this.settlements = this.settlements.filter((settlement) => settlement.id !== id);
                await indexedDB.setItem('settlements', this.settlements);
                this.message = 'Liquidación eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createSettlements(payload), this);
            if (this.success) {
                this.message = 'Liquidaciones creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateSettlements(payload), this);
            if (this.success) {
                this.message = 'Liquidaciones actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
