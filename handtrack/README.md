# ✋ handtrack python — Hand Tracking + Face Framing Demo

Real-time hand tracking + face bounding box demo — **Python + OpenCV + MediaPipe**.
Webcam te dui haat diye "frame" gesture banale sadha frame ake jay, frame er bhitore
mukh thakle **FACE LOCKED** 😈

**PyCharm diye chalano (5 step):**
1. Ei folder ta PyCharm e **Open** koro
2. Interpreter setup koro (PyCharm nijei suggest kore — Create chapo)
3. Terminal e: `pip install -r requirements.txt`
4. `handtrack.py` khule upore **sabuj ▶ Run** chapo
5. Window e: dui haat diye frame banao → **FACE LOCKED** 🔒

**Keys:** `B` blur · `G` grayscale · `R` ROI inset · `S` screenshot · `Q` quit

**Gestures:**
- Dui haater thumb+index diye boro frame → cyan viewfinder
- Frame mukher dike anaO → **FACE LOCKED** (sobuj)
- Ek haate pinch (OK sign) → chhoto mini-frame

## Onno option

```bash
python handtrack.py --camera 1        # 2nd webcam
python handtrack.py --image pic.jpg   # chobi annotate
python handtrack.py --video clip.mp4  # video file test
python handtrack.py --complexity 0    # fast mode (purano laptop)
python handtrack_lite.py              # mediapipe chara (pure OpenCV fallback)
```

## Troubleshooting

| Somossa | Samadhan |
|---|---|
| `libGL.so.1 not found` (Linux) | `pip install opencv-python-headless` |
| Camera khule na | `--camera 1` try koro |
| Mediapipe install fail | `handtrack_lite.py` — sudhu OpenCV |
| Slow fps | `--complexity 0` |
