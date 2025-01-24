<script setup>
import { useAuditsStore } from '@/stores/AuditsStore';
import { useAuthStore } from '@/stores/authStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { compareDates, dformat } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const auditsStore = useAuditsStore();
const authStore = useAuthStore();
const position = authStore.getUser.position;
const devolutionsStore = useDevolutionsStore();
const toast = useToast();
const filters = ref({ global: { value: '' } });
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());

const audits = ref([]);
const audit = ref(null);
const dataGeneralSummary = ref(null);
const displayDialog = ref(false);
const statuses = ref([
    { label: 'Aprobado', value: 'Aprobado' },
    { label: 'Con Observaciones', value: 'Con Observaciones' },
    { label: 'Rechazado', value: 'Rechazado' }
]);
function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}
const hideDialog = () => {
    displayDialog.value = false;
    audit.value = null;
};
onBeforeMount(() => {
    initFilters();
});
onMounted(async () => {
    await searchAuditsByDate();
});

const searchAuditsByDate = async () => {
    let payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(new Date(endDate.value.setHours(23, 0, 0, 0)), 'YYYY-MM-DD HH:mm:ss')
    };
    try {
        const responseAudits = await auditsStore.fetchAuditsDateRange(payload);
        audits.value = responseAudits.data;
        // filtrar y quitar todos los registros que contengan type == 'Regular'
        audits.value = audits.value.filter((item) => item.type !== 'Regular');
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message });
    }
    formatAudits(audits.value);
};

const formatAudits = async (data) => {
    if (data.length === 0) {
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron admisiones.',
            life: 3000
        });
        return [];
    }
    const listNumbers = data.map((item) => item.invoice_number);
    let responseDevolutions = await devolutionsStore.fetchDevolutionsByInvoices(listNumbers);
    audits.value = audits.value.map((audit) => {
        const devolution = responseDevolutions.find((dev) => dev.invoice_number === audit.invoice_number);
        const rebilled = devolution.invoice_date && devolution.last_invoice && compareDates(devolution.invoice_date, devolution.date_last_invoice) === -1;
        return {
            ...audit,
            attendance_date: devolution.attendance_date,
            date_dev: devolution.date_dev,
            doctor: devolution.doctor,
            biller: devolution.biller,
            insurer_name: devolution.insurer_name,
            invoice_amount: devolution.invoice_amount,
            invoice_date: devolution.invoice_date,
            patient: devolution.patient,
            reason: devolution.reason,
            date_last_invoice: devolution.date_last_invoice,
            last_invoice: devolution.last_invoice,
            rebilled
        };
    });

    dataGeneralSummary.value = [generalSummary(audits.value)];
};

// const resumenDevolutions = (data) => {
//     console.log(data);
//     const groupedData = data.reduce((acc, item) => {
//         // Inicializar el objeto para el biller si no existe

//         if (!acc[item.auditor]) {
//             acc[item.auditor] = {
//                 biller: item.auditor,
//                 total: 0,
//                 closedTrue: 0,
//                 paidNotNull: 0,
//                 invoiceNotNull: 0,
//                 auditNotNull: 0,
//                 audit_requested_at: 0,
//                 devolutionNotNull: 0,
//                 totalAmount: 0 // como añado el monto total de amount por biller
//             };
//         }

//         // Actualizar los contadores
//         acc[item.auditor].total++;
//         let amount = parseFloat(item.amount);
//         if (amount > 0) {
//             acc[item.auditor].totalAmount += amount;
//         }
//         if (item.is_closed === 1) acc[item.auditor].closedTrue++;
//         if (item.audit_requested_at !== null) acc[item.auditor].audit_requested_at++;
//         if (item.paid_invoice_number !== null) acc[item.auditor].paidNotNull++;
//         if (item.invoice_number !== null && item.invoice_number !== '') acc[item.auditor].invoiceNotNull++;
//         if (item.audit_id !== null) acc[item.auditor].auditNotNull++;
//         if (item.devolution_date !== null) acc[item.auditor].devolutionNotNull++;
//         return acc;
//     }, {});

