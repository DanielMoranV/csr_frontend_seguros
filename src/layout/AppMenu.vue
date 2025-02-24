<script setup>
import { useAuthStore } from '@/stores/authStore'; // Importa el store de autenticación
import { computed, ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

// Datos del menú con restricción por posición
const model = ref([
    {
        label: 'Home',
        items: [
            { label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/dashboard', positions: ['ADMINISTRACION', 'manager', 'biller'] },
            { label: 'Perfil', icon: 'pi pi-fw pi-user', to: '/profile', public: true } // Elemento público
        ]
    },
    {
        label: 'Administrador',
        items: [
            { label: 'Usuarios', icon: 'pi pi-fw pi-users', to: '/users', positions: ['admin'] },
            {
                label: 'Permisos',
                icon: 'pi pi-fw pi-lock',
                items: [
                    { label: 'Roles', icon: 'pi pi-fw pi-verified', to: '/roles', positions: ['admin'] },
                    { label: 'Asignar Rol', icon: 'pi pi-fw pi-user-plus', to: '/assign-role', positions: ['admin'] }
                ],
                positions: ['admin']
            }
        ],
        positions: ['admin']
    },
    {
        label: 'Facturación',
        items: [
            { label: 'Admisiones', icon: 'pi pi-fw pi-ticket', to: '/admissions', positions: ['ADMINISTRACION', 'AUDITOR MEDICO'] },
            { label: 'Análisis de Metas', icon: 'pi pi-fw pi-map', to: '/admissions-lists', positions: ['ADMINISTRACION', 'AUDITOR MEDICO', 'ASISTENTE FACTURACION', 'FACTURACION'] },
            { label: 'Lista Facturador', icon: 'pi pi-fw pi-file', to: '/admissions-list-biller', positions: ['FACTURACION', 'ADMINISTRACION'] },
            { label: 'Devoluciones', icon: 'pi pi-fw pi-ban', to: '/devolutions', positions: ['FACTURACION', 'AUDITOR MEDICO', 'ADMINISTRACION'] },
            { label: 'Notas de Crédito', icon: 'pi pi-fw pi-dollar', to: '/credit-notes', positions: ['admin'] }
        ],
        positions: ['FACTURACION', 'ADMINISTRACION', 'AUDITOR MEDICO', 'ASISTENTE FACTURACION']
    },
    {
        label: 'Auditoría',
        items: [
            { label: 'Listas Auditor', icon: 'pi pi-fw pi-eye', to: '/audits', positions: ['AUDITOR MEDICO', 'ADMINISTRACION'] },
            { label: 'Devoluciones Auditorías', icon: 'pi pi-fw pi-replay', to: '/audits-devolutions', positions: ['FACTURACION', 'AUDITOR MEDICO', 'ADMINISTRACION'] },
            { label: 'Resultados Auditorías', icon: 'pi pi-fw pi-list', to: '/audits-results', positions: ['FACTURACION', 'AUDITOR MEDICO', 'ADMINISTRACION'] }
        ],
        positions: ['AUDITOR MEDICO', 'FACTURACION', 'ADMINISTRACION']
    },
    {
        label: 'Gestión de Expedientes',
        items: [
            { label: 'Seguimiento His. Clín.', icon: 'pi pi-fw pi-book', to: '/medical-records-tracking', positions: ['ADMINISTRACION', 'ARCHIVO HISTORIAS', 'FACTURACION', 'ADMISION'] },
            { label: 'Gestión Exp. Seguros', icon: 'pi pi-fw pi-verified', to: '/insurers-tracking', positions: ['ADMINISTRACION', 'ARCHIVO HISTORIAS'] }
            // { label: 'Expedientes Seguros', icon: 'pi pi-fw pi-user-plus', to: '/patients-tracking', positions: ['FACTURACION'] },
            // { label: 'Solicitudes Expedientes', icon: 'pi pi-fw pi-user-plus', to: '/patients-tracking', positions: ['ADMINISTRACION', 'FACTURACION'] }
        ],
        positions: ['FACTURACION', 'ADMINISTRACION', 'ARCHIVO HISTORIAS', 'ADMISION']
    },
    {
        label: 'Envios de Facturas',
        items: [
            { label: 'Envios Listas', icon: 'pi pi-fw pi-send', to: '/shipments', positions: ['ADMINISTRACION', 'FACTURACION', 'ASISTENTE FACTURACION'] },
            { label: 'Envios General', icon: 'pi pi-fw pi-list', to: '/shipments-all', positions: ['ADMINISTRACION', 'FACTURACION', 'ASISTENTE FACTURACION'] }
        ],
        positions: ['ADMINISTRACION', 'FACTURACION', 'ASISTENTE FACTURACION']
    },
    {
        label: 'Sistemas',
        items: [{ label: 'Base de datos', icon: 'pi pi-fw pi-database', to: '/databases', positions: ['SISTEMAS'] }],
        positions: ['SISTEMAS']
    }
]);

const authStore = useAuthStore();
const currentPosition = computed(() => authStore.getUser?.position || '');

// Filtrar elementos según la posición del usuario
const filteredModel = computed(() => {
    const globalAccessRoles = ['SISTEMAS']; // Roles con acceso a todo

    const hasAccess = (positions) => {
        if (!positions) return true; // Elementos sin restricción son accesibles
        return positions.includes(currentPosition.value) || globalAccessRoles.includes(currentPosition.value);
    };

    const filterItems = (items) =>
        items
            .filter((item) => hasAccess(item.positions))
            .map((item) => ({
                ...item,
                items: item.items ? filterItems(item.items) : undefined
            }));

    return model.value
        .filter((section) => hasAccess(section.positions))
        .map((section) => ({
            ...section,
            items: filterItems(section.items)
        }));
});
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in filteredModel" :key="item.label">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
