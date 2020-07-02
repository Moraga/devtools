import requests
import re
import json
from flask import Flask, Response, request, jsonify
from urllib.parse import urlparse
from pygit2 import Repository


# import settings
with open('config.js') as f:
    data = f.read()
    config = json.loads(data[data.find('{'):data.rfind('}')+1])


app = Flask(__name__)
dev = config['project']['dev']
repo = Repository(config['project']['path'])


class HTTPAdapter(requests.adapters.HTTPAdapter):
    def resolve(self, hostname):
        print(hostname)
        return '127.0.0.1'
    
    def send(self, request, **kwargs):
        connection_pool_kwargs = self.poolmanager.connection_pool_kw
        result = urlparse(request.url)
        request.url = request.url.replace(
            'http://' + result.hostname,
            'http://127.0.0.1:8080',
        )
        request.headers['Host'] = result.hostname
        # print('\n\n\n', request.headers['User-Agent'], '\n\n\n')
        return super(HTTPAdapter, self).send(request, **kwargs)


# setup proxy
session = requests.Session()
session.mount('http://', HTTPAdapter())
excluded_headers = ('content-encoding', 'content-length', 'transfer-encoding', 'connection')


@app.route('/git/branch')
def get_git_branch():
    return jsonify({'name': repo.head.name.rsplit('/', 1)[-1]})


@app.route('/git/branch', methods=['POST'])
def git_branch_checkout():
    name = request.json['name']
    branch = repo.lookup_branch(name)
    ref = repo.lookup_reference(branch.name)
    repo.checkout(ref)
    return jsonify()


@app.route('/git/branches/<src>')
def git_branch_list(src):
    branches = getattr(repo.branches, src)
    return jsonify({
        'current': repo.head.name.rsplit('/', 1)[-1],
        'local': list(map(str, branches))
    })


@app.route('/git/log')
def git_log():
    commits = []
    for commit in repo.walk(repo.head.target):
        commits.append({
            'author': commit.author.name,
            'message': commit.message,
            'date': commit.commit_time
        })
        if len(commits) >= 3:
            break
    return jsonify(commits)


@app.route('/',  defaults={'path': '/'})
@app.route('/<path:path>')
def proxy(path):
    domain = request.headers['Host'].split(':')[0]
    if domain.find(dev) == 0:
        domain = domain[len(dev):]
    request_url = 'http://' + domain + '/' + path
    qs = request.query_string
    if qs:
        request_url += '?' + qs.decode('utf-8')
    resp = session.get(request_url, headers=request.headers, verify=False)
    headers = [(name, value) for (name, value) in  resp.raw.headers.items() if name.lower() not in excluded_headers]
    content = resp.content.decode('utf-8')
    content = re.sub('(https?:)?//c.jsuol.com.br', 'http://' + dev + 'c.jsuol.com.br:' + str(config['server']['port']), content)
    return Response(content, resp.status_code, headers)


if __name__ == '__main__':
    app.run(**config['server'])
