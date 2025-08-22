// src/background.ts

// Listen for the user clicking the extension icon
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        // Send a message to the content script to toggle the UI panel
        chrome.tabs.sendMessage(tab.id, {
            type: "TOGGLE_EDITOR_PANEL"
        });
    }
});