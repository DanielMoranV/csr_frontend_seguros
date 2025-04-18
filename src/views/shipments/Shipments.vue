<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAuthStore } from '@/stores/authStore';
import { useMedicalRecordsRequestsStore } from '@/stores/medicalRecordsRequestsStore';
import { useShipmentsStore } from '@/stores/shipmentsStore';
import { classifyShipments, getCurrentPeriod } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel, loadExcelFile, processDataDatabaseShipments, validateData, validateHeaders } from '@/utils/excelUtils';
import indexedDB from '@/utils/indexedDB';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const shipmentsStore = useShipmentsStore();
const medicalRecordStore = useMedicalRecordsRequestsStore();
const isLoading = ref(false);
const confirm = useConfirm();
const editChecked = ref(true);
const toast = useToast();
const admissionsLists = ref([]);
const authStore = useAuthStore();
const resumenAdmissions = ref([]);
const periods = ref([]);
const nickName = ref();
const filters = ref(null);
const period = ref(null);
const headerShipments = [
    'Admisión',
    'Historia',
    'Fecha',
    'Paciente',
    'Aseguradora',
    'Tipo',
    'Monto',
    'Facturador',
    'Estado Audit',
    'Factura',
    'Pago',
    'Env Iniciado',
    'Env. Trama',
    'Env. Currier',
    'Env. Email',
    'URL Sust.',
    'Comentarios',
    'Verif. Envío'
];
period.value = getCurrentPeriod();

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
    nickName.value = authStore.getNickName;
    let data = await admissionsListStore.initializeStoreByPeriod(period.value);
    admissionsLists.value = formatAdmissionsLists(data);
    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
});

const formatAdmissionsLists = (data) => {
    if (data.length === 0) {
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron admisiones para el periodo seleccionado.',
            life: 5000
        });
        return [];
    }

    // Filtrar registros que tengan invoice_number y que no inicien con '005-'
    const filteredData = data.filter((admission) => admission.invoice_number && !admission.invoice_number.startsWith('005-'));

    // Agrupar por número de admisión y seleccionar el registro con la fecha de factura más reciente
    const uniqueAdmissions = Object.values(
        filteredData.reduce((acc, admission) => {
            if (!acc[admission.number] || new Date(acc[admission.number].invoice_date) < new Date(admission.invoice_date)) {
                acc[admission.number] = admission;
            }
            return acc;
        }, {})
    );

    uniqueAdmissions.forEach((admission) => {
        // if (admission.invoice_number === null || admission.invoice_number.startsWith('005-')) {
        //     admission.invoice_number = admission.invoice_number?.startsWith('005-') ? '' : admission.invoice_number;
        // }
        // Determinar si la admisión está a tiempo o fuera de tiempo
        admission.isLate = new Date(admission.end_date) >= new Date(admission.invoice_date);
        admission.status = admission.isLate ? 'A tiempo' : 'Fuera de tiempo';
        admission.isTramaDate = admission.shipment?.trama_date ? true : false;
        admission.isCourierDate = admission.shipment?.courier_date ? true : false;
        admission.isEmailVerifiedDate = admission.shipment?.email_verified_date ? true : false;
        admission.isUrlSustenance = admission.shipment?.url_sustenance ? true : false;
        admission.isVerifiedShipmentDate = admission.shipment?.verified_shipment_date ? true : false;
    });

    return uniqueAdmissions;
};

const resumenAdmissionsList = (data) => {
    const groupedData = data.reduce((acc, item) => {
        // Inicializar el objeto para el biller si no existe

        if (!acc[item.biller]) {
            acc[item.biller] = {
                biller: item.biller,
                total: 0,
                verified_shipment: 0,
                totalAmount: 0 // como añado el monto total de amount por biller
            };
        }

        // Actualizar los contadores
        acc[item.biller].total++;
        let amount = parseFloat(item.amount);
        if (amount > 0) {
            acc[item.biller].totalAmount += amount;
        }
        if (item.shipment && item.shipment?.verified_shipment_date) acc[item.biller].verified_shipment++;

        return acc;
    }, {});
    return groupedData;
};

const searchPeriod = async () => {
    let response = await admissionsListStore.fetchAdmissionsListsByPeriod(period.value);
    admissionsLists.value = formatAdmissionsLists(response.data);
    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
};

