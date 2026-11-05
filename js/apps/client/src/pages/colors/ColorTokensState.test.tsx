import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TreeSort } from '../../modules/colorTokens';
import { ColorTokensState } from './ColorTokensScreen';
import { ColorTokenTree } from './ui/ColorTokenTree';

afterEach(cleanup);

describe('состояния раздела «Цвета»', () => {
    it('загрузка — шапки панелей и скелетоны, без текста', () => {
        render(<ColorTokensState />);
        expect(screen.getByTestId('color-tokens-loading')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-skeleton]')).toHaveLength(3);
        expect(screen.getByText('Обзор')).toBeInTheDocument();
    });

    it('ошибка загрузки — заголовок, подсказка и «Повторить» без текста исключения', () => {
        const retry = vi.fn();
        render(<ColorTokensState error onRetry={retry} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить цветовые токены');
        expect(screen.getByRole('alert')).toHaveTextContent('Проверьте подключение и попробуйте ещё раз.');
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('пустой раздел сообщает, что токенов нет, а не «ничего не найдено»', () => {
        const noop = vi.fn();
        render(
            <ColorTokenTree
                tree={[]}
                groups={[]}
                tokens={[]}
                selectedId={null}
                sort={'az' as TreeSort}
                query=""
                searchOpen={false}
                issuesOnly={false}
                collapsed={{}}
                editable={false}
                canDelete={false}
                status={() => ({ state: 'saved', error: null }) as never}
                onSelect={noop}
                onSort={noop}
                onQuery={noop}
                onSearchOpen={noop}
                onIssuesOnly={noop}
                onToggle={noop}
                onExpand={noop}
                onCreateGroup={noop}
                onCreateToken={noop}
                onRenameGroup={noop}
                onRenameToken={noop}
                onDeleteGroup={noop}
                onDeleteToken={noop}
                onMoveToken={noop}
                onMoveGroup={noop}
            />,
        );
        expect(screen.getByRole('status')).toHaveTextContent('В теме пока нет цветовых токенов');
        expect(screen.queryByText('По вашему запросу ничего не найдено')).toBeNull();
    });
});
