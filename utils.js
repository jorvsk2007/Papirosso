export function formatPrice(value) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(value);
}

export function showElement(element) {
    if (element) element.classList.remove('hidden');
}

export function hideElement(element) {
    if (element) element.classList.add('hidden');
}

export function setText(element, text) {
    if (element) element.textContent = text;
}
