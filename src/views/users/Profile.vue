<script setup>
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { handleResponseToast } from '@/utils/response';
import { capitalizeName, restrictToNumbers, validateDNI, validateEmail, validatePhone } from '@/utils/validationUtils';

const api_url = import.meta.env.VITE_API_URL;
const storage_url = import.meta.env.VITE_STORAGE_URL;

// Stores
const authStore = useAuthStore();

// Referencias y datos
const user = ref({
    dni: '',
    email: '',
    phone: '',
    role: { id: '', name: '' },
    position: '',
    url_photo_profile: ''
});
const urlPhotoProfile = ref('');
const passwordInput = ref('');
const confirmPasswordInput = ref('');
const isLoading = ref(false);
const isLoadingPassword = ref(false);
const isLoadingProfile = ref(true);

// Estados de validación
const isDNIValid = ref(true);
const isEmailValid = ref(true);
const isPhoneValid = ref(true);

// Toast y Router
const toast = useToast();
const router = useRouter();

// Validar campos
const validateFields = () => {
    validateDNIField();
    validateEmailField();
    validatePhoneField();
};

// Verificar si el formulario es válido
const isFormValid = () => {
    return user.value.name && user.value.name.trim() && user.value.email && isDNIValid.value && isEmailValid.value && isPhoneValid.value;
};

// Manejar entrada de nombre
const handleNameInput = () => {
    user.value.name = capitalizeName(user.value.name);
};

// Validar DNI
const validateDNIField = () => {
    isDNIValid.value = validateDNI(user.value.dni);
};

// Validar email
const validateEmailField = () => {
    isEmailValid.value = validateEmail(user.value.email);
};

// Validar teléfono
const validatePhoneField = () => {
    isPhoneValid.value = validatePhone(user.value.phone);
};

// Actualizar usuario
const updateUser = async () => {
    isLoading.value = true;
    validateFields();

    if (!isFormValid()) {
        toast.add({ severity: 'warn', summary: 'Advertencia', detail: 'Por favor, complete todos los campos requeridos', life: 3000 });
        isLoading.value = false;
        return;
    }

    const payload = {
        id: user.value.id,
        name: user.value.name,
        dni: user.value.dni,
        email: user.value.email,
        phone: user.value.phone
    };

    const success = await authStore.updateProfile(payload, user.value.id);
    handleResponseToast(success, authStore.auth.message, authStore.auth.status, toast);
    if (success) {
        authStore.updateUser(user.value);
    }
    isLoading.value = false;
};

