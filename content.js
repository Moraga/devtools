/**
 * Script embedado nas páginas
 * Acesso ao DOM, js e demais recursos
 */

// div com dados do GIT
let git = null;

// publica/propaga o scroll para background
let pub = true;

// comandos remotos
const rpc = {
    scroll(y) {
        pub = false;
        window.scrollTo(0, y);
        setTimeout(() => pub = true, 100);
    },

    'git/branch'({name}) {
        git.innerHTML = name;
    },

    info() {
        const data = {
            css: {inline: [], external: []},
            js : {inline: [], external: []},
        };

        const todo = [
            ['link[rel=stylesheet]', data.css.external, e => e.href],
            ['style', data.css.inline, e => e.textContent.length],
            ['script[src]', data.js.external, e => e.src],
            ['script:not([src])', data.js.inline, e => e.textContent.length],
        ];

        for (const [selector, ref, parse] of todo) {
            for (const e of document.querySelectorAll(selector)) {
                ref.push(parse(e));
            }
        }

        return data;
    }
} 

chrome.runtime.onMessage.addListener(([cmd, ...args], sender, sendResponse) => sendResponse(rpc[cmd](...args)));

window.addEventListener('scroll', () => pub && chrome.runtime.sendMessage(['scroll', window.scrollY]));

// cria elemento com status do GIT em ambiente DEV
if (location.hostname.substr(0, 4) == 'dev.') {
    git = document.createElement('div');
    git.style.background = 'red';
    git.style.color = '#fff';
    git.style.font = '12px Arial';
    git.style.padding = '1px 4px';
    git.style.position = 'fixed';
    git.style.top = '0';
    git.style.right = '5px';
    git.style.zIndex = '99999999';
    document.body.appendChild(git);
    chrome.runtime.sendMessage(['server', 'git/branch']);
}