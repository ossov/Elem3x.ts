# Elem3x.ts

A Chrome extension for inspecting and editing CSS on any page, without opening devtools. Click
an element and get a GUI of its CSS properties, pre-filled with the values actually in effect -
change them and see the result live.

This is the TypeScript rewrite of [Elem3x](https://github.com/ossov/Elem3x), rebuilt around a
proper module structure and a webpack build. The original took a plain-English instruction and
asked an LLM for the CSS; **this version replaces that with a direct GUI** covering the full
property set, so there's no API key and no round trip.

## How it works

1. **Select** - hover to highlight elements; clicking one builds a selector for it
2. **Inspect** - the panel reads the element's computed styles and fills the controls with its
   current values
3. **Edit** - changes apply to the page immediately

Selection state persists through `chrome.storage`, so the panel survives being reopened.

## Running it

```bash
npm install
npx webpack        # builds src/*.ts -> dist/
```

Then load it in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select this folder.

`dist/` is generated and not tracked - build before loading.

## Layout

| Path | |
|---|---|
| `src/content.ts` | Element selection, highlighting, applying styles to the page |
| `src/popup.ts` | The property GUI and its state |
| `src/background.ts` | Service worker |
| `src/utils.ts` | Shared helpers |
| `webpack.config.js` | Bundles each entry point into `dist/` |

## Stack

TypeScript · webpack · Chrome Manifest V3
