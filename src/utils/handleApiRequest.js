import cache from '@/utils/cache';

export async function handleApiRequest(apiCall, cacheKey, storeProperty, store) {
    store.loading = true;
    try {
        console.log(apiCall);
        const { data, success } = await apiCall;
        console.log(data);
        if (cacheKey) cache.setItem(cacheKey, data);
        store[storeProperty] = data;
        console.log(success);
        if (data == null) return success;
        return data;
    } catch (error) {
        console.log(error);
        store.msg = error.message;
        store[storeProperty] = null;
        store.status = error.status_code;
        return store.status;
    } finally {
        store.loading = false;
    }
}
