"""Integration tests use temporary repositories; never touch the real website."""
import base64
import http.client
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from http.server import HTTPServer

spec = importlib.util.spec_from_file_location('studio_server', Path(__file__).with_name('server.py'))
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        studio.ROOT = root / 'site'
        studio.ROOT.mkdir()
        studio.STATE = studio.ROOT / '.studio'
        self.remote = root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(self.remote)], check=True, capture_output=True)
        studio.git('init', '-b', 'main')
        studio.git('config', 'user.email', 'test@example.com')
        studio.git('config', 'user.name', 'Test')
        studio.save_json(studio.ROOT / 'content/posts.json', [])
        (studio.ROOT / 'posts.js').write_text('// Installed renderer')
        vendor = studio.ROOT / 'assets/vendor/markdown-it.min.js'
        vendor.parent.mkdir(parents=True)
        vendor.write_text('// Installed Markdown parser')
        studio.git('add', 'content/posts.json', 'posts.js', 'assets/vendor/markdown-it.min.js')
        studio.git('commit', '-m', 'Initial content')
        studio.git('remote', 'add', 'origin', str(self.remote))
        self.server = HTTPServer(('127.0.0.1', 0), studio.Handler)
        studio.PORT = self.server.server_port
        studio.ORIGIN = f'http://127.0.0.1:{studio.PORT}'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.post = {'title': 'A new exploration', 'category': 'math', 'body': 'Hello **world**. \\(x^2\\)', 'images': []}

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', studio.PORT)
        defaults = {'Origin': studio.ORIGIN, 'X-Studio-Token': studio.TOKEN, 'Content-Type': 'application/json'}
        defaults.update(headers or {})
        payload = data if isinstance(data, bytes) else json.dumps(data) if data is not None else None
        connection.request('POST' if data is not None else 'GET', path, payload, defaults)
        response = connection.getresponse()
        body = response.read()
        status = response.status
        connection.close()
        return status, json.loads(body) if body.startswith(b'{') else body

    def test_draft_roundtrip_and_delete(self):
        code, result = self.request('/api/save', self.post)
        self.assertEqual(code, 200)
        identifier = result['post']['id']
        self.assertEqual(len(self.request('/api/session')[1]['drafts']), 1)
        self.assertEqual(studio.read_json(studio.ROOT / 'content/posts.json', []), [])
        self.request('/api/delete', {'id': identifier})
        self.assertEqual(self.request('/api/session')[1]['drafts'], [])

    def test_publish_all_categories_and_edit(self):
        for category in studio.CATEGORIES:
            code, result = self.request('/api/publish', self.post | {'category': category})
            self.assertEqual(code, 200, result)
            self.assertNotIn('pending', result)
        self.assertEqual(len(studio.read_json(studio.ROOT / 'content/posts.json', [])), 4)
        post = result['post'] | {'title': 'Edited title'}
        self.assertEqual(self.request('/api/publish', post)[0], 200)
        posts = studio.read_json(studio.ROOT / 'content/posts.json', [])
        self.assertEqual(len(posts), 4)
        self.assertEqual(posts[-1]['title'], 'Edited title')
        self.assertEqual(posts[-1]['date'], result['post']['date'])
        remote = subprocess.run(['git', '--git-dir', str(self.remote), 'show', 'main:content/posts.json'], check=True, text=True, capture_output=True)
        self.assertEqual(json.loads(remote.stdout), posts)

    def test_upload_and_publish_only_selected_media(self):
        png = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'test').decode()
        image = self.request('/api/upload', {'data': png})[1]['src']
        unused = self.request('/api/upload', {'data': png})[1]['src']
        code, result = self.request('/api/publish', self.post | {'images': [{'src': image, 'alt': 'An artwork'}]})
        self.assertEqual(code, 200, result)
        tracked = studio.git('ls-files').splitlines()
        self.assertIn(image, tracked)
        self.assertNotIn(unused, tracked)
        self.assertEqual(self.request('/api/upload', {'data': base64.b64encode(b'<svg/>').decode()})[0], 400)

    def test_video_upload_draft_publish_edit_and_remove(self):
        mp4 = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom' + b'video payload'
        code, upload = self.request('/api/upload-video', mp4, {'Content-Type': 'video/mp4'})
        self.assertEqual(code, 200, upload)
        video = upload['src']
        unused = self.request('/api/upload-video', mp4)[1]['src']
        self.assertEqual((studio.ROOT / video).read_bytes(), mp4)
        self.assertEqual(self.request('/' + video), (200, mp4))
        self.assertEqual(self.request('/' + video, headers={'Range': 'bytes=4-7'}), (206, b'ftyp'))
        self.assertEqual(self.request('/' + video, headers={'Range': 'bytes=-7'}), (206, b'payload'))
        self.assertEqual(self.request('/' + video, headers={'Range': 'bytes=24-'}), (206, b'video payload'))
        self.assertEqual(self.request('/' + video, headers={'Range': 'bytes=9999-'}), (416, b''))
        saved = self.request('/api/save', self.post | {'videoSrc': video})[1]['post']
        self.assertEqual(self.request('/api/session')[1]['drafts'][0]['videoSrc'], video)
        code, published = self.request('/api/publish', saved)
        self.assertEqual(code, 200, published)
        self.assertNotIn('pending', published)
        self.assertIn(video, studio.git('ls-files').splitlines())
        self.assertNotIn(unused, studio.git('ls-files').splitlines())
        remote = subprocess.run(['git', '--git-dir', str(self.remote), 'show', f'main:{video}'], check=True, capture_output=True)
        self.assertEqual(remote.stdout, mp4)
        edited = published['post'] | {'videoSrc': '', 'title': 'Without video'}
        self.assertEqual(self.request('/api/publish', edited)[0], 200)
        self.assertEqual(self.request('/api/session')[1]['posts'][0]['videoSrc'], '')
        self.assertTrue((studio.ROOT / video).exists())

    def test_video_validation_and_security(self):
        mp4 = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom'
        for raw in [b'', b'<html>not MP4</html>', b'\x89PNG\r\n\x1a\n',
                    b'\x00\x00\x00\x18ftypqt  \x00\x00\x00\x00qt  qt  ',
                    b'\x00\x00\xff\xffftypmp42\x00\x00\x00\x00']:
            self.assertEqual(self.request('/api/upload-video', raw)[0], 400)
        original_limit = studio.MAX_VIDEO_BYTES
        try:
            studio.MAX_VIDEO_BYTES = len(mp4) - 1
            self.assertEqual(self.request('/api/upload-video', mp4)[0], 400)
            studio.MAX_VIDEO_BYTES = len(mp4)
            self.assertEqual(self.request('/api/upload-video', mp4)[0], 200)
        finally:
            studio.MAX_VIDEO_BYTES = original_limit
        self.assertEqual(self.request('/api/upload-video', mp4, {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/upload-video', mp4, {'X-Studio-Token': 'bad'})[0], 403)
        for source in [None, 123, '../private.mp4', '/uploads/' + 'a' * 32 + '.mp4',
                       'https://example.com/v.mp4', 'uploads/' + 'a' * 32 + '.mp4']:
            self.assertEqual(self.request('/api/save', self.post | {'videoSrc': source})[0], 400, source)
        self.assertEqual(self.request('/uploads/private.mp4')[0], 404)
        self.assertEqual(self.request('/uploads/' + 'b' * 32 + '.mp4')[0], 404)
        self.assertEqual(self.request('/api/upload', {'data': base64.b64encode(mp4).decode()})[0], 400)

    def test_markdown_parser_served(self):
        self.assertEqual(self.request('/assets/vendor/markdown-it.min.js')[0], 200)
        self.assertEqual(self.request('/assets/vendor/private.txt')[0], 404)

    def test_refuse_uncommitted_markdown_parser(self):
        (studio.ROOT / 'assets/vendor/markdown-it.min.js').write_text('// Changed parser')
        code, result = self.request('/api/publish', self.post)
        self.assertEqual(code, 400)
        self.assertIn('integration changes', result['error'])

    def test_security_boundaries(self):
        self.assertEqual(self.request('/api/save', self.post, {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/save', self.post, {'X-Studio-Token': 'bad'})[0], 403)
        self.assertEqual(self.request('/api/session', headers={'Host': 'evil.example'})[0], 403)
        for path in ['/.git/config', '/.studio/drafts.json', '/studio/server.py', '/uploads/..', '/%2e%2e%2fprivate.jpg', '/uploads/%2e%2e/']:
            self.assertEqual(self.request(path)[0], 404, path)
        self.assertEqual(self.request('/api/save', self.post | {'mediaUrl': 'javascript:alert(1)'})[0], 400)
        self.assertEqual(self.request('/api/save', self.post | {'category': 'other'})[0], 400)

    def test_refuse_staged_changes(self):
        (studio.ROOT / 'other.txt').write_text('Unrelated work')
        studio.git('add', 'other.txt')
        code, result = self.request('/api/publish', self.post)
        self.assertEqual(code, 400)
        self.assertIn('staged Git changes', result['error'])
        self.assertEqual(len(self.request('/api/session')[1]['drafts']), 1)

    def test_first_time_setup_guard(self):
        studio.git('rm', '--cached', 'posts.js')
        studio.git('commit', '-m', 'Simulate missing integration')
        code, result = self.request('/api/publish', self.post)
        self.assertEqual(code, 400)
        self.assertIn('One-time setup', result['error'])
        self.assertEqual(studio.read_json(studio.ROOT / 'content/posts.json', []), [])

    def test_manual_content_changes_preserved(self):
        manual = [{'id': 'manual', 'title': 'Do not overwrite'}]
        studio.save_json(studio.ROOT / 'content/posts.json', manual)
        code, result = self.request('/api/publish', self.post)
        self.assertEqual(code, 400)
        self.assertIn('manual changes', result['error'])
        self.assertEqual(studio.read_json(studio.ROOT / 'content/posts.json', []), manual)

    def test_push_failure_can_retry(self):
        studio.git('remote', 'set-url', 'origin', str(self.remote) + '-missing')
        code, result = self.request('/api/publish', self.post)
        self.assertEqual(code, 200)
        self.assertTrue(result['pending'])
        self.assertEqual(len(self.request('/api/session')[1]['drafts']), 1)
        studio.git('remote', 'set-url', 'origin', str(self.remote))
        self.assertEqual(self.request('/api/push', {})[0], 200)
        self.assertEqual(studio.git('status', '--porcelain', '--', 'content/posts.json'), '')


if __name__ == '__main__':
    unittest.main()
