Modelos do leitor de notas: PaddleOCR (licença Apache-2.0), convertidos para ONNX.

- `det.onnx`: acha as linhas de texto (`en_PP-OCRv3_det`).
- `rec.onnx`, `dict.txt`: lê cada linha (`latin_PP-OCRv5_mobile_rec`, com acentos do português).

Fonte: https://huggingface.co/monkt/paddleocr-onnx (`detection/v3`, `languages/latin`).
`scripts/copy-ocr.mjs` copia para `public/ocr/paddle-v1`. Ao trocar os modelos, mude a pasta de versão:
o celular guarda os arquivos de `/ocr` para sempre.
