from services.ocr import extract_text


def main():
    print("=== HYBRID OCR TEST ===")

    text = extract_text("test.jpg")

    print("\n===== FINAL OCR OUTPUT =====\n")
    print(text)


if __name__ == '__main__':
    main()
