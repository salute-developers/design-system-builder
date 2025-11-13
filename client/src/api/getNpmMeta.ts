export const getNpmMeta = async (packageName: string) => {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    return response.json();
};