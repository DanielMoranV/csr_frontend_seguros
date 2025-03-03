<script setup>
import { useLayout } from '@/layout/composables/layout';
import { useAdmissionsListsStore } from '@/stores/admissionsListsStore';
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useShipmentsStore } from '@/stores/shipmentsStore';
import { getCurrentPeriod, getMesEnEspanol, getMonth } from '@/utils/dataProcessingHelpers';
import { dformat, dformatLocal, getDaysPassed } from '@/utils/day';
import Chart from 'primevue/chart';

import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

const { getPrimary, getSurface, isDarkTheme } = useLayout();

const admissionsStore = useAdmissionsStore();
const admissionsListStore = useAdmissionsListsStore();
const devolutionsStore = useDevolutionsStore();
const insurersStore = useInsurersStore();
const shipmentsStore = useShipmentsStore();
const toast = useToast();

const companiesMap = {
    'PETROLEOS DEL PERU PETROPERU S.A.': 'PETROPERU',
    'SISTEMAS ALTERNATIVOS DE BENEFICIOS S.A.': 'SABSA',
    'MAPFRE PERU COMPAÑIA DE SEGUROS Y REASEGUROS S.A.': 'MAPFRE PP',
    'LA POSITIVA SEGUROS Y REASEGUROS S.A.A.': 'LA POSITIVA PP',
    'RIMAC S.A. ENTIDAD PRESTADORA DE SALUD': 'RIMAC EPS',
    'PACIFICO S.A. ENT. PRESTADORA DE SALUD': 'PACIFICO EPS',
    'LA POSITIVA S.A. ENTIDAD PRESTADORA DE SALUD': 'LA POSITIVA EPS',
    'ONCOSALUD S.A.C.': 'ONCOSALUD',
    'RIMAC SEGUROS Y REASEGUROS S.A.': 'RIMAC PP',
    'SANITAS PERU S.A. - EPS': 'SANITAS EPS',
    'PACIFICO COMPAÑIA DE SEGUROS Y REASEGUROS S.A.': 'PACIFICO',
    'FONDO DE EMPLEADOS DEL BANCO DE LA NACION': 'FEBAN',
    'MAPFRE PERU S.A. ENTIDAD PRESTADORA DE SALUD': 'MAPFRE EPS',
    'IMPULSA365 S.A.C.': 'IMPULSA365',
    'CHUBB PERU S.A. COMPAÑIA DE SEGUROS Y REASEGUROS': 'CHUBB',
    'AFOCAT - PIURA': 'AFOCAT PIURA',
    'AFOCAT-TRANS - REGION PIURA': 'AFOCAT TRANS',
    'RIMAC SEGUROS Y REASEGUROS - ST': 'RIMAC PP ST',
    'HEALTH CARE ADMINISTRATION RED SALUD S.A.C.': 'RED SALUD',
    'PROTECTA SECURITY ACCIDENTES PERSONALES': 'PROTECTA',
    'PACIENTES PARTICULARES': 'PARTICULARES'
};

const shipments = ref([]);
const admissions = ref([]);
const devolutions = ref([]);
const admissionsLists = ref([]);
const admissionsPaid = ref({
    paid: 0,
    pending: 0
});
const admissionsPaidSoles = ref({
    paid: 0,
    pending: 0
});
const paidSet = ref([]);
const insurers = ref([]);
const loadingData = ref(false);
const invoicedData = ref([]);
const pendingData = ref([]);
const insurersDataSet = ref([]);
const insurersDataSetSoles = ref([]);
const auditorsList = ref(new Set());
const auditorsDataSet = ref([]);
const auditorsDataSetSoles = ref([]);
const billersList = ref(new Set());
const billersDataSet = ref([]);
const billersDataSetSoles = ref([]);

const isCostView = ref(false);
const invoiceStatusDataSoles = ref({ invoicedData: [], pendingData: [] });

const starDate = ref(new Date(new Date().getFullYear(), 0, 1));
const endDate = ref(new Date());
const period = ref(null);
const totalAdmissions = ref(0);
const totalPeriodAdmissions = ref(0);

const invoiceStatusData = ref({
    months: [],
    invoicedData: [],
    pendingData: []
});

period.value = getCurrentPeriod();

