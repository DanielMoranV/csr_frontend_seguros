<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { useAuthStore } from '@/stores/authStore';
import { handleResponseToast } from '@/utils/response';
import { useToast } from 'primevue/usetoast';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();

const router = useRouter();
const toast = useToast();

const dataUser = reactive({
    dni: '',
    password: ''
});

const checked = ref(false);

const login = async () => {
    // Verificar si el correo electrónico y la contraseña son campos requeridos
    if (!dataUser.dni || !dataUser.password) {
        return toast.add({ severity: 'warn', summary: 'Por favor complete los campos requeridos', life: 3000 });
    }

    // Verificar si los campos contienen espacios en blanco
    if (/\s/.test(dataUser.dni) || /\s/.test(dataUser.password)) {
        return toast.add({ severity: 'warn', summary: 'Los campos no pueden contener espacios en blanco', life: 3000 });
    }
    // Verificar si la contraseña tiene al menos 6 caracteres
    if (dataUser.password.length < 6) {
        return toast.add({ severity: 'warn', summary: 'La contraseña debe tener al menos 6 caracteres', life: 3000 });
    }
    const success = await authStore.login(dataUser);
    handleResponseToast(success, authStore.auth.message, authStore.auth.status, toast);
    if (success) {
        setTimeout(() => router.push('/profile'), 2000);
    }
};
</script>

<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <img class="mx-auto max-w-sm mb-5" width="120rem" src="/logo-csr.webp" alt="Logo Clinica Santa Rosa" />
                    <div class="text-center">
                        <div class="text-900 text-3xl font-medium mb-3">Bienvenido</div>
                        <span class="text-600 font-medium">Inicie Sesión para continuar</span>
                    </div>

                    <div>
                        <label for="dni" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">DNI</label>
                        <InputText id="dni" type="text" placeholder="Documento Identidad" class="w-full md:w-[30rem] mb-8" v-model="dataUser.dni" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Contraseña</label>
                        <Password id="password1" v-model="dataUser.password" placeholder="Contraseña" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <!-- <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Forgot password?</span>
                        </div> -->
                        <Toast />
                        <Button v-if="!authStore.getLoading" label="Iniciar Sesión" class="w-full p-3 text-xl" @click="login"></Button>
                        <div v-else class="flex justify-content-center mt-8">
                            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="8" fill="var(--surface-ground)" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
