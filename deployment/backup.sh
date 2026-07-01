#!/usr/bin/env bash
# Gastromek CRM — otomatik MongoDB + yüklenen dosya yedekleme betiği.
#
# Ne yapar:
#   1) Docker içindeki MongoDB'yi (gastromek_db) tek arşiv dosyasına yedekler.
#   2) Yüklenen dekont/görselleri (uploads_data volume) tar.gz olarak yedekler.
#   3) Yedekleri tarih damgalı olarak BACKUP_DIR altında saklar.
#   4) Belirlenen sayıdan (RETENTION) fazla eski yedekleri otomatik siler.
#   5) İşlemi bir log dosyasına yazar.
#
# Elle çalıştırma:  bash /opt/gastromek/deployment/backup.sh
# Haftalık otomatik çalıştırma için betiğin sonundaki cron talimatına bakın.

set -euo pipefail

# --- Ayarlar -----------------------------------------------------------------
DB_NAME="gastromek_db"
BACKUP_DIR="/opt/gastromek-backups"     # Yedeklerin saklanacağı klasör (git reposunun DIŞINDA)
RETENTION=8                              # Kaç adet en son yedek tutulsun (8 hafta = ~2 ay)
LOG_FILE="$BACKUP_DIR/backup.log"

TS="$(date +%F_%H%M%S)"
DB_OUT="$BACKUP_DIR/mongo_${DB_NAME}_${TS}.archive.gz"
UPLOADS_OUT="$BACKUP_DIR/uploads_${TS}.tar.gz"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date +%F' '%T)] $*" | tee -a "$LOG_FILE"; }

log "=== Yedekleme başladı (TS=$TS) ==="

# --- MongoDB container'ını bul ----------------------------------------------
MONGO_CID="$(docker ps -qf name=mongo | head -n1 || true)"
if [[ -z "$MONGO_CID" ]]; then
    log "HATA: Çalışan MongoDB container'ı bulunamadı. Yedekleme iptal edildi."
    exit 1
fi

# --- 1) MongoDB yedeği (sıkıştırılmış arşiv) --------------------------------
if docker exec "$MONGO_CID" sh -c "mongodump --db=$DB_NAME --archive --gzip" > "$DB_OUT" 2>>"$LOG_FILE"; then
    log "OK: Veritabanı yedeği -> $DB_OUT ($(du -h "$DB_OUT" | cut -f1))"
else
    log "HATA: mongodump başarısız oldu."
    rm -f "$DB_OUT"
    exit 1
fi

# --- 2) Yüklenen dosyalar (uploads) yedeği ----------------------------------
# uploads_data volume'unu geçici bir alpine container ile tar.gz yapıyoruz.
UPLOADS_VOL="$(docker volume ls -q | grep -E 'uploads_data$' | head -n1 || true)"
if [[ -n "$UPLOADS_VOL" ]]; then
    if docker run --rm -v "$UPLOADS_VOL":/data:ro alpine sh -c "tar czf - -C /data ." > "$UPLOADS_OUT" 2>>"$LOG_FILE"; then
        log "OK: Yüklenen dosyalar yedeği -> $UPLOADS_OUT ($(du -h "$UPLOADS_OUT" | cut -f1))"
    else
        log "UYARI: uploads yedeği alınamadı (devam ediliyor)."
        rm -f "$UPLOADS_OUT"
    fi
else
    log "UYARI: uploads_data volume bulunamadı (uploads yedeği atlandı)."
fi

# --- 3) Eski yedekleri temizle (rotasyon) -----------------------------------
cleanup() {
    local pattern="$1"
    local files
    files="$(ls -1t $BACKUP_DIR/$pattern 2>/dev/null || true)"
    local count=0
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        count=$((count + 1))
        if (( count > RETENTION )); then
            rm -f "$f" && log "Silindi (eski): $f"
        fi
    done <<< "$files"
}
cleanup "mongo_${DB_NAME}_*.archive.gz"
cleanup "uploads_*.tar.gz"

log "=== Yedekleme tamamlandı. Mevcut yedekler: $(ls -1 $BACKUP_DIR/mongo_*.archive.gz 2>/dev/null | wc -l) adet ==="
log ""

# -----------------------------------------------------------------------------
# GERİ YÜKLEME (felaket anında):
#   MONGO_CID=$(docker ps -qf name=mongo | head -n1)
#   docker exec -i "$MONGO_CID" sh -c 'mongorestore --archive --gzip --drop' < /opt/gastromek-backups/mongo_gastromek_db_YYYY-MM-DD_HHMMSS.archive.gz
#   # uploads geri yükleme:
#   UPLOADS_VOL=$(docker volume ls -q | grep -E 'uploads_data$' | head -n1)
#   docker run --rm -v "$UPLOADS_VOL":/data -v /opt/gastromek-backups:/backup alpine sh -c 'tar xzf /backup/uploads_YYYY-MM-DD_HHMMSS.tar.gz -C /data'
# -----------------------------------------------------------------------------