const exportAdmissions = async () => {
    const columns = [
        { header: 'Admisión', key: 'admission_number', width: 15 },
        { header: 'Historia', key: 'medical_record_number', with: 15 },
        { header: 'Fecha', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer_name', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Estado Audit', key: 'auditStatus', width: 15 },
        { header: 'Factura', key: 'invoice_number', width: 15 },
        { header: 'Fecha Factura', key: 'invoice_date', width: 15 },
        { header: 'Días', key: 'daysPassed', width: 5 },
        { header: 'Pago', key: 'paid_invoice_number', width: 15 },
        { header: 'Env Iniciado', key: 'shipment_id', width: 15 },
        { header: 'Env. Trama', key: 'shipment.trama_date', width: 15 },
        { header: 'Env. Currier', key: 'shipment.courier_date', width: 15 },
        { header: 'Env. Email', key: 'shipment.email_verified_date', width: 15 },
        { header: 'URL Sust.', key: 'shipment.url_sustenance', width: 15 },
        { header: 'Comentarios', key: 'shipment.remarks', width: 15 },
        { header: 'Verif. Envío', key: 'shipmentVerifiedShipmentDate', width: 15 }
    ];

    const getDaysPassed = (from, to) => {
        const date1 = new Date(from);
        const date2 = new Date(to);

        // Normaliza las fechas eliminando el efecto de la zona horaria
        const timeDiff = Math.abs(date2 - date1);
        const diffDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    const data = admissionsLists.value.map((admission) => {
        const formatDate = (date) => {
            return date ? dformat(date, 'DD/MM/YYYY') : '-';
        };

        // calcular los dias pasados entre attendance_date y invoice_date
        const daysPassed = getDaysPassed(admission.attendance_date, admission.invoice_date);
        admission.daysPassed = daysPassed;

        console.log(admission);

        return {
            admission_number: admission.admission_number,
            medical_record_number: admission.medical_record_number,
            attendance_date: admission.attendance_date ? dformatLocal(admission.attendance_date, 'DD/MM/YYYY') : '-',
            patient: admission.patient,
            doctor: admission.doctor,
            insurer_name: admission.insurer_name,
            amount: Number(admission.amount),
            type: admission.type,
            biller: admission.biller,
            auditStatus: admission.audit ? admission.audit.status : '-',
            invoice_number: admission.invoice_number ? admission.invoice_number : '-',
            invoice_date: admission.invoice_date ? dformatLocal(admission.invoice_date, 'DD/MM/YYYY') : '-',
            // calcular los dias pasados entre attendance_date y invoice_date
            daysPassed: admission.daysPassed,
            shipmentVerifiedShipmentDate: admission.shipment ? formatDate(admission.shipment.verified_shipment_date) : '-',
            paid_invoice_number: admission.paid_invoice_number ? 'Si' : 'No',
            shipment_id: admission.shipment_id ? 'Si' : 'No',
            'shipment.trama_date': admission.shipment ? formatDate(admission.shipment.trama_date) : '-',
            'shipment.courier_date': admission.shipment ? formatDate(admission.shipment.courier_date) : '-',
            'shipment.email_verified_date': admission.shipment ? formatDate(admission.shipment.email_verified_date) : '-',
            'shipment.url_sustenance': admission.shipment ? admission.shipment.url_sustenance : '-',
            'shipment.remarks': admission.shipment ? admission.shipment.remarks : '-'
        };
    });

    await exportToExcel(columns, data, 'Facturas para Envios', 'Facturas para Envios');
};

// Importar Meta Envios
const onUploadShipments = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        try {
            isLoading.value = true;
            const rows = await loadExcelFile(file);
            const isValidHeaders = validateHeaders(rows[1], headerShipments);
            if (!isValidHeaders.success) {
                toast.add({ severity: 'error', summary: 'Error', detail: `Faltan las cabeceras: ${isValidHeaders.missingHeaders.join(', ')}`, life: 3000 });
                isLoading.value = false;
                return;
            }
            const isValidData = validateData(rows);
            const dataSet = processDataDatabaseShipments(rows);
            if (!isValidData || dataSet.length === 0) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                isLoading.value = false;
                return;
            }

            let { newShipments, updatedShipments } = await classifyShipments(dataSet);

            let payload = {
                newShipments,
                updatedShipments
            };

            console.log(payload);

            let { success, data } = await shipmentsStore.createAndUpdateShipments(payload);

            if (!success) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar el archivo', life: 3000 });
            } else {
                await searchPeriod();
                toast.add({ severity: 'success', summary: 'Éxito', detail: 'Archivo cargado correctamente', life: 3000 });
            }
        } catch (error) {
            console.log(error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no es válido', life: 3000 });
    }
    isLoading.value = false;
};
const editShipmentDate = async (admission, field, flagField) => {
    if (admission.shipment_id) {
        let shipment = admission.shipment;
        let payloadShipment = {
            id: shipment.id,
            [field]: admission[flagField] ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
        };

        let success = await shipmentsStore.updateShipment(payloadShipment, shipment.id);
        if (success) {
            let index = admissionsLists.value.findIndex((item) => item.id === admission.id);
            admissionsLists.value[index].shipment[field] = payloadShipment[field];
            admissionsLists.value[index][flagField] = admission[flagField];

            await indexedDB.setItem('admissionsLists', admissionsLists.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Envío actualizado correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar el envío', life: 3000 });
        }
    } else {
        let newShipmentPayload = {
            admission_number: admission.admission_number,
            invoice_number: admission.invoice_number,
            [field]: admission[flagField] ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
        };

        console.log(newShipmentPayload);

        let { data, success } = await shipmentsStore.createShipment(newShipmentPayload);
        if (success) {
            let index = admissionsLists.value.findIndex((item) => item.id === admission.id);
            admissionsLists.value[index].shipment_id = data.id;
            admissionsLists.value[index].shipment = data;
            admissionsLists.value[index].shipment[field] = newShipmentPayload[field];
            admissionsLists.value[index][flagField] = admission[flagField];

            await indexedDB.setItem('admissionsLists', admissionsLists.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Envío creado correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear el envío', life: 3000 });
        }
    }
};

// Funciones específicas llamando a la función genérica
const editTramaDate = (admission) => editShipmentDate(admission, 'trama_date', 'isTramaDate');
const editCourierDate = (admission) => editShipmentDate(admission, 'courier_date', 'isCourierDate');
const editEmailDate = (admission) => editShipmentDate(admission, 'email_verified_date', 'isEmailVerifiedDate');

const editUrlSustenance = async (admission) => {
    admission.shipment.url_sustenance = admission.shipment.url_sustenance ? admission.shipment.url_sustenance : '';

    if (admission.shipment_id) {
        let shipment = admission.shipment;
        let payloadShipment = {
            id: shipment.id,
            url_sustenance: admission.shipment.url_sustenance
        };
        let success = await shipmentsStore.updateShipment(payloadShipment, shipment.id);
        if (success) {
            let index = admissionsLists.value.findIndex((item) => item.id === admission.id);
            admissionsLists.value[index].shipment.url_sustenance = payloadShipment.url_sustenance;
            admissionsLists.value[index].shipment.url_sustenance = admissionsLists.value[index].shipment.url_sustenance ? admissionsLists.value[index].shipment.url_sustenance : '';
            await indexedDB.setItem('admissionsLists', admissionsLists.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'URL Sust. actualizada correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar el envío', life: 3000 });
        }
    }
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <DataTable :value="resumenAdmissions" tableStyle="min-width: 30rem" size="small" :style="{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="biller" header="Facturador"></Column>
                    <Column field="total" header="Total"></Column>
                    <Column field="totalAmount" header="Monto">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.totalAmount) }}
                        </template>
                    </Column>
                    <Column field="verified_shipment" header="Verf Envi."></Column>
                </DataTable>
            </template>

            <template #end>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="period" placeholder="N° Periodo" v-keyfilter.int :maxlength="6" />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchPeriod" />
            </template>
        </Toolbar>
    </div>
    <div class="card">
        <ConfirmDialog></ConfirmDialog>
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="admissionsLists"
            :paginator="true"
            :rows="10"
            v-model:filters="filters"
            stripedRows
            scrollable
            size="small"
            filterDisplay="menu"
            :loading="admissionsListStore.loading"
            :globalFilterFields="['admission_number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión Envios de Facturas</h1>
                    <a href="https://1drv.ms/f/s!AlehBy_4oTnf9wNK5DRflCQmdmb4?e=eXcxv3" target="_blank" class="text-blue-500 hover:underline">
                        <i class="pi pi-external-link"></i>
                    </a>

                    <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" />
                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAdmissions()" />
                    <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar Envios" chooseLabel="Envios" class="w-full inline-block" :auto="true" @select="onUploadShipments($event)" />
                    <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                        <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                    </div>
                    <ToggleButton v-model="editChecked" onLabel="Ver" offLabel="Editar" onIcon="pi pi-lock" offIcon="pi pi-lock-open" class="w-36" aria-label="Do you confirm" />
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
            <Column header="#" headerStyle="width:3rem">
                <template #body="slotProps">
                    {{ slotProps.index + 1 }}
                </template>
            </Column>
            <Column field="admission_number" sortable header="Admisión" frozen></Column>
            <Column field="medical_record_number" header="Historia" sortable style="min-width: 5rem"></Column>
            <Column field="attendance_date" header="Atención" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    {{ slotProps.data.attendance_date ? dformatLocal(slotProps.data.attendance_date, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
            <Column field="patient" header="Paciente" sortable style="min-width: 8rem"></Column>
            <Column field="insurer_name" header="Aseguradora" sortable style="min-width: 10rem">
                <template #body="slotProps">
                    {{ slotProps.data.insurer_name || '-' }}
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" placeholder="Buscar..." />
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
            <Column field="biller" header="Facturador" sortable style="min-width: 7rem">
                <template #body="{ data }">
                    {{ data.biller }}
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Buscar por nombre" />
                </template>
            </Column>

            <Column field="invoice_number" header="Factura" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.invoice_number">
                        {{ slotProps.data.invoice_number }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="shipment.trama_date" header="Env. Trama" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <template v-if="!editChecked">
                        <Checkbox :disabled="slotProps.data.isVerifiedShipmentDate" v-model="slotProps.data.isTramaDate" binary @blur="editTramaDate(slotProps.data)" />
                    </template>

                    <template v-else>
                        <span v-if="slotProps.data.shipment?.trama_date">
                            {{ dformat(slotProps.data.shipment.trama_date, 'DD/MM/YYYY') }}
                        </span>
                        <i v-else class="pi pi-clock text-yellow-500"></i>
                    </template>
                </template>
            </Column>
            <Column field="shipment.courier_date" header="Env. Currier" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <template v-if="!editChecked">
                        <Checkbox :disabled="slotProps.data.isVerifiedShipmentDate" v-model="slotProps.data.isCourierDate" binary @blur="editCourierDate(slotProps.data)" />
                    </template>

                    <template v-else>
                        <span v-if="slotProps.data.shipment?.courier_date">
                            {{ dformatLocal(slotProps.data.shipment.courier_date, 'DD/MM/YYYY') }}
                        </span>
                        <i v-else class="pi pi-clock text-yellow-500"></i>
                    </template>
                </template>
            </Column>
            <Column field="shipment.email_verified_date" header="Env. Email" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <template v-if="!editChecked">
                        <Checkbox :disabled="slotProps.data.isVerifiedShipmentDate" v-model="slotProps.data.isEmailVerifiedDate" binary @blur="editEmailDate(slotProps.data)" />
                    </template>

                    <template v-else>
                        <span v-if="slotProps.data.shipment?.email_verified_date">
                            {{ dformatLocal(slotProps.data.shipment.email_verified_date, 'DD/MM/YYYY') }}
                        </span>
                        <i v-else class="pi pi-clock text-yellow-500"></i>
                    </template>
                </template>
            </Column>
            <Column field="shipment.url_sustenance" header="URL Sust." sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.shipment && slotProps.data.shipment.url_sustenance">
                        <a :href="slotProps.data.shipment.url_sustenance" target="_blank">
                            <i class="pi pi-external-link text-blue-500"></i>
                        </a>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
                <template #editor="slotProps">
                    <InputText v-if="slotProps.data.shipment" v-model="slotProps.data.shipment.url_sustenance" @blur="editUrlSustenance(slotProps.data)" />
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="shipment.remarks" header="Comentarios" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.shipment && slotProps.data.shipment.remarks">
                        {{ slotProps.data.shipment.remarks }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="shipment.verified_shipment_date" sortable style="min-width: 5rem" header="Verif. Envío">
                <template #body="slotProps">
                    <span v-if="slotProps.data.shipment && slotProps.data.shipment.verified_shipment_date">
                        <span class="text-green-500">{{ dformatLocal(slotProps.data.shipment.verified_shipment_date, 'DD/MM/YYYY') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="status" header="Estado" sortable></Column>
        </DataTable>
    </div>
</template>
