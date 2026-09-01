#!/usr/bin/env python3
# sigmacamera.py - real-time Hand Tracking + Face Framing demo
# MediaPipe Tasks API version (mediapipe 0.10.30+ / 0.10.35 - solutions API removed)
#
# * Webcam (mirror) -> cvtColor(BGR->RGB) -> HandLandmarker + FaceDetector
# * Face bounding box + 21-point hand skeleton
# * FRAME GESTURE: dui haat diye frame -> FACE LOCKED
# * Keys: B=blur  G=gray  R=roi  S=screenshot  Q=quit
#
# First run downloads 2 model files (~10 MB, one time). After that offline.

import os
import sys
import time
import platform
import traceback
import urllib.request

# ------------------------------------------------ imports (per-module check)
try:
    import cv2
    print("[i] OpenCV", cv2.__version__)
except Exception:
    traceback.print_exc()
    print("[x] opencv install koro:  pip install opencv-python==4.11.0.86")
    sys.exit(1)

try:
    import numpy as np
    print("[i] numpy", np.__version__)
except Exception:
    traceback.print_exc()
    print("[x] numpy install koro:  pip install \"numpy<2.3\"")
    sys.exit(1)

try:
    import mediapipe as mp
    print("[i] mediapipe", mp.__version__)
except Exception:
    traceback.print_exc()
    print("[x] mediapipe load hoy nai - upore asol error dekho")
    sys.exit(1)

try:
    from mediapipe.tasks.python import vision
except Exception:
    traceback.print_exc()
    print("[x] mediapipe.tasks load hoy nai - upore asol error dekho")
    sys.exit(1)

print("[i] sob module load hoise")

# ------------------------------------------------ model files
HERE = os.path.dirname(os.path.abspath(__file__))
HAND_MODEL = os.path.join(HERE, "hand_landmarker.task")
FACE_MODEL = os.path.join(HERE, "blaze_face_short_range.tflite")

MODEL_URLS = {
    HAND_MODEL: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    FACE_MODEL: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
}


