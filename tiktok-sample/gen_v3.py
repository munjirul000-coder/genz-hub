"""Bloom sample v3 ULTRA: frame-by-frame motion graphics (450 frames)."""
import math, os, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS, NF = 1080, 1920, 30, 450
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "assets")
FR = os.path.join(A, "v3")
os.makedirs(FR, exist_ok=True)
FD = "/usr/share/fonts/truetype/dejavu"
F = lambda sz: ImageFont.truetype(os.path.join(FD, "DejaVuSans-Bold.ttf"), sz)
rng = np.random.default_rng(21)

# ---------------- helpers ----------------
def vgrad(top, bottom):
    t = np.linspace(0, 1, H)[:, None]
    arr = (np.array(top)[None, None, :] * (1 - t[:, :, None]) + np.array(bottom)[None, None, :] * t[:, :, None])
    return Image.fromarray(np.repeat(arr.astype(np.uint8), W, axis=1))

def glow(base, color, pos, r):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse([pos[0]-r, pos[1]-r, pos[0]+r, pos[1]+r], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(150))
    return Image.composite(Image.new("RGB", (W, H), color), base, m)

def text_sprite(txt, size, fill, pad=60):
    f = F(size)
    bb = ImageDraw.Draw(Image.new("RGB", (8, 8))).multiline_textbbox((0, 0), txt, font=f, align="center")
    tw, th = int(bb[2]-bb[0]+pad*2), int(bb[3]-bb[1]+pad*2)
    im = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(im).multiline_text((pad-bb[0], pad-bb[1]), txt, font=f, fill=fill, align="center",
                                      stroke_width=max(2, size//45), stroke_fill="black")
    return im

def paste_center(canvas, spr, cx, cy, scale=1.0, alpha=1.0):
    w, h = int(spr.width*scale), int(spr.height*scale)
    if w < 2 or h < 2:
        return
    s = spr.resize((w, h), Image.BILINEAR)
    if alpha < 1.0:
        a = s.getchannel("A").point(lambda v: int(v*alpha))
        s.putalpha(a)
    canvas.alpha_composite(s, (int(cx-w/2), int(cy-h/2)))

def slam_scale(dt):  # overshoot bounce, dt = frames since slam
    return 1 + 1.9*math.exp(-dt*0.45)*math.cos(dt*1.1)

def ease_out(x):
    return 1-(1-x)**3

# ---------------- pre-rendered layers ----------------
print("pre-rendering layers...")
hook_bgs = [
    glow(vgrad((8,2,8),(26,4,16)), (254,44,85), (W//2,700), 430),
    glow(vgrad((6,2,12),(20,4,30)), (120,30,160), (W//2,900), 470),
    glow(vgrad((10,3,10),(30,5,20)), (200,20,90), (W//2,800), 450),
    glow(vgrad((12,2,8),(46,5,18)), (254,44,85), (W//2,850), 540),
]
hook_bgs_big = [b.resize((int(W*1.3), int(H*1.3)), Image.LANCZOS) for b in hook_bgs]
screens = {}
for name in ("feed", "shorts", "chat", "end"):
    screens[name] = Image.open(f"{A}/{name}.png").convert("RGB").resize((int(W*1.3), int(H*1.3)), Image.LANCZOS)

W1 = text_sprite("I", 330, "white")
W2 = text_sprite("BUILT", 205, "white")
W3 = text_sprite("MY OWN", 168, "white")
W4 = text_sprite("SOCIAL\nMEDIA!", 175, "#fe2c55")
PILL_TOP = text_sprite("MY OWN APP", 44, "white")
PILL_SND = text_sprite("SOUND ON", 44, "white")
N3 = text_sprite("3", 210, "#fe2c55"); N2 = text_sprite("2", 210, "#fe2c55"); N1 = text_sprite("1", 210, "#fe2c55")
CTA = text_sprite("FOLLOW THE BUILD", 46, "black")

yy, xx = np.mgrid[0:H, 0:W]
dist = np.sqrt(((xx-W/2)/(W/2))**2 + ((yy-H/2)/(H/2))**2)
vig = Image.fromarray((np.clip((dist-0.55)*160, 0, 110)).astype(np.uint8))
BLACK = Image.new("RGB", (W, H), (0, 0, 0))
WHITE = Image.new("RGB", (W, H), (255, 255, 255))

# timeline (frames)
SLAMS = [0, 28, 56, 84]            # word slam frames
SEG = [("hook", 0, 111), ("feed", 112, 195), ("shorts", 196, 279), ("chat", 280, 363), ("end", 364, 449)]
DROP = 112
BEAT = 0.46875
kicks = [int((3.75+k*BEAT)*FPS) for k in range(24) if (3.75+k*BEAT) < 14.9]

def pump(f):
    p = 0.0
    for kf in kicks:
        if kf <= f:
            p += 0.022*math.exp(-(f-kf)/3.0)
    return p

def shake_amp(f):
    a = 0.0
    for s in SLAMS:
        if 0 <= f-s < 7:
            a += 10*math.exp(-(f-s)*0.6)
    if 0 <= f-DROP < 20:
        a += 17*math.exp(-(f-DROP)*0.28)
    return a

def zoom_crop(src_big, z, dx=0, dy=0):
    sw, sh = src_big.size
    cw, ch = sw/z, sh/z
    k = cw/W
    x0 = (sw-cw)/2 + dx*k
    y0 = (sh-ch)/2 + dy*k
    return src_big.transform((W, H), Image.TRANSFORM.QUAD if False else Image.AFFINE,
                             (cw/W, 0, x0, 0, ch/H, y0), resample=Image.BILINEAR)

petals = [(rng.uniform(0, W), rng.uniform(0, 2100), rng.uniform(9, 22), rng.uniform(0, 6.28),
           rng.uniform(3.2, 6.5), rng.choice(["#ff7183", "#fe2c55", "#c2183f", "#ff9aab"])) for _ in range(26)]
dust = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1.5, 3.5)) for _ in range(14)]

# ---------------- render ----------------
print("rendering 450 frames...")
for f in range(NF):
    if f <= 111:
        wi = 0 if f < 28 else (1 if f < 56 else (2 if f < 84 else 3))
        z = 1.0 + 0.05*(f/111)
        sa = shake_amp(f)
        dx = sa*math.sin(f*12.9)*0.7 if sa else 0
        dy = sa*math.cos(f*15.7)*0.7 if sa else 0
        img = zoom_crop(hook_bgs_big[wi], z, dx, dy).convert("RGBA")
        d = ImageDraw.Draw(img, "RGBA")
        d.text((60, 48), "9:41", font=F(38), fill="white")
        paste_center(img, PILL_TOP, W/2, 335, 1.0)
        dt = f - SLAMS[wi]
        spr = (W1, W2, W3, W4)[wi]
        paste_center(img, spr, W/2, 920, slam_scale(max(dt, 0)))
        if dt < 13:  # shockwave ring
            r = 120 + dt*46
            d.ellipse([W/2-r, 920-r*1.4, W/2+r, 920+r*1.4], outline=(255,255,255,int(200*(1-dt/13))), width=7)
        if dt < 3:  # slam flash
            img = Image.blend(img.convert("RGB"), WHITE, 0.28*(1-dt/3)).convert("RGBA")
            d = ImageDraw.Draw(img, "RGBA")
        if f < 84:
            pulse = 1+0.03*math.sin(f*0.5)
            paste_center(img, PILL_SND, W/2, 1620, pulse)
        else:
            num = N3 if f < 98 else (N2 if f < 105 else N1)
            ns = slam_scale(f-(91 if f < 98 else (98 if f < 105 else 105)))
            paste_center(img, num, 880, 1620, max(ns, 0.4))
        for (x0, y0, r0) in dust:  # floating dust
            yy_ = (y0 - f*1.2) % (H+40) - 20
            xx_ = x0 + 20*math.sin(f*0.03+x0)
            d.ellipse([xx_-r0, yy_-r0, xx_+r0, yy_+r0], fill=(255,255,255,40))
        img = img.convert("RGB")
    else:
        # pick segment + slide transition
        name = "feed" if f <= 195 else ("shorts" if f <= 279 else ("chat" if f <= 363 else "end"))
        bounds = {"feed": (112,195,1.02,1.10), "shorts": (196,279,1.10,1.02),
                  "chat": (280,363,1.00,1.08), "end": (364,449,1.00,1.07)}
        s0, s1, z0, z1 = bounds[name]
        lf = f-s0
        z = z0+(z1-z0)*(lf/max(s1-s0,1)) + pump(f)
        sa = shake_amp(f)
        dx = sa*math.sin(f*12.9) if sa else 0
        dy = sa*math.cos(f*15.7)*0.8 if sa else 0
        img = zoom_crop(screens[name], z, dx, dy)
        nxt = {"feed":"shorts","shorts":"chat","chat":"end"}.get(name)
        if nxt and lf >= (s1-s0)-9:  # push slide
            k = ease_out(((lf-((s1-s0)-9))+1)/10)
            off = int(k*W)
            zn = {"shorts":1.10,"chat":1.00,"end":1.00}[nxt]+pump(f)
            img2 = zoom_crop(screens[nxt], zn, dx, dy)
            img.paste(img2.crop((0,0,W-off,H)), (off,0))
            img.paste(img.crop((0,0,off,H)), (0,0)) if False else None
            left = img.crop((0,0,W-off,H)) if False else None
            # outgoing shifts left: rebuild properly
            base = zoom_crop(screens[name], z, dx, dy)
            canvas = Image.new("RGB",(W,H))
            canvas.paste(base.crop((off,0,W,H)), (0,0))
            canvas.paste(img2.crop((0,0,off,H)), (W-off,0))
            img = canvas
        d = ImageDraw.Draw(img, "RGBA")
        for (x0, y0, sz, ph, sp, col) in petals:  # falling petals
            yy_ = ((y0 + sp*(f-DROP)) % 2150)-120
            xx_ = x0 + 70*math.sin(f*0.045+ph)
            d.ellipse([xx_-sz/2, yy_-sz*0.75, xx_+sz/2, yy_+sz*0.75], fill=col)
        if name == "end":  # pulsing CTA ring
            pr = 1+0.035*math.sin(f*0.55)
            rw, rh = int(660*pr), int(140*pr)
            d.rounded_rectangle([W/2-rw/2, 970-rh/2, W/2+rw/2, 970+rh/2], radius=70, outline=(255,255,255,220), width=6)
        if 0 <= f-DROP < 3:  # drop flash
            img = Image.blend(img, WHITE, 0.85*(1-(f-DROP)/3))
        if 0 <= f-DROP < 8:  # RGB split glitch
            r, g, b = img.split()
            img = Image.merge("RGB", (ImageChops.offset(r, 7, 0), g, ImageChops.offset(b, -7, 0)))
        if 0 <= f-DROP < 18:  # drop rings
            rr = 150+(f-DROP)*52
            d = ImageDraw.Draw(img, "RGBA")
            d.ellipse([W/2-rr, 960-rr*1.5, W/2+rr, 960+rr*1.5], outline=(254,44,85,int(220*(1-(f-DROP)/18))), width=9)
    # grade: vignette + grain + progress
    img.paste(BLACK, (0,0), vig)
    arr = np.asarray(img).astype(np.int16) + rng.integers(-6, 7, (H,W,1)).astype(np.int16)
    img = Image.fromarray(np.clip(arr,0,255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    pw = int(W*(f+1)/NF)
    d.rectangle([0,H-14,pw,H], fill="#fe2c55")
    d.ellipse([pw-13,H-27,pw+13,H-1], fill="white")
    img.save(f"{FR}/f{f:04d}.jpg", quality=93)
    if f % 90 == 0:
        print(f"  frame {f}/450")
print("frames done")

# ---------------- beat v3 = v2 + slam SFX ----------------
print("building beat v3...")
with wave.open(f"{A}/beat_v2.wav","rb") as wv:
    sr, n = wv.getframerate(), wv.getnframes()
    audio = np.frombuffer(wv.readframes(n), dtype=np.int16).astype(np.float32)/32768
srN = len(audio)
def place(sig, at):
    i = int(at*sr); j = min(srN, i+len(sig))
    if 0 <= i < srN:
        audio[i:j] += sig[:j-i]
rr = np.random.default_rng(5)
def thump():
    L = int(sr*0.28); tt = np.arange(L)/sr
    return np.sin(2*np.pi*68*tt)*np.exp(-tt*14)*0.9 + rr.standard_normal(L)*np.exp(-tt*40)*0.25
def tick():
    L = int(sr*0.07); tt = np.arange(L)/sr
    return np.sin(2*np.pi*1250*tt)*np.exp(-tt*60)*0.35
for at in (0, 0.9375, 1.875, 2.8125):
    place(thump(), at)
for at in (3.0469, 3.28125, 3.5156):
    place(tick(), at)
L = int(sr*0.7); tt = np.arange(L)/sr
place(np.sin(2*np.pi*48*tt)*np.exp(-tt*5)*0.8, 3.75)
audio = np.tanh(audio*1.1)*0.89
with wave.open(f"{A}/beat_v3.wav","wb") as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(sr)
    wv.writeframes((audio*32767).astype(np.int16).tobytes())
print("ALL DONE")
