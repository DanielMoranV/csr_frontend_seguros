<script setup>
import { useLayout } from '@/layout/composables/layout';
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useAuthStore } from '@/stores/authStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import cache from '@/utils/cache';
import indexedDB from '@/utils/indexedDB';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppConfigurator from './AppConfigurator.vue';

const router = useRouter();
const authStore = useAuthStore();
const admissionsStore = useAdmissionsStore();
const insurersStore = useInsurersStore();
const invoicesStore = useInvoicesStore();
const medicalRecordsStore = useMedicalRecordsStore();

const logoutDialog = ref(false);
const { onMenuToggle, toggleDarkMode, isDarkTheme } = useLayout();

const goToProfile = () => {
    router.push({ name: 'profile' });
};

const goToConfig = () => {
    router.push({ name: 'config' });
};

const goToRefresh = () => {
    cache.refresh();
    indexedDB.cleanAll();
    window.location.reload();
};
const confirmLogout = () => {
    logoutDialog.value = true;
};
const logout = async () => {
    await authStore.logout();
};

onMounted(async () => {
    // await insurersStore.initializeStore();
    // await invoicesStore.initializeStore();
    // await medicalRecordsStore.initializeStore();
});
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <router-link to="/dashboard" class="layout-topbar-logo">
                <img width="25px" src="/logo-csr.webp" alt="Logo Clinica Santa Rosa" />
                <span>Clinica Santa Rosa</span>
            </router-link>
        </div>

        <button class="layout-menu-button layout-topbar-action" @click="onMenuToggle">
            <i class="pi pi-bars"></i>
        </button>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div class="relative">
                    <button
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'animate-scalein', leaveToClass: 'hidden', leaveActiveClass: 'animate-fadeout', hideOnOutsideClick: true }"
                        type="button"
                        class="layout-topbar-action layout-topbar-action-highlight"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'animate-scalein', leaveToClass: 'hidden', leaveActiveClass: 'animate-fadeout', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button @click="goToRefresh()" type="button" class="layout-topbar-action">
                        <i class="pi pi-refresh"></i>
                        <span>Actualizar</span>
                    </button>
                    <button @click="goToConfig()" type="button" class="layout-topbar-action">
                        <i class="pi pi-cog"></i>
                        <span>Configuración</span>
                    </button>
                    <button @click="goToProfile()" type="button" class="layout-topbar-action">
                        <i class="pi pi-user"></i>
                        <span>Perfil</span>
                    </button>
                    <button @click="confirmLogout()" type="button" class="layout-topbar-action">
                        <i class="pi pi-sign-out"></i>
                        <span>Salir</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    <Dialog v-model:visible="logoutDialog" :style="{ width: '450px' }" header="Cerrar Sesión" :modal="true">
        <div class="flex items-center gap-4">
            <i class="pi pi-exclamation-triangle !text-3xl" />
            <span>
                Deseas cerrar sesión <b>{{ authStore.getUser?.name || 'Usuario' }}</b
                >?
            </span>
        </div>
        <template #footer>
            <div v-if="authStore.getLoading">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="8" fill="var(--surface-ground)" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
            </div>
            <div v-else>
                <Button label="No" icon="pi pi-times" text @click="logoutDialog = false" />
                <Button label="Sí" icon="pi pi-check" @click="logout" />
            </div>
        </template>
    </Dialog>
</template>
