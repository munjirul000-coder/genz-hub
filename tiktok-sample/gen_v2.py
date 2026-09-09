"""Bloom sample v2: 3-part hook cards + phonk-style beat."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets")
FD = "/usr/share/fonts/truetype/dejavu"

def font(sz):
    return ImageFont.truetype(os.path.join(FD, "DejaVuSans-Bold.ttf"), sz)

def vgrad(top, bottom):
    t = np.linspace(0, 1, H)[:, None]
    arr = (np.array(top)[None, None, :] * (1 - t[:, :, None]) + np.array(bottom)[None, None, :] * t[:, :, None])
    return Image.fromarray(np.repeat(arr.astype(np.uint8), W, axis=1))

def glow_bg(base, color, pos, r):
    layer = Image.new("L", (W, H), 0)
    ImageDraw.Draw(layer).ellipse([pos[0]-r, pos[1]-r, pos[0]+r, pos[1]+r], fill=255)
    layer = layer.filter(ImageFilter.GaussianBlur(160))
    return Image.composite(Image.new("RGB", (W, H), color), base, layer)

def center_text(d, y, txt, f, fill):
    bb = d.textbbox((0, 0), txt, font=f)
    d.text(((W-(bb[2]-bb[0]))//2, y), txt, font=f, fill=fill, stroke_width=3, stroke_fill="black")

def pill(d, text, y, fill="#fe2c55", fg="white"):
    f = font(40)
    bb = d.textbbox((0, 0), text, font=f)
    tw = bb[2]-bb[0]+70
    x0 = (W-tw)//2
    d.rounded_rectangle([x0, y, x0+tw, y+92], radius=46, fill=fill)
    d.text((x0+35, y+18), text, font=f, fill=fg)

# hook1: I BUILT
img = glow_bg(vgrad((8,2,8),(26,4,16)), (254,44,85), (W//2,420), 400)
d = ImageDraw.Draw(img)
d.text((60,48), "9:41", font=font(38), fill="white")
pill(d, "MY OWN APP", 300, fill="#1c1826")
center_text(d, 620, "I", font(300), "white")
center_text(d, 950, "BUILT", font(190), "white")
pill(d, "SOUND ON", 1600)
img.save(f"{OUT}/hook1.png")

# hook2: MY OWN
img = glow_bg(vgrad((6,2,12),(20,4,30)), (120,30,160), (W//2,900), 460)
d = ImageDraw.Draw(img)
d.text((60,48), "9:41", font=font(38), fill="white")
center_text(d, 560, "MY", font(300), "white")
center_text(d, 900, "OWN", font(300), "white")
d.text((W//2-200, 1330), "keep watching...", font=font(44), fill="#c9c9d4")
img.save(f"{OUT}/hook2.png")

# hook3: SOCIAL MEDIA!
img = glow_bg(vgrad((10,2,8),(40,4,18)), (254,44,85), (W//2,800), 520)
d = ImageDraw.Draw(img)
d.text((60,48), "9:41", font=font(38), fill="white")
center_text(d, 480, "SOCIAL", font(168), "#fe2c55")
center_text(d, 700, "MEDIA!", font(168), "#fe2c55")
center_text(d, 1080, "3 ... 2 ... 1", font(84), "white")
pill(d, "WAIT FOR THE DROP", 1560)
img.save(f"{OUT}/hook3.png")
print("hook cards done")

# ---------- PHONK BEAT (128 BPM, 15 s) ----------
import wave
SR = 44100
T, N = 15.0, int(44100*15.0)
t = np.arange(N)/SR
beat = 60/128
out = np.zeros(N)
def place(sig, at):
    i = int(at*SR)
    j = min(N, i+len(sig))
    if 0 <= i < N:
        out[i:j] += sig[:j-i]
rng = np.random.default_rng(11)

def kick():
    L = int(SR*0.28); tt = np.arange(L)/SR
    return np.sin(2*np.pi*(130*np.exp(-tt*24)+44)*tt)*np.exp(-tt*15)
def snare():
    L = int(SR*0.22); tt = np.arange(L)/SR
    n = rng.standard_normal(L)
    clap = n*np.exp(-tt*26)
    for dl in (0.012, 0.024):
        k = int(dl*SR)
        clap[k:] += n[:-k]*np.exp(-(tt[k:]-dl)*26)*0.6 if k < L else 0
    return clap*0.6 + np.sin(2*np.pi*200*tt)*np.exp(-tt*32)*0.4
def hat(op=False):
    L = int(SR*(0.16 if op else 0.05)); tt = np.arange(L)/SR
    return np.diff(rng.standard_normal(L+1))*np.exp(-tt*(30 if op else 95))*0.45
def cowbell(f):
    L = int(SR*0.22); tt = np.arange(L)/SR
    sq = lambda x: np.sign(np.sin(2*np.pi*x*tt))
    return (sq(f)+0.6*sq(f*1.48))*np.exp(-tt*16)*0.30
def bass808(f0, dur=0.5):
    L = int(SR*dur); tt = np.arange(L)/SR
    ph = 2*np.pi*(f0*tt + 26*(1-np.exp(-tt*30))/30)
    return np.tanh(np.sin(ph)*1.6)*np.exp(-tt*4.5)*0.9

K, S = kick(), snare()
nb = int(T/beat)
for b in range(nb):
    at = b*beat
    if at < 3.75:
        continue
    bar = int((at-3.75)//(4*beat))
    place(K*(1.0 if b % 4 == 0 else 0.7), at)          # 4-floor kick
    if b % 4 == 2:
        place(S, at)                                    # phonk snare on 3
    place(hat(), at+beat/2)                             # offbeat hat
    if b % 2 == 0:
        place(hat()*0.4, at+beat*0.25)
    if bar % 2 == 1 and b % 4 == 3:                     # roll into next bar
        for r in range(4):
            place(hat()*0.5, at+beat*0.5+r*beat/8)
# cowbell riff (A minor pent, 2-bar loop)
scale = {"A4":440.0,"C5":523.25,"D5":587.33,"E5":659.25,"G5":783.99,"A5":880.0}
riff = ["A4",None,"C5",None,"D5","C5",None,"A4",None,"E5",None,"D5","C5",None,"G5",None]
step = beat/2
pos = 3.75
while pos < T-1.0:
    for i, n in enumerate(riff):
        if n:
            place(cowbell(scale[n]), pos+i*step)
            place(cowbell(scale[n])*0.3, pos+i*step+step*1.5)  # echo
    pos += len(riff)*step
# 808 bassline
roots = [55.0, 55.0, 43.65, 49.0]
bar0 = 3.75
bidx = 0
while bar0 < T-0.6:
    f0 = roots[bidx % 4]
    place(bass808(f0), bar0)
    place(bass808(f0*1.5, 0.3)*0.7, bar0+2*beat+beat/2)
    bar0 += 4*beat
    bidx += 1
# dark pad
padL = int(SR*(T-3.75)); pt = np.arange(padL)/SR
pad = (np.sin(2*np.pi*55*pt)+0.5*np.sin(2*np.pi*82.5*pt))*(0.6+0.4*np.sin(2*np.pi*0.5*pt))*0.10
place(pad, 3.75)
# riser + impact
rlen = int(SR*3.75)
rise = np.convolve(rng.standard_normal(rlen), np.ones(60)/60, mode="same")
rise *= np.linspace(0, 1, rlen)**2*1.3
place(rise, 0)
ilen = int(SR*0.9); it = np.arange(ilen)/SR
place(np.sin(2*np.pi*52*it)*np.exp(-it*5)*1.3 + rng.standard_normal(ilen)*np.exp(-it*8)*0.9, 3.75)
# vinyl bed
out += rng.standard_normal(N)*0.012
out = np.tanh(out*1.15)*0.89
f = int(SR*0.6)
out[-f:] *= np.linspace(1, 0, f)
with wave.open(f"{OUT}/beat_v2.wav", "wb") as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR)
    wv.writeframes((out*32767).astype(np.int16).tobytes())
print("phonk beat done")