const chartData = ref(null);
const chartOptions = ref(null);
const chartOptionsInsurers = ref(null);
const chartDataInsurers = ref(null);
const chartDataPaid = ref(null);
const chartOptionsPaid = ref(null);
const chartDataAuditors = ref(null);
const chartOptionsAuditors = ref(null);
const chartDataBillers = ref(null);
const chartOptionsBillers = ref(null);

const loadData = async () => {
    loadingData.value = true;

    insurers.value = await insurersStore.initializeStore();

    console.log('insurers', insurers.value);
    let payloadAdmissions = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    admissions.value = await admissionsStore.initializeStoreAdmissionsDateRangeApiDashboard(payloadAdmissions);
    console.log('Admisiones', admissions.value);

    admissionsLists.value = await admissionsListStore.initializeStoreByPeriod(period.value);
    loadingData.value = false;

    console.log('Listas', admissionsLists.value);
};

const processAdmissions = async (data) => {
    // Reiniciar variables reactivas antes de procesar nuevos datos
    admissions.value = [];
    insurersDataSet.value = [];
    insurersDataSetSoles.value = [];
    invoiceStatusData.value = { pendingData: {}, invoicedData: {}, months: [] };
    invoiceStatusDataSoles.value = { pendingData: {}, invoicedData: {} };
    admissionsPaid.value = { paid: 0, pending: 0 };
    admissionsPaidSoles.value = { paid: 0, pending: 0 };

    // Agrupar por número de admisión
    const groupedAdmissions = new Map();
    data.forEach((admission) => {
        if (!groupedAdmissions.has(admission.number)) {
            groupedAdmissions.set(admission.number, []);
        }
        groupedAdmissions.get(admission.number).push(admission);
    });

    // Obtener el registro con la fecha de factura más reciente para cada grupo
    const uniqueAdmissions = Array.from(groupedAdmissions.values()).map((group) => {
        group.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
        const latestDate = group[0].invoice_date;
        const latestInvoices = group.filter((inv) => inv.invoice_date === latestDate);

        if (latestInvoices.length > 2) {
            return latestInvoices.find((inv) => !inv.invoice_number.startsWith('005-') && !inv.invoice_number.startsWith('006-')) || latestInvoices[0];
        }
        return latestInvoices[0];
    });

    // Obtener los periodos de envío de las aseguradoras y envíos verificados
    const shippingPeriods = new Map(insurers.value.map((insurer) => [insurer.name.trim().toLowerCase(), insurer.shipping_period]));
    const shipmentsData = new Map(shipments.value.map((shipment) => [shipment.invoice_number, shipment]));

    let months = new Set();

    uniqueAdmissions.forEach((admission) => {
        let daysPassed = getDaysPassed(admission.attendance_date);
        admission.daysPassed = daysPassed;
        admission.month = Number(getMonth(admission.attendance_date));
        months.add(admission.month);

        // Actualizar aseguradoras por mes
        updateInsurersData(insurersDataSet.value, admission);
        updateInsurersData(insurersDataSetSoles.value, admission, true);

        // Determinar estado del invoice
        admission.status = determineInvoiceStatus(admission, shipmentsData);
        admission.shipping_period = shippingPeriods.get(admission.insurer_name.trim().toLowerCase()) || null;

        updateInvoiceMetrics(admission, daysPassed);
        updateAdmissionsPaid(admission);
    });

    // Completar los meses que no existen en invoiceStatusData
    months.forEach((month) => {
        invoiceStatusData.value.pendingData[month] ??= 0;
        invoiceStatusDataSoles.value.pendingData[month] ??= 0;
        invoiceStatusData.value.invoicedData[month] ??= 0;
        invoiceStatusDataSoles.value.invoicedData[month] ??= 0;
    });

    // Ordenar los meses de admisiones
    invoiceStatusData.value.months = [...months].sort((a, b) => a - b).map(getMesEnEspanol);
    totalAdmissions.value = uniqueAdmissions.length;

    // Ordenar aseguradoras por mes y cantidad
    insurersDataSet.value.sort(sortByMonthAndCount);
    insurersDataSetSoles.value.sort((a, b) => a.month - b.month);
};

// Función auxiliar para actualizar datos de aseguradoras
const updateInsurersData = (dataSet, admission, isAmount = false) => {
    let existingEntry = dataSet.find((item) => item.insurance === admission.insurer_name && item.month === admission.month);
    if (existingEntry) {
        existingEntry.count += isAmount ? parseFloat(admission.amount) || 0 : 1;
    } else {
        dataSet.push({
            insurance: admission.insurer_name,
            month: admission.month,
            count: isAmount ? parseFloat(admission.amount) || 0 : 1
        });
    }
};

