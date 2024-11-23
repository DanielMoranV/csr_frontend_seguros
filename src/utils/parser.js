export function prepareWordListWithSuggestions(phrase = '', suggestions = []) {
    const result = [];
    let phraseAux = phrase;
    let phrasePointer = 0;
    suggestions.forEach((suggestion) => {
        const start = suggestion.start - phrasePointer;
        const end = suggestion.offset - phrasePointer;
        const firstPart = phraseAux.slice(0, start);
        if (firstPart !== '') {
            result.push({ phrase: firstPart });
        }
        result.push({
            phrase: phraseAux.sub(start, suggestion.offset),
            suggestions: suggestion.recommends
        });
        phraseAux = phraseAux.slice(end);
        phrasePointer += end;
    });
    if (phraseAux !== '') {
        result.push({ phrase: phraseAux });
    }
    return result;
}

export function removeFromListWithSuggestions(listWithSuggestions = [], phrase = '', suggestion = '') {
    const index = listWithSuggestions.findIndex((text) => text.phrase === phrase);
    const result = listWithSuggestions.slice();
    if (index >= 0) {
        result.splice(index, 1, { phrase: phrase });
    }
    return result;
}
