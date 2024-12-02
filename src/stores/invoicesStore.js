import { createInvoice, createInvoices, deleteInvoice, fetchInvoices, updateInvoice, updateInvoices } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useInvoicesStore = defineStore('invoicesStore', {
    state: () => ({
        invoices: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getInvoices(state) {
            return state.invoices;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            const invoicesFromCache = await indexedDB.getItem('invoices');
            this.invoices = invoicesFromCache || [];
        },
        async fetchInvoices() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchInvoices(), this);
            if (this.success) {
                this.invoices = data;
                indexedDB.setItem('invoices', this.invoices);
            } else {
                this.invoices = [];
            }
            return this.success;
        },
        async createInvoice(payload) {
            const { data } = await handleResponseStore(createInvoice(payload), this);
            if (this.success) {
                this.invoices.push(data);
                indexedDB.setItem('invoices', this.invoices);
                this.message = 'Factura creada correctamente';
            }
            return this.success;
        },
        async updateInvoice(payload, id) {
            const { data } = await handleResponseStore(updateInvoice(payload, id), this);
            if (this.success) {
                this.invoices = this.invoices.map((invoice) => (invoice.id === id ? data : invoice));
                indexedDB.setItem('invoices', this.invoices);
                this.message = 'Factura actualizada correctamente';
            }
            return this.success;
        },
        async deleteInvoice(id) {
            await handleResponseStore(deleteInvoice(id), this);
            if (this.success) {
                this.invoices = this.invoices.filter((invoice) => invoice.id !== id);
                indexedDB.setItem('invoices', this.invoices);
                this.message = 'Factura eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createInvoices(payload), this);
            if (this.success) {
                await this.fetchInvoices();
                this.message = 'Facturas creadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateMultiple(payload) {
            const { data } = await handleResponseStore(updateInvoices(payload), this);
            if (this.success) {
                await this.fetchInvoices();
                this.message = 'Facturas actualizadas correctamente';
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
