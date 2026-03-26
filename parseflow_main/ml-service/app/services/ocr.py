import os
import tempfile
import easyocr
import pytesseract
import cv2
from pdf2image import convert_from_path

# Initialize EasyOCR once (performance-critical)
easyocr_reader = easyocr.Reader(['en'], gpu=False)


def preprocess_image(image_path):
    img = cv2.imread(image_path)

    if img is None:
        raise ValueError(f"Invalid image: {image_path}")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    return gray


def extract_with_easyocr(image_path):
    results = easyocr_reader.readtext(image_path)
    text = " ".join([res[1] for res in results])
    return text.strip()


def extract_with_tesseract(image_path):
    processed = preprocess_image(image_path)
    # pytesseract accepts numpy arrays from OpenCV
    text = pytesseract.image_to_string(processed, lang='eng+hin')
    return text.strip()


def is_text_poor(text):
    if not text:
        return True
    if len(text) < 40:
        return True
    if text.count('?') > 5:
        return True
    return False


def extract_text(image_path):
    text = extract_with_easyocr(image_path)

    if is_text_poor(text):
        try:
            fallback_text = extract_with_tesseract(image_path)

            if len(fallback_text) > len(text):
                return fallback_text

        except Exception as e:
            print("Tesseract not available, skipping fallback")

    return text


def extract_text_from_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")

    images = convert_from_path(pdf_path)
    full_text = ""

    for i, img in enumerate(images):
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            temp_path = tmp.name
            img.save(temp_path, 'JPEG')

        try:
            full_text += extract_text(temp_path) + "\n"
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

    return full_text
