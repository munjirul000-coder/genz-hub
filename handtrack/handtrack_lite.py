#!/usr/bin/env python3
"""
handtrack_lite.py — sudhu OpenCV version (mediapipe lage na!)
-------------------------------------------------------------
Mediapipe install korte somossa hole ei fallback use koro:

  * Face → Haar Cascade (opencv er sathe bundled, offline)
  * Hand → YCrCb skin-colour mask + contours + convex hull
  * Keys → b: background blur | g: grayscale | s: screenshot | q: quit

Run:  python handtrack_lite.py
"""

import argparse
import os
import platform
import sys
import time

import cv2
import numpy as np

WHITE, GREEN, CYAN = (255, 255, 255), (80, 220, 80), (255, 240, 120)


def has_display():
    return platform.system() in ("Windows", "Darwin") or bool(os.environ.get("DISPLAY"))


def hand_mask(frame):
    """YCrCb colour space e skin range → binary mask."""
    ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
    m = cv2.inRange(ycrcb, (0, 133, 77), (255, 173, 127))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--height", type=int, default=540)
    ap.add_argument("--image", help="ekta chobi test")
    ap.add_argument("--out", help="(image mode) output path")
    ap.add_argument("--no-window", action="store_true")
    args = ap.parse_args()

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if face_cascade.empty():
        sys.exit("[x] Haar cascade load hoy nai")

    show = (not args.no_window) and has_display() and not args.image
    cap = None
    if args.image:
        frame = cv2.imread(args.image)
        if frame is None:
            sys.exit(f"[x] chobi porte parini: {args.image}")
    else:
        backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
        cap = cv2.VideoCapture(args.camera, backend)
        if not cap.isOpened():
            sys.exit("[x] camera khula jacche na")
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    blur_on = gray_on = False
    fps, t0, n = 0.0, time.time(), 0

    while True:
        if cap is not None:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.15, 5, minSize=(70, 70))

        canvas = frame.copy()
        biggest = None
        for (x, y, fw, fh) in faces:
            cv2.rectangle(canvas, (x, y), (x + fw, y + fh), WHITE, 2, cv2.LINE_AA)
            cv2.putText(canvas, "face", (x, max(16, y - 8)), cv2.FONT_HERSHEY_DUPLEX, 0.55, WHITE, 1, cv2.LINE_AA)
            if biggest is None or fw * fh > biggest[2] * biggest[3]:
                biggest = (x, y, fw, fh)

        mask = hand_mask(frame)
        if biggest:
            cv2.rectangle(mask, (biggest[0], biggest[1]),
                          (biggest[0] + biggest[2], biggest[1] + biggest[3]), 0, -1)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hand_box = None
        if cnts:
            c = max(cnts, key=cv2.contourArea)
            if cv2.contourArea(c) > (w * h) * 0.01:
                hand_box = cv2.boundingRect(c)
                hx, hy, hw, hh = hand_box
                cv2.rectangle(canvas, (hx, hy), (hx + hw, hy + hh), CYAN, 2, cv2.LINE_AA)
                hull = cv2.convexHull(c)
                cv2.drawContours(canvas, [hull], -1, CYAN, 2, cv2.LINE_AA)
                cv2.putText(canvas, "hand", (hx, max(16, hy - 8)), cv2.FONT_HERSHEY_DUPLEX, 0.55, CYAN, 1, cv2.LINE_AA)

        if blur_on and biggest:
            blurred = cv2.GaussianBlur(canvas, (0, 0), 19)
            m = np.zeros((h, w), np.uint8)
            x, y, fw, fh = biggest
            cv2.rectangle(m, (x, y), (x + fw, y + fh), 255, -1)
            canvas = np.where(m[:, :, None] == 255, canvas, blurred)
        if gray_on:
            canvas = cv2.cvtColor(cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)

        n += 1
        now = time.time()
        if now - t0 >= 0.5:
            fps, t0, n = n / (now - t0), now, 0
        cv2.rectangle(canvas, (0, 0), (w, 30), (0, 0, 0), -1)
        cv2.putText(canvas, f"handtrack LITE (pure OpenCV)   faces:{len(faces)} hands:{int(hand_box is not None)}  {fps:4.1f} fps",
                    (12, 21), cv2.FONT_HERSHEY_DUPLEX, 0.55, WHITE, 1, cv2.LINE_AA)

        if args.image:
            dst = args.out or (os.path.splitext(args.image)[0] + "_lite.jpg")
            cv2.imwrite(dst, canvas)
            print(f"[ok] save → {dst}")
            break
        if show:
            cv2.imshow("handtrack lite — q:quit b:blur g:gray s:shot", canvas)
            k = cv2.waitKey(1) & 0xFF
            if k in (ord('q'), 27):
                break
            if k == ord('b'):
                blur_on = not blur_on
            if k == ord('g'):
                gray_on = not gray_on
            if k == ord('s'):
                os.makedirs("captures", exist_ok=True)
                p = os.path.join("captures", f"lite_{int(time.time())}.jpg")
                cv2.imwrite(p, canvas)
                print(f"[ok] screenshot → {p}")

    if cap is not None:
        cap.release()
    if show:
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
