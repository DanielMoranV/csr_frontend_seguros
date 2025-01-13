<script setup>
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { dformat } from '@/utils/day';
import { onMounted, ref } from 'vue';

const devolutionsStore = useDevolutionsStore();

const devolutions = ref([]);
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());

onMounted(async () => {
    let payload = {
        start_date: '01-01-2023',
        end_date: dformat(endDate.value, 'MM-DD-YYYY')
    };
    let response = await devolutionsStore.initializeStoreDevolutionsDataRange(payload);
    console.log(response);
});
</script>
<template>
    <div>
        <h1>Devolutions</h1>
    </div>
</template>
