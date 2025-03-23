<script setup>
import { useAuditsStore } from '@/stores/AuditsStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { useShipmentsStore } from '@/stores/shipmentsStore';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const devolutionsStore = useDevolutionsStore();
const shipmentsStore = useShipmentsStore();
const auditsStore = useAuditsStore();

const toast = useToast();
const devolutions = ref([]);
const devolution = ref(null);
const shipments = ref([]);
const auditDialog = ref(false);
const audits = ref([]);
const filters = ref(null);
const starDate = '01-01-2023';
const endDate = ref(new Date());

function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        attendance_date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
        patient: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        doctor: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        insurer_name: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        invoice_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        biller: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        invoice_amount: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        medical_record_number: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        period_dev: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        status: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        reason: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        type: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }
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
    // mejorar el la consulta de envios, para que solo cargue las devoluciones.
    shipments.value = await shipmentsStore.initializeStore();
    devolutions.value = await devolutionsStore.initializeStoreDevolutionsDataRange(payload);
    formatDevolitions(devolutions.value);
});

const formatDevolitions = async (data) => {
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

    // Remove duplicates based on invoice_number
    const uniqueData = [];
    const invoiceNumbers = new Set();
    data.forEach((devolution) => {
        if (!invoiceNumbers.has(devolution.invoice_number)) {
            invoiceNumbers.add(devolution.invoice_number);
            uniqueData.push(devolution);
        }
    });

    let admisionsNumbers = uniqueData.map((devolution) => devolution.number);
    let response = await auditsStore.getAuditsByAdmissions(admisionsNumbers);
    audits.value = response.data;
    const shipmentsData = shipments.value.reduce((acc, shipment) => {
        acc[shipment.invoice_number] = shipment;
        return acc;
    }, {});

    uniqueData.forEach((devolution) => {
        let audit = null;
        if (audits.value && audits.value.length > 0) {
            audit = audits.value.find((audit) => audit.admission_number === devolution.number && audit.invoice_number === devolution.invoice_number);
        }
        devolution.audit = audit;
        devolution.status = 'Pendiente';

        if (devolution.invoice_date < devolution.date_last_invoice) {
            devolution.status = 'Facturado';
        }

        if (shipmentsData[devolution.last_invoice] && shipmentsData[devolution.last_invoice]?.verified_shipment_date !== null && devolution.invoice_date != devolution.date_last_invoice) {
            // Convertir las fechas a objetos Date

            let shipmentDate = new Date(shipmentsData[devolution.last_invoice].verified_shipment_date); // "2023-11-04 00:00:00"

            // Convertir la fecha de devolución (DD/MM/YYYY HH:mm:ss → YYYY-MM-DDTHH:mm:ss)
            let [datePart, timePart] = devolution.date_dev.split(' ');
            let [day, month, year] = datePart.split('/');
            let devolutionDate = new Date(`${year}-${month}-${day}T${timePart}`);

            // Solo asignar "Enviado" si la fecha de devolución NO es mayor que la fecha de envío
            if (devolutionDate <= shipmentDate) {
                devolution.status = 'Enviado';
            }
        }

        if (devolution.paid_admission === 1) {
            devolution.status = 'Pagado';
        }
    });

    devolutions.value = uniqueData;
};

const confirmSendAudit = (data) => {
    auditDialog.value = true;
    devolution.value = data;
};

const sendAudit = async () => {
    let payload = {
        auditor: 'SIN ASIGNAR',
        admission_number: devolution.value.number,
        status: 'Pendiente',
        invoice_number: devolution.value.invoice_number,
        type: 'Devolucion'
    };
    let responseAudit = {};
    responseAudit = await auditsStore.createAudit(payload);

    if (responseAudit.success) {
        let index = devolutions.value.findIndex((dev) => dev.number === devolution.value.number);
        devolutions.value[index].audit = responseAudit.data;
        toast.add({
            severity: 'success',
            summary: 'Auditoría enviada',
            detail: 'La auditoría fue enviada correctamente.',
            life: 3000
        });
        auditDialog.value = false;
    } else {
        toast.add({
            severity: 'error',
            summary: 'Error al enviar auditoría',
            detail: 'Ocurrió un error al enviar la auditoría.',
            life: 3000
        });
    }
};

