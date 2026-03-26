import os
import numpy as np
from PIL import Image
from typing import List, Dict, Any

try:
    from tensorflow.keras.models import load_model
except Exception:
    load_model = None


_MODEL = None
_CLASSNAMES = None


def _model_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'models', 'model.h5'))


def _classnames_path() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'models', 'classnames.npy'))


def load_resources():
    """Load model and classnames into module-level variables."""
    global _MODEL, _CLASSNAMES
    if _MODEL is not None and _CLASSNAMES is not None:
        return

    model_file = _model_path()
    class_file = _classnames_path()

    if load_model is None:
        raise ImportError('TensorFlow/Keras not available. Install tensorflow to use the classifier.')

    if not os.path.exists(model_file):
        raise FileNotFoundError(f'Model file not found: {model_file}')
    if not os.path.exists(class_file):
        raise FileNotFoundError(f'Classnames file not found: {class_file}')

    _MODEL = load_model(model_file)
    _CLASSNAMES = np.load(class_file, allow_pickle=True)
    _CLASSNAMES = np.asarray(_CLASSNAMES).ravel().astype(str)


def preprocess_image(image_path: str) -> np.ndarray:
    """Load and preprocess image using the fixed production pipeline.

    Fixed rules (do NOT change):
      - convert to RGB
      - resize to 128x128
      - do NOT normalize (keep raw 0-255 values)
      - return array with shape (1,128,128,3) dtype float32
    """
    img = Image.open(image_path).convert('RGB')
    img = img.resize((128, 128), resample=Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)
    # Convert RGB -> BGR to match original training channel order (higher consistency)
    arr = arr[..., ::-1]
    if arr.ndim == 3:
        arr = np.expand_dims(arr, axis=0)
    return arr


def _softmax(logits: np.ndarray) -> np.ndarray:
    a = np.asarray(logits, dtype=np.float64)
    if a.size == 0:
        return a
    a = a.ravel()
    exps = np.exp(a - np.max(a))
    probs = exps / np.sum(exps)
    return probs


def predict_array(x: np.ndarray, threshold: float = 0.0, debug: bool = False) -> (str, float, List[float]):
    """Predict from a preprocessed array `x`.

    Returns (label, confidence, probs)
    """
    load_resources()
    preds = _MODEL.predict(x)
    raw = np.array(preds).ravel()
    probs = _softmax(raw)
    probs = np.clip(probs, 0.0, 1.0)
    if probs.sum() <= 0:
        probs = np.ones_like(probs, dtype=float) / float(probs.size)
    else:
        probs = probs / float(probs.sum())

    idx = int(np.argmax(probs))
    confidence = float(probs[idx])
    label = _CLASSNAMES[idx] if idx < len(_CLASSNAMES) else f'class_{idx}'

    if debug:
        print('--- DEBUG PREDICTION ---')
        print('Raw model output:', raw.tolist())
        print('After softmax (probs):', probs.tolist())
        print('Predicted index:', idx)
        print('Mapped class name:', label)
        print('All classnames:', _CLASSNAMES.tolist())

    if confidence < threshold:
        return 'Unknown', confidence, probs.tolist()

    return label, confidence, probs.tolist()


def predict_image(image_path: str, threshold: float = 0.0, debug: bool = False) -> (str, float, List[float]):
    """Preprocess image with fixed pipeline and predict."""
    x = preprocess_image(image_path)
    return predict_array(x, threshold=threshold, debug=debug)


# Variations and channel switching removed to enforce a single deterministic pipeline.


__all__ = ['predict_image', 'predict_array', 'preprocess_image', 'load_resources']


def _default_variations():
    # Deprecated: variations removed. Keep a single deterministic pipeline.
    return []


def _gather_images(arg_paths):
    out = []
    for a in arg_paths:
        if os.path.isdir(a):
            for fn in os.listdir(a):
                if fn.lower().endswith(('.jpg', '.jpeg', '.png')):
                    out.append(os.path.join(a, fn))
        else:
            out.append(a)
    return out


def _cli_main(argv=None):
    import argparse

    parser = argparse.ArgumentParser(description='Classifier CLI - runs classifier on provided images')
    parser.add_argument('paths', nargs='*', help='Image files or directories (defaults to ml-service/test.jpg)')
    args = parser.parse_args(argv)

    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    default_img = os.path.join(base, 'test.jpg')

    if not args.paths:
        paths = [default_img]
    else:
        paths = _gather_images(args.paths)

    for p in paths:
        print('\n=== Image:', p)
        if not os.path.exists(p):
            print('  (missing)')
            continue
        label, confidence, probs = predict_image(p, debug=True)
        print(f"  result -> {label} ({confidence:.4f})")


if __name__ == '__main__':
    _cli_main()
