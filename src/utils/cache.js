/**
 * Local Cache Manager
 */
const storage = window.localStorage;

function base64EncodeUnicode(str) {
    const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode(`0x${p1}`);
    });

    return btoa(utf8Bytes);
}

function base64DecodeUnicode(str) {
    // Convert Base64 encoded bytes to percent-encoding, and then get the original string.
    const percentEncodedStr = atob(str)
        .split('')
        .map(function (c) {
            return `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`;
        })
        .join('');

    return decodeURIComponent(percentEncodedStr);
}

export default {
    /**
     * @param {string} key
     * @param {object} value
     * @return {Object}
     */
    setItem: (key, value) => {
        const encripted = base64EncodeUnicode(JSON.stringify(value));
        storage.setItem(key, encripted);
        return encripted;
    },

    /**
     * @param {string} key
     * @returns {Boolean}
     */
    hasThis: (key) => {
        return storage.getItem(key) !== null;
    },

    /**
     * @param {string} key
     * @returns {Object}
     */
    getItem: (key) => {
        if (storage.getItem(key) !== null) {
            return JSON.parse(base64DecodeUnicode(storage.getItem(key)));
        }
        return null;
    },

    /**
     * @param {string} key
     * @returns  {void}
     */
    removeItem: (key) => {
        return storage.removeItem(key);
    },

    /**
     * @returns {void}
     */
    cleanAll: () => {
        return storage.clear();
    },

    refresh: () => {
        const token = storage.getItem('token');
        const currentUser = storage.getItem('currentUser');

        storage.clear(); // Clear all items first

        if (token) {
            storage.setItem('token', token); // Restore token if it exists
        }
        if (currentUser) {
            storage.setItem('currentUser', currentUser); // Restore currentUser if it exists
        }
    }
};
