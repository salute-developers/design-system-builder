export const createRootIndex = (components: string[]) => {
    const componentsName = components
        .map((componentName) => `export * from './components/${componentName}';`)
        .join('\n');

    return `${componentsName ? `${componentsName}\n\n` : ''}export * from './theme';\n`;
};
