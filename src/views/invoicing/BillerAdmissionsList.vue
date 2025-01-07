<script setup>
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useAuthStore } from '@/stores/authStore';
import { dformat } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import indexedDB from '@/utils/indexedDB';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const admissionsStore = useAdmissionsStore();
const authStore = useAuthStore();
const toast = useToast();
const admissionsLists = ref([]);
const admission = ref([]);
const submitted = ref(false);
const resumenAdmissions = ref([]);
const periods = ref([]);
const filters = ref(null);
const nickName = ref();
const period = ref(null);
const startDate = ref(new Date());
const endDate = ref(new Date());
const admissionDialog = ref(false);
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
    await admissionsListStore.updateAdmissionsList(payload);

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
    await admissionsListStore.updateAdmissionsList(payload);

    // modificar el registro de  admissionsLists segun admision.admision_number
    const index = admissionsLists.value.findIndex((item) => item.admission_number === admission.admission_number);
    if (index !== -1) {
        admissionsLists.value[index].audit_requested_at = admission.audit_requested_at;
        // modificar en indexedDB
        await indexedDB.setItem('admissionsLists', admissionsLists.value);
    }
};

const exportAdmissions = async () => {
    console.log(admissionsLists.value);

    const columns = [
        { header: 'Admisión', key: 'admission_number', width: 15 },
        { header: 'Historia', key: 'medical_record_number', with: 15 },
        { header: 'Fecha', key: 'attendance_date', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Médico', key: 'doctor', width: 30 },
        { header: 'Aseguradora', key: 'insurer_name', width: 15 },
        { header: 'Monto', key: 'amount', width: 15, style: { numFmt: '"S/"#,##0.00' } },
        { header: 'Facturador', key: 'biller', width: 15 },
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Fecha Inicio', key: 'start_date', width: 13 },
        { header: 'Fecha Final', key: 'end_date', width: 13 },
        { header: 'Observacion Facturación', key: 'observations', width: 15 },
        { header: 'Entrega Historia', key: 'medical_record_request.status', width: 15 },
        { header: 'Liquidado', key: 'is_closed', width: 15 },
        { header: 'Entrega  Auditoria', key: 'audit_requested_at', width: 15 },
        { header: 'Descripción Auditoria', key: 'audit.description', width: 15 },
        { header: 'Estado Audit', key: 'audit.status', width: 15 },
        { header: 'Factura', key: 'invoice_number', width: 15 },
        { header: 'Fecha Envío', key: 'shipment.verified_shipment_date', width: 15 },
        { header: 'Pago', key: 'paid_invoice_number', width: 15 }
    ];

    const data = admissionsLists.value.map((admission) => {
        return {
            admission_number: admission.admission_number,
            medical_record_number: admission.medical_record_number,
            attendance_date: admission.attendance_date ? dformat(admission.attendance_date, 'DD/MM/YYYY') : '-',
            patient: admission.patient,
            doctor: admission.doctor,
            insurer_name: admission.insurer_name,
            amount: admission.amount,
            biller: admission.biller,
            period: admission.period,
            start_date: admission.start_date ? dformat(admission.start_date, 'DD/MM/YYYY') : '-',
            end_date: admission.end_date ? dformat(admission.end_date, 'DD/MM/YYYY') : '-',
            observations: admission.observations,
            'medical_record_request.status': admission.medical_record_request ? admission.medical_record_request.status : '-',
            is_closed: admission.is_closed ? 'Si' : 'No',
            audit_requested_at: admission.audit_requested_at ? dformat(admission.audit_requested_at, 'DD/MM/YYYY') : '-',
            'audit.description': admission.audit ? admission.audit.description : '-',
            'audit.status': admission.audit ? admission.audit.status : '-',
            invoice_number: admission.invoice_number ? admission.invoice_number : '-',
            'shipment.verified_shipment_date': admission.shipment ? dformat(admission.shipment.verified_shipment_date, 'DD/MM/YYYY') : '-',
            paid_invoice_number: admission.paid_invoice_number ? 'Si' : 'No'
        };
    });
    await exportToExcel(columns, data, 'Admisiones Facturadas', 'Admisiones Facturadas');
};
const searchAdmission = async (number) => {
    console.log(number);

    const response = await admissionsListStore.fetchAdmissionsLists();
    if (!response.success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
        return;
    }

    // comprobar si la admision ya esta en la lista
    const admissionExist = response.data.find((admission) => admission.admission_number === number);

    if (admissionExist) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'La admisión ya se encuentra asignada a una lista ', life: 3000 });
        return;
    }
    // Validacion de numero de admision
    if (number === '' || number === null || number.length <= 5) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Ingrese un número de admisión', life: 3000 });
        return;
    }
    const { success, data } = await admissionsStore.fetchAdmissionByNumberApi(number);
    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    }
    if (data.length === 0 || !data.insurer_name || data.devolution_date === null) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontraró admisión válida', life: 3000 });
        return;
    }
    // data[0].insurer_name quitar espacion antes de comparar

    if (data[0].insurer_name.trim() == 'PARTICULAR') {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Admisión Particular', life: 3000 });
        return;
    }
    console.log(data);

    admission.value.admission_number = data[0].admission_number;
    admission.value.medical_record_number = data[0].medical_record_number;
    admission.value.admissionList.admission_number = data[0].admission_number;
};
const addAdmission = async () => {
    admissionDialog.value = true;

    admission.value = {
        admission_number: '',
        requester_nick: nickName.value,
        medical_record_number: '',
        request_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        remarks: 'Adicional Lista Admisiones periodo : ' + period,
        admissionList: {
            admission_number: '',
            period,
            start_date: startDate.value,
            end_date: endDate.value,
            biller: nickName.value
        }
    };
};
</script>
<template>
    <div class="card">
        <h1 class="mb-2 font-semibold">Gestión admisiones de seguro CSR {{ period }} Fecha Facturación {{ dformat(startDate, 'DD/MM/YYYY') }} al {{ dformat(endDate, 'DD/MM/YYYY') }}</h1>
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
                    <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" />
                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAdmissions()" />
                    <Button type="button" icon="pi pi-plus" label="Admisión" outlined @click="addAdmission()" />
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
    <Dialog v-model:visible="admissionDialog" :style="{ width: '40vw' }" header="Añadir Admisión a Lista" :modal="true" :closable="true">
        <div class="flex flex-col gap-6">
            <div style="display: flex; align-items: center; gap: 0.5rem">
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="admission.admission_number" placeholder="N° Admisión" v-keyfilter.int autofocus />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchAdmission(admission.admission_number)" :loading="admissionsStore.loading" />
            </div>
            <div>
                <label for="name" class="block font-bold mb-3">N° Admisión</label>
                <InputText id="name" v-model.trim="admission.admission_number" required="true" fluid />
            </div>
            <div>
                <label for="name" class="block font-bold mb-3">N° Historia</label>
                <InputText id="name" v-model.trim="admission.medical_record_number" required="true" fluid />
            </div>
        </div>
    </Dialog>
</template>
