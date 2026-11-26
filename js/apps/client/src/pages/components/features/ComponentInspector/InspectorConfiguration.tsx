import type { Config } from '../../../../controllers';

interface InspectorConfigurationProps {
    config: Config;
    onConfigurationSelect: (configurationId: string | undefined) => void;
}

/**
 * Блок «Конфигурация»: выбор открытой конфигурации, отдельно от вариаций, без сворачивания — одна строка. Показывается
 * при двух конфигурациях и больше.
 */
export const InspectorConfiguration = ({ config, onConfigurationSelect }: InspectorConfigurationProps) => {
    const configurations = config.getConfigurations();
    if (configurations.length < 2) return null;
    return (
        <section className="component-primary-properties component-configuration-block" aria-label="Конфигурация">
            <div className="component-variation-targets">
                <label className="component-variation-picker component-configuration-picker">
                    <span>Конфигурация</span>
                    <span className="component-variation-picker-value">
                        <select
                            aria-label="Конфигурация"
                            value={config.getConfigurationId() ?? ''}
                            onChange={(event) =>
                                onConfigurationSelect(
                                    event.target.value === configurations[0]?.id ? undefined : event.target.value,
                                )
                            }
                        >
                            {configurations.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>
            </div>
        </section>
    );
};
