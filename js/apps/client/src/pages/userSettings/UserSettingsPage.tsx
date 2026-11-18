import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalyticsConsentSettings } from '../../analytics/AnalyticsConsent';
import { analyticsConsentEnabled } from '../../analytics/consent';
import { authService } from '../../api';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { PersonalAccessTokensPanel, type PersonalAccessTokenCounts } from './PersonalAccessTokensPanel';

export const UserSettingsPage = () => {
    const user = authService.getCurrentUser();
    const [searchParams] = useSearchParams();
    const [counts, setCounts] = useState<PersonalAccessTokenCounts>({ total: 0, active: 0, expired: 0 });
    const userId = user?.id ?? '';
    const generalSelected = searchParams.get('section') !== 'personal-access-token';
    return (
        <SettingsFrame
            title="Настройки пользователя"
            entity={user?.displayName ?? 'Пользователь'}
            back="/projects"
            projectName=""
            breadcrumbSegments={[]}
            sections={['Общее', 'Personal Access Token']}
            saveForm={false}
            sectionActions={{ 'personal-access-token': false, general: false }}
            aside={
                !generalSelected && (
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
            {generalSelected && (
                <section id="settings-general" className="settings-section ps-user-general">
                    {analyticsConsentEnabled && <AnalyticsConsentSettings />}
                </section>
            )}
        </SettingsFrame>
    );
};
