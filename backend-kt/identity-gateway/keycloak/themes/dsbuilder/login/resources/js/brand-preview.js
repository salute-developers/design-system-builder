// Карусель повторяет BrandPreview web-клиента; к данным формы не обращается.
document.addEventListener('DOMContentLoaded', () => {
    const tip = document.querySelector('#dsbuilder-tip');
    const buttons = [...document.querySelectorAll('.dsbuilder-bullet')];
    if (!tip || !buttons.length) return;

    let index = Math.floor(Math.random() * buttons.length);
    let timer;
    const show = (next) => {
        const direction = next >= index ? 1 : -1;
        index = next;
        const { topic, title, description } = buttons[index].dataset;
        tip.querySelector('.dsbuilder-topic').textContent = topic;
        tip.querySelector('.dsbuilder-tip-title').textContent = title;
        tip.querySelector('.dsbuilder-description').textContent = description;
        buttons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            tip.animate([
                { opacity: 0, transform: `translateX(${direction * 24}px)` },
                { opacity: 1, transform: 'translateX(0)' },
            ], { duration: 300, easing: 'ease-out' });
        }
    };
    const restart = () => {
        clearInterval(timer);
        timer = setInterval(() => show((index + 1) % buttons.length), 8000);
    };
    buttons.forEach((button, position) => button.addEventListener('click', () => {
        show(position);
        restart();
    }));
    show(index);
    restart();
    window.addEventListener('pagehide', () => clearInterval(timer));
    window.addEventListener('pageshow', restart);
});
