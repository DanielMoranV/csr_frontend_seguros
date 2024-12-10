// chart.js
import { COLORS, TEXT_COLORS } from '@/utils/constants';

export function setChartData(settlements) {
    const totalSettlements = settlements.length;
    const pendingReceivedFile = settlements.filter((settlement) => settlement.received_file == false).length;
    // ...
    return {
        labels: ['Total', 'Recibidas', 'Liquidadas', 'Auditadas', 'Facturadas', 'Enviadas'],
        datasets: [
            {
                label: 'Pendientes',
                backgroundColor: COLORS.CYAN,
                borderColor: COLORS.CYAN,
                data: [totalSettlements, pendingReceivedFile /* ... */]
            }
            // ...
        ]
    };
}

export function setChartOptions() {
    return {
        indexAxis: 'y',
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
            legend: {
                labels: {
                    color: TEXT_COLORS.PRIMARY
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: TEXT_COLORS.SECONDARY,
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
                    color: TEXT_COLORS.SECONDARY
                },
                grid: {
                    color: COLORS.GRAY,
                    drawBorder: false
                }
            }
        }
    };
}
