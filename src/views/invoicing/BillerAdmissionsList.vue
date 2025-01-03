<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAuthStore } from '@/stores/authStore';
import { dformat } from '@/utils/day';
import indexedDB from '@/utils/indexedDB';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const authStore = useAuthStore();
const toast = useToast();
const admissionsLists = ref([]);
const resumenAdmissions = ref([]);
const periods = ref([]);
const filters = ref(null);
const nickName = ref();
const period = ref(null);
const startDate = ref(new Date());
const endDate = ref(new Date());
const getCurrentPeriod = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return `${year}${month.toString().padStart(2, '0')}`;
};
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
        observations: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] }
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
    data = data.filter((admission) => admission.biller === nickName.value);
    admissionsLists.value = formatAdmissionsLists(data);
    if (admissionsLists.value.length > 0) {
        startDate.value = data[0].start_date;
        endDate.value = data[0].end_date;
        period.value = data[0].period;
    }
    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
    console.log(resumenAdmissions.value);
    console.log(admissionsLists.value);
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
            admission.invoice_number = admission.invoice_number?.startsWith('005-') ? null : admission.invoice_number;
            admission.invoice_date = new Date();
        }

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
    response.data = response.data.filter((admission) => admission.biller === nickName.value);
    admissionsLists.value = formatAdmissionsLists(response.data);
    resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
    if (admissionsLists.value.length > 0) {
        startDate.value = response.data[0].start_date;
        endDate.value = response.data[0].end_date;
        period.value = response.data[0].period;
    }
};
const editObservation = async (admission) => {
    console.log(admission);
    let payload = {
        id: admission.id,
        observations: admission.observations
    };
    admissionsListStore.updateAdmissionsList(payload);

    // modificar el registro de  admissionsLists segun admision.admision_number
    const index = admissionsLists.value.findIndex((item) => item.admission_number === admission.admission_number);
    if (index !== -1) {
        admissionsLists.value[index].observations = admission.observations;
        // modificar en indexedDB
        await indexedDB.setItem('admissionsLists', admissionsLists.value);
    }
};

const editAuditRequestedAt = async (admission) => {
    console.log(admission.audit_requested_at);
    if ((admission.audit_requested_at = true)) {
        // asignar fecha actual en formato para mysql
        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
        admission.audit_requested_at = formattedDate;
    }
    let payload = {
        id: admission.id,
        audit_requested_at: admission.audit_requested_at
    };
    console.log(payload);
    admissionsListStore.updateAdmissionsList(payload);

    // modificar el registro de  admissionsLists segun admision.admision_number
    const index = admissionsLists.value.findIndex((item) => item.admission_number === admission.admission_number);
    if (index !== -1) {
        admissionsLists.value[index].audit_requested_at = admission.audit_requested_at;
        // modificar en indexedDB
        await indexedDB.setItem('admissionsLists', admissionsLists.value);
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
                    <Column field="medical_record_request" header="Entreg."></Column>
                    <Column field="closedTrue" header="Liquid."></Column>
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
            :globalFilterFields="['number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status', 'observations']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión admisiones de seguro CSR {{ period }} Fecha Facturación {{ dformat(startDate, 'DD/MM/YYYY') }} al {{ dformat(endDate, 'DD/MM/YYYY') }}</h1>

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
            <Column field="medical_record_number" header="Historia" sortable style="min-width: 5rem"></Column>
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
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Buscar por nombre" />
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
            <Column field="observations" header="Observación" sortable style="min-width: 10rem">
                <template #body="slotProps">
                    {{ slotProps.data.observations || '-' }}
                </template>
                <template #editor="slotProps">
                    <InputText v-model="slotProps.data.observations" @blur="editObservation(slotProps.data)" />
                </template>
            </Column>

            <Column field="medical_record_request.status" header="Entr." sortable="">
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request">
                        <i
                            :class="{
                                'pi pi-check-circle text-green-500': slotProps.data.medical_record_request.status === 'Atendido',
                                'pi pi-clock text-yellow-500': slotProps.data.medical_record_request.status === 'Pendiente',
                                'pi pi-times-circle text-red-500': slotProps.data.medical_record_request.status === 'Rechazado'
                            }"
                        ></i>
                    </span>
                </template>
            </Column>
            <Column field="is_closed" header="Liquid." sortable>
                <template #body="slotProps">
                    <i
                        :class="{
                            'pi pi-check-circle text-green-500': slotProps.data.is_closed,
                            'pi pi-times-circle text-red-500': !slotProps.data.is_closed
                        }"
                    ></i>
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
                <template #editor="slotProps">
                    <span v-if="!slotProps.data.audit_requested_at">
                        <Checkbox v-model="slotProps.data.audit_requested_at" binary @blur="editAuditRequestedAt(slotProps.data)" />
                    </span>
                </template>
            </Column>
            <Column field="audit.status" header="Audit" sortable="">
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
            <Column field="shipment.verified_shipment_date" sortable style="min-width: 5rem" header="Envío">
                <template #body="slotProps">
                    <span v-if="slotProps.data.shipment && slotProps.data.shipment.verified_shipment_date">
                        <span class="text-green-500">{{ dformat(slotProps.data.shipment.verified_shipment_date, 'DD/MM/YYYY') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="paid_invoice_number" sortable header="Pago">
                <template #body="slotProps">
                    <span v-if="slotProps.data.paid_invoice_number">
                        <i class="pi pi-check-circle text-green-500"></i>
                    </span>
                    <span v-else-if="slotProps.data.devolution_date">
                        <i class="pi pi-times-circle text-red-500"></i>
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
