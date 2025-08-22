const inspectorToggle = document.getElementById('inspector-toggle') as HTMLInputElement;
const editorPanel = document.getElementById('editor-panel') as HTMLDivElement;
const placeholderText = document.getElementById('placeholder-text') as HTMLDivElement;
const colorInput = document.getElementById('color') as HTMLInputElement;
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement;
const fontWeightInput = document.getElementById('font-weight') as HTMLInputElement;
const borderRadiusInput = document.getElementById('border-radius') as HTMLInputElement;

const classSelectorRadio = document.getElementById('class-selector-radio') as HTMLInputElement;
const classSelectorLabel = document.getElementById('class-selector-label') as HTMLLabelElement;
const pathSelectorRadio = document.getElementById('path-selector-radio') as HTMLInputElement;
const pathSelectorLabel = document.getElementById('path-selector-label') as HTMLLabelElement;

let currentStyles: Record<string, string> = {};
let currentTabId: number | undefined;

// --- State and UI Management ---

async function initialize() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab.id;

    const { inspectorActive, selectionData } = await chrome.storage.local.get(["inspectorActive", "selectionData"]);
    inspectorToggle.checked = inspectorActive;

    // If there's saved data, show the editor immediately
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
    [colorInput, fontSizeInput, fontWeightInput, borderRadiusInput].forEach(input => {
        input.addEventListener('input', handleStyleChange);
    });
}

function updateUIWithElementData(payload: any) {
    editorPanel.classList.remove('hidden');
    placeholderText.classList.add('hidden');

    // Populate selectors
    classSelectorLabel.textContent = payload.selectors.class;
    classSelectorRadio.value = payload.selectors.class;
    pathSelectorLabel.textContent = payload.selectors.path;
    pathSelectorRadio.value = payload.selectors.path;

    // Set default selector
    if (payload.selectors.default === payload.selectors.class) {
        classSelectorRadio.checked = true;
    } else {
        pathSelectorRadio.checked = true;
    }
    
    // Populate style controls with computed styles
    const { color, fontSize, fontWeight, borderRadius } = payload.computedStyles;
    colorInput.value = rgbToHex(color);
    fontSizeInput.value = parseFloat(fontSize).toString();
    fontWeightInput.value = fontWeight;
    borderRadiusInput.value = parseFloat(borderRadius).toString();

    // Store initial styles
    currentStyles = {
        color: colorInput.value,
        fontSize: `${fontSizeInput.value}px`,
        fontWeight: fontWeightInput.value,
        borderRadius: `${borderRadiusInput.value}px`,
    };
}


// --- Event Handlers ---

function handleToggle(event: Event) {
    const isActive = (event.target as HTMLInputElement).checked;
    chrome.storage.local.set({ inspectorActive: isActive });

    // Send the message DIRECTLY to the content script in the current tab
    if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
            type: "TOGGLE_INSPECTOR",
            payload: { isActive }
        });
    }

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

function handleStyleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const { name, value } = target;

    // Check if the property needs a 'px' unit and add it.
    if (name === 'fontSize' || name === 'borderRadius') {
        currentStyles[name] = `${value}px`;
    } else {
        // For other properties like color or font-weight, use the value directly.
        currentStyles[name] = value;
    }
    
    applyAllStyles();
}

function applyAllStyles() {
    const selectedSelectorInput = document.querySelector('input[name="selector-type"]:checked') as HTMLInputElement;
    if (!selectedSelectorInput || !currentTabId) {
        return;
    }
    const selectedSelector = selectedSelectorInput.value;

    // Send the message with the selector and styles directly to the content script
    chrome.tabs.sendMessage(currentTabId, {
        type: "APPLY_STYLES",
        payload: {
            selector: selectedSelector,
            styles: currentStyles,
        }
    });
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ELEMENT_SELECTED") {
        updateUIWithElementData(message.payload);
    }
});

// --- Utility Functions ---
function rgbToHex(rgb: string): string {
    if (!rgb || !rgb.startsWith('rgb')) return '#000000'; // Default to black
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initialize);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SELECTION_CLEARED") {
        editorPanel.classList.add('hidden');
        placeholderText.classList.remove('hidden');
    }
});