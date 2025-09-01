// src/content.ts

import { toKebabCase } from "./utils";

let isInspectorActive = false;
let selectedElement: HTMLElement | null = null;
let highlightOverlay: HTMLDivElement | null = null;
let styleTag: HTMLStyleElement | null = null;
let editorIframe: HTMLIFrameElement | null = null;

// --- Editor Panel Logic ---

function toggleEditorPanel() {
    if (editorIframe) {
        editorIframe.remove();
        editorIframe = null;
        deactivateInspector(); // Turn off inspector when panel is closed
    } else {
        editorIframe = document.createElement('iframe');
        editorIframe.id = 'elem3x-editor-iframe';
        editorIframe.src = chrome.runtime.getURL('popup.html');
        document.body.appendChild(editorIframe);
    }
}


// --- Inspector Logic ---

function createHighlightOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.backgroundColor = 'rgba(0, 110, 255, 0.3)';
    overlay.style.border = '2px solid #006eff';
    overlay.style.zIndex = '999999';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
    return overlay;
}

function updateOverlay(target: HTMLElement) {
    if (!highlightOverlay) return;
    const rect = target.getBoundingClientRect();
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    highlightOverlay.style.display = 'block';
}

const handleMouseMove = (event: MouseEvent) => {
    if (!isInspectorActive) return;
    const target = event.target as HTMLElement;
    if (target && target !== highlightOverlay && target !== editorIframe) {
        updateOverlay(target);
    }
};

const handleClick = (event: MouseEvent) => {
    if (!isInspectorActive || (editorIframe && editorIframe.contains(event.target as Node))) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;

    if (target === selectedElement) {
        console.log("Unlocking element");
        selectedElement = null;
        chrome.storage.local.remove("selectionData");
        if(highlightOverlay) highlightOverlay.style.display = 'none';
        document.addEventListener('mousemove', handleMouseMove, true);
        chrome.runtime.sendMessage({ type: "SELECTION_CLEARED" });
        return;
    }

    console.log("Locking element:", target);
    selectedElement = target;
    updateOverlay(target);
    document.removeEventListener('mousemove', handleMouseMove, true);

    const selectors = generateSelectors(target);
    const computedStyles = getComputedStyles(target);
    const defaultSelector = (selectors.simpleCount === 1) ? selectors.simple : selectors.specific;

    const selectionData = { 
        selectors: {
            class: selectors.simple || "N/A",
            path: selectors.specific || "N/A",
            default: defaultSelector
        }, 
        computedStyles 
    };

    chrome.runtime.sendMessage({ type: "ELEMENT_SELECTED", payload: selectionData });
    chrome.storage.local.set({ selectionData });
};

function activateInspector() {
    if (!highlightOverlay) {
        highlightOverlay = createHighlightOverlay();
    }
    isInspectorActive = true;
    selectedElement = null; // Ensure we start fresh
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
}

function deactivateInspector() {
    if (highlightOverlay) {
        highlightOverlay.style.display = 'none';
    }
    isInspectorActive = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    chrome.storage.local.set({ inspectorActive: false, selectionData: null });
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TOGGLE_EDITOR_PANEL") {
        toggleEditorPanel();
    }
    if (message.type === "TOGGLE_INSPECTOR") {
        if (message.payload.isActive) {
            activateInspector();
        } else {
            deactivateInspector();
        }
    }
    // Add this block back in
    if (message.type === "APPLY_STYLES") {
        applyStyles(message.payload.selector, message.payload.styles);
    }
});


// Helper functions (getComputedStyles, generateSelectors, etc.) remain the same
// ... Make sure the generateSelectors, getComputedStyles, applyStyles, and cssCase functions are still present here ...

function generateSelectors(el: Element): { simple?: string; specific?: string; simpleCount?: number } {
    if (!(el instanceof Element)) return {};

    const selectors: { simple?: string; specific?: string; simpleCount?: number } = {};

    // --- Part 1: Generates the Simple Selector ---
    const simplePath: string[] = [];
    let currentEl: Element | null = el;
    let stoppedAtClass = false;
    while (currentEl) {
        let selectorPart = currentEl.nodeName.toLowerCase();
        
        const descriptiveClass = Array.from(currentEl.classList).find(c => 
            /^[a-zA-Z][a-zA-Z_-]*$/.test(c) && c !== 'highlight-element'
        );

        if (descriptiveClass) {
            selectorPart = `${selectorPart}.${descriptiveClass}`;
            simplePath.unshift(selectorPart);
            stoppedAtClass = true;
            break; // Stop at the first parent with a good class
        } else {
            let sib: Element | null = currentEl;
            let nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === currentEl.nodeName.toLowerCase()) nth++;
            }
            if (nth !== 1) selectorPart += `:nth-of-type(${nth})`;
            simplePath.unshift(selectorPart);
        }
        
        currentEl = currentEl.parentElement;
    }
    
    if (stoppedAtClass && simplePath.length > 2) {
        const firstPart = simplePath[0];
        const lastPart = simplePath[simplePath.length - 1].split(':')[0];
        selectors.simple = `${firstPart} > ${lastPart}`;
    } else {
        selectors.simple = simplePath.join(" > ");
    }

    try {
        if (selectors.simple) {
            selectors.simpleCount = document.querySelectorAll(selectors.simple).length;
        }
    } catch (e) {
        selectors.simpleCount = 1;
    }

    // --- Part 2: Generates the Detailed Selector ---
    const specificPath: string[] = [];
    currentEl = el; // Reset for the second path
    while (currentEl && currentEl.nodeType === Node.ELEMENT_NODE) {
        let selectorPart = currentEl.nodeName.toLowerCase();
        if (currentEl.id) {
            selectorPart = `#${currentEl.id}`;
            specificPath.unshift(selectorPart);
            break;
        } else {
            let sib: Element | null = currentEl;
            let nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === currentEl.nodeName.toLowerCase()) nth++;
            }
            if (nth !== 1) selectorPart += `:nth-of-type(${nth})`;
        }
        specificPath.unshift(selectorPart);
        currentEl = currentEl.parentElement;
    }
    selectors.specific = specificPath.join(" > ");

    return selectors;
}



function getComputedStyles(el: HTMLElement) {
    const styles = window.getComputedStyle(el);
    const allStyles: { [key: string]: string } = {};
    const properties = [
        // Typography
        'color', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'lineHeight', 
        'textDecoration', 'letterSpacing', 'wordSpacing', 'textTransform',
        // Layout & Spacing
        'display', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 
        'paddingLeft', 'justifyContent', 'alignItems',
        // Appearance
        'backgroundColor', 'opacity', 'border', 'borderRadius', 'boxShadow',
        // Advanced
        'transform', 'transition'
    ];
    
    properties.forEach(prop => {
        allStyles[prop] = styles.getPropertyValue(toKebabCase(prop));
    });

    return allStyles;
}


function applyStyles(selector: string, styles: Record<string, string>) {
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'elem3x-styles';
        document.head.appendChild(styleTag);
    }
    
    // This is the line to change
    const styleRules = Object.entries(styles)
      .map(([prop, value]) => `${toKebabCase(prop)}: ${value} !important;`)
      .join(' ');

    styleTag.innerHTML = `${selector} { ${styleRules} }`;
}
