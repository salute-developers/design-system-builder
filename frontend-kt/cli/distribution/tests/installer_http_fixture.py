"""HTTP-сервер для Windows-проверок установщика, включая запрет редиректов."""
import http.server
from pathlib import Path
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        with Path('requests.log').open('a') as log:
            log.write(self.path + '\n')
        if self.path.startswith('/redirect/'):
            self.send_response(302)
            self.send_header('Location', self.path.removeprefix('/redirect'))
            self.end_headers()
            return
        super().do_GET()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), Handler).serve_forever()
