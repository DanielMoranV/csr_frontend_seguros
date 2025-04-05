import { createAndUpdateShipments, createShipment, deleteShipment, fetchShipments, fetchShipmentsByAdmissionNumber, fetchShipmentsByAdmissionsList, fetchShipmentsByDateRange, updateShipment } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useShipmentsStore = defineStore('shipmentsStore', {
    state: () => ({
        shipments: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getShipments(state) {
            return state.shipments;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            const shipmentsFromCache = await indexedDB.getItem('shipments');
            this.shipments = shipmentsFromCache || [];
            if (this.shipments.length === 0) {
                await this.fetchShipments();
            }
            return this.shipments;
        },

        async initializeStoreFetchShipmentsByDateRange(payload) {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const shipmentsFromCache = await indexedDB.getItem('shipments');
            this.shipments = shipmentsFromCache || [];
            if (this.shipments.length === 0) {
                await this.fetchShipmentsByDateRange(payload);
            }
            this.loading = false;
            return this.shipments;
        },
        async fetchShipmentsByDateRange(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchShipmentsByDateRange(payload), this);
            if (this.success) {
                this.shipments = data;
                indexedDB.setItem('shipments', this.shipments);
            } else {
                this.shipments = [];
            }
            return { success: this.success, data: this.shipments };
        },
        async fetchShipmentsByAdmissionNumber(admissionNumber) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchShipmentsByAdmissionNumber(admissionNumber), this);
            if (this.success) {
                this.shipments = data;
                indexedDB.setItem('shipments', this.shipments);
            } else {
                this.shipments = [];
            }
            return { success: this.success, data: this.shipments };
        },

        async fetchShipmentsByAdmissionsList(admissionsList) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchShipmentsByAdmissionsList(admissionsList), this);
            if (this.success) {
                this.shipments = data;
                indexedDB.setItem('shipments', this.shipments);
            } else {
                this.shipments = [];
            }
            return { success: this.success, data: this.shipments };
        },
        async fetchShipments() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchShipments(), this);
            if (this.success) {
                this.shipments = data;
                indexedDB.setItem('shipments', this.shipments);
            } else {
                this.shipments = [];
            }
            return this.success;
        },
        async createShipment(payload) {
            const { data } = await handleResponseStore(createShipment(payload), this);
            if (this.success) {
                this.shipments.push(data);
                indexedDB.setItem('shipments', this.shipments);
                this.message = 'Envío creado correctamente';
            }
            return { success: this.success, data: data };
        },
        async updateShipment(payload, id) {
            const { data } = await handleResponseStore(updateShipment(payload, id), this);
            if (this.success) {
                this.shipments = this.shipments.map((shipment) => (shipment.id === id ? data : shipment));
                indexedDB.setItem('shipments', this.shipments);
                this.message = 'Envío actualizado correctamente';
            }
            return this.success;
        },
        async deleteShipment(id) {
            const { data } = await handleResponseStore(deleteShipment(id), this);
            if (this.success) {
                this.shipments = this.shipments.filter((shipment) => shipment.id !== id);
                indexedDB.setItem('shipments', this.shipments);
                this.message = 'Envío eliminado correctamente';
            }
            return this.success;
        },

        async createAndUpdateShipments(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createAndUpdateShipments(payload), this);
            if (this.success) {
                //this.shipments = data;
                //indexedDB.setItem('shipments', this.shipments);
                this.message = 'Envío creado y actualizado correctamente';
            }
            return { success: this.success, data: data };
        }
    }
});
