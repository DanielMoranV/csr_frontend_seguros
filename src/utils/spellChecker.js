import Typo from 'typo-js';

// Cargar el diccionario es-PE
export async function loadDictionary() {
    const affData = await fetch('/dictionaries/es_PE.aff').then((res) => res.text());
    const dicData = await fetch('/dictionaries/es_PE.dic').then((res) => res.text());

    const dictionary = new Typo('es_PE', affData, dicData);
    return dictionary;
}

// Función para revisar la ortografía de un texto
export function checkSpelling(text, dictionary) {
    const words = text.split(/\s+/);
    const spellingErrors = [];

    words.forEach((word) => {
        console.log(`checking ${word}`);
        if (!dictionary.check(word)) {
            const wordSuggestions = dictionary.suggest(word);
            spellingErrors.push({
                word,
                suggestions: wordSuggestions
            });
        }
    });

    return spellingErrors;
}
