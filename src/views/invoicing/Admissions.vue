<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useSettlementsStore } from '@/stores/settlementsStore';
import { useShipmentsStore } from '@/stores/shipmentsStore';
import { classifyAdmissionsLists } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal, getDaysPassed } from '@/utils/day';
import { exportToExcel, loadExcelFile, processDataDatabaseSettlements, validateData, validateHeaders } from '@/utils/excelUtils';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsStore = useAdmissionsStore();
const admissionsListStore = useAdmissionsListsStore();
const devolutionsStore = useDevolutionsStore();
const settlementsStore = useSettlementsStore();
const insurersStore = useInsurersStore();
const shipmentsStore = useShipmentsStore();
// Headers
const headerSettlements = [
    'Admisión', // Número de documento
    'Historia', // Número de historia clinica
    'Fecha', // Fecha del documento
    'Días', // Número de historia del paciente
    'Médico', // Nombre del paciente
    'Aseguradora', // Nombre del empleado
    'Facturador', // Nombre de la compañía
    'Periodo', // Periodo de lista
    'Tipo', // Tipo de documento
    'Monto', // Monto
    'Fecha Inicio', // Fecha Inicio
    'Fecha Final' // Fecha Final
];

const shipments = ref([]);

onMounted(async () => {
    let payload = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    insurers.value = await insurersStore.initializeStore();
    shipments.value = await shipmentsStore.initializeStore();

    let response = await admissionsStore.initializeStoreAdmissionsDateRangeApi(payload);
    formatAdmissions(response);
});

const toast = useToast();
const isLoading = ref(false);
const dt = ref();
const admissions = ref([]);
const admission = ref({});
const devolutions = ref([]);
const searchAdmission = ref('');
const insurers = ref([]);
const selectedAdmissions = ref();
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
const submitted = ref(false);

function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        attendance_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        patient: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        daysPassed: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        doctor: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        insurer_name: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        invoice_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        biller: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        amount: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        type: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        status: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        medical_record_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }
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

        case 'Enviado':
            return 'info';

        default:
            return null;
    }
}

// Exportar devoluciones
const exportExcelDevolutions = async () => {
    let payload = {
        start_date: '01-01-2023',
        end_date: dformat(new Date(), 'MM-DD-YYYY')
    };
    let { success, data } = await devolutionsStore.fetchDevolutionsDateRange(payload);

    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    }

    formatDevolutionsPending(data);

    const columnsDevolutions = [
        { header: 'Admisión', key: 'admission_number', width: 15 },
        { header: 'Fecha Atención', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Fecha Devolución', key: 'devolution_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Factura', key: 'invoice_number', width: 20 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer', width: 15 },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Tipo', key: 'devolution_type', width: 15 },
        { header: 'Motivo', key: 'reason', width: 15 },
        { header: 'Monto', key: 'invoice_amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Estado', key: 'status', width: 15 }
    ];
    await exportToExcel(columnsDevolutions, devolutions.value, 'devoluciones', 'devoluciones');
};

// Exportar a Excel admisiones pendientes
const exportExcelPending = async () => {
    const columns = [
        { header: 'Admisión', key: 'admission', width: 15 },
        { header: 'Historia', key: 'medical_record_number', with: 15 },
        { header: 'Fecha', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Días', key: 'daysPassed', width: 5 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Fecha Inicio', key: 'start_date', width: 13 },
        { header: 'Fecha Final', key: 'end_date', width: 13 }
    ];

    let admissionsPending = admissions.value.filter((admission) => admission.status === 'Pendiente');
    admissionsPending.forEach((admission) => {
        // Convertir la fecha a formato Excel (número serial)
        const date = new Date(admission.attendance_date);
        admission.attendance_date = (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);

        // Enviar el monto como número, sin formatear
        admission.amount = Number(admission.amount);
    });

    let admisionsList = await admissionsListStore.fetchAdmissionsLists();

    // modifica admission los campos de period y biller cuando admisionsList.admission_number y admission.number sean iguales
    admissionsPending.forEach((admission) => {
        const matchingAdmission = admisionsList.data.find((item) => item.admission_number === admission.number);
        if (matchingAdmission) {
            admission.period = matchingAdmission.period;
            admission.biller = matchingAdmission.biller;
        }
    });

    const data = admissionsPending.map((admission) => ({
        admission: admission.number,
        medical_record_number: admission.medical_record_number,
        attendance_date: admission.attendance_date,
        daysPassed: admission.daysPassed,
        patient: admission.patient,
        doctor: admission.doctor,
        insurer: admission.insurer_name,
        biller: admission.biller,
        period: admission.period,
        type: admission.type,
        amount: admission.amount
    }));

    await exportToExcel(columns, data, 'admisiones_pendientes', 'admisiones_pendientes');
};

