#!/usr/bin/env python3
"""
handtrack.py — real-time Hand Tracking + Face Framing demo
----------------------------------------------------------
Python + OpenCV + MediaPipe diye toiri ekta chhoto demo:

  * Webcam feed (mirror) → cvtColor(BGR→RGB) → MediaPipe Hands + FaceDetection
  * Mukher charpashe sadha bounding box (screenshot er moto)
  * Haat er 21-ta landmark skeleton draw hoy
  * **FRAME GESTURE:**
      - Duita haat diye "filmmaker frame" banale → sadha frame ake jay
      - Frame er bhitore mukh/eye-band thakle → "FACE LOCKED" 😈
      - Ek haate thumb+index pinch (OK sign) → chhoto mini-frame
  * Effects:  B → background GaussianBlur | G → grayscale | R → ROI inset
              S → screenshot | Q/ESC → quit

Run:
  python handtrack.py                 # default camera 0
  python handtrack.py --camera 1      # onno camera
  python handtrack.py --image pic.jpg # ekta chobi te annotate
  python handtrack.py --video clip.mp4
"""

import argparse
import os
import platform
import sys
import time

import cv2
import numpy as np

try:
    import mediapipe as mp
    from mediapipe import solutions
except ImportError:
    print("[x] mediapipe nai. Install koro:\n"
          "    pip install mediapipe==0.10.21 opencv-python numpy")
    sys.exit(1)

THUMB_TIP, INDEX_TIP = 4, 8
WRIST, MIDDLE_MCP = 0, 9
WHITE, GREEN, RED, CYAN = (255, 255, 255), (80, 220, 80), (80, 80, 255), (255, 240, 120)


def has_display() -> bool:
    if platform.system() in ("Windows", "Darwin"):
        return True
    return bool(os.environ.get("DISPLAY"))


