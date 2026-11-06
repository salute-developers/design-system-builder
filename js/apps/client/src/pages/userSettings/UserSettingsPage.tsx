import { useState } from 'react';
import { authService } from '../../api';
import { SettingsFrame } from '../../components/BuilderShell/BuilderShell';
import { PersonalAccessTokensPanel, type PersonalAccessTokenCounts } from './PersonalAccessTokensPanel';

export const UserSettingsPage = () => {
    const user = authService.getCurrentUser();
    const [counts, setCounts] = useState<PersonalAccessTokenCounts>({ total: 0, active: 0, expired: 0 });
    const userId = user?.id ?? '';
    return <SettingsFrame title="Настройки пользователя" entity={user?.displayName ?? 'Пользователь'}
        back="/projects" projectName="" breadcrumbSegments={[]} sections={['Personal Access Token']} saveForm={false}
        sectionActions={{ 'personal-access-token': false }}
        aside={<div className="ps-aside-section-block"><p className="ps-aside-section">Personal Access Token</p>
            <div className="ps-aside-row"><span>Всего токенов</span><strong>{counts.total}</strong></div>
            <div className="ps-aside-row"><span>Активные</span><strong>{counts.active}</strong></div>
            <div className="ps-aside-row"><span>Истёкшие</span><strong>{counts.expired}</strong></div></div>}>
        <section id="settings-personal-access-token" className="settings-section">
            <PersonalAccessTokensPanel key={userId} userId={userId} onCountsChange={setCounts} />
        </section>
    </SettingsFrame>;
};
