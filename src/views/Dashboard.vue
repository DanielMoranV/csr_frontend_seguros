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

const products = ref(null);
const chartData = ref(null);
const chartOptions = ref(null);
const chartOptionsInsurers = ref(null);
const chartDataInsurers = ref(null);
const chartDataPaid = ref(null);
const chartOptionsPaid = ref(null);

const loadData = async () => {
    loadingData.value = true;

    insurers.value = await insurersStore.initializeStore();

    console.log('insurers', insurers.value);
    let payloadAdmissions = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    admissions.value = await admissionsStore.initializeStoreAdmissionsDateRangeApi(payloadAdmissions);
    console.log('Admisiones', admissions.value);

    admissionsLists.value = await admissionsListStore.initializeStoreByPeriod(period.value);
    loadingData.value = false;

    console.log('Listas', admissionsLists.value);
};

const processAdmissions = async (data) => {
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

    // Obtener los periodos de envío de las aseguradoras en un objeto para acceso rápido
    const shippingPeriods = insurers.value.reduce((acc, insurer) => {
        acc[insurer.name.trim().toLowerCase()] = insurer.shipping_period;
        return acc;
    }, {});

    const shipmentsData = shipments.value.reduce((acc, shipment) => {
        acc[shipment.invoice_number] = shipment;
        return acc;
    }, {});

    admissions.value = uniqueAdmissions;
    let months = [];

    admissions.value.forEach((admission) => {
        let daysPassed = getDaysPassed(admission.attendance_date);
        admission.daysPassed = daysPassed;

        // obtener el mes de admision.attendance_date
        const month = Number(getMonth(admission.attendance_date));

        // Asignar el mes de admision.attendance_date a admision.month
        admission.month = month;
        // añadir a invoiceStatusData.months si no existe
        if (!months.includes(month)) {
            months.push(month);
        }

        let insurerDataSet = {
            insurance: admission.insurer_name,
            month: month,
            count: 1
        };
        let insurerDataSetSoles = {
            insurance: admission.insurer_name,
            month: month,
            count: parseFloat(admission.amount) || 0
        };
        if (insurersDataSet.value.find((item) => item.insurance === admission.insurer_name && item.month === month)) {
            insurersDataSet.value.find((item) => item.insurance === admission.insurer_name && item.month === month).count++;

            insurersDataSetSoles.value.find((item) => item.insurance === admission.insurer_name && item.month === month).count += parseFloat(admission.amount);
        } else {
            insurersDataSet.value.push(insurerDataSet);
            insurersDataSetSoles.value.push(insurerDataSetSoles);
        }

        if (admission.invoice_number === null || admission.invoice_number.startsWith('005-')) {
            admission.invoice_number = admission.invoice_number?.startsWith('005-') ? '' : admission.invoice_number;
            admission.status = 'Pendiente';
            admission.biller = '';
        } else if (admission.devolution_date !== null && admission.paid_invoice_number === null) {
            admission.status = 'Devolución';
        } else if (admission.paid_invoice_number !== null) {
            admission.status = 'Pagado';
        } else {
            admission.status = 'Liquidado';
        }

        if (shipmentsData[admission.invoice_number] && shipmentsData[admission.invoice_number]?.verified_shipment_date !== null) {
            admission.status = 'Enviado';
        }

        // Asignar el periodo de envío de la aseguradora a la admisión para mostrarlo en la tabla de admisiones
        admission.shipping_period = shippingPeriods[admission.insurer_name.trim().toLowerCase()];

        if (admission.status === 'Pendiente') {
            // Contar cuantas admisiones pendientes hay en cada mes admision.month
            if (months.includes(admission.month)) {
                invoiceStatusData.value.pendingData[admission.month] = (invoiceStatusData.value.pendingData[admission.month] ?? 0) + 1;

                let amount = parseFloat(admission.amount);
                if (amount > 0) {
                    if (!invoiceStatusDataSoles.value.pendingData[admission.month]) {
                        invoiceStatusDataSoles.value.pendingData[admission.month] = 0;
                    }
                    invoiceStatusDataSoles.value.pendingData[admission.month] = amount;
                }
            }

            admission.daysPassed = daysPassed <= admission.shipping_period ? daysPassed : `Extemp. (${daysPassed - admission.shipping_period} d.)`;
        }

        if (admission.status !== 'Pendiente') {
            if (months.includes(admission.month)) {
                invoiceStatusData.value.invoicedData[admission.month] = (invoiceStatusData.value.invoicedData[admission.month] ?? 0) + 1;

                let amount = parseFloat(admission.amount);

                if (amount > 0) {
                    // Asegurarse de que invoiceStatusDataSoles.value.invoicedData[admission.month] esté inicializado como un número
                    if (!invoiceStatusDataSoles.value.invoicedData[admission.month]) {
                        invoiceStatusDataSoles.value.invoicedData[admission.month] = 0;
                    }
                    // Sumar el monto
                    invoiceStatusDataSoles.value.invoicedData[admission.month] += amount;
                }
            }

            if (admission.paid_invoice_number !== null) {
                admissionsPaidSoles.value.paid += parseFloat(admission.amount) || 0;
            } else {
                admissionsPaidSoles.value.pending += parseFloat(admission.amount) || 0;
            }
        }
    });
    months.forEach((month) => {
        if (!invoiceStatusData.value.pendingData.hasOwnProperty(month)) {
            invoiceStatusData.value.pendingData[month] = 0;
            invoiceStatusDataSoles.value.pendingData[month] = 0;
        }
        if (!invoiceStatusData.value.invoicedData.hasOwnProperty(month)) {
            invoiceStatusData.value.invoicedData[month] = 0;
            invoiceStatusDataSoles.value.invoicedData[month] = 0;
        }
    });

    admissionsPaid.value.paid = admissions.value.filter((admission) => admission.paid_invoice_number !== null).length;
    admissionsPaid.value.pending = admissions.value.filter((admission) => admission.paid_invoice_number === null).length;

    // ordenar los meses de admisiones
    months.sort((a, b) => Number(a) - Number(b));
    invoiceStatusData.value.months = months.map((month) => getMesEnEspanol(Number(month)));
    totalAdmissions.value = admissions.value.length;

    // Aquí puedes agregar código para procesar los datos de las aseguradoras
    insurersDataSet.value.sort((a, b) => {
        if (a.month !== b.month) {
            return a.month - b.month; // Ordenar por mes ascendente
        }
        return b.count - a.count; // Ordenar por count descendente dentro de cada mes
    });

    console.log(insurersDataSet.value);
    insurersDataSetSoles.value.sort((a, b) => a.month - b.month);
};

