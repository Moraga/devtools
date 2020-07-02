const config = chrome.extension.getBackgroundPage().config;
const env = document.querySelector('#env');
const commits = document.querySelector('#commits');
const branches = document.querySelector('#branches');
const pageInfo = document.querySelector('#page-info');

const server = 'http://' + config.server.host + ':' + config.server.port;

// url da aba ativa
let URL;

// id da aba ativa
let TID;

const api = (path, ...args) => fetch(server + path, ...args);

const getDev = url => url.replace(/[^:]+:\/\/([^/]+)/, (_, a) => 'http://' + config.project.dev + a + ':' + config.server.port);
const getProd = url => url.replace(new RegExp('(^[^:]+://)' + config.project.dev), '$1').replace(/:\d+\//, '/');

chrome.tabs.query({currentWindow: true, active: true}, ([{id, url}]) => {
    URL = url;
    TID = id;

    start();

    // consulta informações da página (ver content.js)
    chrome.tabs.sendMessage(id, ['info'], ({js, css}) => {
        let info = '';
        const re = /[?&](([^=&]+)(?:=([^&#]+))?)/g;
        const map = new Map;

        for (const src of js.external) {
            for ([, kv, k, v=''] of src.matchAll(re)) {
                map.set(kv, [k, v]);
            }
        }

        const jsp = [...map.values()].sort(([a, ], [b, ]) => a.localeCompare(b)).map(([k, v]) => k + '=' + v);

        info += '<h4>Javascript</h4>';
        info += jsp.join('<br>')
        info += '<h5>Inline (' + js.inline.length + ')</h5>' + js.inline.reduceRight((x, y) => x + y);
        info += '<h5>Externo</h5>' + js.external.join('<br>');

        info += '<h4>CSS</h4>'
        info += '<h5>Inline (' + css.inline.length + ')</h5>' + css.inline.reduceRight((x, y) => x + y);
        info += '<h5>Externo</h5>' + css.external.join('<br>');

        pageInfo.innerHTML = info;
    });
});

// troca de branch
branches.addEventListener('change', () => {
    api('/git/branch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({name: branches.value})
    }).then(async res => {
        // atualiza últimos commits
        git.log();
        
        chrome.tabs.query({currentWindow: true, active: true}, ([{id}]) => chrome.tabs.reload(id));
    });
});

const git = {
    log() {
        api('/git/log').then(async res => {
            let html = '';
            for (const {author, message} of await res.json()) {
                html += `<li>${message}<br><small>${author}</small></li>`;
            }
            commits.innerHTML = html;
        });
    }
};

api('/git/branches/local').then(async res => {
    const data = await res.json();
    for (const branch of data.local) {
        const o = document.createElement('option');
        o.text = branch;
        branches.appendChild(o);
    }
    branches.value = data.current;
})

function start() {
    git.log();
    env.innerHTML = /:\/\/dev\./.test(URL) ? 'Prod' : 'Dev';
}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tabId == TID) {
        URL = tab.url;
        start();
    }
});

env.addEventListener('click', () => {
    let url = (env.innerHTML == 'Dev' ? getDev : getProd)(URL);
    chrome.tabs.update(TID, {url});
}, true);

document.querySelectorAll('#ver, #hor').forEach(btn => 
    btn.addEventListener('click', event => {
        chrome.tabs.query({currentWindow: true, active: true}, ([{id, url}]) => {
            const prod = getProd(url);
            const dev = getDev(url);

            if (url != prod) {
                chrome.tabs.update(id, {url: prod});
            }
            
            chrome.windows.getCurrent(prodWindow => {
                const vert = event.target.id == 'ver';
                const width = parseInt(screen.availWidth / (vert ? 2 : 1));
                const height = parseInt(screen.availHeight / (vert ? 1 : 2));
        
                chrome.windows.update(prodWindow.id, {top: 0, left: 0, width, height});
        
                let top, left;

                if (vert) {
                    top = 0;
                    left = width;
                }
                else {
                    top = height;
                    left = 0;
                }

                chrome.windows.create({
                    width,
                    height,
                    top,
                    left,
                    url: dev,
                }, devWindow => {
                    chrome.runtime.sendMessage(['connect', [prodWindow.id, devWindow.id]]);
                });
            });
        });
    }));

function param(url, k, v) {
    const re = new RegExp('(' + k + '=)[^&#]+')
    let nu = url.replace(re, (_, r) => r + v);
    if (nu == url) {
        const se = /[?#]?$/.exec(nu);
        if (se) {
            if (se[0] == '?') {
                nu = nu.substr(0, se.index + 1) + k + '=' + v + '&' + nu.substr(se.index + 1);
            }
            else {
                nu = nu.substr(0, se.index) + '?' + k + '=' + v + nu.substr(se.index);
            }
        }
    }
    return nu;
}
