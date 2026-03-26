import os
import sys
from app.services import classifier


def run_on_paths(paths):
    for p in paths:
        print('\n=== Image:', p)
        if not os.path.exists(p):
            print('  (missing)')
            continue
        label, confidence, probs = classifier.predict_image(p, debug=True)
        print(f"  result -> {label} ({confidence:.4f})")


def gather_images(arg_paths):
    # If arg is a folder, collect images; else treat as files
    out = []
    for a in arg_paths:
        if os.path.isdir(a):
            for fn in os.listdir(a):
                if fn.lower().endswith(('.jpg', '.jpeg', '.png')):
                    out.append(os.path.join(a, fn))
        else:
            out.append(a)
    return out


def main():
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    default_img = os.path.join(base, 'test.jpg')
    args = sys.argv[1:]
    if not args:
        paths = [default_img]
    else:
        paths = gather_images(args)

    run_on_paths(paths)


if __name__ == '__main__':
    main()
