import { useEffect } from 'react';

import type { Resource } from '../hooks/useResource';
import { ResourceView } from './common';
import { automaticChoice } from './contextSteps';

interface Option {
    id: string;
    name: string;
    description?: string | null;
}

/** Шаг выбора. Единственный или запомненный вариант выбирается сам, пока это не запрещено через [automatic]. */
export const PickerStep = <T extends Option>({
    title,
    resource,
    retry,
    loading,
    empty,
    savedId,
    automatic,
    onSelect,
}: {
    title: string;
    resource: Resource<T[]>;
    retry: () => void;
    loading: string;
    empty: string;
    savedId?: string;
    automatic: boolean;
    onSelect: (option: T) => void;
}) => {
    useEffect(() => {
        if (!automatic || resource.state !== 'ready') return;
        const choice = automaticChoice(resource.data, savedId);
        if (choice) onSelect(choice);
        // Выбор зависит только от пришедшего списка.
    }, [resource, automatic, savedId]);

    return (
        <ResourceView resource={resource} retry={retry} loading={loading}>
            {(options) =>
                options.length ? (
                    <section>
                        <h2>{title}</h2>
                        <ul className="options">
                            {options.map((option) => (
                                <li key={option.id}>
                                    <button type="button" onClick={() => onSelect(option)}>
                                        <span>{option.name}</span>
                                        {option.description && <small>{option.description}</small>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : (
                    <p className="status">{empty}</p>
                )
            }
        </ResourceView>
    );
};
