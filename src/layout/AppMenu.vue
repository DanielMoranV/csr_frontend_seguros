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
        icon: 'pi pi-fw pi-cog',
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
        label: 'Sistemas',
        icon: 'pi pi-fw pi-sitemap',
        items: [{ label: 'Bases de datos', icon: 'pi pi-fw pi-database', to: '/databases' }]
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
