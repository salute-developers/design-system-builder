import { Navigate } from 'react-router-dom';

import { isComponentEditorEnabled } from '../../utils/featureFlags';
import { Components } from './Components';

/** Маршрут раздела «Компоненты»: при выключенном разделе ведёт к цветам, а не открывает редактор. */
export const ComponentsRoute = () => (isComponentEditorEnabled() ? <Components /> : <Navigate to="../colors" replace />);
