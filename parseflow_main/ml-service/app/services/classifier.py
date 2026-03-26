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


def preprocess_image(image_path: str,
                     target_size: tuple = (128, 128),
                     normalize: bool = True,
                     channel_order: str = 'RGB',
                     resize_mode: str = 'bilinear') -> np.ndarray:
    """Load and preprocess image.

    Parameters:
      - image_path: path to image
      - target_size: (W,H)
      - normalize: True to divide by 255.0
      - channel_order: 'RGB' or 'BGR'
      - resize_mode: 'bilinear'|'nearest'|'bicubic'

    Returns: numpy array with shape (1,H,W,3)
    """
    img = Image.open(image_path).convert('RGB')

    resample_map = {
        'nearest': Image.NEAREST,
        'bilinear': Image.BILINEAR,
        'bicubic': Image.BICUBIC,
    }
    resample = resample_map.get(resize_mode, Image.BILINEAR)

    img = img.resize(target_size, resample=resample)
    arr = np.asarray(img, dtype=np.float32)

    if channel_order.upper() == 'BGR':
        arr = arr[..., ::-1]

    if normalize:
        arr = arr / 255.0

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


def predict_image(image_path: str,
                  normalize: bool = True,
                  channel_order: str = 'RGB',
                  resize_mode: str = 'bilinear',
                  target_size: tuple = (128, 128),
                  threshold: float = 0.0,
                  debug: bool = False) -> (str, float, List[float]):
    """Preprocess image and predict. See `preprocess_image` for options."""
    x = preprocess_image(image_path, target_size=target_size, normalize=normalize,
                         channel_order=channel_order, resize_mode=resize_mode)
    return predict_array(x, threshold=threshold, debug=debug)


def run_variations(image_path: str, variations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Run multiple preprocessing variations and return results.

    `variations` is a list of dicts with keys accepted by `predict_image` (normalize, channel_order, etc.).
    Returns list of results with keys: variation, label, confidence, probs
    """
    results = []
    for var in variations:
        opts = dict(
            normalize=var.get('normalize', True),
            channel_order=var.get('channel_order', 'RGB'),
            resize_mode=var.get('resize_mode', 'bilinear'),
            target_size=var.get('target_size', (128, 128)),
            threshold=var.get('threshold', 0.0),
            debug=var.get('debug', False),
        )
        label, confidence, probs = predict_image(image_path, **opts)
        results.append({'variation': opts, 'label': label, 'confidence': confidence, 'probs': probs})
    return results


__all__ = ['predict_image', 'predict_array', 'preprocess_image', 'run_variations', 'load_resources']


def _default_variations():
    """Return default variations used by the CLI/debug harness.

    Tests normalization on/off and RGB/BGR channel orders with debug enabled.
    """
    vars = []
    for normalize in (True, False):
        for channel in ('RGB', 'BGR'):
            vars.append({'normalize': normalize, 'channel_order': channel, 'debug': True})
    return vars


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

    parser = argparse.ArgumentParser(description='Classifier debug CLI - runs preprocessing variations')
    parser.add_argument('paths', nargs='*', help='Image files or directories (defaults to ml-service/test.jpg)')
    parser.add_argument('--target-size', type=int, nargs=2, metavar=('W', 'H'), default=(128, 128),
                        help='Target size to resize images to')
    args = parser.parse_args(argv)

    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    default_img = os.path.join(base, 'test.jpg')

    if not args.paths:
        paths = [default_img]
    else:
        paths = _gather_images(args.paths)

    variations = _default_variations()

    for p in paths:
        print('\n=== Image:', p)
        if not os.path.exists(p):
            print('  (missing)')
            continue
        # Use target size from CLI for each variation
        for var in variations:
            var_opts = dict(var)
            var_opts['target_size'] = tuple(args.target_size)
            # call predict_image which will print debug info when debug=True
            label, confidence, probs = predict_image(p,
                                                    normalize=var_opts.get('normalize', True),
                                                    channel_order=var_opts.get('channel_order', 'RGB'),
                                                    resize_mode=var_opts.get('resize_mode', 'bilinear'),
                                                    target_size=var_opts.get('target_size', (128, 128)),
                                                    threshold=var_opts.get('threshold', 0.0),
                                                    debug=var_opts.get('debug', False))
            print(f"  var(normalize={var_opts.get('normalize')}, channel={var_opts.get('channel_order')}) -> {label} ({confidence:.4f})")


if __name__ == '__main__':
    _cli_main()
