from flask import Flask, request, jsonify
import os
import traceback
from PIL import Image
import numpy as np
import tensorflow as tf
app = Flask(__name__)
@app.route('/predict', methods=['POST'])
def predict():
    try:
        try:
            data = request.get_json(force=True)
        except Exception as json_err:
            print(f"[ML Service] JSON parse error: {json_err}")
            print(f"[ML Service] Raw body: {request.data}")
            return jsonify({'error': f'Invalid JSON: {str(json_err)}'}), 400
            
        file_path = data.get('file_path')
        debug = bool(data.get('debug', False))
        if not file_path:
            return jsonify({'error': 'file_path required'}), 400
        file_path = file_path.replace('\\', '/')
        
        # Accept absolute or relative paths
        if not os.path.isabs(file_path):
            file_path = os.path.abspath(file_path)

        if not os.path.exists(file_path):
            return jsonify({'error': f'file not found: {file_path}'}), 400

        # Import classifier and ensure resources are loaded
        from app.services import classifier
        classifier.load_resources()

        # Preprocess using a single fixed pipeline (RGB, 128x128, no normalization)
        def preprocess_image(image_path):
            img = Image.open(image_path).convert('RGB')
            img = img.resize((128, 128), resample=Image.BILINEAR)
            arr = np.asarray(img, dtype=np.float32)
            # Convert RGB -> BGR to align with classifier default
            arr = arr[..., ::-1]
            arr = np.expand_dims(arr, axis=0)
            return arr

        img = preprocess_image(file_path)

        model = getattr(classifier, '_MODEL', None)
        classnames = getattr(classifier, '_CLASSNAMES', None)
        if model is None or classnames is None:
            return jsonify({'error': 'Model not loaded'}), 500

        preds = model.predict(img)
        probs = tf.nn.softmax(preds[0]).numpy()
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        label = str(classnames[idx]) if idx < len(classnames) else f'class_{idx}'

        resp = {'class': label, 'confidence': confidence}
        if debug:
            resp['probs'] = probs.tolist()
            resp['classnames'] = list(classnames)

        return jsonify(resp)

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8001)))
