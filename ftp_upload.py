"""把 sanguosha 项目打包成 zip 并通过 FTP 上传"""
import io
import sys
from ftplib import FTP, error_perm

# 复用 server.py 的打包函数
from server import build_zip

FTP_HOST = "192.168.10.9"
FTP_PORT = 8080
FTP_USER = "myftp"
FTP_PASS = "myftp8080"
REMOTE_NAME = "sanguosha.zip"


def main():
    print("正在打包源码...")
    data = build_zip()
    print(f"打包完成：{len(data)} 字节")

    print(f"\n连接 FTP {FTP_HOST}:{FTP_PORT} ...")
    try:
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=15)
        ftp.login(FTP_USER, FTP_PASS)
        print("登录成功")
        print("当前目录:", ftp.pwd())
    except Exception as e:
        print(f"FTP 连接失败: {e}")
        sys.exit(1)

    buf = io.BytesIO(data)
    try:
        ftp.storbinary(f"STOR {REMOTE_NAME}", buf)
        print(f"\n上传成功: {REMOTE_NAME} ({len(data)} 字节)")
        # 列目录验证
        print("\n远端目录列表:")
        ftp.retrlines("LIST")
    except error_perm as e:
        print(f"上传被拒绝（权限/路径问题）: {e}")
    except Exception as e:
        print(f"上传失败: {e}")
    finally:
        ftp.quit()


if __name__ == "__main__":
    main()
