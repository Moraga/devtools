const server = 'http://' + config.server.host + ':' + config.server.port;

const api = (path, ...args) => fetch(server + path, ...args);

let a, b;

chrome.runtime.onMessage.addListener(async ([type, value], sender) => {
    switch (type) {
        case 'scroll':
            const i = sender.tab.id;
            // prod to dev
            if (i == a) {
                chrome.tabs.sendMessage(b, ['scroll', value]);
            }
            // dev to prod
            else if (i == b) {
                chrome.tabs.sendMessage(a, ['scroll', value]);
            }
            break;
        
        case 'server':
            const res = await api('/' + value);
            const data = await res.json();
            chrome.tabs.query({}, tabs => {
                for (const {id} of tabs) {
                    chrome.tabs.sendMessage(id, [value, data]);
                }
            });
            break;
        
        case 'connect':
            const [prod, dev] = value;
            chrome.tabs.query({windowId: prod, active: true}, ([tab]) => a = tab.id);
            chrome.tabs.query({windowId: dev}, ([tab]) => b = tab.id);
            break;
    }
});