const editAuditUrl = async (audit) => {
    let payload = {
        id: audit.id,
        url: audit.url
    };
    await auditsStore.updateAudit(payload);

    // modificar el registro de  admissionsLists segun admision.admision_number
    // const index = audits.value.findIndex((item) => item.id === audit.id);
    // if (index !== -1) {
    //     audits.value[index].audit.url = audit.url;
    //     // modificar en indexedDB
    //     await indexedDB.setItem('audits', audits.value);
    // }

    const indexDevolutions = devolutions.value.findIndex((item) => item.id === audit.id);
    if (indexDevolutions !== -1) {
        devolutions.value[indexDevolutions].audit.url = audit.url;
        // modificar en indexedDB
        await indexedDB.setItem('devolutions', devolutions.value);
    }

    toast.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'URL actualizada correctamente.',
        life: 3000
    });
};
function convertDateToExcelFormat(dateString) {
    const date = new Date(dateString);
    return (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}
function convertDateToExcelFormatDevolutions(dateString) {
    // Convertir el formato dd/mm/yyyy hh:mm:ss a yyyy-mm-ddThh:mm:ss
    const [datePart, timePart] = dateString.split(' ');
    const [day, month, year] = datePart.split('/');
    const formattedDateString = `${year}-${month}-${day}T${timePart || '00:00:00'}`;

    const date = new Date(formattedDateString);
    return (date - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}
const exportDevolutions = async () => {
    const colums = [
        { header: 'Nro. Admisión', key: 'number', width: 15 },
        { header: 'Fecha Atención', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Fecha Devolución', key: 'date_dev', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Nro. Historia', key: 'medical_record_number', width: 15 },
        { header: 'Paciente', key: 'patient', width: 15 },
        { header: 'Médico', key: 'doctor', width: 15 },
        { header: 'Aseguradora', key: 'insurer_name', width: 15 },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Nro. Factura', key: 'invoice_number', width: 15 },
        { header: 'Fecha Factura', key: 'invoice_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Monto', key: 'invoice_amount', width: 15 },
        { header: 'Periodo', key: 'period_dev', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Motivo', key: 'reason', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Estado Auditoría', key: 'auditStatus', width: 15 }
    ];

    let data = devolutions.value.map((devolution) => {
        return {
            number: devolution.number,
            attendance_date: convertDateToExcelFormat(devolution.attendance_date),
            date_dev: convertDateToExcelFormatDevolutions(devolution.date_dev),
            medical_record_number: devolution.medical_record_number,
            patient: devolution.patient,
            doctor: devolution.doctor,
            insurer_name: devolution.insurer_name,
            biller: devolution.biller,
            invoice_number: devolution.invoice_number,
            invoice_date: convertDateToExcelFormat(devolution.invoice_date),
            invoice_amount: formatCurrency(devolution.invoice_amount),
            period_dev: devolution.period_dev,
            type: devolution.type,
            reason: devolution.reason,
            status: devolution.status,
            auditStatus: devolution.audit ? devolution.audit.status : 'Sin auditoría'
        };
    });

    await exportToExcel(colums, data, 'Devoluciones', 'Devoluciones');
};
</script>
<template>
    <div class="card">
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="devolutions"
            :paginator="true"
            :rows="10"
            v-model:filters="filters"
            :id="devolutions.id"
            stripedRows
            scrollable
            size="small"
            filterDisplay="menu"
            :loading="devolutionsStore.loading"
            :globalFilterFields="['number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'invoice_amount', 'patient', 'period_dev', 'medical_record_number', 'reason', 'type', 'status']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Devoluciones"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión admisiones de seguro CSR</h1>
                    <a href="https://1drv.ms/f/s!AlehBy_4oTnf904O8zdXxIS9D3TO?e=XfLwUH" target="_blank" class="text-blue-500 hover:underline">
                        <i class="pi pi-external-link"></i>
                    </a>

                    <!-- <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" /> -->
                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportDevolutions()" />
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters['global'].value" placeholder="Buscar..." />
                    </IconField>
                </div>
            </template>
            <Column field="number" header="Nro. Admisión" sortable></Column>
            <Column field="date_dev" header="Fecha Devolución" sortable></Column>
            <Column field="attendance_date" header="Fecha Atención" sortable>
                <template #body="slotProps">
                    {{ dformatLocal(slotProps.data.attendance_date, 'DD/MM/YYYY') }}
                </template>
            </Column>
            <Column field="medical_record_number" header="Nro. Historia" sortable></Column>
            <Column field="patient" header="Paciente" sortable></Column>
            <Column field="doctor" header="Médico" sortable></Column>
            <Column field="insurer_name" header="Aseguradora" sortable></Column>
            <Column field="biller" header="Facturador" sortable></Column>
            <Column field="invoice_number" header="Nro. Factura" sortable></Column>
            <Column field="invoice_date" header="Fecha Factura" sortable>
                <template #body="slotProps">
                    {{ dformatLocal(slotProps.data.invoice_date, 'DD/MM/YYYY') }}
                </template>
            </Column>
            <Column field="invoice_amount" header="Monto" sortable>
                <template #body="slotProps">
                    {{ formatCurrency(slotProps.data.invoice_amount) }}
                </template>
            </Column>
            <Column field="period_dev" header="Periodo" sortable></Column>
            <Column field="type" header="Tipo" sortable></Column>
            <Column field="reason" header="Motivo de devolución" sorteable style="min-width: 15rem"></Column>
            <Column field="status" header="Estado" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.status">
                        <span
                            :class="{
                                'bg-green-100 text-green-800 px-2 py-1 rounded': slotProps.data.status === 'Pagado',
                                'bg-yellow-100 text-yellow-800 px-2 py-1 rounded': slotProps.data.status === 'Facturado',
                                'bg-red-100 text-red-800 px-2 py-1 rounded': slotProps.data.status === 'Pendiente',
                                'bg-blue-100 text-blue-800 px-2 py-1 rounded': slotProps.data.status === 'Enviado'
                            }"
                        >
                            {{ slotProps.data.status }}
                        </span>
                    </span>
                </template>
            </Column>
            <Column field="audit.status" header="Est Audit" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.audit">
                        <span
                            :class="{
                                'bg-blue-100 text-blue-800 px-2 py-1 rounded': slotProps.data.audit.status === 'Con Observaciones',
                                'bg-green-100 text-green-800 px-2 py-1 rounded': slotProps.data.audit.status === 'Aprobado',
                                'bg-yellow-100 text-yellow-800 px-2 py-1 rounded': slotProps.data.audit.status === 'Pendiente',
                                'bg-red-100 text-red-800 px-2 py-1 rounded': slotProps.data.audit.status === 'Rechazado'
                            }"
                        >
                            {{ slotProps.data.audit.status }}
                        </span>
                    </span>
                </template>
            </Column>
            <Column field="audit.url" header="URL" sortable style="min-width: 10rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.audit && slotProps.data.audit.url">
                        <a :href="slotProps.data.audit.url" target="_blank">
                            <i class="pi pi-external-link text-blue-500"></i>
                        </a>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
                <template #editor="slotProps">
                    <InputText v-if="slotProps.data.audit" v-model="slotProps.data.audit.url" @blur="editAuditUrl(slotProps.data.audit)" />
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="actions" header="Env. Audit" bodyStyle="width: 4rem">
                <template #body="slotProps">
                    <Button
                        type="button"
                        icon="pi pi-send"
                        class="p-button-rounded p-button-outlined p-button-sm"
                        :class="{ 'p-button-success': !slotProps.data.audit, 'p-button-secondary': slotProps.data.audit }"
                        :disabled="slotProps.data.audit"
                        @click="confirmSendAudit(slotProps.data)"
                    />
                </template>
            </Column>
        </DataTable>
    </div>
    <Dialog v-model:visible="auditDialog" :style="{ width: '450px' }" header="Confirmar Envío" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>Enviar devolución para su auditoría ?</span>
        </div>
        <template #footer>
            <Button label="No" icon="pi pi-times" text @click="auditDialog = false" />
            <Button label="Sí" :loading="auditsStore.loading" icon="pi pi-check" text @click="sendAudit" />
        </template>
    </Dialog>
</template>