// Determinar estado de la admisión
const determineInvoiceStatus = (admission, shipmentsData) => {
    if (!admission.invoice_number || admission.invoice_number.startsWith('005-') || admission.invoice_number.startsWith('006-')) {
        return 'Pendiente';
    }
    if (admission.devolution_date && !admission.paid_invoice_number) return 'Devolución';
    if (admission.paid_invoice_number) return 'Pagado';
    if (shipmentsData.has(admission.invoice_number) && shipmentsData.get(admission.invoice_number).verified_shipment_date) {
        return 'Enviado';
    }
    return 'Liquidado';
};

// Actualizar métricas de invoices
const updateInvoiceMetrics = (admission, daysPassed) => {
    let month = admission.month;
    let amount = parseFloat(admission.amount) || 0;

    if (admission.status === 'Pendiente') {
        invoiceStatusData.value.pendingData[month] = (invoiceStatusData.value.pendingData[month] ?? 0) + 1;
        invoiceStatusDataSoles.value.pendingData[month] = (invoiceStatusDataSoles.value.pendingData[month] ?? 0) + amount;
        admission.daysPassed = daysPassed <= admission.shipping_period ? daysPassed : `Extemp. (${daysPassed - admission.shipping_period} d.)`;
    } else {
        invoiceStatusData.value.invoicedData[month] = (invoiceStatusData.value.invoicedData[month] ?? 0) + 1;
        invoiceStatusDataSoles.value.invoicedData[month] = (invoiceStatusDataSoles.value.invoicedData[month] ?? 0) + amount;
    }
};

// Actualizar métricas de admisiones pagadas
const updateAdmissionsPaid = (admission) => {
    let amount = parseFloat(admission.amount) || 0;
    if (!admission.paid_invoice_number && admission.invoice_number && !admission.invoice_number.startsWith('005-') && !admission.invoice_number.startsWith('006-')) {
        admissionsPaidSoles.value.pending += amount;
        admissionsPaid.value.pending++;
    } else if (admission.paid_invoice_number) {
        admissionsPaidSoles.value.paid += amount;
        admissionsPaid.value.paid++;
    }
};

// Función para ordenar aseguradoras por mes y cantidad
const sortByMonthAndCount = (a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return b.count - a.count;
};

// Actualizar métricas de auditores usando Map para eficiencia O(1)
const updateAuditorsData = (dataSet, admission, isAmount = false) => {
    const key = `${admission.audit.auditor}-${admission.statusAuditor}`;
    if (!dataSet.has(key)) {
        dataSet.set(key, {
            auditor: admission.audit.auditor,
            status: admission.statusAuditor,
            count: 0
        });
    }
    dataSet.get(key).count += isAmount ? parseFloat(admission.amount) || 0 : 1;
};

const updateBillersData = (dataSet, admission, isAmount = false) => {
    const key = `${admission.biller}-${admission.statusBiller}`;
    if (!dataSet.has(key)) {
        dataSet.set(key, {
            biller: admission.biller,
            status: admission.statusBiller,
            count: 0
        });
    }
    dataSet.get(key).count += isAmount ? parseFloat(admission.amount) || 0 : 1;
};

