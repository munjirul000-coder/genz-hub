# Gen-Z Hub — Video Pipeline

Upload → Validate → Probe → Transcode → Renditions → Store → Deliver → Adaptive playback.

Everything below is implemented in the codebase — no placeholders.

---

## 1. Ingest

`POST /api/media/video` (multipart, field `file`, auth required, default limit 300 MB)

* Accepts **MP4, MOV, WebM, MKV, M4V, 3GP, MPEG, AVI**.
* Writes the original to `DATA_DIR/uploads/src/` and immediately returns an **asset** record:
  `{ uid, status: 'processing', stage, progress }`.
* The upload never blocks the request: processing runs in a single-slot background queue
  (`VIDEO_CONCURRENCY`, default 1) so the web process stays responsive.

`GET /api/media/video/:uid` → live status (`stage`, `progress`, `poster`, `variants`).
`POST /api/media/video/:uid/retry` → re-runs a failed job ("Try again" in the UI).
`GET /api/media/capabilities` → `{ transcoding, maxVideoMb, cdn, queue }`.

## 2. Probe / validation (`src/video.js`)

`ffprobe` reports width, height, **rotation side-data** (iPhone/Android portrait clips), fps,
duration, bitrate, pixel format, video + audio codecs, channels and sample rate. Display
dimensions are stored *after* rotation, so the player never shows a sideways or squashed clip.

## 3. Transcode strategy — quality first

| Case | What happens | Quality cost |
|---|---|---|
| Source already H.264 / AAC (or MP3), yuv420p, ≤ `VIDEO_MAX_HEIGHT`, sane bitrate | **Remux only** (`-c copy -movflags +faststart`) | **Zero** — the original bytes are kept |
| Web-safe H.264 but a long clip whose re-encode would exceed `VIDEO_MAX_ENCODE_SECONDS` on this host | **Remux the top rendition**, build the smaller rungs underneath | **Zero** for the quality the viewer sees |
| Anything else (HEVC, VP9, AV1, huge bitrate, > max height) | CRF encode with libx264 High profile | Visually near-transparent |

Encoder settings (per rung): `-crf 21/22/23/24` (1080/720/480/360), `-preset veryfast`
(configurable), `-profile:v high -level 4.1 -pix_fmt yuv420p`, capped `-maxrate/-bufsize`,
`-g fps*2`, Lanczos scaling, `-movflags +faststart` (instant start / range-friendly),
audio `-c:a aac -b:a 96–160k -ar 48000` with the source channel count (mono stays mono,
stereo stays stereo).

**CRF, not a fixed low bitrate** — that is the difference between "sharp" and "blurry".

Transcodes run at `nice -n 19` with a single encoder thread on small instances, so the web process
stays responsive: measured feed-API latency during a 1440p transcode was **6 ms median / 23 ms max**.

## 4. Resolution ladder — derived from the source, never faked

The rung number is always the **short side**, so `1080p` means 1920×1080 landscape *and*
1080×1920 vertical. Both dimensions are scaled by the same factor → aspect ratio can never drift.

| Source | Renditions generated |
|---|---|
| 1080p | 1080p · 720p · 480p · 360p |
| 720p | 720p · 480p · 360p |
| 360p | 360p only (**no fake 1080p**) |
| 1440p / 4K | 1080p (top) · 720p · 480p · 360p |
| 240p | native 240p, never upscaled |

The top rendition + poster mark the asset **ready** (publishable); the smaller rungs keep
rendering in the background and are appended to `video_assets.variants` as they finish. The feed
reads variants live, so an old post automatically gains the extra qualities.

## 5. Thumbnails

One JPEG at ~15 % of the duration (max 3 s in), Lanczos-scaled to the display resolution
(capped at 1080 short side), `-q:v 2` — sharp, correct aspect ratio, web sized. Shown before the
video loads and used as the `<video poster>`.

## 6. Storage layout

```
DATA_DIR/uploads/
  src/<file>            original (deleted after success unless VIDEO_KEEP_ORIGINAL=1)
  v/<uid>/poster.jpg    thumbnail
  v/<uid>/1080p.mp4     renditions (content-addressed, never overwritten)
  v/<uid>/720p.mp4
```

No duplicate masters: we keep only what we actually serve.

## 7. Delivery / CDN readiness

* `/uploads/v/*` → `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges: bytes`,
  permissive CORS — safe for a CDN origin pull.
* HTTP **Range requests** are served by Express static (verified: `206 bytes 0-1023/…`), which is
  what makes seeking and progressive buffering work.
* **`MEDIA_BASE_URL`** rewrites every media URL in the API (`src/video-jobs.js → mediaUrl()`).
  Point it at S3/R2/Bunny/Cloudflare and video traffic leaves the app server without touching
  application code. Because renditions are immutable files under `v/<uid>/`, syncing that folder
  to object storage is a plain `rclone`/`aws s3 sync` job.

## 8. Player (`public/js/video.js` — "VOLT Player")

* Feed renders a **lazy shell** (`.gzv`) with poster + intrinsic aspect ratio → no layout shift,
  no `<video>` element until the shell is within 1.5 viewports.
