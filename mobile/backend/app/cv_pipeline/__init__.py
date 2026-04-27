"""CV pipeline: implements ALL 7 PBL image-processing techniques.

Modules map to techniques from the PBL guideline:
- enhancement.py     -> 1. Image Enhancement (intensity transformations, gamma, CLAHE)
- histogram.py       -> 2. Histogram Processing (equalisation, matching, CLAHE comparison)
- spatial.py         -> 3. Spatial Filtering (median/gaussian/bilateral, edge detection)
- frequency.py       -> 4. Frequency-Domain Filtering (FFT high-pass, micro-print energy)
- noise.py           -> 5. Noise Removal (median residual + non-local means denoise)
- morphology.py      -> 6. Morphological Operations (open/close on security-thread mask)
- colorspace.py      -> 7. Colour-Space Transformations (HSV + CIE Lab fingerprints)

ensemble.py combines per-check scores into a final authenticity score.
classifier.py owns currency / denomination prediction from CIE Lab fingerprints,
including dominant-colour clustering and currency hint priority.
"""
