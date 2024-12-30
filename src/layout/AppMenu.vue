<script setup>
import { ref } from 'vue';

import AppMenuItem from './AppMenuItem.vue';

const model = ref([
    {
        label: 'Home',
        items: [
            { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/dashboard' },
            { label: 'Perfil', icon: 'pi pi-fw pi-user', to: '/profile' }
        ]
    },
    {
        label: 'Administrador',
        items: [
            { label: 'Usuarios', icon: 'pi pi-fw pi-users', to: '/users' },
            {
                label: 'Permisos',
                icon: 'pi pi-fw pi-lock',
                items: [
                    { label: 'Roles', icon: 'pi pi-fw pi-verified', to: '/roles' },
                    { label: 'Asignar Rol', icon: 'pi pi-fw pi-user-plus', to: '/assign-role' }
                ]
            }
        ]
    },
    {
        label: 'Facturación',
        items: [
            { label: 'Admisiones', icon: 'pi pi-fw pi-ticket', to: '/admissions' },
            { label: 'Listas', icon: 'pi pi-fw pi-list', to: '/admissions-lists' },
            { label: 'Devoluciones', icon: 'pi pi-fw pi-ban', to: '/returns' },
            { label: 'Notas de Crédito', icon: 'pi pi-fw pi-dollar', to: '/credit-notes' },
            { label: 'Envios Facturas', icon: 'pi pi-fw pi-send', to: '/send-invoices' }
        ]
    },
    {
        label: 'Gestión de Expedientes',
        items: [
            { label: 'Historia Clínicas', icon: 'pi pi-fw pi-book', to: '/medical-records' },
            { label: 'Seguimiento Seguros', icon: 'pi pi-fw pi-plus', to: '/insurers-tracking' },
            { label: 'Solicitudes Expedientes', icon: 'pi pi-fw pi-user-plus', to: '/patients-tracking' }
        ]
    },
    {
        label: 'Sistemas',
        items: [{ label: 'Base de datos', icon: 'pi pi-fw pi-database', to: '/databases' }]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
