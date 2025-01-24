<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { useSettlementsStore } from '@/stores/settlementsStore';
import { classifyDataSettlements, importSettlements } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal, getDaysPassed } from '@/utils/day';
import { exportToExcel, loadExcelFile, processDataDatabaseSettlements, validateData, validateHeaders } from '@/utils/excelUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsStore = useAdmissionsStore();
const devolutionsStore = useDevolutionsStore();
const settlementsStore = useSettlementsStore();

// Headers
const headerSettlements = [
    'Admisión', // Número de documento
    'Fecha', // Fecha del documento
    'Días', // Número de historia del paciente
    'Médico', // Nombre del paciente
    'Aseguradora', // Nombre del empleado
    'Facturador', // Nombre de la compañía
    'Periodo', // Monto
    'Monto' // Monto
];

onMounted(async () => {
    admissions.value = await admissionsStore.initializeStore();
    admissions.value.forEach((admission) => {
        let daysPassed = getDaysPassed(admission.attendance_date);

        if (admission.status === 'Pendiente') {
            if (daysPassed <= admission.insurer.shipping_period) {
                admission.daysPassed = getDaysPassed(admission.attendance_date);
            } else {
                admission.daysPassed = `Extemp. (${daysPassed - admission.insurer.shipping_period} d.)`;
            }
        }
        if (admission.is_devolution && admission.status !== 'Pagado') {
            admission.status = 'Devolución';
        }
    });
});

const toast = useToast();
const isLoading = ref(false);
const dt = ref();
const admissions = ref([]);
const admission = ref({});
const selectedAdmissions = ref();
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
const submitted = ref(false);

function formatCurrency(value) {
    if (value) return value.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
    return;
}

function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        attendance_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        daysPassed: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        doctor: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        'insurer.name': { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        last_invoice_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        last_invoice_biller: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        last_settlement_period: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        amount: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] }
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

// Exportar devoluciones
const exportExcelDevolutions = async () => {
    let devolutions = await devolutionsStore.initializeStore();
    const columnsDevolutions = [
        { header: 'Admisión', key: 'admission', width: 15 },
        { header: 'Fecha Atención', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Fecha Devolución', key: 'devolution_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Factura', key: 'invoice_number', width: 20 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer', width: 15 },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Motivo', key: 'reason', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Estado', key: 'status', width: 15 }
    ];
    let admissionsDevolutions = admissions.value.filter((admission) => admission.status === 'Devolución');

    devolutions = devolutions.filter((devolution) => admissionsDevolutions.some((admission) => admission.number === devolution.admission.number));

    devolutions.forEach((devolution) => {
        // Convertir la fecha a formato Excel (número serial)
        const date = new Date(devolution.admission.attendance_date);
        devolution.admission.attendance_date = (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        const dateDevolution = new Date(devolution.date);
        devolution.date = (dateDevolution - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        // Enviar el monto como número, sin formatear
        devolution.admission.amount = Number(devolution.admission.amount);
    });

    let data = devolutions.map((devolution) => ({
        admission: devolution.admission.number,
        attendance_date: devolution.admission.attendance_date,
        devolution_date: devolution.date,
        invoice_number: devolution.admission?.last_invoice_number,
        doctor: devolution.admission.doctor,
        insurer: devolution.admission.insurer.name,
        biller: devolution.biller,
        period: devolution.period,
        type: devolution.type,
        reason: devolution.reason,
        amount: devolution.admission.amount,
        status: devolution.admission?.last_invoice_biller && devolution.admission?.last_invoice_status !== 'NC' ? 'Liquidado' : 'Pendiente'
    }));

    // Filtrar las devoluciones con igual admision y solo dejar el registro con devolution_date más reciente
    data = data.filter((devolution, index, self) => {
        return index === self.findIndex((t) => t.admission === devolution.admission);
    });

    await exportToExcel(columnsDevolutions, data, 'devoluciones', 'devoluciones');
};

// Exportar a Excel admisiones pendientes
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
        last_invoice_biller: admission.last_invoice_biller || admission.last_settlement_biller,
        period: admission.last_settlement_period,
        amount: admission.amount
    }));

    await exportToExcel(columns, data, 'admisiones_pendientes', 'admisiones_pendientes');
};