const processAdmissionsLists = async (data) => {
    if (!data.length) {
        admissionsLists.value = [];
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron admisiones para el periodo seleccionado.',
            life: 5000
        });
        return [];
    }

    // // Reiniciar variables reactivas
    auditorsDataSet.value = [];
    auditorsDataSetSoles.value = [];
    auditorsList.value = new Set();

    billersDataSet.value = [];
    billersDataSetSoles.value = [];
    billersList.value = new Set();

    // Agrupar admisiones por número
    const groupedAdmissions = data.reduce((acc, admission) => {
        (acc[admission.number] ||= []).push(admission);
        return acc;
    }, {});

    // Seleccionar la admisión con la factura más reciente
    const uniqueAdmissions = Object.values(groupedAdmissions).map((group) => {
        // Ordenar y tomar la primera (más reciente)
        group.sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
        const latestInvoices = group.filter(({ invoice_date }) => invoice_date === group[0].invoice_date);

        // Si hay más de dos, eliminar las que inician con "005-" o "006-"
        return latestInvoices.length > 2 ? latestInvoices.find(({ invoice_number }) => !/^00[56]-/.test(invoice_number)) || latestInvoices[0] : latestInvoices[0];
    });

    const auditorsSet = new Set();
    const auditorsData = new Map();
    const auditorsDataSoles = new Map();

    const billersSet = new Set();
    const billersData = new Map();
    const billersDataSoles = new Map();

    uniqueAdmissions.forEach((admission) => {
        // Normalizar invoice_number
        if (/^00[56]-/.test(admission.invoice_number)) admission.invoice_number = '';

        // Determinar si es una devolución
        admission.isDevolution = admission.devolution_date && admission.devolution_invoice_number === admission.invoice_number;

        // Obtener auditor y actualizar métricas
        if (admission.audit) {
            auditorsSet.add(admission.audit.auditor);
            auditorsList.value.add(admission.audit.auditor);

            admission.statusAuditor = admission.paid_invoice_number ? 'PAGADO' : admission.isDevolution ? 'DEVOLUCION' : 'AUDITADO';

            console.log('Admision', admission);

            updateAuditorsData(auditorsData, admission);
            updateAuditorsData(auditorsDataSoles, admission, true);
        }

        if (admission.biller) {
            billersSet.add(admission.biller);
            billersList.value.add(admission.biller);
            if (admission.invoice_number) {
                // Determinar el estado de la factura en orden de prioridad
                if (admission.paid_invoice_number) {
                    admission.statusBiller = 'PAGADO';
                } else if (admission.isDevolution) {
                    admission.statusBiller = 'DEVOLUCION';
                } else if (admission.shipment?.verified_shipment_date) {
                    admission.statusBiller = 'ENVIADO';
                } else {
                    admission.statusBiller = 'FACTURADO';
                }

                updateBillersData(billersData, admission);
                updateBillersData(billersDataSoles, admission, true);
            }
        }

        // Determinar estado del biller
    });

    // Convertir Map a array y ordenar auditores
    auditorsDataSet.value = Array.from(auditorsData.values()).sort((a, b) => a.auditor.localeCompare(b.auditor));
    auditorsDataSetSoles.value = Array.from(auditorsDataSoles.values()).sort((a, b) => a.auditor.localeCompare(b.auditor));

    billersDataSet.value = Array.from(billersData.values()).sort((a, b) => a.biller.localeCompare(b.biller));
    billersDataSetSoles.value = Array.from(billersDataSoles.values()).sort((a, b) => a.biller.localeCompare(b.biller));

    admissionsLists.value = uniqueAdmissions;
    totalPeriodAdmissions.value = admissionsLists.value.length;
};

onMounted(async () => {
    await loadData();
    await processAdmissions(admissions.value);
    await processAdmissionsLists(admissionsLists.value);

    invoicedData.value = Object.values(sortMonths(invoiceStatusData.value.invoicedData));
    pendingData.value = Object.values(sortMonths(invoiceStatusData.value.pendingData));

    paidSet.value = [admissionsPaid.value.paid, admissionsPaid.value.pending];
    chartDataPaid.value = setChartDataPaid();
    chartOptionsPaid.value = setChartOptionsPaid();

    chartData.value = setChartData();
    chartOptions.value = setChartOptions();

    chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
    chartOptionsInsurers.value = setChartOptionsInsurers();

    chartDataAuditors.value = setChartDataAuditors(auditorsDataSet.value);
    chartOptionsAuditors.value = setChartOptionsAuditors();

    chartDataBillers.value = setChartDataBillers(billersDataSet.value);
    chartOptionsBillers.value = setChartOptionsBillers();
});

const searchAdmissionsByDate = async () => {
    loadingData.value = true;
    let payload = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    const { success, data } = await admissionsStore.fetchAdmissionsDateRangeApiDashboard(payload);

    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
        loadingData.value = false;
        return;
    }

    invoiceStatusData.value = {
        months: [],
        invoicedData: [],
        pendingData: []
    };
    invoiceStatusDataSoles.value = {
        months: [],
        invoicedData: [],
        pendingData: []
    };
    admissionsPaid.value = {
        paid: 0,
        pending: 0
    };

    await processAdmissions(data);
    invoicedData.value = Object.values(sortMonths(invoiceStatusData.value.invoicedData));
    pendingData.value = Object.values(sortMonths(invoiceStatusData.value.pendingData));

    // Facturas pagadas
    paidSet.value = [admissionsPaid.value.paid, admissionsPaid.value.pending];
    chartDataPaid.value = setChartDataPaid();
    chartOptionsPaid.value = setChartOptionsPaid();

    // Facturas liquidadas y pendientes
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();

    // Grafico de admisiones por seguros
    chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
    chartOptionsInsurers.value = setChartOptionsInsurers();

    loadingData.value = false;
};