// Actualizar contraseña
const updatePassword = async () => {
    isLoadingPassword.value = true;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    if (password === confirmPassword) {
        const success = await authStore.updateProfile({ password: password }, user.value.id);
        handleResponseToast(success, authStore.auth.message, authStore.auth.status, toast);
        if (success) {
            authStore.updateUser(user.value);
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Contraseña de confirmación no coincide', life: 3000 });
    }
    isLoadingPassword.value = false;
};

// Manejar carga de foto de perfil
const beforeUpload = (request) => {
    request.xhr.setRequestHeader('Authorization', 'Bearer ' + authStore.getToken);
    return request;
};

const onUpload = async (request) => {
    isLoadingProfile.value = true;
    try {
        const response = typeof request.xhr.response === 'string' ? JSON.parse(request.xhr.response) : request.xhr.response;
        const urlPhotoProfile = response.data.url_photo_profile;
        const payload = {
            ...user.value,
            url_photo_profile: urlPhotoProfile
        };
        const success = await authStore.updateProfile(payload, user.value.id);
        handleResponseToast(success, 'Foto de perfil actualizada correctamente', 'success', toast);
        if (success) {
            authStore.updateUser(payload);
            user.value.url_photo_profile = storage_url + urlPhotoProfile;
        }
    } catch (error) {
        console.error('Error al procesar la respuesta', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar la respuesta', life: 3000 });
    } finally {
        isLoadingProfile.value = false;
    }
};

// Función para obtener la URL de la foto de perfil
const getProfilePhotoUrl = (urlPhoto, defaultPhoto, storageUrl) => {
    if (urlPhoto !== defaultPhoto && !urlPhoto.includes(storageUrl)) {
        return `${storageUrl}${urlPhoto}`;
    }
    return urlPhoto;
};

// Cargar datos del usuario
onMounted(() => {
    user.value = authStore.getUser;
    const defaultProfile = '/images/profile.png';
    const protoProfile = user.value.url_photo_profile ?? defaultProfile;

    // Obtener la URL de la foto de perfil
    user.value.url_photo_profile = getProfilePhotoUrl(protoProfile, defaultProfile, storage_url);
    urlPhotoProfile.value = api_url + '/users/' + user.value.id + '/photoprofile';
});

// Watchers
watch(() => user.value.dni, validateDNIField);
watch(() => user.value.email, validateEmailField);
watch(() => user.value.phone, validatePhoneField);
</script>

<template>
    <div class="profile-header mb-3">
        <Avatar :image="user.url_photo_profile" size="xlarge" shape="circle" class="mr-3" />
        <div>
            <h2>{{ user.name }}</h2>
            <p>{{ user.position.toUpperCase() }}</p>
        </div>
    </div>
    <div class="card">
        <div class="flex flex-col md:flex-row">
            <div class="w-full md:w-5/12 flex flex-col items-center justify-center gap-3 py-5">
                <div class="flex flex-col gap-2 w-full">
                    <label for="name">Nombre</label>
                    <InputText id="name" v-model="user.name" @input="handleNameInput" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="dni">DNI</label>
                    <InputText id="dni" v-model="user.dni" @input="validateDNIField" @keypress="restrictToNumbers" maxlength="8" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="email">Email</label>
                    <InputText id="email" v-model="user.email" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="phone">Teléfono</label>
                    <InputText id="phone" v-model="user.phone" maxlength="9" />
                </div>
                <div class="flex w-full">
                    <Button label="Actualizar" icon="pi pi-pencil" class="w-full mx-auto" @click="updateUser" :loading="isLoading" />
                </div>
            </div>
            <div class="w-full md:w-2/12">
                <Divider layout="vertical" class="hidden md:flex"></Divider>
            </div>
            <div class="w-full md:w-5/12 flex flex-col items-center justify-center gap-3 py-5">
                <div class="flex flex-col gap-2 w-full">
                    <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium mb-1">Nueva Contraseña</label>
                    <Password id="password" v-model="passwordInput" placeholder="Contraseña" :toggleMask="true" class="mb-4" fluid :feedback="true"></Password>
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium mb-1">Confirmar Contraseña</label>
                    <Password id="password1" v-model="confirmPasswordInput" placeholder="Confirmar Contraseña" :toggleMask="true" class="mb-4" fluid :feedback="true"></Password>
                </div>
                <div class="flex w-full">
                    <Button label="Actualizar Contraseña" icon="pi pi-pencil" class="w-full mx-auto" @click="updatePassword" severity="info" :loading="isLoadingPassword"></Button>
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <FileUpload
                        name="photo_profile"
                        :url="urlPhotoProfile"
                        @before-send="beforeUpload"
                        mode="basic"
                        accept="image/*"
                        :maxFileSize="1000000"
                        :auto="true"
                        chooseLabel="Actualizar foto de Perfil"
                        class="w-full mx-auto"
                        @upload="onUpload"
                        :loading="isLoadingProfile"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.profile-header {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: var(--primary-color);
    border-radius: 5px 5px 5px 5px;
}
.profile-header h2 {
    margin: 0;
    color: white;
    font-size: 1.2rem;
    font-family: 'Poppins', sans-serif;
}
.profile-header p {
    margin: 0;
    color: white;
    font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
}
</style>
