<script setup>
import { fetchAdmissionsListsByPeriod } from '@/api';
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAuthStore } from '@/stores/authStore';
import { useMedicalRecordsRequestsStore } from '@/stores/medicalRecordsRequestsStore';
import { getCurrentPeriod, getTotal } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import indexedDB from '@/utils/indexedDB';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const medicalRecordStore = useMedicalRecordsRequestsStore();
const confirm = useConfirm();
const toast = useToast();
const admissionsLists = ref([]);
const authStore = useAuthStore();
const resumenAdmissions = ref([]);
const periods = ref([]);
const nickName = ref();
const filters = ref(null);
const period = ref(null);

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
        // Ordenamos por fecha descendente
        group.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));

        // Filtramos facturas con la fecha más reciente
        const latestDate = group[0].invoice_date;
        const latestInvoices = group.filter((invoice) => invoice.invoice_date === latestDate);

        // Si hay más de dos facturas con la misma fecha, excluimos las que inician con "005-"
        if (latestInvoices.length > 2) {
            return latestInvoices.find((invoice) => !invoice.invoice_number.startsWith('005-')) || latestInvoices[0];
        }

        // Si hay 2 o menos, simplemente tomamos la primera (más reciente)
        return latestInvoices[0];
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

        admission.medical_record_request.isConfirmedReceipt = !!admission.medical_record_request.confirmed_receipt_date;
        admission.medical_record_request.isConfirmedReturn = !!admission.medical_record_request.confirmed_return_date;
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
                medical_record_request: 0,
                totalAmount: 0 // como añado el monto total de amount por biller
            };
        }

        // Actualizar los contadores
        acc[item.biller].total++;
        let amount = parseFloat(item.amount);
        if (amount > 0) {
            acc[item.biller].totalAmount += amount;
        }
        if (item.medical_record_request.status == 'Atendido') acc[item.biller].medical_record_request++;

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
        { header: 'Periodo', key: 'period', width: 15 },
        { header: 'Fecha Inicio', key: 'start_date', width: 13 },
        { header: 'Fecha Final', key: 'end_date', width: 13 },
        { header: 'Observacion Facturación', key: 'observations', width: 15 },
        { header: 'Entrega Historia', key: 'medicalRecordRequestStatus', width: 15 },
        { header: 'Fecha Entrega Historia', key: 'medicalRecordRequestResponseDate', width: 15 },
        { header: 'Liquidado', key: 'is_closed', width: 15 },
        { header: 'Entrega  Auditoria', key: 'audit_requested_at', width: 15 },
        { header: 'Descripción Auditoria', key: 'auditDescription', width: 15 },
        { header: 'Estado Audit', key: 'auditStatus', width: 15 },
        { header: 'Factura', key: 'invoice_number', width: 15 },
        { header: 'Fecha Envío', key: 'shipmentVerifiedShipmentDate', width: 15 },
        { header: 'Pago', key: 'paid_invoice_number', width: 15 }
    ];

    const data = admissionsLists.value.map((admission) => {
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
            period: admission.period,
            start_date: admission.start_date ? dformat(admission.start_date, 'DD/MM/YYYY') : '-',
            end_date: admission.end_date ? dformat(admission.end_date, 'DD/MM/YYYY') : '-',
            observations: admission.observations,
            medicalRecordRequestStatus: admission.medical_record_request ? admission.medical_record_request.status : '-',
            medicalRecordRequestResponseDate: admission.medical_record_request && admission.medical_record_request.response_date ? dformat(admission.medical_record_request.response_date, 'DD/MM/YYYY') : '-',
            is_closed: admission.is_closed ? 'Si' : 'No',
            audit_requested_at: admission.audit_requested_at ? dformatLocal(admission.audit_requested_at, 'DD/MM/YYYY') : '-',
            auditDescription: admission.audit ? admission.audit.description : '-',
            auditStatus: admission.audit ? admission.audit.status : '-',
            invoice_number: admission.invoice_number ? admission.invoice_number : '-',
            shipmentVerifiedShipmentDate: admission.shipment ? dformat(admission.shipment.verified_shipment_date, 'DD/MM/YYYY') : '-',
            paid_invoice_number: admission.paid_invoice_number ? 'Si' : 'No'
        };
    });
    let responseAdmissionsList = await fetchAdmissionsListsByPeriod(period.value);
    // Add new records from responseAdmissionsList.data to data if they don't already exist
    responseAdmissionsList.data.forEach((newAdmission) => {
        const exists = data.some((admission) => admission.admission_number === newAdmission.admission_number);
        if (!exists) {
            data.push({
                admission_number: newAdmission.admission_number,
                medical_record_number: newAdmission.medical_record_number,
                attendance_date: newAdmission.attendance_date ? dformatLocal(newAdmission.attendance_date, 'DD/MM/YYYY') : '-',
                patient: newAdmission.patient,
                doctor: newAdmission.doctor,
                insurer_name: newAdmission.insurer_name,
                amount: newAdmission.amount ? Number(newAdmission.amount) : 0,
                type: newAdmission.type,
                biller: newAdmission.biller,
                period: newAdmission.period,
                start_date: newAdmission.start_date ? dformat(newAdmission.start_date, 'DD/MM/YYYY') : '-',
                end_date: newAdmission.end_date ? dformat(newAdmission.end_date, 'DD/MM/YYYY') : '-',
                observations: newAdmission.observations,
                medicalRecordRequestStatus: newAdmission.medical_record_request ? newAdmission.medical_record_request.status : '-',
                medicalRecordRequestResponseDate: newAdmission.medical_record_request ? dformat(newAdmission.medical_record_request.response_date, 'DD/MM/YYYY') : '-',
                is_closed: newAdmission.is_closed ? 'Si' : 'No',
                audit_requested_at: newAdmission.audit_requested_at ? dformatLocal(newAdmission.audit_requested_at, 'DD/MM/YYYY') : '-',
                auditDescription: newAdmission.audit ? newAdmission.audit.description : '-',
                auditStatus: newAdmission.audit ? newAdmission.audit.status : '-',
                invoice_number: newAdmission.invoice_number ? newAdmission.invoice_number : '-',
                shipmentVerifiedShipmentDate: newAdmission.shipment ? dformat(newAdmission.shipment.verified_shipment_date, 'DD/MM/YYYY') : '-',
                paid_invoice_number: newAdmission.paid_invoice_number ? 'Si' : 'No'
            });
        }
    });
    await exportToExcel(columns, data, 'Admisiones Facturadas', 'Admisiones Facturadas');
};
const editObservation = async (admission) => {
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

const sendMedicalRecord = async (medicalRecord) => {
    let medicalRecordRequest = medicalRecord.medical_record_request;
    let payload = {
        ...medicalRecordRequest,
        status: 'Atendido',
        requested_nick: nickName.value,
        response_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    let responseMedicalRecord = await medicalRecordStore.updateMedicalRecordsRequest(payload);

    if (responseMedicalRecord.success) {
        const index = admissionsLists.value.findIndex((item) => item.admission_number === medicalRecord.admission_number);
        toast.add({ severity: 'info', summary: 'Confirmación', detail: 'Entrega de historia confirmado', life: 3000 });
        if (index !== -1) {
            admissionsLists.value[index].medical_record_request = responseMedicalRecord.data;
            // modificar en indexedDB
            await indexedDB.setItem('admissionsLists', admissionsLists.value);
        } else {
            toast.add({ severity: 'error', summary: 'Cancelar', detail: 'Has cancelado la operación', life: 3000 });
        }
    }
};

const confirmRejectMedicalRecord = (data) => {
    if (!data.observations) {
        toast.add({ severity: 'error', summary: 'Rejected', detail: 'Detallar el motivo del rechazo en el campo OBSERVACIÓN', life: 3000 });
        return;
    }

    confirm.require({
        message: 'Motivo: ' + data.observations,
        header: 'Rechazar Envío Historia',
        icon: 'pi pi-info-circle',
        rejectLabel: 'Cancelar',
        rejectProps: {
            label: 'Cancelar',
            severity: 'secondary',
            outlined: true
        },
        acceptProps: {
            label: 'Rechazar',
            severity: 'danger'
        },
        accept: async () => {
            let medicalRecordRequest = data.medical_record_request;
            let payload = {
                ...medicalRecordRequest,
                status: 'Rechazado',
                remarks: data.observations,
                requested_nick: nickName.value,
                response_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            let responseMedicalRecord = await medicalRecordStore.updateMedicalRecordsRequest(payload);
            if (responseMedicalRecord.success) {
                const index = admissionsLists.value.findIndex((item) => item.admission_number === data.admission_number);
                if (index !== -1) {
                    admissionsLists.value[index].medical_record_request = {
                        ...responseMedicalRecord.data
                    };
                    // modificar en indexedDB
                    await indexedDB.setItem('admissionsLists', admissionsLists.value);
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontró la admisión', life: 3000 });
                }
            }

            toast.add({ severity: 'info', summary: 'Confirmación', detail: 'Entrega de historia rechazado', life: 3000 });
        },
        reject: () => {
            toast.add({ severity: 'error', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
        }
    });
};

const editConfirmedReturn = async (admission) => {
    if (admission.medical_record_request.isConfirmedReturn) {
        //  asignar fecha y hora actual en formato para mysql
        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`;
        admission.medical_record_request.confirmed_return_date = formattedDate;
    } else {
        admission.medical_record_request.confirmed_return_date = null;
    }

    let payload = {
        ...admission.medical_record_request,
        confirmed_return_date: admission.medical_record_request.confirmed_return_date,
        status: 'Devuelto'
    };

    admission.medical_record_request.status = 'Devuelto';
    let responseMedicalRecord = await medicalRecordStore.updateMedicalRecordsRequest(payload);

    if (responseMedicalRecord.success) {
        let index = admissionsLists.value.findIndex((item) => item.admission_number === admission.admission_number);
        if (index !== -1) {
            admissionsLists.value[index].medical_record_request = admission.medical_record_request;
            // modificar en indexedDB
            await indexedDB.setItem('admissionsLists', admissionsLists.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Confirmación de devolución de historia ' + admission.medical_record_number + ' actualizada correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontró la solicitud de historia', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar la solicitud de historia', life: 3000 });
    }
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <DataTable :value="resumenAdmissions" tableStyle="min-width: 30rem" size="small" :style="{ fontSize: '12px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="biller" header="Facturador">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">TOTAL</strong>
                        </template>
                    </Column>
                    <Column field="total" header="Total">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">{{ getTotal(resumenAdmissions, 'total') }}</strong>
                        </template>
                    </Column>
                    <Column field="totalAmount" header="Monto">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.totalAmount) }}
                        </template>
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ formatCurrency(getTotal(resumenAdmissions, 'totalAmount')) }}</strong>
                        </template>
                    </Column>
                    <Column field="medical_record_request" header="Entreg.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">{{ getTotal(resumenAdmissions, 'medical_record_request') }}</strong>
                        </template>
                    </Column>
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
            :globalFilterFields="['number', 'attendance_date', 'doctor', 'insurer_name', 'invoice_number', 'biller', 'amount', 'patient', 'period', 'start_date', 'end_date', 'medical_record_number', 'status']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} admisiones"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión admisiones de seguro CSR</h1>

                    <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" />
                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAdmissions()" />
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
            <Column field="observations" header="Observación" sortable style="min-width: 10rem">
                <template #body="slotProps">
                    {{ slotProps.data.observations || '-' }}
                </template>
                <template #editor="slotProps">
                    <InputText v-model="slotProps.data.observations" @blur="editObservation(slotProps.data)" />
                </template>
            </Column>
            <Column field="medical_record_request.response_date" header="Fecha Entr." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request.response_date">
                        <span class="text-green-500">{{ dformatLocal(slotProps.data.medical_record_request.response_date, 'DD/MM') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>

            <Column field="medical_record_request.isConfirmedReceipt" header="Confirm. Entr." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request.response_date">
                        <Checkbox :disabled="slotProps.data.isConfirmedReceipt || nickName !== slotProps.data.requester_nick" v-model="slotProps.data.medical_record_request.isConfirmedReceipt" binary />
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="medical_record_request.isConfirmedReturn" header="Confirm. Dev. Exp." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request.confirmed_receipt_date">
                        <Checkbox :disabled="slotProps.data.medical_record_request.isConfirmedReturn" v-model="slotProps.data.medical_record_request.isConfirmedReturn" binary @blur="editConfirmedReturn(slotProps.data)" />
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="medical_record_request.status" header="Entr. Estado" sortable="">
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request">
                        <i
                            :class="{
                                'pi pi-check-circle text-green-500': slotProps.data.medical_record_request.status === 'Atendido',
                                'pi pi-clock text-yellow-500': slotProps.data.medical_record_request.status === 'Pendiente',
                                'pi pi-times-circle text-red-500': slotProps.data.medical_record_request.status === 'Rechazado',
                                'pi pi-replay text-blue-500': slotProps.data.medical_record_request.status === 'Devuelto'
                            }"
                        ></i>
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
            <Column field="status" header="Estado" sortable></Column>
            <Column field="actions" header="Envío Fact" style="width: 8rem">
                <template #body="slotProps">
                    <span v-if="slotProps.data.medical_record_request.status == 'Pendiente'" class="flex gap-2">
                        <Button type="button" icon="pi pi-send" class="p-button-rounded p-button-outlined p-button-sm" @click="sendMedicalRecord(slotProps.data)" />
                        <Button type="button" icon="pi pi-times" class="p-button-rounded p-button-danger p-button-outlined p-button-sm" @click="confirmRejectMedicalRecord(slotProps.data)" />
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
