#!/usr/bin/env python3
"""
server_https.py — chhoto self-signed HTTPS static server.

Camera (getUserMedia) ekhon sob modern browser e **secure context** chaay:
https:// ba localhost chhara kothao (jemon e2b.app proxy URL) plain http te
camera block hoy. Ei server self-signed certificate diye https://0.0.0.0:8443
e serve kore — user browser e certificate "Advanced → Proceed" chaplei
camera kaj korbe.

Usage:  python3 server_https.py [dir] [port]
"""
import http.server
import os
import ssl
import sys
import tempfile

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8443


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # SharedArrayBuffer lage MediaPipe wasm er paket asset loader er jonno
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))


def main():
    os.chdir(ROOT)
    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    # self-signed cert (protibar notun — kono file manage korte hoy na)
    key = tempfile.NamedTemporaryFile(suffix=".pem", delete=False)
    cert = tempfile.NamedTemporaryFile(suffix=".pem", delete=False)
    subprocess_make_cert(key.name, cert.name)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert.name, key.name)
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"Serving {ROOT} on https://0.0.0.0:{PORT}  (self-signed — browser e 'Advanced → Proceed' chapo)")
    httpd.serve_forever()


def subprocess_make_cert(keypath, certpath):
    import subprocess
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", keypath, "-out", certpath,
        "-days", "30", "-nodes", "-subj", "/CN=localhost",
    ], check=True, capture_output=True)


if __name__ == "__main__":
    main()