def ensure_models():
    missing = [p for p in MODEL_URLS if not os.path.exists(p)]
    if not missing:
        print("[i] model files ready")
        return
    print("[i] prothom bar model download hocche (~10 MB, ekbar e lage)...")
    for path in missing:
        url = MODEL_URLS[path]
        tmp = path + ".part"
        print("    " + os.path.basename(path) + " ...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
            os.replace(tmp, path)
            print("    [ok] " + os.path.basename(path) + " (" + str(os.path.getsize(path) // 1024) + " KB)")
        except Exception as e:
            print("[x] download fail: " + str(e))
            print("    Manual download koro ei link theke:")
            print("    " + url)
            print("    File rakho ekhane: " + path)
            sys.exit(1)


THUMB_TIP, INDEX_TIP = 4, 8
WRIST, MIDDLE_MCP = 0, 9
WHITE, GREEN, CYAN = (255, 255, 255), (80, 220, 80), (255, 240, 120)

# MediaPipe hand skeleton connections (21 landmark)
HAND_CONNECTIONS = [(0, 1), (1, 2), (2, 3), (3, 4),
                    (0, 5), (5, 6), (6, 7), (7, 8),
                    (5, 9), (9, 10), (10, 11), (11, 12),
                    (9, 13), (13, 14), (14, 15), (15, 16),
                    (13, 17), (17, 18), (18, 19), (19, 20),
                    (0, 17)]

DOT_COLORS = [(255, 80, 80), (80, 180, 255), (120, 220, 120), (240, 200, 60), (200, 120, 240)]


# ------------------------------------------------ detector
class FrameDetector:
    """Tasks API HandLandmarker + FaceDetector, VIDEO mode."""

    def __init__(self, complexity=1):
        ensure_models()
        hand_opts = vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=HAND_MODEL),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.6,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5)
        self.hands = vision.HandLandmarker.create_from_options(hand_opts)

        face_opts = vision.FaceDetectorOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=FACE_MODEL),
            running_mode=vision.RunningMode.VIDEO,
            min_detection_confidence=0.55)
        self.face = vision.FaceDetector.create_from_options(face_opts)

        self._ts = 0
        self.smooth = {}

    def _mp_image(self, rgb):
        self._ts += 33  # ~30fps ms timestamp (monotonic)
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))

    def smooth_key(self, key, val, alpha=0.45):
        prev = self.smooth.get(key)
        out = val if prev is None else (alpha * val + (1 - alpha) * np.array(prev, float)).astype(int)
        self.smooth[key] = out
        return out

    def analyze(self, frame):
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = self._mp_image(rgb)

        fres = self.face.detect_for_video(mp_img, self._ts)
        hres = self.hands.detect_for_video(mp_img, self._ts)

        out = {"faces": [], "hands": [], "pinches": [], "frame_rect": None, "locked": False}

        # faces
        for det in (fres.detections or []):
            bb = det.bounding_box
            x1, y1 = max(0, int(bb.origin_x * w)), max(0, int(bb.origin_y * h))
            x2, y2 = min(w, int((bb.origin_x + bb.width) * w)), min(h, int((bb.origin_y + bb.height) * h))
            score = float(det.categories[0].score) if det.categories else 0.0
            if x2 - x1 > 10 and y2 - y1 > 10:
                out["faces"].append((x1, y1, x2, y2, score))

        # hands
        for hand_lms in (hres.hand_landmarks or []):
            pts = np.array([[int(l.x * w), int(l.y * h)] for l in hand_lms])
            scale = float(np.linalg.norm(pts[WRIST] - pts[MIDDLE_MCP])) or 1.0
            d = float(np.linalg.norm(pts[THUMB_TIP] - pts[INDEX_TIP]))
            pinched = d < 0.32 * scale
            mid = (pts[THUMB_TIP] + pts[INDEX_TIP]) // 2
            out["hands"].append({"pts": pts})
            out["pinches"].append({"on": pinched, "mid": mid, "scale": scale})

        # gesture 1: dui haat -> filmmaker frame (4 fingertip = 4 kony)
        if len(out["hands"]) >= 2:
            tips = []
            for hand in out["hands"][:2]:
                tips.append(hand["pts"][THUMB_TIP])
                tips.append(hand["pts"][INDEX_TIP])
            tips = np.array(tips)
            x1, y1 = tips.min(axis=0)
            x2, y2 = tips.max(axis=0)
            pad = 10
            x1, y1, x2, y2 = max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y2 + pad)
            if (x2 - x1) > 80 and (y2 - y1) > 60:
                x1, y1 = self.smooth_key("fx1", np.array([x1, y1]))
                x2, y2 = self.smooth_key("fx2", np.array([x2, y2]))
                out["frame_rect"] = (int(x1), int(y1), int(x2), int(y2))

        # gesture 2: ek haati pinch -> mini frame
        else:
            for p in out["pinches"]:
                if p["on"]:
                    side = int(max(60, 2.4 * p["scale"]))
                    x, y = int(p["mid"][0]), int(p["mid"][1])
                    out["frame_rect"] = (max(0, x - side // 2), max(0, y - side // 2),
                                         min(w, x + side // 2), min(h, y + side // 2))
                    break

        # lock check: frame ta mukher chokher-elaka cover korche?
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


# ------------------------------------------------ renderer
def draw_hud(canvas, st, fps, flags):
    h, w = canvas.shape[:2]
    title = "handtrack python  |  OpenCV + MediaPipe Tasks"
    status = "FACE LOCKED" if st["locked"] else ("frame" if st["frame_rect"] else "search")
    color = GREEN if st["locked"] else (CYAN if st["frame_rect"] else (170, 170, 170))
    txt = status + "  hands:" + str(len(st["hands"])) + (("  " + format(fps, "4.1f") + " fps") if fps else "")

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


def render(frame, st, fps, flags):
    canvas = frame.copy()
    fx1, fy1, fx2, fy2 = st.get("frame_rect") or (0, 0, 0, 0)

    # background blur (frame/face gated)
    if flags["blur"]:
        gate = st["frame_rect"] or (st["faces"][0][:4] if st["faces"] else None)
        if gate:
            blur = cv2.GaussianBlur(canvas, (0, 0), 19)
            mask = np.zeros(canvas.shape[:2], np.uint8)
            cv2.rectangle(mask, gate[:2], gate[2:4], 255, -1)
            canvas = np.where(mask[:, :, None] == 255, canvas, blur)

    if flags["gray"]:
        canvas = cv2.cvtColor(cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)

    for (x1, y1, x2, y2, score) in st["faces"]:
        cv2.rectangle(canvas, (x1, y1), (x2, y2), WHITE, 2, cv2.LINE_AA)
        cv2.putText(canvas, "face " + str(int(score * 100)) + "%", (x1, max(16, y1 - 8)),
                    cv2.FONT_HERSHEY_DUPLEX, 0.5, WHITE, 1, cv2.LINE_AA)

    for hand in st["hands"]:
        pts = hand["pts"]
        for (a, b) in HAND_CONNECTIONS:
            cv2.line(canvas, tuple(pts[a]), tuple(pts[b]), WHITE, 2, cv2.LINE_AA)
        for i, p in enumerate(pts):
            r = 6 if i % 4 == 0 else 4
            cv2.circle(canvas, tuple(p), r, DOT_COLORS[(i // 4) % 5], -1, cv2.LINE_AA)

    if st["frame_rect"]:
        if st["locked"]:
            cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), GREEN, 5, cv2.LINE_AA)
            cv2.putText(canvas, "FACE LOCKED", (fx1, max(28, fy1 - 12)),
                        cv2.FONT_HERSHEY_DUPLEX, 0.85, GREEN, 2, cv2.LINE_AA)
            corners = [((fx1, fy1), (fx1 + 26, fy1)), ((fx1, fy1), (fx1, fy1 + 26)),
                       ((fx2, fy1), (fx2 - 26, fy1)), ((fx2, fy1), (fx2, fy1 + 26)),
                       ((fx1, fy2), (fx1 + 26, fy2)), ((fx1, fy2), (fx1, fy2 - 26)),
                       ((fx2, fy2), (fx2 - 26, fy2)), ((fx2, fy2), (fx2, fy2 - 26))]
            for (a, b) in corners:
                cv2.line(canvas, a, b, GREEN, 2, cv2.LINE_AA)
        else:
            cv2.rectangle(canvas, (fx1, fy1), (fx2, fy2), CYAN, 2, cv2.LINE_AA)

    if flags["roi"] and st["faces"]:
        x1, y1, x2, y2, _ = st["faces"][0]
        crop = frame[max(0, y1):y2, max(0, x1):x2]
        if crop.size:
            iw = 150
            crop = cv2.resize(crop, (iw, int(crop.shape[0] * iw / crop.shape[1])))
            ch, cw = crop.shape[:2]
            y0, x0 = 46, canvas.shape[1] - cw - 12
            canvas[y0:y0 + ch, x0:x0 + cw] = crop
            cv2.rectangle(canvas, (x0, y0), (x0 + cw, y0 + ch), WHITE, 2)

    draw_hud(canvas, st, fps, flags)
    return canvas


# ------------------------------------------------ main
def main():
    import argparse
    ap = argparse.ArgumentParser(description="Hand tracking + face framing demo (Tasks API)")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--height", type=int, default=540)
    ap.add_argument("--complexity", type=int, default=1, choices=[0, 1])
    ap.add_argument("--out-dir", default="captures")
    args = ap.parse_args()

    flags = {"blur": False, "gray": False, "roi": True}

    print("[i] model loader calteche...")
    det = FrameDetector(args.complexity)
    print("[i] model ready - camera khulte jacche...")

    backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
    cap = cv2.VideoCapture(args.camera, backend)
    if not cap.isOpened():
        print("[x] camera khula jacche na - onno camera:  python sigmacamera.py --camera 1")
        sys.exit(1)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    print("[i] Camera cholche!  Keys:  B=blur  G=gray  R=roi  S=shot  Q=quit")

    fps, t0, n = 0.0, time.time(), 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("[x] frame ashe nai - camera busy? (Zoom/Meet bondho koro)")
                break
            frame = cv2.flip(frame, 1)

            st = det.analyze(frame)
            n += 1
            now = time.time()
            if now - t0 >= 0.5:
                fps, t0, n = n / (now - t0), now, 0
            out = render(frame, st, fps, flags)

            cv2.imshow("handtrack python - q:quit  b:blur  g:gray  r:roi  s:shot", out)
            k = cv2.waitKey(1) & 0xFF
            if k in (ord('q'), 27):
                break
            elif k == ord('b'):
                flags["blur"] = not flags["blur"]
            elif k == ord('g'):
                flags["gray"] = not flags["gray"]
            elif k == ord('r'):
                flags["roi"] = not flags["roi"]
            elif k == ord('s'):
                os.makedirs(args.out_dir, exist_ok=True)
                p = os.path.join(args.out_dir, "shot_" + str(int(time.time())) + ".jpg")
                cv2.imwrite(p, out)
                print("[ok] screenshot -> " + p)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[ok] bondho. Dhonnobad!")


if __name__ == "__main__":
    main()
