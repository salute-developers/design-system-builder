import { useState } from 'react';
import { AnalyticsConsentSettings } from '../../analytics/AnalyticsConsent';
import { analyticsConsentEnabled } from '../../analytics/consent';
import { authService } from '../../api';
import {
    SettingsFrame,
    useActiveSettingsSection,
    type SettingsSection,
} from '../../components/BuilderShell/BuilderShell';
import { PersonalAccessTokensPanel, type PersonalAccessTokenCounts } from './PersonalAccessTokensPanel';

const generalSections: SettingsSection[] = ['Общее', 'Personal Access Token'];
const tokenSections: SettingsSection[] = ['Personal Access Token'];

export const UserSettingsPage = () => {
    const user = authService.getCurrentUser();
    const sections = analyticsConsentEnabled ? generalSections : tokenSections;
    const active = useActiveSettingsSection(sections);
    const [counts, setCounts] = useState<PersonalAccessTokenCounts>({ total: 0, active: 0, expired: 0 });
    const userId = user?.id ?? '';
    return (
        <SettingsFrame
            title="Настройки пользователя"
            entity={user?.displayName ?? 'Пользователь'}
            back="/projects"
            projectName=""
            breadcrumbSegments={[]}
            sections={sections}
            saveForm={false}
            sectionActions={{ 'personal-access-token': false, 'user-general': false }}
            aside={
                active === 'Personal Access Token' && (
                    <div className="ps-aside-section-block">
                        <p className="ps-aside-section">Personal Access Token</p>
                        <div className="ps-aside-row">
                            <span>Всего токенов</span>
                            <strong>{counts.total}</strong>
                        </div>
                        <div className="ps-aside-row">
                            <span>Активные</span>
                            <strong>{counts.active}</strong>
                        </div>
                        <div className="ps-aside-row">
                            <span>Истёкшие</span>
                            <strong>{counts.expired}</strong>
                        </div>
                    </div>
                )
            }
        >
            <section id="settings-personal-access-token" className="settings-section">
                <PersonalAccessTokensPanel key={userId} userId={userId} onCountsChange={setCounts} />
            </section>
            {analyticsConsentEnabled && (
                <section id="settings-user-general" className="settings-section ps-user-general">
                    <AnalyticsConsentSettings active={active === 'Общее'} />
                </section>
            )}
        </SettingsFrame>
    );
};
