<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAuthStore } from '@/stores/authStore';
import { useShipmentsStore } from '@/stores/shipmentsStore';
import { classifyShipments, getCurrentPeriod } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel, loadExcelFile, processDataDatabaseShipmentsAll, validateData, validateHeaders } from '@/utils/excelUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const shipmentsStore = useShipmentsStore();
const starDate = ref(new Date());
starDate.value.setDate(starDate.value.getDate() - 30);
starDate.value.setHours(0, 0, 0, 0);
const endDate = ref(new Date());
const admissionNumber = ref();
const shipments = ref([]);
const isLoading = ref(false);
const confirm = useConfirm();
const toast = useToast();
const admissionsLists = ref([]);
const authStore = useAuthStore();
const resumenAdmissions = ref([]);
const periods = ref([]);
const nickName = ref();
const filters = ref(null);
const period = ref(null);
const headerShipmentsAll = ['Admisión', 'Factura', 'Env Iniciado', 'Env. Trama', 'Env. Currier', 'Env. Email', 'URL Sust.', 'Comentarios', 'Verif. Envío'];

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
        status: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        remarks: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }
    };
}

onBeforeMount(() => {
    initFilters();
});

onMounted(async () => {
    nickName.value = authStore.getNickName;
    let payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(endDate.value, 'YYYY-MM-DD')
    };
    shipments.value = await shipmentsStore.initializeStoreFetchShipmentsByDateRange(payload);
});

const searchShipment = async () => {
    let response = await shipmentsStore.fetchShipmentsByAdmissionNumber(admissionNumber.value);
    shipments.value = response.data;
};

const searchShipmentsByDate = async () => {
    let payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(endDate.value.setHours(23, 59, 59), 'YYYY-MM-DD HH:mm:ss')
    };
    let response = await shipmentsStore.fetchShipmentsByDateRange(payload);
    shipments.value = response.data;
};

const exportAdmissions = async () => {
    const columns = [
        { header: 'Admisión', key: 'admission_number', width: 15 },
        { header: 'Factura', key: 'invoice_number', width: 15 },
        { header: 'Env Iniciado', key: 'shipment_id', width: 15 },
        { header: 'Env. Trama', key: 'trama_date', width: 15 },
        { header: 'Env. Currier', key: 'courier_date', width: 15 },
        { header: 'Env. Email', key: 'email_verified_date', width: 15 },
        { header: 'URL Sust.', key: 'url_sustenance', width: 15 },
        { header: 'Comentarios', key: 'remarks', width: 15 },
        { header: 'Verif. Envío', key: 'shipmentVerifiedShipmentDate', width: 15 }
    ];

    const data = shipments.value.map((shipment) => {
        const formatDate = (date) => {
            return date ? dformat(date, 'DD/MM/YYYY') : '-';
        };
        return {
            admission_number: shipment.admission_number,
            invoice_number: shipment.invoice_number ? shipment.invoice_number : '-',
            shipmentVerifiedShipmentDate: shipment.verified_shipment_date ? formatDate(shipment.verified_shipment_date) : '-',
            shipment_id: shipment.id ? 'Si' : 'No',
            trama_date: shipment.trama_date ? formatDate(shipment.trama_date) : '-',
            courier_date: shipment.courier_date ? formatDate(shipment.courier_date) : '-',
            email_verified_date: shipment.email_verified_date ? formatDate(shipment.email_verified_date) : '-',
            url_sustenance: shipment.url_sustenance ? shipment.url_sustenance : '-',
            remarks: shipment.remarks ? shipment.remarks : '-'
        };
    });

    await exportToExcel(columns, data, 'Facturas Enviadas', 'Facturas Enviadas');
};

// Importar Meta Envios
const onUploadShipments = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        try {
            isLoading.value = true;
            const rows = await loadExcelFile(file);
            const isValidHeaders = validateHeaders(rows[1], headerShipmentsAll);
            if (!isValidHeaders.success) {
                toast.add({ severity: 'error', summary: 'Error', detail: `Faltan las cabeceras: ${isValidHeaders.missingHeaders.join(', ')}`, life: 3000 });
                isLoading.value = false;
                return;
            }
            const isValidData = validateData(rows);
            const dataSet = processDataDatabaseShipmentsAll(rows);
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
                searchShipmentsByDate();
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
</script>
<template>
    <div class="card">
        <Toolbar>
            <template #start>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="admissionNumber" placeholder="N° Admisión" />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchShipment" />
            </template>

            <template #end>
                <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchShipmentsByDate" />
            </template>
        </Toolbar>
    </div>
    <div class="card">
        <ConfirmDialog></ConfirmDialog>
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="shipments"
            :paginator="true"
            :rows="10"
            v-model:filters="filters"
            stripedRows
            scrollable
            size="small"
            filterDisplay="menu"
            :loading="shipmentsStore.loading"
            :globalFilterFields="['admission_number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status', 'remarks']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión General Envios de Facturas</h1>
                    <a href="https://1drv.ms/f/s!AlehBy_4oTnf9wNK5DRflCQmdmb4?e=eXcxv3" target="_blank" class="text-blue-500 hover:underline">
                        <i class="pi pi-external-link"></i>
                    </a>

                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAdmissions()" />
                    <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar Envios" chooseLabel="Envios" class="w-full inline-block" :auto="true" @select="onUploadShipments($event)" />
                    <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                        <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                    </div>
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
            <Column field="admission_number" header="N° Admisión" sortable style="min-width: 5rem"></Column>
            <Column field="invoice_number" header="N° Factura" sortable style="min-width: 7rem"></Column>
            <Column field="trama_date" header="Env. Trama" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.trama_date">
                        {{ dformatLocal(slotProps.data.trama_date, 'DD/MM/YYYY') }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="courier_date" header="Env. Currier" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.courier_date">
                        {{ dformatLocal(slotProps.data.courier_date, 'DD/MM/YYYY') }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="email_verified_date" header="Env. Email" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.email_verified_date">
                        {{ dformatLocal(slotProps.data.email_verified_date, 'DD/MM/YYYY') }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="shipment.url_sustenance" header="URL Sust." sortable style="min-width: 8rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.url_sustenance">
                        <a :href="slotProps.data.url_sustenance" target="_blank">
                            <i class="pi pi-external-link text-blue-500"></i>
                        </a>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="remarks" header="Comentarios" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.remarks">
                        {{ slotProps.data.remarks }}
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="verified_shipment_date" sortable style="min-width: 5rem" header="Verif. Envío">
                <template #body="slotProps">
                    <span v-if="slotProps.data.verified_shipment_date">
                        <span class="text-green-500">{{ dformatLocal(slotProps.data.verified_shipment_date, 'DD/MM/YYYY') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
