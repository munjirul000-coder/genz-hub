"""Bloom sample-edit asset generator: phone-UI mockup screens + hype beat."""
import math, os, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)
FD = "/usr/share/fonts/truetype/dejavu"

def font(sz, bold=True):
    return ImageFont.truetype(os.path.join(FD, "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), sz)

def vgrad(top, bottom):
    t = np.linspace(0, 1, H)[:, None]
    arr = (np.array(top)[None, None, :] * (1 - t[:, :, None]) + np.array(bottom)[None, None, :] * t[:, :, None])
    return Image.fromarray(np.repeat(arr.astype(np.uint8), W, axis=1))

def glow_bg(base, color, pos, r):
    layer = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(layer)
    d.ellipse([pos[0]-r, pos[1]-r, pos[0]+r, pos[1]+r], fill=255)
    layer = layer.filter(ImageFilter.GaussianBlur(160))
    solid = Image.new("RGB", (W, H), color)
    return Image.composite(solid, base, layer)

def status_bar(d):
    d.text((60, 48), "9:41", font=font(38), fill="white")
    for i in range(4):
        h = 14 + i * 9
        d.rectangle([W-160+i*28, 84-h, W-140+i*28, 84], fill="white")
    d.rounded_rectangle([W-120, 52, W-56, 84], radius=8, outline="white", width=4)
    d.rectangle([W-112, 59, W-84, 77], fill="#4ade80")

def app_header(d, title="bloom"):
    for i, c in enumerate(["#ff7183", "#fe2c55", "#ff7183"]):
        d.ellipse([56+i*26, 140, 96+i*26, 180], fill=c)
    d.text((160, 128), title, font=font(62), fill="white")
    d.rounded_rectangle([W-232, 132, W-56, 188], radius=28, outline="#fe2c55", width=5)
    d.text((W-196, 140), "BETA", font=font(34), fill="#fe2c55")

def stories_row(img, d, y=230):
    names = ["YOU", "RAF", "NAB", "TAN", "SAD"]
    for i, n in enumerate(names):
        x = 56 + i * 200
        d.ellipse([x-10, y-10, x+130, y+130], fill="#fe2c55")
        d.ellipse([x-4, y-4, x+124, y+124], fill="#0b0610")
        d.ellipse([x+4, y+4, x+116, y+116], fill=["#7c2d4e", "#274156", "#1d5c4d", "#5c4a1d", "#472d7c"][i])
        d.text((x+30, y+32), n[0], font=font(52), fill="white")
        d.text((x+22, y+140), n, font=font(28), fill="#c9c9d4")

def bottom_nav(d, active=0):
    labels = ["HOME", "FEED", "+", "CHAT", "YOU"]
    for i, l in enumerate(labels):
        x = 70 + i * 195
        if l == "+":
            d.rounded_rectangle([x-14, H-168, x+94, H-88], radius=26, fill="#fe2c55")
            d.text((x+16, H-158), "+", font=font(52), fill="white")
        else:
            col = "white" if i == active else "#6f6f7e"
            d.ellipse([x+8, H-158, x+52, H-114], outline=col, width=6)
            d.text((x-6, H-96), l, font=font(24), fill=col)

def caption_pill(d, text, y):
    f = font(40)
    bb = d.textbbox((0, 0), text, font=f)
    tw = bb[2] - bb[0] + 70
    x0 = (W - tw) // 2
    d.rounded_rectangle([x0, y, x0 + tw, y + 92], radius=46, fill="#fe2c55")
    d.text((x0 + 35, y + 18), text, font=f, fill="white")

# ---------- 1. HOOK ----------
img = vgrad((8, 2, 8), (30, 4, 16))
img = glow_bg(img, (254, 44, 85), (W//2, 500), 420)
img = glow_bg(img, (90, 20, 120), (W//2, 1500), 480)
d = ImageDraw.Draw(img)
status_bar(d)
d.rounded_rectangle([W//2-190, 300, W//2+190, 372], radius=36, outline="white", width=5)
d.text((W//2-132, 314), "MY OWN APP", font=font(38), fill="white")
lines = [("I BUILT", "white"), ("MY OWN", "white"), ("SOCIAL", "#fe2c55"), ("MEDIA!", "#fe2c55")]
y = 470
for txt, col in lines:
    f = font(168)
    bb = d.textbbox((0, 0), txt, font=f)
    d.text(((W-(bb[2]-bb[0]))//2, y), txt, font=f, fill=col,
           stroke_width=3, stroke_fill="black")
    y += 240
d.text((W//2-330, 1470), "sound on, watch till end", font=font(44), fill="#e8e8ef")
caption_pill(d, "WAIT FOR IT...", 1600)
img.save(f"{OUT}/hook.png")

# ---------- 2. FEED ----------
img = vgrad((10, 4, 12), (22, 6, 20))
d = ImageDraw.Draw(img)
status_bar(d); app_header(d); stories_row(img, d)
y = 470
for name, col, likes in [("rafi_dev", "#274156", "12.4K"), ("nabila_ui", "#7c2d4e", "8.1K")]:
    d.rounded_rectangle([40, y, W-40, y+500], radius=42, fill="#17111f")
    d.ellipse([80, y+36, 168, y+124], fill=col)
    d.text((104, y+50), name[0].upper(), font=font(44), fill="white")
    d.text((196, y+44), name, font=font(40), fill="white")
    d.text((196, y+100), "2h  |  Gaming Hub", font=font(30), fill="#8e8e99")
    d.rounded_rectangle([80, y+170, W-80, y+380], radius=28, fill=col)
    d.polygon([(W//2-34, y+226), (W//2-34, y+322), (W//2+52, y+274)], fill="white")
    d.ellipse([96, y+412, 140, y+456], outline="#fe2c55", width=7)
    d.text((160, y+410), likes, font=font(34), fill="white")
    d.ellipse([330, y+412, 374, y+456], outline="white", width=6)
    d.text((394, y+410), "312", font=font(34), fill="white")
    y += 540
bottom_nav(d, active=1)
caption_pill(d, "FEED + STORIES + POSTS", 1520)
ImageDraw.Draw(img)
img.save(f"{OUT}/feed.png")

# ---------- 3. SHORTS ----------
img = vgrad((40, 6, 26), (8, 3, 10))
img = glow_bg(img, (120, 20, 80), (W//2, 900), 520)
d = ImageDraw.Draw(img)
status_bar(d)
d.text((60, 130), "bloom Shorts", font=font(56), fill="white")
d.rounded_rectangle([60, 260, W-170, 1420], radius=44, fill="#120a18")
d.rounded_rectangle([60, 260, W-170, 1420], radius=44, outline="#fe2c55", width=6)
for i, cc in enumerate(["#3b1d4e", "#56204a", "#7c2d4e"]):
    d.rounded_rectangle([110, 340+i*180, W-220, 490+i*180], radius=24, fill=cc)
d.polygon([(W//2-140, 700), (W//2-140, 900), (W//2+20, 800)], fill="white")
for i, (ico, n) in enumerate([("o", "45K"), ("o", "2.1K"), ("o", "9.8K")]):
    yy = 560 + i * 220
    d.ellipse([W-140, yy, W-60, yy+80], outline="white", width=6)
    d.text((W-142, yy+92), n, font=font(30), fill="white")
d.text((110, 1470), "@tanvir  |  original sound", font=font(36), fill="white")
caption_pill(d, "TIKTOK-STYLE SHORTS", 1600)
img.save(f"{OUT}/shorts.png")

# ---------- 4. MESSAGES ----------
img = vgrad((6, 8, 14), (14, 6, 22))
d = ImageDraw.Draw(img)
status_bar(d); app_header(d, "chats")
msgs = [("Bro, Bloom ta josss!", 0), ("Thanks! Kalke Shorts asbe", 1),
        ("Beta access dibi?", 0), ("100%! Link pathaitesi", 1)]
y = 420
for txt, me in msgs:
    f = font(36)
    bb = d.textbbox((0, 0), txt, font=f)
    tw = bb[2]-bb[0]+70
    x0 = W-60-tw if me else 60
    col = "#fe2c55" if me else "#26232e"
    d.rounded_rectangle([x0, y, x0+tw, y+100], radius=34, fill=col)
    d.text((x0+35, y+24), txt, font=f, fill="white")
    y += 150
d.rounded_rectangle([60, 1180, W-60, 1280], radius=50, fill="#1c1826")
d.text((110, 1210), "Message...", font=font(36), fill="#77778a")
d.rounded_rectangle([60, 1340, W-60, 1520], radius=40, fill="#123524")
d.text((110, 1380), "Dark mode + Bangla ready", font=font(40), fill="#4ade80")
bottom_nav(d, active=3)
caption_pill(d, "CHAT + DARK MODE + BANGLA", 1560)
img.save(f"{OUT}/chat.png")

# ---------- 5. ENDCARD ----------
img = vgrad((8, 2, 8), (34, 4, 18))
img = glow_bg(img, (254, 44, 85), (W//2, 700), 460)
d = ImageDraw.Draw(img)
status_bar(d)
d.text((W//2-300, 420), "WANT PART 2?", font=font(96), fill="white",
       stroke_width=2, stroke_fill="black")
d.text((W//2-330, 640), "COMMENT  'BLOOM'", font=font(72), fill="#fe2c55",
       stroke_width=2, stroke_fill="black")
d.rounded_rectangle([W//2-330, 900, W//2+330, 1040], radius=70, fill="white")
d.text((W//2-238, 946), "FOLLOW  THE  BUILD", font=font(44), fill="black")
d.text((W//2-300, 1200), "built with code + coffee", font=font(44), fill="#c9c9d4")
caption_pill(d, "LINK IN BIO SOON", 1560)
img.save(f"{OUT}/end.png")
print("PNGs done")

# ---------- BEAT (128 BPM hype, 15 s) ----------
SR = 44100
T = 15.0
N = int(SR * T)
t = np.arange(N) / SR
bpm, beat = 128, 60 / 128
out = np.zeros(N)

def place(sig, at):
    i = int(at * SR)
    j = min(N, i + len(sig))
    if i < N:
        out[i:j] += sig[:j-i]

rng = np.random.default_rng(7)
# kick on every beat
klen = int(SR * 0.30)
kt = np.arange(klen) / SR
kick = np.sin(2*np.pi*(120*np.exp(-kt*22)+42)*kt) * np.exp(-kt*16)
# snare on 2 & 4
slen = int(SR * 0.20)
st = np.arange(slen) / SR
snare = rng.standard_normal(slen) * np.exp(-st*28) * 0.7 + np.sin(2*np.pi*190*st) * np.exp(-st*30) * 0.5
# hats offbeat
hlen = int(SR * 0.06)
ht = np.arange(hlen) / SR
hat = np.diff(rng.standard_normal(hlen+1)) * np.exp(-ht*90) * 0.5
nb = int(T / beat)
for b in range(nb):
    at = b * beat
    if at >= 3.75:  # drums drop after hook
        place(kick, at)
        if b % 4 in (1, 3):
            place(snare, at)
    if at >= 3.75:
        place(hat, at + beat/2)
        if b % 2 == 0:
            place(hat * 0.5, at + beat/4)
# bassline (A F C G, drops with drums)
roots = [55.0, 43.65, 65.41, 49.0]
for bar in range(8):
    f0 = roots[bar % 4]
    for k in range(4):
        at = 3.75 + bar * 4 * beat + k * beat
        if at + beat > T:
            continue
        L = int(SR * beat * 0.95)
        tt = np.arange(L) / SR
        w = (np.sin(2*np.pi*f0*tt) + 0.4*np.sin(4*np.pi*f0*tt) + 0.2*np.sin(6*np.pi*f0*tt))
        place(w * np.exp(-tt*3) * 0.5, at)
# riser 0-3.75 + impact
rlen = int(SR * 3.75)
rise = rng.standard_normal(rlen)
rise = np.convolve(rise, np.ones(40)/40, mode="same")
rise *= np.linspace(0, 1, rlen) ** 2 * 1.2
place(rise, 0)
ilen = int(SR * 0.8)
it = np.arange(ilen) / SR
place(np.sin(2*np.pi*55*it) * np.exp(-it*6) * 1.2 + rng.standard_normal(ilen) * np.exp(-it*9) * 0.8, 3.75)
# master
out = np.tanh(out * 1.1) * 0.89
fade = int(SR * 0.6)
out[-fade:] *= np.linspace(1, 0, fade)
pcm = (out * 32767).astype(np.int16)
with wave.open(f"{OUT}/beat.wav", "wb") as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR)
    wv.writeframes(pcm.tobytes())
print("beat done")