# ---------------------------------------------------------------- detector
class FrameDetector:
    """Face box + hand landmarks + frame-gesture — sob ek jaygay."""

    def __init__(self, complexity: int = 1):
        self.hands = solutions.hands.Hands(
            static_image_mode=False, max_num_hands=2,
            min_detection_confidence=0.6, min_tracking_confidence=0.5,
            model_complexity=complexity)
        self.face = solutions.face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.55)
        self.smooth = {}

    @staticmethod
    def px(lm, w, h):
        return np.array([int(lm.x * w), int(lm.y * h)])

    def pinch(self, lms, w, h):
        """Thumb+index pinch ki na. Returns (pinched, mid, scale)."""
        pts = [self.px(l, w, h) for l in lms.landmark]
        scale = float(np.linalg.norm(pts[WRIST] - pts[MIDDLE_MCP])) or 1.0
        d = float(np.linalg.norm(pts[THUMB_TIP] - pts[INDEX_TIP]))
        mid = (pts[THUMB_TIP] + pts[INDEX_TIP]) // 2
        return (d < 0.32 * scale), mid, scale

    def smooth_key(self, key, val, alpha=0.45):
        prev = self.smooth.get(key)
        out = val if prev is None else (alpha * val + (1 - alpha) * np.array(prev, float)).astype(int)
        self.smooth[key] = out
        return out

    # ------------------------------------------------------------------
    def analyze(self, frame):
        """Ek frame process kore sob result dict e ferot day."""
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        fres = self.face.process(rgb)
        hres = self.hands.process(rgb)

        out = {"faces": [], "hands": [], "pinches": [], "frame_rect": None, "locked": False}

        if fres.detections:
            for det in fres.detections:
                bb = det.location_data.relative_bounding_box
                x1, y1 = max(0, int(bb.xmin * w)), max(0, int(bb.ymin * h))
                x2, y2 = min(w, int((bb.xmin + bb.width) * w)), min(h, int((bb.ymin + bb.height) * h))
                if x2 - x1 > 10 and y2 - y1 > 10:
                    out["faces"].append((x1, y1, x2, y2, float(det.score[0])))

        if hres.multi_hand_landmarks:
            for lms in hres.multi_hand_landmarks:
                pts = np.array([[int(l.x * w), int(l.y * h)] for l in lms.landmark])
                pinched, mid, scale = self.pinch(lms, w, h)
                out["hands"].append({"pts": pts, "scale": scale, "lms": lms})
                out["pinches"].append({"on": pinched, "mid": mid, "scale": scale})

        # -- gesture 1: dui haat → filmmaker frame
        #    4 ta fingertip (dui haater thumb+index) = frame er 4 kony.
        if len(hres.multi_hand_landmarks or []) >= 2:
            tips = []
            for lms in hres.multi_hand_landmarks[:2]:
                tips.append(self.px(lms.landmark[THUMB_TIP], w, h))
                tips.append(self.px(lms.landmark[INDEX_TIP], w, h))
            tips = np.array(tips)
            x1, y1 = tips.min(axis=0)
            x2, y2 = tips.max(axis=0)
            pad = 10
            x1, y1, x2, y2 = max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y2 + pad)
            if (x2 - x1) > 80 and (y2 - y1) > 60:
                x1, y1 = self.smooth_key("fx1", np.array([x1, y1]))
                x2, y2 = self.smooth_key("fx2", np.array([x2, y2]))
                out["frame_rect"] = (int(x1), int(y1), int(x2), int(y2))

        # -- gesture 2: ek haati pinch → mini frame
        else:
            for p in out["pinches"]:
                if p["on"]:
                    side = int(max(60, 2.4 * p["scale"]))
                    x, y = int(p["mid"][0]), int(p["mid"][1])
                    out["frame_rect"] = (max(0, x - side // 2), max(0, y - side // 2),
                                         min(w, x + side // 2), min(h, y + side // 2))
                    break

        # -- lock check: frame ta mukher "chokher elaka" (uporer dike) cover korche?
        if out["frame_rect"] and out["faces"]:
            fx1, fy1, fx2, fy2 = out["frame_rect"]
            for (x1, y1, x2, y2, _) in out["faces"]:
                ex1, ex2 = x1, x2
                ey1, ey2 = y1, y1 + (y2 - y1) // 2
                ix = max(0, min(fx2, ex2) - max(fx1, ex1))
                iy = max(0, min(fy2, ey2) - max(fy1, ey1))
                band = max(1, (ex2 - ex1) * (ey2 - ey1))
                if (ix * iy) / band >= 0.30:
                    out["locked"] = True
                    break
        return out


# ---------------------------------------------------------------- renderer
def draw_hud(canvas, st, fps, args):
    h, w = canvas.shape[:2]
    title = "handtrack python  |  OpenCV + MediaPipe"
    status = "FACE LOCKED" if st["locked"] else ("frame" if st["frame_rect"] else "search")
    color = GREEN if st["locked"] else (CYAN if st["frame_rect"] else (170, 170, 170))
    txt = f"{status}  hands:{len(st['hands'])}" + (f"  {fps:4.1f} fps" if fps else "")

    (tw1, _), _ = cv2.getTextSize(title, cv2.FONT_HERSHEY_DUPLEX, 0.62, 1)
    (tw2, _), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_DUPLEX, 0.62, 1)
    two_line = tw1 + tw2 + 36 > w
    bar_h = 56 if two_line else 34
    cv2.rectangle(canvas, (0, 0), (w, bar_h), (0, 0, 0), -1)
    cv2.putText(canvas, title, (12, 23), cv2.FONT_HERSHEY_DUPLEX, 0.62, WHITE, 1, cv2.LINE_AA)
    if two_line:
        cv2.putText(canvas, txt, (12, 48), cv2.FONT_HERSHEY_DUPLEX, 0.62, color, 1, cv2.LINE_AA)
    else:
        cv2.putText(canvas, txt, (w - tw2 - 12, 23), cv2.FONT_HERSHEY_DUPLEX, 0.62, color, 1, cv2.LINE_AA)


def render(frame, st, fps, args):
    canvas = frame.copy()
    fx1, fy1, fx2, fy2 = st.get("frame_rect") or (0, 0, 0, 0)

    # -- (toggle) frame er BAIRO GaussianBlur — cinema mode
    if args.blur:
        gate = st["frame_rect"] or (st["faces"][0][:4] if st["faces"] else None)
        if gate:
            blur = cv2.GaussianBlur(canvas, (0, 0), 19)
            mask = np.zeros(canvas.shape[:2], np.uint8)
            cv2.rectangle(mask, gate[:2], gate[2:4], 255, -1)
            canvas = np.where(mask[:, :, None] == 255, canvas, blur)

    if args.gray:
        canvas = cv2.cvtColor(cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)

    for (x1, y1, x2, y2, score) in st["faces"]:
        cv2.rectangle(canvas, (x1, y1), (x2, y2), WHITE, 2, cv2.LINE_AA)
        cv2.putText(canvas, f"face {score:.0%}", (x1, max(16, y1 - 8)),
                    cv2.FONT_HERSHEY_DUPLEX, 0.5, WHITE, 1, cv2.LINE_AA)

    mp_draw = solutions.drawing_utils
    for hand in st["hands"]:
        mp_draw.draw_landmarks(canvas, hand["lms"], solutions.hands.HAND_CONNECTIONS,
                               solutions.drawing_styles.get_default_hand_landmarks_style(),
                               solutions.drawing_styles.get_default_hand_connections_style())

    if st["frame_rect"]:
        if st["locked"]:
            cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), GREEN, 5, cv2.LINE_AA)
            cv2.putText(canvas, "FACE LOCKED", (fx1, max(28, fy1 - 12)),
                        cv2.FONT_HERSHEY_DUPLEX, 0.85, GREEN, 2, cv2.LINE_AA)
            for (a, b) in [((fx1, fy1), (fx1 + 26, fy1)), ((fx1, fy1), (fx1, fy1 + 26)),
                           ((fx2, fy1), (fx2 - 26, fy1)), ((fx2, fy1), (fx2, fy1 + 26)),
                           ((fx1, fy2), (fx1 + 26, fy2)), ((fx1, fy2), (fx1, fy2 - 26)),
                           ((fx2, fy2), (fx2 - 26, fy2)), ((fx2, fy2), (fx2, fy2 - 26))]:
                cv2.line(canvas, a, b, GREEN, 2, cv2.LINE_AA)
        else:
            cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), CYAN, 2, cv2.LINE_AA)

    if args.roi and st["faces"]:
        x1, y1, x2, y2, _ = st["faces"][0]
        crop = frame[max(0, y1):y2, max(0, x1):x2]
        if crop.size:
            iw = 150
            crop = cv2.resize(crop, (iw, int(crop.shape[0] * iw / crop.shape[1])))
            ch, cw = crop.shape[:2]
            y0, x0 = 46, canvas.shape[1] - cw - 12
            canvas[y0:y0 + ch, x0:x0 + cw] = crop
            cv2.rectangle(canvas, (x0, y0), (x0 + cw, y0 + ch), WHITE, 2)

    draw_hud(canvas, st, fps, args)
    return canvas