const searchPeriod = async () => {
    loadingData.value = true;
    const { success, data } = await admissionsListStore.fetchAdmissionsListsByPeriod(period.value);

    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
        return;
    }

    await processAdmissionsLists(data);
    chartDataAuditors.value = setChartDataAuditors(auditorsDataSet.value);
    chartOptionsAuditors.value = setChartOptionsAuditors();
    chartDataBillers.value = setChartDataBillers(billersDataSet.value);
    chartOptionsBillers.value = setChartOptionsBillers();

    loadingData.value = false;
};
const toggleView = () => {
    isCostView.value = !isCostView.value;
    // Aquí puedes cambiar los datos del gráfico según la vista seleccionada
    updateChartData();
};

const sortMonths = (data) => {
    return Object.fromEntries(Object.entries(data).sort(([a], [b]) => parseInt(a) - parseInt(b)));
};
const updateChartData = () => {
    if (isCostView.value) {
        invoicedData.value = Object.values(sortMonths(invoiceStatusDataSoles.value.invoicedData));
        pendingData.value = Object.values(sortMonths(invoiceStatusDataSoles.value.pendingData));
        chartDataInsurers.value = setChartDataInsurers(insurersDataSetSoles.value);
        paidSet.value = [admissionsPaidSoles.value.paid, admissionsPaidSoles.value.pending];
        chartDataPaid.value = setChartDataPaid();
        chartOptionsPaid.value = setChartOptionsPaid();

        chartDataAuditors.value = setChartDataAuditors(auditorsDataSetSoles.value);
        chartOptionsAuditors.value = setChartOptionsAuditors();
        chartDataBillers.value = setChartDataBillers(billersDataSetSoles.value);
        chartOptionsBillers.value = setChartOptionsBillers();
    } else {
        invoicedData.value = Object.values(sortMonths(invoiceStatusData.value.invoicedData));
        pendingData.value = Object.values(sortMonths(invoiceStatusData.value.pendingData));
        chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
        paidSet.value = [admissionsPaid.value.paid, admissionsPaid.value.pending];
        chartDataPaid.value = setChartDataPaid();
        chartOptionsPaid.value = setChartOptionsPaid();

        chartDataAuditors.value = setChartDataAuditors(auditorsDataSet.value);
        chartOptionsAuditors.value = setChartOptionsAuditors();
        chartDataBillers.value = setChartDataBillers(billersDataSet.value);
        chartOptionsBillers.value = setChartOptionsBillers();
    }
    chartData.value = setChartData();
};

function setChartDataPaid() {
    const documentStyle = getComputedStyle(document.body);

    return {
        labels: ['Pagado', 'Pendiente'],
        datasets: [
            {
                data: paidSet.value,
                backgroundColor: [documentStyle.getPropertyValue('--p-cyan-500'), documentStyle.getPropertyValue('--p-gray-500'), documentStyle.getPropertyValue('--p-gray-500')],
                hoverBackgroundColor: [documentStyle.getPropertyValue('--p-cyan-400'), documentStyle.getPropertyValue('--p-gray-400'), documentStyle.getPropertyValue('--p-gray-400')]
            }
        ]
    };
}
function setChartOptionsPaid() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');

    return {
        plugins: {
            legend: {
                labels: {
                    usePointStyle: true,
                    color: textColor
                }
            }
        }
    };
}
function setChartData() {
    // Función para ordenar los meses numéricamente

    // Ordenar invoicedData

    const documentStyle = getComputedStyle(document.documentElement);

    return {
        labels: invoiceStatusData.value.months,
        datasets: [
            {
                label: 'Facturadas',
                backgroundColor: documentStyle.getPropertyValue('--p-cyan-500'),
                borderColor: documentStyle.getPropertyValue('--p-cyan-500'),
                data: invoicedData.value
            },
            {
                label: 'Pendientes',
                backgroundColor: documentStyle.getPropertyValue('--p-gray-500'),
                borderColor: documentStyle.getPropertyValue('--p-gray-500'),
                data: pendingData.value
            }
        ]
    };
}

