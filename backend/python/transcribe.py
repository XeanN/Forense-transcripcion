"""
Transcribe uno o mas archivos de audio (chunks) con faster-whisper.

Uso:
    python transcribe.py --model-size small --compute-type int8 --language es chunk_000.wav chunk_001.wav ...

Contrato con el proceso Node que lo invoca:
- Progreso: una linea por chunk en stderr con formato "PROGRESS <completados>/<total>"
- Resultado final: un unico objeto JSON en stdout con {"chunks": [...], "text": "..."}
- Error fatal: linea en stderr con prefijo "FATAL: " y exit code distinto de 0
- Nunca se imprime el contenido transcrito en stderr (solo va en el JSON final de stdout)
"""

import argparse
import json
import sys

# En Windows, stdout/stderr pueden heredar el codepage de la consola (ej.
# cp1252) en vez de UTF-8 cuando el proceso es invocado por Node via
# child_process, lo que corrompe tildes y enies. Se fuerza UTF-8 explicito.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def log_progress(done, total):
    print(f"PROGRESS {done}/{total}", file=sys.stderr, flush=True)


def log_stage(stage):
    print(f"STAGE {stage}", file=sys.stderr, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("chunks", nargs="+", help="Rutas de los archivos de audio a transcribir, en orden")
    parser.add_argument("--model-size", default="small")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--language", default="", help="Codigo de idioma (ej. 'es'). Vacio = auto-detectar")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print(f"FATAL: faster-whisper no esta instalado ({exc})", file=sys.stderr, flush=True)
        sys.exit(1)

    try:
        log_stage("loading_model")
        model = WhisperModel(args.model_size, device=args.device, compute_type=args.compute_type)
    except Exception as exc:
        print(f"FATAL: no se pudo cargar el modelo de whisper ({exc})", file=sys.stderr, flush=True)
        sys.exit(1)

    total = len(args.chunks)
    results = []
    language = args.language.strip() or None

    log_stage("transcribing")
    for index, chunk_path in enumerate(args.chunks):
        try:
            segments, _info = model.transcribe(chunk_path, language=language, vad_filter=True)
            chunk_text = "".join(segment.text for segment in segments).strip()
            results.append({"index": index, "text": chunk_text})
        except Exception as exc:
            print(f"FATAL: fallo al transcribir el chunk {index} ({exc})", file=sys.stderr, flush=True)
            sys.exit(1)

        log_progress(index + 1, total)

    full_text = "\n\n".join(r["text"] for r in results if r["text"])

    print(json.dumps({"chunks": results, "text": full_text}, ensure_ascii=False))


if __name__ == "__main__":
    main()