// Importar Meta Liquidación
const onUploadSettlements = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        try {
            isLoading.value = true;
            const rows = await loadExcelFile(file);
            const isValidHeaders = validateHeaders(rows[1], headerSettlements);
            if (!isValidHeaders.success) {
                toast.add({ severity: 'error', summary: 'Error', detail: `Faltan las cabeceras: ${isValidHeaders.missingHeaders.join(', ')}`, life: 3000 });
                isLoading.value = false;
                return;
            }
            const isValidData = validateData(rows);
            const dataSet = processDataDatabaseSettlements(rows);
            if (!isValidData || dataSet.length === 0) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                isLoading.value = false;
                return;
            }

            const { seenSettlements } = await classifyDataSettlements(dataSet);

            await importSettlements(seenSettlements, settlementsStore, toast);
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no es válido', life: 3000 });
    }
    isLoading.value = false;
};

const searchAdmissionsByDate = () => {
    let payload = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    admissionsStore.fetchAdmissionsDateRange(payload);
};
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Exp. Devoluciones" icon="pi pi-download" severity="success" class="mr-5" @click="exportExcelDevolutions" />
                    <Button label="Exp.Pendientes" icon="pi pi-download" severity="success" class="mr-5" @click="exportExcelPending" />
                    <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar Meta Liquidación" chooseLabel="Liquidación" class="w-full inline-block" :auto="true" @select="onUploadSettlements($event)" />
                    <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                        <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                    </div>
                </template>

                <template #end>
                    <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                    <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                    <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchAdmissionsByDate" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                v-model:selection="selectedAdmissions"
                :value="admissions"
                dataKey="id"
                :paginator="true"
                :rows="10"
                v-model:filters="filters"
                stripedRows
                size="small"
                filterDisplay="menu"
                :globalFilterFields="['number', 'attendance_date', 'daysPassed', 'doctor', 'insurer.name', 'last_invoice_number', 'last_invoice_biller', 'last_settlement_period', 'amount']"
                :loading="admissionsStore.loading"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                :rowsPerPageOptions="[5, 10, 25, 50, 100]"
                showGridlines
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
            >
                <template #header>
                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <h4 class="m-0">Gestión de admisiones de seguro CSR</h4>
                        <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" />
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Buscar..." />
                        </IconField>
                    </div>
                </template>
                <template #empty> No hay datos. </template>
                <template #loading> Cargando datos. Por favor, espere. </template>

                <Column selectionMode="multiple" style="width: 3rem" :exportable="false"></Column>

                <Column field="number" header="Número" sortable style="min-width: 5rem"></Column>
                <Column field="attendance_date" header="Fecha" sortable style="min-width: 5rem">
                    <template #body="slotProps">
                        {{ slotProps.data.attendance_date ? dformatLocal(slotProps.data.attendance_date, 'DD/MM/YYYY') : '-' }}
                    </template>
                </Column>
                <Column field="daysPassed" header="Días" sortable style="min-width: 3rem">
                    <template #body="slotProps">
                        {{ slotProps.data.daysPassed || '-' }}
                    </template>
                </Column>
                <Column field="doctor" header="Médico" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        {{ data.doctor || '-' }}
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="Buscar por nombre" />
                    </template>
                </Column>
                <Column field="insurer.name" header="Aseguradora" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.insurer.name || '-' }}
                    </template>
                </Column>
                <Column field="last_invoice_number" header="Factura" sortable style="min-width: 8rem"></Column>
                <Column field="last_invoice_biller" header="Facturador" sortable style="min-width: 7rem">
                    <template #body="{ data }">
                        {{ data.last_invoice_biller || data.last_settlement_biller }}
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="Buscar por nombre" />
                    </template>
                </Column>
                <Column field="last_settlement_period" header="Periodo" sortable style="min-width: 7rem">
                    <template #body="slotProps">
                        {{ slotProps.data.last_settlement_period || 'Sin Asignar' }}
                    </template>
                </Column>
                <Column field="amount" header="Monto" sortable style="min-width: 5rem">
                    <template #body="slotProps">
                        {{ formatCurrency(slotProps.data.amount) }}
                    </template>
                    <template #filter="{ filterModel }">
                        <InputNumber v-model="filterModel.value" mode="currency" currency="PEN" locale="es-PE" />
                    </template>
                </Column>
                <Column field="status" header="Estado" sortable style="min-width: 7rem">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status" :severity="getStatusLabel(slotProps.data.status)" />
                    </template>
                </Column>
                <!-- <Column :exportable="false" style="min-width: 7rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editProduct(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteProduct(slotProps.data)" />
                    </template>
                </Column> -->
                <!-- suma de totales -->

                <template #footer>
                    <div class="flex justify-end items-center gap-2">
                        <span>Total Monto:</span>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>