function setChartOptions() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary,
                    font: {
                        weight: 500
                    }
                },
                grid: {
                    display: false,
                    drawBorder: false
                }
            },
            y: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            }
        }
    };
}

function setChartDataInsurers(dataSet) {
    const colorList = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#E6194B',
        '#3CB44B',
        '#FFE119',
        '#0082C8',
        '#F58231',
        '#911EB4',
        '#46F0F0',
        '#F032E6',
        '#D2F53C',
        '#FABEBE',
        '#008080',
        '#E6BEFF',
        '#AA6E28',
        '#800000',
        '#A9A9A9'
    ];
    const groupedData = {};
    dataSet.forEach(({ insurance, month, count }) => {
        if (!groupedData[insurance]) {
            groupedData[insurance] = Array(12).fill(0); // Inicializar con 0 para los 12 meses
        }
        const monthIndex = month - 1; // Convertir el número de mes a índice de array (1 → 0, 2 → 1, ..., 12 → 11)
        groupedData[insurance][monthIndex] = count;
    });

    const datasets = Object.keys(groupedData).map((insurance, index) => ({
        label: companiesMap[insurance],
        backgroundColor: colorList[index % colorList.length],
        data: groupedData[insurance],
        type: 'bar'
    }));

    // Calcular el total por mes sumando los valores de todas las aseguradoras
    const totalPerMonth = Array(12).fill(0);
    Object.values(groupedData).forEach((counts) => {
        counts.forEach((value, i) => {
            totalPerMonth[i] += value;
        });
    });

    // Agregar un dataset adicional para el total
    datasets.push({
        label: 'Total',
        data: totalPerMonth,
        type: 'line', // Usamos una línea para diferenciarla de las barras
        borderColor: '#333333',
        backgroundColor: '#333333',
        borderWidth: 2,
        fill: false,
        tension: 0.3, // Suaviza la línea
        yAxisID: 'y' // Asegúrate de que esté en el mismo eje o crea un eje separado si lo prefieres
    });

    return {
        labels: invoiceStatusData.value.months,
        datasets
    };
}

function setChartOptionsInsurers() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            tooltip: {
                mode: 'nearest',
                intersect: true
            },
            legend: {
                labels: {
                    color: textColor
                }
            },
            title: {
                display: true,
                text: 'Estado de Facturación Según Aseguradora'
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x', // Permite desplazar horizontalmente
                    modifierKey: 'ctrl' // Opcional, para que el pan solo se active al presionar Ctrl
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x' // Permite hacer zoom horizontalmente. Puedes usar 'y' o 'xy' según necesites.
                }
            }
        },
        responsive: true,
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            },
            y: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            }
        }
    };
}

function setChartDataAuditors(data) {
    const colorList = ['#00B294', '#FFD740', '#FF6F61'];

    // Convertir el Set en array
    let auditors = Array.from(auditorsList.value);

    // Inicializar estructura para agrupar datos
    const groupedData = {};
    data.forEach(({ auditor, status, count }) => {
        if (!groupedData[status]) {
            // Inicializar en 0 para todos los auditores
            groupedData[status] = Array(auditors.length).fill(0);
        }

        // Obtener el índice del auditor en la lista
        const auditorIndex = auditors.indexOf(auditor);
        if (auditorIndex !== -1) {
            groupedData[status][auditorIndex] = count;
        }
    });

    // Construir datasets para el gráfico
    const datasets = Object.keys(groupedData).map((status, index) => ({
        label: status,
        backgroundColor: colorList[index % colorList.length],
        data: groupedData[status],
        type: 'bar'
    }));

    // Calcular totales por auditor
    const totalPerAuditor = Array(auditors.length).fill(0);
    Object.values(groupedData).forEach((counts) => {
        counts.forEach((value, i) => {
            totalPerAuditor[i] += value; // Sumar correctamente los valores
        });
    });

    // Agregar dataset para la línea de totales
    datasets.push({
        label: 'Total',
        data: totalPerAuditor,
        type: 'line',
        borderColor: '#333333',
        backgroundColor: '#333333',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        yAxisID: 'y'
    });

    return {
        labels: auditors,
        datasets
    };
}

