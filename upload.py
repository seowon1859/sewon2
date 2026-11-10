"""Read numeric lines from an Arduino and insert them into Supabase.

Run with ``python upload.py [--port SERIAL_PORT]``. If no port is supplied,
the available serial ports are shown for selection.
"""

import argparse
from datetime import datetime
import math
import os
import sys
import time
from pathlib import Path

import serial
from httpx import HTTPError
from postgrest.exceptions import APIError
from serial.tools import list_ports
from dotenv import load_dotenv
from supabase import create_client

BAUD_RATE = 9600
TABLE_NAME = "readings"
UPLOAD_INTERVAL_SECONDS = 1.0


def choose_port() -> str:
    ports = sorted(list_ports.comports(), key=lambda port: port.device)
    if not ports:
        raise SystemExit(
            "시리얼 포트를 찾을 수 없습니다. Arduino를 연결한 뒤 다시 실행하세요."
        )

    print("사용 가능한 시리얼 포트:")
    for index, port in enumerate(ports, start=1):
        print(f"  {index}. {port.device} — {port.description}")

    while True:
        selection = input("Arduino 포트 번호를 선택하세요: ").strip()
        try:
            port_index = int(selection) - 1
        except ValueError:
            print("목록에 표시된 번호를 입력하세요.", file=sys.stderr)
            continue
        if 0 <= port_index < len(ports):
            return ports[port_index].device
        print("목록에 표시된 번호를 입력하세요.", file=sys.stderr)


def parse_value(line: bytes) -> float | None:
    try:
        text = line.decode("utf-8").strip()
    except UnicodeDecodeError:
        print("UTF-8로 해석할 수 없는 입력을 건너뜁니다.", file=sys.stderr)
        return None
    if not text:
        return None

    try:
        value = float(text)
    except ValueError:
        print(f"숫자가 아닌 입력을 건너뜁니다: {text!r}", file=sys.stderr)
        return None

    if not math.isfinite(value):
        print(f"유한한 숫자가 아닌 입력을 건너뜁니다: {text!r}", file=sys.stderr)
        return None
    return value


def upload_loop(
    device, readings, interval_seconds: float = UPLOAD_INTERVAL_SECONDS
) -> None:
    latest_value: float | None = None
    next_upload_at = time.monotonic() + interval_seconds

    while True:
        value = parse_value(device.readline())
        if value is not None:
            latest_value = value
            print(f"수신: {value}")
        elif latest_value is None:
            print("Arduino에서 숫자 데이터를 기다리는 중...", end="\r")

        now = time.monotonic()
        if latest_value is None or now < next_upload_at:
            continue

        next_upload_at += interval_seconds
        try:
            readings.insert({"value": latest_value}).execute()
            saved_at = datetime.now().astimezone().isoformat(timespec="seconds")
            print(f"[{saved_at}] Supabase 저장 완료: {latest_value}")
        except (APIError, HTTPError) as error:
            print(f"Supabase 저장 실패: {error}", file=sys.stderr)

        now = time.monotonic()
        if next_upload_at <= now:
            missed_intervals = math.floor(
                (now - next_upload_at) / interval_seconds
            ) + 1
            next_upload_at += missed_intervals * interval_seconds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--port",
        help="Arduino serial port (for example, /dev/cu.usbmodem1101)",
    )
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parent / ".env")
    supabase_url = os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("VITE_SUPABASEE_ANON_KEY") or os.getenv(
        "VITE_SUPABASE_ANON_KEY"
    )
    if not supabase_url or not supabase_key:
        raise SystemExit(
            "프로젝트 루트 .env에 VITE_SUPABASE_URL과 "
            "VITE_SUPABASEE_ANON_KEY를 설정하세요."
        )

    port_name = args.port or choose_port()
    client = create_client(supabase_url, supabase_key)
    print(
        f"{port_name}에 {BAUD_RATE} baud로 연결합니다. "
        f"최근 수신값을 {UPLOAD_INTERVAL_SECONDS:g}초마다 저장합니다. "
        "종료하려면 Ctrl+C를 누르세요."
    )

    try:
        with serial.Serial(port_name, BAUD_RATE, timeout=0.1) as device:
            upload_loop(device, client.table(TABLE_NAME))
    except KeyboardInterrupt:
        print("\n업로드를 종료합니다.")
    except serial.SerialException as error:
        raise SystemExit(f"시리얼 포트 오류: {error}") from error


if __name__ == "__main__":
    main()
