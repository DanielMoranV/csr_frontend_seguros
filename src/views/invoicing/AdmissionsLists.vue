<script setup>
import { fetchAdmissionsListsByPeriod } from '@/api';
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { getCurrentPeriod } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import { formatCurrency } from '@/utils/validationUtils';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const admissionsListStore = useAdmissionsListsStore();
const toast = useToast();
const admissionsLists = ref([]);
const resumenAdmissions = ref([]);
const auditors = ref([]);
const periods = ref([]);
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
                audit_requested_at: 0,
                devolutionNotNull: 0,
                totalAmount: 0,
                auditors: {} // Objeto para almacenar el conteo de auditorías por auditor
            };
        }

        // Actualizar los contadores generales
        acc[item.biller].total++;
        let amount = parseFloat(item.amount);
        if (amount > 0) {
            acc[item.biller].totalAmount += amount;
        }
        if (item.is_closed === 1) acc[item.biller].closedTrue++;
        if (item.audit_requested_at !== null) acc[item.biller].audit_requested_at++;
        if (item.paid_invoice_number !== null) acc[item.biller].paidNotNull++;
        if (item.invoice_number !== null && item.invoice_number !== '') acc[item.biller].invoiceNotNull++;
        if (item.audit && item.audit_id !== null && item.audit.status !== 'Pendiente') acc[item.biller].auditNotNull++;
        if (item.medical_record_request.status === 'Atendido') acc[item.biller].medical_record_request++;
        if (item.devolution_date !== null) acc[item.biller].devolutionNotNull++;

        // Procesar los datos del auditor
        if (item.audit && item.audit.auditor && item.audit.status !== 'Pendiente') {
            const auditorNick = item.audit.auditor; // Nickname del auditor
            if (!acc[item.biller].auditors[auditorNick]) {
                // Inicializar el contador del auditor si no existe
                acc[item.biller].auditors[auditorNick] = {
                    name: auditorNick, // Nickname del auditor
                    count: 0 // Conteo inicial de auditorías
                };
            }
            // Incrementar el conteo de auditorías para el auditor correspondiente
            acc[item.biller].auditors[auditorNick].count++;
        }

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
        { header: 'Auditor', key: 'auditor', width: 15 },
        { header: 'Descripción Auditoria', key: 'auditDescription', width: 15 },
        { header: 'Estado Audit', key: 'auditStatus', width: 15 },
        { header: 'Factura', key: 'invoice_number', width: 15 },
        { header: 'Fecha Envío', key: 'shipmentVerifiedShipmentDate', width: 15 },
        { header: 'Pago', key: 'paid_invoice_number', width: 15 }
    ];

    const data = admissionsLists.value.map((admission) => {
        const formatDate = (date) => {
            return date ? dformat(date, 'DD/MM/YYYY') : '-';
        };
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
            medicalRecordRequestResponseDate: admission.medical_record_request ? formatDate(admission.medical_record_request.response_date) : '-',
            is_closed: admission.is_closed ? 'Si' : 'No',
            auditor: admission.audit ? admission.audit.auditor : '-',
            audit_requested_at: admission.audit_requested_at ? dformatLocal(admission.audit_requested_at, 'DD/MM/YYYY') : '-',
            auditDescription: admission.audit ? admission.audit.description : '-',
            auditStatus: admission.audit ? admission.audit.status : '-',
            invoice_number: admission.invoice_number ? admission.invoice_number : '-',
            shipmentVerifiedShipmentDate: admission.shipment && admission.shipment.verified_shipment_date ? dformat(admission.shipment.verified_shipment_date, 'DD/MM/YYYY') : '-',
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
// Función genérica para calcular totales
const getTotal = (field) => {
    return resumenAdmissions.value.reduce((sum, item) => sum + (item[field] || 0), 0);
};

const getTotalAuditsByAuditor = () => {
    const totalsByAuditor = {};

    resumenAdmissions.value.forEach((item) => {
        const auditors = item.auditors || {};
        Object.entries(auditors).forEach(([key, auditor]) => {
            if (!totalsByAuditor[auditor.name]) {
                totalsByAuditor[auditor.name] = 0;
            }
            totalsByAuditor[auditor.name] += auditor.count;
        });
    });

    return totalsByAuditor;
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <DataTable :value="resumenAdmissions" tableStyle="min-width: 50rem" size="small" :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }" stripedRows>
                    <Column field="biller" header="Facturador">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">TOTAL</strong>
                        </template>
                    </Column>

                    <Column field="total" header="Total">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">{{ getTotal('total') }}</strong>
                        </template>
                    </Column>

                    <Column field="totalAmount" header="Monto">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.totalAmount) }}
                        </template>
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ formatCurrency(getTotal('totalAmount')) }}</strong>
                        </template>
                    </Column>

                    <Column field="medical_record_request" header="Entrg.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic">{{ getTotal('medical_record_request') }}</strong>
                        </template>
                    </Column>

                    <Column field="closedTrue" header="Liquid.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('closedTrue') }}</strong>
                        </template>
                    </Column>

                    <Column field="audit_requested_at" header="Env. Aud.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('audit_requested_at') }}</strong>
                        </template>
                    </Column>

                    <Column field="auditNotNull" header="Audit.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('auditNotNull') }}</strong>
                        </template>
                    </Column>

                    <Column field="invoiceNotNull" header="Factur.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('invoiceNotNull') }}</strong>
                        </template>
                    </Column>

                    <Column field="paidNotNull" header="Pagad.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('paidNotNull') }}</strong>
                        </template>
                    </Column>

                    <Column field="devolutionNotNull" header="Devol.">
                        <template #footer>
                            <strong style="font-weight: bold; font-style: italic"> {{ getTotal('devolutionNotNull') }}</strong>
                        </template>
                    </Column>

                    <!-- Nueva columna para mostrar los auditores -->
                    <Column header="Auditores">
                        <template #body="slotProps">
                            <ul>
                                <li v-for="(auditor, key) in slotProps.data.auditors" :key="key">{{ auditor.name }}: {{ auditor.count }}</li>
                            </ul>
                        </template>
                        <template #footer>
                            <ul>
                                <li v-for="(total, auditor) in getTotalAuditsByAuditor()" :key="auditor">
                                    <strong style="font-weight: bold; font-style: italic"> {{ auditor }}: {{ total }} </strong>
                                </li>
                            </ul>
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
            <Column field="period" sortable header="Periodo"></Column>
            <Column field="start_date" sortable header="Inicio">
                <template #body="slotProps">
                    {{ slotProps.data.start_date ? dformat(slotProps.data.start_date, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
            <Column field="end_date" sortable header="Final">
                <template #body="slotProps">
                    {{ slotProps.data.end_date ? dformat(slotProps.data.end_date, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
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
            <Column field="is_closed" header="Liquid." sortable="">
                <template #body="slotProps">
                    <i
                        :class="{
                            'pi pi-check-circle text-green-500': slotProps.data.is_closed,
                            'pi pi-times-circle text-red-500': !slotProps.data.is_closed
                        }"
                    ></i>
                </template>
            </Column>
            <Column field="audit_requested_at" header="Entr. Audit." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.audit_requested_at">
                        <span class="text-green-500">{{ dformatLocal(slotProps.data.audit_requested_at, 'DD/MM') }}</span>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
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
