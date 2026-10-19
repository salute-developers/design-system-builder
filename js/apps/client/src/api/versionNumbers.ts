export const nextPatchVersion = (versions: string[]): string => {
    const ordered = versions
        .map((version) => version.split('.').map(Number))
        .filter((parts) => parts.length === 3 && parts.every(Number.isInteger))
        .sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
    const latest = ordered[ordered.length - 1];
    return latest ? `${latest[0]}.${latest[1]}.${latest[2] + 1}` : '0.1.0';
};
