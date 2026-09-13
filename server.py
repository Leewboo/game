"""本地下载服务

启动后访问 http://localhost:8000/ 可看到下载页面，点击即可下载 sanguosha.zip
包含 main.py + sanguosha/ 完整代码（排除 .pyc / __pycache__ / .git）
"""
import io
import os
import zipfile
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer
from functools import partial

# 项目根目录（main.py 所在目录）
ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = "sanguosha"
EXCLUDE_DIRS = {"__pycache__", ".git", ".idea", "node_modules", ".vscode"}
EXCLUDE_EXT = {".pyc", ".pyo"}


def build_zip() -> bytes:
    """把项目打包成 zip，返回字节流"""
    buf = io.BytesIO()
    # 用 arcname="sanguosha/..." 让解压后是一个干净目录
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # main.py
        main_path = os.path.join(ROOT, "main.py")
        if os.path.exists(main_path):
            zf.write(main_path, arcname=f"{PROJECT_NAME}/main.py")
        # sanguosha/ 目录递归
        sg_dir = os.path.join(ROOT, "sanguosha")
        for dirpath, dirnames, filenames in os.walk(sg_dir):
            # 原地修改 dirnames 跳过排除目录
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for fn in filenames:
                if os.path.splitext(fn)[1] in EXCLUDE_EXT:
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                zf.write(full, arcname=f"{PROJECT_NAME}/{rel.replace(os.sep, '/')}")
    return buf.getvalue()


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>三国杀 · 源码下载</title>
<style>
  body {{ font-family: -apple-system, "PingFang SC", sans-serif;
         background: #1f2933; color: #f1f5f9; margin: 0; padding: 40px; }}
  .card {{ max-width: 600px; margin: 0 auto;
           background: #334155; border-radius: 12px; padding: 32px;
           box-shadow: 0 10px 30px rgba(0,0,0,0.4); }}
  h1 {{ margin: 0 0 8px; color: #fbbf24; }}
  p {{ line-height: 1.6; color: #cbd5e1; }}
  a.btn {{ display: inline-block; margin-top: 20px; padding: 12px 28px;
           background: #2563eb; color: #fff; text-decoration: none;
           border-radius: 6px; font-weight: 600; }}
  a.btn:hover {{ background: #1d4ed8; }}
  .meta {{ margin-top: 16px; font-size: 13px; color: #94a3b8; }}
</style>
</head>
<body>
  <div class="card">
    <h1>三国杀 · 控制台版</h1>
    <p>完整源码已打包为 ZIP（含 main.py 与 sanguosha/ 包），下载后解压即可运行。</p>
    <a class="btn" href="/sanguosha.zip">⬇ 下载 sanguosha.zip ({size})</a>
    <div class="meta">
      文件数：{files}<br>
      运行方式：解压后执行 <code>python main.py [2-8]</code><br>
      DIY 武将：把 .py 文件丢进 sanguosha/custom_generals/ 即可
    </div>
  </div>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    zip_bytes: bytes = b""

    def log_message(self, fmt, *args):
        # 简化日志
        print(f"[{self.address_string()}] {fmt % args}")

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            html = HTML_TEMPLATE.format(
                size=f"{len(self.zip_bytes)/1024:.1f} KB",
                files="自动统计",
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
        elif self.path == "/sanguosha.zip":
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition",
                             'attachment; filename="sanguosha.zip"')
            self.send_header("Content-Length", str(len(self.zip_bytes)))
            self.end_headers()
            self.wfile.write(self.zip_bytes)
        else:
            self.send_response(404)
            self.end_headers()


def get_local_ip() -> str:
    """获取本机局域网 IP（方便从其他设备访问）"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main(port: int = 8000):
    print("正在打包源码...")
    Handler.zip_bytes = build_zip()
    n_files = zipfile.ZipFile(io.BytesIO(Handler.zip_bytes)).namelist()
    print(f"打包完成：{len(Handler.zip_bytes)} 字节，{len(n_files)} 个文件")

    ip = get_local_ip()
    httpd = HTTPServer(("0.0.0.0", port), Handler)
    print(f"\n下载服务已启动：")
    print(f"  本机访问 : http://localhost:{port}/")
    print(f"  局域网   : http://{ip}:{port}/")
    print(f"  直链     : http://localhost:{port}/sanguosha.zip")
    print("\n按 Ctrl+C 停止服务")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        httpd.server_close()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("-p", "--port", type=int, default=8000)
    args = p.parse_args()
    main(args.port)