function setChartOptionsAuditors() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            },
            title: {
                display: true,
                text: 'Estado de Auditoria Médicas'
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x', // Permite desplazar horizontalmente
                    modifierKey: 'ctrl' // Opcional, para que el pan solo se active al presionar Ctrl
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x' // Permite hacer zoom horizontalmente. Puedes usar 'y' o 'xy' según necesites.
                }
            }
        },
        responsive: true,
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            },
            y: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            }
        }
    };
}

function setChartDataBillers(dataSet) {
    const colorList = [
        '#00B294',
        '#FFD740',
        '#3CB44B',
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#E6194B',
        '#FFE119',
        '#0082C8',
        '#F58231',
        '#911EB4',
        '#46F0F0',
        '#F032E6',
        '#D2F53C',
        '#FABEBE',
        '#008080',
        '#E6BEFF',
        '#AA6E28',
        '#800000',
        '#A9A9A9'
    ];

    // Convertir el Set en array
    let billers = Array.from(billersList.value);

    // Inicializar estructura para agrupar datos
    const groupedData = {};
    dataSet.forEach(({ biller, status, count }) => {
        if (!groupedData[status]) {
            // Inicializar en 0 para todos los billers
            groupedData[status] = Array(billers.length).fill(0);
        }

        // Obtener el índice del biller en la lista
        const billerIndex = billers.indexOf(biller);
        if (billerIndex !== -1) {
            groupedData[status][billerIndex] = count;
        }
    });

    // Construir datasets para el gráfico
    const datasets = Object.keys(groupedData).map((status, index) => ({
        label: status,
        backgroundColor: colorList[index % colorList.length],
        data: groupedData[status],
        type: 'bar'
    }));

    // Calcular totales por biller
    const totalPerBiller = Array(billers.length).fill(0);
    Object.values(groupedData).forEach((counts) => {
        counts.forEach((value, i) => {
            totalPerBiller[i] += value; // Sumar correctamente los valores
        });
    });

    // Agregar dataset para la línea de totales
    datasets.push({
        label: 'Total',
        data: totalPerBiller,
        type: 'line',
        borderColor: '#333333',
        backgroundColor: '#333333',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        yAxisID: 'y'
    });

    return {
        labels: billers,
        datasets
    };
}

function setChartOptionsBillers() {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            },
            title: {
                display: true,
                text: 'Estado de Facturación'
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x', // Permite desplazar horizontalmente
                    modifierKey: 'ctrl' // Opcional, para que el pan solo se active al presionar Ctrl
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x' // Permite hacer zoom horizontalmente. Puedes usar 'y' o 'xy' según necesites.
                }
            }
        },
        responsive: true,
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            },
            y: {
                stacked: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            }
        }
    };
}

