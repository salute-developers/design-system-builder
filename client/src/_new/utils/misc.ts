export const prettifyColorName = (input: string) => {
    const words = input.replace(/([a-z])([A-Z])/g, '$1 $2');
    return words
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
