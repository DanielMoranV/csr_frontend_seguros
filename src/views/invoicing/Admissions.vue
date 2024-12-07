<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { dformat, getDaysPassed } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const admissionsStore = useAdmissionsStore();

onMounted(async () => {
    admissions.value = await admissionsStore.initializeStore();

    admissions.value.forEach((admission) => {
        let daysPassed = getDaysPassed(admission.attendance_date);

        if (admission.status === 'Pendiente') {
            if (daysPassed <= admission.insurer.shipping_period) {
                admission.daysPassed = getDaysPassed(admission.attendance_date);
            } else {
                admission.daysPassed = `Extemporáneo (${daysPassed - admission.insurer.shipping_period} días)`;
            }
        }
    });

    console.log(admissions.value);
});

const toast = useToast();
const dt = ref();
const admissions = ref([]);
const admission = ref({});
const selectedAdmissions = ref();
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
const submitted = ref(false);

function formatCurrency(value) {
    if (value) return value.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
    return;
}

function exportCSV() {
    dt.value.exportCSV();
}

function getStatusLabel(status) {
    switch (status) {
        case 'Pagado':
            return 'success';

        case 'Liquidado':
            return 'warn';

        case 'Pendiente':
            return 'danger';

        default:
            return null;
    }
}

// Exportar a Excel
const exportExcelPending = async () => {
    const columns = [
        { header: 'Admisión', key: 'admission', width: 15 },
        { header: 'Fecha', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Días', key: 'daysPassed', width: 20 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer', width: 15 },
        { header: 'Facturador', key: 'last_invoice_biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } }
    ];

    let admissionsPending = admissions.value.filter((admission) => admission.status === 'Pendiente');
    admissionsPending.forEach((admission) => {
        // Convertir la fecha a formato Excel (número serial)
        const date = new Date(admission.attendance_date);
        admission.attendance_date = (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);

        // Enviar el monto como número, sin formatear
        admission.amount = Number(admission.amount);
    });

    const data = admissionsPending.map((admission) => ({
        admission: admission.number,
        attendance_date: admission.attendance_date,
        daysPassed: admission.daysPassed,
        doctor: admission.doctor,
        insurer: admission.insurer.name,
        last_invoice_biller: admission.last_invoice_biller,
        period: admission.period,
        amount: admission.amount
    }));

    await exportToExcel(columns, data, 'admisiones_pendientes', 'admisiones_pendientes');
};
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <!-- <Button label="Nuevo" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                    <Button label="Eliminar" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedAdmissions || !selectedAdmissions.length" /> -->
                </template>

                <template #end>
                    <Button label="Exportar Pendientes" icon="pi pi-upload" severity="secondary" class="mr-5" @click="exportExcelPending" />
                    <Button label="Meta Liquidación" severity="success" icon="pi pi-download" @click="downloadMetaLiquidation($event)" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                v-model:selection="selectedAdmissions"
                :value="admissions"
                dataKey="id"
                :paginator="true"
                :rows="10"
                :filters="filters"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                :rowsPerPageOptions="[5, 10, 25, 50, 100]"
                currentPageReportTemplate="Showing {first} to {last} of {totalRecords} admisiones"
            >
                <template #header>
                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <h4 class="m-0">Gestión de admisiones de seguro CSR</h4>
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Search..." />
                        </IconField>
                    </div>
                </template>

                <Column selectionMode="multiple" style="width: 3rem" :exportable="false"></Column>

                <Column field="number" header="Número" sortable style="min-width: 10rem"></Column>
                <Column field="attendance_date" header="Fecha" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.attendance_date ? dformat(slotProps.data.attendance_date, 'DD/MM/YYYY') : '-' }}
                    </template>
                </Column>
                <Column field="daysPassed" header="Días" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.daysPassed || '-' }}
                    </template>
                </Column>
                <!-- <Column field="insurer.payment_period" header="Periodo" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.insurer.payment_period || '-' }}
                    </template>
                </Column> -->
                <!-- <Column field="attendance_hour" header="Hora" sortable style="min-width: 8rem">
                    <template #body="slotProps">
                        {{ slotProps.data.attendance_hour || '-' }}
                    </template>
                </Column> -->
                <Column field="doctor" header="Médico" sortable style="min-width: 10rem"></Column>
                <Column field="insurer.name" header="Aseguradora" sortable style="min-width: 10rem"></Column>
                <Column field="last_invoice_number" header="Factura" sortable style="min-width: 10rem"></Column>
                <Column field="last_invoice_biller" header="Facturador" sortable style="min-width: 10rem"></Column>
                <Column field="period" header="Periodo" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.period || 'Sin Asignar' }}
                    </template>
                </Column>
                <Column field="amount" header="Monto" sortable style="min-width: 8rem">
                    <template #body="slotProps">
                        {{ formatCurrency(slotProps.data.amount) }}
                    </template>
                </Column>
                <Column field="status" header="Estado" sortable style="min-width: 12rem">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status" :severity="getStatusLabel(slotProps.data.status)" />
                    </template>
                </Column>
                <Column :exportable="false" style="min-width: 12rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editProduct(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteProduct(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
