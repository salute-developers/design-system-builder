export const createRootIndex = (components: string[]) => {
    const componentsName = components
        .map((componentName) => `export * from './components/${componentName}';`)
        .join('\n');

    return `${componentsName}
    
export * from './theme'
`;
};
