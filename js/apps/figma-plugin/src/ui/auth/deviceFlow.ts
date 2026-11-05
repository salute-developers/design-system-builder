import {
    OAuthError,
    TransportError,
    type AuthEndpoints,
    type DeviceAuthorization,
    type TokenPair,
} from './authEndpoints';

/** Прибавка к интервалу после `slow_down` по RFC 8628. */
const SLOW_DOWN_SECONDS = 5;

const wait = (milliseconds: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, milliseconds);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new DOMException('Вход отменён', 'AbortError'));
            },
            { once: true },
        );
    });

/**
 * Опрашивает token endpoint, пока пользователь не подтвердит вход в браузере. `expired_token` и `access_denied`
 * завершают опрос ошибкой; сетевой сбой не прерывает ожидание: пользователь ещё может подтвердить вход.
 */
export const pollForTokens = async (
    endpoints: Pick<AuthEndpoints, 'exchangeDeviceCode'>,
    device: DeviceAuthorization,
    signal: AbortSignal,
): Promise<TokenPair> => {
    const deadline = Date.now() + device.expiresInSeconds * 1000;
    let intervalSeconds = device.intervalSeconds;
    for (;;) {
        await wait(intervalSeconds * 1000, signal);
        if (Date.now() >= deadline) throw new OAuthError('expired_token');
        try {
            return await endpoints.exchangeDeviceCode(device.deviceCode, signal);
        } catch (error) {
            if (error instanceof TransportError) continue;
            if (!(error instanceof OAuthError)) throw error;
            if (error.code === 'slow_down') intervalSeconds += SLOW_DOWN_SECONDS;
            else if (error.code !== 'authorization_pending') throw error;
        }
    }
};
