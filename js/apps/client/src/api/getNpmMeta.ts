export const getNpmMeta = async (packageName: string) => {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    return response.json();
};

export const getNpmPackageName = (packagesName: string) => `@salutejs-ds/${packagesName}`;

export const getNpmPackageUrl = (packagesName: string, version?: string) => {
    const base = `https://www.npmjs.com/package/${getNpmPackageName(packagesName)}`;

    return version ? `${base}/v/${version}` : base;
};

export const getNpmInstallCommand = (packagesName: string, version?: string) =>
    `npm install ${getNpmPackageName(packagesName)}${version ? `@${version}` : ''}`;

export const getNpmLatestVersion = async (packagesName: string): Promise<string | null> => {
    const data = await getNpmMeta(getNpmPackageName(packagesName));

    return data?.['dist-tags']?.latest ?? null;
};
