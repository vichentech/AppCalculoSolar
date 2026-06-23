#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# VichenSolarApp — Configuración inicial de Ollama
# Ejecuta este script UNA SOLA VEZ después de `docker compose up -d`
# para descargar el modelo de IA al servidor.
# ─────────────────────────────────────────────────────────────────────────────

# Modelo por defecto recomendado (ver tabla de modelos al final del script)
MODEL="${1:-qwen2.5:7b}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         VichenSolarApp — Configuración de Ollama             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "▶ Descargando modelo: $MODEL"
echo "  (Esto puede tardar varios minutos según tu conexión)"
echo ""

# Esperar a que Ollama esté listo
echo "⏳ Esperando a que el servicio Ollama esté disponible..."
until docker exec vichensolar_ollama ollama list > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Ollama está listo."
echo ""

# Descargar el modelo
docker exec vichensolar_ollama ollama pull "$MODEL"

echo ""
echo "✅ Modelo '$MODEL' descargado correctamente."
echo ""
echo "  Para usar otro modelo, edita OLLAMA_MODEL en docker-compose.yml"
echo "  y vuelve a ejecutar:  docker compose up -d n8n"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# MODELOS RECOMENDADOS (CPU sin GPU):
#
#  Modelo              RAM mínima   Calidad   Velocidad   Uso
#  ─────────────────────────────────────────────────────────────────────────
#  qwen2.5:3b           3 GB        Buena     Rápida      VPS pequeño / dev
#  qwen2.5:7b           5 GB        Muy buena  Media      VPS mediano (recom.)
#  llama3.2:3b          3 GB        Buena     Rápida      Alternativa ligera
#  mistral:7b           5 GB        Muy buena  Media      VPS mediano
#  llama3.1:8b          6 GB        Excelente  Lenta      VPS grande
#
#  Uso: ./setup-ollama.sh <nombre-modelo>
#  Ej:  ./setup-ollama.sh qwen2.5:3b
# ─────────────────────────────────────────────────────────────────────────────
