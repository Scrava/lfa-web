#!/usr/bin/env python3
"""Restaura como negro el interior transparente de cuatro escudos LFA.

No aplica un rectángulo de fondo: detecta la silueta exterior de cada
escudo, rellena únicamente vacíos internos y mantiene transparente el
exterior. No redibuja nombres ni cambia sus colores.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('cougars.webp', 'scravengers.webp', 'nakillers.webp', 'boom-or-bust.webp')
for name in NAMES:
    path = ROOT / 'assets' / name
    im = Image.open(path).convert('RGBA')
    pixels = np.asarray(im, dtype=np.uint8).copy()
    alpha = pixels[:, :, 3]
    h, w = alpha.shape

    # Las líneas coloreadas del perímetro forman el contorno de cada logo.
    # Una clausura leve une discontinuidades pequeñas de la máscara.
    visible = np.uint8(alpha > 18) * 255
    size = max(7, (int(min(w, h) * 0.025) | 1))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    closed = cv2.morphologyEx(visible, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    silhouette = np.zeros_like(visible)
    min_area = max(75, int(w * h * 0.00020))
    for contour in contours:
        if cv2.contourArea(contour) >= min_area:
            cv2.drawContours(silhouette, [contour], -1, 255, thickness=cv2.FILLED)
    inside = silhouette > 0
    missing = inside & (alpha < 250)
    exact_holes = inside & (alpha == 0)

    # El RGB de un píxel semitransparente se compone con negro.
    # El color ya opaco del dibujo queda EXACTAMENTE como estaba.
    if missing.any():
        original_alpha = alpha[missing].astype(np.float32)[:, None] / 255.0
        pixels[missing, :3] = np.rint(
            pixels[missing, :3].astype(np.float32) * original_alpha
        ).astype(np.uint8)
        pixels[missing, 3] = 255

    Image.fromarray(pixels, 'RGBA').save(
        path, format='WEBP', quality=98, method=6, exact=True
    )
    print(f'{name}: {w}x{h}; zonas transparentes interiores ennegrecidas={int(exact_holes.sum())}; '
          f'píxeles corregidos={int(missing.sum())}; '
          f'exterior conservado={int((~inside & (alpha == 0)).sum())}')