watch([getPrimary, getSurface, isDarkTheme], () => {
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
    chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
    chartOptionsInsurers.value = setChartOptionsInsurers();
    chartDataPaid.value = setChartDataPaid();
    chartOptionsPaid.value = setChartOptionsPaid();
});
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <!-- Dashboard General -->
        <div class="col-span-12 xl:col-span-6 flex">
            <Card class="shadow-md flex flex-col w-full">
                <template #content>
                    <div class="flex items-center gap-3 mb-3">
                        <Avatar icon="pi pi-chart-bar" shape="circle" class="bg-cyan-500 text-white" />
                        <div>
                            <h1 class="text-xl font-semibold text-gray-800">Dashboard General</h1>
                            <p class="text-gray-500 text-sm">Resumen de admisiones de seguros</p>
                        </div>
                    </div>

                    <div class="p-4 bg-gray-100 rounded-lg shadow-md flex-1">
                        <template v-if="loadingData">
                            <div class="flex justify-center items-center h-32">
                                <i class="pi pi-spin pi-spinner text-4xl text-gray-500"></i>
                            </div>
                        </template>
                        <template v-else>
                            <p class="text-gray-700 flex items-center gap-2">
                                <i class="pi pi-calendar text-blue-500"></i>
                                <strong> Período de Facturación:</strong> <span class="text-gray-900">{{ period || 'N/A' }}</span>
                            </p>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                <p class="text-gray-700 flex items-center gap-2">
                                    <i class="pi pi-clock text-green-500"></i>
                                    <strong> Desde:</strong> <span class="text-gray-900">{{ dformatLocal(starDate, 'DD/MM/YYYY') }}</span>
                                </p>
                                <p class="text-gray-700 flex items-center gap-2">
                                    <i class="pi pi-clock text-red-500"></i>
                                    <strong> Hasta:</strong> <span class="text-gray-900">{{ dformatLocal(endDate, 'DD/MM/YYYY') }}</span>
                                </p>
                            </div>

                            <div class="mt-4 p-3 bg-white rounded-lg shadow-sm">
                                <p class="text-gray-700 flex items-center gap-2">
                                    <i class="pi pi-chart-line text-purple-500"></i>
                                    <strong> Admisiones Generadas:</strong>
                                    <span class="text-gray-900">{{ totalAdmissions || 'N/A' }}</span>
                                </p>
                                <p class="text-gray-700 flex items-center gap-2 mt-2">
                                    <i class="pi pi-chart-pie text-orange-500"></i>
                                    <strong> Asignadas a Periodo: </strong>
                                    <span class="text-gray-900">{{ totalPeriodAdmissions || 'N/A' }}</span>
                                </p>
                            </div>
                        </template>
                    </div>

                    <p class="text-gray-500 text-sm mt-3">
                        <i class="pi pi-info-circle text-cyan-500"></i>
                        Reporte de <strong>Clínica Santa Rosa Sullana</strong> con información detallada de admisiones.
                    </p>
                </template>
            </Card>
        </div>

        <!-- Configuración -->
        <div class="col-span-12 xl:col-span-6 flex">
            <Card class="shadow-md flex flex-col w-full">
                <template #content>
                    <div class="flex items-center gap-3 mb-3">
                        <Avatar icon="pi pi-cog" shape="circle" class="bg-cyan-500 text-white" />
                        <div>
                            <h1 class="text-xl font-semibold text-gray-800">Configuración</h1>
                            <p class="text-gray-500 text-sm">Filtrar datos según necesidades</p>
                        </div>
                    </div>

                    <!-- Contenedor flexible para mantener misma altura -->
                    <div class="flex-1 flex flex-col justify-between">
                        <!-- Búsqueda por período -->
                        <div class="p-3 bg-gray-100 rounded-lg mb-4 shadow-md">
                            <p class="text-gray-600 mb-2">
                                <i class="pi pi-calendar text-cyan-500"></i>
                                <strong> Análisis de Metas de Facturación</strong>
                            </p>
                            <div class="flex gap-2">
                                <InputText v-model="period" placeholder="Ingrese período (ej. 202501)" class="w-full" />
                                <Button label="Buscar" icon="pi pi-search" class="w-full md:w-auto" @click="searchPeriod" />
                            </div>
                        </div>

                        <!-- Búsqueda por rango de fechas -->
                        <div class="p-3 bg-gray-100 rounded-lg shadow-md">
                            <p class="text-gray-600 mb-2">
                                <i class="pi pi-clock text-cyan-500"></i>
                                <strong> Buscar por Rango de Fechas</strong>
                            </p>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <DatePicker v-model="starDate" placeholder="Fecha inicio" class="w-full" />
                                <DatePicker v-model="endDate" placeholder="Fecha fin" class="w-full" />
                                <Button label="Buscar" icon="pi pi-calendar" class="w-full md:w-auto" @click="searchAdmissionsByDate" />
                            </div>
                        </div>
                    </div>
                </template>
            </Card>
        </div>
        <div class="col-span-12 flex">
            <div class="card shadow-md flex flex-col w-full">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Aseguradoras</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <Chart type="bar" :data="chartDataInsurers" :options="chartOptionsInsurers" class="h-[30rem]" />
            </div>
        </div>
        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Estado de Facturación</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <Chart type="bar" :data="chartData" :options="chartOptions" class="h-[25rem]" />
            </div>
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Seguimiento de Auditorias</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <Chart type="bar" :data="chartDataAuditors" :options="chartOptionsAuditors" class="h-[25rem]" />
            </div>
        </div>

        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Pago de Facturas</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <div class="flex justify-center">
                    <Chart type="pie" :data="chartDataPaid" :options="chartOptionsPaid" class="w-full md:w-[25rem]" />
                </div>
            </div>

            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Seguimiento de Facturadores</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <Chart type="bar" :data="chartDataBillers" :options="chartOptionsBillers" class="h-[25rem]" />
            </div>
        </div>
    </div>
</template>
