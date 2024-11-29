<script setup>
import ExcelJS from 'exceljs';
import { useToast } from 'primevue/usetoast';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const toast = useToast();

const value = ref(0);
let interval = null;

function startProgress() {
    interval = setInterval(() => {
        let newValue = value.value + Math.floor(Math.random() * 10) + 1;
        if (newValue >= 100) {
            newValue = 100;
        }
        value.value = newValue;
    }, 2000);
}

function endProgress() {
    clearInterval(interval);
    interval = null;
}

// Importar Datos Excel
const onUpload = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(file);
            const worksheet = workbook.worksheets[0];
            const rows = worksheet.getSheetValues();

            console.log(rows);
            // Procesar los datos del archivo
            const dataSet = rows.slice(2).map((row) => ({
                admission_number: row[1],
                attendance_date: row[2] ? row[2] : null
            }));
            console.log(dataSet);
            //await uploadData(dataSet);
        } catch (error) {
            console.error('Error al procesar el archivo', error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Formato de archivo no válido', life: 3000 });
    }
};

onMounted(() => {
    startProgress();
});

onBeforeUnmount(() => {
    endProgress();
});
</script>
<template>
    <div class="card">
        <FileUpload mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Cargar base de datos" class="mr-2 inline-block" :auto="true" @select="onUpload($event)" />
        <div class="font-semibold text-xl mb-4">ProgressBar</div>
        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/2">
                <ProgressBar :value="value"></ProgressBar>
            </div>
        </div>
    </div>
</template>
