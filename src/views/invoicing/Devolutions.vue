<script setup>
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { onMounted, ref } from 'vue';

const devolutionsStore = useDevolutionsStore();

const devolutions = ref([]);

onMounted(async () => {});
</script>
<template>
    <div>
        <h1>Devolutions</h1>
    </div>
</template>
