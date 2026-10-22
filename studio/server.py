#!/usr/bin/env python3
"""Private, dependency-free publishing studio. Run: python3 studio/server.py"""
import base64
import json
import os
from pathlib import Path
import secrets
import re
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit, unquote
from datetime import datetime, timezone
import webbrowser
import threading

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / '.studio'
TOKEN = secrets.token_urlsafe(32)
PORT = int(os.environ.get('STUDIO_PORT', '8765'))
ORIGIN = f'http://127.0.0.1:{PORT}'
CATEGORIES = {'art', 'music', 'yoyo', 'math'}


def read_json(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def git(*args):
    result = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise ValueError(result.stderr.strip() or result.stdout.strip() or 'Git command failed')
    return result.stdout.strip()


def validate(post):
    if post.get('category') not in CATEGORIES:
        raise ValueError('Choose a category.')
    for key, limit in [('title', 200), ('body', 100000), ('summary', 500), ('mediaUrl', 2000)]:
        if not isinstance(post.get(key, ''), str) or len(post.get(key, '')) > limit:
            raise ValueError(f'Invalid {key}.')
    if not post.get('title', '').strip():
        raise ValueError('Add a title first.')
    if post.get('mediaUrl'):
        url = urlsplit(post['mediaUrl'])
        if url.scheme != 'https' or not url.netloc:
            raise ValueError('Media links must be complete HTTPS URLs.')
    images = post.get('images', [])
    if not isinstance(images, list) or len(images) > 30:
        raise ValueError('Use at most 30 photos per post.')
    for image in images:
        if not isinstance(image, dict) or not isinstance(image.get('alt'), str) or not image['alt'].strip():
            raise ValueError('Describe each photo for accessibility.')
        name = image.get('src', '')
        if not isinstance(name, str) or not name.startswith('uploads/') or Path(name).name != name.removeprefix('uploads/') or not (ROOT / name).is_file():
            raise ValueError('Invalid photo path.')
    return {key: post.get(key, '') for key in ['title', 'body', 'summary', 'mediaUrl', 'category']} | {'images': images}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed(self):
        return self.headers.get('Host') == f'127.0.0.1:{PORT}'

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def reply(self, value, status=200):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self.allowed():
            return self.reply({'error': 'Use the localhost URL shown in the terminal.'}, 403)
        path = unquote(urlsplit(self.path).path)
        if path == '/api/session':
            return self.reply({'token': TOKEN, 'drafts': read_json(STATE / 'drafts.json', []), 'posts': read_json(ROOT / 'content/posts.json', [])})
        # Never serve Git metadata, drafts, server sources, or arbitrary files.
        if path == '/':
            self.path = '/studio/index.html'
        elif path not in ['/index.html', '/styles.css', '/script.js', '/posts.js', '/studio/index.html', '/studio/studio.css', '/studio/studio.js', '/content/posts.json'] and not re.fullmatch(r'/uploads/[a-f0-9]{32}\.(jpg|png|webp)', path) and not re.fullmatch(r'/[a-f0-9]{32}\.jpg', path):
            return self.reply({'error': 'Not found'}, 404)
        return super().do_GET()

    def do_POST(self):
        if not self.allowed() or self.headers.get('Origin') != ORIGIN or self.headers.get('X-Studio-Token') != TOKEN:
            return self.reply({'error': 'Unauthorized request. Reload the studio.'}, 403)
        try:
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 16000000:
                raise ValueError('Request too large. Photos must be under 10 MB.')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Invalid request.')
            path = urlsplit(self.path).path
            if path == '/api/upload':
                raw = base64.b64decode(data['data'], validate=True)
                if len(raw) > 10 * 1024 * 1024:
                    raise ValueError('Photos must be under 10 MB.')
                extension = '.jpg' if raw.startswith(b'\xff\xd8\xff') else '.png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else '.webp' if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP' else None
                if not extension:
                    raise ValueError('Upload a JPEG, PNG, or WebP photo.')
                name = 'uploads/' + secrets.token_hex(16) + extension
                (ROOT / 'uploads').mkdir(exist_ok=True)
                (ROOT / name).write_bytes(raw)
                return self.reply({'src': name})
            if path not in ['/api/save', '/api/delete', '/api/publish', '/api/push']:
                return self.reply({'error': 'Not found'}, 404)
            if path == '/api/push':
                git('push', 'origin', 'HEAD')
                return self.reply({'message': 'Pushed to GitHub. GitHub Pages may take a few minutes to update.'})
            drafts = read_json(STATE / 'drafts.json', [])
            posts = read_json(ROOT / 'content/posts.json', [])
            identifier = data.get('id')
            if identifier and not any(p['id'] == identifier for p in drafts + posts):
                raise ValueError('Post not found. Reload the studio.')
            identifier = identifier or secrets.token_hex(12)
            if path == '/api/delete':
                save_json(STATE / 'drafts.json', [p for p in drafts if p['id'] != identifier])
                return self.reply({'message': 'Local draft removed. Published posts are unchanged.'})
            post = validate(data) | {'id': identifier, 'date': next((p['date'] for p in posts if p['id'] == identifier), datetime.now(timezone.utc).isoformat())}
            drafts = [p for p in drafts if p['id'] != identifier] + [post]
            save_json(STATE / 'drafts.json', drafts)
            if path == '/api/save':
                return self.reply({'post': post, 'message': 'Draft saved on this computer.'})
            # The renderer must be in Git before content-only publishing can work.
            try:
                git('ls-files', '--error-unmatch', 'posts.js', 'content/posts.json')
            except ValueError:
                raise ValueError('One-time setup needed: commit the studio and website integration files first. See README.md. Your draft is saved.')
            if git('diff', 'HEAD', '--', 'index.html', 'styles.css', 'posts.js'):
                raise ValueError('Commit the website integration changes first so published posts can be displayed. See README.md. Your draft is saved.')
            # Refuse to absorb other staged work into a publishing commit.
            if git('diff', '--', 'content/posts.json'):
                raise ValueError('content/posts.json has manual changes. Commit or restore them first. Your draft is saved.')
            if git('diff', '--cached', '--name-only'):
                raise ValueError('There are staged Git changes. Commit or unstage them before publishing. Your draft is saved.')
            post_paths = ['content/posts.json'] + [im['src'] for im in post['images']]
            # Preserve unrelated, unpublished uploads; only add this post’s images.
            save_json(ROOT / 'content/posts.json', [p for p in posts if p['id'] != identifier] + [post])
            git('add', '--', *post_paths)
            if git('diff', '--cached', '--name-only'):
                git('commit', '-m', f'content: publish {post["title"][:100]}')
            try:
                git('push', 'origin', 'HEAD')
            except (ValueError, subprocess.TimeoutExpired):
                return self.reply({'post': post, 'message': 'Saved and committed locally, but push failed. Check your GitHub login/network, then click Retry push. Your draft is retained.', 'pending': True})
            save_json(STATE / 'drafts.json', [p for p in drafts if p['id'] != identifier])
            return self.reply({'post': post, 'message': 'Published to GitHub. Allow a few minutes for GitHub Pages to update.'})
        except (ValueError, KeyError, TypeError, OSError, subprocess.TimeoutExpired) as error:
            self.reply({'error': str(error)}, 400)


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Publishing studio: {ORIGIN}\nKeep this terminal open. Ctrl+C to stop.', flush=True)
    threading.Timer(0.5, lambda: webbrowser.open(ORIGIN)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
