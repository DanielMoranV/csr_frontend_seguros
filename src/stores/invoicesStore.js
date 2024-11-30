import { createInvoice, createInvoices, deleteInvoice, fetchInvoices, updateInvoice, updateInvoices } from '@/api';
import cache from '@/utils/cache';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useInvoicesStore = defineStore('invoicesStore', {
    state: () => ({
        invoices: cache.getItem('invoices'),
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getInvoices(state) {
            return state.invoices;
        }
    },
    actions: {
        async fetchInvoices() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchInvoices(), this);
            if (this.success) {
                this.invoices = data;
                cache.setItem('invoices', this.invoices);
            } else {
                this.invoices = [];
            }
            return this.success;
        },
        async createInvoice(payload) {
            const { data } = await handleResponseStore(createInvoice(payload), this);
            if (this.success) {
                this.invoices.push(data);
                cache.setItem('invoices', this.invoices);
                this.message = 'Factura creada correctamente';
            }
            return this.success;
        },
        async updateInvoice(payload, id) {
            const { data } = await handleResponseStore(updateInvoice(payload, id), this);
            if (this.success) {
                this.invoices = this.invoices.map((invoice) => (invoice.id === id ? data : invoice));
                cache.setItem('invoices', this.invoices);
                this.message = 'Factura actualizada correctamente';
            }
            return this.success;
        },
        async deleteInvoice(id) {
            await handleResponseStore(deleteInvoice(id), this);
            if (this.success) {
                this.invoices = this.invoices.filter((invoice) => invoice.id !== id);
                cache.setItem('invoices', this.invoices);
                this.message = 'Factura eliminada correctamente';
            }
            return this.success;
        },
        async createMultiple(payload) {
            const { data } = await handleResponseStore(createInvoices(payload), this);
            if (this.success) {
                data.success.forEach((invoice) => {
                    this.invoices.push(invoice);
                });
                cache.setItem('invoices', this.invoices);
            }
            return { status: this.success, success: data.success, error: data.errors };
        },
        async updateInvoices(payload) {
            const { data } = await handleResponseStore(updateInvoices(payload), this);
            if (this.success) {
                payload.forEach((invoiceData) => {
                    this.invoices = this.invoices.map((invoice) => (invoice.id === invoiceData.id ? invoiceData : invoice));
                });
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
