#!/bin/bash
cd /home/claude/ofertare/docs && exec python3 -m http.server 8765 --bind 127.0.0.1
