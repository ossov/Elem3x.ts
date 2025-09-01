// src/popup.ts

import { toKebabCase } from "./utils";

const inspectorToggle = document.getElementById('inspector-toggle') as HTMLInputElement;
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement;
const placeholderText = document.getElementById('placeholder-text') as HTMLDivElement;
const classSelectorRadio = document.getElementById('class-selector-radio') as HTMLInputElement;
const classSelectorLabel = document.getElementById('class-selector-label') as HTMLLabelElement;
const pathSelectorRadio = document.getElementById('path-selector-radio') as HTMLInputElement;
const pathSelectorLabel = document.getElementById('path-selector-label') as HTMLLabelElement;

// --- State Variables ---
let currentStyles: Record<string, string> = {};
let currentTabId: number | undefined;
let allInputs: NodeListOf<HTMLInputElement | HTMLSelectElement>;

// --- Helper Functions ---


// Converts RGB color strings to HEX for the color picker
function rgbToHex(rgb: string): string {
    if (!rgb || !rgb.startsWith('rgb')) return '#000000';
    const match = rgb.match(/(\d+), (\d+), (\d+)/);
    if (!match) return '#000000';
    const [_, r, g, b] = match.map(Number);
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
}

// --- Core Functions ---

function applyAllStyles() {
    const selectedSelectorInput = document.querySelector('input[name="selector-type"]:checked') as HTMLInputElement;
    if (!selectedSelectorInput || !currentTabId) return;
    const selectedSelector = selectedSelectorInput.value;

    chrome.tabs.sendMessage(currentTabId, {
        type: "APPLY_STYLES",
        payload: {
            selector: selectedSelector,
            styles: currentStyles,
        }
    });
}

function handleStyleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;

    const units: { [key: string]: string } = {
        fontSize: 'px',
        letterSpacing: 'px',
        wordSpacing: 'px',
        borderRadius: 'px',
        paddingTop: 'px',
        paddingRight: 'px',
        paddingBottom: 'px',
        paddingLeft: 'px'
    };
    
    // Use the value as-is if a placeholder exists and value is not a number, otherwise add unit
    const hasPlaceholder = target.hasAttribute('placeholder');
    const isNumberInput = target.getAttribute('type') === 'number' && !isNaN(parseFloat(value));

    if (units[name] && isNumberInput) {
        currentStyles[name] = `${value}${units[name]}`;
    } else {
        currentStyles[name] = value;
    }
    
    applyAllStyles();
}

function updateUIWithElementData(payload: any) {
    editorPanel.classList.remove('hidden');
    placeholderText.classList.add('hidden');

    // Populate selectors
    classSelectorLabel.textContent = payload.selectors.class;
    classSelectorRadio.value = payload.selectors.class;
    pathSelectorLabel.textContent = payload.selectors.path;
    pathSelectorRadio.value = payload.selectors.path;
    if (payload.selectors.default === payload.selectors.class) {
        classSelectorRadio.checked = true;
    } else {
        pathSelectorRadio.checked = true;
    }
    
    // Populate style controls with computed styles
    const computed = payload.computedStyles;
    currentStyles = {}; // Reset styles

    allInputs.forEach(input => {
        const propName = input.name;
        let styleValue = computed[propName];

        if (styleValue === undefined) return;

        // --- VISUAL UPDATE ---
        // Handle special cases for what the user sees in the input
        if (input.type === 'color') {
            input.value = rgbToHex(styleValue);
        } else if (input.getAttribute('type') === 'number') {
            const parsedValue = parseFloat(styleValue);
            input.value = isNaN(parsedValue) ? '' : parsedValue.toFixed(1);
        } else {
            input.value = styleValue;
        }
        
        // --- STATE UPDATE (The Fix) ---
        // This part ensures the internal state is always correct
        const units: { [key:string]: string } = {
            fontSize: 'px', letterSpacing: 'px', wordSpacing: 'px', borderRadius: 'px', 
            paddingTop: 'px', paddingRight: 'px', paddingBottom: 'px', paddingLeft: 'px'
        };

        const numericValue = parseFloat(styleValue);
        if (units[propName] && !isNaN(numericValue)) {
            // If it's a property that needs a unit, add it
            currentStyles[propName] = `${numericValue.toFixed(1)}${units[propName]}`;
        } else {
            // Otherwise, use the value directly (e.g., for color, textAlign)
            currentStyles[propName] = styleValue;
        }
    });
}

function handleToggle(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    chrome.storage.local.set({ inspectorActive: isActive });

    if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
            type: "TOGGLE_INSPECTOR",
            payload: { isActive }
        });
    }

    const action = isActive ? 'add' : 'remove';
    if (!isActive) {
        editorPanel.classList.add('hidden');
        placeholderText.classList.remove('hidden');
        chrome.storage.local.remove("selectionData");
    } else {
        editorPanel.classList.add('hidden');
        placeholderText.classList.remove('hidden');
        chrome.storage.local.remove("selectionData");
    }
}

async function initialize() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;

    allInputs = document.querySelectorAll('.controls-group input, .controls-group select');

    const { inspectorActive, selectionData } = await chrome.storage.local.get(["inspectorActive", "selectionData"]);
    inspectorToggle.checked = inspectorActive;

    if (inspectorActive && selectionData) {
        updateUIWithElementData(selectionData);
    } else {
        editorPanel.classList.add('hidden');
        placeholderText.classList.remove('hidden');
    }

    // Add event listeners
    inspectorToggle.addEventListener('change', handleToggle);
    document.querySelectorAll('input[name="selector-type"]').forEach(radio => {
        radio.addEventListener('change', applyAllStyles);
    });
    allInputs.forEach(input => {
        input.addEventListener('input', handleStyleChange);
    });
}

// --- Message Listeners ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // This case handles when a new element is selected
    if (message.type === "ELEMENT_SELECTED") {
        updateUIWithElementData(message.payload);
    }
    // This case handles when a selection is cleared (by clicking the same element again)
    if (message.type === "SELECTION_CLEARED") {
        editorPanel.classList.add('hidden');
        placeholderText.classList.remove('hidden');
    }
});

document.addEventListener('DOMContentLoaded', initialize);