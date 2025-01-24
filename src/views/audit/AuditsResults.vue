<script setup>
import { useAuditsStore } from '@/stores/AuditsStore';
import { useAuthStore } from '@/stores/authStore';
import { dformat, dformatLocal } from '@/utils/day';
import { exportToExcel } from '@/utils/excelUtils';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const auditsStore = useAuditsStore();
const authStore = useAuthStore();
const toast = useToast();
const filters = ref({ global: { value: '' } });
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());

const audits = ref([]);
const audit = ref(null);
const displayDialog = ref(false);
const statuses = ref([
    { label: 'Aprobado', value: 'Aprobado' },
    { label: 'Con Observaciones', value: 'Con Observaciones' },
    { label: 'Rechazado', value: 'Rechazado' }
]);
function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}
const hideDialog = () => {
    displayDialog.value = false;
    audit.value = null;
};
onBeforeMount(() => {
    initFilters();
});
onMounted(async () => {
    // let payload = {
    //     from: dformat(starDate.value, 'YYYY-MM-DD'),
    //     to: dformat(new Date(endDate.value.setHours(23, 0, 0, 0)), 'YYYY-MM-DD HH:mm:ss')
    // };
    // try {
    //     const responseAudits = await auditsStore.fetchAudits();
    //     audits.value = responseAudits.data;
    //     console.log(audits.value);
    //     // filtrar y quitar todos los registros que contengan type == 'Regular'
    //     audits.value = audits.value.filter((item) => item.type !== 'Regular');
    //     console.log(audits.value);
    // } catch (error) {
    //     toast.add({ severity: 'error', summary: 'Error', detail: error.message });
    // }
    await searchAuditsByDate();
    // formatAudits(audits.value);
});

const searchAuditsByDate = async () => {
    let payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(new Date(endDate.value.setHours(23, 0, 0, 0)), 'YYYY-MM-DD HH:mm:ss')
    };
    try {
        const responseAudits = await auditsStore.fetchAuditsDateRange(payload);
        audits.value = responseAudits.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message });
    }
    formatAudits(audits.value);
};

const formatAudits = (data) => {
    if (data.length === 0) {
        toast.add({
            severity: 'info',
            summary: 'No hay datos',
            detail: 'No se encontraron admisiones.',
            life: 3000
        });
        return [];
    }
};

const editAudit = (data) => {
    let nickName = authStore.getNickName;
    audit.value = { ...data };
    audit.value.auditor = nickName;
    displayDialog.value = true;
};

const saveAudit = async (data) => {
    let responseAudit = {};
    responseAudit = await auditsStore.updateAudit(data);
    if (responseAudit.success) {
        audits.value = audits.value.map((item) => (item.id === responseAudit.data.id ? { ...item, ...responseAudit.data } : item));

        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Auditoría actualizada correctamente.' });
        displayDialog.value = false;
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la auditoría.' });
    }
    displayDialog.value = false;
};

const exportAudits = async () => {
    const colums = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Fecha', key: 'created_at', width: 20 },
        { header: 'N° Admisión', key: 'admission_number', width: 20 },
        { header: 'Auditor', key: 'auditor', width: 20 },
        { header: 'Descripción', key: 'description', width: 20 },
        { header: 'N° Factura', key: 'invoice_number', width: 20 },
        { header: 'Estado', key: 'status', width: 20 },
        { header: 'Tipo', key: 'type', width: 20 }
    ];
    let data = audits.value.map((item) => {
        return {
            id: item.id,
            created_at: item.created_at,
            admission_number: item.admission_number,
            auditor: item.auditor,
            description: item.description,
            invoice_number: item.invoice_number,
            status: item.status,
            type: item.type
        };
    });
    await exportToExcel(colums, data, 'Auditorias', 'Auditorias');
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <!-- <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="searchAdmission" placeholder="N° Admisión" />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchAdmissions" /> -->
            </template>

            <template #end>
                <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchAuditsByDate" />
            </template>
        </Toolbar>
        <DataTable
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="audits"
            :paginator="true"
            :rows="10"
            v-model:filters="filters"
            stripedRows
            scrollable
            size="small"
            :loading="auditsStore.loading"
            :globalFilterFields="['id', 'created_at', 'admission_number', 'auditor', 'description', 'invoice_number', 'status']"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            :rowsPerPageOptions="[5, 10, 25, 50, 100]"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Auditorías"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión General Auditorias de Seguro CSR</h1>

                    <Button type="button" icon="pi pi-file-excel" label="Exportar Excel" outlined @click="exportAudits()" />
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
            <Column field="id" header="ID" sortable />
            <Column field="created_at" header="Fecha" sortable>
                <template #body="slotProps">
                    {{ slotProps.data.created_at ? dformatLocal(slotProps.data.created_at, 'DD/MM/YYYY') : '-' }}
                </template>
            </Column>
            <Column field="admission_number" header="N° Admisión" sortable />
            <Column field="auditor" header="Auditor" sortable />
            <Column field="description" header="Descripción" sortable />
            <Column field="invoice_number" header="N° Factura" sortable />
            <Column field="status" header="Estado" sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.status">
                        <i
                            :class="{
                                'pi pi-check-circle text-green-500': slotProps.data.status === 'Aprobado',
                                'pi pi-exclamation-circle text-yellow-500': slotProps.data.status === 'Con Observaciones',
                                'pi pi-times-circle text-red-500': slotProps.data.status === 'Rechazado',
                                'pi pi-clock text-blue-500': slotProps.data.status === 'Pendiente'
                            }"
                        ></i>
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-blue-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="type" header="Tipo">
                <template #body="slotProps">
                    <span v-if="slotProps.data.type">
                        <span
                            :class="{
                                'bg-green-100 text-green-800 px-2 py-1 rounded': slotProps.data.type === 'Regular',
                                'bg-red-100 text-red-800 px-2 py-1 rounded': slotProps.data.type === 'Devolucion'
                            }"
                        >
                            {{ slotProps.data.type }}
                        </span>
                    </span>
                </template>
            </Column>
            <Column v-if="position === 'Auditor Medico'" field="actions" header="Acciones">
                <template #body="slotProps">
                    <Button icon="pi pi-pencil" class="p-button-rounded p-button-success mr-2" @click="editAudit(slotProps.data)" />
                </template>
            </Column>
        </DataTable>
    </div>
    <Dialog v-model:visible="displayDialog" header="Auditoría" :modal="true" :style="{ width: '450px' }">
        <div class="flex flex-col gap-6">
            <div>
                <label for="admision_number" class="block font-bold mb-3">Admisión</label>
                <InputText id="admision_number" v-model="audit.admission_number" required="true" disabled fluid />
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
            <Button label="Guardar" icon="pi pi-check" @click="saveAudit(audit)" :loading="auditsStore.loading" />
        </template>
    </Dialog>
</template>