* **IntersectionObserver** (+ fresh `getBoundingClientRect` recompute to defeat stale entries).
* Autoplay muted at ≥ 62 % visibility, pause at < 38 %, **never two videos at once**.
* **Element pool of 3** — anything further away is detached (`src` removed, `load()`), which is the
  virtualisation that keeps a 50-video feed at ~10 MB JS heap.
* **Scroll-settle debounce (160 ms)**: flicking past 20 videos downloads none of them; playback
  starts only where the user stops. Measured effect: 95 MB → 20 MB on a 48-video scroll test.
* **Preload discipline**: active video `preload=auto`, only the *next* one gets `metadata`, and only
  when the current video is already buffered and the link is fast enough. Never the whole feed.
* **Adaptive quality**: picks a rendition from measured throughput (buffered-seconds × bitrate over
  elapsed time, EWMA), `navigator.connection` hints, `saveData`, CSS width × DPR and buffer health.
  Two stalls in 12 s → step down (keeping `currentTime`); 14 s of clean playback with ≥ 10 s buffered
  → step up, but never beyond what the screen can show. Manual override via the quality menu.
* Controls: tap to pause/resume (manual pause respected until it leaves the screen), session-wide
  sound toggle, seek bar with buffer bar, time, quality menu, fullscreen, buffering spinner.
* Stops on `hashchange`, `pagehide` and tab `visibilitychange`.
* `object-fit: contain` + `aspect-ratio` from the stored dimensions → 9:16, 4:5, 1:1 and 16:9 all
  display correctly, nothing is ever stretched or cropped.

## 9. Upload UI states

`Uploading video — N%` → `Processing video — N%` → `Optimizing video — N%` → `Ready ✓`, with a
thumbnail preview in the composer. On failure the user sees **"Video processing failed."** and a
**Try again** action — raw ffmpeg output only ever goes to the server log.

## 10. Environment variables

| Var | Default | Meaning |
|---|---|---|
| `VIDEO_TRANSCODE` | `1` | `0` = store the original untouched (no ffmpeg) |
| `VIDEO_PRESET` | `veryfast` | x264 preset |
| `VIDEO_CONCURRENCY` | `1` | parallel transcode jobs |
| `VIDEO_THREADS` | `1` on ≤2 cores | `-threads` / `-filter_threads` for ffmpeg |
| `VIDEO_NICE` | `1` | run ffmpeg at `nice -n 19` so HTTP always wins the CPU |
| `VIDEO_MAX_HEIGHT` | `1080` | top rung short side |
| `VIDEO_MAX_MB` | `300` | upload size limit |
| `VIDEO_MAX_SECONDS` | `900` | duration limit |
| `VIDEO_MAX_ENCODE_SECONDS` | `180` | above this estimated cost, keep the original bytes instead of re-encoding |
| `VIDEO_SPEED_FACTOR` | `7.5` on ≤2 cores | encode-seconds per second of 1080p video, used for that estimate |
| `VIDEO_KEEP_ORIGINAL` | `0` | keep the source master |
| `MEDIA_BASE_URL` | – | CDN / object-storage prefix for all media URLs |
| `FFMPEG_PATH` / `FFPROBE_PATH` | – | use system binaries instead of the npm ones |

ffmpeg/ffprobe ship as npm dependencies (`ffmpeg-static`, `ffprobe-static`), so no system package
is required on Render, Fly, Docker or shared hosting.

## 11. Scaling path (no rewrite required)

1. **Today** — one Node process: app + SQLite + local media + in-process transcode queue.
2. **10k users** — set `MEDIA_BASE_URL` to a CDN in front of the uploads volume; storage traffic
   leaves the app server.
3. **100k users** — sync `uploads/v/**` to object storage, run the transcode queue as a separate
   worker process/container (`video-jobs.js` is already a standalone module driven by the
   `video_assets` table, which is the job queue).
4. **1M+** — swap SQLite for Postgres, run N stateless web nodes + M transcode workers, keep the
   same asset contract (`uid`, `variants[]`, `poster`), add HLS/DASH packaging alongside the
   existing progressive MP4s.

## 12. Tests

```bash
PART=A node tests/video-matrix-test.js                     # 11 source shapes/codecs → delivered quality
PART=B COUNTS=5,10,20,50 node tests/video-matrix-test.js   # feed size x mobile/laptop/desktop x fast/slow
node tests/video-quality-test.js /path/a.mp4 /path/b.mov   # source vs. delivered quality
node tests/video-feed-test.js                              # scroll behaviour, desktop + mobile
node tests/video-stress-test.js                            # 50-video feed + throttled network
node tests/video-upload-ui-test.js /path/a.mp4             # composer states, thumbnail, publish
```

## 13. Feed-level fixes found by the video stress tests

* **Keyset pagination** — the feed sorted by `(created_at, id)` but paged with `id < cursor`, so
  posts were silently skipped: a 50-video feed only ever rendered ~15. The cursor is now
  `"<created_at>_<id>"` and matches the sort order exactly (old numeric cursors still work).
* **Infinite scroll on short screens** — `IntersectionObserver` only fires on transitions, so on
  mobile the sentinel could stay visible and the feed stopped after two pages. There is now a
  capped auto-fill (max 2 consecutive pages, disabled on 2G/`saveData`) plus a scroll listener, so
  the feed keeps loading without ever competing with video for bandwidth.
