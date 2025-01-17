<script setup>
import { useSettlementsStore } from '@/stores/settlementsStore';
import { onMounted, ref } from 'vue';

const settlementsStore = useSettlementsStore();

const isLoading = ref(false);
const settlements = ref([]);

const chartData = ref();
const chartOptions = ref();
const chartDataReceivedFile = ref();
const chartOptionsReceivedFile = ref();
const chartDataSettled = ref();
const chartOptionsSettled = ref();

const biller = ref('FHUAYAMA');

onMounted(async () => {
    settlements.value = await settlementsStore.initializeStore();

    if (biller.value) {
        settlements.value = settlements.value.filter((settlement) => settlement.biller == biller.value);
    }
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();

    chartDataReceivedFile.value = setChartDataReceivedFile();
    chartOptionsReceivedFile.value = setChartOptionsReceivedFile();

    chartDataSettled.value = setChartDataSettled();
    chartOptionsSettled.value = setChartOptionsSettled();
});

const setChartData = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const totalSettlements = settlements.value.length;
    const pendingReceivedFile = settlements.value.filter((settlement) => settlement.received_file == false).length;
    const pendingSettled = settlements.value.filter((settlement) => settlement.settled == false).length;
    const pendingAudited = settlements.value.filter((settlement) => settlement.audited == false).length;
    const pendingBilled = settlements.value.filter((settlement) => settlement.billed == false).length;
    const pendingShipped = settlements.value.filter((settlement) => settlement.shipped == false).length;

    const progressReceivedFile = settlements.value.filter((settlement) => settlement.received_file).length;
    const progressSettled = settlements.value.filter((settlement) => settlement.settled).length;
    const progressAudited = settlements.value.filter((settlement) => settlement.audited).length;
    const progressBilled = settlements.value.filter((settlement) => settlement.billed).length;
    const progressShipped = settlements.value.filter((settlement) => settlement.shipped).length;

    const progressSettlements = (progressReceivedFile + progressSettled + progressAudited + progressBilled + progressShipped) / 5;

    return {
        labels: ['Total', 'Recibidas', 'Liquidadas', 'Auditadas', 'Facturadas', 'Enviadas'],
        datasets: [
            {
                label: 'Pendientes',
                backgroundColor: documentStyle.getPropertyValue('--p-cyan-500'),
                borderColor: documentStyle.getPropertyValue('--p-cyan-500'),
                data: [totalSettlements, pendingReceivedFile, pendingSettled, pendingAudited, pendingBilled, pendingShipped]
            },
            {
                label: 'Progreso',
                backgroundColor: documentStyle.getPropertyValue('--p-yellow-500'),
                borderColor: documentStyle.getPropertyValue('--p-yellow-500'),
                data: [progressSettlements, progressReceivedFile, progressSettled, progressAudited, progressBilled, progressShipped]
            }
        ]
    };
};
const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        indexAxis: 'y',
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
};

const setChartDataReceivedFile = () => {
    const documentStyle = getComputedStyle(document.body);

    const pendingReceivedFile = settlements.value.filter((settlement) => settlement.received_file == false).length;

    const progressReceivedFile = settlements.value.filter((settlement) => settlement.received_file).length;

    return {
        labels: ['Recibidas', 'No Recibidas'],
        datasets: [
            {
                data: [progressReceivedFile, pendingReceivedFile],
                backgroundColor: [documentStyle.getPropertyValue('--p-cyan-500'), documentStyle.getPropertyValue('--p-orange-500'), documentStyle.getPropertyValue('--p-gray-500')],
                hoverBackgroundColor: [documentStyle.getPropertyValue('--p-cyan-400'), documentStyle.getPropertyValue('--p-orange-400'), documentStyle.getPropertyValue('--p-gray-400')]
            }
        ]
    };
};
const setChartOptionsReceivedFile = () => {
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
};

const setChartDataSettled = () => {
    const documentStyle = getComputedStyle(document.body);
    const pendingSettled = settlements.value.filter((settlement) => settlement.settled == false).length;
    const progressSettled = settlements.value.filter((settlement) => settlement.settled).length;

    return {
        labels: ['Liquidadas', 'No Liquidadas'],
        datasets: [
            {
                data: [progressSettled, pendingSettled],
                backgroundColor: [documentStyle.getPropertyValue('--p-green-500'), documentStyle.getPropertyValue('--p-yellow-500'), documentStyle.getPropertyValue('--p-gray-500')]
            }
        ]
    };
};
const setChartOptionsSettled = () => {
    const documentStyle = getComputedStyle(document.body);
    const textColor = documentStyle.getPropertyValue('--p-text-color');

    return {
        plugins: {
            legend: {
                labels: { usePointStyle: true, color: textColor }
            }
        }
    };
};
</script>

<template>
    <div class="grid grid-cols-12 gap-8">
        <div class="col-span-12 lg:col-span-6 xl:col-span-6">
            <div class="card mb-0">
                <div class="card-header">
                    <h5>Resumen</h5>
                </div>
                <Chart type="bar" :data="chartData" :options="chartOptions" class="h-[15rem]" />
            </div>
        </div>
        <div class="col-span-12 lg:col-span-3 xl:col-span-3">
            <div class="card mb-0">
                <div class="card-header">
                    <h5>Historias Recibidas</h5>
                </div>
                <div class="flex justify-center">
                    <Chart type="pie" :data="chartDataReceivedFile" :options="chartOptionsReceivedFile" class="w-full md:w-[15rem]" />
                </div>
            </div>
        </div>
        <div class="col-span-12 lg:col-span-3 xl:col-span-3">
            <div class="card mb-0">
                <div class="card-header">
                    <h5>Expedientes Liquidados</h5>
                </div>
                <div class="flex justify-center">
                    <Chart type="pie" :data="chartDataSettled" :options="chartOptionsSettled" class="w-full md:w-[15rem]" />
                </div>
            </div>
        </div>
    </div>
</template>
