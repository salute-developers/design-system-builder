export const useAuth = () => {
    const isAuthenticated = localStorage.getItem('status') === 'authorized';

    return { isAuthenticated };
};
