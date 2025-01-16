<script setup>
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { dformat } from '@/utils/day';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const devolutionsStore = useDevolutionsStore();
const toast = useToast();
const devolutions = ref([]);
const filters = ref(null);
const starDate = '01-01-2023';
const endDate = ref(new Date());

function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        admission_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        attendance_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        patient: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        doctor: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        insurer_name: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        invoice_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        biller: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        amount: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        medical_record_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        period: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        start_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        end_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        status: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }
    };
}
onBeforeMount(() => {
    initFilters();
});

function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
    initFilters();
}

onMounted(async () => {
    let payload = {
        start_date: starDate,
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    devolutions.value = await devolutionsStore.initializeStoreDevolutionsDataRange(payload);
    console.log(devolutions.value);
    formatDevolitions(devolutions.value);
});

const formatDevolitions = (data) => {
    if (data.length === 0) {
        devolutions.value = [];
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron devoluciones.',
            life: 3000
        });
        return [];
    }

    data.forEach((devolution) => {
        if (devolution.invoice_date < devolution.date_last_invoice) {
            devolution.status = 'Facturado';
        } else {
            devolution.status = 'Pendiente';
        }
        if (devolution.paid_invoice_number) {
            devolution.status = 'Pagado';
        }
    });
};
</script>
<template>
    <div class="card">
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="devolutions"
            :paginator="true"
            :rows="10"
            selectionMode="single"
            v-model:filters="filters"
            :id="devolutions.id"
            stripedRows
            scrollable
            size="small"
            filterDisplay="menu"
            :loading="devolutionsStore.loading"
            :globalFilterFields="['number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Devoluciones"
        >
            <Column field="number" header="Nro. Admisión" sortable></Column>
            <Column field="attendance_date" header="Fecha Atención" sortable></Column>
            <Column field="doctor" header="Médico" sortable></Column>
            <Column field="insurer_name" header="Aseguradora" sortable></Column>
            <Column field="invoice_number" header="Nro. Factura" sortable></Column>
            <Column field="biller" header="Facturador" sortable></Column>
            <Column field="invoice_amount" header="Monto" sortable></Column>
            <Column field="medical_record_number" header="Nro. Historia" sortable></Column>
            <Column field="patient" header="Paciente" sortable></Column>
            <Column field="period_dev" header="Periodo" sortable></Column>
            <Column field="reason" header="Motivo" sorteable></Column>
            <Column field="status" header="Estado" sortable></Column>
        </DataTable>
    </div>
</template>