// Exportar a excel admisiones generadas
const exportExcelGenerated = async () => {
    const columns = [
        { header: 'Admisión', key: 'admission', width: 15 },
        { header: 'Fecha', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Días', key: 'daysPassed', width: 5 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer', width: 15 },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Factura', key: 'invoice_number', width: 20 },
        { header: 'Fecha Factura', key: 'invoice_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Fecha Envio', key: 'shipment_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Estado', key: 'status', width: 15 }
    ];

    let admissionData = admissions.value;

    admissionData.forEach((admission) => {
        // Convertir la fecha a formato Excel (número serial)
        const date = new Date(admission.attendance_date);
        admission.attendance_date = (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);

        if (admission.invoice_number) {
            const dateInvoice = new Date(admission.invoice_date);
            admission.invoice_date = (dateInvoice - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        }

        if (admission.shipment) {
            admission.shipment_date = new Date(admission.shipment.verified_shipment_date);
        }
        // Enviar el monto como número, sin formatear
        admission.amount = Number(admission.amount);
    });

    let data = admissionData.map((admission) => ({
        admission: admission.number,
        medical_record_number: admission.medical_record_number,
        attendance_date: admission.attendance_date,
        daysPassed: admission.daysPassed,
        patient: admission.patient,
        doctor: admission.doctor,
        insurer: admission.insurer_name,
        biller: admission.biller,
        period: admission.period,
        type: admission.type,
        amount: admission.amount,
        invoice_number: admission.invoice_number,
        invoice_date: admission.invoice_date,
        shipment_date: admission.shipment_date,
        status: admission.status
    }));

    await exportToExcel(columns, data, 'admisiones_generadas', 'admisiones_generadas');
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

            let { seenMedicalRecordsRequests } = await classifyAdmissionsLists(dataSet);

            let { success, data } = await admissionsListStore.createAdmissionListAndRequest(seenMedicalRecordsRequests);
            if (!success) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar el archivo', life: 3000 });
            } else {
                toast.add({ severity: 'success', summary: 'Éxito', detail: 'Archivo cargado correctamente', life: 3000 });
            }
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no es válido', life: 3000 });
    }
    isLoading.value = false;
};
const formatDevolutionsPending = (data) => {
    const groupedDevolutions = data.reduce((acc, devolution) => {
        if (!acc[devolution.admission_number]) {
            acc[devolution.admission_number] = [];
        }
        acc[devolution.admission_number].push(devolution);
        return acc;
    }, {});

    // Seleccionar el registro con la fecha de factura más reciente para cada grupo
    const uniqueDevolutions = Object.values(groupedDevolutions).map((group) => {
        return group.reduce((latest, current) => {
            return new Date(latest.invoice_date) > new Date(current.invoice_date) ? latest : current;
        });
    });
    devolutions.value = uniqueDevolutions;
    devolutions.value.forEach((devolution) => {
        if (devolution.paid_invoice_number === null) {
            if (new Date(devolution.devolution_date) > new Date(devolution.invoice_date)) {
                devolution.status = 'Pendiente';
            } else {
                devolution.status = 'Liquidado';
            }
        } else {
            devolution.status = 'Pagado';
        }

        // Convertir la fecha a formato Excel (número serial)
        let attendance_date = new Date(devolution.attendance_date);
        devolution.attendance_date = (attendance_date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        let dateDevolution = new Date(devolution.devolution_date);
        devolution.devolution_date = (dateDevolution - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
        // Enviar el monto como número, sin formatear
        devolution.invoice_amount = Number(devolution.invoice_amount);
    });
};
const formatAdmissions = (data) => {
    // Agrupar por número de admisión
    const groupedAdmissions = data.reduce((acc, admission) => {
        if (!acc[admission.number]) {
            acc[admission.number] = [];
        }
        acc[admission.number].push(admission);
        return acc;
    }, {});

    // Seleccionar el registro con la fecha de factura más reciente para cada grupo
    const uniqueAdmissions = Object.values(groupedAdmissions).map((group) => {
        // Ordenamos por fecha descendente
        group.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));

        // Filtramos facturas con la fecha más reciente
        const latestDate = group[0].invoice_date;
        const latestInvoices = group.filter((invoice) => invoice.invoice_date === latestDate);

        // Si hay más de dos facturas con la misma fecha, excluimos las que inician con "005-" o "006-"
        if (latestInvoices.length > 2) {
            return latestInvoices.find((invoice) => !invoice.invoice_number.startsWith('005-') && !invoice.invoice_number.startsWith('006-')) || latestInvoices[0];
        }

        // Si hay 2 o menos, simplemente tomamos la primera (más reciente)
        return latestInvoices[0];
    });

    // Obtener los periodos de envío de las aseguradoras en un objeto para acceso rápido
    const shippingPeriods = insurers.value.reduce((acc, insurer) => {
        acc[insurer.name.trim().toLowerCase()] = insurer.shipping_period;
        return acc;
    }, {});

    const shipmentsData = shipments.value.reduce((acc, shipment) => {
        acc[shipment.invoice_number] = shipment;
        return acc;
    }, {});

    admissions.value = uniqueAdmissions;
    admissions.value.forEach((admission) => {
        let daysPassed = getDaysPassed(admission.attendance_date);
        admission.daysPassed = daysPassed;

        if (admission.invoice_number === null || admission.invoice_number.startsWith('005-') || admission.invoice_number.startsWith('006-')) {
            admission.invoice_number = admission.invoice_number?.startsWith('005-') || admission.invoice_number?.startsWith('006-') ? '' : admission.invoice_number;
            admission.status = 'Pendiente';
            admission.biller = '';
        } else if (admission.devolution_date !== null && admission.paid_invoice_number === null) {
            admission.status = 'Devolución';
        } else if (admission.paid_invoice_number !== null) {
            admission.status = 'Pagado';
        } else {
            admission.status = 'Liquidado';
        }

        // Solo establece 'Enviado' si el estado no es 'Pagado'
        if (admission.status !== 'Pagado' && shipmentsData[admission.invoice_number] && shipmentsData[admission.invoice_number]?.verified_shipment_date !== null) {
            admission.shipment = shipmentsData[admission.invoice_number];
            admission.status = 'Enviado';
        }

        // Asignar el periodo de envío de la aseguradora a la admisión para mostrarlo en la tabla de admisiones
        admission.shipping_period = shippingPeriods[admission.insurer_name.trim().toLowerCase()];

        if (admission.status === 'Pendiente') {
            admission.daysPassed = daysPassed <= admission.shipping_period ? daysPassed : `Extemp. (${daysPassed - admission.shipping_period} d.)`;
        }
    });
};

