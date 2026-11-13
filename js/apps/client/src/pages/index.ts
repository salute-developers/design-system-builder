export * from './colors';
export * from './components';
export * from './versionJournal';
export * from './home';
export * from './palette';
export * from './projects';
export * from './shapes';
export * from './typography';
export * from './login';

export { Main } from './Main';
export * from './Main.utils';

// Общие правила экранов токенов — последними, после стилей всех разделов: при равной специфичности они перекрывают
// копии прототипа в CSS экранов.
import '../styles/token-workspace.css';
