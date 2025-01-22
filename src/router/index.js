import AppLayout from '@/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/authStore';
import { createRouter, createWebHistory } from 'vue-router';

// Definimos las rutas con permisos de acceso
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/dashboard',
            component: AppLayout,
            meta: { positions: ['admin', 'ADMINISTRACION'] }, // Solo accesible por usuarios con estas posiciones
            children: [
                {
                    path: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue'),
                    meta: { positions: ['admin', 'ADMINISTRACION'] }
                },
                {
                    path: '/profile',
                    name: 'profile',
                    component: () => import('@/views/users/Profile.vue'),
                    meta: { public: true } // Ruta pública
                },
                {
                    path: '/databases',
                    name: 'databases',
                    component: () => import('@/views/databases/Databases.vue'),
                    meta: { positions: ['admin'] } // Solo accesible por administradores
                },
                {
                    path: '/admissions',
                    name: 'admissions',
                    component: () => import('@/views/invoicing/Admissions.vue'),
                    meta: { positions: ['AUDITOR MEDICO', 'ADMINISTRACION'] } // Permite múltiples posiciones
                },
                {
                    path: '/admissions-lists',
                    name: 'admissions-lists',
                    component: () => import('@/views/invoicing/AdmissionsLists.vue'),
                    meta: { positions: ['ADMINISTRACION', 'AUDITOR MEDICO'] }
                },
                {
                    path: '/admissions-list-biller',
                    name: 'admissions-list-biller',
                    component: () => import('@/views/invoicing/BillerAdmissionsList.vue'),
                    meta: { positions: ['FACTURACION'] }
                },
                {
                    path: '/settlements',
                    name: 'settlements',
                    component: () => import('@/views/invoicing/Settlements.vue'),
                    meta: { positions: ['admin', 'auditor'] }
                },
                {
                    path: '/audits',
                    name: 'audits',
                    component: () => import('@/views/audit/Audits.vue'),
                    meta: { positions: ['ADMINISTRACION', 'AUDITOR MEDICO'] }
                },
                {
                    path: '/audits-results',
                    name: 'audits-results',
                    component: () => import('@/views/audit/AuditsResults.vue'),
                    meta: { positions: ['ADMINISTRACION', 'AUDITOR MEDICO', 'FACTURACION'] }
                },

                {
                    path: '/audits-devolutions',
                    name: 'audits-devolutions',
                    component: () => import('@/views/audit/AuditsDevolutions.vue'),
                    meta: { positions: ['ADMINISTRACION', 'AUDITOR MEDICO', 'FACTURACION'] }
                },
                {
                    path: '/devolutions',
                    name: 'devolutions',
                    component: () => import('@/views/invoicing/Devolutions.vue'),
                    meta: { positions: ['ADMINISTRACION', 'AUDITOR MEDICO', 'FACTURACION'] }
                },
                {
                    path: '/insurers-tracking',
                    name: 'insurers-tracking',
                    component: () => import('@/views/medicalRecord/InsurersTracking.vue'),
                    meta: { positions: ['ADMINISTRACION', 'ARCHIVO HISTORIAS'] }
                },
                {
                    path: '/medical-records-tracking',
                    name: 'medical-records-tracking',
                    component: () => import('@/views/medicalRecord/MedicalRecordsTracking.vue'),
                    meta: { positions: ['ADMINISTRACION', 'ARCHIVO HISTORIAS'] }
                }
            ]
        },
        {
            path: '/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue'),
            meta: { public: true } // Ruta pública
        },
        {
            path: '/',
            name: 'login',
            component: () => import('@/views/auth/Login.vue'),
            meta: { public: true } // Ruta pública
        },
        {
            path: '/accessdenied',
            name: 'accessDenied',
            component: () => import('@/views/auth/Access.vue'),
            meta: { public: true } // Ruta pública
        },
        {
            path: '/error',
            name: 'error',
            component: () => import('@/views/auth/Error.vue'),
            meta: { public: true } // Ruta pública
        },
        {
            path: '/:catchAll(.*)',
            redirect: '/notfound',
            meta: { public: true } // Ruta pública
        }
    ]
});

// Guard de navegación
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    const currentUser = authStore.getUser;

    // Si la ruta es pública, permite el acceso sin verificación
    if (to.meta.public) {
        return next();
    }

    // Verifica si el usuario está autenticado
    if (!currentUser || !currentUser.is_active) {
        return next({ name: 'login' });
    }

    // Verifica si la ruta requiere posiciones específicas
    const allowedPositions = to.meta.positions;
    if (allowedPositions && !allowedPositions.includes(currentUser.position) && currentUser.position !== 'SISTEMAS') {
        // Redirige si no tiene la posición adecuada y no es 'SISTEMAS'
        return next({ name: 'accessDenied' });
    }

    next(); // Permite la navegación
});

export default router;