const processAdmissionsLists = async (data) => {
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
});

const searchAdmissionsByDate = async () => {
    loadingData.value = true;
    let payload = {
        start_date: dformat(starDate.value, 'MM-DD-YYYY'),
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    const { success, data } = await admissionsStore.fetchAdmissionsDateRangeApi(payload);

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

    processAdmissions(data);
    invoicedData.value = Object.values(sortMonths(invoiceStatusData.value.invoicedData));
    pendingData.value = Object.values(sortMonths(invoiceStatusData.value.pendingData));
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
    chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
    chartOptionsInsurers.value = setChartOptionsInsurers();
    loadingData.value = false;
};

const searchPeriod = async () => {
    // let response = await admissionsListStore.fetchAdmissionsListsByPeriod(period.value);
    // admissionsLists.value = formatAdmissionsLists(response.data);
    // resumenAdmissions.value = Object.values(resumenAdmissionsList(admissionsLists.value));
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
    } else {
        invoicedData.value = Object.values(sortMonths(invoiceStatusData.value.invoicedData));
        pendingData.value = Object.values(sortMonths(invoiceStatusData.value.pendingData));
        chartDataInsurers.value = setChartDataInsurers(insurersDataSet.value);
        paidSet.value = [admissionsPaid.value.paid, admissionsPaid.value.pending];
        chartDataPaid.value = setChartDataPaid();
        chartOptionsPaid.value = setChartOptionsPaid();
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
                backgroundColor: [documentStyle.getPropertyValue('--p-cyan-500'), documentStyle.getPropertyValue('--p-orange-500'), documentStyle.getPropertyValue('--p-gray-500')],
                hoverBackgroundColor: [documentStyle.getPropertyValue('--p-cyan-400'), documentStyle.getPropertyValue('--p-orange-400'), documentStyle.getPropertyValue('--p-gray-400')]
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

watch([getPrimary, getSurface, isDarkTheme], () => {
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
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
                                <strong> Buscar por Período</strong>
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
            <!-- <div class="card">
                <div class="flex justify-between items-center mb-6">
                    <div class="font-semibold text-xl">Best Selling Products</div>
                </div>
            </div> -->
        </div>

        <div class="col-span-12 xl:col-span-6">
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div class="font-semibold text-xl">Pago de Facturas</div>
                    <button @click="toggleView" class="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-2">
                        <i :class="isCostView ? 'pi pi-hashtag' : 'pi pi-dollar'"></i>
                    </button>
                </div>
                <Chart type="pie" :data="chartDataPaid" :options="chartOptionsPaid" class="w-full md:w-[25rem]" />
            </div>
            <!-- <div class="card">
                <div class="flex items-center justify-between mb-6">
                    <div class="font-semibold text-xl">Notifications</div>
                </div>
            </div> -->
        </div>
    </div>
</template>
