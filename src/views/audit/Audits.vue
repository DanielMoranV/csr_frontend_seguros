<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAuditsStore } from '@/stores/AuditsStore';
import { useAuthStore } from '@/stores/authStore';
import { dformat } from '@/utils/day';
import indexedDB from '@/utils/indexedDB';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const authStore = useAuthStore();
const auditsStore = useAuditsStore();
const toast = useToast();
const admissionsLists = ref([]);
const admission = ref(null);
const audit = ref(null);
const displayDialog = ref(false);
const resumenAdmissions = ref([]);
const periods = ref([]);
const filters = ref(null);
const period = ref(null);
const getCurrentPeriod = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return `${year}${month.toString().padStart(2, '0')}`;
};
const statuses = ref([
    { label: 'Aprobado', value: 'Aprobado' },
    { label: 'Con Observaciones', value: 'Con Observaciones' },
    { label: 'Rechazado', value: 'Rechazado' }
]);
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
        audit_requested_at: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] }
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
    let data = await admissionsListStore.initializeStoreByPeriod(period.value);
    admissionsLists.value = formatAdmissionsLists(data);

    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
});

const formatAdmissionsLists = (data) => {
    if (data.length === 0) {
        admissionsLists.value = [];
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron admisiones para el periodo seleccionado.',
            life: 5000
        });
        return [];
    }
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
        return group.reduce((latest, current) => {
            return new Date(latest.invoice_date) > new Date(current.invoice_date) ? latest : current;
        });
    });

    uniqueAdmissions.forEach((admission) => {
        if (admission.invoice_number === null || admission.invoice_number.startsWith('005-')) {
            admission.invoice_number = admission.invoice_number?.startsWith('005-') ? '' : admission.invoice_number;
        }
        // end_date es la fecha limite que se permite facturar comprarla con invoice_date para determinar si esta a tiempo o no, si end_date es mayor a invoice_date esta a tiempo
        admission.isLate = new Date(admission.end_date) >= new Date(admission.invoice_date);
        if (admission.isLate) {
            admission.status = 'A tiempo';
        } else {
            admission.status = 'Fuera de tiempo';
        }
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
                closedTrue: 0,
                paidNotNull: 0,
                invoiceNotNull: 0,
                auditNotNull: 0,
                medical_record_request: 0,
                devolutionNotNull: 0,
                totalAmount: 0 // como añado el monto total de amount por biller
            };
        }

        // Actualizar los contadores
        acc[item.biller].total++;
        acc[item.biller].totalAmount += parseFloat(item.amount);
        if (item.is_closed === true) acc[item.biller].closedTrue++;
        if (item.paid_invoice_number !== null) acc[item.biller].paidNotNull++;
        if (item.invoice_number !== null && item.invoice_number !== '') acc[item.biller].invoiceNotNull++;
        if (item.audit_id !== null) acc[item.biller].auditNotNull++;
        if (item.medical_record_request.status == 'Atendido') acc[item.biller].medical_record_request++;
        if (item.devolution_date !== null) acc[item.biller].devolutionNotNull++;
        return acc;
    }, {});
    return groupedData;
};

const searchPeriod = async () => {
    let response = await admissionsListStore.fetchAdmissionsListsByPeriod(period.value);
    admissionsLists.value = formatAdmissionsLists(response.data);
    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
};

const hideDialog = () => {
    displayDialog.value = false;
    admission.value = null;
};
const addAudit = (data) => {
    let nickName = authStore.getNickName;
    admission.value = data;
    displayDialog.value = true;
    audit.value = {
        auditor: nickName,
        admission_number: data.admission_number,
        description: '',
        status: ''
    };
};

