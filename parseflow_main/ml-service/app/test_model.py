import os
import sys

from services.classifier import predict_image, load_resources


def main():
    # Expect sample image at ml-service/test.jpg (one level above app)
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    sample = os.path.join(base, 'test.jpg')

    if not os.path.exists(sample):
        print('Sample image not found:', sample)
        print('Place a test image at ml-service/test.jpg and re-run.')
        sys.exit(2)

    try:
        # Ensure resources load (will raise helpful errors if missing)
        load_resources()
    except Exception as e:
        print('Error loading model/resources:', e)
        sys.exit(3)

    try:
        # Enable debug to print raw outputs and mapping
        label, confidence, probs = predict_image(sample, debug=True)
        print(f'Predicted: {label} (confidence: {confidence:.4f})')
    except Exception as e:
        print('Prediction failed:', e)
        sys.exit(4)


if __name__ == '__main__':
    main()