const searchAdmissionsByDate = async () => {
    let payload = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    const { success, data } = await admissionsStore.fetchAdmissionsDateRangeApi(payload);

    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    }

    formatAdmissions(data);
};

const searchAdmissions = async () => {
    // Validacion de numero de admision
    if (searchAdmission.value === '' || searchAdmission.value === null || searchAdmission.value.length <= 5) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Ingrese un número de admisión', life: 3000 });
        return;
    }
    const { success, data } = await admissionsStore.fetchAdmissionByNumberApi(searchAdmission.value);
    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    }
    formatAdmissions(data);
};
</script>

<template>
    <div>
        <div class="card">
            <div class="flex justify-start">
                <Button label="Exp.Generadas" icon="pi pi-download" severity="secondary" class="mr-5" @click="exportExcelGenerated" />
                <Button label="Exp. Devoluciones" icon="pi pi-download" severity="success" class="mr-5" @click="exportExcelDevolutions" :loading="devolutionsStore.loading" />

                <Button label="Exp.Pendientes" icon="pi pi-download" severity="success" class="mr-5" @click="exportExcelPending" />
                <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar Meta Liquidación" chooseLabel="Listas" class="w-full inline-block" :auto="true" @select="onUploadSettlements($event)" />
            </div>
            <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
            </div>
        </div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="searchAdmission" placeholder="N° Admisión" />
                    </IconField>
                    <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchAdmissions" />
                </template>

                <template #end>
                    <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                    <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                    <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchAdmissionsByDate" />
                </template>
            </Toolbar>

            <DataTable
                :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
                ref="dt"
                v-model:selection="selectedAdmissions"
                :value="admissions"
                dataKey="number"
                :paginator="true"
                :rows="10"
                v-model:filters="filters"
                stripedRows
                size="small"
                filterDisplay="menu"
                :globalFilterFields="['number', 'attendance_date', 'daysPassed', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'status', 'medical_record_number']"
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
                <Column field="number" header="Admisión" sortable style="min-width: 5rem"></Column>
                <Column field="medical_record_number" header="Historia" sortable style="min-width: 5rem"></Column>
                <Column field="attendance_date" header="Fecha" sortable style="min-width: 5rem">
                    <template #body="slotProps">
                        {{ slotProps.data.attendance_date ? dformatLocal(slotProps.data.attendance_date, 'DD/MM/YYYY') : '-' }}
                    </template>
                </Column>
                <Column field="patient" header="Paciente" sortable style="min-width: 8rem"></Column>
                <Column field="daysPassed" header="Días" sortable style="min-width: 3rem">
                    <template #body="slotProps">
                        {{ slotProps.data.daysPassed || '0' }}
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
                <Column field="insurer_name" header="Aseguradora" sortable style="min-width: 10rem">
                    <template #body="slotProps">
                        {{ slotProps.data.insurer_name || '-' }}
                    </template>
                </Column>
                <Column field="invoice_number" header="Factura" sortable style="min-width: 8rem"></Column>
                <Column field="biller" header="Facturador" sortable style="min-width: 7rem">
                    <template #body="{ data }">
                        {{ data.biller }}
                    </template>
                    <template #filter="{ filterModel }">
                        <InputText v-model="filterModel.value" type="text" placeholder="Buscar por nombre" />
                    </template>
                </Column>
                <Column field="type" header="Tipo"></Column>
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

                <!-- <template #footer>
                    <div class="flex justify-end items-center gap-2">
                        <span>Total Monto: </span>
                    </div>
                </template> -->
            </DataTable>
        </div>
    </div>
</template>
