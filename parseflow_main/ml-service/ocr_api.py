from flask import Flask, request, jsonify
import os
import traceback

app = Flask(__name__)


@app.route('/extract', methods=['POST'])
def extract():
    try:
        data = request.get_json(force=True)
        file_path = data.get('file_path')
        if not file_path:
            return jsonify({'error': 'file_path required'}), 400

        if not os.path.isabs(file_path):
            file_path = os.path.abspath(file_path)

        if not os.path.exists(file_path):
            return jsonify({'error': f'file not found: {file_path}'}), 400

        # Import OCR module lazily
        from app.services import ocr

        # If PDF, call PDF extractor
        _, ext = os.path.splitext(file_path.lower())
        if ext in ('.pdf',):
            text = ocr.extract_text_from_pdf(file_path)
        else:
            text = ocr.extract_text(file_path)

        return jsonify({'text': text})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Run on 127.0.0.1:8002
    app.run(host='127.0.0.1', port=8002)
