import type { UiToMain } from '../shared/messages';
import { applyExportPlan } from './applyExportPlan';
import { handleMessage, type PluginHost } from './handleMessage';

figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

const host: PluginHost = {
    getValue: (key) => figma.clientStorage.getAsync(key),
    setValue: (key, value) => figma.clientStorage.setAsync(key, value),
    deleteValue: (key) => figma.clientStorage.deleteAsync(key),
    openExternal: (url) => figma.openExternal(url),
    applyExport: (plan) => applyExportPlan(plan, figma),
    reply: (message) => figma.ui.postMessage(message),
};

figma.ui.onmessage = (message: UiToMain) => void handleMessage(message, host);
