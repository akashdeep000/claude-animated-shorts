#!/usr/bin/env bash
# Kinetic pass: animated camera move + handheld micro-shake + god rays + drifting
# pollen + light breathing + fine grain. No re-generation, no quota.
# usage: kinetic.sh <in.mp4> <out.mp4> <zoomStart> <zoomEnd> <xD> <yD> <rayAlpha>
set -euo pipefail

IN="$1"; OUT="$2"; ZS="$3"; ZE="$4"; XD="$5"; YD="$6"; RA="$7"
A="${KINETIC_ASSETS:-$HOME/Videos/ramayana-kinetic/_assets}"
FRAMES=$(ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames -of csv=p=0 "$IN")
LAST=$((FRAMES - 1))

ffmpeg -v error -y -i "$IN" \
  -loop 1 -t 6 -i "$A/rays.png" \
  -loop 1 -t 6 -i "$A/dust.png" \
  -filter_complex "\
[0:v]fps=24,scale=1512:2688:flags=lanczos,setsar=1,\
zoompan=z='${ZS}+(${ZE}-${ZS})*on/${LAST}':\
x='(iw-iw/zoom)/2+${XD}*on/${LAST}+5*sin(on/7)':\
y='(ih-ih/zoom)/2+${YD}*on/${LAST}+4*cos(on/9)':\
d=1:s=720x1280:fps=24,\
eq=brightness='0.012*sin(t*1.9)':saturation=1.06,\
noise=alls=4:allf=t[base];\
[1:v]scale=1800:-1,format=rgba,crop=720:1280:x='600+80*t':y=0,\
colorchannelmixer=aa=${RA}[rays];\
[base][rays]blend=all_mode=screen:shortest=1[lit];\
[2:v]format=rgba,colorchannelmixer=aa=0.45,scale=720:-1[dustA];\
[lit][dustA]overlay=x='10*sin(t/2.5)':y='-t*85':shortest=1:eval=frame[d1];\
[2:v]format=rgba,colorchannelmixer=aa=0.30,scale=760:-1[dustB];\
[d1][dustB]overlay=x='-20+14*sin(t/1.7)':y='-t*190':shortest=1:eval=frame,\
format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -crf 18 -preset medium -movflags +faststart "$OUT"

echo "wrote $OUT ($(ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames -of csv=p=0 "$OUT") frames)"