//     console.log('groupedData', groupedData);
//     return groupedData;
// };
const generalSummary = (data) => {
    const resumen = {
        total: data.length,
        pending: data.filter((item) => item.status === 'Pendiente').length,
        approved: data.filter((item) => item.status === 'Aprobado').length,
        observed: data.filter((item) => item.status === 'Con Observaciones').length,
        audited: data.filter((item) => item.status !== 'Pendiente').length,
        rebilled: data.filter((item) => item.rebilled === true).length
    };
    console.log('resumenGeneral', resumen);
    return resumen;
};

const editAudit = (data) => {
    let nickName = authStore.getNickName;
    audit.value = { ...data };
    audit.value.auditor = nickName;
    displayDialog.value = true;
};

const saveAudit = async (data) => {
    let responseAudit = {};
    responseAudit = await auditsStore.updateAudit(data);
    if (responseAudit.success) {
        audits.value = audits.value.map((item) => (item.id === responseAudit.data.id ? { ...item, ...responseAudit.data } : item));

        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Auditoría actualizada correctamente.', life: 3000 });
        displayDialog.value = false;
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la auditoría.', life: 3000 });
    }
    displayDialog.value = false;
};

const exportAudits = async () => {
    const colums = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Fecha Entrega', key: 'created_at', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'N° Admisión', key: 'admission_number', width: 20 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer_name', width: 15 },
        { header: 'Auditor', key: 'auditor', width: 20 },
        { header: 'Descripción', key: 'description', width: 20 },
        { header: 'Facturador', key: 'biller', width: 20 },
        { header: 'N° Factura', key: 'invoice_number', width: 20 },
        { header: 'Refacturado', key: 'rebilled', width: 20 },
        { header: 'Estado', key: 'status', width: 20 },
        { header: 'Tipo', key: 'type', width: 20 }
    ];
    let data = audits.value.map((item) => {
        return {
            id: item.id,
            created_at: new Date(item.created_at),
            admission_number: item.admission_number,
            patient: item.patient,
            doctor: item.doctor,
            insurer_name: item.insurer_name,
            auditor: item.auditor,
            description: item.description,
            biller: item.biller,
            invoice_number: item.invoice_number,
            status: item.status,
            rebilled: item.rebilled ? 'Sí' : 'No',
            type: item.type
        };
    });
    await exportToExcel(colums, data, 'Auditorias', 'Auditorias');
};
</script>
<template>
    <!-- <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <DataTable :value="dataGeneralSummary" tableStyle="min-width: 50rem" size="small" :style="{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="approved" header="Aprobados">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-green-100 text-green-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.approved }}
                            </span>
                        </template>
                    </Column>
                    <Column field="observed" header="Observados">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.observed }}
                            </span>
                        </template>
                    </Column>
                    <Column field="pending" header="Pendientes">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-red-100 text-red-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.pending }}
                            </span>
                        </template>
                    </Column>
                    <Column field="total" header="Entregados"></Column>
                    <Column field="rebilled" header="Refacturados">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-blue-100 text-blue-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.rebilled }}
                            </span>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Toolbar>
    </div> -->
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <!-- <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="searchAdmission" placeholder="N° Admisión" />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchAdmissions" /> -->
                <DataTable :value="dataGeneralSummary" tableStyle="min-width: 50rem" size="small" :style="{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="total" header="Entregados"></Column>
                    <Column field="approved" header="Aduditados">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-green-100 text-green-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.audited }}
                            </span>
                        </template>
                    </Column>
                    <Column field="pending" header="Pendientes">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-red-100 text-red-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.pending }}
                            </span>
                        </template>
                    </Column>
                    <Column field="rebilled" header="Refacturados">
                        <template #body="slotProps">
                            <span
                                :class="{
                                    'bg-blue-100 text-blue-800 px-2 py-1 rounded-full': true
                                }"
                            >
                                {{ slotProps.data.rebilled }}
                            </span>
                        </template>
                    </Column>
                </DataTable>
            </template>

            <template #end>
                <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchAuditsByDate" />
            </template>
        </Toolbar>
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="audits"
            :paginator="true"
            :rows="10"
            v-model:filters="filters"
            stripedRows
            scrollable
            size="small"
            :loading="auditsStore.loading"
            :globalFilterFields="['id', 'created_at', 'admission_number', 'auditor', 'description', 'invoice_number', 'status', 'attendance_date', 'date_dev', 'doctor', 'insurer_name', 'invoice_amount', 'patient', 'reason', 'biller']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Auditorías"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión Devoluciones de Seguro CSR</h1>

                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAudits()" />
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
            <Column field="id" header="ID" sortable />
            <Column field="admission_number" header="N° Admisión" sortable />
            <Column field="attendance_date" header="Fecha Atención" sortable>
                <template #body="slotProps">
                    {{ dformat(slotProps.data.attendance_date, 'DD/MM/YYYY') }}
                </template>
            </Column>
            <Column field="date_dev" header="Fecha Devolución" sortable></Column>
            <Column field="patient" header="Paciente" sortable style="min-width: 8rem"></Column>
            <Column field="doctor" header="Médico" sortable></Column>
            <Column field="insurer_name" header="Aseguradora" sortable></Column>
            <Column field="biller" header="Facturador" sortable></Column>
            <Column field="reason" header="Motivo" sorteable style="min-width: 10rem"></Column>
            <Column field="created_at" header="Fecha Audit." sortable>
                <template #body="slotProps">
                    {{ slotProps.data.created_at ? dformat(slotProps.data.created_at, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
            <Column field="auditor" header="Auditor" sortable />
            <Column field="description" header="Descripción" sortable />
            <Column field="invoice_number" header="N° Factura" sortable />
            <Column field="rebilled" header="Refct" sortable>
                <template #body="slotProps">
                    <i
                        :class="{
                            'pi pi-check-circle text-green-500': slotProps.data.rebilled,
                            'pi pi-times-circle text-red-500': !slotProps.data.rebilled
                        }"
                    ></i>
                </template>
            </Column>
            <Column field="status" header="Estado" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.status">
                        <i
                            :class="{
                                'pi pi-check-circle text-green-500': slotProps.data.status === 'Aprobado',
                                'pi pi-exclamation-circle text-yellow-500': slotProps.data.status === 'Con Observaciones',
                                'pi pi-times-circle text-red-500': slotProps.data.status === 'Rechazado',
                                'pi pi-clock text-blue-500': slotProps.data.status === 'Pendiente'
                            }"
                        ></i>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-blue-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="type" header="Tipo" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.type">
                        <span
                            :class="{
                                'bg-green-100 text-green-800 px-2 py-1 rounded': slotProps.data.type === 'Regular',
                                'bg-red-100 text-red-800 px-2 py-1 rounded': slotProps.data.type === 'Devolucion'
                            }"
                        >
                            {{ slotProps.data.type }}
                        </span>
                    </span>
                </template>
            </Column>
            <Column v-if="position === 'AUDITOR MEDICO'" field="actions" header="Acciones">
                <template #body="slotProps">
                    <Button icon="pi pi-pencil" class="p-button-rounded p-button-success mr-2" @click="editAudit(slotProps.data)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <Dialog v-model:visible="displayDialog" header="Auditoría" :modal="true" :style="{ width: '450px' }">
        <div class="flex flex-col gap-6">
            <div>
                <label for="admision_number" class="block font-bold mb-3">Admisión</label>
                <InputText id="admision_number" v-model="audit.admission_number" required="true" disabled fluid />
            </div>
            <div>
                <label for="description" class="block font-bold mb-3">Descripción</label>
                <Textarea id="description" v-model="audit.description" required="true" rows="3" cols="20" autofocus fluid />
            </div>
            <div>
                <label for="status" class="block font-bold mb-3">Estado Auditoría</label>
                <Select id="status" v-model="audit.status" :options="statuses" optionLabel="label" optionValue="value" placeholder="Seleccionar Estado" fluid required></Select>
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="hideDialog" />
            <Button label="Guardar" icon="pi pi-check" @click="saveAudit(audit)" :loading="auditsStore.loading" />
        </template>
    </Dialog>
</template>