# ---------------------------------------------------------------- sources
def open_source(args):
    if args.image:
        img = cv2.imread(args.image)
        if img is None:
            sys.exit(f"[x] chobi porte parini: {args.image}")
        return [("image", img)]
    if args.video:
        cap = cv2.VideoCapture(args.video)
        if not cap.isOpened():
            sys.exit(f"[x] video khulte parini: {args.video}")
        return [("video", cap)]
    backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
    cap = cv2.VideoCapture(args.camera, backend)
    if not cap.isOpened():
        sys.exit("[x] camera khula jacche na — onno camera try koro:  python handtrack.py --camera 1")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    return [("camera", cap)]


# ---------------------------------------------------------------- main loop
def main():
    ap = argparse.ArgumentParser(description="Hand tracking + face framing demo (OpenCV + MediaPipe)")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--video", help="video file e test korar jonno")
    ap.add_argument("--image", help="ekta chobi annotate kore save")
    ap.add_argument("--out", help="(image mode) output file path")
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--height", type=int, default=540)
    ap.add_argument("--complexity", type=int, default=1, choices=[0, 1])
    ap.add_argument("--blur", action="store_true", default=False)
    ap.add_argument("--gray", action="store_true", default=False)
    ap.add_argument("--no-roi", dest="roi", action="store_false")
    ap.add_argument("--no-window", action="store_true")
    ap.add_argument("--out-dir", default="captures")
    ap.add_argument("--seconds", type=float, default=0)
    args = ap.parse_args()
    args.roi = True if args.roi is None else args.roi

    show = (not args.no_window) and has_display() and not args.image
    det = FrameDetector(args.complexity)

    for kind, src in open_source(args):
        fps, t0, n = 0.0, time.time(), 0
        while True:
            if kind == "image":
                frame = src
            else:
                ok, frame = src.read()
                if not ok or frame is None:
                    break
                if kind == "camera":
                    frame = cv2.flip(frame, 1)

            st = det.analyze(frame)
            n += 1
            now = time.time()
            if now - t0 >= 0.5:
                fps, t0 = n / (now - t0), now
                n = 0
            out = render(frame, st, fps, args)

            if args.image:
                dst = args.out or (os.path.splitext(args.image)[0] + "_framed.jpg")
                cv2.imwrite(dst, out)
                print(f"[ok] save hocche → {dst}")
                print(f"    faces:{len(st['faces'])}  hands:{len(st['hands'])}  locked:{st['locked']}")
                break
            if show:
                cv2.imshow("handtrack python  —  q:quit  b:blur  g:gray  r:roi  s:shot", out)
                k = cv2.waitKey(1) & 0xFF
                if k in (ord('q'), 27):
                    break
                elif k == ord('b'):
                    args.blur = not args.blur
                elif k == ord('g'):
                    args.gray = not args.gray
                elif k == ord('r'):
                    args.roi = not args.roi
                elif k == ord('s'):
                    os.makedirs(args.out_dir, exist_ok=True)
                    p = os.path.join(args.out_dir, f"shot_{int(time.time())}.jpg")
                    cv2.imwrite(p, out)
                    print(f"[ok] screenshot → {p}")

        if kind != "image":
            src.release()
            if show:
                cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