const editAudit = (data) => {
    let nickName = authStore.getNickName;
    admission.value = data;
    displayDialog.value = true;
    audit.value = {
        id: data.audit.id,
        auditor: nickName,
        admission_number: data.admission_number,
        description: data.audit.description,
        status: data.audit.status
    };

    console.log(audit.value);
};
const saveAudit = async (data) => {
    console.log(data);
    if (data.status === '') {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Debe seleccionar un estado para la auditoría.',
            life: 5000
        });
        return;
    }
    let responseAudit = {};
    if (!data.id) {
        responseAudit = await auditsStore.createAudit(data);
    } else {
        responseAudit = await auditsStore.updateAudit(data);
    }

    if (responseAudit.success) {
        let payload = {
            id: admission.value.id,
            audit_id: responseAudit.data.id
        };
        await admissionsListStore.updateAdmissionsList(payload);

        let index = admissionsLists.value.findIndex((item) => item.id === admission.value.id);
        if (index !== -1) {
            admissionsLists.value[index].audit_id = payload.audit_id;
            admissionsLists.value[index].audit = responseAudit.data;

            await indexedDB.setItem('admissionsLists', admissionsLists.value);
        }

        resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));

        audit.value = null;
        admission.value = null;

        toast.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Auditoría guardada correctamente.',
            life: 5000
        });
        hideDialog();
    } else {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Ocurrió un error al guardar la auditoría.',
            life: 5000
        });
    }
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <DataTable :value="resumenAdmissions" tableStyle="min-width: 50rem" size="small" :style="{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="biller" header="Facturador"></Column>
                    <Column field="total" header="Total"></Column>
                    <Column field="totalAmount" header="Monto">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.totalAmount) }}
                        </template>
                    </Column>

                    <Column field="auditNotNull" header="Audit."></Column>
                    <Column field="invoiceNotNull" header="Factur."></Column>
                    <Column field="paidNotNull" header="Pagad."></Column>
                    <Column field="devolutionNotNull" header="Devol."></Column>
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
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="admissionsLists"
            :paginator="true"
            :rows="10"
            selectionMode="single"
            v-model:filters="filters"
            stripedRows
            scrollable
            size="small"
            filterDisplay="menu"
            :loading="admissionsListStore.loading"
            :globalFilterFields="['number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status', 'audit_requested_at']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión admisiones de seguro CSR</h1>

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
            <Column header="#" headerStyle="width:3rem">
                <template #body="slotProps">
                    {{ slotProps.index + 1 }}
                </template>
            </Column>
            <Column field="admission_number" sortable header="Admisión" frozen></Column>
            <Column field="period" sortable header="Periodo"></Column>
            <Column field="attendance_date" header="Atención" sortable style="min-width: 5rem">
                <template #body="slotProps">
                    {{ slotProps.data.attendance_date ? dformat(slotProps.data.attendance_date, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
            <Column field="patient" header="Paciente" sortable style="min-width: 8rem"></Column>
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
            <Column field="observations" header="Obs." sortable>
                <template #body="slotProps">
                    {{ slotProps.data.observations || '-' }}
                </template>
            </Column>
            <Column field="audit_requested_at" header="Entr. Audit." sorteable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.audit_requested_at">
                        <span class="text-green-500">{{ dformat(slotProps.data.audit_requested_at, 'DD/MM') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="audit.auditor" header="Auditor" style="width: 8rem"> </Column>
            <Column field="audit.description" header="Descripción Auditoría" style="width: 15rem"> </Column>
            <Column field="audit.created_at" header="Fecha Auditoría" style="width: 8rem">
                <template #body="slotProps">
                    {{ slotProps.data.audit ? dformat(slotProps.data.audit.created_at, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>

            <Column field="audit.status" header="Estado Audit." sortable="">
                <template #body="slotProps">
                    <span v-if="slotProps.data.audit">
                        <i
                            :class="{
                                'pi pi-check-circle text-green-500': slotProps.data.audit.status === 'Aprobado',
                                'pi pi-exclamation-circle text-yellow-500': slotProps.data.audit.status === 'Con Observaciones',
                                'pi pi-times-circle text-red-500': slotProps.data.audit.status === 'Rechazado',
                                'pi pi-clock text-blue-500': slotProps.data.audit.status === 'Pendiente'
                            }"
                        ></i>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-blue-500"></i>
                    </span>
                </template>
            </Column>

            <Column field="" header="Acciones" style="min-width: 8rem">
                <template #body="slotProps">
                    <Button icon="pi pi-plus" class="p-button-rounded p-button-primary mr-2" @click="addAudit(slotProps.data)" />
                    <Button v-if="slotProps.data.audit" icon="pi pi-pencil" class="p-button-rounded p-button-success mr-2" @click="editAudit(slotProps.data)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <Dialog v-model:visible="displayDialog" header="Auditoría" :modal="true" :style="{ width: '450px' }">
        <div class="flex flex-col gap-6">
            <div>
                <label for="admision_number" class="block font-bold mb-3">Admisión</label>
                <InputText id="admision_number" v-model="admission.admission_number" required="true" disabled fluid />
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
            <Button label="Guardar" icon="pi pi-check" @click="saveAudit(audit)" :loading="admissionsListStore.loading" />
        </template>
    </Dialog>
</template>
